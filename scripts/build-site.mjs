import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, rmSync, cpSync, writeFileSync } from 'node:fs';
import { resolve, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = join(root, 'app');
const output = join(root, 'dist');
const dataFile = join(source, 'data', 'share.json');
const dataText = readFileSync(dataFile, 'utf8');
const data = JSON.parse(dataText);

// Publishing must use the itinerary-only export, never the imported companion pack.
for (const key of ['tickets', 'hotels', 'todos', 'flights']) {
  assert.ok(Array.isArray(data[key]) && data[key].length === 0, `公開資料不能包含 ${key}`);
}
assert.equal(data.budget, null, '公開資料不能包含同行預算');
assert.ok(Array.isArray(data.days) && data.days.length > 0, '缺少分享行程');
for (const day of data.days) {
  assert.equal(day.hotel, '', '公開資料不能包含住宿名稱');
  assert.equal(day.mapAsset, null, '公開資料不能包含私人地圖附件');
  for (const event of day.events) {
    assert.equal(event.note, '', '請先由資料匯出流程產生分享版');
    assert.equal(event.infoUrl, '');
    assert.equal(event.transport, '');
    assert.ok(Array.isArray(event.ticketIds) && event.ticketIds.length === 0);
  }
}
for (const marker of ['drive.google.com', 'booking-evidence', 'Calle del Arenal', 'Plaza Aviador', 'passport', '護照', '"assets"', '"format":"spain-pocket-trip/v1"']) {
  assert.ok(!dataText.includes(marker), `公開資料含私人資料標記：${marker}`);
}
function filesIn(folder) {
  return readdirSync(folder, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)).flatMap(entry => {
    assert.ok(!entry.isSymbolicLink(), '網站來源不支援符號連結');
    const path = join(folder, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}
const files = filesIn(source);
const allowed = new Set(['.html', '.js', '.css', '.json', '.png', '.svg', '.webmanifest']);
for (const path of files) {
  assert.ok(allowed.has(extname(path)), `網站中有未支援的附件：${relative(source,path)}`);
  assert.ok(!path.endsWith('.travelpack.json'), '同行資料包不能發佈到網站');
}
const hash = createHash('sha256');
for (const path of files) hash.update(relative(source,path)).update(readFileSync(path));
const version = hash.digest('hex').slice(0,12);
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(source, output, { recursive: true });
writeFileSync(join(output, 'sw.js'), readFileSync(join(source,'sw.js'),'utf8').replace('__BUILD_ID__',version));
writeFileSync(join(output, 'app.js'), readFileSync(join(source,'app.js'),'utf8').replace('__BUILD_ID__',version));
let sourceCommit=process.env.VERCEL_GIT_COMMIT_SHA || '';
if (!sourceCommit) {try {sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}}
writeFileSync(join(output,'version.json'),JSON.stringify({build:version,itineraryVersion:data.version,sourceCommit,builtAt:new Date().toISOString()}));
console.log(`Built public PWA: ${data.days.length} days, ${data.days.reduce((n,d)=>n+d.events.length,0)} events; version ${version}`);
console.log('Output: dist/ · No private ticket files are included.');

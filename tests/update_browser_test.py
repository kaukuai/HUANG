"""Exercise cached legacy clients, local companion data, and live itinerary refreshes."""
from base64 import b64encode, b64decode
from hashlib import sha256
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import json
import shutil

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
errors, checks = [], []
site = {'root': ROOT / 'dist', 'data': None, 'unavailable': False}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(site['root']), **kwargs)

    def log_message(self, *_args):
        pass

    def do_GET(self):
        path = self.path.split('?')[0]
        if path in ['/data/share.json', '/version.json'] and site['unavailable']:
            self.send_error(503)
        elif path == '/data/share.json' and site['data']:
            body = json.dumps(site['data'], ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def pdf_bytes():
    """Small valid PDF, with no real booking or passenger information."""
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>',
               b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
               b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>']
    output, offsets = b'%PDF-1.4\n', [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(len(output))
        output += f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n'
    xref = len(output)
    output += b'xref\n0 4\n0000000000 65535 f \n'
    output += b''.join(f'{offset:010} 00000 n \n'.encode() for offset in offsets[1:])
    return output + f'trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF'.encode()


def asset(name, kind, content):
    return {'id': sha256(content).hexdigest()[:24], 'name': name, 'type': kind,
            'data': b64encode(content).decode()}


with TemporaryDirectory(prefix='spain-update-test-') as temp:
    temp = Path(temp)
    legacy = temp / 'legacy'
    (legacy / 'data').mkdir(parents=True)
    public = json.loads((ROOT / 'dist/data/share.json').read_text())
    old = json.loads(json.dumps(public))
    old['version'] = '2026-10-15-v2'
    day = next(d for d in old['days'] if d['date'] == '2026-12-27')
    day['events'] = [e for e in day['events'] if 'MITO' not in e['title']]
    day.pop('optionalStops', None)
    (legacy / 'data/share.json').write_text(json.dumps(old))
    # Reproduce the earlier shell's cache behavior and absence of an update listener.
    (legacy / 'index.html').write_text('''<!doctype html><meta charset="utf-8">
      <input id="legacy-pack" type="file"><p id="legacy-status"></p>
      <div id="legacy-timeline"></div><script type="module" src="./app.js"></script>''')
    (legacy / 'app.js').write_text('''
      import {read,importPack,saveSetting} from './storage.js';
      function render(trip){document.querySelector('#legacy-timeline').textContent=JSON.stringify(trip.days.find(d=>d.date==='2026-12-27').events.map(e=>e.title));}
      const saved=await read('settings','privateTrip');
      render(saved||await (await fetch('./data/share.json')).json());
      document.querySelector('#legacy-pack').onchange=async e=>{
        const trip=await importPack(JSON.parse(await e.target.files[0].text()));
        await saveSetting('mode','private');render(trip);
        document.querySelector('#legacy-status').textContent='imported';
      };
      await navigator.serviceWorker.register('./sw.js');
      window.legacyReady=true;
    ''')
    shutil.copy(ROOT / 'app/storage.js', legacy / 'storage.js')
    (legacy / 'sw.js').write_text('''
      const CACHE='spain-pocket-legacy';
      self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(
        ['./','./index.html','./app.js','./storage.js','./data/share.json'])).then(()=>self.skipWaiting())));
      self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
      self.addEventListener('fetch',e=>{
        if(e.request.mode==='navigate'||e.request.url.endsWith('/data/share.json')){
          e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));return;
        }
        e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));
      });
    ''')
    ticket = asset('test-ticket.pdf', 'application/pdf', pdf_bytes())
    image = asset('test-map.png', 'image/png', b64decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII='))
    private = json.loads(json.dumps(old))
    private.update(tickets=[{'id':'TEST','title':'Test ticket','date':'2026-12-27','time':'10:00',
                            'status':'Test','statusKind':'neutral','note':'Local only',
                            'files':[{'label':'Test PDF','assetId':ticket['id']}]}],
                   budget={'core':100,'allIn':200})
    for d in private['days']:
        d['mapAsset'] = image['id']
    pack = temp / 'test.travelpack.json'
    pack.write_text(json.dumps({'format':'spain-pocket-trip/v1','trip':private,'assets':[ticket,image]}))
    site['root'] = legacy
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            context = browser.new_context(viewport={'width':390,'height':844}, timezone_id='Asia/Taipei')
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(origin + '/#plan')
            page.wait_for_function('window.legacyReady && navigator.serviceWorker.controller')
            page.locator('#legacy-pack').set_input_files(pack)
            expect(page.locator('#legacy-status')).to_have_text('imported')
            expect(page.locator('#legacy-timeline')).not_to_contain_text('Gelateria MITO')
            expect(page.locator('#legacy-timeline')).not_to_contain_text('99 Cheesecake')
            site['root'] = ROOT / 'dist'
            page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update())')
            expect(page.locator('.nav-item[data-tab="plan"]')).to_be_visible(timeout=30000)
            expect(page.locator('.mode-pill')).to_contain_text('同行完整版')
            page.locator('[data-action="day"][data-date="2026-12-27"]').click()
            expect(page.locator('.timeline')).to_contain_text('Gelateria MITO')
            expect(page.locator('.optional-stops')).to_contain_text('99 Cheesecake')
            expect(page.locator('.map-update-note')).to_contain_text('匯入新版')
            expect(page.locator('.day-heading [data-action="asset"]')).to_have_count(0)
            assert page.evaluate("import('./storage.js').then(m=>m.read('settings','privateTrip')).then(t=>t.version)") == '2026-10-15-v2'
            checks.append('舊快取頁面自動載入新版，舊同行包保留且12/27顯示MITO與99 Cheesecake')
            caches = page.evaluate('caches.keys()')
            assert 'spain-pocket-legacy' not in caches, caches

            page.locator('.nav-item[data-tab="trip"]').click()
            site['data'] = json.loads(json.dumps(public))
            site['data']['version'] = '2026-10-15-v4'
            latest = next(d for d in site['data']['days'] if d['date'] == '2026-12-27')
            latest['optionalStops'][0]['title'] = '99 Cheesecake | Updated live'
            page.locator('[data-action="sync"]').click()
            expect(page.locator('#sync-status')).to_contain_text('2026-10-15-v4')
            page.locator('.nav-item[data-tab="plan"]').click()
            expect(page.locator('.optional-stops')).to_contain_text('Updated live')
            checks.append('不重開頁面即可按鈕更新公開行程，私人附件版本維持不變')

            site['data']['version'] = '2026-10-15-v5'
            latest['optionalStops'][0]['title'] = '99 Cheesecake | Reconnected'
            context.set_offline(True)
            context.set_offline(False)
            expect(page.locator('.optional-stops')).to_contain_text('Reconnected', timeout=15000)
            checks.append('恢復連線自動取得最新行程')

            site['unavailable'] = True
            page.locator('.nav-item[data-tab="trip"]').click()
            page.locator('[data-action="sync"]').click()
            expect(page.locator('#sync-status')).to_contain_text('已儲存')
            page.locator('.nav-item[data-tab="plan"]').click()
            expect(page.locator('.optional-stops')).to_contain_text('Reconnected')
            site['unavailable'] = False
            checks.append('網站暫時503仍可使用快取行程')

            context.set_offline(True)
            page.reload()
            expect(page.locator('.optional-stops')).to_contain_text('Reconnected')
            page.locator('.nav-item[data-tab="tickets"]').click()
            page.locator('.ticket-card summary').click()
            page.locator('.ticket-card [data-action="asset"]').click()
            expect(page.locator('#viewer iframe')).to_be_visible()
            saved = page.evaluate("import('./storage.js').then(m=>m.read('assets', '" + ticket['id'] + "')).then(a=>a.blob.text())")
            assert saved == pdf_bytes().decode()
            checks.append('離線重開保留最新行程與舊同行包PDF原始內容')

            # Updated clients acknowledge a new shell and defer reload while viewing a ticket.
            context.set_offline(False)
            next_shell = temp / 'next-shell'
            shutil.copytree(ROOT / 'dist', next_shell)
            build = json.loads((next_shell / 'version.json').read_text())['build']
            for name in ['app.js','sw.js']:
                path = next_shell / name
                path.write_text(path.read_text().replace(build, 'regression-next'))
            site['root'] = next_shell
            page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update())')
            page.wait_for_function("caches.keys().then(keys=>keys.includes('spain-pocket-regression-next'))")
            page.wait_for_function("document.querySelector('#viewer').open && navigator.serviceWorker.controller")
            page.wait_for_timeout(1200)
            expect(page.locator('#viewer iframe')).to_be_visible()
            page.locator('#close-viewer').click()
            page.locator('.nav-item[data-tab="trip"]').click()
            expect(page.locator('[data-action="apply-shell"]')).to_be_visible()
            page.locator('[data-action="apply-shell"]').click()
            expect(page.locator('[data-action="apply-shell"]')).to_have_count(0)
            expect(page.locator('.mode-pill')).to_contain_text('同行完整版')
            checks.append('開啟票券期間延後程式換版，手動載入後資料保留且不重載循環')
            browser.close()
    finally:
        server.shutdown()

assert not errors, errors
print(json.dumps({'checks':checks,'browser_errors':errors}, ensure_ascii=False, indent=2))

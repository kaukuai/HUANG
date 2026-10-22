"""Verify the real local companion export without serving it on the website."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from tempfile import TemporaryDirectory
from copy import deepcopy
import base64,hashlib,json,fitz
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
P=Path('/workspace/spain-planning')
report=json.loads((P/'review/app-build-report.json').read_text())
pack_path=Path(report['private_pack']);pack=json.loads(pack_path.read_text());errors=[];checks=[]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT/'dist'),**kw)
    def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
try:
 with sync_playwright() as pw, TemporaryDirectory(prefix='spain-real-pack-') as temp:
    temp=Path(temp);browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    context.route('https://tile.openstreetmap.org/**',lambda r:r.abort())
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(origin,wait_until='networkidle');page.wait_for_function('navigator.serviceWorker.controller !== null')
    assert page.request.get(origin+'/'+pack_path.name).status==404
    page.locator('.nav-item[data-tab="tickets"]').click();page.locator('#pack-input').set_input_files(str(pack_path))
    expect(page.locator('#toast')).to_contain_text('匯入完成',timeout=60000)
    expect(page.locator('.ticket-card')).to_have_count(report['tickets'])
    for key,text in [('K17','原票已核對'),('K16','日期待改訂'),('K09','原始附件待補'),('P03','尚未購票')]:
        page.locator('#ticket-search').fill(key);expect(page.locator('.ticket-card')).to_contain_text(text)
    page.locator('#ticket-search').fill('K17');page.locator('.ticket-card summary').click();page.locator('.ticket-card .file-button').click()
    expect(page.locator('#viewer iframe')).to_be_visible();page.locator('#close-viewer').click()
    page.locator('.nav-item[data-tab="trip"]').click();expect(page.locator('.main')).to_contain_text('預算待重新核對')
    assert page.locator('.hotel-row').count()==4
    checks.append('真實43份附件匯入成功，30筆票券／訂位可查；錯誤日期與缺件不冒充有效票，住宿與未知預算正確')
    # Verify every stored original and offline map by bytes, not only file counts.
    stored=page.evaluate("""async ids=>{const s=await import('./storage.js');let out={};for(const id of ids){const a=await s.read('assets',id);out[id]=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await a.blob.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,24)}return out}""",[a['id'] for a in pack['assets']])
    for a in pack['assets']:assert stored[a['id']]==a['id']
    checks.append('IndexedDB內每份PDF／圖片／Wallet票／地圖／提醒內容均與匯入檔原始雜湊相符')
    context.set_offline(True);page.reload(wait_until='networkidle')
    page.locator('.nav-item[data-tab="tickets"]').click();page.locator('#ticket-search').fill('K01');page.locator('.ticket-card summary').click();page.locator('.ticket-card .file-button').first.click()
    expect(page.locator('#viewer iframe')).to_be_visible();assert page.locator('#viewer iframe').get_attribute('src').startswith('blob:');page.locator('#close-viewer').click()
    page.locator('#ticket-search').fill('K06');page.locator('.ticket-card summary').click();page.locator('.ticket-card .file-button').first.click();expect(page.locator('#viewer img')).to_be_visible();page.locator('#close-viewer').click()
    page.locator('.nav-item[data-tab="plan"]').click();page.locator('[data-action="day"][data-date="2027-01-02"]').click();page.locator('.day-heading [data-action="asset"]').click();expect(page.locator('#viewer img')).to_be_visible();page.locator('#close-viewer').click()
    expect(page.locator('.timeline')).to_contain_text('Sagardi')
    checks.append('離線重開後真實皇宮PDF、阿爾罕布拉圖片票與最新版1/2動線示意均可開啟')
    context.set_offline(False);context.close()
    # A device with previous airline originals retains them when importing the restoration.
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    context.route('https://tile.openstreetmap.org/**',lambda r:r.abort())
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(origin,wait_until='networkidle');page.wait_for_function('navigator.serviceWorker.controller !== null')
    old=deepcopy(pack);old.pop('retainExistingTicketIds',None);old['trip']['version']='2026-10-16-v2';old['trip']['budget']={'core':100,'allIn':200}
    doc=fitz.open();doc.new_page();raw=doc.tobytes();aid=hashlib.sha256(raw).hexdigest()[:24]
    old['assets'].append({'id':aid,'name':'synthetic-existing-VY1121.pdf','type':'application/pdf','data':base64.b64encode(raw).decode()})
    next(t for t in old['trip']['tickets'] if t['id']=='K09').update(files=[{'label':'既有VY1121測試原件','assetId':aid,'url':''}],status='已購票',statusKind='confirmed',missingAttachment=False)
    old_path=temp/'old-pack.json';old_path.write_text(json.dumps(old,ensure_ascii=False))
    page.locator('#pack-input').set_input_files(str(old_path));expect(page.locator('#toast')).to_contain_text('匯入完成',timeout=60000)
    page.locator('#pack-input').set_input_files(str(pack_path));expect(page.locator('#toast')).to_contain_text('匯入完成',timeout=60000)
    page.locator('.nav-item[data-tab="tickets"]').click();page.locator('#ticket-search').fill('K09')
    expect(page.locator('.ticket-card')).to_contain_text('沿用裝置原件')
    page.locator('.ticket-card summary').click();page.locator('.ticket-card .file-button').click();expect(page.locator('#viewer iframe')).to_be_visible();page.locator('#close-viewer').click()
    assert page.evaluate("""async id=>{const s=await import('./storage.js');const a=await s.read('assets',id);return Array.from(new Uint8Array(await a.blob.arrayBuffer()))}""",aid)==list(raw)
    context.set_offline(True);page.reload(wait_until='networkidle');page.locator('.nav-item[data-tab="tickets"]').click();page.locator('#ticket-search').fill('K09');page.locator('.ticket-card summary').click();page.locator('.ticket-card .file-button').click();expect(page.locator('#viewer iframe')).to_be_visible()
    checks.append('新版匯入保留舊裝置VY1121原始PDF，位元內容未改，更新後離線仍可開啟')
    assert not errors,errors
    browser.close()
finally:server.shutdown()
result={'checks':checks,'browser_errors':errors,'real_pack_bytes':pack_path.stat().st_size}
(P/'review/pack-browser-validation-1022.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))

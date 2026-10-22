"""Daily map interactions with deterministic tiles; provider failure/offline are explicit cases."""
from base64 import b64decode
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from tempfile import TemporaryDirectory
import json
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT/'dist'),**kw)
    def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
errors=[];checks=[];tile_requests=[]
# Do not make repeated third-party map requests in regression tests.
placeholder=b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')
try:
    with sync_playwright() as pw, TemporaryDirectory(prefix='spain-map-tests-') as tmp:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        tile_failure={'active':False}
        def tile(route):
            tile_requests.append(route.request.url)
            if tile_failure['active']:route.abort()
            else:route.fulfill(status=200,content_type='image/png',body=placeholder)
        context.route('https://tile.openstreetmap.org/**',tile)
        page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        def open_locations():
            if page.locator('.map-locations').get_attribute('open') is None:page.locator('.map-locations summary').click()
        page.goto(origin+'/#plan',wait_until='networkidle')
        page.wait_for_function('navigator.serviceWorker.controller !== null')
        for date in ['2026-12-23','2026-12-24','2026-12-25','2026-12-26','2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03','2027-01-04']:
            page.locator(f'[data-action="day"][data-date="{date}"]').click()
            expect(page.locator('.map-canvas')).to_have_count(1)
            assert page.locator('.day-map-marker').count()>0,date
            assert page.evaluate("!!(document.querySelector('#daily-map-slot').compareDocumentPosition(document.querySelector('.timeline')) & Node.DOCUMENT_POSITION_FOLLOWING)")
        checks.append('13個日期均在時間軸上方顯示當日標記，切換日期沒有重複地圖')
        page.locator('[data-action="day"][data-date="2026-12-30"]').click()
        expect(page.locator('.day-map-marker[title*="Basílica de la Sagrada Família"]')).to_have_count(1)
        open_locations()
        page.locator('[data-map-place="barcelona|Vinitus"]').click()
        expect(page.locator('.day-map-popup')).to_contain_text('鵝肝牛排')
        expect(page.locator('.day-map-popup')).to_contain_text('無法訂位')
        assert 'google.com/maps' in page.locator('.day-map-popup a').get_attribute('href')
        popup_before=page.locator('.day-map-marker[title*="Sant Pau"]').get_attribute('style')
        page.locator('.leaflet-control-zoom-in').click()
        page.wait_for_timeout(350)
        assert page.locator('.day-map-marker[title*="Sant Pau"]').get_attribute('style')!=popup_before
        # Routine updates preserve the existing canvas and selected popup/zoom.
        page.evaluate("document.querySelector('.map-canvas').dataset.retained='yes';window.dispatchEvent(new Event('online'))")
        expect(page.locator('.map-canvas')).to_have_attribute('data-retained','yes')
        expect(page.locator('.day-map-popup')).to_contain_text('Vinitus')
        checks.append('聖家堂重複時段合併；地點清單可定位並縮放，彈窗提供必點、提醒與Google連結；刷新保留地圖')
        page.locator('.map-expand').click()
        expect(page.locator('.daily-map-dialog')).to_be_visible()
        assert page.locator('.daily-map-dialog .map-canvas').evaluate('e=>e.clientHeight')>650
        page.locator('.daily-map-dialog .leaflet-control-zoom-out').click()
        page.wait_for_timeout(350)
        page.locator('.daily-map-dialog .leaflet-popup-close-button').click()
        page.locator('.daily-map-dialog .map-canvas').hover()
        canvas=page.locator('.daily-map-dialog .map-canvas').bounding_box()
        old_pos=page.locator('.leaflet-map-pane').get_attribute('style')
        page.mouse.move(canvas['x']+65,canvas['y']+canvas['height']-150)
        page.mouse.down();page.mouse.move(canvas['x']+150,canvas['y']+canvas['height']-230,steps=8);page.mouse.up()
        page.wait_for_timeout(400)
        assert page.locator('.leaflet-map-pane').get_attribute('style')!=old_pos
        # Native touch events exercise Leaflet pinch handling, without browser page zoom.
        session=context.new_cdp_session(page)
        cx=canvas['x']+canvas['width']/2;cy=canvas['y']+canvas['height']/2
        before=page.locator('.day-map-marker[title*="Sant Pau"]').get_attribute('style')
        def fingers(delta):return [{'x':cx-delta,'y':cy,'id':0},{'x':cx+delta,'y':cy,'id':1}]
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':fingers(25)})
        for delta in [35,50,70,90]:
            session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':fingers(delta)})
            page.wait_for_timeout(35)
        session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        session.detach()
        page.wait_for_timeout(350)
        assert page.locator('.day-map-marker[title*="Sant Pau"]').get_attribute('style')!=before
        page.locator('.daily-map-dialog [aria-label="關閉放大地圖"]').click()
        expect(page.locator('.daily-map-dialog')).not_to_be_visible()
        page.locator('[data-map-place="barcelona|Vinitus"]').click()
        page.locator('.map-to-event').click()
        expect(page.locator('#event-d30-vinitus-dinner details')).to_have_attribute('open','')
        checks.append('手機放大視窗可拖曳、按鈕縮放與雙指縮放，關閉返回原頁，彈窗可跳到時間軸活動')
        page.locator('[data-action="day"][data-date="2027-01-02"]').click()
        open_locations()
        expect(page.locator('[data-map-place="barcelona|Re-Cuir"]')).to_contain_text('無固定時間')
        expect(page.locator('[data-map-place="barcelona|Restaurant Galisteo"]')).to_be_disabled()
        unknown=page.locator('li').filter(has=page.locator('[data-map-place="barcelona|Restaurant Galisteo"]'))
        expect(unknown).to_contain_text('位置待核對')
        assert unknown.locator('a').get_attribute('href').startswith('https://www.google.com/maps/')
        for width in [320,390,768,1280]:
            page.set_viewport_size({'width':width,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        checks.append('備選地點不安排假時間，未知店址有Google查詢入口；四種手機／桌面寬度無溢出')
        page.set_viewport_size({'width':390,'height':844})
        # A synthetic companion pack must not put its hotel name/coordinates into map UI.
        data=json.loads((ROOT/'dist/data/share.json').read_text())
        data.update(hotels=[{'city':'巴塞隆納','name':'Private test hotel','dates':'test','address':'Local address','mapUrl':'https://example.com/private','note':''}],tickets=[],budget={'core':1,'allIn':1})
        pack=Path(tmp)/'private.travelpack.json';pack.write_text(json.dumps({'format':'spain-pocket-trip/v1','trip':data,'assets':[]}))
        page.locator('#pack-input').set_input_files(pack)
        expect(page.locator('.mode-pill')).to_contain_text('同行完整版')
        expect(page.locator('.daily-map')).not_to_contain_text('Private test hotel')
        checks.append('同行包匯入後地圖仍使用當日最新地點，不洩露住宿資料')
        tile_failure['active']=True
        open_locations()
        page.locator('[data-map-place="barcelona|Palau Güell"]').click()
        expect(page.locator('.map-status')).to_contain_text('暫時無法載入')
        checks.append('底圖供應商失敗仍顯示標記、清單與明確提示')
        context.set_offline(True)
        page.reload(wait_until='networkidle')
        expect(page.locator('.daily-map')).to_be_visible()
        expect(page.locator('.map-status')).to_contain_text('目前離線')
        assert page.locator('.day-map-marker').count()>0
        page.locator('[data-action="day"][data-date="2026-12-27"]').click()
        expect(page.locator('.map-locations')).to_contain_text('99 Cheesecake')
        assert page.locator('.leaflet-tile').count()==0
        assert page.locator('.day-map-marker').count()>0
        checks.append('離線重開仍可切換日期、查看標記與清單，不假裝已下載街道底圖')
        assert not errors,errors
        browser.close()
finally:server.shutdown()
print(json.dumps({'passed':checks,'pageErrors':errors,'tileRequestsMocked':len(tile_requests)},ensure_ascii=False,indent=2))

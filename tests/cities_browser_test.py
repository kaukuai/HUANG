"""Exercise city summaries and the revised itinerary with a synthetic older pack."""
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import json
import subprocess
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
errors, checks = [], []

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT/'dist'),**kw)
    def log_message(self,*_a): pass

server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
try:
    with TemporaryDirectory(prefix='spain-cities-') as temp, sync_playwright() as pw:
        temp=Path(temp)
        old=json.loads(subprocess.check_output(['git','show','70650bd:app/data/share.json'],cwd=ROOT))
        old.update(hotels=[{'city':city,'name':name,'dates':'test','address':'Local-only test address','mapUrl':'','note':''} for city,name in [('馬德里','Madrid local hotel'),('塞維亞','Sevilla local hotel'),('格拉納達','Granada local hotel'),('巴塞隆納','Barcelona local hotel')]],tickets=[{'id':'F01','title':'Test flight evidence','date':'2026-12-23','time':'','status':'Test','statusKind':'neutral','note':'Local only','files':[]}],budget={'core':100,'allIn':200})
        current=json.loads((ROOT/'dist/data/share.json').read_text())
        old['flights']=[{**e,'id':'old-'+e['number'],'title':e['number']+' old flight','displayTitle':'Older flight title'} for d in current['days'] for e in d['events'] if e.get('isFlight')]
        pack=temp/'older.travelpack.json'
        pack.write_text(json.dumps({'format':'spain-pocket-trip/v1','trip':old,'assets':[]}))
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,timezone_id='Asia/Taipei')
        page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.clock.install(time=datetime(2026,10,19,4,0,tzinfo=timezone.utc))
        page.goto(origin,wait_until='networkidle')
        page.wait_for_function('navigator.serviceWorker.controller !== null')
        expect(page.locator('.city-tile')).to_have_count(4)
        for city,venue in [('madrid','馬德里王宮'),('sevilla','Gelateria MITO'),('granada','Sexitana'),('barcelona','El Glop')]:
            page.locator(f'[data-action="city"][data-city="{city}"].city-tile').click()
            expect(page.locator('#city-overview')).to_be_visible()
            expect(page.locator('#city-overview')).to_contain_text(venue)
            assert page.locator(f'.city-tile[data-city="{city}"]').get_attribute('aria-expanded')=='true'
        expect(page.locator('#city-overview')).to_contain_text('聖家堂・教堂與誕生立面塔（Basílica de la Sagrada Família）')
        expect(page.locator('#city-overview')).to_contain_text('Sagradas Tapas')
        for width in [320,390,768,1280]:
            page.set_viewport_size({'width':width,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        page.set_viewport_size({'width':390,'height':844})
        (ROOT/'artifacts').mkdir(exist_ok=True)
        page.screenshot(path=str(ROOT/'artifacts/cities-mobile.png'),full_page=True)
        checks.append('四城市可點開，主要地點中文在前、時間排序，備選地點無固定時間；四種寬度無水平溢出')

        page.locator('.nav-item[data-tab="plan"]').click()
        page.locator('[data-action="day"][data-date="2026-12-23"]').click()
        expect(page.locator('#event-journey-mu5006 .time-rail strong')).to_have_text('18:40')
        expect(page.locator('#event-journey-mu5006')).to_contain_text('台灣')
        page.locator('[data-action="day"][data-date="2027-01-04"]').click()
        expect(page.locator('#event-journey-home-arrival .time-rail strong')).to_have_text('14:00')
        expect(page.locator('#event-journey-mu5007 .time-rail strong')).to_have_text('12:05')
        checks.append('時間軸補上12/23台灣18:40出發、轉機與1/4台灣14:00抵達，沒有套成西班牙時間')

        page.locator('[data-action="day"][data-date="2026-12-29"]').click()
        expect(page.locator('.timeline')).not_to_contain_text('Tabernnus')
        expect(page.locator('.timeline')).not_to_contain_text('El Nacional')
        expect(page.locator('#event-d29-el-glop-dinner')).to_contain_text('20:00')
        expect(page.locator('#event-d29-el-glop-dinner .badge')).to_contain_text('已訂位')
        expect(page.locator('#event-d29-carrefour')).to_contain_text('家樂福')
        page.locator('#event-d29-carrefour summary').click()
        expect(page.locator('#event-d29-carrefour')).to_contain_text('23:30')
        public_hotel_title=page.locator('#event-d29-return-hotel h3').inner_text()
        assert public_hotel_title.startswith('住宿｜') and 'local hotel' not in public_hotel_title
        meal_color=page.locator('#event-d29-el-glop-dinner .event-content').evaluate('el=>getComputedStyle(el).backgroundColor')
        lodging_color=page.locator('#event-d29-return-hotel .event-content').evaluate('el=>getComputedStyle(el).backgroundColor')
        assert meal_color!=lodging_color
        checks.append('12/29取消機場午餐、20:00 El Glop已訂與飯後家樂福，住宿／餐飲有不同顏色及文字')

        page.locator('[data-action="day"][data-date="2026-12-30"]').click()
        expect(page.locator('.timeline')).to_contain_text('Forn de pa Puiggròs 1')
        expect(page.locator('.timeline')).to_contain_text('Hasta Los Andares')
        expect(page.locator('#event-d30-five-guys')).to_contain_text('Five Guys')
        expect(page.locator('#event-d30-five-guys .badge')).to_contain_text('彈性')
        page.locator('#event-d30-vinitus-dinner summary').click()
        expect(page.locator('#event-d30-vinitus-dinner .activity-details')).to_contain_text('鵝肝牛排')
        expect(page.locator('#event-d30-vinitus-dinner .activity-details')).to_contain_text('無法訂位')
        expect(page.locator('.optional-stop')).to_contain_text('Sagradas Tapas')
        page.screenshot(path=str(ROOT/'artifacts/barcelona-dining-mobile.png'),full_page=True)
        checks.append('12/30新早餐與午餐、彈性Five Guys、Vinitus必點與候位提醒、Sagradas午餐備案可查看')

        page.locator('#pack-input').set_input_files(pack)
        expect(page.locator('.mode-pill')).to_contain_text('同行完整版')
        page.locator('[data-action="day"][data-date="2026-12-29"]').click()
        expect(page.locator('#event-d29-return-hotel h3')).to_contain_text('住宿｜Barcelona local hotel')
        page.locator('[data-action="day"][data-date="2026-12-26"]').click()
        expect(page.locator('#event-b25d16feb656 h3')).to_contain_text('Madrid local hotel')
        expect(page.locator('#event-b996636e0765 h3')).to_contain_text('Sevilla local hotel')
        page.locator('.nav-item[data-tab="tickets"]').click()
        page.locator('#ticket-search').fill('REGLOP')
        expect(page.locator('.ticket-card')).to_contain_text('El Glop')
        expect(page.locator('.ticket-card')).to_contain_text('已訂位')
        checks.append('原10/16同行包自動套用新版；混合城市日顯示正確飯店、新訂位進票夾，原資料保留')

        page.locator('.nav-item[data-tab="trip"]').click()
        page.locator('#preview-time').fill('2026-12-23T11:40')
        page.locator('[data-action="custom-preview"]').click()
        expect(page.locator('.focus-card h2')).to_contain_text('台灣出發')
        expect(page.locator('.focus-card .eyebrow')).to_contain_text('18:40')
        page.locator('[data-action="today"]').click()
        expect(page.locator('.day-chip.selected')).to_contain_text('12/23')
        checks.append('台灣起飛時首頁現在行程及當日時間軸使用正確航段')

        context.set_offline(True)
        page.reload(wait_until='networkidle')
        expect(page.locator('.mode-pill')).to_contain_text('同行完整版')
        page.locator('[data-action="day"][data-date="2027-01-04"]').click()
        expect(page.locator('.timeline')).to_contain_text('返抵台灣')
        page.locator('.nav-item[data-tab="now"]').click()
        page.locator('.city-tile[data-city="barcelona"]').click()
        expect(page.locator('#city-overview')).to_contain_text('El Glop')
        checks.append('飛航模式重新開啟仍可查看新日期、餐飲及可點選的城市總覽')
        browser.close()
finally:
    server.shutdown()
assert not errors,errors
print(json.dumps({'checks':checks,'browser_errors':errors,'ios_safari':'未在實機驗證'},ensure_ascii=False,indent=2))

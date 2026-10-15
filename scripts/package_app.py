from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from html import escape
import base64,hashlib,json,re

R=Path(__file__).resolve().parents[1]
P=Path('/workspace/spain-planning')
report=json.loads((P/'review/app-build-report.json').read_text())
pack=Path(report['private_pack'])
version=report.get('planning_version') or re.search(r'\d{4}-\d{2}-\d{2}(?:-v\d+)?',pack.name).group()
match=re.fullmatch(r'(\d{4})-(\d{2})-(\d{2})(?:-(v\d+))?',version)
stamp=match[2]+match[3]+('_'+match[4] if match[4] else '')
public_name=f'Spain_2026_App_Public_{stamp}.zip'
companion_name=f'Spain_2026_App_Companion_{stamp}.zip'
source_name=f'Spain_2026_App_Source_{stamp}.zip'
preview_name=f'Spain_2026_App_Preview_{stamp}.html'
readme=P/'Spain_2026_App_使用說明.md'
outputs={}
def archive(name,files):
    path=P/name
    with ZipFile(path,'w',ZIP_DEFLATED,compresslevel=6) as z:
        for source,target in files:z.write(source,target)
    with ZipFile(path) as z:
        assert z.testzip() is None
        for source,target in files:
            assert hashlib.sha256(z.read(target)).digest()==hashlib.sha256(source.read_bytes()).digest()
    outputs[name]={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'members':len(files)}
archive(public_name,[(f,str(f.relative_to(R/'dist'))) for f in sorted((R/'dist').rglob('*')) if f.is_file()])
archive(companion_name,[(pack,pack.name),(readme,readme.name)])
sources=[R/'README.md',R/'package.json',R/'package-lock.json',R/'vercel.json',R/'requirements-build.txt',R/'requirements-test.txt',R/'.gitignore']
for folder in ['app','scripts','tests','.github']:
    sources += [f for f in sorted((R/folder).rglob('*')) if f.is_file() and '__pycache__' not in f.parts]
archive(source_name,[(f,str(f.relative_to(R))) for f in sources])

cards=[]
for file,title,note in [
    ('01-mobile-home.png','出發前的首頁','行程倒數、當天預覽與四座城市。'),
    ('02-mobile-now.png','現在與下一步','用12/26 21:39示範下車接車與先入住的安排。'),
    ('03-mobile-itinerary.png','每日行程','切換日期，查看時間軸、導航與離線路線圖。'),
    ('04-mobile-tickets.png','隨身票夾','可搜尋票券，清楚區分已確認與待改訂。'),
    ('05-mobile-sevilla.png','12/27更新與彈性蛋糕店','MITO午餐前吃、Postiguillo已訂、El Paseíllo未訂，99 Cheesecake有空再去。'),
]:
    if not (P/'app-preview'/file).exists():continue
    image=(P/'app-preview'/file).read_bytes()
    cards.append('<article><h2>'+escape(title)+'</h2><p>'+escape(note)+'</p><div class="phone"><img alt="'+escape(title)+'" src="data:image/png;base64,'+base64.b64encode(image).decode()+'"></div></article>')
html='''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>西班牙・口袋旅程｜App畫面預覽</title><style>
body{margin:0;background:#f6f5ef;color:#183b36;font:15px/1.8 system-ui,"Microsoft JhengHei",sans-serif}main{max-width:1200px;margin:auto;padding:40px 24px}header{max-width:800px;margin-bottom:35px}h1{font-size:36px;line-height:1.4;margin:10px 0}h2{font-size:20px;margin:0}p{color:#71817b}.badge{display:inline-block;background:#e5ecdc;border-radius:30px;padding:5px 13px;font-size:12px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:34px}.phone{max-width:390px;margin:20px auto 0;border:7px solid #143e39;border-radius:36px;overflow:hidden;box-shadow:0 15px 40px #183b3618}.phone img{display:block;width:100%;height:auto}article{background:#fffef9;padding:24px;border-radius:24px;border:1px solid #e1e5da}.notice{background:#f0e7d6;padding:15px 20px;border-radius:14px;color:#755c35}footer{padding-top:32px;color:#71817b;font-size:13px}@media(max-width:650px){.grid{grid-template-columns:1fr}h1{font-size:29px}main{padding:25px 18px}}
</style><main><header><span class="badge">2026/10/15 · 第一版介面預覽</span><h1>把西班牙旅程，放進口袋。</h1><p>11天行程、票券與路線圖，集中在一個手機網頁App。同行完整版可匯入離線資料；分享行程版適合給親友看。</p><div class="notice">此頁是實際測試截圖，供檢視介面。App已可運行，尚未部署正式手機網址；需透過HTTPS上線後安裝到主畫面。</div></header><section class="grid">'''+''.join(cards)+'''</section><footer>已以Chromium實測手機尺寸、時間切換、離線重開、PDF與地圖；尚未在實體iPhone Safari驗證。完成標記與同行資料保留在各自裝置，未提供多人即時同步。</footer></main></html>'''
html=html.replace('2026/10/15 · 第一版介面預覽',version+' · 介面預覽').replace('App已可運行，尚未部署正式手機網址；需透過HTTPS上線後安裝到主畫面。','App已可由GitHub串接Vercel；正式手機網址依你的Vercel專案，HTTPS上線後可安裝到主畫面。')
(P/preview_name).write_text(html,encoding='utf-8')
state=json.loads((P/'latest-planning-state.json').read_text())
app_state=state.setdefault('app',{})
app_state.update({'source':'/workspace/HUANG','source_data_version':re.search(r"spain-pocket-([^']+)",(R/'dist/sw.js').read_text()).group(1),'planning_version':version,
              'public_package':public_name,'companion_package':companion_name,'preview':preview_name,
              'update_mode':'依最新版規劃重建；各手機匯入同行包，不是多人即時同步'})
(P/'latest-planning-state.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(P/'review/app-package-validation.json').write_text(json.dumps(outputs,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(outputs,ensure_ascii=False,indent=2))

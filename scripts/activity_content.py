"""Build useful activity descriptions from the existing attraction and dining guides."""
import re
from copy import deepcopy
import unicodedata
from urllib.parse import urlsplit

HOTELS=re.compile(r'Arenal(?: Suites(?: Puerta del Sol)?)?|Enjoy\s*Sevilla|EnjoySevilla|Sercotel(?: Granada Suites)?|Inside Barcelona Apartments Príncep|Príncep',re.I)

def normalize(text):
    return re.sub(r'[^a-z0-9\u3400-\u9fff]','',unicodedata.normalize('NFKD',str(text or '')).encode('utf-8').decode().lower())

def public_text(text):
    text=HOTELS.sub('住宿',str(text or ''))
    text=text.replace('護照','身分證件').replace('passport','身分證件')
    # Public descriptions never inherit ticket links, booking references or lodging addresses.
    text=re.sub(r'https?://\S+','',text)
    text=re.sub(r'\bK\d{2}\b','既有票券',text)
    if any(s in text for s in ['Calle del Arenal','Plaza Aviador','booking-evidence']):return ''
    return text.strip()

def public_activity(activity):
    return {key:([public_text(s) for s in value if public_text(s)] if isinstance(value,list) else public_text(value))
            for key,value in activity.items() if key!='sourceUrl'}

ALIASES={
    '山城冬季夕照':'San Nicolás', '廣場省份瓷磚與拱廊':'塞維亞西班牙廣場', 'Prado名畫精選':'普拉多美術館',
    '主殿哥倫布墓與祭壇':'塞維亞主教座堂', '已購佛朗明哥':'Casa de la Memoria',
    '先看Generalife夏宮與花園':'Generalife', '已購15時Nasrid宮殿':'納斯里德宮殿',
    '教堂內部初訪':'聖家堂', '已購誕生立面塔':'聖家堂', '續看教堂與博物館':'聖家堂',
    '2026主塔外部拍照':'聖家堂', '西班牙美食空間':'El Nacional',
    'Llibertat市場與Gràcia':'Mercat de la Llibertat', '歷年場地預案與葡萄':'Plaça d’Espanya',
}
TITLES={
    '廣場省份瓷磚與拱廊':'塞維亞西班牙廣場｜省份瓷磚、拱廊與拍照',
    '四人進園定位上層報到處':'塞維亞王宮｜四人入園、確認上層報到處',
    '1位10:30上層；3位短逛':'塞維亞王宮｜1 人參觀上層、3 人園內短逛',
    '四人合看宮殿與花園':'塞維亞王宮｜四人會合、參觀宮殿與花園',
    '按已購票先登Giralda':'塞維亞主教座堂｜先登 Giralda 希拉達塔',
    '主殿哥倫布墓與祭壇':'塞維亞主教座堂｜主殿、哥倫布墓與祭壇',
    '已含救主教堂短訪':'救世主教堂 Iglesia del Salvador｜短訪',
    '已購佛朗明哥':'Casa de la Memoria｜佛朗明哥演出',
    '先看Generalife夏宮與花園':'阿爾罕布拉｜Generalife 夏宮與花園',
    '已購15時Nasrid宮殿':'阿爾罕布拉｜15:00 納斯里德宮殿入場',
    'Partal花園與倒影':'阿爾罕布拉｜Partal 花園與宮殿倒影',
    'Alcazaba堡壘眺望':'阿爾罕布拉｜Alcazaba 堡壘與城市全景',
    '山城冬季夕照':'San Nicolás 觀景臺｜阿爾罕布拉夕景',
    '西班牙美食空間':'El Nacional｜西班牙美食空間晚餐',
    '教堂內部初訪':'聖家堂｜教堂內部與彩繪玻璃',
    '已購誕生立面塔':'聖家堂｜誕生立面塔參觀',
    '續看教堂與博物館':'聖家堂｜續看教堂與博物館',
    '2026主塔外部拍照':'聖家堂｜主塔外觀拍照（開放狀態依現場）',
    '元旦加泰隆尼亞飯料理':'7 Portes｜元旦午餐、加泰隆尼亞飯料理',
    '公共區Tabernnus':'BCN T1 公共區 Tabernnus｜抵達後午餐',
    '寄四箱洗手間':'格拉納達住宿｜寄放四件行李、洗手間',
    '班機check-in與司機':'確認翌日航班報到、接車與行李',
    '已購ALSA直達巴士':'ALSA 巴士｜塞維亞 → 格拉納達（08:00–11:00）',
    'Madrid→Sevilla':'高鐵｜馬德里 → 塞維亞（19:00–21:39）',
}

def make_library(values,formulas,href):
    library=[]
    for row,fr in zip(values['餐飲詳解'].iter_rows(min_row=6),formulas['餐飲詳解'].iter_rows(min_row=6)):
        v=[c.value for c in row]
        if len(v)<8 or not v[2]:continue
        library.append({'name':str(v[2]),'type':'food','description':str(v[6] or '').split('；')[0],
                        'mustTry':[str(v[3])] if v[3] else [],'tips':[str(v[6])] if v[6] else [],'address':str(v[7] or ''),'sourceUrl':href(fr[8])})
    for row,fr in zip(values['景點指南'].iter_rows(min_row=6),formulas['景點指南'].iter_rows(min_row=6)):
        v=[c.value for c in row]
        if len(v)<7 or not v[2]:continue
        library.append({'name':str(v[2]),'type':'visit','description':str(v[3] or ''),
                        'highlights':[str(v[4])] if v[4] else [],'tips':[str(v[5])] if v[5] else [],'photoTip':str(v[6] or ''),'sourceUrl':href(fr[10])})
    for place in library:
        if place['type']!='food':continue
        place['contexts']=[]
        for row in values['餐次選擇'].iter_rows(min_row=6,values_only=True):
            if len(row)<15 or normalize(row[4])!=normalize(place['name']):continue
            place['contexts'].append({'date':str(row[1])[:10],'meal':str(row[0]),'mustTry':[str(row[7])] if row[7] else [],'tips':[str(row[i]) for i in [13,14] if row[i]]})
    return library

def find_venue(event,location,library):
    lookup=ALIASES.get(event['title'],location or event['title'])
    text=normalize(lookup+' '+event['title'])
    needle=normalize(lookup)
    specific=len(needle)>=5 or len(re.findall(r'[\u3400-\u9fff]',needle))>=3
    candidates=[]
    for place in library:
        name=normalize(place['name'])
        # Ignore very short generic words; accept shortened names such as Generalife.
        latin=[normalize(x) for x in re.findall(r'[A-Za-zÀ-ž][A-Za-zÀ-ž -]{4,}',place['name'])]
        fragments=[name]+[x for x in latin if len(x)>=6]
        if any(fragment in text or (specific and needle in fragment) for fragment in fragments):
            score=max(len(x) for x in fragments if x in text or (specific and needle in x))
            if place['type']=='food' and event['category'] in ['午餐','晚餐','早餐','甜點','條件甜點']:score+=100
            candidates.append((score,place))
    return max(candidates,key=lambda item:item[0])[1] if candidates else None

def enrich(event,location,library):
    title=event['title'];kind=event['category'];place=find_venue(event,location,library)
    event['displayTitle']=TITLES.get(title,title)
    if kind in ['交通','高鐵','取行李','寄物','退房寄物','退房','領箱','報到','準備','入住','候位','抵達','登機','出境']:
        descriptions={
          '交通':f'從上一站前往{location or title}。先核對接車點、交通方式與行李安排，再開啟導航；表列時間包含規劃緩衝。',
          '高鐵':'搭乘馬德里往塞維亞的高鐵。先確認票面車站、車次、座位及行李規定；抵達後依序取行李、接車與入住。',
          '報到':'到入口或車站後，先確認安檢、驗票及排隊位置。這段是報到緩衝，下一段票面入場或發車時間優先。',
          '候位':'La Sitarilla 不接受預訂；19:30到店排隊，20:00開門為使用者提供，入座時間依當日人潮。',
          '準備':'核對翌日票券、航班報到與接車資訊，整理隨身物品和大件行李，並將所需資料存離線。',
          '入住':'辦理住宿入住、暖身休息並準備翌日早餐；確認入口、門碼及隔天離開方式。',
          '寄物':'先完成行李寄放、取件方式確認及洗手間，再輕裝前往午餐或景點。',
          '退房寄物':'完成退房後寄放大件行李，確認領取時間與方式，再前往景點。',
          '取行李':'回住宿領取寄放行李、清點四人行李，準備下一段接車或車站移動。',
          '退房':'完成退房、清點行李與隨身物品，依約定方式前往接車點。',
          '領箱':'下車後清點四人行李，確認預約車輛與會合位置再出發。',
          '抵達':'入境、領取託運行李、洗手間並確認四人會合，再依原定接車方式進城。',
          '登機':'核對登機門與登機截止時間，依登機證完成登機；航廈和行李規則以票面及航司通知為準。',
          '出境':'完成安檢與出境證件檢查後前往登機門，留意步行距離及登機廣播。',
        }
        activity={'description':descriptions[kind],'tips':[]}
        if kind=='候位':activity['tips']=['無法預訂，現場候位。20:00開門不代表20:00一定能入座。','20:30仍未入座時評估就近備案，返宿後保留翌日航班準備。']
    elif place:
        activity={key:deepcopy(value) for key,value in place.items() if key not in ['name','type','address','contexts']}
        if place['type']=='food':
            context=next((c for c in place.get('contexts',[]) if c['date']==event['date'] and kind in c['meal']),None)
            if context:activity.update(mustTry=context['mustTry'],tips=deepcopy(context['tips']))
            activity['description']=place['description'] or f'在{place["name"]}用餐，依下方推薦與當日菜單分食。'
            activity['tips'].append('推薦餐點依既有美食指南；價格、當日供應與過敏原請點餐前向店家確認。')
            if kind in ['午餐','晚餐','早餐'] and title not in TITLES:event['displayTitle']=f'{place["name"]}｜{kind}'
    else:
        generic={
          '早餐':'用餐並補充熱飲；若店家未開，使用前晚準備的早餐，保留接車與景點報到時間。',
          '午餐':'在本時段完成午餐，先確認供餐與候位，並留意下一段交通或入場時間。',
          '晚餐':'本時段為晚餐安排；依現場供餐與訂位狀態點餐，預留返宿與翌日準備時間。',
          '休息':'保留暖身、休息與整理用品的時間；先處理翌日早餐，依當日體力調整免費散步。',
          '採買':'採買飲用水、翌日早餐及當晚需要的食物；確認食品部營業、保存方式及攜帶需求。',
          '備餐':'整理採買並準備在住宿用餐；未確認的外出餐桌仍以自理備案銜接。',
        }
        activity={'description':generic.get(kind,f'這一站安排{title}。依現場開放與動線參觀，留意下一段固定報到或交通時間。'),'tips':[]}
        if kind in ['早餐','午餐','晚餐']:activity['mustTry']=['目前未確認本店固定必點品項，依當日菜單現場選擇。']
    if 'Alhambra Churrería' in title:
        event['displayTitle']='Alhambra Churrería｜西班牙油條午餐'
        activity.update(description='格拉納達的西班牙油條午餐；寄物後前往，11:45–12:25包含步行、點餐與用餐。',mustTry=['現炸 churros（西班牙油條）','熱巧克力 chocolate caliente，供應及份量先問店家。'],tips=['12:25離店搭車上山，保留14:30宮殿報到與15:00 Nasrid入場。','需確認午間是否供應現炸油條；排隊過久時以快速用餐保護已購宮殿時段。'])
    if title=='已購ALSA直達巴士':activity.update(description='搭乘ALSA直達巴士，08:00從塞維亞出發、11:00抵達格拉納達。上車前核對車輛、座位與四人的行李，抵達後依約定方式接車。',tips=['票券及行李額度請在票夾查看；巴士站與飯店間接送是另外一段安排。'])
    if 'La Sitarilla' in title and kind=='晚餐':
        activity.update(description='格拉納達現場候位的 tapas 晚餐；20:00–21:00是用餐目標，實際入座依排隊進度。',mustTry=['建議先詢問 carne en salsa（醬汁燉肉）；目前未核實當日菜單。','再依當日 tapas 或店家推薦小盤分食，先問份量與供應。'],openingHours='20:00開門（使用者提供；當日營業待核）',tips=['無法預訂；19:30先到排隊，開門不等於保證入座。','20:30仍未入座時評估就近備案。','返宿後保留航班報到、司機與行李準備；隔日07:45接車安排保留。'])
    if 'Bar Postiguillo' in title and kind=='午餐':
        activity['description']='塞維亞 tapas 午餐；點餐時先問份量，四人可分食幾道小盤。'
        activity['mustTry']=['可先詢問燉豬頰（carrillada）或當日推薦 tapas；目前未核實店家菜單與供應。']
        activity['tips'].append('14:00前離席，保留大教堂報到。')
    activity['tips']=list(dict.fromkeys(activity.get('tips',[])))
    event['activity']=activity
    return event

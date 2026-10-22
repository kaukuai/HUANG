"""Review planned meals and outstanding bookings without counting alternatives twice."""
import re
from collections import defaultdict

FOOD_CATEGORIES={'早餐','午餐','晚餐','甜點','條件甜點'}
TAPAS_IDS={'0694b933c12f','6dfd4c9b200c','dd324c2dd85c','430def0ab7d3','d30-vinitus-dinner','02a9956e2777','d30-hasta-lunch'}

def meal_records(trip):
    rows=[]
    for day in trip['days']:
        for event in day['events']:
            options=event.get('mealOptions') or [event]
            for option in options:
                if not option.get('venue') or event['category'] not in FOOD_CATEGORIES:continue
                name=option['venue']['nameEn']
                rows.append({'date':day['date'],'time':option.get('displayTime') or event['start'][11:16]+'–'+event['end'][11:16],
                    'name':name,'title':option.get('title',event['displayTitle']),'category':event['category'],
                    'kind':'擇一候選' if event.get('mealOptions') else '主行程／條件主選' if event.get('conditional') else '主行程',
                    'sourceId':event['id'],'choiceGroup':event['id'] if event.get('mealOptions') else None,
                    'status':option.get('status') or event.get('status') or '依既有行程，未提供新確認信',
                    'activity':option.get('activity',event.get('activity',{})),'mapUrl':option.get('mapUrl',event.get('mapUrl',''))})
        for stop in day.get('optionalStops',[]):
            if stop.get('id')=='d02-re-cuir':continue
            if not stop.get('venue'):continue
            rows.append({'date':day['date'],'time':'無固定時間','name':stop['venue']['nameEn'],'title':stop.get('displayTitle',stop['title']),
                'category':'彈性餐飲／備選','kind':'彈性備選','sourceId':stop.get('id',stop['title']),
                'choiceGroup':stop.get('visitGroup'),'status':stop.get('status') or '依營業／食量決定',
                'activity':{'description':stop.get('description',''),'mustTry':stop.get('mustTry',[]),'tips':[stop.get('note','')]},'mapUrl':stop['mapUrl']})
    return rows

def review(trip, inventory=None):
    def source(fragment):
        item=next((f for f in (inventory or []) if fragment in f["path"] and f["mime"]=="application/pdf"),None)
        return "https://drive.google.com/file/d/"+item["id"]+"/view" if item else ""
    rows=meal_records(trip);by_name=defaultdict(list)
    for row in rows:by_name[re.sub(r'\W','',row['name'].lower())].append(row)
    repeats=[]
    for same in by_name.values():
        if len(same)>1:
            repeats.append({'name':same[0]['name'],'dates':sorted(set(r['date'] for r in same)),
                'explanation':'元旦營業不合適時提前改訪，三天擇一；不是三次已排定消費。' if same[0].get('choiceGroup')=='paradiso-once' else '需依主選／備選條件判斷，不能把候選列數當作實際用餐次數。'})
    tapas=[r for r in rows if r['sourceId'] in TAPAS_IDS and r['kind']!='彈性備選']
    findings=[
      {'topic':'同名餐廳','result':'目前沒有必須重複去兩次的同一家主餐餐廳。7 Portes僅保留1/1晚餐；1/2已改Sagardi。','advice':'Paradiso出現在12/29、12/30、1/1，是擇一備案；Margherita與El Furacu也是同一餐次擇一。'},
      {'topic':'Tapas／小盤／火腿起司','result':f'約{len(tapas)}個主要餐次偏向小盤或拼盤：El Rinconcillo、Postiguillo、La Sitarilla、Hasta Los Andares、Vinitus、Bodega Quimet。菜色仍依當日點餐。','advice':'12/31兩間Vermuteria建議擇一、海鮮少量分食；Sagardi可選巴斯克炭烤魚或肉，讓料理有變化。'},
      {'topic':'米飯料理','result':'12/27 El Paseíllo指定墨魚燉飯、1/1 7 Portes偏米飯；El Glop若也點西班牙飯，會變成三次。','advice':'保留前兩餐，El Glop可改問烤物或其他菜色；不把尚未點餐的推薦當作確定會吃。'},
      {'topic':'12/31餐飲密度','result':'Bodega Quimet午餐後，還有兩間Vermuteria及Puertecillo，傍晚又有百貨晚餐備選，是全程最密集的吃店下午。','advice':'Vermuteria二選一、Puertecillo分食；吃飽就略過百貨晚餐，保留跨年前休息。'},
      {'topic':'披薩／義式候選','result':'1/1 Margherita與El Furacu已訂擇一，Sartoria Panatieri另為未訂披薩候選或加吃。','advice':'若Margherita也點披薩，Sartoria建議替換而非再吃一份完整午餐；想增加變化可選El Furacu後少量分食披薩。'},
      {'topic':'油條與甜點','result':'San Ginés（12/25條件早餐）與Alhambra Churrería（12/28午餐）各一次，沒有同店重複；兩間起司蛋糕店也都是彈性地點。','advice':'跨城市嘗試可保留，但12/28油條午餐可少量分食或補鹹食；起司蛋糕店視食量擇一。'},
    ]
    transport=[
      {'item':'國際機票 MU5006／MU709／MU250／MU5007','date':'12/23–1/4','status':'已開票，沿用既有行程單','action':'出發前確認航班與航廈異動，無須重買。','url':'https://www.ceair.com/'},
      {'item':'Renfe AVE 02190 馬德里→塞維亞','date':'12/26 19:00–21:39','status':'已購；10/22重新讀取四張原票','action':'車廂2、座位6B/6C/7B/7C；票面合計€121.20與先前提供€100.75差€20.45待對帳，勿重買。','url':source('1226馬德里')},
      {'item':'ALSA 塞維亞→格拉納達','date':'12/28 08:00–11:00','status':'已購；10/22重新讀取原票','action':'Sevilla Plaza de Armas→Granada Bus Station；兩端大車接駁另確認。','url':source('1228 格拉納達')},
      {'item':'Vueling VY1121 GRX→BCN T1','date':'12/29 10:55–12:20','status':'已購，先前行程單已核對','action':'四人各25kg托運與座下個人物品；不把完整登機箱視為已含。','url':'https://www.vueling.com/'},
      {'item':'FGC 市區↔Colònia Güell 往返','date':'1/2上午','status':'尚無交通票／套票已購證明','action':'原地下教堂票只核對到一般入場與語音，未證實含FGC；需另買往返或確認改訂套票內容。車次目前為目標。','url':'https://www.fgc.cat/en/'},
      {'item':'巴塞隆納市區地鐵票','date':'12/29–1/3','status':'尚未確認已購票種','action':'原Excel為Hola 5日券規劃，尚無購買證明；先按實際搭乘量比較票種，不用預訂每班地鐵。','url':'https://www.tmb.cat/en/barcelona-fares-metro-bus'},
      {'item':'MAD機場→馬德里住宿大車','date':'12/24約10:00','status':'原Excel未處理，未見新預約憑證','action':'確認4人4大箱可裝載的大車、航班延誤與等候規則；不能只用導航連結當已預訂。','url':'https://www.welcomepickups.com/madrid/airport-transfer/'},
      {'item':'塞維亞車站→住宿接車／入住','date':'12/26 21:39抵達後','status':'未見接車及晚到入住確認','action':'22:30 El Rinconcillo只保留10分鐘，先確認接車與門碼／預辦入住，這段銜接最緊。','url':'https://www.free-now.com/'},
      {'item':'塞維亞住宿→巴士站；格拉納達巴士站→住宿','date':'12/28 06:45／11:15','status':'兩端接駁未見預約憑證','action':'特別先安排清晨去Plaza de Armas的大車；08:00巴士已購，不需再買巴士票。','url':'https://www.free-now.com/'},
      {'item':'格拉納達住宿→GRX機場大車','date':'12/29 07:45','status':'原Excel未處理，未見新預約憑證','action':'確認清晨接車點、4人4大箱與司機；航班10:55。','url':'https://www.free-now.com/'},
      {'item':'BCN T1→巴塞隆納住宿大車','date':'12/29領箱後約13:15','status':'原Excel未處理，未見新預約憑證','action':'取消機場午餐，領箱後直接去飯店放行李；以航班抵達／領箱實際進度約定會合。','url':'https://www.welcomepickups.com/barcelona/airport-transfer/'},
      {'item':'巴塞隆納住宿→BCN T1清晨大車','date':'1/3 06:15','status':'原Excel未處理，未見新預約憑證','action':'建議先確認這段清晨接送；約07:00到航廈，10:20國際班機。','url':'https://www.welcomepickups.com/barcelona/airport-transfer/'},
    ]
    attractions=[
      {'item':'普拉多美術館','date':'12/26 15:45目標','status':'尚未取得票券','action':'需配合17:00離館、領行李及19:00高鐵，避免訂到太晚。','url':'https://entradas.museodelprado.es/'},
      {'item':'奎爾宮','date':'1/2 13:00彈性目標','status':'使用者確認尚未購票','action':'放票後可提前，但要對齊上午教堂與FGC回城；午餐可略過或臨時簡餐。','url':'https://inici.palauguell.cat/en/'},
      {'item':'巴塞隆納畢卡索博物館','date':'1/2 15:30彈性目標','status':'新增景點，尚未購票','action':'先確定奎爾宮再訂此票；官方現行冬季10:00–19:00，實際1/2可售時段以訂票頁為準。','url':'https://museupicassobcn.cat/en/plan-your-visit/buy-tickets-and-opening-hours'},
      {'item':'Colònia Güell地下教堂日期更正','date':'目標2027/1/2 10:00','status':'有舊票但日期錯誤，尚無改訂後新票','action':'10/22重讀雲端PDF仍印02/11/2026 10:00；需修改訂單並取得正確新票，不能視為1/2有效，也不要未核對就重買。','url':source('奎爾紡織村地下教堂 Tickets')},
    ]
    restaurants=[
      {'item':'Murillo Café - Restaurante','date':'12/25午餐目標','status':'尚未訂位','action':'依使用者提供提前一個月，11/25開始查位；精確放位時間待核。','url':'https://murillocafe.com/'},
      {'item':'Restaurante El Paseíllo','date':'12/27 19:30、4位目標','status':'尚未訂位','action':'11/27開始查位；墨魚燉飯供應及是否需預訂也要確認。','url':'https://www.google.com/maps/search/?api=1&query=Restaurante+El+Paseillo+Sevilla'},
      {'item':'Sartoria Panatieri','date':'1/1午餐替代／加吃','status':'尚未訂位、彈性候選','action':'依使用者提前一個月，12/1開始查位；Margherita13:45／El Furacu14:00已訂擇一，不把三間都當已訂。','url':'https://www.google.com/maps/search/?api=1&query=Sartoria+Panatieri+Barcelona'},
    ]
    return {'version':trip['version'],'reviewed':'2026-10-22','meal_records':rows,'same_name_occurrences':repeats,'findings':findings,'tapas_main_meals':tapas,'transport':transport,'attractions':attractions,'restaurants_pending':restaurants,
      'scope':'原Excel＋最新App及使用者確認；10/22重新列出雲端票券資料夾，並讀取Renfe、ALSA、地下教堂PDF。未見預約證明不等於斷言未訂。'}

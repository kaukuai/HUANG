# 西班牙・口袋旅程

給手機使用的旅行 PWA，採最新版行程資料產生。已具備：

- 依西班牙時區顯示現在與下一步；國際航段保留各機場時區。
- 西班牙 11 天，加上台灣出發與返抵共 13 個日期、219 段行程；活動展開後有介紹、參觀重點或餐廳推薦與注意事項。
- 每日時間軸上方有可拖曳、雙指縮放與放大檢視的街道地圖，依序標示景點、餐飲、交通與淡色備選；點標記可看資訊、Google Maps 導航及跳到時間軸。
- 首頁四個城市可點開，依日期與時間顯示中文在前、外文在後的主要景點與餐廳；無固定時間的備選地點另外標示。
- 餐飲使用暖橘色、住宿使用紫色與文字標籤；同行完整版會從裝置內資料帶入各城市飯店名稱，公開分享版保留通用住宿標題。
- 同行資料包匯入後，32 份附件與 11 張每日路線圖保存在裝置 IndexedDB。
- 分享行程版只提供行程與景點導航；網站輸出不含票券附件、Drive 票券網址或住宿地址。
- 可安裝到手機主畫面；網站頁面由 Service Worker 提供離線支援。
- 日期錯誤、未購票、已購但原票未補及條件行程會分別顯示。
- 12/27 新餐飲與彈性甜點已同步；可下載 Murillo 11/25 與 El Paseíllo 11/27 訂位提醒，匯入行事曆後生效。
- 12/28 油條午餐、La Sitarilla 19:30 排隊與 20:00 用餐目標；Sexitana、99 Cheesecake 以淡字列在當日時間軸下方，不分配開始／結束時間。
- 10/16 v2 已重新讀取雲端高鐵、巴士與巴特略加購 PDF。Renfe AVE 02190 原票可離線開啟；票面總€121.20與先前提供€100.75分列待核，未擅改預算。含身分／付款核對資料的試算表只留Drive參考入口。
- 10/19 更新：12/23 18:40 桃園出發、1/4 14:00 返抵台灣及全部國際轉機航段；12/29 直赴住宿、20:00 El Glop 已訂與飯後家樂福；12/30 Puiggròs 早餐後直赴聖保祿、Hasta Los Andares／Sagradas Tapas 午餐、彈性 Five Guys 與 Vinitus 鵝肝牛排晚餐。10:00 聖保祿、14:30 聖家堂及 15:15 登塔時間維持原票。
- 10/21 更新：12/31 午餐後依序順路加吃三店、傍晚返宿與可略過的百貨晚餐；1/1 新早餐、米拉前 Mauri、Margherita 13:45／El Furacu 14:00 已訂午餐擇一、18:30 七扇門晚餐與 Paradiso 酒吧備案；1/2 教堂前 Galisteo 早餐備選及博蓋利亞海鮮攤。彈性地點可放在相應活動前後，沒有固定到店時刻，首頁城市總覽也依動線列出。
- 「旅程」提供 Sartoria Panatieri 12/1 查詢元旦訂位的全天行事曆下載；匯入手機行事曆後自行設定通知，不會在背景代訂或推播。午餐候選是同一時段的替代選擇，兩筆訂位都保留，未使用的一筆需依店家條款自行處理。
- 10/22 更新：1/2 奎爾宮改13:00彈性未購目標，午餐可略過或臨時簡餐；途中可逛Re-Cuir、15:30畢卡索博物館未購目標、19:00 Sagardi Argenteria已訂位。新增待購票入口，舊同行包的奎爾宮時段與待辦會同步更新。

已提供可直接由 GitHub 匯入 Vercel 的設定。公開行程連網後會自動更新，已匯入舊同行包的手機也會顯示最新安排；票券、私人提醒與離線路線圖需另匯入新版同行包。尚未在實體 iPhone Safari 測試。沒有伺服器帳號、多人即時同步、背景推播或 Google Drive 自動同步。

## GitHub → Vercel

1. 在 [Vercel 新增專案](https://vercel.com/new)，連接自己的 GitHub 帳號。
2. 選擇 **kaukuai/HUANG**，Production Branch 使用 **main**，Root Directory 保持倉庫根目錄。
3. 按 **Deploy**。倉庫的 `vercel.json` 已指定以下設定，不需要環境變數：

| 設定 | 值 |
| --- | --- |
| Framework Preset | Other |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci --ignore-scripts --no-audit --no-fund` |

第一次部署後，Vercel 會提供 HTTPS 網址；之後 main 分支每次推送都會重新部署。四位同行者各自開啟網址、匯入同行資料包，再加入手機主畫面。給親友時分享同一個網址即可。

公開行程資料已存於 `app/data/share.json`，因此 Vercel 建置只需 Node，無須 Python、Excel、雲端環境路徑或私人票券。

## 本機開發與驗證

前端使用原生 HTML / CSS / JavaScript，沒有 npm 套件相依；地圖使用隨站提供的 Leaflet 1.9.4（BSD-2-Clause），不依賴外部 JS CDN。Node 22 或以上可直接建置。

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm start
```

`npm run build` 從 `app/` 與公開行程 JSON 產生 `dist/`，並檢查私人票券資料未被包含。`npm start` 是 Python 本機測試伺服器，Vercel 不會執行這個指令。

需要從 Excel 重新整理行程時，在包含規劃檔案的工作區使用：

```bash
python -m pip install -r requirements-build.txt
npm run data:update
```

這會讀取 `/workspace/spain-planning/latest-planning-state.json` 指向的 XLSM 與 JSON，更新 `app/data/share.json` 與 `dist/`。同行資料包另存 `/workspace/spain-planning/app-private/`，不在 Git 倉庫或網站中。

可指定其他來源與輸出路徑：

```bash
python scripts/build_app.py --planning /path/to/spain-planning --output /path/to/public-site
```

啟動伺服器後執行測試：

```bash
npm test
python -m pip install -r requirements-test.txt
npm run test:browser
npm run test:updates
npm run test:cities
npm run test:maps
# 有本機私人匯入包與 app-build-report.json 時：
python tests/travel_pack_browser_test.py
```

目前瀏覽器測試使用 `/usr/bin/chromium` 與本機 4173 連接埠。測試涵蓋西班牙／台灣跨日、列車精確切換時間、國際機場時區、資料包匯入、手機排版、飛航模式重開、離線 PDF 與路線圖，以及分享版資料分離。`test:updates` 自行啟動暫存伺服器，驗證舊版快取與同行包升級、連網刷新及離線保留。

## 每日互動地圖

`app/map-places.js` 保存逐一核對的公開景點／餐廳座標與來源，`map-data.js` 依當日最新行程、無固定時間地點及用餐替代選項產生標記。重複參觀同一景點只標一點；未知地址或分店不明的地點保留清單與 Google Maps 查詢入口，不推測座標。新增店家時同步加入對應 `cityId|nameEn` 的核實位置。公開地圖不包含住宿名稱／地址，也不從私下提醒推算住宿位置。機場、車站與大型園區為區域位置，入口及航廈仍依票券與時間軸。

底圖使用 OpenStreetMap 標準圖磚，保留 OSM／Leaflet 歸屬資訊。僅請求使用者正在查看的範圍，遵循瀏覽器 HTTP 快取；不批次下載、不由 Service Worker 儲存離線底圖。圖磚請求使用 `strict-origin-when-cross-origin` Referrer Policy，依[供應商規範](https://operations.osmfoundation.org/policies/tiles/)提供網站來源。離線時仍可查看已快取的標記、地點清單與行程，底圖連線後恢復。地圖元件在行程刷新時沿用，以保留縮放與選取位置。

目前沒有設定 Google Maps API 金鑰，因此 App 內使用 OSM 多點總覽，各站另提供 Google Maps 店家／導航連結。若往後切換 Google 官方地圖，需先設定 Google Maps Platform 專案及受網域限制的金鑰，不能把未授權的 Google 圖磚當成底圖。

`npm run test:maps` 使用模擬圖磚測試 13 日標記、縮放／拖曳／雙指操作、放大視窗、位置待核、裝置資料分離與離線重開；不反覆請求第三方圖磚。

## 後續行程更新

1. 先更新規劃資料與 `latest-planning-state.json`。
2. 執行 `npm run data:update`，產生新的公開行程資料與同行資料包。
   活動說明取自 Excel 的「景點指南」「餐飲詳解」「餐次選擇」；未核實的推薦與營業資訊須保留來源與待確認文字。無固定時間地點存在規劃 JSON 的 `day_optional_stops`，不得加入 `days.events` 或填入假時段。
   `scripts/itinerary_revision.py` 會依序套用 `scripts/data/itinerary-*.json` 的已確認 App 修訂，避免從較早的 Excel 重建時把新餐飲、彈性地點與國際航段覆蓋掉。公開網站建置只讀 `app/data/share.json`。修訂檔不含私人附件、住宿名稱或地址。
3. 推送程式碼與 `app/data/share.json` 到 GitHub，Vercel 自動部署。App 在開啟、恢復連線、回到前景及每分鐘會檢查公開行程；也可按「旅程 → 檢查並更新行程」。
4. 同行者各自在「旅程 → 匯入新版資料」選擇新包以更新私人附件與提醒。已調整日期的舊離線路線圖會暫停顯示，避免使用舊路線；當日景點導航仍可開啟。
5. 檢查行程與同行附件的版本，再以飛航模式開啟一份票券。

行程完成標記只保留在各自裝置，不會修改供應商訂位或其他同行者的狀態。新版程式會在完成離線快取後載入；匯入資料或開啟附件期間可稍後按「開啟新版畫面」。

## 重建私人票券匯入包

`scripts/build_travel_pack.py` 使用最新私下核對的Excel、原件下載清單與目前公開行程，產生同行包。下載清單含來源 `id`、`path`、`name`、`localPath`、`sha256`、`downloaded`，僅能保存在規劃資料目錄；腳本不含個別Drive檔案ID，不會上傳附件或改寫公開行程。

```bash
python scripts/build_travel_pack.py \
  --workbook /workspace/spain-planning/Spain_2026_Travel_Timeline_1022.xlsm \
  --sources /workspace/spain-planning/review/pack-source-files-1022.json \
  --output /workspace/spain-planning/app-private \
  --international /path/to/international-itinerary.pdf
```

每日動線圖讀取輸出目錄上層的 `assets/YYYY-MM-DD-route.png`，需先完成文件匯出。VY1121原件若可取得，以 `--vueling /path/to/original.pdf` 加入；缺件會明確標示，不能製作假原票。恢復包可透過 `retainExistingTicketIds` 指定保留裝置內該票券已有的附件，僅保留實際存在的Blob，不保留不在清單內的舊票。新包不會覆蓋已有的VY1121與國際航班附件；尚無舊資料的裝置仍需補缺件。新下載的地下教堂舊日期原票仍標為待改訂。無可靠新版預算時顯示待核對；舊裝置已存的預算可沿用並註明尚未重新對帳。

匯入包、原件、清單與輸出報告一律置於Git倉庫外，不得放到Vercel。四位同行者各自下載JSON，先更新App，再到「旅程 → 匯入新版資料」選取。

## 同步 Excel 與旅行手冊

`scripts/export_travel_documents.py` 以目前公開行程、原Excel及私下保存的Drive檔案目錄產生新版XLSM、中文PDF、HTML手冊、票券連結索引與餐飲／待訂檢視。原Excel保留不覆寫；原預算頁明確標為歷史參考，沒有擅自重估新餐費或新增門票。每個彈性地點的開始、結束欄位留白。PDF使用系統Noto CJK字型，動線圖是非等比例示意，附各站導航。

```bash
python -m pip install -r requirements-documents.txt
python scripts/export_travel_documents.py \
  --source /path/to/original.xlsm \
  --inventory /path/to/private/drive-inventory.json \
  --output /workspace/spain-planning
```

匯出需要系統 `/usr/bin/chromium` 與Noto CJK字型。目錄JSON包含 `id`、`path`、`mime` 欄位，只在私人檔案中用來建立原票連結；可用 `--source-url`、`--drive-folder-url` 加入使用者提供的私下入口。原票網址、住宿地址、私人文件與目錄JSON不可提交Git。輸出路徑必須在倉庫外，網站只發佈 `app/` 的公開資料。餐飲與未訂票判斷來自 `scripts/travel_audit.py` 的本次已核對資料；往後若票況改變，需先更新核對結果，不能只改文件日期。

若網站仍顯示舊內容，先查看「旅程 → 行程更新」的版本及網站部署編號。網站的 `/version.json` 也提供 `sourceCommit`、`itineraryVersion` 與建置時間，可對照 GitHub 最新提交及 Vercel Deployments。端點不存在代表部署尚未包含此功能；到 Vercel 確認專案連接 `kaukuai/HUANG`、Production Branch 為 `main`，最新提交已部署成功，必要時重新部署。

## 上線方式

公開網站是純靜態檔，可部署至提供 HTTPS 的靜態網站服務。支援網站子目錄，所有 App 路徑均為相對路徑。需提供正確 MIME 類型；`sw.js` 與 `data/share.json` 建議使用 `Cache-Control: no-cache`。

同行資料包交給四位同行者另行下載並匯入；親友只需網站網址即可看分享行程版。匯入操作只在手機內執行，未上傳票券。切換分享檢視不是密碼保護，手機內的同行資料仍由該裝置持有人存取。

網站首次開啟要連網。已匯入的行程、PDF、圖片與每日路線圖可離線使用；Google Maps 即時導航、Drive 與其他外部網站需要網路。瀏覽器可能清除儲存空間，請保留原資料包並在出發前測試。iPhone 用 Safari 分享選單加入主畫面；Android 用 Chrome 安裝。

旅客證件檔案未包含在資料包。原始票券及所有 XLSM/PDF 前版都保留在規劃資料目錄。

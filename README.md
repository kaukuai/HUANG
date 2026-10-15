# 西班牙・口袋旅程

給手機使用的旅行 PWA，採最新版行程資料產生。已具備：

- 依西班牙時區顯示現在與下一步；國際航段保留各機場時區。
- 11 天、211 段行程，景點導航、票券與報到資訊。
- 同行資料包匯入後，32 份附件與 11 張每日路線圖保存在裝置 IndexedDB。
- 分享行程版只提供行程與景點導航；網站輸出不含票券附件、Drive 票券網址或住宿地址。
- 可安裝到手機主畫面；網站頁面由 Service Worker 提供離線支援。
- 日期錯誤、未購票、已購但原票未補及條件行程會分別顯示。

已提供可直接由 GitHub 匯入 Vercel 的設定。尚未在實體 iPhone Safari 測試。沒有伺服器帳號、多人即時同步、背景推播或 Google Drive 自動同步；匯入新版資料包才會更新各手機的同行內容。

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

前端使用原生 HTML / CSS / JavaScript，沒有 npm 套件相依。Node 22 或以上可直接建置。

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
```

目前瀏覽器測試使用 `/usr/bin/chromium` 與本機 4173 連接埠。測試涵蓋西班牙／台灣跨日、列車精確切換時間、國際機場時區、資料包匯入、手機排版、飛航模式重開、離線 PDF 與路線圖，以及分享版資料分離。

## 後續行程更新

1. 先更新規劃資料與 `latest-planning-state.json`。
2. 執行 `npm run data:update`，產生新的公開行程資料與同行資料包。
3. 推送程式碼與 `app/data/share.json` 到 GitHub，Vercel 自動部署；同行者各自在「旅程 → 匯入新版資料」選擇新包。
4. 檢查畫面版本日期與待處理事項，再以飛航模式開啟一份票券。

行程完成標記只保留在各自裝置，不會修改供應商訂位或其他同行者的狀態。正式網站的更新會刷新 App 頁面，私人行程更新仍需匯入。

## 上線方式

公開網站是純靜態檔，可部署至提供 HTTPS 的靜態網站服務。支援網站子目錄，所有 App 路徑均為相對路徑。需提供正確 MIME 類型；`sw.js` 與 `data/share.json` 建議使用 `Cache-Control: no-cache`。

同行資料包交給四位同行者另行下載並匯入；親友只需網站網址即可看分享行程版。匯入操作只在手機內執行，未上傳票券。切換分享檢視不是密碼保護，手機內的同行資料仍由該裝置持有人存取。

網站首次開啟要連網。已匯入的行程、PDF、圖片與每日路線圖可離線使用；Google Maps 即時導航、Drive 與其他外部網站需要網路。瀏覽器可能清除儲存空間，請保留原資料包並在出發前測試。iPhone 用 Safari 分享選單加入主畫面；Android 用 Chrome 安裝。

旅客證件檔案未包含在資料包。原始票券及所有 XLSM/PDF 前版都保留在規劃資料目錄。

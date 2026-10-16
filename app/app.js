import { dateInZone, clock, currentAndNext, shortDate, minutesUntil, tripPhase } from './time.js';
import { read, saveSetting, importPack, clearPrivate, isOlderVersion } from './storage.js';
import { currentTrip, validPublicTrip } from './updates.js';

const APP_BUILD = '__BUILD_ID__';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const paths = {
  now:'M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  plan:'M8 3v4m8-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1m3 9h3m3 0h2m-8 3h3',
  ticket:'M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V7m12 1v2m0 3v2m0 2v1',
  trip:'M4 9h16v11H4V9m4 0V5h8v4m-8 4v4m8-4v4',
  map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5m6-2v16m6-14v16',
  arrow:'M5 12h14m-6-6 6 6-6 6',
  download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  check:'m5 12 4 4L19 6',
  chevron:'m9 5 7 7-7 7',
  pin:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0m-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  wifi:'M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0m-4 4h.01',
  user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3',
  search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6',
};
const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.pin}"/></svg>`;
const safeUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
const extLink = (url, label, cls = 'button secondary') => safeUrl(url) ? `<a class="${cls}" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${label}</a>` : '';
const money = n => Number(n).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const activityTitle = e => e.displayTitle || e.title;
const state = { tab:'now', date:null, search:'', filter:'all', mode:'share', privateTrip:null, share:null, preview:null, done:new Set(), offlineReady:false, installing:null, busy:false, syncing:false, syncMessage:'尚未檢查', checkedAt:null, siteVersion:null, swReg:null, shellUpdate:false };
let viewerUrl, toastTimer, lastRefresh;
let viewCache;
const data = () => {
  if (state.mode !== 'private' || !state.privateTrip) return state.share;
  if (!viewCache || viewCache.publicTrip !== state.share || viewCache.privateTrip !== state.privateTrip) viewCache = {publicTrip:state.share,privateTrip:state.privateTrip,value:currentTrip(state.share,state.privateTrip)};
  return viewCache.value;
};
const now = () => state.preview ? new Date(state.preview) : new Date();
const privateMode = () => state.mode === 'private' && !!state.privateTrip;
const events = () => {
  const d = data();
  const flights = d.flights || [];
  return [...d.days.flatMap(day => day.events).filter(e => !flights.some(f => f.start === e.start && e.title.includes(f.number))), ...flights];
};
const selectedDay = () => data().days.find(d => d.date === state.date) || data().days[0];
const badge = (e) => e.status ? `<span class="badge ${['neutral','warning','confirmed','conditional'].includes(e.statusKind) ? e.statusKind : 'neutral'}">${esc(e.status)}</span>` : '';

function toast(text) {
  $('#toast').textContent = text; $('#toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4200);
}
function timeLabel(e) { return e.displayTime || `${clock(new Date(e.start))}–${clock(new Date(e.end))}`; }
function ticketAction(e) {
  return privateMode() && e.ticketIds?.length ? `<button class="button secondary" data-action="event-tickets" data-ids="${esc(e.ticketIds.join(','))}">${icon('ticket')}票券</button>` : '';
}
function eventActions(e) {
  return `<div class="actions">${extLink(e.mapUrl, `${icon('map')}開啟導航`)}${ticketAction(e)}</div>`;
}
function activityDetails(e) {
  const info=e.activity||{};
  const list=(items,label)=>items?.length?`<div class="activity-block"><h4>${label}</h4><ul>${items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div>`:'';
  return `<div class="activity-details">${info.description?`<div class="activity-block"><h4>活動資訊</h4><p>${esc(info.description)}</p></div>`:''}${list(info.highlights,'參觀重點')}${list(info.mustTry,'必點／推薦')}${info.openingHours?`<div class="activity-block"><h4>營業資訊</h4><p>${esc(info.openingHours)}</p></div>`:''}${list(info.tips,'注意事項')}${info.photoTip?`<div class="activity-block"><h4>拍照提示</h4><p>${esc(info.photoTip)}</p></div>`:''}</div>`;
}
function optionalStops(day) {
  if(!day.optionalStops?.length)return '';
  return `<aside class="optional-stops" aria-label="無固定時間的備選地點"><h3>附近備選・有空再去</h3><p class="caption">沒有安排固定時間，順路、有空再選。</p>${day.optionalStops.map(stop=>`<article class="optional-stop"><span class="optional-label">彈性地點</span><h3>${esc(stop.title)}</h3><p>${esc(stop.description||stop.note)}</p>${stop.openingHours?`<p class="optional-hours">營業：${esc(stop.openingHours)}</p>`:''}<details><summary>店家資訊與注意事項</summary>${activityDetails({activity:{mustTry:stop.mustTry||[],tips:stop.note?[stop.note]:[]}})}${extLink(stop.mapUrl,`${icon('map')}查看店家位置`,'button secondary')}</details></article>`).join('')}</aside>`;
}
function header() {
  return `<header class="header"><a class="wordmark" href="#now" aria-label="西班牙口袋旅程首頁"><span class="brand-mark">ES<span>26</span></span><span>西班牙<span class="brand-sub">口袋旅程</span></span></a><button class="mode-pill" data-action="tab" data-tab="trip">${icon('user')}${privateMode() ? '同行完整版' : '分享行程版'}</button></header>
  ${state.preview ? `<div class="preview-banner">時間預覽 · ${shortDate(dateInZone(now()))} ${clock(now())} 西班牙 <button data-action="live">回到實際時間</button></div>` : ''}`;
}
function navigation() {
  return `<nav class="bottom-nav" aria-label="主要導覽">${[['now','現在','now'],['plan','行程','plan'],['tickets','票夾','ticket'],['trip','旅程','trip']].map(([key,label,i]) => `<button data-action="tab" data-tab="${key}" class="nav-item ${state.tab === key ? 'active' : ''}" ${state.tab === key ? 'aria-current="page"' : ''}>${icon(i)}<span>${label}</span></button>`).join('')}</nav>`;
}
function dayPicker() {
  return `<div class="day-picker" aria-label="選擇日期">${data().days.map((d,i) => `<button data-action="day" data-date="${d.date}" class="day-chip ${state.date === d.date ? 'selected' : ''}" aria-pressed="${state.date === d.date}"><small>D${i+1}</small><strong>${shortDate(d.date)}</strong><span>${esc(d.city.split('→')[0])}</span></button>`).join('')}</div>`;
}
function eventCard(e, label, prominent = false) {
  if (!e) return '';
  const limit=prominent?56:48;
  const brief=e.note?.length>limit?e.note.slice(0,limit)+'…':e.note;
  return `<article class="${prominent ? 'focus-card' : 'next-card'}"><div class="eyebrow">${esc(label)}<span>${esc(timeLabel(e))}</span></div><h2>${esc(activityTitle(e))}</h2>${badge(e)}${brief ? `<p class="event-note">${esc(brief)}</p>` : ''}<details class="full-note"><summary>活動資訊與完整提醒</summary>${activityDetails(e)}${e.note?`<p>${esc(e.note)}</p>`:''}</details>${eventActions(e)}${prominent && e.id ? `<button class="text-button done-button" data-action="done" data-id="${esc(e.id)}">${icon('check')}${state.done.has(e.id) ? '已標記完成 · 再按取消' : '標記這一站已完成'}</button>` : ''}</article>`;
}
function beforeTripHome() {
  const first = data().days[0];
  const departure = privateMode() && data().flights.length ? new Date(data().flights[0].start) : new Date(first.events[0].start);
  const departureZone=privateMode()?'Asia/Taipei':'Europe/Madrid';
  const daysLeft = Math.max(0, Math.round((Date.parse(dateInZone(departure,departureZone))-Date.parse(dateInZone(now(),departureZone))) / 86400000));
  return `<section class="hero"><div class="eyebrow">¡HOLA, ESPAÑA! <span>冬日慢遊</span></div><h1>下一站，<br>西班牙<span class="sun-dot"></span></h1><p>從馬德里的聖誕燈飾，走到巴塞隆納的新年。</p><div class="hero-bottom"><div><strong>${daysLeft}</strong><span>天後${privateMode() ? '出發' : '抵達'}</span></div><span class="trip-stamp">12.24 — 01.03<br><small>11 天・4 座城市</small></span></div><div class="arch-art" aria-hidden="true"><i></i><i></i><i></i></div></section>
  <div class="section-heading"><h2>先看看抵達日</h2><span>12/24 · 馬德里</span></div>
  <button class="arrival-card" data-action="day" data-date="${first.date}"><div class="arrival-icon">${icon('pin')}</div><div><strong>市場午餐、聖誕市集</strong><p>寄物後到聖米格爾市場，下午輕鬆逛。</p></div>${icon('chevron')}</button>
  ${privateMode() ? pendingSection() : `<section class="import-prompt"><h3>我們四個人的旅行工具</h3><p>同行者匯入旅行資料包，就能查看票券、住宿與離線地圖。</p><button class="button primary" data-action="import">${icon('download')}匯入同行資料包</button></section>`}
  <div class="section-heading"><h2>四座城市，一路向東</h2></div><div class="cities">${[['MADRID','馬德里','2 晚'],['SEVILLA','塞維亞','2 晚'],['GRANADA','格拉納達','1 晚'],['BARCELONA','巴塞隆納','5 晚']].map(([en,zh,n],i)=>`<div class="city-tile"><span>0${i+1} / ${n}</span><strong>${zh}</strong><small>${en}</small></div>`).join('')}</div>`;
}
function pendingSection() {
  const limit=state.tab==='trip'?data().todos.length:4;
  return `<div class="section-heading"><h2>出發前，還有這幾件</h2><span>待處理</span></div><div class="todo-list">${data().todos.slice(0,limit).map(t => `<article><span class="todo-dot"></span><div><strong>${esc(t.title)}</strong><p>${esc(t.note)}</p>${extLink(t.url, '開啟相關連結 ↗', 'inline-link')}${t.assetId?`<button class="file-button" data-action="asset" data-id="${esc(t.assetId)}">下載訂位提醒</button><p class="caption">${esc(t.reminderNote)}</p>`:''}</div></article>`).join('')}</div>`;
}
function home() {
  const t = now(); const {current,next} = currentAndNext(events(),t);
  const phase = tripPhase(data().days,t);
  const onFlight = current?.isFlight;
  const departed = privateMode() && data().flights.length && Number(t) >= Date.parse(data().flights[0].start);
  if (phase === 'before' && !onFlight && !departed) return beforeTripHome();
  if (phase === 'after' && !onFlight && !next) return `<section class="hero compact"><div class="eyebrow">HASTA LA PRÓXIMA</div><h1>旅程收進口袋，<br>回憶留在身邊。</h1><p>隨時回看走過的行程與每一站。</p></section><button class="button primary" data-action="tab" data-tab="plan">回顧旅程 ${icon('arrow')}</button>`;
  const day = data().days.find(d => d.date === dateInZone(t));
  return `<div class="page-heading"><div><p class="eyebrow">${day ? `D${data().days.indexOf(day)+1} · ${esc(day.city)}` : '移動日 · 航空行程'}</p><h1>把此刻，交給旅程。</h1></div><span class="date-label">${shortDate(dateInZone(t))}</span></div>
  <div class="clock-strip"><span>西班牙 <b>${clock(t)}</b></span><span>台灣 <b>${clock(t,'Asia/Taipei')}</b></span><span class="online-dot ${navigator.onLine?'':'offline'}">${navigator.onLine?'已連線':'離線中'}</span></div>
  ${current ? eventCard(current,current.conditional ? '此刻的彈性安排' : '現在的行程',true) : `<section class="breather"><span>${icon('now')}</span><h2>${next ? '慢一點也沒關係' : '今天可以好好休息了'}</h2><p>${next ? `下一段在 ${shortDate(dateInZone(new Date(next.start)))} ${clock(new Date(next.start))} 開始。` : '當天排定的活動已結束。'}</p></section>`}
  ${next ? eventCard(next,`接下來${minutesUntil(next.start,t)<120 ? ' · '+minutesUntil(next.start,t)+' 分鐘後':''}`) : ''}
  ${dateInZone(t)==='2026-12-26' && privateMode() ? '<aside class="notice">21:39 到站後先入住，再赴 22:30 晚餐。只有 51 分鐘，需預辦入住與接車；22:40 僅為保留截止。</aside>' : ''}
  <button class="button wide secondary" data-action="today">查看當天全部行程 ${icon('arrow')}</button>`;
}
function itinerary() {
  const day=selectedDay();const t=now();
  return `<div class="page-heading"><div><p class="eyebrow">ONE DAY AT A TIME</p><h1>每天，都有好風景。</h1></div></div>${dayPicker()}
  <div class="day-heading"><div><p>D${data().days.indexOf(day)+1} · ${esc(day.city)}</p><h2>${esc(day.title)}</h2></div>${privateMode() && day.mapAsset ? `<button class="icon-button" data-action="asset" data-id="${day.mapAsset}" aria-label="開啟當日離線路線圖">${icon('map')}</button>`:''}</div>
  <p class="caption">所有時段為西班牙當地時間 · 導航需連線</p>
  ${day.offlineMapNeedsUpdate?'<p class="caption map-update-note">本日路線已調整，請匯入新版同行包以更新離線路線圖；景點導航已使用最新行程。</p>':''}
  <div class="timeline">${day.events.map(e => {
    const active=Date.parse(e.start)<=Number(t)&&Number(t)<Date.parse(e.end); const done=state.done.has(e.id);
    return `<article class="timeline-event ${active?'current':''} ${done?'completed':''}" id="event-${esc(e.id)}"><div class="time-rail"><strong>${clock(new Date(e.start))}</strong><small>${clock(new Date(e.end))}</small><span class="timeline-dot"></span></div><div class="event-content"><div class="event-meta"><span>${esc(e.category)}</span>${active?'<span class="live-label">此刻</span>':''}${done?'<span>已標記完成</span>':''}</div><h3>${esc(activityTitle(e))}</h3>${badge(e)}<details><summary>活動資訊、提醒與連結</summary>${activityDetails(e)}${e.note?`<div class="activity-block private-note"><h4>同行提醒</h4><p>${esc(e.note)}</p></div>`:''}${e.transport?`<p class="caption">${esc(e.transport)}</p>`:''}${eventActions(e)}${extLink(e.infoUrl,'官方資訊 ↗','inline-link')}<button class="text-button" data-action="done" data-id="${esc(e.id)}">${done?'取消完成標記':'標記完成'}</button></details></div></article>`;
  }).join('')}${optionalStops(day)}</div>`;
}
function tickets() {
  if (!privateMode()) return `<div class="page-heading"><div><p class="eyebrow">YOUR TRAVEL WALLET</p><h1>票券，都放在這裡。</h1></div></div><section class="empty-state"><span class="empty-icon">${icon('ticket')}</span><h2>同行者專屬的票夾</h2><p>匯入同行資料包，票券附件就會儲存在這台手機，離線也能開啟。</p><button class="button primary" data-action="import">匯入同行資料包 ${icon('download')}</button><small>分享網址只會顯示行程版。</small></section>`;
  const query=state.search.toLowerCase();
  const ticketReview=data().ticketReview;
  const filtered=data().tickets.filter(t => (state.filter==='all'||(state.filter==='pending'?t.statusKind==='warning':t.statusKind==='confirmed')) && `${t.title} ${t.date} ${t.status} ${t.id}`.toLowerCase().includes(query));
  return `<div class="page-heading"><div><p class="eyebrow">READY AT THE GATE</p><h1>出示票券，就出發。</h1></div><span class="count-bubble">${data().tickets.length}</span></div>
  ${ticketReview?.status==='pending'?`<aside class="notice ticket-review"><p>雲端票券有更新通知，尚待重新核對。離線附件目前沿用 ${esc(ticketReview.last_verified)} 核對版本。</p>${extLink(ticketReview.folderUrl,'開啟雲端票券資料夾 ↗','inline-link')}</aside>`:''}
  <label class="search-field">${icon('search')}<input id="ticket-search" type="search" placeholder="搜尋景點、日期或車票" value="${esc(state.search)}" aria-label="搜尋票券"></label>
  <div class="filters">${[['all','全部'],['confirmed','已確認'],['pending','待處理']].map(([key,title])=>`<button data-action="filter" data-filter="${key}" class="${state.filter===key?'selected':''}" aria-pressed="${state.filter===key}">${title}</button>`).join('')}</div>
  <p class="caption">「開啟附件」可離線使用；Drive 與官方網站需連線。</p><div class="ticket-grid">${filtered.map(t=>`<article class="ticket-card"><div class="ticket-top"><span>${esc(t.date ? shortDate(t.date):'航程')}</span>${badge(t)}</div><h2>${esc(t.title)}</h2><p class="ticket-time">${esc(t.time)}</p>${t.report?`<p class="caption">報到／到站：${esc(t.report)}</p>`:''}${t.id==='K17'?'<div class="price-note">四人合計 <strong>€100.75</strong><small>使用者確認已購 · 原票待補</small></div>':''}<div class="ticket-cut"></div><details ${t.statusKind==='warning'?'open':''}><summary>注意事項與附件${t.files.length?' · '+t.files.length+' 份':''}</summary><p>${esc(t.note)}</p>${t.files.length?`<ul class="file-list">${t.files.map(f=>`<li><span>${esc(f.label)}</span><div>${f.assetId?`<button class="file-button" data-action="asset" data-id="${f.assetId}">開啟附件</button>`:''}${extLink(f.url,'Drive ↗','inline-link')}</div></li>`).join('')}</ul>`:'<p class="caption">目前沒有可出示的原始附件。</p>'}${extLink(t.url,t.statusKind==='warning'?'查看訂位／購票入口 ↗':'開啟來源 ↗','inline-link')}</details></article>`).join('')||'<div class="empty-state"><p>沒有符合的票券，試試其他關鍵字。</p></div>'}</div>`;
}
function updatesPanel() {
  const versions = `<p class="caption">行程版本：${esc(data().version)}${state.privateTrip?`<br>同行附件版本：${esc(state.privateTrip.version)}`:''}${state.siteVersion?.sourceCommit?`<br>網站部署：${esc(state.siteVersion.sourceCommit.slice(0,7))}`:''}</p>`;
  return `<section class="settings-card update-settings"><h2>行程更新</h2><p id="sync-status" role="status">${esc(state.syncMessage)}</p><button class="button primary" data-action="sync" ${state.syncing?'disabled':''}>${state.syncing?'正在檢查…':'檢查並更新行程'}</button>${state.shellUpdate?'<button class="button secondary" data-action="apply-shell">開啟新版畫面</button>':''}${versions}${data().hasNewerItinerary?'<p class="notice">行程已套用網站最新版。票券與私人提醒仍保留原同行包；匯入新版可更新附件及離線路線圖。</p>':''}<p class="caption">連網後會自動檢查公開行程，票券附件繼續保存在這台手機。</p></section>`;
}
function journey() {
  const d=data(); const updated=d.version.replace(/^(\d{4})-(\d{2})-(\d{2})/,'$1/$2/$3');
  return `<div class="page-heading"><div><p class="eyebrow">ALL THE LITTLE DETAILS</p><h1>旅程的安心小事。</h1></div></div>
  ${updatesPanel()}
  <section class="settings-card"><div class="section-heading"><h2>${privateMode()?'同行完整版':'分享行程版'}</h2><span class="badge confirmed">${esc(updated)}</span></div><p>${privateMode()?'你的行程、票券與路線圖已儲存在這台裝置。':'這個版本可分享給親友，瀏覽每日行程與景點導航。'}</p><div class="actions"><button class="button primary" data-action="import">${icon('download')}${state.privateTrip?'匯入新版資料':'匯入同行資料包'}</button>${state.privateTrip?`<button class="button secondary" data-action="mode">切換${privateMode()?'分享行程':'同行完整'}版</button>`:''}</div><p class="caption">同行資料包只在這台裝置讀取，不會上傳。更新時請四位同行者各自匯入最新版。</p></section>
  <section class="settings-card"><h2>帶著旅程離線出發</h2><div class="storage-state"><span class="status-dot ${state.offlineReady?'ready':''}"></span>${state.offlineReady?'行程頁面已可離線開啟':'正在準備離線頁面'}</div><p>${state.privateTrip?'已匯入的附件與路線圖可離線查看。':'先匯入同行資料包，才能離線查看票券附件。'}地圖即時導航與外部網站仍需網路。</p><button class="button secondary" data-action="persist">保留這台手機的離線資料</button><p class="caption">清除瀏覽器資料會移除離線內容；出發前請開飛航模式測試一次。</p></section>
  <section class="settings-card"><h2>加到手機主畫面</h2><p>iPhone：用 Safari 開啟，按分享 → 加入主畫面。Android：用 Chrome 選單 → 安裝應用程式／加到主畫面。</p>${state.installing?'<button class="button primary" data-action="install">安裝到主畫面</button>':''}<p class="caption">正式安裝與離線功能需透過 HTTPS 網址開啟。</p></section>
  ${privateMode()?`<section class="settings-card"><h2>住宿，隨時找得到</h2>${d.hotels.map(h=>`<article class="hotel-row"><span>${esc(h.city)} · ${esc(h.dates)}</span><h3>${esc(h.name)}</h3><p>${esc(h.address)}</p>${extLink(h.mapUrl,'開啟住宿導航 ↗','inline-link')}<details><summary>入住提醒</summary><p>${esc(h.note)}</p></details></article>`).join('')}</section><section class="settings-card"><h2>費用概覽</h2><div class="budget-number">NT$${money(d.budget.core)}<span>／人</span></div><p>核心規劃預算，含國內航班、不含國際機票。規劃匯率 €1＝NT$40。</p><p class="caption">含國際機票：NT$${money(d.budget.allIn)}／人。高鐵四人 €100.75 已計入。</p></section>${pendingSection()}`:''}
  <section class="settings-card"><h2>看看旅途中會怎麼用</h2><p>選一個西班牙當地時間，試看「現在」與「下一步」。</p><div class="preview-presets"><button class="button secondary" data-action="preview" data-time="2026-12-24T11:35:00+01:00">12/24 市場午餐</button><button class="button secondary" data-action="preview" data-time="2026-12-26T21:39:00+01:00">12/26 高鐵抵達</button></div><label class="field-label" for="preview-time">自訂西班牙時間</label><input id="preview-time" type="datetime-local" min="2026-12-23T00:00" max="2027-01-05T23:59" value="2026-12-26T18:15"><button class="text-button" data-action="custom-preview">開啟時間預覽 →</button></section>
  <section class="settings-card"><h2>把旅程分享給親友</h2><p>分享這個網站網址，親友看到的是行程版。票券附件保留在各自匯入資料包的手機上。</p><button class="button secondary" data-action="share">分享行程網址 ${icon('arrow')}</button><p class="caption">請把同行資料包交給同行者；它包含實際票券。</p></section>
  ${state.privateTrip?'<button class="text-button danger" data-action="clear">移除此裝置的同行資料</button>':''}<footer class="app-footer">西班牙・口袋旅程<br><small>行程依匯入版本顯示，航班、訂位與開放情況仍以現場及供應商確認為準。</small></footer>`;
}
function render() {
  if (!data()) return;
  const scroll = window.scrollY;
  const updateBanner=data().hasNewerItinerary?'<div class="data-update-banner">已顯示最新行程；同行附件可另匯入新版。<button data-action="tab" data-tab="trip">查看更新</button></div>':'';
  $('#app').innerHTML = `${header()}${updateBanner}<main id="main" class="main" tabindex="-1">${({now:home,plan:itinerary,tickets,trip:journey})[state.tab]()}</main>${navigation()}`;
  if (state.tab==='plan') $('.day-chip.selected')?.scrollIntoView({block:'nearest',inline:'center'});
  window.scrollTo(0,scroll);
}
function tab(name) { state.tab=name; state.search=''; state.filter='all'; render();window.scrollTo(0,0);history.replaceState(null,'',`#${name}`); }
async function openAsset(id) {
  const a=await read('assets',id);
  if (!a) return toast('找不到此附件，請重新匯入同行資料包。');
  if (viewerUrl) URL.revokeObjectURL(viewerUrl);
  viewerUrl=URL.createObjectURL(a.blob);
  $('#viewer-title').textContent=a.name;
  const fileLink=`<a class="button primary" href="${viewerUrl}" download="${esc(a.name)}" target="_blank" rel="noopener">下載／另開附件 ${icon('download')}</a>`;
  $('#viewer-body').innerHTML=a.type.startsWith('image/')?`<div class="image-view"><img src="${viewerUrl}" alt="${esc(a.name)}"></div>${fileLink}`:a.type==='application/pdf'?`<p class="caption">若手機沒有顯示預覽，請下載／另開附件。</p>${fileLink}<iframe src="${viewerUrl}" title="${esc(a.name)}"></iframe>`:`<div class="empty-state"><p>這份附件會交由手機支援的應用程式開啟。</p>${fileLink}</div>`;
  $('#viewer').showModal();
}
async function action(button) {
  const a=button.dataset.action;
  if (a==='tab') tab(button.dataset.tab);
  else if (a==='day') {state.date=button.dataset.date;saveSetting('selectedDate',state.date).catch(()=>{});tab('plan');}
  else if (a==='today') {state.date=data().days.some(d=>d.date===dateInZone(now()))?dateInZone(now()):data().days[0].date;tab('plan');}
  else if (a==='event-tickets') {state.search=button.dataset.ids.split(',')[0];state.filter='all';state.tab='tickets';render();window.scrollTo(0,0);}
  else if (a==='filter') {state.filter=button.dataset.filter;render();}
  else if (a==='preview') {state.preview=button.dataset.time;tab('now');}
  else if (a==='custom-preview') {const v=$('#preview-time').value;if(!$('#preview-time').checkValidity()||!v)return toast('請選擇旅程期間的有效時間');state.preview=`${v}:00+01:00`;tab('now');}
  else if (a==='live') {state.preview=null;render();toast('已回到裝置實際時間');}
  else if (a==='import') {if(state.busy)return toast('正在匯入，請稍候');$('#pack-input').click();}
  else if (a==='asset') await openAsset(button.dataset.id);
  else if (a==='mode') {if(privateMode()&&!state.share)return toast('目前沒有可用的分享行程，請連線後再試');state.mode=privateMode()?'share':'private';await saveSetting('mode',state.mode);render();toast(privateMode()?'已切換同行完整版':'已切換分享行程版');}
  else if (a==='sync') {await refreshPublicData(true);await state.swReg?.update().catch(()=>{});}
  else if (a==='apply-shell') {if(state.busy)return toast('資料匯入完成後再更新畫面');location.reload();}
  else if (a==='done') {const id=button.dataset.id;state.done.has(id)?state.done.delete(id):state.done.add(id);await saveSetting('done',[...state.done]);render();toast('已更新這台裝置的完成標記');}
  else if (a==='persist') {const result=await navigator.storage?.persist?.();toast(result?'已取得較穩定的離線儲存權限':'瀏覽器未提供保留權限；目前資料仍可離線使用，請保留原資料包');}
  else if (a==='install'&&state.installing) {await state.installing.prompt();state.installing=null;render();}
  else if (a==='clear') {if(confirm('要移除這台裝置的同行行程與票券嗎？原始資料包不會刪除。')) {await clearPrivate();state.privateTrip=null;state.mode='share';render();toast('已移除同行資料，現在是分享行程版');}}
  else if (a==='share') {
    const url=new URL('./',location.href).href;
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return toast('目前是本機預覽；正式上線後即可分享手機網址。');
    if(navigator.share) await navigator.share({title:'我們的西班牙冬日旅程',url});
    else if(navigator.clipboard) {await navigator.clipboard.writeText(url);toast('已複製分享行程網址');}
  }
}
document.addEventListener('click', e => {const b=e.target.closest('[data-action]');if(b) action(b).catch(error=>{if(error.name!=='AbortError')toast(error.message||'操作未完成，請再試一次');});});
document.addEventListener('input', e => {
  if(e.target.id==='ticket-search') {state.search=e.target.value;const pos=e.target.selectionStart;render();$('#ticket-search').focus();try{$('#ticket-search').setSelectionRange(pos,pos);}catch{}}
});
$('#close-viewer').addEventListener('click',()=>$('#viewer').close());
$('#viewer').addEventListener('close',()=>{if(viewerUrl)URL.revokeObjectURL(viewerUrl);viewerUrl=null;$('#viewer-body').replaceChildren();});
$('#pack-input').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  if(f.size>60*1024*1024){toast('資料包過大，請使用目前提供的旅行資料包');e.target.value='';return;}
  toast('正在匯入行程與離線附件，請稍候…');state.busy=true;
  try {
    const pack=JSON.parse(await f.text());
    if(state.privateTrip && isOlderVersion(pack.trip?.version,state.privateTrip.version) && !confirm('這份資料包比目前版本舊，仍要匯入嗎？'))return;
    state.privateTrip=await importPack(pack);state.mode='private';await saveSetting('mode','private');
    state.date=state.privateTrip.days.some(d=>d.date===state.date)?state.date:state.privateTrip.days[0].date;
    render();toast(`匯入完成：${state.privateTrip.days.length} 天行程與 ${pack.assets.length} 份離線附件／地圖`);
  }catch(error){toast(`匯入失敗：${error.message}。原資料仍保留。`);}finally{state.busy=false;e.target.value='';}
});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installing=e;if(state.tab==='trip')render();});
window.addEventListener('online',()=>{render();toast('已恢復連線，正在檢查行程更新');refreshPublicData();});
window.addEventListener('offline',()=>{render();toast('目前離線，已儲存的行程與附件仍可查看');});
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(['now','plan','tickets','trip'].includes(h)){state.tab=h;render();window.scrollTo(0,0);}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){render();refreshPublicData();state.swReg?.update().catch(()=>{});}});
async function fetchFresh(path) {
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
  try {return await fetch(path,{cache:'no-store',signal:controller.signal});} finally {clearTimeout(timeout);}
}
async function refreshPublicData(manual=false) {
  if(state.syncing||state.busy)return;
  state.syncing=true;
  if(manual){state.syncMessage='正在檢查網站最新行程…';render();}
  try {
    const response=await fetchFresh('./data/share.json');
    if(!response.ok)throw new Error('網站資料暫時無法取得');
    const fresh=await response.json();if(!validPublicTrip(fresh))throw new Error('網站行程格式不完整');
    const cached=response.headers.get('X-Spain-Offline')==='1';
    if(!state.share||!isOlderVersion(fresh.version,state.share.version)) {
      state.share=fresh;await saveSetting('publicTrip',fresh).catch(()=>{});
      state.syncMessage=cached?'目前使用已儲存的行程，連線後會再檢查。':`行程已是最新：${fresh.version}`;
    } else state.syncMessage=`網站目前提供${fresh.version}，這台手機已保留較新的${state.share.version}；請核對Vercel部署。`;
    if(!cached)state.checkedAt=new Date().toISOString();
    try {
      const versionResponse=await fetchFresh('./version.json');
      if(versionResponse.ok&&versionResponse.headers.get('X-Spain-Offline')!=='1')state.siteVersion=await versionResponse.json();
    }catch{}
    if(state.date&&!data()?.days.some(d=>d.date===state.date))state.date=data()?.days[0]?.date;
    if(manual)toast(state.syncMessage);
    return true;
  }catch(error){state.syncMessage='目前無法取得網站更新，繼續使用已儲存行程。';if(manual)toast(state.syncMessage);return false;}
  finally{state.syncing=false;if(data())render();}
}
if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',event=>{
  if(event.data?.type!=='APP_VERSION')return;
  event.source?.postMessage({type:'CLIENT_VERSION',build:APP_BUILD});
  if(event.data.build===APP_BUILD)return;
  state.shellUpdate=true;
  if(!state.busy&&!$('#viewer').open)location.reload();else if(data())render();
});
async function boot() {
  try {
    try {const [p,mode,done,publicTrip,date]=await Promise.all([read('settings','privateTrip'),read('settings','mode'),read('settings','done'),read('settings','publicTrip'),read('settings','selectedDate')]);state.privateTrip=p||null;state.mode=p?(mode||'private'):'share';state.done=new Set(done||[]);state.share=validPublicTrip(publicTrip)?publicTrip:null;state.date=date||null;}catch{toast('瀏覽器儲存無法使用，目前可瀏覽分享行程版。');}
    if(data())render();
    await refreshPublicData();
    if(!data())throw new Error('行程資料尚未載入');
    const today=dateInZone(now());state.date=data().days.some(d=>d.date===today)?today:data().days[0].date;
    const savedDate=await read('settings','selectedDate').catch(()=>null);if(data().days.some(d=>d.date===savedDate))state.date=savedDate;
    const hash=location.hash.slice(1);if(['now','plan','tickets','trip'].includes(hash))state.tab=hash;
    render();
    if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{state.swReg=reg;return navigator.serviceWorker.ready;}).then(()=>{state.offlineReady=true;if(state.tab==='trip')render();}).catch(()=>toast('離線頁面尚未準備完成，請確認使用 HTTPS 網址。'));
    setInterval(()=>{const key=clock(now())+dateInZone(now());if(key!==lastRefresh&&!state.preview&&!state.busy&&state.tab==='now')render();lastRefresh=key;},15000);
    setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine)refreshPublicData();},60000);
  }catch(error){$('#app').innerHTML=`<main class="empty-state"><h1>還沒能打開旅程</h1><p>${esc(error.message)}</p><p>第一次使用請保持連線，完成開啟後即可離線查看。</p><button class="button primary" onclick="location.reload()">重新開啟</button></main>`;}
}
boot();

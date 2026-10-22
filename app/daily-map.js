import { dailyMapPlaces } from './map-data.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const https = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
const googleLink = place => https(place.mapUrl) ? `<a class="inline-link" href="${escape(https(place.mapUrl))}" target="_blank" rel="noopener noreferrer">Google Maps 店家／導航 ↗</a>` : '';

export class DailyMap {
  constructor() {
    this.root = document.createElement('section');
    this.root.className = 'daily-map';
    this.root.setAttribute('aria-label','當日互動地圖');
    this.root.innerHTML = `<div class="daily-map-heading"><div><h3>當日地圖</h3><p class="map-count caption"></p></div><button class="map-expand button secondary" type="button">放大地圖 ⛶</button></div><div class="map-tools"><button class="map-fit" type="button">全部地點</button><button class="map-city" type="button">景點與餐廳</button><span>拖曳移動・雙指縮放</span></div><div class="map-canvas-home"><div class="map-canvas" role="region" aria-label="可拖曳縮放的當日地圖" tabindex="0"></div></div><p class="map-status caption" role="status"></p><div class="map-legend"><span>● 景點</span><span class="map-dining">● 餐飲</span><span class="map-transport">● 交通</span><span class="map-flexible">○ 備選／彈性／擇一</span></div><p class="map-provider caption">OpenStreetMap 街道地圖；點標記查看資訊與 Google 導航。地圖底圖需連線。</p><details class="map-locations"><summary>查看當日地點清單</summary><ol></ol></details>`;
    this.canvas = this.root.querySelector('.map-canvas');
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'daily-map-dialog';
    this.dialog.setAttribute('aria-label','放大當日地圖');
    this.dialog.innerHTML = '<div class="viewer-head"><strong>當日地圖・雙指縮放／拖曳移動</strong><button type="button" class="icon-button" aria-label="關閉放大地圖">✕</button></div><div class="expanded-map-slot"></div>';
    document.body.append(this.dialog);
    this.dialog.querySelector('button').addEventListener('click',()=>this.dialog.close());
    this.dialog.addEventListener('close',()=>{
      this.root.querySelector('.map-canvas-home').append(this.canvas);
      document.body.classList.remove('map-dialog-open');
      this.map?.invalidateSize({pan:false});
    });
    this.root.querySelector('.map-expand').addEventListener('click',()=>{
      this.dialog.showModal();
      this.dialog.querySelector('.expanded-map-slot').append(this.canvas);
      document.body.classList.add('map-dialog-open');
      this.map?.invalidateSize({pan:false});
    });
    this.root.querySelector('.map-fit').addEventListener('click',()=>this.fit(false));
    this.root.querySelector('.map-city').addEventListener('click',()=>this.fit(true));
    this.root.addEventListener('click',event=>{
      const button = event.target.closest('[data-map-place]');
      if (button) this.select(button.dataset.mapPlace);
    });
    this.markers = new Map();
    this.views = new Map();
  }
  mount(slot, day) {
    slot.append(this.root);
    this.map?.invalidateSize({pan:false});
    const entries = dailyMapPlaces(day);
    const signature = JSON.stringify([day.date,entries]);
    if (signature === this.signature) { this.networkStatus(); return; }
    if (this.map && this.date) this.views.set(this.date,{center:this.map.getCenter(),zoom:this.map.getZoom()});
    this.signature = signature;
    this.date = day.date;
    this.entries = entries;
    this.root.querySelector('.map-count').textContent = `${entries.filter(p=>p.coordinates).length} 個標記${entries.some(p=>!p.coordinates)?`・${entries.filter(p=>!p.coordinates).length} 處位置待核對`:''}`;
    this.root.querySelector('.map-locations summary').textContent = `查看當日地點清單（${entries.length} 處）`;
    this.root.querySelector('.map-locations ol').innerHTML = entries.map(place=>`<li class="${place.optional || place.choice?'map-flexible':''}"><button type="button" data-map-place="${escape(place.key)}" ${place.coordinates?'':'disabled'}><span class="map-list-number">${escape(place.label)}</span><span><strong>${escape(place.title)}</strong><small>${escape(place.choice?'午餐擇一・':'')}${escape(place.time)}${place.optional&&!place.time.includes('無固定')?'・彈性':''}${place.coordinates?'':'・位置待核對'}</small></span></button>${googleLink(place)}</li>`).join('');
    if (!globalThis.L) { this.root.querySelector('.map-status').textContent='地圖暫時無法載入；下方地點清單與 Google 連結仍可使用。'; return; }
    if (!this.map) this.initialize();
    this.map.closePopup();
    this.layer.clearLayers();
    this.markers.clear();
    for (const place of entries.filter(p=>p.coordinates)) {
      const flexible = place.optional || place.choice;
      const kind = place.key.startsWith('transport|') ? 'transport' : place.kind;
      const marker = L.marker(place.coordinates,{
        icon:L.divIcon({className:`day-map-marker kind-${kind} ${flexible?'flexible':''}`,html:`<span>${escape(place.label)}</span>`,iconSize:[34,38],iconAnchor:[17,38],popupAnchor:[0,-34]}),
        title:`${place.label} ${place.title}`,alt:`${place.title}，${place.time}`,keyboard:true,
      }).bindPopup(this.popup(place),{maxWidth:290,minWidth:200,autoPanPadding:[28,28]});
      marker.addTo(this.layer);
      this.markers.set(place.key,marker);
    }
    const saved = this.views.get(this.date);
    if (saved) this.map.setView(saved.center,saved.zoom,{animate:false});
    else this.fit(true);
    this.networkStatus();
  }
  initialize() {
    this.map = L.map(this.canvas,{scrollWheelZoom:false,touchZoom:true,dragging:true,zoomControl:true,keyboard:true,attributionControl:true,minZoom:2,maxZoom:19});
    this.map.zoomControl.setPosition('topright');
    this.map.zoomControl._zoomInButton.setAttribute('aria-label','放大地圖');
    this.map.zoomControl._zoomOutButton.setAttribute('aria-label','縮小地圖');
    this.layer = L.layerGroup().addTo(this.map);
    this.tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    });
    this.tiles.on('tileerror',()=>{this.tileError=true;this.networkStatus();});
    this.tiles.on('tileload',()=>{this.tileError=false;this.networkStatus();});
    this.map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');
    this.map.setView([40.4168,-3.7038],12);
  }
  networkStatus() {
    if (!this.map) return;
    // Respect the tile provider: normal online viewport requests only, no prefetch/offline download.
    if (navigator.onLine && !this.map.hasLayer(this.tiles)) this.tiles.addTo(this.map);
    if (!navigator.onLine && this.map.hasLayer(this.tiles)) this.map.removeLayer(this.tiles);
    this.root.querySelector('.map-status').textContent = !navigator.onLine ? '目前離線：地點標記與清單仍可查看，街道底圖連線後恢復。' : this.tileError ? '街道底圖暫時無法載入；標記與地點清單仍可查看，或開啟 Google Maps。' : '點標記看地點；＋／− 可縮放，放大地圖後更方便操作。';
  }
  fit(cityOnly) {
    if (!this.map) return;
    const all = this.entries.filter(p=>p.coordinates);
    const city = all.filter(p=>!p.key.startsWith('transport|'));
    const chosen = cityOnly && city.length ? city : all;
    if (chosen.length) this.map.fitBounds(L.latLngBounds(chosen.map(p=>p.coordinates)),{padding:[35,45],maxZoom:16,animate:false});
    else this.map.setView([40.2,-3.7],5,{animate:false});
  }
  popup(place) {
    const element = document.createElement('div');
    element.className = 'day-map-popup';
    element.innerHTML = `<span class="map-popup-time">${escape(place.choice?'午餐擇一・':'')}${escape(place.time)}${place.optional&&!place.time.includes('無固定')?'・彈性':''}</span><h3>${escape(place.title)}</h3>${place.status?`<p class="map-popup-status">${escape(place.status)}</p>`:''}${place.description?`<p>${escape(place.description)}</p>`:''}${place.mustTry.length?`<p><strong>推薦：</strong>${escape(place.mustTry.join('、'))}</p>`:''}${place.openingHours?`<p>${escape(place.openingHours)}</p>`:''}${place.locationNote?`<p class="map-location-note">${escape(place.locationNote)}</p>`:''}${googleLink(place)}${place.targetId?'<button class="text-button map-to-event" type="button">查看時間軸這一站 ↓</button>':''}`;
    element.querySelector('.map-to-event')?.addEventListener('click',()=>{
      if(this.dialog.open)this.dialog.close();
      const event = document.getElementById(place.targetId);
      const details = event?.querySelector('details');
      if(details)details.open=true;
      event?.scrollIntoView({behavior:'smooth',block:'start'});
    });
    return element;
  }
  select(key) {
    const place = this.entries.find(p=>p.key===key);
    const marker = this.markers.get(key);
    if (!place?.coordinates || !marker) return;
    this.map.setView(place.coordinates,17,{animate:false});
    marker.openPopup();
    this.canvas.scrollIntoView({block:'center',behavior:'smooth'});
  }
  detach() {
    if (this.dialog.open) this.dialog.close();
  }
}

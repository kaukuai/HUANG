let database;
export function isOlderVersion(incoming,current) {
  const split=v=>/^\d{4}-\d{2}-\d{2}(?:-v\d+)?$/.test(String(v))?[String(v).slice(0,10),Number(String(v).split('-v')[1]||1)]:null;
  const a=split(incoming),b=split(current);
  return !!(a&&b&&(a[0]<b[0]||(a[0]===b[0]&&a[1]<b[1])));
}
export async function db() {
  if (database) return database;
  database = await new Promise((resolve, reject) => {
    const req = indexedDB.open('spain-pocket-trip', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('settings');
      req.result.createObjectStore('assets');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return database;
}
export async function read(store, key) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction(store).objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveSetting(key, value) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('settings', 'readwrite');
    tx.objectStore('settings').put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('資料儲存中斷'));
  });
}
export function validatePack(pack) {
  if (pack?.format !== 'spain-pocket-trip/v1' || !pack.trip || !Array.isArray(pack.trip.days) || !Array.isArray(pack.assets)) throw new Error('這不是可用的西班牙旅行資料包');
  if (pack.trip.days.length < 1 || pack.trip.days.length > 40 || !Array.isArray(pack.trip.tickets) || !Array.isArray(pack.trip.flights) || !Array.isArray(pack.trip.todos) || !Array.isArray(pack.trip.hotels) || typeof pack.trip.version !== 'string' || !pack.trip.budget || !Number.isFinite(Number(pack.trip.budget.core)) || !Number.isFinite(Number(pack.trip.budget.allIn))) throw new Error('行程資料格式不完整');
  for (const day of pack.trip.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Array.isArray(day.events)) throw new Error('日期格式不完整');
    for (const e of day.events) if (!e.id || !e.title || !Number.isFinite(Date.parse(e.start)) || Date.parse(e.end) <= Date.parse(e.start)) throw new Error('行程時段有誤');
  }
  const allowed = /^(application\/(pdf|vnd\.apple\.pkpass|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)|image\/(png|jpeg|webp))$/;
  if (pack.assets.length > 200) throw new Error('附件數量超出支援範圍');
  const ids = new Set();
  for (const a of pack.assets) {
    if (!/^[a-f0-9]{24}$/.test(a.id) || ids.has(a.id) || !allowed.test(a.type) || typeof a.data !== 'string' || typeof a.name !== 'string') throw new Error('附件格式有誤');
    ids.add(a.id);
  }
  for (const day of pack.trip.days) if (day.mapAsset && !ids.has(day.mapAsset)) throw new Error('每日地圖附件缺失');
  for (const ticket of pack.trip.tickets) {
    if (typeof ticket.id !== 'string' || typeof ticket.title !== 'string' || !Array.isArray(ticket.files)) throw new Error('票券資料格式不完整');
    for (const file of ticket.files) if (file.assetId && !ids.has(file.assetId)) throw new Error('票券附件缺失');
  }
  return pack;
}
export async function importPack(raw) {
  const pack = validatePack(raw);
  // Decode before starting the transaction. An invalid import leaves the old trip intact.
  const blobs = pack.assets.map(a => {
    const bytes = Uint8Array.from(atob(a.data), c => c.charCodeAt(0));
    return { id: a.id, blob: new Blob([bytes], { type: a.type }), name: a.name, type: a.type };
  });
  const d = await db();
  await new Promise((resolve, reject) => {
    const tx = d.transaction(['settings', 'assets'], 'readwrite');
    const store = tx.objectStore('assets');
    store.clear();
    for (const a of blobs) store.put(a, a.id);
    tx.objectStore('settings').put(pack.trip, 'privateTrip');
    tx.objectStore('settings').put({ at: new Date().toISOString(), assets: blobs.length, version: pack.trip.version }, 'importInfo');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('儲存空間不足或匯入中斷'));
  });
  return pack.trip;
}
export async function clearPrivate() {
  const d = await db();
  await new Promise((resolve, reject) => {
    const tx = d.transaction(['settings', 'assets'], 'readwrite');
    tx.objectStore('assets').clear();
    tx.objectStore('settings').delete('privateTrip');
    tx.objectStore('settings').delete('importInfo');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

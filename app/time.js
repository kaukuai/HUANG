export const ZONE = 'Europe/Madrid';
export function dateInZone(value, zone = ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function clock(value, zone = ZONE) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(value);
}
export function currentAndNext(events, now) {
  const t = Number(now);
  const sorted = [...events].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return {
    current: sorted.find(e => Date.parse(e.start) <= t && t < Date.parse(e.end)) || null,
    next: sorted.find(e => Date.parse(e.start) > t) || null,
  };
}
export function shortDate(date) {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}
export function minutesUntil(start, now) {
  return Math.max(0, Math.ceil((Date.parse(start) - Number(now)) / 60000));
}
export function tripPhase(days, now) {
  const date = dateInZone(now);
  if (date < days[0].date) return 'before';
  if (date > days.at(-1).date) return 'after';
  return 'during';
}

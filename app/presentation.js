import { clock } from './time.js';

export const cities = [
  { id:'madrid', name:'馬德里', english:'MADRID', nights:2 },
  { id:'sevilla', name:'塞維亞', english:'SEVILLA', nights:2 },
  { id:'granada', name:'格拉納達', english:'GRANADA', nights:1 },
  { id:'barcelona', name:'巴塞隆納', english:'BARCELONA', nights:5 },
];

export function eventKind(event) {
  if (event.lodgingAction) return 'lodging';
  if (['早餐','午餐','晚餐','甜點','條件甜點'].includes(event.category)) return 'dining';
  return 'activity';
}

export function activityTitle(event, day, hotels = []) {
  if (!event.lodgingAction) return event.displayTitle || event.title;
  const city = cities.find(c => c.id === event.cityId);
  const hotel = hotels.find(h => city && h.city.includes(city.name));
  const name = hotel?.name || day?.hotel;
  return `住宿｜${name ? name + '・' : ''}${event.lodgingAction}`;
}

export function eventClock(event, end = false) {
  return clock(new Date(end ? event.end : event.start), end ? event.endTimezone || event.timezone || 'Europe/Madrid' : event.timezone || 'Europe/Madrid');
}

export function cityHighlights(trip, cityId) {
  return trip.days.map(day => {
    const stops = [];
    const seen = new Map();
    for (const event of [...day.events].sort((a,b) => Date.parse(a.start)-Date.parse(b.start))) {
      if (event.venue?.cityId !== cityId || eventKind(event) === 'lodging') continue;
      const key = event.venue.nameZh + '|' + event.venue.nameEn;
      const prior = seen.get(key);
      if (prior) { prior.end = event.end; continue; }
      const stop = { ...event, overviewTitle:`${event.venue.nameZh}（${event.venue.nameEn}）` };
      stops.push(stop); seen.set(key,stop);
    }
    const optional = (day.optionalStops || []).filter(stop => stop.venue?.cityId === cityId);
    return { date:day.date, stops, optional };
  }).filter(day => day.stops.length || day.optional.length);
}

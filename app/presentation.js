import { clock } from './time.js';

export const cities = [
  { id:'madrid', name:'馬德里', english:'MADRID', nights:2 },
  { id:'sevilla', name:'塞維亞', english:'SEVILLA', nights:2 },
  { id:'granada', name:'格拉納達', english:'GRANADA', nights:1 },
  { id:'barcelona', name:'巴塞隆納', english:'BARCELONA', nights:5 },
];

export function eventKind(event) {
  if (event.lodgingAction) return 'lodging';
  if (['早餐','午餐','晚餐','甜點','條件甜點','餐飲散步','酒吧'].includes(event.category)) return 'dining';
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
      const candidates=event.mealOptions?.length ? event.mealOptions.map(option=>({...event,...option,id:event.id+'-'+option.id,sourceEventId:event.id,end:option.end||event.end,ticketIds:option.reservation?[option.reservation.id]:[],mealOptions:undefined})) : [event];
      for (const candidate of candidates) {
        if (candidate.venue?.cityId !== cityId || eventKind(candidate) === 'lodging') continue;
        const key = candidate.venue.nameZh + '|' + candidate.venue.nameEn;
        const prior = seen.get(key);
        if (prior) { prior.end = candidate.end; continue; }
        const stop = { ...candidate, overviewTitle:`${candidate.venue.nameZh}（${candidate.venue.nameEn}）` };
        stops.push(stop); seen.set(key,stop);
      }
    }
    const optional = (day.optionalStops || []).filter(stop => stop.venue?.cityId === cityId);
    const positions=new Map(day.events.map((e,index)=>[e.id,index]));
    const entries=[...stops.map(stop=>({kind:'scheduled',stop,rank:2*(positions.get(stop.sourceEventId||stop.id)??Infinity)})),...optional.map(stop=>({kind:'optional',stop,rank:stop.beforeEventId&&positions.has(stop.beforeEventId)?2*positions.get(stop.beforeEventId)-1:stop.afterEventId&&positions.has(stop.afterEventId)?2*positions.get(stop.afterEventId)+1:Infinity}))].sort((a,b)=>a.rank-b.rank);
    return { date:day.date, stops, optional, entries };
  }).filter(day => day.stops.length || day.optional.length);
}

export function calendarText(reminder, created = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reminder.date)) throw new Error('提醒日期格式不完整');
  const escape=text=>String(text||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const fold=line=>{let out='',bytes=0;for(const char of line){const size=new TextEncoder().encode(char).length;if(bytes+size>75){out+='\r\n ';bytes=1;}out+=char;bytes+=size;}return out;};
  const date=reminder.date.replaceAll('-','');
  const end=new Date(reminder.date+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+1);
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Spain Pocket Trip//Calendar//ZH-TW','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${escape(reminder.id)}@spain-pocket-trip.local`,`DTSTAMP:${created.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}`,`DTSTART;VALUE=DATE:${date}`,`DTEND;VALUE=DATE:${end.toISOString().slice(0,10).replaceAll('-','')}`,`SUMMARY:${escape(reminder.title)}`,`DESCRIPTION:${escape(reminder.note)}`,'END:VEVENT','END:VCALENDAR',''].map(fold).join('\r\n');
}

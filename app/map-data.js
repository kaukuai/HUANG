import { eventKind, eventClock } from './presentation.js';
import { places, transportStops } from './map-places.js';

export const venueKey = venue => venue ? `${venue.cityId}|${venue.nameEn}` : '';
export const validCoordinates = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) && Math.abs(value[0]) <= 85 && Math.abs(value[1]) <= 180;

// No live geocoding: locations are checked once, and unknown places keep their Google link.
// Accommodation names/coordinates are never inferred from the public itinerary.
export function dailyMapPlaces(day, catalog = places) {
  const entries = [];
  const positions = new Map(day.events.map((event, index) => [event.id, index]));
  const add = (event, rank, optional = false, sourceEventId = event.id, key = venueKey(event.venue), label) => {
    if (!key) return;
    const location = catalog[key];
    entries.push({
      key, rank, sourceEventId, optional: optional || !!event.conditional,
      choice: !!event.choice, kind: eventKind(event),
      title: label || (event.venue ? `${event.venue.nameZh}（${event.venue.nameEn}）` : event.displayTitle || event.title),
      coordinates: validCoordinates(location?.coordinates) ? location.coordinates : null,
      locationNote: location?.note || '', mapUrl: event.mapUrl || location?.mapUrl || '',
      time: optional ? '有空再去・無固定時間' : event.start ? `${eventClock(event)}${event.timezone === 'Asia/Taipei' ? ' 台灣' : event.timezone === 'Asia/Shanghai' ? ' 上海' : ''}` : '時間依當日安排',
      description: event.activity?.description || event.description || event.note || '',
      mustTry: event.activity?.mustTry || event.mustTry || [],
      openingHours: event.activity?.openingHours || event.openingHours || '',
      status: event.status || '', targetId: optional ? event.id ? `stop-${event.id}` : '' : `event-${sourceEventId}`,
    });
  };
  for (const [index, event] of day.events.entries()) {
    if (event.lodgingAction) continue;
    for (const option of event.mealOptions?.length ? event.mealOptions : [event]) {
      add({ ...event, ...option, choice: !!event.mealOptions?.length }, 2 * index, false, event.id);
    }
    for (const stop of transportStops[event.id] || []) {
      const location = catalog[stop.key];
      if (location) add({ ...event, category:'交通', start:stop.arrival ? event.end : event.start, end:stop.arrival ? event.end : event.start, timezone:stop.arrival ? event.endTimezone || event.timezone : event.timezone, activity:{description:stop.description || event.activity?.description}, mapUrl:location.mapUrl }, 2 * index + (stop.arrival ? .5 : -.5), false, event.id, stop.key, location.title);
    }
  }
  for (const stop of day.optionalStops || []) {
    const rank = positions.has(stop.beforeEventId) ? 2 * positions.get(stop.beforeEventId) - 1 : positions.has(stop.afterEventId) ? 2 * positions.get(stop.afterEventId) + 1 : Infinity;
    add(stop, rank, true);
  }
  const seen = new Map();
  for (const entry of entries.sort((a,b) => a.rank - b.rank)) {
    const prior = seen.get(entry.key);
    if (!prior) seen.set(entry.key, entry);
    // A fixed visit takes precedence over a flexible mention of the same place.
    else if (prior.optional && !entry.optional) seen.set(entry.key, entry);
  }
  let number = 0, flexible = 0;
  return [...seen.values()].sort((a,b) => a.rank - b.rank).map(entry => ({...entry, label:entry.optional || entry.choice ? `備${++flexible}` : String(++number)}));
}

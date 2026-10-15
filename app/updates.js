import { isOlderVersion } from './storage.js';

// Public itinerary updates can be applied without uploading or replacing private files.
export function currentTrip(publicTrip, privateTrip) {
  if (!privateTrip) return publicTrip;
  if (!publicTrip || !isOlderVersion(privateTrip.version, publicTrip.version)) return privateTrip;
  const oldDays = new Map(privateTrip.days.map(day => [day.date, day]));
  const days = publicTrip.days.map(day => {
    const old = oldDays.get(day.date);
    const previous = new Map((old?.events || []).map(event => [event.id, event]));
    const routeChanged = !old || JSON.stringify(day.events.map(e => [e.id,e.start,e.end])) !== JSON.stringify(old.events.map(e => [e.id,e.start,e.end]));
    return {
      ...day,
      hotel: old?.hotel || '',
      mapAsset: routeChanged ? null : old?.mapAsset || null,
      offlineMapNeedsUpdate: routeChanged && !!old?.mapAsset,
      events: day.events.map(event => {
        const saved = previous.get(event.id);
        const unchanged = saved && saved.start === event.start && saved.end === event.end;
        if (!unchanged) return { ...event, ticketIds: saved?.ticketIds || [] };
        return {
          ...event,
          title: saved.title,
          note: saved.note,
          transport: saved.transport,
          infoUrl: saved.infoUrl,
          mapUrl: event.mapUrl || saved.mapUrl,
          ticketIds: saved.ticketIds,
          status: event.status || saved.status,
          statusKind: event.status ? event.statusKind : saved.statusKind,
        };
      }),
    };
  });
  return { ...privateTrip, days, version: publicTrip.version, companionVersion: privateTrip.version, hasNewerItinerary: true };
}

export function validPublicTrip(trip) {
  return trip?.schema === 1 && typeof trip.version === 'string' && Array.isArray(trip.days) && trip.days.length > 0 &&
    trip.days.every(d => Array.isArray(d.events) && d.events.every(e => e.id && Number.isFinite(Date.parse(e.start)) && Number.isFinite(Date.parse(e.end)))) &&
    ['tickets','hotels','todos','flights'].every(key => Array.isArray(trip[key]) && trip[key].length === 0) && trip.budget === null;
}

import { isOlderVersion } from './storage.js';

export function reservationsForEvent(event) {
  return [...(event.reservation ? [event.reservation] : []), ...(event.mealOptions || []).flatMap(option=>option.reservation ? [option.reservation] : [])];
}

// Public itinerary updates can be applied without uploading or replacing private files.
export function currentTrip(publicTrip, privateTrip) {
  if (!privateTrip) return publicTrip;
  if (!publicTrip || !isOlderVersion(privateTrip.version, publicTrip.version)) return privateTrip;
  const oldDays = new Map(privateTrip.days.map(day => [day.date, day]));
  const days = publicTrip.days.map(day => {
    const old = oldDays.get(day.date);
    const previous = new Map((old?.events || []).map(event => [event.id, event]));
    const route = events => events.filter(e=>!e.isFlight).map(e=>[e.id,e.start,e.end]);
    const routeChanged = !old || JSON.stringify(route(day.events)) !== JSON.stringify(route(old.events));
    return {
      ...day,
      hotel: old?.hotel || '',
      mapAsset: routeChanged ? null : old?.mapAsset || null,
      offlineMapNeedsUpdate: routeChanged && !!old?.mapAsset,
      events: day.events.map(event => {
        const saved = previous.get(event.id);
        const bookings=reservationsForEvent(event);
        const unchanged = saved && saved.start === event.start && saved.end === event.end;
        if (!unchanged) return { ...event, ticketIds: bookings.length ? bookings.map(b=>b.id) : saved?.ticketIds || (event.isFlight && privateTrip.tickets.some(t=>t.id==='F01') ? ['F01'] : []) };
        return {
          ...event,
          title: saved.title,
          note: event.reminderUpdated ? event.note : saved.note,
          transport: saved.transport,
          infoUrl: saved.infoUrl,
          mapUrl: event.mapUrl || saved.mapUrl,
          ticketIds: bookings.length ? bookings.map(b=>b.id) : saved.ticketIds,
          status: event.status || saved.status,
          statusKind: event.status ? event.statusKind : saved.statusKind,
        };
      }),
    };
  });
  const ticketReview=publicTrip.ticketReview?{...privateTrip.ticketReview,...publicTrip.ticketReview}:privateTrip.ticketReview;
  if(ticketReview && publicTrip.ticketReview?.status==='current' &&
      (privateTrip.ticketReview?.status!=='current' || (privateTrip.ticketReview?.last_verified || '') < publicTrip.ticketReview.last_verified))ticketReview.status='import_required';
  const reservations=publicTrip.days.flatMap(d=>d.events).flatMap(reservationsForEvent);
  const tickets=reservations.length ? [...privateTrip.tickets.filter(t=>!reservations.some(r=>r.id===t.id)),...reservations.map(r=>({...r,files:privateTrip.tickets.find(t=>t.id===r.id)?.files?.length ? privateTrip.tickets.find(t=>t.id===r.id).files : r.files}))] : privateTrip.tickets;
  return { ...privateTrip, days, tickets, ticketReview, planningReminders:publicTrip.planningReminders || privateTrip.planningReminders || [], version: publicTrip.version, companionVersion: privateTrip.version, hasNewerItinerary: true };
}

export function validPublicTrip(trip) {
  return trip?.schema === 1 && typeof trip.version === 'string' && Array.isArray(trip.days) && trip.days.length > 0 &&
    trip.days.every(d => Array.isArray(d.events) && d.events.every(e => e.id && Number.isFinite(Date.parse(e.start)) && Number.isFinite(Date.parse(e.end)))) &&
    ['tickets','hotels','todos','flights'].every(key => Array.isArray(trip[key]) && trip[key].length === 0) && trip.budget === null;
}

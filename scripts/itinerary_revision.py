"""Apply reviewed app revisions when regenerating from an older planning workbook.

The revision is public itinerary data only. Private attachments and lodging names
continue to come from the original companion pack, never this file.
"""
from copy import deepcopy
from datetime import datetime
from pathlib import Path
import json

REVISIONS = Path(__file__).with_name('data')


def apply_revision(trip):
    for path in sorted(REVISIONS.glob('itinerary-*.json')):
        apply_patch(trip, json.loads(path.read_text()))
    return trip


def apply_patch(trip, revision):
    if trip['version'] > revision['version']:
        return trip
    by_date = {day['date']: day for day in trip['days']}
    private = bool(trip.get('tickets'))
    for patch in revision['days']:
        day = by_date.get(patch['date'])
        if day is None:
            day = {'hotel':'', 'mapAsset':None, 'events':[], 'optionalStops':[]}
            trip['days'].append(day)
            by_date[patch['date']] = day
        old_events = {event['id']:event for event in day['events']}
        if 'events' in patch:
            day['events'] = [deepcopy(event) for event in patch['events']]
            day['mapAsset'] = None  # Old route drawings do not describe the new plan.
            day['offlineMapNeedsUpdate'] = private
            for event in day['events']:
                saved = old_events.get(event['id'])
                if saved and private:
                    event['ticketIds'] = saved.get('ticketIds', [])
                    if not event.get('reminderUpdated') and event['start'] == saved['start'] and event['end'] == saved['end']:
                        for key in ['note','transport','infoUrl']:
                            event[key] = saved.get(key, '')
        for key in ['date','city','title','timezone','optionalStops']:
            if key in patch:
                day[key] = deepcopy(patch[key])
        for stop in patch.get('addOptionalStops', []):
            day['optionalStops'] = [s for s in day.get('optionalStops', []) if s.get('id',s['title']) != stop.get('id',stop['title'])]
            day['optionalStops'].append(deepcopy(stop))
        for event in patch.get('addEvents', []):
            day['events'] = [e for e in day['events'] if e['id'] != event['id']]
            day['events'].append(deepcopy(event))
        day['events'].sort(key=lambda e:datetime.fromisoformat(e['start']).timestamp())
    for day in trip['days']:
        for event in day['events']:
            event.update(deepcopy(revision.get('eventDetails', {}).get(event['id'], {})))
            if private and event.get('isFlight'):
                event['ticketIds'] = ['F01']
        for stop in day.get('optionalStops', []):
            if stop['title'] in revision.get('optionalDetails', {}):
                stop.update(deepcopy(revision['optionalDetails'][stop['title']]))
    if private:
        bookings = {}
        for day in trip['days']:
            for event in day['events']:
                records = ([event['reservation']] if event.get('reservation') else []) + [o['reservation'] for o in event.get('mealOptions', []) if o.get('reservation')] + ([event['ticketPlan']] if event.get('ticketPlan') else [])
                for booking in records:
                    old = next((t for t in trip['tickets'] if t['id'] == booking['id']), {})
                    bookings[booking['id']] = {**deepcopy(booking), 'files':deepcopy(old.get('files') or booking.get('files', []))}
                if records:
                    event['ticketIds'] = [r['id'] for r in records]
        trip['tickets'][:] = [t for t in trip['tickets'] if t['id'] not in bookings] + list(bookings.values())
    if 'planningReminders' in revision:
        trip['planningReminders'] = deepcopy(revision['planningReminders'])
    if 'todoUpdates' in revision:
        trip['todoUpdates'] = deepcopy(revision['todoUpdates'])
        for todo in trip.get('todos', []):
            update = next((u for u in revision['todoUpdates'] if u['matchTitle'] == todo['title']), None)
            if update:
                todo.update({key:update[key] for key in ['title','note','url']})
    trip['days'].sort(key=lambda day:day['date'])
    trip['version'] = revision['version']
    return trip

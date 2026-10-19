"""Apply reviewed app revisions when regenerating from an older planning workbook.

The revision is public itinerary data only. Private attachments and lodging names
continue to come from the original companion pack, never this file.
"""
from copy import deepcopy
from datetime import datetime
from pathlib import Path
import json

REVISION = Path(__file__).with_name('data') / 'itinerary-2026-10-19.json'


def apply_revision(trip):
    revision = json.loads(REVISION.read_text())
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
        for event in patch.get('addEvents', []):
            day['events'] = [e for e in day['events'] if e['id'] != event['id']]
            day['events'].append(deepcopy(event))
        day['events'].sort(key=lambda e:datetime.fromisoformat(e['start']).timestamp())
    for day in trip['days']:
        for event in day['events']:
            event.update(deepcopy(revision['eventDetails'].get(event['id'], {})))
            if private and event.get('isFlight'):
                event['ticketIds'] = ['F01']
        for stop in day.get('optionalStops', []):
            if stop['title'] in revision['optionalDetails']:
                stop.update(deepcopy(revision['optionalDetails'][stop['title']]))
    if private:
        booking = deepcopy(revision['reservation'])
        trip['tickets'] = [t for t in trip['tickets'] if t['id'] != booking['id']] + [booking]
        for day in trip['days']:
            for event in day['events']:
                if event['id'] == 'd29-el-glop-dinner':
                    event['ticketIds'] = [booking['id']]
    trip['days'].sort(key=lambda day:day['date'])
    trip['version'] = revision['version']
    return trip

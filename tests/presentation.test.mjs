import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cities, activityTitle, eventKind, eventClock, cityHighlights } from '../app/presentation.js';
import { currentTrip, validPublicTrip } from '../app/updates.js';
import { currentAndNext } from '../app/time.js';

const trip=JSON.parse(readFileSync(new URL('../app/data/share.json',import.meta.url)));
const day=date=>trip.days.find(d=>d.date===date);

test('The full timeline includes Taiwan departure, airport timezones and final arrival',()=>{
  assert.equal(trip.days[0].date,'2026-12-23');
  assert.equal(trip.days.at(-1).date,'2027-01-04');
  const departure=day('2026-12-23').events[0];
  assert.equal(eventClock(departure),'18:40');
  assert.equal(eventClock(departure,true),'20:25');
  const madrid=day('2026-12-24').events[0];
  assert.equal(eventClock(madrid),'00:50');
  assert.equal(eventClock(madrid,true),'08:00');
  const arrival=day('2027-01-04').events.at(-1);
  assert.equal(eventClock(arrival),'14:00');
  assert.equal(currentAndNext(trip.days.flatMap(d=>d.events),new Date('2027-01-04T14:00:00+08:00')).current.id,arrival.id);
});

test('Cities list Chinese venue names in chronological order and keep alternatives untimed',()=>{
  for (const city of cities) {
    const days=cityHighlights(trip,city.id);
    assert.ok(days.length);
    const stops=days.flatMap(d=>d.stops);
    assert.ok(stops.every(e=>/^[\u3400-\u9fff]/.test(e.overviewTitle)));
    for(let i=1;i<stops.length;i++)assert.ok(Date.parse(stops[i-1].start)<=Date.parse(stops[i].start));
    assert.ok(stops.every(e=>eventKind(e)!=='lodging'));
    for(const stop of days.flatMap(d=>d.optional))assert.ok(!stop.start&&!stop.end);
  }
  const seville=cityHighlights(trip,'sevilla');
  assert.ok(seville.some(d=>d.date==='2026-12-26'&&d.stops.some(e=>e.title.includes('El Rinconcillo'))));
  assert.ok(!cityHighlights(trip,'madrid').flatMap(d=>d.stops).some(e=>e.title.includes('El Rinconcillo')));
  const barcelona=cityHighlights(trip,'barcelona').find(d=>d.date==='2026-12-30');
  const sagrada=barcelona.stops.filter(e=>e.venue.nameEn.includes('Basílica'));
  assert.equal(sagrada.length,1);
  assert.equal(sagrada[0].start,'2026-12-30T14:30:00+01:00');
  assert.equal(sagrada[0].end,'2026-12-30T17:15:00+01:00');
  assert.ok(barcelona.optional.some(e=>e.title.includes('Sagradas Tapas')));
});

test('Mixed-city days show the correct private hotel without putting it in public data',()=>{
  const hotels=[{city:'馬德里',name:'Madrid test hotel'},{city:'塞維亞',name:'Sevilla test hotel'}];
  const returns=day('2026-12-26').events.filter(e=>e.lodgingAction);
  const madrid=returns.find(e=>e.cityId==='madrid');
  const seville=returns.find(e=>e.cityId==='sevilla');
  assert.match(activityTitle(madrid,null,hotels),/住宿｜Madrid test hotel/);
  assert.match(activityTitle(seville,null,hotels),/住宿｜Sevilla test hotel/);
  assert.ok(!activityTitle(seville,null,[]).includes('test hotel'));
  assert.equal(eventKind(seville),'lodging');
  assert.equal(eventKind(day('2026-12-29').events.find(e=>e.reservation)),'dining');
  assert.ok(!day('2027-01-02').events.find(e=>e.title==='FGC回Espanya').lodgingAction);
  assert.ok(validPublicTrip(trip));
});

test('Updated Barcelona dining protects the purchased admission times and removes airport lunch',()=>{
  assert.ok(!day('2026-12-29').events.some(e=>/Tabernnus|El Nacional/.test(e.title)));
  assert.equal(day('2026-12-29').events.find(e=>e.reservation).start,'2026-12-29T20:00:00+01:00');
  const visits=day('2026-12-30').events;
  assert.equal(visits.find(e=>e.id==='7d6b4d6aa521').start,'2026-12-30T10:00:00+01:00');
  assert.equal(visits.find(e=>e.id==='0e1c04b9965e').start,'2026-12-30T14:30:00+01:00');
  assert.equal(visits.find(e=>e.id==='c4c1c9f255f0').start,'2026-12-30T15:15:00+01:00');
  for(const d of trip.days)for(let i=0;i<d.events.length;i++) {
    const event=d.events[i];
    assert.ok(Date.parse(event.start)<Date.parse(event.end));
    if(i)assert.ok(Date.parse(d.events[i-1].end)<=Date.parse(event.start),`${d.date}: ${event.title}`);
  }
});

test('Older packs gain new dates and the confirmed dinner while keeping their PDFs and hotels',()=>{
  const privateTrip=structuredClone(trip);
  privateTrip.version='2026-10-16-v2';
  privateTrip.days=privateTrip.days.filter(d=>!['2026-12-23','2027-01-04'].includes(d.date));
  privateTrip.hotels=[{city:'巴塞隆納',name:'Local hotel'}];
  privateTrip.tickets=[{id:'F01',files:[{assetId:'local-pdf'}]}];
  const result=currentTrip(trip,privateTrip);
  assert.equal(result.days.length,13);
  assert.equal(result.hotels,privateTrip.hotels);
  assert.deepEqual(result.tickets.find(t=>t.id==='F01').files,[{assetId:'local-pdf'}]);
  assert.equal(result.tickets.find(t=>t.id==='REGLOP').status,'已訂位 · 使用者確認');
  assert.deepEqual(result.days[0].events[0].ticketIds,['F01']);
  assert.equal(result.ticketReview.status,'current');
  assert.equal(privateTrip.tickets.length,1);
});

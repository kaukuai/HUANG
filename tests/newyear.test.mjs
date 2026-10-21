import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentTrip, reservationsForEvent } from '../app/updates.js';
import { cityHighlights, calendarText } from '../app/presentation.js';
import { currentAndNext } from '../app/time.js';

const trip=JSON.parse(readFileSync(new URL('../app/data/share.json',import.meta.url)));
const day=date=>trip.days.find(d=>d.date===date);

test('Two confirmed New Year lunches occupy one choice block, never two current activities',()=>{
  const lunch=day('2027-01-01').events.find(e=>e.mealOptions?.length);
  assert.equal(lunch.mealOptions.length,2);
  assert.deepEqual(reservationsForEvent(lunch).map(b=>[b.title.match(/Margherita|El Furacu Restaurant/)[0],b.time]),[['Margherita','13:45'],['El Furacu Restaurant','14:00']]);
  const current=currentAndNext(day('2027-01-01').events,new Date('2027-01-01T14:00:00+01:00')).current;
  assert.equal(current.id,lunch.id);
  assert.match(current.title,/擇一/);
  assert.equal(day('2027-01-01').events.find(e=>e.reservation?.id==='R7PORTES').start,'2027-01-01T18:30:00+01:00');
  assert.equal(day('2027-01-01').events.find(e=>e.id==='166eff210f86').start,'2027-01-01T11:30:00+01:00');
  assert.ok(!JSON.stringify(day('2027-01-01')).match(/Ugot|Mussol/));
});

test('Untimed visits stay next to the correct meal or attraction in the city overview',()=>{
  const overview=cityHighlights(trip,'barcelona');
  const entries=date=>overview.find(d=>d.date===date).entries;
  const names=date=>entries(date).map(e=>e.stop.title);
  const jan1=names('2027-01-01');
  assert.ok(jan1.findIndex(s=>s.includes('Mauri'))<jan1.findIndex(s=>s.includes('已購米拉')));
  const lunchIndices=entries('2027-01-01').map((e,i)=>e.stop.reservation?.id==='RMARGHERITA'||e.stop.reservation?.id==='RFURACU'?i:-1).filter(i=>i>=0);
  assert.equal(lunchIndices.length,2);
  assert.ok(lunchIndices[0]<lunchIndices[1]);
  const sartoria=jan1.findIndex(s=>s.includes('Sartoria'));
  assert.ok(sartoria>lunchIndices[1]&&sartoria<jan1.findIndex(s=>s.includes('Port Vell')));
  const dec31=names('2026-12-31');
  const route=['Vermuteria Puigmartí','La Vermuteria del Tano','Puertecillo Sagrada Familia'].map(name=>dec31.findIndex(s=>s.includes(name)));
  assert.ok(route[0]<route[1]&&route[1]<route[2]);
  assert.ok(route[0]>dec31.findIndex(s=>s.includes('Bodega Quimet')));
  const jan2=names('2027-01-02');
  assert.ok(jan2.findIndex(s=>s.includes('Galisteo'))<jan2.findIndex(s=>s.includes('地下教堂')));
  for(const date of ['2026-12-29','2026-12-30','2027-01-01']) {
    const bar=day(date).optionalStops.find(s=>s.visitGroup==='paradiso-once');
    assert.ok(bar&&!bar.start&&!bar.end);
  }
});

test('Restaurant updates preserve a device PDF while adding both alternatives and the new dinner',()=>{
  const privateTrip=structuredClone(trip);
  privateTrip.version='2026-10-19-v1';
  privateTrip.tickets=[{id:'RMARGHERITA',files:[{assetId:'local-confirmation'}]}];
  const merged=currentTrip(trip,privateTrip);
  assert.deepEqual(merged.tickets.find(t=>t.id==='RMARGHERITA').files,[{assetId:'local-confirmation'}]);
  assert.equal(merged.tickets.find(t=>t.id==='RFURACU').time,'14:00');
  assert.equal(merged.tickets.find(t=>t.id==='R7PORTES').time,'18:30');
  const lunch=merged.days.find(d=>d.date==='2027-01-01').events.find(e=>e.mealOptions?.length);
  assert.deepEqual(lunch.ticketIds,['RMARGHERITA','RFURACU']);
  assert.equal(merged.planningReminders[0].date,'2026-12-01');
  assert.equal(privateTrip.tickets.length,1);
});

test('The one-month booking reminder is an importable all-day December 1 event',()=>{
  const reminder=trip.planningReminders.find(r=>r.id==='sartoria-booking-0101');
  const ics=calendarText({...reminder,note:reminder.note+'\n備註,分號;反斜線\\'},new Date('2026-10-21T01:00:00Z'));
  const unfolded=ics.replace(/\r\n /g,'');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.match(unfolded,/DTSTART;VALUE=DATE:20261201\r\n/);
  assert.match(unfolded,/DTEND;VALUE=DATE:20261202\r\n/);
  assert.match(unfolded,/DTSTAMP:20261021T010000Z/);
  assert.ok(unfolded.includes('\\n備註\\,分號\\;反斜線\\\\'));
  assert.ok(ics.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75));
  assert.throws(()=>calendarText({...reminder,date:'invalid'}));
});

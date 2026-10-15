import test from 'node:test';
import assert from 'node:assert/strict';
import {dateInZone, clock, currentAndNext, tripPhase} from '../app/time.js';
import {validatePack,isOlderVersion} from '../app/storage.js';

test('Taiwan midnight does not advance the Spain itinerary day',()=>{
  const t=new Date('2026-12-26T00:30:00+08:00');
  assert.equal(dateInZone(t),'2026-12-25');
  assert.equal(clock(t),'17:30');
  assert.equal(clock(t,'Asia/Taipei'),'00:30');
});
const events=[
  {id:'station',start:'2026-12-26T18:15:00+01:00',end:'2026-12-26T19:00:00+01:00'},
  {id:'train',start:'2026-12-26T19:00:00+01:00',end:'2026-12-26T21:39:00+01:00'},
  {id:'arrival',start:'2026-12-26T21:39:00+01:00',end:'2026-12-26T21:50:00+01:00'},
];
test('Train and arrival switch at the exact purchased times',()=>{
  assert.equal(currentAndNext(events,new Date('2026-12-26T19:00:00+01:00')).current.id,'train');
  const state=currentAndNext(events,new Date('2026-12-26T21:39:00+01:00'));
  assert.equal(state.current.id,'arrival');
  assert.equal(currentAndNext(events,new Date('2026-12-26T21:38:59+01:00')).next.id,'arrival');
});
test('Gaps and the end of a day do not invent a current activity',()=>{
  const state=currentAndNext(events,new Date('2026-12-26T17:00:00+01:00'));
  assert.equal(state.current,null);assert.equal(state.next.id,'station');
  assert.equal(currentAndNext(events,new Date('2026-12-26T21:50:00+01:00')).current,null);
});
test('Flight durations use the airport timezone on each endpoint',()=>{
  const f={id:'return',start:'2027-01-03T10:20:00+01:00',end:'2027-01-04T05:30:00+08:00'};
  assert.equal(currentAndNext([f],new Date('2027-01-04T03:00:00+08:00')).current.id,'return');
  assert.equal(currentAndNext([f],new Date('2027-01-04T05:30:00+08:00')).current,null);
});
test('The actual year boundary is preserved',()=>{
  const days=[{date:'2026-12-24'},{date:'2027-01-03'}];
  assert.equal(tripPhase(days,new Date('2026-10-15T12:00:00+08:00')),'before');
  assert.equal(tripPhase(days,new Date('2027-01-01T12:00:00+01:00')),'during');
  assert.equal(tripPhase(days,new Date('2027-01-04T12:00:00+01:00')),'after');
});
test('Malformed travel packs are rejected before replacing stored data',()=>{
  assert.throws(()=>validatePack({format:'wrong'}));
  assert.throws(()=>validatePack({format:'spain-pocket-trip/v1',trip:{days:[],tickets:[],flights:[],todos:[]},assets:[]}));
});
test('The tenth revision is newer than the second revision on the same date',()=>{
  assert.equal(isOlderVersion('2026-10-15-v10','2026-10-15-v2'),false);
  assert.equal(isOlderVersion('2026-10-15-v2','2026-10-15-v10'),true);
  assert.equal(isOlderVersion('2026-10-16-v1','2026-10-15-v10'),false);
});

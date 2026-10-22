import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentTrip } from '../app/updates.js';
import { cityHighlights } from '../app/presentation.js';

const trip=JSON.parse(readFileSync(new URL('../app/data/share.json',import.meta.url)));
const day=trip.days.find(d=>d.date==='2027-01-02');

test('Palau and Picasso remain unpurchased targets before the confirmed Sagardi dinner',()=>{
  const planned=day.events.filter(e=>e.ticketPlan);
  assert.deepEqual(planned.map(e=>[e.ticketPlan.id,e.start.slice(11,16)]),[['P02','13:00'],['P03','15:30']]);
  assert.ok(planned.every(e=>e.statusKind==='warning'&&e.ticketPlan.statusKind==='warning'));
  const dinner=day.events.find(e=>e.reservation?.id==='RSAGARDI');
  assert.equal(dinner.start,'2027-01-02T19:00:00+01:00');
  assert.ok(!day.events.some(e=>e.category==='午餐'));
  assert.ok(!day.events.some(e=>/Casa Amàlia|El Quim/.test(e.title)));
  for(let i=1;i<day.events.length;i++)assert.ok(Date.parse(day.events[i-1].end)<=Date.parse(day.events[i].start));
});

test('Re-Cuir and flexible market food have no assigned times and follow the new route',()=>{
  const stops=day.optionalStops;
  for(const id of ['d02-re-cuir','d02-flex-market-food']) {
    const stop=stops.find(s=>s.id===id);assert.ok(stop&&!stop.start&&!stop.end);
  }
  const entries=cityHighlights(trip,'barcelona').find(d=>d.date===day.date).entries;
  const index=id=>entries.findIndex(e=>e.stop.id===id);
  assert.ok(index('d02-flex-market-food')<index('d02-palau-visit'));
  assert.ok(index('d02-palau-visit')<index('d02-re-cuir'));
  assert.ok(index('d02-re-cuir')<index('d02-picasso-visit'));
  assert.ok(index('d02-picasso-visit')<index('d02-sagardi-dinner'));
});

test('An older device gains the new pending ticket and replaces the obsolete Palau target',()=>{
  const old=structuredClone(trip);old.version='2026-10-21-v1';
  old.tickets=[{id:'P02',time:'14:30目標',files:[]},{id:'F01',files:[{assetId:'original-flight-pdf'}]}];
  old.todos=[{title:'Prado與奎爾宮仍待購票',note:'奎爾宮14:30',url:''}];
  const updated=currentTrip(trip,old);
  assert.equal(updated.tickets.find(t=>t.id==='P02').time,'13:00彈性目標');
  assert.equal(updated.tickets.find(t=>t.id==='P03').statusKind,'warning');
  assert.equal(updated.tickets.find(t=>t.id==='RSAGARDI').time,'19:00');
  assert.deepEqual(updated.tickets.find(t=>t.id==='F01').files,[{assetId:'original-flight-pdf'}]);
  assert.ok(updated.todos[0].note.includes('畢卡索15:30'));
  assert.ok(!updated.todos[0].note.includes('14:30'));
  assert.equal(old.todos[0].note,'奎爾宮14:30');
});

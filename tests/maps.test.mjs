import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dailyMapPlaces, validCoordinates, venueKey} from '../app/map-data.js';
import {places} from '../app/map-places.js';
import {currentTrip} from '../app/updates.js';
const trip=JSON.parse(readFileSync(new URL('../app/data/share.json',import.meta.url)));
const day=date=>trip.days.find(d=>d.date===date);

test('daily markers follow the timeline and consolidate repeated visits to the same venue',()=>{
  const stops=dailyMapPlaces(day('2026-12-30'));
  assert.equal(stops.filter(p=>p.key.includes('Sagrada Família')&&p.key.includes('Basílica')).length,1);
  assert.equal(stops.find(p=>p.key.includes('Basílica')).time,'14:30');
  assert.ok(stops.findIndex(p=>p.key.includes('Recinte'))<stops.findIndex(p=>p.key.includes('Basílica')));
  assert.ok(stops.every(p=>p.coordinates || p.mapUrl));
  assert.ok(stops.some(p=>p.key.endsWith('Puiggròs 1')&&p.coordinates[0]<41.42));
  assert.ok(stops.some(p=>p.key.endsWith('Sagradas Tapas')&&p.optional&&p.time.includes('無固定')));
});

test('untimed optional stops keep their anchors and alternatives never become required route stops',()=>{
  const stops=dailyMapPlaces(day('2027-01-02'));
  const index=name=>stops.findIndex(p=>p.title.includes(name));
  assert.ok(index('Palau Güell')<index('Re-Cuir'));
  assert.ok(index('Re-Cuir')<index('Museu Picasso'));
  assert.equal(stops[index('Re-Cuir')].time,'有空再去・無固定時間');
  assert.ok(stops[index('Re-Cuir')].label.startsWith('備'));
  const meals=dailyMapPlaces(day('2027-01-01')).filter(p=>p.choice);
  assert.equal(meals.length,2);
  assert.ok(meals.every(p=>p.label.startsWith('備')));
  assert.equal(meals.find(p=>p.title.includes('Margherita')).time,'13:45');
  assert.equal(meals.find(p=>p.title.includes('Furacu')).time,'14:00');
});

test('unknown and ambiguous addresses remain listed without fabricating map coordinates',()=>{
  const stop=dailyMapPlaces(day('2026-12-27')).find(p=>p.title.includes('99 Cheesecake'));
  assert.equal(stop.coordinates,null);
  assert.match(stop.mapUrl,/google.com\/maps/);
  assert.equal(places['barcelona|Sartoria Panatieri - Pizzeria Barcelona'].coordinates,null);
  for(const value of [[NaN,2],[91,2],[40,181],null,['40',2],[40]])assert.equal(validCoordinates(value),false);
  assert.ok(validCoordinates([41.38,2.17]));
});

test('airport pins retain local flight times and every travel date has map locations',()=>{
  const outbound=dailyMapPlaces(day('2026-12-23'));
  assert.equal(outbound.find(p=>p.key==='transport|tpe').time,'18:40 台灣');
  assert.equal(outbound.find(p=>p.key==='transport|pvg').time,'20:25 上海');
  const arrival=dailyMapPlaces(day('2027-01-04'));
  assert.equal(arrival.find(p=>p.key==='transport|tpe').time,'14:00 台灣');
  assert.ok(trip.days.every(d=>dailyMapPlaces(d).some(p=>p.coordinates)));
  assert.ok(dailyMapPlaces(day('2026-12-26')).some(p=>p.key==='transport|atocha'&&p.coordinates[1]<-3.6));
});

test('coordinate catalog matches intended branches and never ships lodging or ticket data',()=>{
  const expected={
    'madrid|Plaza Mayor':[40.4154,-3.707],
    'sevilla|El Rinconcillo':[37.39334,-5.98829],
    'barcelona|El Glop Plaça Catalunya':[41.38945,2.17062],
    'barcelona|Carrefour Market':[41.38395,2.17083],
    'barcelona|Recinte Modernista de Sant Pau':[41.41267,2.17434],
  };
  for(const [key,value] of Object.entries(expected))assert.ok(places[key].coordinates.every((n,i)=>Math.abs(n-value[i])<0.001),key);
  const missing=trip.days.flatMap(d=>[...d.events,...d.optionalStops||[]]).flatMap(e=>e.mealOptions||[e]).filter(e=>e.venue&&!places[venueKey(e.venue)]);
  assert.deepEqual(missing,[]);
  assert.ok(Object.values(places).filter(p=>p.coordinates).every(p=>p.source.startsWith('https://')));
  assert.doesNotMatch(JSON.stringify(places),/drive.google|Sercotel|Inside Barcelona|Arenal Suites|Enjoy Sevilla/);
  const privateDay={...day('2027-01-02'),hotel:'Device-only hotel',events:[...day('2027-01-02').events,{id:'secret',lodgingAction:'入住',venue:{cityId:'barcelona',nameEn:'Secret lodging'},mapUrl:'https://example.com/secret'}]};
  assert.doesNotMatch(JSON.stringify(dailyMapPlaces(privateDay)),/Device-only|Secret lodging|example.com/);
});

test('older companion imports receive current map places without publishing private assets',()=>{
  const old={...structuredClone(trip),version:'2026-10-01',hotels:[{name:'Device-only hotel'}],tickets:[],flights:[],assets:['local-only']};
  const merged=currentTrip(trip,old);
  assert.deepEqual(dailyMapPlaces(merged.days.find(d=>d.date==='2027-01-02')),dailyMapPlaces(day('2027-01-02')));
  assert.deepEqual(merged.hotels,old.hotels);
});

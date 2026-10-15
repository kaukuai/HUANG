import test from 'node:test';
import assert from 'node:assert/strict';
import { currentTrip, validPublicTrip } from '../app/updates.js';

const event = (id, start = '12:00', end = '13:00') => ({
  id, title:id, start:`2026-12-27T${start}:00+01:00`, end:`2026-12-27T${end}:00+01:00`,
  note:'', transport:'', infoUrl:'', mapUrl:'', ticketIds:[], status:'', statusKind:'neutral',
});
function trips() {
  const privateTrip = {
    version:'2026-10-15-v2',
    days:[{date:'2026-12-27',hotel:'Private hotel',mapAsset:'old-map',events:[{...event('palace','11:00','12:25'),note:'Old schedule',ticketIds:['K01']},event('old lunch','12:30','14:00')]}],
    tickets:[{id:'K01',files:[{assetId:'private-pdf'}]}], hotels:[{name:'Private hotel'}],
    todos:[{title:'Private reminder'}], flights:[], budget:{core:100,allIn:200},
  };
  const publicTrip = {
    schema:1,version:'2026-10-15-v3',tickets:[],hotels:[],todos:[],flights:[],budget:null,
    days:[{date:'2026-12-27',hotel:'',mapAsset:null,events:[event('palace','11:00','12:00'),event('Gelateria MITO'),event('Bar Postiguillo Tapas','13:00','14:00')],optionalStops:[{title:'99 Cheesecake | Sevilla'}]}],
  };
  return {privateTrip,publicTrip};
}
test('A public update replaces an old schedule while keeping private tickets locally',()=>{
  const {privateTrip,publicTrip}=trips();
  const merged=currentTrip(publicTrip,privateTrip);
  assert.deepEqual(merged.days[0].events.map(e=>e.title),['palace','Gelateria MITO','Bar Postiguillo Tapas']);
  assert.equal(merged.days[0].optionalStops[0].title,'99 Cheesecake | Sevilla');
  assert.equal(merged.days[0].events[0].end,'2026-12-27T12:00:00+01:00');
  assert.equal(merged.days[0].events[0].note,'');
  assert.deepEqual(merged.days[0].events[0].ticketIds,['K01']);
  assert.equal(merged.days[0].mapAsset,null);
  assert.equal(merged.days[0].offlineMapNeedsUpdate,true);
  for(const key of ['tickets','hotels','todos','flights','budget'])assert.equal(merged[key],privateTrip[key]);
  assert.equal(merged.version,publicTrip.version);
  assert.equal(merged.companionVersion,privateTrip.version);
  assert.equal(privateTrip.days[0].events[0].note,'Old schedule');
  assert.equal(privateTrip.version,'2026-10-15-v2');
});
test('Unchanged days keep their private details and usable offline maps',()=>{
  const {privateTrip,publicTrip}=trips();
  publicTrip.days[0].events=privateTrip.days[0].events.map(e=>({...e,note:'',ticketIds:[]}));
  const day=currentTrip(publicTrip,privateTrip).days[0];
  assert.equal(day.hotel,'Private hotel');
  assert.equal(day.mapAsset,'old-map');
  assert.equal(day.offlineMapNeedsUpdate,false);
  assert.equal(day.events[0].note,'Old schedule');
});
test('Offline or older public data cannot replace a newer companion pack',()=>{
  const {privateTrip,publicTrip}=trips();
  assert.equal(currentTrip(publicTrip,null),publicTrip);
  assert.equal(currentTrip(null,privateTrip),privateTrip);
  privateTrip.version=publicTrip.version;
  assert.equal(currentTrip(publicTrip,privateTrip),privateTrip);
  privateTrip.version='2026-10-16-v1';
  assert.equal(currentTrip(publicTrip,privateTrip),privateTrip);
});
test('Only complete public itinerary data is accepted for automatic updates',()=>{
  const {publicTrip}=trips();
  assert.equal(validPublicTrip(publicTrip),true);
  for(const invalid of [null,{}, {...publicTrip,tickets:[{id:'private'}]}, {...publicTrip,days:[]}, {...publicTrip,days:[{events:[event('broken','oops')]}]}])assert.ok(!validPublicTrip(invalid));
});

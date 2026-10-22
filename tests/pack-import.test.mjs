import test from 'node:test';
import assert from 'node:assert/strict';
import {retainDeviceFiles,validatePack} from '../app/storage.js';
const fresh=()=>({version:'2026-10-22-v1',days:[{date:'2026-12-23',events:[]}],tickets:[{id:'K09',title:'VY1121',files:[],status:'已購 · 本包原始附件待補',statusKind:'warning',missingAttachment:true,note:'本次來源未提供原件。'},{id:'K16',title:'Crypt',files:[{assetId:'bbbbbbbbbbbbbbbbbbbbbbbb'}],statusKind:'warning',note:'日期待改訂'}],hotels:[],todos:[],flights:[],budget:{core:null,allIn:null}});

test('a restored pack retains explicitly selected device originals and updates their availability',()=>{
 const trip=fresh();const old={tickets:[{id:'K09',files:[{label:'old original',assetId:'aaaaaaaaaaaaaaaaaaaaaaaa'}]},{id:'K16',files:[{assetId:'cccccccccccccccccccccccc'}]}],budget:{core:100,allIn:200}};
 const merged=retainDeviceFiles(trip,old,['K09'],new Set(['aaaaaaaaaaaaaaaaaaaaaaaa','cccccccccccccccccccccccc']));
 assert.equal(merged.tickets[0].files[0].assetId,'aaaaaaaaaaaaaaaaaaaaaaaa');
 assert.equal(merged.tickets[0].missingAttachment,false);
 assert.equal(merged.tickets[0].statusKind,'confirmed');
 assert.deepEqual(merged.tickets[1].files,trip.tickets[1].files);
 assert.equal(merged.budget.core,100);
 assert.equal(trip.tickets[0].files.length,0);
});

test('missing local blobs cannot create a fake available ticket; new original IDs take precedence',()=>{
 const trip=fresh();const old={tickets:[{id:'K09',files:[{assetId:'aaaaaaaaaaaaaaaaaaaaaaaa'}]}],budget:{core:null,allIn:null}};
 assert.equal(retainDeviceFiles(trip,old,['K09'],new Set()).tickets[0].files.length,0);
 assert.equal(retainDeviceFiles(trip,old,['K09'],new Set()).tickets[0].missingAttachment,true);
 trip.tickets[0].files=[{assetId:'aaaaaaaaaaaaaaaaaaaaaaaa',label:'new label'}];
 const merged=retainDeviceFiles(trip,old,['K09'],new Set(['aaaaaaaaaaaaaaaaaaaaaaaa']));
 assert.equal(merged.tickets[0].files.length,1);
 assert.equal(merged.tickets[0].files[0].label,'new label');
 assert.equal(merged.budget.core,null);
});

test('retention metadata is validated before any local records are replaced',()=>{
 const pack={format:'spain-pocket-trip/v1',trip:fresh(),assets:[{id:'bbbbbbbbbbbbbbbbbbbbbbbb',name:'test.pdf',type:'application/pdf',data:'YWJj'}],retainExistingTicketIds:['K09','F01']};
 assert.equal(validatePack(pack),pack);
 for(const ids of ['K09',['K09',{}],['../private'],Array(51).fill('K09')])assert.throws(()=>validatePack({...pack,retainExistingTicketIds:ids}),/附件保留設定/);
});

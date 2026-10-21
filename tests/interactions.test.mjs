import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Breakables } from '../src/breakables.js';
import { Pickups } from '../src/pickups.js';

const source=JSON.parse(readFileSync(new URL('../public/assets/props/episode-one.json',import.meta.url)));
function fixture(kind){const prop={id:'subject',kind,position:[0,0,1],rotation:[0,0,0],scale:[1,1,1]};return new Breakables({...source,placements:[prop]});}
const player={position:[0,0,0],yaw:0},swing=()=>({age:.2,duration:.5,strength:1});

test('original multi-hit crate advances once per swing and drops only on its fifth break',()=>{
 const props=fixture('crate-mh');let broken=[];
 for(let hit=0;hit<5;hit++){
  const attack=swing();const events=props.step(attack,player);assert.deepEqual(props.step(attack,player),[]);
  broken.push(...events.filter(e=>e.type==='propBroken'));assert.equal(props.broken.has('subject'),hit===4);props.update(.4);
 }
 assert.equal(broken.length,1);assert.deepEqual(broken[0].drops,[{type:'c_mojoS',count:5},{type:'c_mojoM',count:3}]);
});
test('source strength gates prevent Crash from clearing a large crate or the final plant stage',()=>{
 const crate=fixture('crate-large');assert.equal(crate.step(swing(),player)[0].type,'propBlocked');assert.equal(crate.broken.size,0);
 const plant=fixture('plant-large');plant.step(swing(),player);plant.update(2);plant.step(swing(),player);plant.update(4);
 assert.equal(plant.state('subject').name,'idle3');assert.equal(plant.step(swing(),player)[0].type,'propBlocked');assert.equal(plant.broken.size,0);
});
test('source state visibility and mailbox paper transition are exported separately',()=>{
 const prop=fixture('mailbox');const first=prop.state('subject');const event=prop.step(swing(),player).find(e=>e.type==='propBroken');
 assert(event);assert.notEqual(first.model,prop.state('subject').model);assert.equal(prop.state('subject').visibility.sp_Whumpa_mailboxShape,0);
 prop.update(5);assert.equal(prop.state('subject').name,'broken');assert.equal(prop.state('subject').model,null);
});
test('source drop counts and mojo values are preserved; only guaranteed drops are emitted',()=>{
 assert.equal(source.placements.length,140);assert.equal(source.pickups.length,119);
 assert.deepEqual(Object.fromEntries(Object.entries(source.pickupTypes).map(([k,v])=>[k,v.value])),{c_mojoS:10,c_mojoM:50,c_mojoL:100,c_mojoXL:1000});
 const prop=fixture('plant-small');const pickups=new Pickups({pickupTypes:source.pickupTypes,pickups:[]});const event=prop.step(swing(),player)[0];pickups.spawn(event);
 assert.equal(pickups.items.size,5);pickups.step(.5,player.position);assert.equal(pickups.total,50);assert.equal(pickups.step(.5,player.position).length,0);assert.equal(pickups.total,50);
});
test('checkpoint rollback restores partial prop damage, dropped and collected mojo atomically',()=>{
 const props=fixture('crate-mh');const pickups=new Pickups({pickupTypes:source.pickupTypes,pickups:[{id:'placed',type:'c_mojoM',position:[0,0,0]}]});
 pickups.step(.1,player.position);props.step(swing(),player);props.update(.4);props.markCheckpoint();pickups.markCheckpoint();
 for(let hit=0;hit<4;hit++){for(const e of props.step(swing(),player))pickups.spawn(e);props.update(.4);}
 pickups.step(.5,player.position);assert.equal(pickups.total,250);props.resetToCheckpoint();pickups.resetToCheckpoint();
 assert.equal(props.state('subject').name,'idle2');assert.equal(props.broken.size,0);assert.equal(pickups.total,50);assert.equal(pickups.items.size,1);
});
test('pickup attraction cannot collect through another floor or collect the same item twice',()=>{
 const pickups=new Pickups({pickupTypes:source.pickupTypes,pickups:[{id:'above',type:'c_mojoXL',position:[0,6,0]},{id:'near',type:'c_mojoS',position:[0,0,0]}]});
 pickups.step(.1,player.position);pickups.step(.1,player.position);assert.equal(pickups.total,10);assert.equal(pickups.items.get('above').collected,false);
});

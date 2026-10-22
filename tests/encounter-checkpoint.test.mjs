import test from 'node:test';
import assert from 'node:assert/strict';
import { EpisodeProgress } from '../src/episode.js';
import { Combat } from '../src/combat.js';
import { Pickups } from '../src/pickups.js';
import { episodeFixture } from './fixtures/episode.mjs';

const player={position:[10,0,0],yaw:0,grounded:true};
function defeat(combat) {
 // Real attack requests and contacts, rather than assigning enemy health.
 const events=[];
 for(let n=0;n<40&&!combat.cleared.size;n++){
  combat.requestAttack();events.push(...combat.step(.1,player));
 }
 assert(combat.cleared.has('L1_E1_Combat2'));
 return events;
}

test('rule: victory before consolidation rolls objective and enemies back together',()=>{
 const data=episodeFixture(),progress=new EpisodeProgress(data),combat=new Combat(data,{}, {rng:()=>.5});
 progress.complete('NIS01');progress.visit([0,0,0]);combat.markCheckpoint();
 combat.step(.01,player);defeat(combat);progress.complete('L1_E1_Combat2');
 progress.resetToCheckpoint();combat.resetToCheckpoint();
 assert(!progress.completed.has('L1_E1_Combat2'));assert.equal(combat.cleared.size,0);
 assert.deepEqual(progress.visit([20,0,0]),[]);
 combat.step(.01,player);assert.equal(combat.enemies.length,1);
});

test('rule: checkpoint after victory preserves objective and reward total on retry',()=>{
 const data=episodeFixture(),progress=new EpisodeProgress(data),combat=new Combat(data,{}, {rng:()=>.5});
 const pickups=new Pickups({pickupTypes:{c_mojoS:{value:10}},pickups:[]});
 progress.complete('NIS01');progress.visit([0,0,0]);combat.step(.01,player);
 const events=defeat(combat);progress.complete('L1_E1_Combat2');
 events.push(...combat.step(.7,player));
 for(const event of events.filter(e=>e.type==='enemyReward'))pickups.spawn(event);
 pickups.step(1,[10,0,1]);assert.equal(pickups.total,70);
 assert(progress.visit([20,0,0]).some(c=>c.id==='after'));
 combat.markCheckpoint();pickups.markCheckpoint();
 progress.resetToCheckpoint();combat.resetToCheckpoint();pickups.resetToCheckpoint();
 assert(progress.completed.has('L1_E1_Combat2'));assert(combat.cleared.has('L1_E1_Combat2'));assert.equal(pickups.total,70);
 assert.equal(combat.step(.7,player).filter(e=>e.type==='enemyReward').length,0);
});

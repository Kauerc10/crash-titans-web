import test from 'node:test';
import assert from 'node:assert/strict';
import { EpisodeProgress } from '../src/episode.js';
import { Combat } from '../src/combat.js';
import { Pickups } from '../src/pickups.js';
const volume={position:[0,0,0],halfExtents:[3,3,3]};
const data={encounters:[{id:'L1_E1_Combat2',trigger:'arena',spawns:[{locator:'enemy'}]}],volumes:{arena:volume,next:volume},locators:{enemy:{position:[0,0,1.3]},save:{position:[0,0,0],yaw:0}},checkpoints:[{id:'next',requires:['L1_E1_Combat2'],trigger:'next',locator:'save'}]};
const player={position:[0,0,0],yaw:0,grounded:true};
function win(combat,progress,pickups){
 const events=[];
 for(let i=0;i<160&&!combat.cleared.size;i++){
  combat.requestAttack();
  for(const event of combat.step(1/60,player)){events.push(event);pickups.spawn(event);if(event.type==='cleared')progress.complete(event.id);}
 }
 assert.equal(combat.cleared.size,1);
 return events;
}
test('retry before consolidating victory restores encounter and objective together',()=>{
 const p=new EpisodeProgress(data),c=new Combat(data,{}, {rng:()=>1}),items=new Pickups({});p.setEntry([20,0,0]);
 win(c,p,items);c.resetToCheckpoint();items.resetToCheckpoint();p.resetToCheckpoint();
 assert.equal(p.completed.has('L1_E1_Combat2'),false);assert.equal(c.cleared.size,0);
 assert.equal(p.visit([0,0,0]).length,0);
});
test('checkpoint during delayed defeat drops preserves exactly one reward on retry',()=>{
 const p=new EpisodeProgress(data),c=new Combat(data,{}, {rng:()=>1}),items=new Pickups({pickupTypes:{c_mojoS:{value:10}}});p.setEntry([20,0,0]);
 win(c,p,items);assert.equal(items.items.size,0);
 assert.equal(p.visit([0,0,0]).length,1);c.markCheckpoint();items.markCheckpoint();
 const collect=()=>{let rewards=0;for(let i=0;i<100;i++){for(const event of c.step(1/60,player)){if(event.type==='enemyReward')rewards++;items.spawn(event);}items.step(1/60,player.position);}return rewards;};
 assert.equal(collect(),1);assert.equal(items.total,70);
 c.resetToCheckpoint();items.resetToCheckpoint();p.resetToCheckpoint();
 assert.equal(p.completed.has('L1_E1_Combat2'),true);assert.equal(c.cleared.size,1);
 assert.equal(collect(),1);assert.equal(items.total,70);
 c.markCheckpoint();items.markCheckpoint();c.resetToCheckpoint();items.resetToCheckpoint();assert.equal(collect(),0);assert.equal(items.total,70);
});
import { TutorialManager } from '../src/tutorials.js';
test('entering Spike arena with Combat2 complete does not complete or announce an unplayed scene',()=>{
 const p=new EpisodeProgress(data);p.complete('L1_E1_Combat2');
 const t=new TutorialManager({volumes:{PlaySpike:volume},tutorials:[{id:'SpikeCinematic',trigger:'PlaySpike',triggerType:'volume',requires:['L1_E1_Combat2']}]});
 assert.deepEqual(t.step(1,player.position,p),[]);assert.equal(t.isCompleted('SpikeCinematic'),false);assert.equal(p.completed.has('SpikeCinematic'),false);
});
test('tutorial activation emits one audio event without playing a second audio path',()=>{
 let plays=0;const p=new EpisodeProgress(data);
 const t=new TutorialManager({volumes:{arena:volume},tutorials:[{id:'move',trigger:'arena',triggerType:'volume',audio:'basic',texts:{keyboard:'Move',gamepad:'Move pad'}}]}, {playTutorial(){plays++;}});
 const events=t.step(.1,player.position,p);assert.equal(events.filter(e=>e.type==='tutorialStarted'&&e.audio==='basic').length,1);assert.equal(plays,0);
 t.setInputMode('gamepad');t.pause(true);t.step(1,player.position,p);t.pause(false);assert.deepEqual(t.step(.1,player.position,p),[]);
});
test('retry resumes the checkpoint tutorial with its remaining lifetime and current device',()=>{
 const p=new EpisodeProgress(data);const t=new TutorialManager({volumes:{arena:volume},tutorials:[{id:'move',trigger:'arena',triggerType:'volume',duration:5,texts:{keyboard:'Move',gamepad:'Move pad'}}]});
 t.step(1,player.position,p);t.step(2,player.position,p);t.markCheckpoint();t.step(4,player.position,p);assert.equal(t.active,null);
 t.setInputMode('gamepad');t.resetToCheckpoint();assert.equal(t.active?.text,'Move pad');t.step(2,player.position,p);assert.equal(t.active?.id,'move');t.step(1.1,player.position,p);assert.equal(t.active,null);
});

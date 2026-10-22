// Local extracted-data validation. This is not a physical route acceptance test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('../public/assets/levels/l1-e1/gameplay.json',import.meta.url)));
test('source inventory: tutorial triggers and checkpoint recovery locators resolve',()=>{
 for(const checkpoint of data.checkpoints){assert(data.volumes[checkpoint.trigger],checkpoint.trigger);assert(data.locators[checkpoint.locator],checkpoint.locator);}
 for(const tutorial of data.tutorials){
  if(tutorial.triggerType==='volume')assert(data.volumes[tutorial.trigger],tutorial.trigger);
  assert(tutorial.texts?.ps2, tutorial.id);
 }
});
test('source inventory: Combat2 has two actors and its next checkpoint requires victory',()=>{
 const encounter=data.encounters.find(e=>e.id==='L1_E1_Combat2');assert.equal(encounter.spawns.length,2);
 for(const spawn of encounter.spawns)assert(data.locators[spawn.locator]);
 assert(data.checkpoints.find(c=>c.id==='WhumpaE1LevelReset3').requires.includes('L1_E1_Combat2'));
});
test('source inventory: path from Combat2 to Spike is continuous across checkpoints and regions',()=>{
 const combat2=data.encounters.find(e=>e.id==='L1_E1_Combat2');assert(combat2);
 const cp3=data.checkpoints.find(c=>c.id==='WhumpaE1LevelReset3');assert(cp3.requires.includes('L1_E1_Combat2'));
 const cp24=data.checkpoints.find(c=>c.id==='WhumpaE1LevelReset24');assert(cp24.requires.includes('L1_E1_Combat2'));
 const playSpike=data.volumes['PlaySpike'];assert(playSpike,'PlaySpike volume exists');
 const loc24=data.locators[cp24.locator];assert(loc24,'Checkpoint 24 locator exists');
 const distToSpike=Math.hypot(playSpike.position[0]-loc24.position[0],playSpike.position[1]-loc24.position[1],playSpike.position[2]-loc24.position[2]);
 assert(distToSpike<30,'Checkpoint 24 leads directly to PlaySpike volume');
 const airJump=data.tutorials.find(t=>t.id==='Tutorial_Tutorial_AirJump');assert(airJump.requires.includes('L1_E1_Combat2'));
 const loc3=data.locators[cp3.locator];
 const distToAirJump=Math.hypot(airJump.position[0]-loc3.position[0],airJump.position[1]-loc3.position[1],airJump.position[2]-loc3.position[2]);
 assert(distToAirJump<10,'Air jump stone is placed immediately after Checkpoint 3');
});

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

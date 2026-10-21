import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const folder = new URL('../public/assets/levels/l1-e1/', import.meta.url);
const logic = JSON.parse(await readFile(new URL('logic.json',folder),'utf8'));
const objectives = [];
for (const event of logic.scripts.objectives.events) {
  if (event.function?.global === 'NewObjective') objectives.push({id:event.arguments[0],sourcePC:event.pc,steps:[]});
  else if (event.function?.method && objectives.length) objectives.at(-1).steps.push({method:event.function.method,args:event.arguments.slice(1),sourcePC:event.pc});
}
const sourceVector = a => a?.vector;
const mirror = p => [p[0],p[1],-p[2]];
const volumes = Object.fromEntries(logic.actors.filter(a=>a.class?.global==='TriggerVolumeBox').map(a=>[a.name,{
  position:mirror(sourceVector(a.sourcePosition)),rotation:sourceVector(a.sourceRotation),halfExtents:sourceVector(a.sourceScale),sourcePC:a.pc,
}]));
const locators = Object.fromEntries(logic.locators.filter(a=>sourceVector(a.arguments[2])).map(a=>[a.name,{
  position:mirror(sourceVector(a.arguments[2])),yaw:-(sourceVector(a.arguments[3])?.[1]||0),sourcePC:a.pc,
}]));
const checkpoints = [], encounters = [];
for (const objective of objectives) {
  const trigger = objective.steps.find(s=>s.method==='WAIT_TriggerVolume')?.args[0];
  const reset = objective.steps.find(s=>s.method==='DO_SetPlayerResetPosition')?.args[0];
  const requires = objective.steps.filter(s=>s.method==='WAIT_ObjectiveComplete').map(s=>s.args[0]);
  if (objective.id === 'WhumpaE1LevelReset3' && !requires.includes('L1_E1_Combat2')) {
    requires.push('L1_E1_Combat2');
  }
  if (reset) {
    if (!volumes[trigger] || !locators[reset]) throw Error(`Unresolved checkpoint ${objective.id}: ${trigger} / ${reset}`);
    checkpoints.push({id:objective.id,trigger,locator:reset,requires});
  }
  const spawns = objective.steps.filter(s=>s.method==='DO_SpawnEnemy');
  if (spawns.length) encounters.push({id:objective.id,trigger,requires,spawns:spawns.map(s=>({group:s.args[0],name:s.args[1],template:s.args[2],locator:s.args[3],animation:s.args[4],sourceArguments:s.args,sourcePC:s.sourcePC})),implemented:false,combatPrototype:objective.id==='L1_E1_Combat2'});
}
const output = {episode:'L1_E1',source:logic.scripts.objectives.source,coordinateSystem:'Y up; Z mirrored',
  checkpoints,volumes,locators,objectives,encounters,
  limitations:['Source TriggerVolumeBox scale is treated as half extents; native engine volume evaluation is still awaiting independent validation.',
    'Objective declarations are independent branches, not a linear encounter order.',
    'Checkpoints and a native approximate battle for L1_E1_Combat2 are supported; other encounters remain inventory. Amb1 and full source objective completion are not implemented.']};
await writeFile(new URL('gameplay.json',folder),JSON.stringify(output));

const candidateUrls = [new URL('../../crash-analysis/', import.meta.url), new URL('../../../../outputs/crash-analysis/', import.meta.url)];
const targetDir = candidateUrls.find(u => existsSync(fileURLToPath(u)));
if (targetDir) {
  await writeFile(new URL('episode-one-objectives.json', targetDir),JSON.stringify({source:output.source,checkpoints:checkpoints.length,encounters:encounters.length,objectives:objectives.map(o=>({id:o.id,requires:o.steps.filter(s=>s.method==='WAIT_ObjectiveComplete').map(s=>s.args[0]),trigger:o.steps.find(s=>s.method==='WAIT_TriggerVolume')?.args[0],methods:o.steps.map(s=>s.method)})),limitations:output.limitations},null,2));
}
console.log(JSON.stringify({file:fileURLToPath(new URL('gameplay.json',folder)),checkpoints:checkpoints.length,encounters:encounters.length,objectives:objectives.length}));

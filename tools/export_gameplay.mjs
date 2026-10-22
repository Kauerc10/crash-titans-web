import { unavailableTutorials } from '../src/tutorials.js';
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
const tutProps = Object.fromEntries(logic.props.filter(p=>p.name&&p.name.includes('TutStone')).map(p=>[p.name,{
  position:p.position,sourcePosition:p.sourcePosition,template:p.template
}]));

const checkpoints = [], encounters = [];
for (const objective of objectives) {
  const trigger = objective.steps.find(s=>s.method==='WAIT_TriggerVolume')?.args[0];
  const reset = objective.steps.find(s=>s.method==='DO_SetPlayerResetPosition')?.args[0];
  const requires = objective.steps.filter(s=>s.method==='WAIT_ObjectiveComplete').map(s=>s.args[0]);
  if (objective.id === 'WhumpaE1LevelReset3' && !requires.includes('L1_E1_Combat2')) {
    requires.push('L1_E1_Combat2');
  }
  if (objective.id === 'WhumpaE1LevelReset24' && !requires.includes('L1_E1_Combat2')) {
    requires.push('L1_E1_Combat2');
  }
  if (reset) {
    if (!volumes[trigger] || !locators[reset]) throw Error(`Unresolved checkpoint ${objective.id}: ${trigger} / ${reset}`);
    checkpoints.push({id:objective.id,trigger,locator:reset,requires});
  }
  const spawns = objective.steps.filter(s=>s.method==='DO_SpawnEnemy');
  if (spawns.length) encounters.push({id:objective.id,trigger,requires,spawns:spawns.map(s=>({group:s.args[0],name:s.args[1],template:s.args[2],locator:s.args[3],animation:s.args[4],sourceArguments:s.args,sourcePC:s.sourcePC})),implemented:false,combatPrototype:objective.id==='L1_E1_Combat2'});
}

const tutorials = [
  {
    id: 'Tutorial_Hint_Movement',
    type: 'messageBar',
    trigger: 'NIS01',
    triggerType: 'objective',
    requires: ['NIS01'],
    title: 'MOVIMENTO',
    textKey: 'Hint_Movement',
    texts: {
      keyboard: 'Use WASD ou setas para mover. Pressione ESPAÇO para pular.',
      gamepad: 'Use o analógico esquerdo para mover. Pressione ✕ (A) para pular.',
      ps2: 'USE THE LEFT ANALOG STICK TO WALK OR RUN. PRESS ✕ TO JUMP.'
    },
    audio: 'basic',
    duration: 5
  },
  {
    id: 'Tutorial_Hint_LightAttack',
    type: 'messageBar',
    trigger: 'L1_E1_Hint2',
    triggerType: 'volume',
    requires: ['NIS01'],
    title: 'ATAQUE LEVE',
    textKey: 'Hint_LightAttack',
    texts: {
      keyboard: 'Pressione J para atacar com golpes leves.',
      gamepad: 'Pressione ▢ (X) para atacar com golpes leves.',
      ps2: 'PRESS ▢ TO SMASH STUFF.'
    },
    audio: 'light_attack',
    duration: 5
  },
  {
    id: 'Tutorial_Tutorial_Mojo1',
    type: 'tutorialCard',
    trigger: 'L1_E1_TutStone1',
    triggerType: 'interaction',
    requires: ['NIS01'],
    position: tutProps.L1_E1_TutStone1?.position || [-36.105, -3.124, 4.768],
    title: 'MOJO',
    textKey: 'TUT_Mojo',
    texts: {
      keyboard: 'A essência da vida. Colete e ganhe recompensas.',
      gamepad: 'A essência da vida. Colete e ganhe recompensas.',
      ps2: 'THE ESSENCE OF LIFE ITSELF. COLLECT IT AND EARN REWARDS.'
    },
    duration: 6
  },
  {
    id: 'Tutorial_Tutorial_AirJump',
    type: 'tutorialCard',
    trigger: 'L1_E1_TutStone4',
    triggerType: 'interaction',
    requires: ['L1_E1_Combat2'],
    position: tutProps.L1_E1_TutStone4?.position || [95.043, 16.661, -15.314],
    title: 'AIR JUMP',
    textKey: 'TUT_AirJump',
    texts: {
      keyboard: 'Pressione o botão de salto duas vezes • ESPAÇO, ESPAÇO',
      gamepad: 'Pressione o botão de salto duas vezes • ✕, ✕ (A, A)',
      ps2: 'PRESS THE JUMP BUTTON TWICE • ✕, ✕'
    },
    audio: 'air_jump',
    duration: 6
  },
  {
    id: 'Tutorial_Tutorial_BouncePad',
    type: 'tutorialCard',
    trigger: 'L1_E1_TutStone6',
    triggerType: 'interaction',
    requires: ['L1_E1_Combat2'],
    position: tutProps.L1_E1_TutStone6?.position || [285.324, 30.236, -44.752],
    title: 'BOUNCY BOUNCY',
    textKey: 'TUT_BouncePad',
    texts: {
      keyboard: 'Pule ao tocar em um objeto elástico • ESPAÇO',
      gamepad: 'Pule ao tocar em um objeto elástico • ✕ (A)',
      ps2: 'JUMP AS YOU LAND ON A SPRINGY OBJECT • ✕'
    },
    audio: 'bounce_pad',
    duration: 6
  },
  {
    id: 'MultiplyTutorial',
    type: 'messageBar',
    trigger: 'mojomultiplier',
    triggerType: 'volume',
    requires: ['L1_E1_Combat2'],
    title: 'MOJO MULTIPLIER',
    textKey: 'MultiplyTutorial',
    texts: {
      keyboard: 'Multiplicador de Mojo: derrote inimigos em sequência para multiplicar.',
      gamepad: 'Multiplicador de Mojo: derrote inimigos em sequência para multiplicar.',
      ps2: 'DEFEAT ENEMIES TO MULTIPLY MOJO'
    },
    audio: 'multiplier',
    duration: 5
  },
  {
    id: 'Tutorial_Hint_SpinHover',
    type: 'tutorialCard',
    trigger: 'L1_E1_TutStone5',
    triggerType: 'interaction',
    requires: ['L1_E1_Combat2'],
    position: tutProps.L1_E1_TutStone5?.position || [91.281, 58.265, -331.091],
    title: 'SPIN HOVER',
    textKey: 'TUT_SpinHover',
    texts: {
      keyboard: 'Pule e aperte ataque leve repetidamente • ESPAÇO, J, J, J . . .',
      gamepad: 'Pule e aperte ataque leve repetidamente • ✕, ▢, ▢, ▢ . . .',
      ps2: 'PRESS JUMP AND REPEATEDLY PRESS LIGHT ATTACK • ✕, ▢, ▢, ▢ . . .'
    },
    audio: 'spin_hover',
    duration: 6
  },
  {
    id: 'Tutorial_Hint_BlockBreaker',
    type: 'messageBar',
    trigger: 'L1_E1_Hint8',
    triggerType: 'volume',
    requires: ['L1_E1_Combat2'],
    title: 'QUEBRA DE BLOQUEIO',
    textKey: 'Hint_BlockBreaker',
    texts: {
      keyboard: 'Pressione e segure K para quebrar o bloqueio inimigo.',
      gamepad: 'Pressione e segure △ (Y) para quebrar o bloqueio inimigo.',
      ps2: "PRESS AND HOLD △ TO BREAK AN ENEMY'S BLOCK."
    },
    audio: 'heavy_attack',
    duration: 5
  },
  {
    id: 'Tutorial_Tutorial_Jack',
    type: 'tutorialCard',
    trigger: 'L1_E1_TutStone3',
    triggerType: 'interaction',
    requires: ['L1_E1_Combat2'],
    position: tutProps.L1_E1_TutStone3?.position || [-205.350, 87.513, -197.964],
    title: 'JACKING',
    textKey: 'TUT_Jacking',
    texts: {
      keyboard: 'Atordoe um inimigo e pressione L para montar • Pressione L para desmontar',
      gamepad: 'Atordoe um inimigo e pressione ◯ (B) para montar • Pressione ◯ para desmontar',
      ps2: 'STUN AN ENEMY AND PRESS ◯ TO JACK • PRESS ◯ TO UNJACK'
    },
    duration: 6
  },
  {
    id: 'SpikeCinematic',
    type: 'cinematic',
    trigger: 'PlaySpike',
    triggerType: 'volume',
    requires: ['L1_E1_Combat2'],
    title: 'PRIMEIRO TITÃ: SPIKE',
    textKey: 'SpikeCinematic',
    texts: {
      keyboard: 'Entrada da arena: Spike apareceu! Atordoe o titã para montar.',
      gamepad: 'Entrada da arena: Spike apareceu! Atordoe o titã para montar.',
      ps2: 'TITAN ENCOUNTER: SPIKE'
    },
    duration: 5
  }
];

for(const tutorial of tutorials)tutorial.implemented=!unavailableTutorials.has(tutorial.id);

const output = {episode:'L1_E1',source:logic.scripts.objectives.source,coordinateSystem:'Y up; Z mirrored',
  checkpoints,volumes,locators,tutProps,tutorials,objectives,encounters,
  limitations:['Source TriggerVolumeBox scale is treated as half extents; native engine volume evaluation is still awaiting independent validation.',
    'Objective declarations are independent branches, not a linear encounter order.',
    'Checkpoints and a native approximate battle for L1_E1_Combat2 are supported; other encounters remain inventory. Amb1 and full source objective completion are not implemented.']};
await writeFile(new URL('gameplay.json',folder),JSON.stringify(output));

const candidateUrls = [new URL('../../crash-analysis/', import.meta.url), new URL('../../../../outputs/crash-analysis/', import.meta.url)];
const targetDir = candidateUrls.find(u => existsSync(fileURLToPath(u)));
if (targetDir) {
  await writeFile(new URL('episode-one-objectives.json', targetDir),JSON.stringify({source:output.source,checkpoints:checkpoints.length,encounters:encounters.length,tutorials:tutorials.length,objectives:objectives.map(o=>({id:o.id,requires:o.steps.filter(s=>s.method==='WAIT_ObjectiveComplete').map(s=>s.args[0]),trigger:o.steps.find(s=>s.method==='WAIT_TriggerVolume')?.args[0],methods:o.steps.map(s=>s.method)})),limitations:output.limitations},null,2));
}
console.log(JSON.stringify({file:fileURLToPath(new URL('gameplay.json',folder)),checkpoints:checkpoints.length,encounters:encounters.length,tutorials:tutorials.length,objectives:objectives.length}));

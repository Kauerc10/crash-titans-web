import test from 'node:test';
import assert from 'node:assert/strict';
import { combatRules } from '../src/combat-rules.js';
import { Combat, combatTuning } from '../src/combat.js';
const data={encounters:[{id:'L1_E1_Combat2',trigger:'arena',requires:[],spawns:[{locator:'enemy'}]}],volumes:{arena:{position:[0,0,0],halfExtents:[5,5,5],rotation:[0,0,0]}},locators:{enemy:{position:[0,0,1.3],yaw:0}}};
const player={position:[0,0,0],yaw:0,grounded:true};
test('encounter uses its source trigger and each swing hits an enemy at most once',()=>{
 const c=new Combat(data);c.step(.01,{...player,position:[20,0,0]});assert.equal(c.enemies.length,0);
 c.step(.01,player);assert.equal(c.enemies.length,1);c.requestAttack();c.step(.2,player);const health=c.enemies[0].health;
 assert.equal(health,3);c.step(.1,player);assert.equal(c.enemies[0].health,health);
});
test('an attack cannot hit enemies behind the player or on another floor',()=>{
 for(const position of [[0,0,-1],[0,4,1]]){const c=new Combat(data);c.step(.01,player);c.enemies[0].position=position;c.requestAttack();c.step(.2,player);assert.equal(c.enemies[0].health,4);}
});
test('damage has an invulnerability window and death requests checkpoint recovery',()=>{
 const c=new Combat(data);assert.equal(c.damagePlayer(10),true);assert.equal(c.damagePlayer(10),false);assert.equal(c.player.health,80);
 c.player.invulnerable=0;c.damagePlayer(100);assert.equal(c.player.health,0);c.step(2.1,player);assert.equal(c.needsRecovery,true);
 c.resetToCheckpoint();assert.equal(c.player.health,90);assert.equal(c.needsRecovery,false);
});
test('retry clears an unfinished encounter; a defeated group completes only once',()=>{
 const c=new Combat(data);c.step(.01,player);c.resetToCheckpoint();assert.equal(c.enemies.length,0);c.step(.01,player);assert.equal(c.enemies.length,1);
 c.enemies[0].health=0;assert.equal(c.step(.01,player).filter(e=>e.type==='cleared').length,1);assert.equal(c.step(.01,player).filter(e=>e.type==='cleared').length,0);
});
test('enemy returns to idle during recovery so its next attack animation replays',()=>{
 const c=new Combat(data);c.step(.01,player);assert.equal(c.enemies[0].animation,'attack_light');
 c.step(combatRules.durations.attack_light,player);assert.equal(c.enemies[0].animation,'idle_combat');
 c.step(1.01,player);c.step(.01,player);assert.equal(c.enemies[0].animation,'attack_light');
});

test('source light-attack window starts at frame 3; damage is not applied during wind-up',()=>{
 const c=new Combat(data);c.step(.01,player);c.requestAttack();c.step(.05,player);assert.equal(c.enemies[0].health,4);
 c.step(.05,player);assert.equal(c.enemies[0].health,3);assert.equal(c.propAttack.strength,2);
});
test('source third light clip has two distinct strike windows with damage 2 and 3',()=>{
 const c=new Combat(data);c.step(.01,player);c.enemies[0].health=20;c.combo=1;c.sinceAttack=0;c.requestAttack();c.step(.15,player);
 assert.equal(c.attack.clip,'attack_lite_C');assert.equal(c.enemies[0].health,18);
 c.step(.05,player);assert.equal(c.enemies[0].health,18);c.step(.17,player);assert.equal(c.enemies[0].health,15);assert.equal(c.propAttack.strength,4);
 c.step(.05,player);assert.equal(c.enemies[0].health,15);
});
test('Chiratta source contact window applies base damage 2 once per attack',()=>{
 const c=new Combat(data);c.step(.01,player);c.step(.7,player);assert.equal(c.player.health,90);
 c.step(.05,player);assert.equal(c.player.health,88);c.step(.1,player);assert.equal(c.player.health,88);
});

test('progressive combo sequence applies correct hit damage, stagger reaction and heavy defeat',()=>{
 const c=new Combat(data);c.step(.01,player);
 assert.equal(c.enemies[0].health,4);
 assert.equal(c.enemies[0].state,'attack');
 // Hit 1: Attack lite A (damage 1)
 c.requestAttack();c.step(.15,player);
 assert.equal(c.enemies[0].health,3);
 assert.equal(c.enemies[0].state,'hit');
 assert.equal(c.enemies[0].animation,'impact_light');
 // Complete attack A duration
 c.step(.2,player);
 // Hit 2: Attack lite B (damage 1)
 c.requestAttack();c.step(.15,player);
 assert.equal(c.enemies[0].health,2);
 assert.equal(c.enemies[0].state,'hit');
 assert.equal(c.enemies[0].animation,'impact_light');
 // Complete attack B duration
 c.step(.15,player);
 // Hit 3: Attack lite C (strike 1 damage 2 -> drops health to 0)
 c.requestAttack();c.step(.15,player);
 assert.equal(c.enemies[0].health,0);
 assert.equal(c.enemies[0].state,'dead');
 assert.equal(c.enemies[0].animation,'impact_heavy');
 // Defeat maintains heavy impact clip during full duration
 c.step(1.0,player);
 assert.equal(c.enemies[0].animation,'impact_heavy');
 assert.equal(c.enemies[0].health,0);
});

test('hit stagger prevents immediate enemy attack during reaction window',()=>{
 const c=new Combat(data);c.step(.01,player);
 // Interrupt enemy with attack
 c.requestAttack();c.step(.15,player);
 assert.equal(c.enemies[0].state,'hit');
 assert.equal(c.enemies[0].animation,'impact_light');
 // During stagger window, enemy remains in hit state and cannot attack
 c.step(.2,player);
 assert.equal(c.enemies[0].state,'hit');
 // After stagger expires (total > 0.45s), enemy resumes AI and initiates attack because player is adjacent
 c.step(.3,player);
 assert.equal(c.enemies[0].state,'attack');
 assert.equal(c.enemies[0].animation,'attack_light');
});

test('enemy health is tracked internally and encounters complete once without duplicate triggers',()=>{
 const c=new Combat(data);c.step(.01,player);
 assert.equal(c.enemies[0].health,4);
 c.enemies[0].health=0;
 const events=c.step(.01,player);
 assert(events.some(e=>e.type==='cleared'));
 assert.equal(c.step(.01,player).filter(e=>e.type==='cleared').length,0);
});

test('heavy attack request triggers heavy clip and strikes enemies directly with block-break strength',()=>{
 const c=new Combat(data);c.step(.01,player);
 assert.equal(c.enemies[0].health,4);
 const queued=c.requestHeavyAttack();
 assert.equal(queued,true);
 const events=c.step(.15,player);
 assert(events.some(e=>e.type==='playerAttack'&&e.heavy===true));
 assert.equal(c.attack.clip,'attack_lite_C');
 assert.equal(c.enemies[0].health,2);
 assert.equal(c.enemies[0].state,'hit');
 assert.equal(c.enemies[0].animation,'impact_light');
});

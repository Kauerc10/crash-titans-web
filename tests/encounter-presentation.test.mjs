import test from 'node:test';
import assert from 'node:assert/strict';
import { Combat } from '../src/combat.js';

const data={encounters:[{id:'L1_E1_Combat2',trigger:'arena',spawns:[{name:'first',locator:'one'},{name:'second',locator:'two'}],presentation:{id:'conversation',duration:2,lines:[{start:0,end:1,actor:'first'},{start:1,end:2,actor:'second'}]}}],volumes:{arena:{position:[0,0,0],halfExtents:[5,5,5]}},locators:{one:{position:[0,0,1]},two:{position:[1,0,1]}}};
const player={position:[0,0,0],yaw:0,grounded:true};
test('encounter introduction freezes attacks and gives each speaker its talk pose before returning control',()=>{
 const combat=new Combat(data);
 const events=combat.step(.1,player);
 assert(events.some(e=>e.type==='presentationStarted'));
 combat.requestAttack();combat.step(.5,player);
 assert.equal(combat.attack,null);
 assert.equal(combat.player.health,90);
 assert.equal(combat.enemies[0].animation,'talk');
 assert.equal(combat.enemies[1].animation,'idle_combat');
 combat.step(.6,player);
 assert.equal(combat.enemies[1].animation,'talk');
 assert(combat.step(.9,player).some(e=>e.type==='presentationEnded'));
 combat.requestAttack();combat.step(.05,player);
 assert.equal(combat.attack.clip,'attack_lite_A');
});

test('conversation starts once per live encounter and retry restarts it with exactly two actors',()=>{
 const combat=new Combat(data);
 combat.step(.1,player);
 assert.equal(combat.step(.1,player).filter(e=>e.type==='presentationStarted').length,0);
 combat.step(2,player);
 assert.equal(combat.step(.1,player).filter(e=>e.type==='presentationStarted').length,0);
 combat.resetToCheckpoint();
 assert(combat.step(.1,player).some(e=>e.type==='presentationStarted'));
 assert.equal(combat.enemies.length,2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlayerAnimation, fallingAnimation } from '../src/player-animation.js';
test('pose changes blend instead of snapping, and repeated requests keep clip time',()=>{
  const object=new THREE.Object3D();object.name='actor';
  const clip=(name,x)=>new THREE.AnimationClip(name,1,[new THREE.NumberKeyframeTrack('.position[x]',[0,1],[x,x])]);
  const animation=new PlayerAnimation(object,[clip('idle',0),clip('jump',10),clip('fall',20)]);
  animation.play('idle');animation.update(.1);
  animation.play('jump',true);animation.update(.05);
  assert.ok(object.position.x>0&&object.position.x<10,'jump must blend with previous pose');
  const time=animation.current.time;animation.play('jump',true);assert.equal(animation.current.time,time);
  animation.update(.2);assert.ok(Math.abs(object.position.x-10)<.001);
  animation.play('fall');animation.update(.05);assert.ok(object.position.x>10&&object.position.x<20);
  animation.update(.2);assert.ok(Math.abs(object.position.x-20)<.001);
});
test('falling pose waits for descent instead of interrupting a rising jump',()=>{
  assert.equal(fallingAnimation('ground',.31,1.4),null);
  assert.equal(fallingAnimation('ground',.4,-1),'jump_single_fall_cycle');
  assert.equal(fallingAnimation('air',.4,-1),'jump_air_fall');
});

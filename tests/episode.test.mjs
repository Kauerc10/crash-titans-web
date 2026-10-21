import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { containsVolume, EpisodeProgress, JumpInput } from '../src/episode.js';
const data = JSON.parse(await readFile(new URL('../public/assets/levels/l1-e1/gameplay.json',import.meta.url)));
test('source checkpoints resolve, honor prerequisites, and activate only once',()=>{
  const progress = new EpisodeProgress(data);
  const second = data.checkpoints.find(c=>c.requires.includes('NIS01'));
  const position = data.volumes[second.trigger].position;
  assert.equal(progress.visit(position).some(c=>c.id===second.id),false);
  progress.complete('NIS01');
  assert.equal(progress.visit(position).some(c=>c.id===second.id),true);
  assert.equal(progress.visit(position).some(c=>c.id===second.id),false);
  assert.deepEqual(progress.checkpoint.position,data.locators[second.locator].position);
  assert.equal(progress.completed.has('L1_E1_Combat2'),false);
});
test('rotated source trigger boxes reject points outside their local axes',()=>{
  const box={position:[0,0,0],halfExtents:[4,1,1],rotation:[0,Math.PI/2,0]};
  assert.equal(containsVolume(box,[0,0,3]),true);
  assert.equal(containsVolume(box,[3,0,0]),false);
  assert.equal(containsVolume(box,[0,2,0]),false);
  assert.equal(containsVolume({...box,rotation:[0,0,Math.PI/2]},[0,3,0]),true);
  assert.equal(containsVolume({...box,halfExtents:[1,4,1],rotation:[Math.PI/2,0,0]},[0,0,3]),true);
});
test('recovery copies checkpoint state and does not invent completion',()=>{
  const progress=new EpisodeProgress(data);progress.setEntry([1,2,3],.4);
  const a=progress.recovery();a.position[0]=99;
  assert.deepEqual(progress.recovery().position,[1,2,3]);
  assert.equal(progress.completed.size,0);
});
test('jump requires a new press, permits one air jump, resets on landing and focus loss',()=>{
  const input=new JumpInput();
  input.press();assert.equal(input.consume(true),'ground');
  input.press();assert.equal(input.consume(false),null);
  input.release();input.press();assert.equal(input.consume(false),'air');
  input.release();input.press();assert.equal(input.consume(false),null);
  input.consume(true);assert.equal(input.consume(true),null);
  input.release();input.press();assert.equal(input.consume(true),'ground');
  input.clear();assert.equal(input.consume(false),null);
  input.press();input.release();assert.equal(input.consume(true),'ground');
});
test('pause with jump held requires release before another jump can be queued',()=>{
  const input=new JumpInput();input.press();assert.equal(input.consume(true),'ground');
  input.suspend();input.press();assert.equal(input.consume(false),null);
  input.press();assert.equal(input.consume(false),null);
  input.release();input.press();assert.equal(input.consume(false),'air');
});
test('attack/hit cancellation discards pending jump without rearming a held button',()=>{
 const input=new JumpInput();input.press();assert.equal(input.consume(true),'ground');
 input.cancelPending();input.press();input.cancelPending();input.press();assert.equal(input.consume(true),null);
 input.release();input.press();assert.equal(input.consume(true),'ground');
});

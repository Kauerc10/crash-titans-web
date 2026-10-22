import test from 'node:test';
import assert from 'node:assert/strict';
import { TutorialManager } from '../src/tutorials.js';
import { EpisodeProgress } from '../src/episode.js';
import { episodeFixture } from './fixtures/episode.mjs';
import { regionNeighbors } from '../src/game-flow.js';

// Rule boundary only: direct positions do not prove a traversable level.
test('rule: available prompt changes device without restarting its expiry',()=>{
 const data=episodeFixture(), manager=new TutorialManager(data), progress=new EpisodeProgress(data);
 assert.deepEqual(manager.step(.1,[30,0,0],progress),[]);
 progress.complete('L1_E1_Combat2');
 const events=manager.step(.1,[30,0,0],progress);
 assert.equal(events.filter(e=>e.type==='tutorialStarted').length,1);
 assert.equal(manager.active.text,'SPACE twice');
 manager.step(2,[30,0,0],progress);manager.setInputMode('gamepad');
 assert.equal(manager.active.text,'A twice');
 manager.pause(true);manager.step(20,[30,0,0],progress);assert(manager.active);
 manager.pause(false);assert(manager.step(3.1,[30,0,0],progress).some(e=>e.type==='tutorialEnded'));
 assert.equal(manager.active,null);
 assert.deepEqual(manager.step(.1,[30,0,0],progress),[]);
});

test('rule: retry restores only checkpoint-consolidated tutorials',()=>{
 const data=episodeFixture(), manager=new TutorialManager(data), progress=new EpisodeProgress(data);
 progress.complete('L1_E1_Combat2');manager.markCheckpoint();
 manager.step(.1,[30,0,0],progress);assert(manager.isCompleted('Tutorial_Tutorial_AirJump'));
 manager.resetToCheckpoint();assert(!manager.isCompleted('Tutorial_Tutorial_AirJump'));assert.equal(manager.active,null);
 manager.step(.1,[30,0,0],progress);manager.markCheckpoint();manager.resetToCheckpoint();
 assert(manager.isCompleted('Tutorial_Tutorial_AirJump'));
});

test('rule: proximity cannot complete an absent Spike scene or teach unavailable heavy',()=>{
 const data=episodeFixture(), manager=new TutorialManager(data), progress=new EpisodeProgress(data);
 progress.complete('L1_E1_Combat2');
 const events=manager.step(.1,[40,0,0],progress);
 assert(!progress.completed.has('SpikeCinematic'));
 assert(!manager.isCompleted('SpikeCinematic'));
 assert(!events.some(e=>e.type==='spikeInteractionReached'));
 assert(!events.some(e=>e.id==='Tutorial_Hint_BlockBreaker'));
 assert.equal(manager.active,null);
});

test('rule: sector visibility graph connects adjacent regions and isolates bonus room',()=>{
 assert.deepEqual(regionNeighbors.r7, ['r7', 'r1']);
 assert.deepEqual(regionNeighbors.r1, ['r7', 'r1', 'r2']);
 assert.deepEqual(regionNeighbors.r2, ['r1', 'r2', 'r3']);
 assert.deepEqual(regionNeighbors.r3, ['r2', 'r3', 'r4']);
 assert.deepEqual(regionNeighbors.r4, ['r3', 'r4', 'r5']);
 assert.deepEqual(regionNeighbors.r5, ['r4', 'r5', 'r6']);
 assert.deepEqual(regionNeighbors.r6, ['r5', 'r6']);
 assert.deepEqual(regionNeighbors.mojo, ['mojo']);
 for(const [region, neighbors] of Object.entries(regionNeighbors)){
   assert(neighbors.length <= 3, `Region ${region} exceeds bounded neighbor limit`);
   if(region !== 'mojo'){
     assert(!neighbors.includes('mojo'), `Region ${region} must not show mojo bonus room`);
   }
 }
});

test('rule: physical path progression from encounter to Spike approach enforces prerequisites and sequential checkpoints',()=>{
 const data=episodeFixture(), manager=new TutorialManager(data), progress=new EpisodeProgress(data);
 progress.complete('NIS01');
 assert(progress.visit([0,0,0]).some(c=>c.id==='before'));
 assert.equal(progress.checkpoint.position[0],0);

 // Attempting to reach checkpoints past Combat2 before winning the fight must not activate them
 assert.deepEqual(progress.visit([20,0,0]), []);
 assert.deepEqual(progress.visit([25,0,0]), []);
 assert.deepEqual(progress.visit([35,0,0]), []);
 assert.equal(progress.checkpoint.position[0],0);

 // Win encounter
 progress.complete('L1_E1_Combat2');

 // Step through path sequentially
 assert(progress.visit([20,0,0]).some(c=>c.id==='after'));
 assert.equal(progress.checkpoint.position[0],21);

 assert(progress.visit([25,0,0]).some(c=>c.id==='trail'));
 assert.equal(progress.checkpoint.position[0],25);

 const airJumpEvents = manager.step(.1, [30,0,0], progress);
 assert(airJumpEvents.some(e=>e.id==='Tutorial_Tutorial_AirJump'));
 assert(manager.isCompleted('Tutorial_Tutorial_AirJump'));

 assert(progress.visit([35,0,0]).some(c=>c.id==='approach'));
 assert.equal(progress.checkpoint.position[0],35);

 // Arrive at PlaySpike volume - must NOT complete SpikeCinematic
 const spikeEvents = manager.step(.1, [40,0,0], progress);
 assert(!progress.completed.has('SpikeCinematic'));
 assert(!manager.isCompleted('SpikeCinematic'));
 assert.deepEqual(spikeEvents, []);

 // Rollback to checkpoint preserves approach checkpoint and completed tutorial
 manager.markCheckpoint();
 progress.resetToCheckpoint();
 manager.resetToCheckpoint();
 assert.equal(progress.checkpoint.position[0],35);
 assert(manager.isCompleted('Tutorial_Tutorial_AirJump'));
 assert(!progress.completed.has('SpikeCinematic'));
});

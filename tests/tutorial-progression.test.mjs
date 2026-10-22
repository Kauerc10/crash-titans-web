import test from 'node:test';
import assert from 'node:assert/strict';
import { TutorialManager } from '../src/tutorials.js';
import { EpisodeProgress } from '../src/episode.js';
import { episodeFixture } from './fixtures/episode.mjs';

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

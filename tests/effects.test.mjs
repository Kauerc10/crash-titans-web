import test from 'node:test';
import assert from 'node:assert/strict';
import { GameplayAudio } from '../src/gameplay-audio.js';
import { GameplayEffects } from '../src/gameplay-effects.js';

class MockAudioSource {
 constructor(onended) {
  this.buffer = null;
  this.onended = onended;
  this.stopped = false;
  this.connected = false;
 }
 connect() { this.connected = true; }
 disconnect() { this.connected = false; }
 start() {}
 stop() {
  this.stopped = true;
  if (this.onended) this.onended();
 }
}

class MockAudioContext {
 constructor() {
  this.state = 'running';
  this.currentTime = 0;
  this.destination = {};
 }
 createGain() {
  return {
   gain: { value: 1 },
   channelCount: 2,
   channelCountMode: 'explicit',
   connect() {}
  };
 }
 createBufferSource() {
  return new MockAudioSource();
 }
 suspend() { this.state = 'suspended'; return Promise.resolve(); }
 resume() { this.state = 'running'; return Promise.resolve(); }
 close() { this.state = 'closed'; return Promise.resolve(); }
}

test('GameplayAudio: maps combat and collection events to authentic sounds and respects voice bounds', () => {
 const settings = { muted: false, effects: 1, sound: 'stereo' };
 const audio = new GameplayAudio(settings);
 audio.context = new MockAudioContext();
 audio.output = audio.context.createGain();

 // Populate mock buffers for all 15 clips
 const soundNames = ['swing','hit','hurt','enemy','death','leaf','pot','wood','metal','mojo','defeat','disappear','bodyfall','health','freejack'];
 for (const name of soundNames) {
  audio.buffers.set(name, { duration: 0.5 });
 }

 const played = [];
 const origPlay = audio.play.bind(audio);
 audio.play = (name) => {
  played.push(name);
  origPlay(name);
 };

 // Regular enemy hit plays 'hit'
 audio.event({ type: 'enemyHit', killed: false });
 assert.equal(played[played.length - 1], 'hit');

 // Fatal enemy hit plays 'defeat' (bone_crusher_04)
 audio.context.currentTime += 0.1;
 audio.event({ type: 'enemyHit', killed: true });
 assert.equal(played[played.length - 1], 'defeat');

 // Death completion plays 'disappear' (fodder_death_flash)
 audio.context.currentTime += 0.1;
 audio.event({ type: 'enemyDeathDone' });
 assert.equal(played[played.length - 1], 'disappear');

 // Health pickup plays 'health' (whumpa_pu_01)
 audio.context.currentTime += 0.1;
 audio.event({ type: 'healthCollected' });
 assert.equal(played[played.length - 1], 'health');

 // FreeJack pickup plays 'freejack' (freejack_glow_03)
 audio.context.currentTime += 0.1;
 audio.event({ type: 'freeJackCollected' });
 assert.equal(played[played.length - 1], 'freejack');

 // Mojo pickup plays 'mojo'
 audio.context.currentTime += 0.1;
 audio.event({ type: 'mojoCollected' });
 assert.equal(played[played.length - 1], 'mojo');

 // Bounded polyphony: max 8 concurrent sources
 while (audio.sources.size < 8) {
  audio.context.currentTime += 0.1;
  origPlay('swing');
 }
 assert.equal(audio.sources.size, 8);
 const preCount = audio.playCount;
 origPlay('hit'); // Should be dropped due to pool exhaustion
 assert.equal(audio.playCount, preCount);

 // Rate limiting throttle (< 0.06s drops same sound)
 audio.clear();
 audio.context.currentTime = 10.0;
 origPlay('hit');
 const count1 = audio.playCount;
 audio.context.currentTime = 10.02; // only 0.02s elapsed
 origPlay('hit');
 assert.equal(audio.playCount, count1); // dropped by throttle

 // Mute suppression
 settings.muted = true;
 audio.context.currentTime = 11.0;
 origPlay('hit');
 assert.equal(audio.playCount, count1); // dropped because muted

 // Pause clears active voices
 audio.clear();
 settings.muted = false;
 audio.context.currentTime = 12.0;
 origPlay('hit');
 assert.equal(audio.sources.size, 1);
 audio.pause(true);
 assert.equal(audio.sources.size, 0);
 assert.equal(audio.context.state, 'suspended');

 audio.stop();
 assert.equal(audio.context.state, 'closed');
 assert.equal(audio.buffers.size, 0);
});

test('GameplayEffects: pool is strictly bounded, handles bursts, updates and clears on reset', () => {
 const fx = new GameplayEffects(null, 64);
 assert.equal(fx.particles.length, 64);
 assert.equal(fx.mesh.count, 0);

 // Event: enemyHit spawns 5 particles
 fx.event({ type: 'enemyHit', killed: false, position: [0, 0, 0] });
 assert.equal(fx.particles.filter(p => p.active).length, 5);

 // Update steps particles and sets mesh instance count
 fx.update(0.1, null);
 assert.equal(fx.mesh.count, 5);

 // Spawning many bursts never exceeds capacity (bounded recycling)
 for (let i = 0; i < 20; i++) {
  fx.event({ type: 'enemyHit', killed: true, position: [i, 0, 0] });
 }
 assert(fx.particles.filter(p => p.active).length <= 64);
 fx.update(0.01, null);
 assert(fx.mesh.count <= 64);

 // Aging past duration deactivates particles
 fx.update(1.0, null);
 assert.equal(fx.mesh.count, 0);
 assert.equal(fx.particles.filter(p => p.active).length, 0);

 // Clear immediately resets all active particles
 fx.event({ type: 'enemyReward', position: [0, 0, 0] });
 assert(fx.particles.some(p => p.active));
 fx.clear();
 assert.equal(fx.particles.every(p => !p.active), true);
 assert.equal(fx.mesh.count, 0);

 fx.dispose();
});

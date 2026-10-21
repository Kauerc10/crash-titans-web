import test from 'node:test';
import assert from 'node:assert/strict';
import { Combat, combatTuning, calculateEnemyDrops } from '../src/combat.js';
import { Pickups } from '../src/pickups.js';

const encounterData = {
 encounters: [{ id: 'L1_E1_Combat2', trigger: 'arena', requires: [], spawns: [{ name: 'Chiratta1', locator: 'enemy' }] }],
 volumes: { arena: { position: [0, 0, 0], halfExtents: [5, 5, 5], rotation: [0, 0, 0] } },
 locators: { enemy: { position: [0, 0, 1.3], yaw: 0 } }
};
const player = { position: [0, 0, 0], yaw: 0, grounded: true };

test('Chiratta drop semantics: 7 guaranteed c_mojoS, mutually exclusive probabilistic freeJack (5%) and health (4.75%)', () => {
 // Default / high rolls: only 7 guaranteed c_mojoS
 const defaultDrops = calculateEnemyDrops(() => 0.5);
 assert.deepEqual(defaultDrops, [{ type: 'c_mojoS', count: 7 }]);

 // First roll < 0.05: wins freeJack; health slot is bypassed
 let rollCalls = 0;
 const freeJackDrops = calculateEnemyDrops(() => { rollCalls++; return 0.02; });
 assert.equal(rollCalls, 1);
 assert.deepEqual(freeJackDrops, [
  { type: 'c_mojoS', count: 7 },
  { type: 'c_freeJack', count: 1 }
 ]);

 // First roll >= 0.05, second roll < 0.05: freeJack missed, health won
 const rolls = [0.10, 0.03];
 const healthDrops = calculateEnemyDrops(() => rolls.shift());
 assert.deepEqual(healthDrops, [
  { type: 'c_mojoS', count: 7 },
  { type: 'c_health', count: 1 }
 ]);
});

test('defeat reward is emitted at frame 18 (0.6s) and only once; death completes at 1.8s', () => {
 const c = new Combat(encounterData, {}, { rng: () => 0.5 });
 c.step(0.01, player);
 assert.equal(c.enemies.length, 1);
 const enemy = c.enemies[0];

 // Reduce health to 0
 enemy.health = 0;
 enemy.state = 'dead';
 enemy.age = 0;

 // Before frame 18 (0.6s), no rewards are emitted
 const earlyEvents = c.step(0.5, player);
 assert.equal(earlyEvents.filter(e => e.type === 'enemyReward').length, 0);
 assert.equal(enemy.rewardEmitted, false);

 // At or past 0.6s (frame 18), enemyReward is emitted with position and drops
 const rewardEvents = c.step(0.15, player);
 const reward = rewardEvents.find(e => e.type === 'enemyReward');
 assert(reward);
 assert.equal(reward.id, enemy.id);
 assert.deepEqual(reward.position, enemy.position);
 assert.deepEqual(reward.drops, [{ type: 'c_mojoS', count: 7 }]);
 assert.equal(enemy.rewardEmitted, true);

 // Subsequent steps do NOT re-emit rewards (once-only guard)
 const laterEvents = c.step(0.5, player);
 assert.equal(laterEvents.filter(e => e.type === 'enemyReward').length, 0);

 // At 1.8s, enemyDeathDone is emitted once
 const deathEvents = c.step(0.7, player);
 assert(deathEvents.some(e => e.type === 'enemyDeathDone'));
 assert.equal(enemy.deathDone, true);
 assert.equal(c.step(0.1, player).filter(e => e.type === 'enemyDeathDone').length, 0);
});

test('pickups collect 70 mojo from Chiratta reward and healPlayer restores damaged health up to max', () => {
 const pickups = new Pickups({ pickupTypes: { c_mojoS: { value: 10 } }, pickups: [] });
 const c = new Combat(encounterData);

 // Damage player to 80 HP
 c.damagePlayer(10);
 assert.equal(c.player.health, 80);

 // Spawn enemy reward of 7 mojo + 1 health
 const rewardEvent = {
  type: 'enemyReward',
  id: 'enemy_1',
  position: [0, 0, 0.5],
  drops: [
   { type: 'c_mojoS', count: 7 },
   { type: 'c_health', count: 1 }
  ]
 };
 pickups.spawn(rewardEvent);
 assert.equal(pickups.items.size, 8);

 // Crash steps in range and collects items
 const events = pickups.step(0.3, [0, 0, 0.5]);
 const mojoEvents = events.filter(e => e.type === 'mojoCollected');
 const healthEvents = events.filter(e => e.type === 'healthCollected');

 assert.equal(mojoEvents.length, 7);
 assert.equal(healthEvents.length, 1);
 assert.equal(pickups.total, 70);

 // Process health event
 for (const ev of healthEvents) {
  c.healPlayer(ev.value);
 }
 assert.equal(c.player.health, 90);

 // Dead player cannot be healed
 c.player.health = 0;
 assert.equal(c.healPlayer(10), 0);
 assert.equal(c.player.health, 0);
});

test('checkpoint rollback restores pre-encounter total and prevents duplicate drop farming', () => {
 const pickups = new Pickups({ pickupTypes: { c_mojoS: { value: 10 } }, pickups: [] });
 pickups.total = 50;
 pickups.markCheckpoint();

 const c = new Combat(encounterData, {}, { rng: () => 0.5 });
 c.markCheckpoint();

 // Trigger encounter and defeat enemy
 c.step(0.01, player);
 c.enemies[0].health = 0;
 const rewardEvents = c.step(0.65, player);
 const reward = rewardEvents.find(e => e.type === 'enemyReward');
 assert(reward);

 pickups.spawn(reward);
 pickups.step(0.3, [0, 0, 1.3]);
 assert.equal(pickups.total, 120);

 // Crash dies before next checkpoint -> resetToCheckpoint
 c.resetToCheckpoint();
 pickups.resetToCheckpoint();

 // Total returns to exact pre-encounter 50 without duplicate items
 assert.equal(pickups.total, 50);
 assert.equal(pickups.items.size, 0);
 assert.equal(c.cleared.has('L1_E1_Combat2'), false);

 // Second attempt: re-trigger and complete encounter
 c.step(0.01, player);
 c.enemies[0].health = 0;
 const retryReward = c.step(0.65, player).find(e => e.type === 'enemyReward');
 pickups.spawn(retryReward);
 pickups.step(0.3, [0, 0, 1.3]);
 assert.equal(pickups.total, 120);

 // Reach checkpoint after victory
 c.markCheckpoint();
 pickups.markCheckpoint();

 // Subsequent recovery keeps legitimate rewards
 c.resetToCheckpoint();
 pickups.resetToCheckpoint();
 assert.equal(pickups.total, 120);
 assert.equal(c.cleared.has('L1_E1_Combat2'), true);
});

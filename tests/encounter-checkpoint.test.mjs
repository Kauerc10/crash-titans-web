import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EpisodeProgress } from '../src/episode.js';
import { Combat } from '../src/combat.js';
import { Pickups } from '../src/pickups.js';

const gameplay = JSON.parse(await readFile(new URL('../public/assets/levels/l1-e1/gameplay.json', import.meta.url)));

test('checkpoint 3 requires L1_E1_Combat2 completion and rejects premature activation', () => {
 const progress = new EpisodeProgress(gameplay);
 progress.complete('NIS01');

 const cp3 = gameplay.checkpoints.find(c => c.id === 'WhumpaE1LevelReset3');
 assert(cp3, 'WhumpaE1LevelReset3 exists in gameplay.json');
 assert(cp3.requires.includes('L1_E1_Combat2'), 'WhumpaE1LevelReset3 requires L1_E1_Combat2');

 const cp3Pos = gameplay.volumes[cp3.trigger].position;

 // Visiting checkpoint 3 position before clearing combat fails to activate
 const prematureVisit = progress.visit(cp3Pos);
 assert.equal(prematureVisit.some(c => c.id === 'WhumpaE1LevelReset3'), false);
 assert.equal(progress.checkpoint, null);

 // Clear combat objective
 progress.complete('L1_E1_Combat2');

 // Now visiting checkpoint 3 activates it
 const validVisit = progress.visit(cp3Pos);
 assert.equal(validVisit.some(c => c.id === 'WhumpaE1LevelReset3'), true);
 assert.equal(progress.checkpoint.id, 'WhumpaE1LevelReset3');
 assert.deepEqual(progress.checkpoint.position, gameplay.locators[cp3.locator].position);
});

test('dying before vs after checkpoint 3 consolidation correctly restores respective state', () => {
 const progress = new EpisodeProgress(gameplay);
 progress.complete('NIS01');

 // Establish pre-combat checkpoint (NIS01 recovery locator)
 const cp2 = gameplay.checkpoints.find(c => c.id === 'WhumpaE1LevelReset2');
 const cp2Pos = gameplay.volumes[cp2.trigger].position;
 progress.visit(cp2Pos);
 assert.equal(progress.checkpoint.id, 'WhumpaE1LevelReset2');
 const preCombatRecovery = progress.recovery();

 const combat = new Combat(gameplay, {}, { rng: () => 0.5 });
 const pickups = new Pickups({ pickupTypes: { c_mojoS: { value: 10 } }, pickups: [] });
 pickups.total = 100;
 pickups.markCheckpoint();
 combat.markCheckpoint();

 // Crash enters Combat 2 arena
 const arenaPos = gameplay.volumes['L1_E1_CombatVolume2'].position;
 combat.step(0.01, { position: arenaPos, yaw: 0, grounded: true });
 assert.equal(combat.enemies.length, 2);

 // Case A: Crash dies during combat before victory
 combat.damagePlayer(100);
 assert.equal(combat.player.health, 0);

 // Recover: restores pre-combat state
 combat.resetToCheckpoint();
 pickups.resetToCheckpoint();
 assert.equal(combat.cleared.has('L1_E1_Combat2'), false);
 assert.equal(combat.enemies.length, 0);
 assert.equal(pickups.total, 100);
 assert.deepEqual(progress.recovery().position, preCombatRecovery.position);

 // Case B: Victory! Crash clears combat
 combat.step(0.01, { position: arenaPos, yaw: 0, grounded: true });
 const enemyPositions = combat.enemies.map(e => [...e.position]);
 for (const enemy of combat.enemies) {
  enemy.health = 0;
 }
 const events = combat.step(0.65, { position: arenaPos, yaw: 0, grounded: true });
 const cleared = events.find(e => e.type === 'cleared');
 assert(cleared, 'cleared event emitted on victory');
 assert.equal(cleared.id, 'L1_E1_Combat2');
 progress.complete(cleared.id);

 // Collect rewards at defeated enemy locations
 for (const ev of events.filter(e => e.type === 'enemyReward')) {
  pickups.spawn(ev);
 }
 for (const pos of enemyPositions) {
  pickups.step(0.3, pos);
 }
 assert.equal(pickups.total, 240); // 100 + 70 + 70

 // Crash walks to checkpoint 3 and activates it
 const cp3 = gameplay.checkpoints.find(c => c.id === 'WhumpaE1LevelReset3');
 const cp3Pos = gameplay.volumes[cp3.trigger].position;
 const reached = progress.visit(cp3Pos);
 assert.equal(reached.some(c => c.id === 'WhumpaE1LevelReset3'), true);

 // Consolidate checkpoint
 combat.markCheckpoint();
 pickups.markCheckpoint();

 // Case C: Crash dies AFTER consolidating checkpoint 3
 combat.player.health = 0;
 combat.resetToCheckpoint();
 pickups.resetToCheckpoint();

 // Progress and rewards are firmly preserved
 assert.equal(progress.recovery().id, 'WhumpaE1LevelReset3');
 assert.deepEqual(progress.recovery().position, gameplay.locators[cp3.locator].position);
 assert.equal(combat.cleared.has('L1_E1_Combat2'), true);
 assert.equal(pickups.total, 240);

 // Re-entering arena does NOT respawn defeated enemies
 combat.step(0.01, { position: arenaPos, yaw: 0, grounded: true });
 assert.equal(combat.enemies.length, 0);
});

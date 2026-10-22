import test from 'node:test';
import assert from 'node:assert/strict';
import { Combat, combatTuning } from '../src/combat.js';
import { combatRules } from '../src/combat-rules.js';

const spikeData = {
  encounters: [
    {
      id: 'L1_E1_Combat7',
      trigger: 'arena',
      requires: [],
      spawns: [{ name: 'Spike1', template: 'Characters:Spike', locator: 'spikeLoc' }]
    }
  ],
  volumes: { arena: { position: [0, 0, 0], halfExtents: [10, 10, 10], rotation: [0, 0, 0] } },
  locators: { spikeLoc: { position: [0, 0, 2], yaw: 0 } }
};

const player = { position: [0, 0, 0], yaw: 0, grounded: true };

test('Spike encounter spawns with 30 HP and initial hostile state', () => {
  const c = new Combat(spikeData);
  c.step(0.01, player);
  assert.equal(c.enemies.length, 1);
  const spike = c.enemies[0];
  assert.equal(spike.isTitan, true);
  assert.equal(spike.health, 30);
  assert.equal(spike.isStunned, false);
  assert.equal(spike.jackable, false);
});

test('Spike hostile attack damages Crash and respects invulnerability window', () => {
  const c = new Combat(spikeData);
  c.step(0.01, player);
  // Spike attacks player within range
  c.enemies[0].position = [0, 0, 1.5];
  // Step into contact window (0.7s to 1.2s)
  c.step(0.8, player);
  assert.equal(c.player.health, 85); // 90 - 5 = 85
  // Still within attack / invulnerable window: must not double-damage
  c.step(0.1, player);
  assert.equal(c.player.health, 85);
});

test('Crash light attacks damage Spike and trigger stagger reaction', () => {
  const c = new Combat(spikeData);
  c.step(0.01, player);
  const spike = c.enemies[0];
  assert.equal(spike.health, 30);

  // Attack 1: Lite A (damage 1)
  c.requestAttack();
  c.step(0.15, player);
  assert.equal(spike.health, 29);
  assert.equal(spike.state, 'hit');
  assert.equal(spike.animation, 'impact_light');

  // Complete attack A
  c.step(0.2, player);

  // Attack 2: Lite B (damage 1)
  c.requestAttack();
  c.step(0.15, player);
  assert.equal(spike.health, 28);
  assert.equal(spike.state, 'hit');

  // Complete attack B
  c.step(0.15, player);

  // Attack 3: Lite C (damage 2 then 3 = 5 total)
  c.requestAttack();
  c.step(0.15, player);
  assert.equal(spike.health, 26);
  c.step(0.25, player);
  assert.equal(spike.health, 23);
});

test('Spike transitions to stumble and stunned state when health reaches 0 (30 damage threshold)', () => {
  const c = new Combat(spikeData);
  c.step(0.01, player);
  const spike = c.enemies[0];

  // Inflict 28 damage
  spike.health = 2;

  // Hit with Lite C strike 1 (damage 2 -> health drops to 0)
  c.combo = 1;
  c.sinceAttack = 0;
  c.requestAttack();
  const events = c.step(0.15, player);

  assert.equal(spike.health, 0);
  assert.equal(spike.state, 'stumble');
  assert.equal(spike.animation, 'stumble');
  assert.equal(spike.isStunned, true);
  assert.equal(spike.jackable, true);
  assert(events.some(e => e.type === 'titanStunned'));

  // Stumble lasts 1.7s, then transitions to stunned loop
  c.step(1.8, player);
  assert.equal(spike.state, 'stunned');
  assert.equal(spike.animation, 'stun');
  assert.equal(spike.isStunned, true);
  assert.equal(spike.jackable, true);
});

test('Jacking opportunity: cannot mount while hostile; allows mounting only when stunned and nearby', () => {
  const c = new Combat(spikeData);
  c.step(0.01, player);

  // While hostile: canJack must be false, requestJack must be rejected
  assert.equal(c.canJack(player.position), false);
  assert.equal(c.requestJack(player.position), false);

  // Stun Spike
  c.enemies[0].health = 0;
  c.enemies[0].state = 'stunned';
  c.enemies[0].isStunned = true;
  c.enemies[0].jackable = true;
  c.enemies[0].position = [0, 0, 2];

  // Near Spike (2m): canJack is true, requestJack is accepted
  assert.equal(c.canJack([0, 0, 0]), true);
  assert.equal(c.requestJack([0, 0, 0]), true);

  // Far from Spike (10m): canJack is false, requestJack is rejected
  assert.equal(c.canJack([0, 0, 15]), false);
  assert.equal(c.requestJack([0, 0, 15]), false);
});

test('Checkpoint retry resets Spike to hostile state and clears stunned prompt', () => {
  const c = new Combat(spikeData);
  c.step(0.01, player);
  c.markCheckpoint();

  // Damage Spike to stun
  c.enemies[0].health = 0;
  c.enemies[0].state = 'stunned';
  c.enemies[0].isStunned = true;
  c.enemies[0].jackable = true;
  assert.equal(c.canJack(player.position), true);

  // Reset to checkpoint
  c.resetToCheckpoint();
  assert.equal(c.enemies[0].health, 30);
  assert.equal(c.enemies[0].isStunned, false);
  assert.equal(c.enemies[0].jackable, false);
  assert.equal(c.canJack(player.position), false);
});

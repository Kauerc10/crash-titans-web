import test from 'node:test';
import assert from 'node:assert/strict';
import { Combat } from '../src/combat.js';
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
  locators: { spikeLoc: { position: [10, 0, 10], yaw: 0 } }
};

const player = { position: [10, 0, 10], yaw: 0, grounded: true };

function createStunnedSpikeCombat() {
  const c = new Combat(spikeData);
  c.step(0.01, player);
  const spike = c.enemies[0];
  spike.health = 0;
  spike.state = 'stunned';
  spike.isStunned = true;
  spike.jackable = true;
  spike.position = [10, 0, 10];
  spike.yaw = 0;
  return { c, spike };
}

test('Source rules: Spike speed and dismount distance match PS2 extraction', () => {
  assert.equal(combatRules.spike.jackedSpeed, 11.3);
  assert.equal(combatRules.spike.dismountDistance, 1.5);
});

test('Jack acceptance: mounts once during valid stunned opportunity, consumes opportunity', () => {
  const { c, spike } = createStunnedSpikeCombat();

  assert.equal(c.canJack(player.position), true);
  assert.equal(c.isJacked, false);

  const mounted = c.requestJack(player.position);
  assert.equal(mounted, true);
  assert.equal(c.isJacked, true);
  assert.equal(spike.isJacked, true);
  assert.equal(spike.jackable, false);
  assert.equal(spike.isStunned, false);
  assert.equal(spike.state, 'jacked');

  // Attempting to jack again while mounted is rejected for jacking
  assert.equal(c.canJack(player.position), false);
});

test('Mounted locomotion: direction controls Spike velocity, yaw, and animation at 11.3 m/s', () => {
  const { c, spike } = createStunnedSpikeCombat();
  c.requestJack(player.position);

  // Move forward (+Z in Three.js world / yaw 0)
  c.step(0.1, player, { direction: [0, 1] });
  assert.equal(spike.motion[0], 0);
  assert.equal(spike.motion[1], 11.3);
  assert.equal(spike.yaw, 0);
  assert.equal(spike.animation, 'run');

  // Move right (+X)
  c.step(0.1, player, { direction: [1, 0] });
  assert.equal(spike.motion[0], 11.3);
  assert.equal(spike.motion[1], 0);
  assert.equal(spike.yaw, Math.PI / 2);
  assert.equal(spike.animation, 'run');

  // Stop input
  c.step(0.1, player, { direction: [0, 0] });
  assert.deepEqual(spike.motion, [0, 0]);
  assert.equal(spike.animation, 'idle');
});

test('No simultaneous Crash actions: Crash light attack combo is disabled while mounted', () => {
  const { c } = createStunnedSpikeCombat();
  c.requestJack(player.position);

  // Crash tries to attack on foot
  const attackAllowed = c.requestAttack();
  assert.equal(attackAllowed, false);
  assert.equal(c.queued, false);
  assert.equal(c.attack, null);

  const heavyAllowed = c.requestHeavyAttack();
  assert.equal(heavyAllowed, false);
  assert.equal(c.queuedHeavy, false);
});

test('Dismount: exits titan, restores idle state, and places Crash in valid rear position', () => {
  const { c, spike } = createStunnedSpikeCombat();
  spike.position = [20, 5, 30];
  spike.yaw = 0; // facing +Z

  // Position player near Spike so mount succeeds
  const mountPos = [20, 5, 30];
  const mounted = c.requestJack(mountPos);
  assert.equal(mounted, true);
  assert.equal(c.isJacked, true);

  // Dismount via requestDismount or pressing jack button again (no args)
  const dismounted = c.requestDismount();
  assert.equal(dismounted, true);
  assert.equal(c.isJacked, false);
  assert.equal(spike.isJacked, false);
  assert.equal(spike.state, 'idle');
  assert.equal(spike.animation, 'idle');
  assert.deepEqual(spike.motion, [0, 0]);

  // Check event emitted
  const dismountEvent = c.events.find(e => e.type === 'titanDismounted');
  assert(dismountEvent, 'titanDismounted event must be emitted');
  assert.equal(dismountEvent.id, spike.id);

  // Position must be 1.5m behind Spike (facing yaw=0 means behind is -Z)
  assert.equal(dismountEvent.position[0], 20);
  assert.equal(dismountEvent.position[1], 5);
  assert.equal(dismountEvent.position[2], 28.5); // 30 - 1.5 = 28.5
});

test('Simulated Gamepad API: button 1 (Circle/B) jacks and dismounts; analog axes drive titan motion', () => {
  const { c, spike } = createStunnedSpikeCombat();

  // Simulated Gamepad with Circle/B button
  const simulatedPad = {
    mapping: 'standard',
    buttons: [{ pressed: false }, { pressed: true }, { pressed: false }], // button 1 = Circle/B
    axes: [0, 0]
  };

  // Mount via gamepad button 1
  if (simulatedPad.buttons[1].pressed && c.canJack(player.position)) {
    c.requestJack(player.position);
  }
  assert.equal(c.isJacked, true);

  // Move with analog stick (axes[0] = 0.8, axes[1] = 0.6)
  simulatedPad.axes = [0.8, 0.6];
  const axisLen = Math.hypot(simulatedPad.axes[0], simulatedPad.axes[1]);
  const normX = simulatedPad.axes[0] / axisLen;
  const normZ = simulatedPad.axes[1] / axisLen;

  c.step(0.1, player, { direction: [normX, normZ] });
  assert.equal(spike.animation, 'run');
  const totalSpeed = Math.hypot(spike.motion[0], spike.motion[1]);
  assert(Math.abs(totalSpeed - 11.3) < 0.001);

  // Dismount via gamepad button 1
  if (simulatedPad.buttons[1].pressed && c.isJacked) {
    c.requestDismount();
  }
  assert.equal(c.isJacked, false);
});

test('Pause and Checkpoint retry: pause preserves jack; checkpoint rollback resets jack consistently', () => {
  const c = new Combat(spikeData);
  c.step(0.01, player);
  // Mark checkpoint while hostile (30 HP)
  c.markCheckpoint();

  // Damage to stun
  const spike = c.enemies[0];
  spike.health = 0;
  spike.state = 'stunned';
  spike.isStunned = true;
  spike.jackable = true;

  // Mount Spike
  c.requestJack(player.position);
  assert.equal(c.isJacked, true);

  // Pause step (dt = 0, no input)
  c.step(0, player, null);
  assert.equal(c.isJacked, true);
  assert.equal(spike.isJacked, true);

  // Player dies or checkpoint retry requested
  c.resetToCheckpoint();
  assert.equal(c.isJacked, false);
  assert.equal(c.jackedTitan, null);
  assert.equal(c.enemies[0].isJacked, false);
  assert.equal(c.enemies[0].health, 30); // reset to initial hostile state saved at checkpoint
});

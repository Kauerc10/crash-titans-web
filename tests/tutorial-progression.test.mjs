import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TutorialManager } from '../src/tutorials.js';
import { EpisodeProgress } from '../src/episode.js';

const gameplay = JSON.parse(await readFile(new URL('../public/assets/levels/l1-e1/gameplay.json', import.meta.url)));

test('1. Confirmar caminho, tutoriais, pré-requisitos e posição da primeira interação com Spike', () => {
  assert(Array.isArray(gameplay.tutorials), 'gameplay.tutorials is an array');
  assert.equal(gameplay.tutorials.length, 10, 'Expected 10 defined tutorials in L1_E1');

  // Verify tutorial IDs
  const expectedIds = [
    'Tutorial_Hint_Movement',
    'Tutorial_Hint_LightAttack',
    'Tutorial_Tutorial_Mojo1',
    'Tutorial_Tutorial_AirJump',
    'Tutorial_Tutorial_BouncePad',
    'MultiplyTutorial',
    'Tutorial_Hint_SpinHover',
    'Tutorial_Hint_BlockBreaker',
    'Tutorial_Tutorial_Jack',
    'SpikeCinematic'
  ];
  for (const id of expectedIds) {
    const tut = gameplay.tutorials.find(t => t.id === id);
    assert(tut, `Tutorial ${id} is defined`);
    assert(tut.texts.keyboard, `Tutorial ${id} has keyboard text`);
    assert(tut.texts.gamepad, `Tutorial ${id} has gamepad text`);
    assert(tut.texts.ps2, `Tutorial ${id} has ps2 text`);
  }

  // Verify prerequisites
  const movementTut = gameplay.tutorials.find(t => t.id === 'Tutorial_Hint_Movement');
  assert.deepEqual(movementTut.requires, ['NIS01']);

  const airJumpTut = gameplay.tutorials.find(t => t.id === 'Tutorial_Tutorial_AirJump');
  assert(airJumpTut.requires.includes('L1_E1_Combat2'), 'AirJump tutorial requires Combat2 victory');

  const blockBreakerTut = gameplay.tutorials.find(t => t.id === 'Tutorial_Hint_BlockBreaker');
  assert(blockBreakerTut.requires.includes('L1_E1_Combat2'), 'BlockBreaker tutorial requires Combat2 victory');

  // Verify Spike interaction volume and position
  const spikeTut = gameplay.tutorials.find(t => t.id === 'SpikeCinematic');
  assert(spikeTut.requires.includes('L1_E1_Combat2'), 'SpikeCinematic requires Combat2 victory');
  assert.equal(spikeTut.trigger, 'PlaySpike');

  const playSpikeVol = gameplay.volumes['PlaySpike'];
  assert(playSpikeVol, 'PlaySpike volume exists');
  assert(Math.abs(playSpikeVol.position[0] - (-200.165)) < 0.1, 'PlaySpike X around -200.16');
  assert(Math.abs(playSpikeVol.position[1] - 91.98) < 0.1, 'PlaySpike Y around 91.98');
  assert(Math.abs(playSpikeVol.position[2] - (-206.61)) < 0.1, 'PlaySpike Z around -206.61');

  // Checkpoint 24 precedes Spike
  const cp24 = gameplay.checkpoints.find(c => c.id === 'WhumpaE1LevelReset24');
  assert(cp24, 'WhumpaE1LevelReset24 exists');
  assert(cp24.requires.includes('L1_E1_Combat2'), 'Checkpoint 24 requires Combat2 victory');
  const cp24Loc = gameplay.locators[cp24.locator];
  assert(Math.abs(cp24Loc.position[0] - (-198.26)) < 0.1, 'Checkpoint 24 locator X matches');
});

test('2. Exibir instruções contextuais com comandos corretos para teclado e controle', () => {
  const manager = new TutorialManager(gameplay);
  const progress = new EpisodeProgress(gameplay);
  progress.complete('NIS01');
  progress.complete('L1_E1_Combat2');

  // Default input mode is keyboard
  assert.equal(manager.inputMode, 'keyboard');

  // Trigger Air Jump tutorial (prop L1_E1_TutStone4)
  const airJumpTut = gameplay.tutorials.find(t => t.id === 'Tutorial_Tutorial_AirJump');
  const events = manager.step(0.1, airJumpTut.position, progress);
  const startEv = events.find(e => e.type === 'tutorialStarted');
  assert(startEv, 'Air Jump tutorial started');
  assert(startEv.text.includes('ESPAÇO'), 'Keyboard prompt mentions ESPAÇO');
  assert(!startEv.text.includes('✕ (A)'), 'Keyboard prompt does not show gamepad glyphs');

  // Switch to gamepad while prompt is active
  manager.setInputMode('gamepad');
  assert.equal(manager.inputMode, 'gamepad');
  assert(manager.active.text.includes('✕, ✕ (A, A)'), 'Active text immediately switched to gamepad glyphs');

  // Switch back to keyboard
  manager.setInputMode('keyboard');
  assert(manager.active.text.includes('ESPAÇO, ESPAÇO'), 'Active text immediately switched back to keyboard');
});

test('3. Não bloquear a progressão por prompt encerrado, pausa ou troca do dispositivo', () => {
  const manager = new TutorialManager(gameplay);
  const progress = new EpisodeProgress(gameplay);
  progress.complete('NIS01');
  progress.complete('L1_E1_Combat2');

  // Trigger Block Breaker hint volume L1_E1_Hint8
  const volPos = gameplay.volumes['L1_E1_Hint8'].position;
  const startEvents = manager.step(0.1, volPos, progress);
  assert(startEvents.some(e => e.type === 'tutorialStarted'));
  assert(manager.active, 'Prompt is active');
  const duration = manager.active.duration;

  // Step 2 seconds forward
  manager.step(2.0, volPos, progress);
  assert(manager.active, 'Prompt is still active after 2s');

  // Pause game for 10 seconds (simulated)
  manager.pause(true);
  for (let i = 0; i < 100; i++) {
    manager.step(0.1, volPos, progress); // Stepping while paused does not advance timer
  }
  assert(manager.active, 'Prompt did not expire during pause');

  // Resume game
  manager.pause(false);

  // Switch device during active prompt
  manager.setInputMode('gamepad');
  assert(manager.active, 'Prompt remains active through device switch');

  // Step remaining time (duration - 2s = 3s + small delta)
  const endEvents = manager.step(3.1, volPos, progress);
  assert(endEvents.some(e => e.type === 'tutorialEnded'), 'tutorialEnded event emitted on expiration');
  assert.equal(manager.active, null, 'Active prompt cleanly dismissed');
});

test('4. Evitar repetição indevida de tutoriais ao revisitar o trecho', () => {
  const manager = new TutorialManager(gameplay);
  const progress = new EpisodeProgress(gameplay);
  progress.complete('NIS01');
  progress.complete('L1_E1_Combat2');
  manager.complete('Tutorial_Hint_Movement');

  // First visit to stone 4 triggers tutorial
  const stone4Pos = gameplay.tutorials.find(t => t.id === 'Tutorial_Tutorial_AirJump').position;
  const firstVisit = manager.step(0.1, stone4Pos, progress);
  assert.equal(firstVisit.filter(e => e.type === 'tutorialStarted').length, 1);

  // Dismiss prompt
  manager.step(10.0, stone4Pos, progress);
  assert.equal(manager.active, null);

  // Revisiting stone 4 does NOT re-trigger
  const secondVisit = manager.step(0.1, stone4Pos, progress);
  assert.equal(secondVisit.filter(e => e.type === 'tutorialStarted').length, 0, 'No re-trigger on revisit');

  // Checkpoint consolidation
  manager.markCheckpoint();

  // Trigger next hint (BlockBreaker)
  const hint8Pos = gameplay.volumes['L1_E1_Hint8'].position;
  manager.step(0.1, hint8Pos, progress);
  assert(manager.isCompleted('Tutorial_Hint_BlockBreaker'));

  // Reset to checkpoint: earlier tutorial (AirJump) stays completed; state rolls back cleanly
  manager.resetToCheckpoint();
  assert(manager.isCompleted('Tutorial_Tutorial_AirJump'), 'AirJump stays completed');
  assert(!manager.isCompleted('Tutorial_Hint_BlockBreaker'), 'Unconsolidated hint is reset for re-attempt');
  assert.equal(manager.active, null);
});

test('5. Chegar à interação com Spike pelo caminho normal e verificar seus pré-requisitos', () => {
  const manager = new TutorialManager(gameplay);
  const progress = new EpisodeProgress(gameplay);
  progress.complete('NIS01');

  const playSpikePos = gameplay.volumes['PlaySpike'].position;

  // Case A: Attempting to reach Spike before Combat 2 is defeated -> Blocked!
  const prematureVisit = manager.step(0.1, playSpikePos, progress);
  const blockedEv = prematureVisit.find(e => e.type === 'spikeInteractionBlocked');
  assert(blockedEv, 'spikeInteractionBlocked event emitted');
  assert.equal(manager.spikeReached, false);
  assert.equal(progress.completed.has('SpikeCinematic'), false);

  // Case B: Crash wins Combat 2 and walks the normal route
  progress.complete('L1_E1_Combat2');

  // Reaching Checkpoint 24
  const cp24 = gameplay.checkpoints.find(c => c.id === 'WhumpaE1LevelReset24');
  const reached = progress.visit(gameplay.volumes[cp24.trigger].position);
  assert(reached.some(c => c.id === 'WhumpaE1LevelReset24'), 'Checkpoint 24 reached on normal route');

  // Entering PlaySpike volume triggers Spike interaction
  const spikeVisit = manager.step(0.1, playSpikePos, progress);
  const reachedEv = spikeVisit.find(e => e.type === 'spikeInteractionReached');
  assert(reachedEv, 'spikeInteractionReached emitted');
  assert.equal(reachedEv.id, 'SpikeCinematic');
  assert.equal(manager.spikeReached, true);
  assert.equal(progress.completed.has('SpikeCinematic'), true);
});

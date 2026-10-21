import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, normalizeProfiles, cleanName, createProfile, load, persist } from '../src/state.js';

test('corrupt or older settings cannot create invalid ranges or unknown modes', () => {
  const result = normalizeSettings({ widescreen: 'yes', music: 9, effects: -3, brightness: NaN, sound: 'dolby', language: 'xx' });
  assert.equal(result.widescreen, false); assert.equal(result.music, 1); assert.equal(result.effects, 0); assert.equal(result.brightness, 1); assert.equal(result.sound, 'stereo'); assert.equal(result.language, 'en');
  assert.equal(normalizeSettings(null).language, 'en');
});
test('profiles use five isolated slots, validate names and cannot claim game progress', () => {
  const before = Array(5).fill(null);
  const first = createProfile(before, 2, '  Crash<script>  ', 'hard', 1234);
  assert.equal(first[2].name, 'Crashscript'); assert.equal(first[2].status, 'menu-only'); assert.equal(before[2], null);
  const next = createProfile(first, 3, 'Suelen', 'normal', 1500);
  assert.equal(next[2].name, 'Crashscript'); assert.equal(next[3].name, 'Suelen'); assert.equal(next.length, 5);
  assert.throws(() => createProfile(next, 5, 'Crash', 'easy'));
  assert.throws(() => createProfile(next, 0, '!!!', 'easy'));
  assert.throws(() => createProfile(next, 0, 'Crash', 'unknown'));
  assert.equal(cleanName('áéíóú çã').length, 8);
  assert.equal(normalizeProfiles([{ name: 'Bad', difficulty: 'hard', createdAt: 'date' }])[0], null);
});
test('storage failures keep the menu usable and are reported to callers', () => {
  const corrupt = { getItem: () => '{broken' };
  assert.equal(load(corrupt, 'x', normalizeSettings).music, .65);
  const unavailable = { getItem() { throw Error(); }, setItem() { throw Error(); } };
  assert.deepEqual(load(unavailable, 'x', normalizeProfiles), Array(5).fill(null));
  assert.equal(persist(unavailable, 'x', {}), false);
});

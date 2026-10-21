import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseByteRange } from '../src/range.js';
test('video byte ranges support metadata, seeking, suffixes and EOF clipping', () => {
  assert.equal(parseByteRange(undefined, 100), null);
  assert.deepEqual(parseByteRange('bytes=0-15', 100), { start: 0, end: 15 });
  assert.deepEqual(parseByteRange('bytes=80-', 100), { start: 80, end: 99 });
  assert.deepEqual(parseByteRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(parseByteRange('bytes=98-200', 100), { start: 98, end: 99 });
  for (const bad of ['bytes=100-101','bytes=9-1','bytes=-0','bytes=','bytes=1-2,4-5','garbage']) assert.equal(parseByteRange(bad, 100), false);
});

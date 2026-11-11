import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNum } from '../../src/sim/format.ts';

test('formatNum', () => {
  assert.equal(formatNum(0), '0');
  assert.equal(formatNum(999), '999');
  assert.equal(formatNum(12.7), '12');
  assert.equal(formatNum(1234), '1.23K');
  assert.equal(formatNum(45_600_000), '45.6M');
  assert.equal(formatNum(7.8e9), '7.80B');
  assert.equal(formatNum(1.5e12), '1.50T');
  assert.equal(formatNum(2e15), '2.00aa');
  assert.equal(formatNum(3e18), '3.00ab');
  assert.equal(formatNum(1e15 * 1000 ** 26), '1.00ba');
  assert.equal(formatNum(Infinity), '∞');
  assert.equal(formatNum(NaN), '0');
  assert.equal(formatNum(-5), '0');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../../src/sim/state.ts';
import { chooseSave, NEWER_MS } from '../../src/save/chooseSave.ts';

const NOW = 1_000_000;

test('chooseSave: server load failed -> no server writes', () => {
  const local = { ...newState(NOW - 50_000), coins: 7 };
  const a = chooseSave(null, local, null, NOW);
  assert.equal(a.cloudOk, false);
  assert.equal(a.source, 'local');
  assert.equal(a.state, local);
  const b = chooseSave(null, null, { ...newState(0), coins: 99 }, NOW);
  assert.equal(b.cloudOk, false);
  assert.equal(b.source, 'new');
  assert.equal(b.state.coins, 0);
});

test('chooseSave: server save wins unless local is clearly newer', () => {
  const server = { ...newState(NOW - 20_000), coins: 500 };
  const older = { ...newState(NOW - 30_000), coins: 1 };
  const a = chooseSave({ save: server, now: NOW }, older, null, NOW);
  assert.equal(a.source, 'server');
  assert.equal(a.cloudOk, true);
  assert.equal(a.state.coins, 500);
  const slightly = { ...newState(NOW - 20_000 + NEWER_MS - 1), coins: 2 };
  assert.equal(chooseSave({ save: server, now: NOW }, slightly, null, NOW).source, 'server');
  const newer = { ...newState(NOW - 1000), coins: 3 };
  const c = chooseSave({ save: server, now: NOW }, newer, null, NOW);
  assert.equal(c.source, 'local');
  assert.equal(c.cloudOk, true);
});

test('chooseSave: first login takes account copy, then guest copy, then new', () => {
  const local = { ...newState(NOW), coins: 4 };
  const guest = { ...newState(NOW), coins: 8 };
  assert.equal(chooseSave({ save: null, now: NOW }, local, guest, NOW).source, 'local');
  const g = chooseSave({ save: null, now: NOW }, null, guest, NOW);
  assert.equal(g.source, 'guest');
  assert.equal(g.state.coins, 8);
  assert.equal(g.cloudOk, true);
  const n = chooseSave({ save: null, now: NOW }, null, null, NOW);
  assert.equal(n.source, 'new');
  assert.equal(n.cloudOk, true);
});

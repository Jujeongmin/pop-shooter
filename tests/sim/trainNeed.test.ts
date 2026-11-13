import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../../src/sim/state.ts';
import { nextClearable, trainNeeds } from '../../src/sim/trainNeed.ts';

test('training colors: red/orange while the next stage is out of reach, green when it is clearable', () => {
  const weak = newState(0);
  assert.ok(!nextClearable(weak));
  const n = trainNeeds(weak);
  assert.ok((n.atk === 'red' && n.spd !== 'red') || (n.spd === 'red' && n.atk !== 'red'));
  const strong = { ...newState(0), trAtk: 1e30 };
  assert.ok(nextClearable(strong));
  assert.deepEqual(trainNeeds(strong), { atk: 'green', spd: 'green' });
});

test('treadmill trains fire rate until it is maxed, then Attack at the range speed', async () => {
  const { treadmillTraining, trainRate } = await import('../../src/sim/actions.ts');
  const { BALANCE } = await import('../../src/sim/balance.ts');
  const s = newState(0);
  assert.deepEqual(treadmillTraining(s, 4), { kind: 'spd', n: 4 });
  const maxed = { ...newState(0), trSpd: BALANCE.train.spdMax };
  const r = treadmillTraining(maxed, 4);
  assert.equal(r.kind, 'atk');
  assert.equal(r.n, (4 * trainRate(maxed, 'atk')) / trainRate(maxed, 'spd'));
});

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

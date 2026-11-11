import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveWithColliders, type Collider } from '../../src/world/movement.ts';
import { nearestFacility, WORLD1_FACILITIES } from '../../src/world/facilities.ts';

test('blocked by circle', () => {
  const c: Collider[] = [{ kind: 'circle', x: 0, z: 2, r: 1 }];
  const p = moveWithColliders(0, 0, 0, 3, 0.4, c, { hx: 50, hz: 50 });
  assert.ok(p.z <= 2 - 1 - 0.4 + 1e-6);
});

test('slides along box', () => {
  const c: Collider[] = [{ kind: 'box', x: 0, z: 1, hx: 5, hz: 0.5 }];
  const p = moveWithColliders(0, 0, 1, 1, 0.4, c, { hx: 50, hz: 50 });
  assert.ok(p.x > 0.9 && p.z <= 0.5 - 0.4 + 1e-6);
});

test('bounds', () => {
  const p = moveWithColliders(0, 0, 100, 0, 0.4, [], { hx: 10, hz: 10 });
  assert.ok(p.x <= 10 - 0.4 + 1e-6);
});

test('no tunnelling through thin box at high speed', () => {
  const c: Collider[] = [{ kind: 'box', x: 0, z: 5, hx: 5, hz: 0.1 }];
  const p = moveWithColliders(0, 0, 0, 20, 0.4, c, { hx: 50, hz: 50 });
  assert.ok(p.z < 5);
});

test('nearestFacility', () => {
  const f = WORLD1_FACILITIES[0]!;
  assert.equal(nearestFacility(f.x, f.z, WORLD1_FACILITIES)!.id, f.id);
  assert.equal(nearestFacility(9999, 9999, WORLD1_FACILITIES), null);
  // 스테이지 입구는 월드마다 포털 하나 (연속 도전)
  assert.equal(WORLD1_FACILITIES.filter((x) => x.id === 'portal').length, 1);
  assert.ok(!WORLD1_FACILITIES.some((x) => x.id.startsWith('gate')));
  for (const id of ['range', 'upgrade', 'guns', 'altar']) assert.ok(WORLD1_FACILITIES.some((x) => x.id === id));
});

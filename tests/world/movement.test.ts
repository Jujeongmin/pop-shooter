import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveWithColliders, type Collider } from '../../src/world/movement.ts';
import { beltRunPose, nearestFacility, TREADMILL, TREADMILL_RUN_SPEED, WORLD1_FACILITIES } from '../../src/world/facilities.ts';

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
  for (const id of ['range', 'upgrade', 'guns']) assert.ok(WORLD1_FACILITIES.some((x) => x.id === id));
  assert.ok(!WORLD1_FACILITIES.some((x) => (x.id as string) === 'altar'));
});

// 2026-11-16 배포본: 러닝머신 위 다른 사람이 서 있음 (그쪽 앱이 백그라운드·화면 꺼짐이면 패킷이 끊겨 속도 0 → 대기 자세)
test('beltRunPose: someone standing still on the belt runs in place; moving or off the belt is left alone', () => {
  const still = { x: TREADMILL.x, z: TREADMILL.z, vx: 0, vz: 0, yaw: 0.5 };
  assert.equal(beltRunPose(still), true);
  assert.deepEqual(still, { x: TREADMILL.x, z: TREADMILL.z, vx: 0, vz: -TREADMILL_RUN_SPEED, yaw: Math.PI });
  // 벨트에서 옆으로 걸어 내려가는 중: 받은 값 그대로
  const walking = { x: TREADMILL.x, z: TREADMILL.z, vx: 2, vz: 0, yaw: 1.2 };
  assert.equal(beltRunPose(walking), false);
  assert.deepEqual(walking, { x: TREADMILL.x, z: TREADMILL.z, vx: 2, vz: 0, yaw: 1.2 });
  // 벨트 밖에 서 있음: 그대로
  const off = { x: TREADMILL.x, z: TREADMILL.z + 3, vx: 0, vz: 0, yaw: 0 };
  assert.equal(beltRunPose(off), false);
  assert.equal(off.vz, 0);
});

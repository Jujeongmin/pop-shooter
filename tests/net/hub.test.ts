import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HUB_AREA, HUB_CHARS, HUB_GUN_COUNT, HUB_MOVE, HUB_SNAPS, HUB_WORLDS, HUB_OPEN_WORLDS, isHubWorld, hubMoveOk, hubRoomId, hubWorldOf, isHubRoom, sanitizeHubField, sanitizeHubPacket, type HubPacket } from '../../src/net/shared/hub.ts';
import { HUB_BOUNDS, HUB_SPAWN, PORTAL_SPOT, WORLD1_FACILITIES } from '../../src/world/facilities.ts';
import { CHAR_IDS } from '../../src/sim/state.ts';
import { BALANCE } from '../../src/sim/balance.ts';

test('shared hub constants match the game config', () => {
  assert.equal(HUB_AREA.hx, HUB_BOUNDS.hx);
  assert.equal(HUB_AREA.hz, HUB_BOUNDS.hz);
  assert.deepEqual(HUB_AREA.spawn, HUB_SPAWN);
  assert.deepEqual([...HUB_CHARS].sort(), [...CHAR_IDS].sort());
  assert.equal(HUB_GUN_COUNT, BALANCE.gun.count);
  assert.equal(HUB_WORLDS, BALANCE.stage.worlds);
  // core/Game.ts MOVE_SPEED = 5.76 (Game.ts는 three.js 의존이라 node 테스트에서 못 읽음)
  assert.ok(HUB_MOVE.maxSpeed >= 5.76 * 1.3);
  // 모든 시설 자리·전투 복귀·시작 지점이 순간이동 허용 구역에 있음
  for (const f of WORLD1_FACILITIES) assert.ok(HUB_SNAPS.some((s) => Math.hypot(s.x - f.x, s.z - f.z) <= s.r), f.id);
  assert.ok(HUB_SNAPS.some((s) => s.x === PORTAL_SPOT.x && s.z === PORTAL_SPOT.z + 3.2));
  assert.ok(HUB_SNAPS.some((s) => s.x === HUB_SPAWN.x && s.z === HUB_SPAWN.z));
});

test('room ids carry the world number', () => {
  assert.equal(hubRoomId(1, 3), 'w1-3');
  assert.ok(isHubRoom('w1-1'));
  assert.ok(isHubRoom('w1-9999'));
  for (const bad of ['lb-1', 'w0-1', 'w9-1', 'w1-', 'w1-12345', 'pb-abc', '__no_room__', null, undefined]) assert.ok(!isHubRoom(bad), String(bad));
  assert.equal(hubWorldOf('w1-7'), 1);
  assert.equal(hubWorldOf('w8-7'), 8);
  assert.equal(hubWorldOf('w9-7'), 0); // 없는 월드
  assert.deepEqual(HUB_OPEN_WORLDS, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(isHubWorld(1) && isHubWorld(8) && !isHubWorld(9) && !isHubWorld(0));
  assert.equal(hubWorldOf('lb-1'), 0);
});

test('field validation', () => {
  assert.equal(sanitizeHubField('c', 'pink'), 'pink');
  assert.equal(sanitizeHubField('c', 'nope'), undefined);
  assert.equal(sanitizeHubField('g', 31), 31);
  assert.equal(sanitizeHubField('g', 32), undefined);
  assert.equal(sanitizeHubField('g', 2.5), undefined);
  assert.equal(sanitizeHubField('r', 0), 0);
  assert.equal(sanitizeHubField('r', -1), undefined);
  assert.equal(sanitizeHubField('pw', 1e200), 1e200);
  assert.equal(sanitizeHubField('pw', Infinity), undefined);
  assert.equal(sanitizeHubField('pw', '5'), undefined);
  assert.equal(sanitizeHubField('s', 'battle'), 'battle');
  assert.equal(sanitizeHubField('s', 'pvp'), undefined);
});

test('packet validation and move rules', () => {
  assert.equal(sanitizeHubPacket([1, 2, 3]), null);
  assert.equal(sanitizeHubPacket([1, 0, 20, 0, 0, 0, 0, 0]), null);
  assert.deepEqual(sanitizeHubPacket([1, 0, 15.8, -15.9, 0, 0, 0, 7]), [1, 0, 15.5, -15.5, 0, 0, 0, 3]);
  const at = (x: number, z: number): HubPacket => [0, 0, x, z, 0, 0, 0, 0];
  assert.ok(hubMoveOk(undefined, 0, at(5, 5), 1000));
  assert.ok(hubMoveOk(at(0, 0), 0, at(0, 2.5), 166));
  assert.ok(!hubMoveOk(at(0, 0), 0, at(6, 0), 166));
  // 전투 복귀·시작 지점은 어디서든, 사격장 판은 가까운 곳에서만
  assert.ok(hubMoveOk(at(10, 10), 0, at(0, -3.3), 100));
  assert.ok(hubMoveOk(at(-14, -14), 0, at(0, 6), 100));
  assert.ok(hubMoveOk(at(-6, 2), 0, at(-10.5, 0), 100));
  assert.ok(!hubMoveOk(at(10, 10), 0, at(-9, 1), 100));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HubBuffer, type HubSample } from '../../src/net/hubBuffer.ts';
import { accountUnit, battleSpot } from '../../src/net/peerView.ts';
import { PORTAL_SPOT } from '../../src/world/facilities.ts';
import type { HubPacket } from '../../src/net/shared/hub.ts';

const pkt = (q: number, t: number, x: number, z: number, vx = 0, vz = 0, f = 0, yaw = 0): HubPacket => [q, t, x, z, yaw, vx, vz, f];
const out = (): HubSample => ({ x: 0, z: 0, yaw: 0, vx: 0, vz: 0, f: 0 });

test('hub buffer interpolates between packets on the local clock', () => {
  const b = new HubBuffer();
  // 보낸 쪽 시각 1000·1166, 받은 시각 5000·5166 → 오프셋 4000
  b.push(pkt(1, 1000, 0, 0, 6, 0, 1), 5000);
  b.push(pkt(2, 1166, 1, 0, 6, 0, 1), 5166);
  const s = out();
  assert.ok(b.sample(5083, s));
  assert.ok(Math.abs(s.x - 0.5) < 0.01); // 오프셋이 1초마다 0.5ms 늦춰지는 만큼 오차
  assert.equal(s.vx, 6);
  // 최신보다 앞서면 최대 150ms 외삽
  b.sample(5166 + 1000, s);
  assert.ok(Math.abs(s.x - (1 + 6 * 0.15)) < 1e-9);
  // 오래 소식이 없으면 멈춘 것으로 (제자리 달리기 없음)
  assert.equal(s.vx, 0);
  assert.equal(s.f & 1, 0);
});

test('hub buffer drops old or duplicate sequence numbers, restarts after a reload, and snaps on teleports', () => {
  const b = new HubBuffer();
  b.push(pkt(5, 1000, 0, 0), 2000);
  b.push(pkt(5, 1100, 9, 9), 2100);
  b.push(pkt(4, 1200, 9, 9), 2200);
  assert.equal(b.size, 1);
  // 보낸 쪽이 새로고침해 순번이 처음부터 (1000 넘게 작아짐)
  const c = new HubBuffer();
  c.push(pkt(5000, 1000, 0, 0), 2000);
  c.push(pkt(1, 50, 3, 3), 2100);
  assert.equal(c.size, 1);
  assert.equal(c.lastSeq, 1);
  // 4m 넘는 이동은 보간하지 않고 바로
  const d = new HubBuffer();
  d.push(pkt(1, 0, 0, 6), 100);
  d.push(pkt(2, 166, 0, -3.3), 266);
  const s = out();
  d.sample(150, s);
  assert.equal(s.z, 6);
  d.sample(250, s);
  assert.equal(s.z, -3.3);
});

test('hub buffer keeps a bounded ring (no growth over a long session)', () => {
  const b = new HubBuffer();
  for (let i = 1; i <= 500; i++) b.push(pkt(i, i * 166, (i % 10) * 0.1, 0), 10_000 + i * 166);
  assert.ok(b.size <= 16);
  const s = out();
  assert.ok(b.sample(10_000 + 500 * 166 - 280, s));
  assert.ok(Number.isFinite(s.x));
});

test('battle spot is in front of the portal and stable per account', () => {
  const a = { x: 0, z: 0, yaw: 0 };
  const b = { x: 0, z: 0, yaw: 0 };
  for (const acc of ['pstestA', 'pstestB', 'x', '']) {
    battleSpot(acc, a);
    battleSpot(acc, b);
    assert.deepEqual(a, b);
    const d = Math.hypot(a.x - PORTAL_SPOT.x, a.z - PORTAL_SPOT.z);
    assert.ok(d >= 1.2 && d <= 2.0 + 1e-9, `${acc} ${d}`);
    // 포털 고리(북, -z)와 광장 사이 = PORTAL_SPOT 남쪽 반원
    assert.ok(a.z >= PORTAL_SPOT.z - 1e-9);
    const u = accountUnit(acc);
    assert.ok(u >= 0 && u < 1);
  }
});

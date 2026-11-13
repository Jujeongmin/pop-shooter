import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRE_VIS_MAX, FireGroup } from '../../src/fx/fireGroup.ts';

/** 10초 동안 1/60초씩: 발사 횟수·총알 합 */
function run(sps: number, fromRate: boolean): { events: number; bullets: number; maxPer: number } {
  const g = new FireGroup();
  const out: number[] = [];
  let events = 0, bullets = 0, maxPer = 0;
  for (let i = 0; i < 600; i++) {
    if (!fromRate) g.add(sps / 60);
    for (const n of g.step(1 / 60, sps, out, fromRate)) { events++; bullets += n; maxPer = Math.max(maxPer, n); }
  }
  return { events, bullets, maxPer };
}

test('up to 12 shots per second: one bullet each', () => {
  const r = run(6, true);
  assert.ok(Math.abs(r.events - 60) <= 1 && r.maxPer === 1);
});

test('20 shots per second: 12 shots a second, bullets still 20 a second (some shots carry 2)', () => {
  const r = run(20, true);
  assert.ok(r.events <= FIRE_VIS_MAX * 10 + 1, `events ${r.events}`);
  assert.ok(Math.abs(r.bullets - 200) <= 2, `bullets ${r.bullets}`);
  assert.equal(r.maxPer, 2);
});

test('battle mode only spends bullets it was given', () => {
  const r = run(50, false);
  assert.ok(Math.abs(r.bullets - 500) <= 6, `bullets ${r.bullets}`);
  assert.ok(r.events <= FIRE_VIS_MAX * 10 + 1);
});

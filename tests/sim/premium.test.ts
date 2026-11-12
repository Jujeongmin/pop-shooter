import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AD_LIMIT, BOOST_AD_MS, BOOST_CAP_MS, claimAd, dayKey, GEM_BOOST, GIFT_GEMS, grantPurchase, nextPassProduct, PRODUCTS, readPrem, spendGemBoost,
} from '../../src/sim/premium.ts';
import { checkSave } from '../../src/sim/econ.ts';
import { newState } from '../../src/sim/state.ts';

const NOW = Date.UTC(2026, 10, 12, 10, 0, 0);

test('readPrem fills defaults and drops junk', () => {
  const p = readPrem(null);
  assert.deepEqual([p.gems, p.passMult, p.boostUntil, p.extra], [0, 1, 0, 0]);
  assert.deepEqual(p.paid, []);
  const q = readPrem({ gems: -5, passMult: 3, paid: ['white', 'zzz'], adIds: ['a', 5], buys: 'x' });
  assert.equal(q.gems, 0);
  assert.equal(q.passMult, 1);
  assert.deepEqual(q.paid, ['white']);
  assert.deepEqual(q.adIds, ['a']);
  assert.deepEqual(q.buys, []);
});

test('boost ad adds 15 min, stacks up to 2 hours, daily limit, one reward per ad id', () => {
  let p = readPrem(null);
  const r1 = claimAd(p, 'boost', 'ad-1', NOW, 0);
  assert.ok(r1.ok);
  if (!r1.ok) return;
  assert.equal(r1.prem.boostUntil, NOW + BOOST_AD_MS);
  assert.equal(claimAd(r1.prem, 'boost', 'ad-1', NOW, 0).ok, false, 'same id twice');
  p = r1.prem;
  for (let i = 2; i <= 20; i++) { const r = claimAd(p, 'boost', `ad-${i}`, NOW, 0); if (r.ok) p = r.prem; }
  assert.equal(p.boostUntil, NOW + BOOST_CAP_MS);
  assert.equal(p.adUsed.boost, AD_LIMIT.boost);
  const next = claimAd({ ...p, boostUntil: 0 }, 'boost', 'ad-x', NOW, 0);
  assert.ok(!next.ok && next.reason === 'limit');
  // 다음 날이면 다시
  const tomorrow = claimAd({ ...p, boostUntil: 0 }, 'boost', 'ad-y', NOW + 86_400_000, 0);
  assert.ok(tomorrow.ok);
});

test('gift ad gives gems, offline ad grants an allowance the next save may use', () => {
  const g = claimAd(readPrem(null), 'gift', 'g1', NOW, 0);
  assert.ok(g.ok && g.prem.gems === GIFT_GEMS);
  const o = claimAd(readPrem(null), 'offline', 'o1', NOW, 12345);
  assert.ok(o.ok && o.prem.extra === 12345);
  // 그 허용치만큼 골드가 더 늘어난 저장이 잘리지 않음, 저장 뒤 허용치는 0
  if (!o.ok) return;
  const prev = { ...newState(0), coins: 100, bestStage: 1 };
  const r = checkSave(prev, { ...prev, coins: 100 + 12345 }, 10, o.prem, NOW);
  assert.ok(r.ok && !r.clamped && r.state.coins === 100 + 12345);
  if (r.ok) assert.equal(r.prem.extra, 0);
});

test('gems buy a boost', () => {
  assert.equal(spendGemBoost(readPrem(null), NOW), null);
  const p = spendGemBoost({ ...readPrem(null), gems: 50 }, NOW)!;
  assert.equal(p.gems, 50 - GEM_BOOST.gems);
  assert.equal(p.boostUntil, NOW + GEM_BOOST.ms);
});

test('purchases: passes keep the highest, gems add, characters unlock, one grant per purchase id', () => {
  let p = readPrem(null);
  assert.equal(nextPassProduct(1), 'pass_x2');
  const a = grantPurchase(p, 'pass_x2', 'buy-1', 1);
  assert.ok(a.ok);
  if (!a.ok) return;
  p = a.prem;
  assert.equal(p.passMult, 2);
  assert.equal(nextPassProduct(p.passMult), 'pass_x4');
  assert.equal(grantPurchase(p, 'pass_x2', 'buy-1', 1).ok, false, 'same purchase id');
  const b = grantPurchase(p, 'gems_m', 'buy-2', 2);
  assert.ok(b.ok && b.prem.gems === (PRODUCTS.gems_m as { gems: number }).gems * 2);
  const c = grantPurchase(p, 'char_shoni', 'buy-3', 1);
  assert.ok(c.ok && c.prem.paid.includes('white'));
  assert.equal(grantPurchase(p, 'nope', 'buy-4', 1).ok, false);
  assert.equal(nextPassProduct(64), null);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(dayKey(NOW)));
});

test('skip rebirth: gems buy one skip, the next early rebirth save uses it', async () => {
  const { buySkipRebirth } = await import('../../src/sim/premium.ts');
  const { checkSave } = await import('../../src/sim/econ.ts');
  const { doRebirth, skipRebirthGems } = await import('../../src/sim/actions.ts');
  const { newState } = await import('../../src/sim/state.ts');
  const prev = { ...newState(NOW), trAtk: 10, rebirths: 2, tokens: 2 };
  const price = skipRebirthGems(prev);
  assert.ok(price > skipRebirthGems({ ...prev, rebirths: 0 }), 'gets pricier');
  assert.equal(buySkipRebirth({ ...readPrem(null), gems: price - 1 }, price), null, 'not enough gems');
  const p = buySkipRebirth({ ...readPrem(null), gems: price + 5 }, price)!;
  assert.deepEqual([p.gems, p.skip], [5, 1]);
  assert.equal(buySkipRebirth(p, price), null, 'only one skip at a time');
  assert.equal(doRebirth(prev), null);
  const next = doRebirth(prev, true)!;
  // 조건 안 된 환생: skip 없으면 거절, 있으면 통과하고 skip 0
  assert.equal(checkSave(prev, next, 5, { ...p, skip: 0 }, NOW).ok, false);
  const r = checkSave(prev, next, 5, p, NOW);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.state.rebirths, 3); assert.equal(r.prem.skip, 0); }
  // 정상 환생은 skip을 안 씀
  const fair = { ...prev, trAtk: 1e30 };
  const r2 = checkSave(fair, doRebirth(fair)!, 5, p, NOW);
  assert.ok(r2.ok && r2.prem.skip === 1);
});

test('daily reward: once per UTC day, 7-slot cycle, a missed day does not reset the cycle', async () => {
  const { DAILY, claimDaily, dailyReady } = await import('../../src/sim/premium.ts');
  const DAY = 86_400_000;
  let p = readPrem(null);
  expect0(p.dailyIdx);
  assert.ok(dailyReady(p, NOW));
  const a = claimDaily(p, NOW)!;
  assert.ok(a);
  assert.equal(a.idx, 0);
  assert.equal(a.prem.gems, (DAILY[0] as { gems: number }).gems);
  p = a.prem;
  assert.equal(claimDaily(p, NOW + 1000), null, 'same day');
  assert.ok(!dailyReady(p, NOW + 1000));
  // 다음 날: 2칸째 (골드 2배)
  const b = claimDaily(p, NOW + DAY)!;
  assert.equal(b.idx, 1);
  assert.ok(b.prem.boostUntil > NOW + DAY);
  // 사흘 쉬고 와도 3칸째부터 (처음으로 안 돌아감)
  const c = claimDaily(b.prem, NOW + DAY * 5)!;
  assert.equal(c.idx, 2);
  // 7칸 뒤 다시 처음
  let q = c.prem;
  for (let d = 6; d <= 9; d++) q = claimDaily(q, NOW + DAY * d)!.prem;
  assert.equal(q.dailyIdx, 0);
  // 저장값 읽기: 깨진 값은 기본값
  assert.equal(readPrem({ dailyIdx: 'x', dailyDay: 5 }).dailyDay, '');
});

function expect0(v: number): void {
  assert.equal(v, 0);
}

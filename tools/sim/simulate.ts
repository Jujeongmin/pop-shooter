/**
 * 진행 시뮬레이터 (탐욕 구매 + 10분 정체 시 환생 배율이 1.3배 이상 오르고 10분 수입으로 살 수 있으면 코인을 모아 환생, 가장 센 캐릭터 사용).
 *   npm run sim                       현재 표로 진행 시간 출력
 *   npm run sim -- --taps 0           완전 방치 플레이어
 *   npm run sim -- --fit [--fresh]    목표 시간(WORLD_END_MIN)에 맞춰 src/sim/stageTable.ts 다시 생성 (2~3번 반복해 수렴)
 *   --set atk.costGrowth=1.1          상수 시험 변경 (파일은 안 바뀜)
 * 가정: 늘 가장 높은 열린 월드 사격장, 평균 초당 taps 탭, 광고·VX 없음.
 */
import { writeFileSync } from 'node:fs';
import { BALANCE, FIRST_STAGE_MIN, STAGE_COUNT, WORLD_END_MIN } from '../../src/sim/balance.ts';
import { buyAtk, buyNextGun, buySpd, canRebirth, charMult, rebirthCost, rebirthTokens, coinPerShot, damagePerShot, doRebirth, highestWorld, shotsPerSec } from '../../src/sim/actions.ts';
import { finishRun, startRun, stepRun, tapRun } from '../../src/sim/run.ts';
import { GUNS, gunPrice } from '../../src/sim/guns.ts';
import { newState, type GameState } from '../../src/sim/state.ts';
import { stageHp, stageLabel, stageTime, isBoss, worldOf } from '../../src/sim/stages.ts';
import { STAGE_HP } from '../../src/sim/stageTable.ts';
import { atkCost, rebirthMult, spdCost } from '../../src/sim/stats.ts';

const args = process.argv.slice(2);
const opt = (name: string, def: number): number => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
for (let i = 0; i < args.length; i++) {
  if (args[i] !== '--set') continue;
  const [path, val] = args[i + 1]!.split('=');
  const keys = path!.split('.');
  let o = BALANCE as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[keys.at(-1)!] = Number(val);
}
const TAPS = Math.min(opt('taps', 3), BALANCE.tap.maxPerSec);
const STALL_SEC = opt('stall', 600);
/** 환생 배율이 이만큼 이상 오를 때만 환생 */
const GAIN = opt('gain', 1.3);

interface Ctx { s: GameState; t: number; lastProgress: number }

const effDps = (s: GameState): number => damagePerShot(s) * (shotsPerSec(s) + TAPS);

function buyBest(s: GameState): GameState | null {
  const now = effDps(s);
  const rich = { ...s, coins: Infinity };
  let best: { ratio: number; cost: number; apply: (x: GameState) => GameState | null } | null = null;
  const consider = (cost: number, next: GameState | null, apply: (x: GameState) => GameState | null): void => {
    if (!next || !Number.isFinite(cost)) return;
    const ratio = (effDps(next) - now) / cost;
    if (!best || ratio > best.ratio) best = { ratio, cost, apply };
  };
  consider(atkCost(s.atkLv), buyAtk(rich, 1), (x) => buyAtk(x, 1));
  consider(spdCost(s.spdLv), buySpd(rich, 1), (x) => buySpd(x, 1));
  const g = GUNS[s.gun + 1];
  if (g) consider(gunPrice(g.index), buyNextGun(rich), buyNextGun);
  const b = best as { cost: number; apply: (x: GameState) => GameState | null } | null;
  return b && b.cost <= s.coins ? b.apply(s) : null;
}

/** stopStage를 처음 깰 때까지(또는 maxT) 진행. 깬 시각 반환, 못 깨면 Infinity */
function runUntil(c: Ctx, stopStage: number, maxT: number, onClear?: (stage: number, c: Ctx) => void): number {
  while (c.t < maxT) {
    c.s = { ...c.s, coins: c.s.coins + coinPerShot(c.s, highestWorld(c.s), Infinity) * (shotsPerSec(c.s) + TAPS) };
    c.t += 1;
    // 10분 진전 없으면 구매를 멈추고 코인을 모아 환생 (코인 환생)
    // 단, 10분 안에 모을 수 있는 가격일 때만 (못 모으면 계속 강화)
    const income = coinPerShot(c.s, highestWorld(c.s), Infinity) * (shotsPerSec(c.s) + TAPS);
    // 그리고 환생 배율이 1.5배 이상 오를 때만 (토큰 1개 받자고 다 버리지 않음)
    const gain = rebirthMult(c.s.tokens + rebirthTokens(c.s)) / rebirthMult(c.s.tokens);
    const saving = c.t - c.lastProgress > STALL_SEC && gain >= GAIN && rebirthCost(c.s) <= income * 600;
    for (let k = 0; k < 400 && !saving; k++) {
      const n = buyBest(c.s);
      if (!n) break;
      c.s = n;
    }
    // 도전: 다음 기록 스테이지를 깰 수 있으면 그 월드 입구에서 연속 도전 (탭 포함, 깬 만큼 보상)
    const next = c.s.bestStage + 1;
    if (next <= STAGE_COUNT && effDps(c.s) * stageTime(next) >= stageHp(next)) {
      const run = startRun(c.s, worldOf(next));
      let tapAcc = 0;
      const DT = 0.25;
      while (!run.done) {
        stepRun(run, DT);
        tapAcc += TAPS * DT;
        while (tapAcc >= 1 && !run.done) { tapAcc -= 1; tapRun(run); }
        c.t += DT;
      }
      const before = c.s.bestStage;
      c.s = finishRun(c.s, run.cleared).state;
      // 열린 캐릭터 중 가장 센 것으로
      c.s = { ...c.s, char: c.s.chars.reduce((a, b) => (charMult(b) > charMult(a) ? b : a), c.s.char) };
      c.t = Math.ceil(c.t) + 3;
      if (c.s.bestStage > before) {
        c.lastProgress = c.t;
        for (let st = before + 1; st <= c.s.bestStage; st++) onClear?.(st, c);
        if (c.s.bestStage >= stopStage) return c.t;
      }
    }
    if (saving && canRebirth(c.s)) {
      c.s = doRebirth(c.s)!;
      c.lastProgress = c.t;
    }
  }
  return Infinity;
}

/** 스테이지별 목표 누적 시간(초): 월드 안에서 뒤로 갈수록 조금씩 길게, 대장은 2배 */
function targets(): number[] {
  const out: number[] = [];
  let start = 0;
  for (let w = 0; w < BALANCE.stage.worlds; w++) {
    const end = WORLD_END_MIN[w]! * 60;
    const weights = Array.from({ length: BALANCE.stage.perWorld }, (_, i) => (1 + 0.15 * i) * (i === BALANCE.stage.perWorld - 1 ? 2 : 1));
    let from = start;
    if (w === 0) { out.push(FIRST_STAGE_MIN * 60); from = FIRST_STAGE_MIN * 60; weights.shift(); }
    const sum = weights.reduce((a, b) => a + b, 0);
    let acc = from;
    for (const wt of weights) { acc += ((end - from) * wt) / sum; out.push(acc); }
    start = end;
  }
  return out;
}

const clone = (c: Ctx): Ctx => ({ s: { ...c.s, chars: [...c.s.chars] }, t: c.t, lastProgress: c.lastProgress });
const hms = (sec: number): string => (Number.isFinite(sec) ? `${Math.floor(sec / 3600)}h${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}m` : '  ----');

if (args.includes('--fit')) {
  const T = targets();
  // 아직 안 맞춘 스테이지의 총 가격은 지금 표 값 사용 → --fit을 몇 번 반복하면 수렴. --fresh = 무한(처음부터)
  if (args.includes('--fresh')) STAGE_HP.fill(Infinity);
  const prev = [...STAGE_HP];
  const ctx: Ctx = { s: newState(0), t: 0, lastProgress: 0 };
  for (let s = 1; s <= STAGE_COUNT; s++) {
    let lo = Math.log(s === 1 ? 10 : STAGE_HP[s - 2]! * (isBoss(s) ? 1.3 : 1.05));
    const minLo = lo;
    let hi = lo + Math.log(1e9);
    for (let it = 0; it < 40; it++) {
      const mid = (lo + hi) / 2;
      STAGE_HP[s - 1] = Math.exp(mid);
      const t = runUntil(clone(ctx), s, T[s - 1]! + 4 * 3600);
      if (t < T[s - 1]!) lo = mid; else hi = mid;
    }
    STAGE_HP[s - 1] = Number(Math.exp(Math.max(lo, minLo)).toPrecision(3));
    runUntil(ctx, s, Infinity);
    console.log(`${stageLabel(s).padEnd(5)} hp ${STAGE_HP[s - 1]!.toExponential(2)}  target ${hms(T[s - 1]!)}  got ${hms(ctx.t)}  rebirths ${ctx.s.rebirths}`);
  }
  // 감쇠: 이전 표와 기하평균 (반복 때 출렁임 방지), 단조 증가 유지
  for (let i = 0; i < STAGE_COUNT; i++) {
    const p = prev[i]!;
    let v = Number.isFinite(p) ? Math.sqrt(p * STAGE_HP[i]!) : STAGE_HP[i]!;
    if (i > 0) v = Math.max(v, STAGE_HP[i - 1]! * 1.05);
    STAGE_HP[i] = Number(v.toPrecision(3));
  }
  writeFileSync(new URL('../../src/sim/stageTable.ts', import.meta.url),
    `// 자동 생성: npm run sim -- --fit (손으로 고치지 말 것). 목표 = balance.ts WORLD_END_MIN, 탭 ${TAPS}/초\nexport const STAGE_HP: number[] = ${JSON.stringify(STAGE_HP)};\n`);
  console.log('wrote src/sim/stageTable.ts');
} else {
  const ctx: Ctx = { s: newState(0), t: 0, lastProgress: 0 };
  const at = new Map<number, { t: number; r: number }>();
  runUntil(ctx, STAGE_COUNT, 40 * 3600, (st, c) => at.set(st, { t: c.t, r: c.s.rebirths }));
  console.log(`taps=${TAPS} stall=${STALL_SEC}s`);
  for (const st of [1, 5, 10, 15, 20, 25, 30, 35, 40]) {
    const r = at.get(st);
    console.log(`${stageLabel(st).padEnd(5)} ${hms(r?.t ?? Infinity).padStart(7)}  rebirths ${r ? r.r : '-'}`);
  }
}

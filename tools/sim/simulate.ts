/**
 * 진행 시뮬레이터 (탐욕 구매 + 공격력 레벨 조건이 열리고 10분 정체면 환생(--asap 1이면 열리자마자), 가장 센 캐릭터 사용).
 *   npm run sim                       현재 표로 진행 시간 출력
 *   npm run sim -- --taps 0           완전 방치 플레이어
 *   npm run sim -- --fit [--fresh]    목표 시간(WORLD_END_MIN)에 맞춰 src/sim/stageTable.ts 다시 생성 (2~3번 반복해 수렴)
 *   --set atk.costGrowth=1.1          상수 시험 변경 (파일은 안 바뀜)
 * 가정: 늘 가장 높은 열린 월드 사격장, 평균 초당 taps 탭, 광고·VX 없음.
 */
import { writeFileSync } from 'node:fs';
import { BALANCE, FIRST_STAGE_MIN, STAGE_COUNT, WORLD_END_MIN } from '../../src/sim/balance.ts';
import { buyAtk, buyNextGun, buySpd, canRebirth, charMult, coinPerShot, damagePerShot, doRebirth, highestWorld, shotsPerSec } from '../../src/sim/actions.ts';
import { finishRun, startRun, stepRun, tapRun } from '../../src/sim/run.ts';
import { GUNS, gunPrice } from '../../src/sim/guns.ts';
import { newState, type GameState } from '../../src/sim/state.ts';
import { stageHp, stageLabel, stageTime, isBoss, worldOf } from '../../src/sim/stages.ts';
import { STAGE_HP } from '../../src/sim/stageTable.ts';
import { atkCost, spdCost } from '../../src/sim/stats.ts';
import { checkSave, worth } from '../../src/sim/econ.ts';
import { buyGear, buyMachine, coinTrainMult, GEAR, machineCost, machineLv, train, trainCap, trainValue, TRAIN_KINDS } from '../../src/sim/training.ts';

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
/** --econ 1: 30초마다 서버 경제 검사(checkSave)를 돌려 정직한 플레이가 걸리는지 셈 */
const ECON = opt('econ', 0) === 1;
const econ = { checks: 0, clamps: 0, rejects: 0, reasons: {} as Record<string, number>, prev: null as GameState | null, lastT: 0 };
function econCheck(c: Ctx): void {
  if (!ECON) return;
  if (c.t - econ.lastT < 30 && econ.prev && econ.prev.rebirths === c.s.rebirths) return;
  const r = checkSave(econ.prev, c.s, c.t - econ.lastT, { gems: 0, passMult: 1, boostUntil: 0, paid: [] }, 0);
  econ.checks++;
  if (!r.ok) { econ.rejects++; econ.reasons[r.reason] = (econ.reasons[r.reason] ?? 0) + 1; if (opt('econlog', 0)) console.log('REJECT', r.reason, c.t, JSON.stringify({ p: econ.prev && { b: econ.prev.bestStage, a: econ.prev.atkLv, s: econ.prev.spdLv, g: econ.prev.gun, r: econ.prev.rebirths, c: econ.prev.char }, n: { b: c.s.bestStage, a: c.s.atkLv, s: c.s.spdLv, g: c.s.gun, r: c.s.rebirths, c: c.s.char, co: c.s.coins } })); }
  else if (r.clamped) { econ.clamps++; if (opt('econlog', 0)) console.log('CLAMP', c.t, c.t - econ.lastT, JSON.stringify({ p: econ.prev && { b: econ.prev.bestStage, a: econ.prev.atkLv, s: econ.prev.spdLv, g: econ.prev.gun, r: econ.prev.rebirths, co: econ.prev.coins, w: worth(econ.prev) }, n: { b: c.s.bestStage, a: c.s.atkLv, g: c.s.gun, co: c.s.coins, w: worth(c.s) }, got: r.state.coins })); }
  econ.prev = c.s;
  econ.lastT = c.t;
}
/**
 * --rangegold 0: 경제 구조 변경 시험 (사용자 2026-11-11 제안) — 사격장은 훈련치만, 골드는 전투(첫 클리어·반복)로만.
 * 이 플레이어는 훈련치가 모두 한도면 가장 높은 월드 입구에서 반복 도전으로 골드를 벌고, 아니면 사격장에서 훈련.
 */
const RANGE_GOLD = opt('rangegold', 1) === 1;
/** --battlebonus 1: (rangegold 0일 때) 전투 보상에 코인 훈련 × 월드 배율을 곱함 */
const BATTLE_BONUS = opt('battlebonus', 0) === 1;
function payRun(s: GameState, cleared: readonly number[], world: number): GameState {
  const r = finishRun(s, cleared);
  if (RANGE_GOLD || !BATTLE_BONUS) return r.state;
  const extra = r.coins * (coinTrainMult(s) * (BALANCE.range.multByWorld[world - 1] ?? 1) - 1);
  return { ...r.state, coins: r.state.coins + extra };
}
const farm = { runs: 0, battleSec: 0, rangeSec: 0 };
/** 1이면 환생이 열리자마자 함 (키보드 탈출 공략 조언), 0이면 10분 정체 때만 */
const ASAP = opt('asap', 1) === 1;

interface Ctx { s: GameState; t: number; lastProgress: number }

const effDps = (s: GameState): number => damagePerShot(s) * (shotsPerSec(s) + TAPS);
/** 훈련 투자 가치: HORIZON초 동안 쌓일 훈련치로 늘어날 '코인 수입 × DPS' 비율 근사 */
const HORIZON = opt('horizon', 600);
const NO_TRAIN = opt('notrain', 0) === 1;
const income = (s: GameState): number => coinPerShot(s, highestWorld(s), Infinity) * (shotsPerSec(s) + TAPS);
const future = (s: GameState): GameState => train(s, (shotsPerSec(s) + TAPS) * HORIZON);

function buyBest(s: GameState): GameState | null {
  const now = effDps(s);
  const rich = { ...s, coins: Infinity };
  let best: { ratio: number; cost: number; apply: (x: GameState) => GameState | null } | null = null;
  const consider = (cost: number, next: GameState | null, apply: (x: GameState) => GameState | null, value?: number): void => {
    if (!next || !Number.isFinite(cost)) return;
    const ratio = (value ?? effDps(next) - now) / cost;
    if (!best || ratio > best.ratio) best = { ratio, cost, apply };
  };
  consider(atkCost(s.atkLv), buyAtk(rich, 1), (x) => buyAtk(x, 1));
  consider(spdCost(s.spdLv), buySpd(rich, 1), (x) => buySpd(x, 1));
  const g = GUNS[s.gun + 1];
  if (g) consider(gunPrice(g.index), buyNextGun(rich), buyNextGun);
  if (!NO_TRAIN) {
    // 훈련 기계·장비: 앞으로 HORIZON초 뒤 DPS(·수입) 차이를 지금 DPS 단위로 환산
    const base = future(s);
    const val = (x: GameState): number => {
      const f = future(x);
      return (effDps(f) - effDps(base)) * 0.5 + (income(f) - income(base)) / Math.max(1, income(base)) * now * 0.5;
    };
    for (const k of TRAIN_KINDS) {
      const nx = buyMachine(rich, k, 1);
      if (nx) consider(machineCost(k, machineLv(s, k)), nx, (x) => buyMachine(x, k, 1), val(nx));
    }
    GEAR.forEach((gd, i) => {
      const nx = buyGear(rich, i);
      if (nx) consider(gd.price, nx, (x) => buyGear(x, i), val(nx));
    });
  }
  const b = best as { cost: number; apply: (x: GameState) => GameState | null } | null;
  return b && b.cost <= s.coins ? b.apply(s) : null;
}

/** stopStage를 처음 깰 때까지(또는 maxT) 진행. 깬 시각 반환, 못 깨면 Infinity */
function runUntil(c: Ctx, stopStage: number, maxT: number, onClear?: (stage: number, c: Ctx) => void): number {
  while (c.t < maxT) {
    const shots = shotsPerSec(c.s) + TAPS;
    const full = TRAIN_KINDS.every((k) => trainValue(c.s, k) >= trainCap(c.s, k) - 1e-9);
    // 반복 도전 월드: 입구 첫 스테이지를 깰 수 있는 가장 높은 열린 월드
    let farmWorld = 0;
    for (let w = highestWorld(c.s); w >= 1; w--) {
      const st = (w - 1) * BALANCE.stage.perWorld + 1;
      if (effDps(c.s) * stageTime(st) >= stageHp(st)) { farmWorld = w; break; }
    }
    if (!RANGE_GOLD && farmWorld > 0 && c.s.bestStage >= 1 && (full || NO_TRAIN)) {
      // 반복 도전으로 골드 (입구부터 실패할 때까지)
      const run = startRun(c.s, farmWorld);
      const t0 = c.t;
      let tapAcc = 0;
      while (!run.done) {
        stepRun(run, 0.25);
        tapAcc += TAPS * 0.25;
        while (tapAcc >= 1 && !run.done) { tapAcc -= 1; tapRun(run); }
        c.t += 0.25;
      }
      c.s = payRun(c.s, run.cleared, run.world);
      c.t = Math.ceil(c.t) + 2;
      farm.runs++;
      farm.battleSec += c.t - t0;
    } else {
      if (RANGE_GOLD) c.s = { ...c.s, coins: c.s.coins + coinPerShot(c.s, highestWorld(c.s), Infinity) * shots };
      if (!NO_TRAIN) c.s = train(c.s, shots);
      c.t += 1;
      farm.rangeSec += 1;
    }
    econCheck(c);
    for (let k = 0; k < 400; k++) {
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
      c.s = payRun(c.s, run.cleared, run.world);
      // 열린 캐릭터 중 가장 센 것으로
      c.s = { ...c.s, char: c.s.chars.reduce((a, b) => (charMult(b) > charMult(a) ? b : a), c.s.char) };
      c.t = Math.ceil(c.t) + 3;
      if (c.s.bestStage > before) {
        c.lastProgress = c.t;
        for (let st = before + 1; st <= c.s.bestStage; st++) onClear?.(st, c);
        if (c.s.bestStage >= stopStage) return c.t;
      }
    }
    // 환생: 열리면 바로 (ASAP=1) 또는 정체됐을 때만 (기본, --asap 1로 바꿈)
    if (canRebirth(c.s) && (ASAP || c.t - c.lastProgress > STALL_SEC)) {
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
  const at = new Map<number, { t: number; r: number; tr: string }>();
  runUntil(ctx, STAGE_COUNT, 40 * 3600, (st, c) => at.set(st, { t: c.t, r: c.s.rebirths, tr: `tr ${c.s.trAtk.toFixed(0)}/${c.s.trSpd.toFixed(0)}/${c.s.trCoin.toFixed(0)}% m ${c.s.mAtk}/${c.s.mSpd}/${c.s.mCoin} gear ${c.s.gear.toString(2)}` }));
  console.log(`taps=${TAPS} stall=${STALL_SEC}s`);
  if (!RANGE_GOLD) console.log(`farm runs ${farm.runs} battle ${hms(farm.battleSec)} range ${hms(farm.rangeSec)}`);
  if (ECON) console.log(`econ checks ${econ.checks} clamps ${econ.clamps} rejects ${econ.rejects} ${JSON.stringify(econ.reasons)}`);
  for (const st of [1, 5, 10, 15, 20, 25, 30, 35, 40]) {
    const r = at.get(st);
    console.log(`${stageLabel(st).padEnd(5)} ${hms(r?.t ?? Infinity).padStart(7)}  rebirths ${r ? r.r : '-'}  ${r?.tr ?? ''}`);
  }
}

/**
 * 진행 시뮬레이터 (2026-11-11 성장 개편: 훈련 = 주 성장, 골드 = 전투).
 *   npm run sim                 진행 시간 표
 *   npm run sim -- --taps 0     완전 방치(탭 없음)
 *   --set train.machineStep=1.4 상수 시험 변경 (파일은 안 바뀜)
 *   --econ 1                    30초마다 서버 경제 검사(checkSave)를 돌려 정직한 플레이가 걸리는지 셈
 * 플레이어 모델: 1초마다 가장 이득인 훈련장에서 쏨(공격·연사·코인), farm초마다 반복 도전으로 골드,
 * 다음 기록을 깰 수 있으면 바로 도전, 살 수 있는 것 중 가장 이득인 것(총·기구·장비) 구매, 환생은 열리면 바로(--asap 0이면 정체 10분 뒤).
 * 가정: 가장 높은 열린 월드 훈련장, 평균 초당 taps 탭, 광고·VX 없음.
 */
import { BALANCE, STAGE_COUNT } from '../../src/sim/balance.ts';
import { buyNextGun, canRebirth, charMult, damagePerShot, doRebirth, goldMult, highestWorld, shotsPerSec } from '../../src/sim/actions.ts';
import { finishRun, startRun, stepRun, tapRun } from '../../src/sim/run.ts';
import { GUNS, gunPrice } from '../../src/sim/guns.ts';
import { newState, type GameState } from '../../src/sim/state.ts';
import { stageHp, stageLabel, stageTime } from '../../src/sim/stages.ts';
import { checkSave } from '../../src/sim/econ.ts';
import { buyGear, buyMachine, GEAR, gearPrice, machineCost, machineLv, spdMaxed, train, TRAIN_KINDS, type TrainKind } from '../../src/sim/training.ts';

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
  const last = keys.at(-1)!;
  o[last] = val!.includes(',') ? val!.split(',').map(Number) : Number(val);
}
const TAPS = Math.min(opt('taps', 3), BALANCE.tap.maxPerSec);
const FARM_SEC = opt('farm', 90);
const ASAP = opt('asap', 1) === 1;
const STALL_SEC = 600;
const ECON = opt('econ', 0) === 1;
const MAX_T = opt('hours', 30) * 3600;

interface Ctx { s: GameState; t: number; lastProgress: number; lastFarm: number; kindSec: Record<TrainKind, number>; battleSec: number }

const effDps = (s: GameState): number => damagePerShot(s) * (shotsPerSec(s) + TAPS);

const econ = { checks: 0, clamps: 0, rejects: 0, reasons: {} as Record<string, number>, prev: null as GameState | null, lastT: 0 };
function econCheck(c: Ctx): void {
  if (!ECON) return;
  if (c.t - econ.lastT < 30 && econ.prev && econ.prev.rebirths === c.s.rebirths) return;
  const r = checkSave(econ.prev, c.s, c.t - econ.lastT, { gems: 0, passMult: 1, boostUntil: 0, paid: [] }, 0);
  econ.checks++;
  if (!r.ok) {
    econ.rejects++;
    econ.reasons[r.reason] = (econ.reasons[r.reason] ?? 0) + 1;
    if (opt('econlog', 0)) console.log('REJECT', r.reason, Math.round(c.t));
  } else if (r.clamped) {
    econ.clamps++;
    if (opt('econlog', 0)) console.log('CLAMP', Math.round(c.t), Math.round(c.s.coins), Math.round(r.state.coins), c.s.trAtk.toExponential(2), r.state.trAtk.toExponential(2));
  }
  econ.prev = c.s;
  econ.lastT = c.t;
}

/** 이번 1초에 쏠 훈련장: 10초 훈련했을 때 DPS(공격·연사) 또는 골드 배율(코인, 절반 가치)이 가장 크게 느는 쪽 */
function pickKind(s: GameState, world: number): TrainKind {
  const shots = (shotsPerSec(s) + TAPS) * 10;
  const d0 = effDps(s);
  const gain = (k: TrainKind): number => {
    const n = train(s, k, shots, world);
    if (k === 'coin') return (goldMult(n, 0) / goldMult(s, 0) - 1) * 0.5;
    return effDps(n) / d0 - 1;
  };
  let best: TrainKind = 'atk';
  let bestV = -1;
  for (const k of TRAIN_KINDS) {
    if (k === 'spd' && spdMaxed(s)) continue;
    const v = gain(k);
    if (v > bestV) { bestV = v; best = k; }
  }
  return best;
}

/** 산 것의 가치: 총 = DPS 증가율, 기구·장비 = 그 종류 훈련 속도 증가율 × 가중 */
function buyBest(s: GameState): GameState | null {
  const rich = { ...s, coins: Infinity };
  let best: { ratio: number; cost: number; apply: (x: GameState) => GameState | null } | null = null;
  const consider = (cost: number, value: number, apply: (x: GameState) => GameState | null): void => {
    if (!Number.isFinite(cost) || !(value > 0)) return;
    const ratio = value / cost;
    if (!best || ratio > best.ratio) best = { ratio, cost, apply };
  };
  const g = GUNS[s.gun + 1];
  if (g && buyNextGun(rich)) consider(gunPrice(g.index), BALANCE.gun.dmgStep - 1, buyNextGun);
  const w: Record<TrainKind, number> = { atk: 1, spd: spdMaxed(s) ? 0 : 0.6, coin: 0.5 };
  for (const k of TRAIN_KINDS) consider(machineCost(machineLv(s, k)), (BALANCE.train.machineStep - 1) * w[k], (x) => buyMachine(x, k, 1));
  GEAR.forEach((gd, i) => { if (buyGear(rich, i)) consider(gearPrice(i), (BALANCE.train.gearMult - 1) * w[gd.kind], (x) => buyGear(x, i)); });
  const b = best as { cost: number; apply: (x: GameState) => GameState | null } | null;
  return b && b.cost <= s.coins ? b.apply(s) : null;
}

function playRun(c: Ctx, world: number): number[] {
  const run = startRun(c.s, world);
  let tapAcc = 0;
  const t0 = c.t;
  while (!run.done) {
    stepRun(run, 0.25);
    tapAcc += TAPS * 0.25;
    while (tapAcc >= 1 && !run.done) { tapAcc -= 1; tapRun(run); }
    c.t += 0.25;
  }
  c.s = finishRun(c.s, run.cleared).state;
  c.s = { ...c.s, char: c.s.chars.reduce((a, b) => (charMult(b) > charMult(a) ? b : a), c.s.char) };
  c.t = Math.ceil(c.t) + 3;
  c.battleSec += c.t - t0;
  return run.cleared;
}

/** 반복 도전 월드: 입구 첫 스테이지를 깰 수 있는 가장 높은 열린 월드 (없으면 0) */
function farmWorld(s: GameState): number {
  for (let w = highestWorld(s); w >= 1; w--) {
    const st = (w - 1) * BALANCE.stage.perWorld + 1;
    if (effDps(s) * stageTime(st) >= stageHp(st)) return w;
  }
  return 0;
}

function runUntil(c: Ctx, maxT: number, onClear: (stage: number, c: Ctx) => void): void {
  while (c.t < maxT && c.s.bestStage < STAGE_COUNT) {
    const world = highestWorld(c.s);
    const k = pickKind(c.s, world);
    c.s = train(c.s, k, shotsPerSec(c.s) + TAPS, world);
    c.kindSec[k] += 1;
    c.t += 1;
    econCheck(c);
    // 기록 도전
    const next = c.s.bestStage + 1;
    if (effDps(c.s) * stageTime(next) >= stageHp(next) && farmWorld(c.s) > 0) {
      const before = c.s.bestStage;
      const w = Math.max(1, Math.min(highestWorld(c.s), Math.ceil(next / BALANCE.stage.perWorld)));
      playRun(c, w);
      c.lastFarm = c.t;
      if (c.s.bestStage > before) {
        c.lastProgress = c.t;
        for (let st = before + 1; st <= c.s.bestStage; st++) onClear(st, c);
      }
    } else if (c.t - c.lastFarm >= FARM_SEC) {
      const fw = farmWorld(c.s);
      if (fw > 0) playRun(c, fw);
      c.lastFarm = c.t;
    }
    for (let i = 0; i < 200; i++) {
      const n = buyBest(c.s);
      if (!n) break;
      c.s = n;
    }
    if (canRebirth(c.s) && (ASAP || c.t - c.lastProgress > STALL_SEC)) {
      c.s = doRebirth(c.s)!;
      c.lastProgress = c.t;
    }
  }
}

const hms = (sec: number): string => (Number.isFinite(sec) ? `${Math.floor(sec / 3600)}h${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}m` : '  ----');

const ctx: Ctx = { s: newState(0), t: 0, lastProgress: 0, lastFarm: 0, kindSec: { atk: 0, spd: 0, coin: 0 }, battleSec: 0 };
const at = new Map<number, { t: number; info: string }>();
runUntil(ctx, MAX_T, (st, c) => at.set(st, {
  t: c.t,
  info: `reb ${c.s.rebirths} atk ${c.s.trAtk.toExponential(1)} spd ${c.s.trSpd.toFixed(0)}% coin ${c.s.trCoin.toExponential(1)}% m ${c.s.mAtk}/${c.s.mSpd}/${c.s.mCoin} gun ${c.s.gun}`,
}));
console.log(`taps=${TAPS} farm=${FARM_SEC}s  time: atk ${hms(ctx.kindSec.atk)} spd ${hms(ctx.kindSec.spd)} coin ${hms(ctx.kindSec.coin)} battle ${hms(ctx.battleSec)}`);
if (ECON) console.log(`econ checks ${econ.checks} clamps ${econ.clamps} rejects ${econ.rejects} ${JSON.stringify(econ.reasons)}`);
for (const st of [1, 2, 3, 5, 10, 15, 20, 25, 30, 35, 40]) {
  const r = at.get(st);
  console.log(`${stageLabel(st).padEnd(5)} ${hms(r?.t ?? Infinity).padStart(7)}  ${r?.info ?? ''}`);
}

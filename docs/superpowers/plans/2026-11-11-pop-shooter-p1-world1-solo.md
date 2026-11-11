# POP Shooter 계획 1 — 규칙·시뮬레이터·월드 1 혼자 판 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저에서 월드 1 광장을 걸어 다니며 훈련·업그레이드·총 구매·스테이지 1-1~1-10 자동 전투·환생·오프라인 보상까지 처음부터 끝까지 혼자 하는 판(로컬 저장)과, 40스테이지 10시간 분량을 맞추는 진행 시뮬레이터.

**Architecture:** 게임 규칙은 `src/sim/`의 순수 TS 함수(DOM·three 없음)로 두고 `node --test`로 검사한다 — 계획 2에서 서버가 같은 코드를 쓴다. 화면은 Three.js 한 장면에 광장/전투 무대를 바꿔 가며 그리고, UI는 DOM 오버레이. 캐릭터·무기 표시는 팝배틀 `PlayerAvatar`를 옮겨 쓴다.

**Tech Stack:** Vite 8, TypeScript 7 strict, three 0.186, Node 24 내장 TS 실행(`node --test`), 물리 엔진 없음.

**Spec:** `docs/superpowers/specs/2026-11-11-pop-shooter-design.md`

**이 계획 밖(다음 계획):** 계획 2 = Verse8 서버 저장·서버 시각 오프라인·VX(패스·팝젬 묶음·캐릭터)·리워드 광고·플랫폼 어댑터. 계획 3 = 멀티 광장(보이기·이름표·채팅·순위판). 계획 4 = 월드 2~4 에셋·출석·튜토리얼 확장.

## Global Constraints

- 프로젝트 루트 `C:\Users\anjsh\OneDrive\Desktop\POP Shooter`. 팝배틀 원본 `C:\Users\anjsh\OneDrive\Desktop\pop-battle`(읽기·복사만, 수정 금지).
- 개발 서버 포트 **5220** (`strictPort`), 빌드 `npm run build` = `tsc --noEmit && vite build`, `base: './'`.
- tsconfig: 팝배틀과 같은 strict 옵션 + `allowImportingTsExtensions: true` + `erasableSyntaxOnly: true`. `src/sim/` 안 import는 `.ts` 확장자 포함(node가 직접 실행). enum·namespace 금지.
- 테스트: `node --test tests/` (파일 `tests/**/*.test.ts`, `node:test` + `node:assert/strict`).
- 사용자에게 보이는 글은 한국어. 로고·게임 이름 "POP Shooter".
- 아트: 2~2.5등신 둥근 플라스틱 장난감, 파스텔 블루·옐로·오렌지·핑크. 사실적 군사 분위기 금지.
- safe area 처리(`env(safe-area-inset-*)`, `viewport-fit`) 넣지 않음.
- 조작: 마우스만 / 터치만으로 전부 가능, PC는 WASD 이동 추가. 가로 화면.
- 글자 최소 PC 12px · 모바일 11px.
- 메모리: SkinnedMesh clone 해제 시 `skeleton.dispose()`, 공유 geometry/texture는 dispose 금지(코드에 `// shared` 표시), 이펙트 material 공유, 매 프레임 `setState`·객체 생성 금지, UI 숫자는 값이 바뀔 때만 DOM 갱신.
- 3D 에셋을 새로 모델링하지 않는다. 시설·과녁·보스는 임시 도형(둥근 상자·원기둥, 파스텔 색) 또는 크게 키운 팝배틀 캐릭터.
- localStorage 접근은 전부 try/catch.

## Review Focus

1. **아주 큰 숫자** — 코인 1e300, 레벨 수천에서 "최대 구매"·비용 합이 `Infinity`/`NaN`이 되면 저장이 깨진다. 기대: 살 수 있는 만큼만 사고 코인은 유한한 0 이상. → Task 3 `maxAffordable huge coins` 테스트.
2. **깨지거나 예전 형식인 저장값** — localStorage에 잘못된 JSON·필드 누락·음수가 있으면 첫 화면에서 멈춘다. 기대: 고칠 수 있는 필드는 고치고, 안 되면 새 판. → Task 6 `loadSave corrupt` 테스트.
3. **시계가 뒤로 가거나 아주 오래 비움** — `now < lastSeen`이면 음수 보상, 1년 비우면 거대 보상. 기대: 0 이상, 한도(2시간)에서 자름. → Task 5 `offlineReward clock` 테스트.
4. **탭 연타·여러 손가락** — 초당 30탭이 들어와도 초당 8회만 인정. → Task 4 `TapLimiter` 테스트.
5. **환생 조건과 유지 항목** — 1-10 전 환생, 전투 중 환생 버튼, 환생 뒤 bestStage·팝젬·캐릭터 사라짐. 기대: 조건 밖이면 거절, 유지 항목 그대로. → Task 5 `doRebirth keeps` 테스트, Task 13 전투 중 제단 비활성.

---

### Task 1: 프로젝트 뼈대

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/style.css`, `.gitignore`, `.claude/launch.json`, `tests/smoke.test.ts`

- [ ] **Step 1:** `git init` (루트), `.gitignore` = `node_modules/`, `dist/`, `*.log`.
- [ ] **Step 2:** `package.json` — name `pop-shooter`, `"type": "module"`, scripts `dev`(vite), `build`(`tsc --noEmit && vite build`), `typecheck`, `test`(`node --test tests/`); deps `three@^0.186.1`; devDeps `@types/three@^0.186.0`, `typescript@^7.0.2`, `vite@^8.3.5`. `npm install`.
- [ ] **Step 3:** `tsconfig.json`은 팝배틀 것 복사 + Global Constraints의 두 옵션, `include: ["src", "tests", "tools"]`. `vite.config.ts` = `base: './'`, `server: { port: 5220, strictPort: true }`, `build.target: 'es2022'`.
- [ ] **Step 4:** `index.html`(가로, `#app` 안에 `<canvas id="view">`와 `<div id="ui">`), `src/main.ts`는 일단 화면에 "POP Shooter" 글자만. `.claude/launch.json` = `{ "version": "0.0.1", "configurations": [{ "name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5220 }] }`.
- [ ] **Step 5:** `tests/smoke.test.ts` — `test('node runs ts', () => assert.equal(1 + 1, 2))`. Run `npm test` → 1 pass. Run `npm run build` → 성공.
- [ ] **Step 6:** Commit `chore: project scaffold (vite + ts + three, port 5220)`.

### Task 2: 숫자 표기

**Files:** Create `src/sim/format.ts`, Test `tests/sim/format.test.ts`

**Interfaces:** Produces `formatNum(n: number): string`.

- [ ] **Step 1: 실패하는 테스트**

```ts
test('formatNum', () => {
  assert.equal(formatNum(0), '0');
  assert.equal(formatNum(999), '999');
  assert.equal(formatNum(12.7), '12');
  assert.equal(formatNum(1234), '1.23K');
  assert.equal(formatNum(45_600_000), '45.6M');
  assert.equal(formatNum(7.8e9), '7.80B');
  assert.equal(formatNum(1.5e12), '1.50T');
  assert.equal(formatNum(2e15), '2.00aa');
  assert.equal(formatNum(3e18), '3.00ab');
  assert.equal(formatNum(1e15 * 1000 ** 26), '1.00ba');
  assert.equal(formatNum(Infinity), '∞');
  assert.equal(formatNum(NaN), '0');
  assert.equal(formatNum(-5), '0');
});
```

- [ ] **Step 2:** `npm test` → FAIL (모듈 없음).
- [ ] **Step 3:** 구현. 1000 미만은 내림 정수. 단위 K,M,B,T 다음 aa, ab … az, ba …(1000배마다). 유효숫자 3자리(소수 자리 = 3 − 정수부 자릿수), 반올림이 아니라 내림.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(sim): number formatting`.

### Task 3: 밸런스 상수 · 스탯 · 총 · 스테이지

**Files:** Create `src/sim/balance.ts`, `src/sim/stats.ts`, `src/sim/guns.ts`, `src/sim/stages.ts`, Test `tests/sim/stats.test.ts`, `tests/sim/stages.test.ts`

**Interfaces — Produces:**
- `BALANCE` (as const, 아래 값 = 스펙 초기값. Task 7이 조정):
  `atk { baseCost: 10, costGrowth: 1.12, doubleEvery: 25 }`, `spd { baseCost: 25, costGrowth: 1.25, step: 0.25, cap: 12 }`, `tap { maxPerSec: 8 }`, `gun { count: 16, perWorld: 4, dmgStep: 2.5, basePrice: 100, priceStep: 6 }`, `stage { perWorld: 10, worlds: 4, baseHp: 60, hpGrowth: 1.6, bossMult: 3, timeNormal: 20, timeBoss: 30, firstClearCoinMult: 2, replayCoinMult: 0.3 }`, `rebirth { unlockStage: 10, tokenOffset: 5, tokenDiv: 2, multPerToken: 0.5 }`, `range { multByWorld: [1, 4, 16, 64] }`, `offline { rate: 0.5, capSec: 7200 }`, `gems { worldBossFirst: 50, perRebirth: 10 }`, `boost { coinMult: 2 }`.
- `stats.ts`: `atkValue(lv)`, `atkCost(lv)`, `spdValue(lv)`, `spdCost(lv)`, `spdMaxLevel(): number`, `bulkCost(kind: 'atk'|'spd', lv: number, n: number): number`, `maxAffordable(kind, lv, coins): { n: number; cost: number }`, `rebirthMult(tokens)`.
- `guns.ts`: `interface GunDef { index: number; world: 1|2|3|4; model: 'pistol'|'rifle'|'shotgun'|'sniper'; tint: string; name: string }`, `GUNS: readonly GunDef[]` (16개, 월드마다 모델 순서 pistol→rifle→shotgun→sniper, 월드별 tint 4색), `gunMult(i)` = dmgStep^i, `gunPrice(i)` (0 → 0, else basePrice × priceStep^(i−1)).
- `stages.ts`: 스테이지 번호 = 1..40 정수. `worldOf(s)`, `isBoss(s)` (s % 10 === 0), `stageHp(s)` = baseHp × hpGrowth^(s−1) × (보스면 bossMult), `stageTime(s)`, `firstClearCoins(s)`, `replayCoins(s)`, `stageLabel(s): string` ("1-10" 형식).

- [ ] **Step 1: 실패하는 테스트** (값은 `BALANCE`에서 읽어 조정에 안 깨지게)

```ts
test('atk doubles every doubleEvery levels', () => {
  const d = BALANCE.atk.doubleEvery;
  assert.equal(atkValue(0), 1);
  assert.equal(atkValue(d), (1 + d) * 2);
});
test('spd capped', () => {
  assert.equal(spdValue(0), 1);
  assert.equal(spdValue(spdMaxLevel()), BALANCE.spd.cap);
  assert.equal(spdValue(spdMaxLevel() + 50), BALANCE.spd.cap);
});
test('bulkCost equals sum of single costs', () => {
  const sum = [0, 1, 2, 3, 4].reduce((a, i) => a + atkCost(7 + i), 0);
  assert.ok(Math.abs(bulkCost('atk', 7, 5) - sum) / sum < 1e-9);
});
test('maxAffordable', () => {
  const { n, cost } = maxAffordable('atk', 0, atkCost(0) + atkCost(1) + 0.5);
  assert.equal(n, 2); assert.ok(cost <= atkCost(0) + atkCost(1) + 0.5);
});
test('maxAffordable huge coins', () => {
  const r = maxAffordable('atk', 3000, 1e300);
  assert.ok(Number.isFinite(r.cost) && r.cost <= 1e300 && r.n >= 0);
  const s = maxAffordable('spd', 0, 1e300);
  assert.equal(s.n, spdMaxLevel());
});
test('guns', () => {
  assert.equal(GUNS.length, 16); assert.equal(gunPrice(0), 0);
  assert.equal(GUNS[4]!.world, 2); assert.ok(gunMult(15) > gunMult(14));
});
test('stages', () => {
  assert.equal(stageLabel(10), '1-10'); assert.equal(stageLabel(11), '2-1');
  assert.equal(worldOf(40), 4); assert.ok(isBoss(30) && !isBoss(31));
  assert.equal(stageHp(10), BALANCE.stage.baseHp * BALANCE.stage.hpGrowth ** 9 * BALANCE.stage.bossMult);
  assert.equal(stageTime(10), BALANCE.stage.timeBoss); assert.equal(stageTime(9), BALANCE.stage.timeNormal);
});
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** 구현. `bulkCost`는 등비수열 합 공식(spd는 cap 넘는 레벨 비용 = Infinity). `maxAffordable`은 등비합 역산으로 n을 구한 뒤 ±1 보정, 비용이 Infinity가 되는 지점에서 멈춤.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(sim): balance constants, stats, guns, stages`.

### Task 4: 게임 상태 · 행동 · 탭 제한 · 전투 규칙

**Files:** Create `src/sim/state.ts`, `src/sim/actions.ts`, `src/sim/tapLimiter.ts`, `src/sim/battle.ts`, Test `tests/sim/actions.test.ts`, `tests/sim/battle.test.ts`

**Interfaces — Produces:**
- `state.ts`:
  ```ts
  export type CharId = 'blue' | 'yellow' | 'red' | 'pink' | 'white' | 'black';
  export interface GameState {
    v: 1; coins: number; gems: number; atkLv: number; spdLv: number;
    gun: number;          // 가진 가장 높은 총 index (장착 = 이것)
    bestStage: number;    // 클리어한 최고 스테이지 0..40 (환생해도 유지)
    runBest: number;      // 이번 회차 최고 클리어 (환생 토큰 계산용)
    rebirths: number; tokens: number;
    passMult: number;     // 1 | 2 | 4 … 64 (계획 2가 채움)
    boostUntil: number;   // ms epoch, 코인 2배 끝나는 시각
    lastSeen: number;     // ms epoch
    char: CharId; chars: CharId[];
    tutorial: number;     // 튜토리얼 단계, 끝 = 99
  }
  export function newState(now: number): GameState;
  ```
- `actions.ts` (모두 입력을 바꾸지 않고 새 상태 반환, 불가면 `null`):
  `damagePerShot(s)` = atkValue × gunMult × rebirthMult × passMult; `shotsPerSec(s)`; `autoDps(s)`; `maxDps(s)` (= damagePerShot × (shotsPerSec + tap.maxPerSec)); `coinPerShot(s, world, now)` = damagePerShot × range.multByWorld[world−1] × (now < boostUntil ? boost.coinMult : 1); `worldUnlocked(s, w)` (= bestStage ≥ (w−1)×10); `buyAtk(s, n)`, `buySpd(s, n)`, `buyNextGun(s)`, `addCoins(s, c)`, `canAttempt(s, stage)` (= stage ≤ bestStage + 1 && stage ≤ 40), `clearStage(s, stage): { state; coins; firstClear: boolean; unlockedChar: CharId | null }`, `canRebirth(s)`, `rebirthTokens(s)` = max(1, floor((runBest − tokenOffset) / tokenDiv)), `doRebirth(s)`.
  - 첫 클리어 보상: 코인 firstClearCoins, 월드 대장(10·20·30·40)이면 gems.worldBossFirst, 10·20·30 대장이면 `['yellow','red','pink']` 순서로 다음 캐릭터 해금.
  - 재도전: replayCoins만.
  - 환생: coins 0, atkLv 0, spdLv 0, gun 0, runBest 0, tokens += rebirthTokens, rebirths += 1, gems += perRebirth. 유지: bestStage, gems, chars, char, passMult, boostUntil, tutorial.
- `tapLimiter.ts`: `class TapLimiter { constructor(maxPerSec: number); accept(tSec: number): boolean }` — 최근 1초 창에 maxPerSec개까지.
- `battle.ts`: `interface Battle { stage: number; hp: number; maxHp: number; timeLeft: number; dmg: number; sps: number; shotAcc: number; done: null | 'win' | 'lose' }`, `startBattle(s, stage): Battle`, `stepBattle(b, dt): number` (자동 발사 수 반환, hp·timeLeft 갱신, 판정), `tapBattle(b): void` (한 발 추가, 판정). 탭 제한은 호출하는 쪽이 TapLimiter로.

- [ ] **Step 1: 실패하는 테스트**

```ts
test('buyAtk spends and levels', () => {
  const s = { ...newState(0), coins: 1000 };
  const r = buyAtk(s, 3)!;
  assert.equal(r.atkLv, 3); assert.ok(r.coins < 1000); assert.equal(s.atkLv, 0);
  assert.equal(buyAtk({ ...newState(0), coins: 0 }, 1), null);
});
test('gun needs world unlocked', () => {
  const rich = { ...newState(0), coins: 1e30, gun: 3 };
  assert.equal(buyNextGun(rich), null);              // 4번 총 = 월드 2, bestStage 0
  assert.equal(buyNextGun({ ...rich, bestStage: 10 })!.gun, 4);
});
test('clearStage first and replay', () => {
  const a = clearStage(newState(0), 1);
  assert.ok(a.firstClear); assert.equal(a.state.bestStage, 1); assert.equal(a.coins, firstClearCoins(1));
  const b = clearStage(a.state, 1);
  assert.ok(!b.firstClear); assert.equal(b.coins, replayCoins(1));
  const boss = clearStage({ ...newState(0), bestStage: 9 }, 10);
  assert.equal(boss.unlockedChar, 'yellow'); assert.equal(boss.state.gems, BALANCE.gems.worldBossFirst);
});
test('canAttempt', () => {
  const s = { ...newState(0), bestStage: 4 };
  assert.ok(canAttempt(s, 5) && canAttempt(s, 2)); assert.ok(!canAttempt(s, 6) && !canAttempt(s, 41));
});
test('TapLimiter 8 per sec', () => {
  const t = new TapLimiter(8); let ok = 0;
  for (let i = 0; i < 30; i++) if (t.accept(i / 30)) ok++;
  assert.equal(ok, 8); assert.ok(t.accept(1.01));
});
test('battle win and lose by dps', () => {
  const strong = { ...newState(0), atkLv: 200 };
  const b = startBattle(strong, 1); while (!b.done) stepBattle(b, 0.1);
  assert.equal(b.done, 'win');
  const weak = startBattle(newState(0), 9); while (!weak.done) stepBattle(weak, 0.1);
  assert.equal(weak.done, 'lose'); assert.ok(weak.timeLeft <= 0);
});
```

- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** 구현. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(sim): game state, actions, tap limiter, battle rules`.

### Task 5: 환생 · 오프라인 보상 테스트 보강

**Files:** Create `src/sim/offline.ts`, Test `tests/sim/rebirth.test.ts`, `tests/sim/offline.test.ts`

**Interfaces — Produces:** `offlineReward(s: GameState, now: number, capSec?: number): { coins: number; seconds: number }` = coinPerShot(s, 가장 높은 열린 월드, s.lastSeen) × shotsPerSec × offline.rate × 인정 초(0 ≤ (now − lastSeen)/1000 ≤ capSec). 부스트는 오프라인에 안 붙음.

- [ ] **Step 1: 실패하는 테스트**

```ts
test('rebirth locked before unlockStage', () => {
  assert.ok(!canRebirth({ ...newState(0), bestStage: 9, runBest: 9 }));
  assert.equal(doRebirth({ ...newState(0), bestStage: 9, runBest: 9 }), null);
});
test('doRebirth keeps', () => {
  const s = { ...newState(0), bestStage: 15, runBest: 15, gems: 70, coins: 5e6, atkLv: 80, gun: 5, chars: ['blue', 'yellow'] as CharId[] };
  const r = doRebirth(s)!;
  assert.equal(r.bestStage, 15); assert.equal(r.gems, 70 + BALANCE.gems.perRebirth);
  assert.deepEqual(r.chars, ['blue', 'yellow']);
  assert.equal(r.coins, 0); assert.equal(r.atkLv, 0); assert.equal(r.gun, 0); assert.equal(r.runBest, 0);
  assert.equal(r.tokens, 5); assert.equal(r.rebirths, 1);
  assert.ok(damagePerShot(r) > damagePerShot({ ...newState(0) }));
});
test('offlineReward clock', () => {
  const s = { ...newState(1_000_000) };
  assert.equal(offlineReward(s, 500_000).coins, 0);                       // 시계가 뒤로
  const day = offlineReward(s, 1_000_000 + 86_400_000);
  assert.equal(day.seconds, BALANCE.offline.capSec);                      // 한도에서 자름
  const half = offlineReward(s, 1_000_000 + 60_000);
  assert.ok(Math.abs(half.coins - coinPerShot(s, 1, 0) * shotsPerSec(s) * BALANCE.offline.rate * 60) < 1e-9);
});
```

- [ ] **Step 2:** FAIL → **Step 3:** 구현(`offline.ts`; 환생은 Task 4 코드로 통과해야 함 — 실패하면 Task 4 코드 수정) → **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(sim): offline reward, rebirth tests`.

### Task 6: 로컬 저장

**Files:** Create `src/save/localSave.ts`, `src/sim/normalize.ts`, Test `tests/sim/normalize.test.ts`

**Interfaces — Produces:** `normalizeState(raw: unknown, now: number): GameState` (순수, sim 안), `loadSave(now: number): GameState`, `writeSave(s: GameState): void` (키 `popshooter.save`, try/catch, 실패해도 게임 계속), `class AutoSaver { constructor(get: () => GameState); start(): void; saveNow(): void; dispose(): void }` — 30초마다 + `visibilitychange` hidden + `pagehide`.

- [ ] **Step 1: 실패하는 테스트**

```ts
test('loadSave corrupt', () => {
  assert.deepEqual(normalizeState('not json', 5), newState(5));
  assert.deepEqual(normalizeState(null, 5), newState(5));
  const r = normalizeState({ v: 1, coins: -3, atkLv: 2.7, gun: 99, bestStage: 400, chars: ['blue', 'zzz'], char: 'zzz' }, 5);
  assert.equal(r.coins, 0); assert.equal(r.atkLv, 2); assert.equal(r.gun, 15); assert.equal(r.bestStage, 40);
  assert.deepEqual(r.chars, ['blue']); assert.equal(r.char, 'blue');
  assert.equal(normalizeState({ v: 1, coins: Infinity }, 5).coins, 0);
});
```

- [ ] **Step 2:** FAIL → **Step 3:** 구현 (숫자 필드: 유한·0 이상·정수 필드는 내림·범위 자름, `chars`는 알려진 id만 + 'blue' 항상 포함, `char`가 chars에 없으면 'blue') → **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(save): local save with normalization`.

### Task 7: 진행 시뮬레이터로 10시간 맞추기

**Files:** Create `tools/sim/simulate.ts`, `tools/sim/README.md`; Modify `src/sim/balance.ts`

**Interfaces — Consumes:** Task 3~5 전부. **Produces:** `npm run sim` (script `node tools/sim/simulate.ts`) 출력 = 월드 끝마다 누적 시간·환생 횟수 표.

- [ ] **Step 1:** 시뮬레이터 작성. 1초 단위 시간. 가정: 플레이어는 늘 가장 높은 열린 월드 사격장에 있음, 평균 초당 3탭(`--taps` 인자로 바꿈), 광고·VX 없음.
  - 매초: 코인 += coinPerShot × (shotsPerSec + taps).
  - 구매: "늘어나는 autoDps ÷ 비용"이 가장 큰 것(atk 1레벨 / spd 1레벨 / 다음 총)을 살 수 있으면 반복 구매.
  - 도전: `(autoDps + 탭 피해/초) × stageTime(next) ≥ stageHp(next)`면 클리어 처리(전투 시간만큼 시간 더함).
  - 환생: canRebirth이고 마지막 진전(클리어) 뒤 10분 지났으면 환생.
  - 끝: 40 클리어 또는 30시간.
- [ ] **Step 2:** `npm run sim` 실행해 표 확인.
- [ ] **Step 3:** `BALANCE` 상수 조정을 반복해 목표 범위 안에 넣는다: 1-1 클리어 1~2분, 1-10 50~70분(환생 0회), 2-10 2.5~3.5시간(환생 1~3회), 3-10 5~7시간, 4-10 10~13시간. `--taps 0`(완전 방치)일 때 4-10은 13시간보다 길어야 정상(탭이 의미 있음).
- [ ] **Step 4:** 최종 표와 바꾼 상수를 `tools/sim/README.md`에 기록, 스펙 4.3·4.4·4.5의 "초기값" 옆에 조정 값 메모. `npm test` 전부 PASS(테스트가 BALANCE를 읽으므로 안 깨져야 함).
- [ ] **Step 5:** Commit `feat(tools): progression simulator, tuned balance for 10h`.

### Task 8: 렌더러 · 에셋 · 캐릭터 이식

**Files:**
- Copy from pop-battle (수정 최소, 필요 없는 import 제거): `src/player/PlayerAvatar.ts`, `src/player/ik.ts`, `src/player/pupilFlatten.ts`, `src/player/CharacterAppearance.ts`, `src/net/shared/cosmetics.ts`, `src/config/characters.ts`(CharacterId·CHARACTERS·weaponFitFor·DEFAULT_WEAPON_FIT·CHARACTER_DISPLAY_ORDER·TEAM_* 만), `src/config/weapons.ts`(4종 MOUNT + WeaponMount 타입만, 근접 제외), `src/config/gameConfig.ts`(ASSETS·CHARACTER만), `src/config/combat.ts`(CHARACTER_HITBOX만)
- Copy assets → `public/assets/models/`: 캐릭터 GLB 6개(`character_blue_beanie.glb`, `character-yellow-adjusted.glb`, `character_6.glb`, `character-pink-adjusted.glb`, `character_white.glb`, `character_black.glb`), `team-masks/{blue,yellow,red,pink,white,black}_team_mask.png`, 무기 `weapon_toy_rifle_lod0.glb`·`pop_battle_{pistol,shotgun,sniper}_lod0.glb`; `public/assets/kits/brick/`, `public/assets/kits/prototype/`(라이선스 파일 포함).
- Create: `src/core/Stage3D.ts` (renderer·scene·조명·리사이즈·RAF), `src/assets/loadAssets.ts`, `src/player/Avatar.ts` (PlayerAvatar 감싸기)
- `PlayerController`의 `MoveMode` 타입은 `src/player/moveMode.ts`에 `export type MoveMode = 'idle' | 'walk' | 'run'`(PlayerAvatar가 쓰는 값만, 원본에서 확인)으로.

**Interfaces — Produces:**
- `class Stage3D { renderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; onFrame(cb: (dt: number) => void): void; dispose(): void }` — 탭 hidden이면 RAF 자연 정지, dt 최대 0.1.
- `loadAssets(renderer, onProgress?: (p: number) => void): Promise<Assets>`; `interface Assets { characters: Record<CharId, { scene: THREE.Object3D; clips: THREE.AnimationClip[] }>; guns: Record<GunDef['model'], THREE.Object3D> }`.
- `class Avatar { root: THREE.Object3D; constructor(assets: Assets, char: CharId, gun: GunDef); setGun(gun: GunDef): void; update(dt: number, s: { pos: THREE.Vector3; yaw: number; moving: boolean; aimAt: THREE.Vector3 | null; kick: number }): void; getMuzzle(out: THREE.Vector3): void; dispose(): void }` — 총 tint는 clone한 material color에 곱함(clone material은 dispose), 캐릭터 clone은 `SkeletonUtils.clone` + dispose 때 `skeleton.dispose()`.

- [ ] **Step 1:** 파일·에셋 복사, import 정리, `npm run typecheck` 통과.
- [ ] **Step 2:** `main.ts`에서 Stage3D + loadAssets + 바닥 판 하나 + Avatar(BUBU, 권총) 서 있게.
- [ ] **Step 3:** `preview_start {name: "dev"}` → 콘솔 에러 없음, 캐릭터가 대기 클립으로 서서 권총을 듬. `aimAt`을 앞쪽 점으로 주면 겨누는 자세. 스크린샷 1장.
- [ ] **Step 4:** Commit `feat: port character avatar and weapon models from pop-battle`.

### Task 9: 광장 이동 (키보드 · 클릭/탭 이동 · 조이스틱 · 카메라)

**Files:** Create `src/world/movement.ts`, `src/core/Controls.ts`, `src/core/Joystick.ts`, `src/camera/FollowCamera.ts`, `src/world/World1Hub.ts`, `src/world/facilities.ts`, Test `tests/world/movement.test.ts`

**Interfaces — Produces:**
- `movement.ts`(순수): `type Collider = { kind: 'circle'; x: number; z: number; r: number } | { kind: 'box'; x: number; z: number; hx: number; hz: number }`; `moveWithColliders(x: number, z: number, dx: number, dz: number, radius: number, colliders: readonly Collider[], bounds: { hx: number; hz: number }): { x: number; z: number }` — 밀어내기 + 벽 따라 미끄러짐.
- `facilities.ts`: `type FacilityId = 'range' | 'upgrade' | 'guns' | 'altar' | `gate${number}``; `interface Facility { id: FacilityId; x: number; z: number; radius: number; label: string }`; `WORLD1_FACILITIES: readonly Facility[]` (사격장·업그레이드 기계·총 상점·환생 제단 + 문 10개를 광장 둘레 길 따라); `nearestFacility(x, z, list): Facility | null` (radius 안 가장 가까운 것).
- `Controls`: `move(): { x: number; z: number }`(카메라 기준 −1..1, WASD/화살표 ∪ 조이스틱 ∪ 이동 목표점), `consumeTaps(): number`(화면 탭/클릭 횟수, UI 위 탭 제외), `setMoveTarget`(바닥 클릭/탭 → 레이캐스트 지점, 도착 0.3m 또는 다른 입력 시 해제), 드래그(8px 넘게 움직인 포인터)는 탭이 아니라 카메라 회전.
- `Joystick`: 화면 왼쪽 40% 안에서 누른 곳에 뜨는 조이스틱, pointerId별 처리(팝배틀 `TouchInput`의 떠다니는 조이스틱 부분 참고). 터치 입력일 때만.
- `FollowCamera`: 뒤 위에서 비스듬히(거리 9, 높이 6 초기값), 드래그로 yaw 회전, 부드럽게 따라감.
- `World1Hub`: 팝배틀 brick 키트 바닥·블록 집 몇 채·시계탑 대신 키트 탑(임시) + 시설 임시 도형(각 시설 다른 색·라벨) + 콜라이더 목록. `dispose()`.

- [ ] **Step 1: 실패하는 테스트**

```ts
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
test('nearestFacility', () => {
  assert.equal(nearestFacility(WORLD1_FACILITIES[0]!.x, WORLD1_FACILITIES[0]!.z, WORLD1_FACILITIES)!.id, WORLD1_FACILITIES[0]!.id);
  assert.equal(nearestFacility(9999, 9999, WORLD1_FACILITIES), null);
});
```

- [ ] **Step 2:** FAIL → **Step 3:** 구현 (이동 속도 4.8 m/s, 반지름 0.4) → **Step 4:** PASS.
- [ ] **Step 5:** 브라우저 확인: WASD 이동, 바닥 클릭 이동, `resize_window mobile` 후 조이스틱 이동·탭 이동·드래그 회전, 시설에 부딪힘. 데스크톱으로 되돌림.
- [ ] **Step 6:** Commit `feat: world 1 hub with keyboard, click/tap and joystick movement`.

### Task 10: 게임 흐름 · HUD · 시설 버튼

**Files:** Create `src/core/Game.ts`, `src/ui/dom.ts`, `src/ui/Hud.ts`, `src/ui/ui.css`; Modify `src/main.ts`

**Interfaces — Produces:**
- `class Game { state: GameState; mode: 'hub' | 'training' | 'battle'; constructor(stage: Stage3D, assets: Assets); setState(next: GameState): void /* 저장·HUD 갱신 알림 */; enterTraining(): void; leaveTraining(): void; startStage(stage: number): void; endBattle(): void }` — 상태 변경은 전부 `setState`를 거침, HUD는 바뀐 값만 다시 씀.
- `ui/dom.ts`: `el(tag, cls?, text?)`, `button(label, onPress)` (pointerup으로 실행, 터치·마우스 같은 동작).
- `Hud`: 위 = 코인·팝젬·환생 배율(×), 왼쪽 = 공격력·초당 발사·DPS, 시설 근처일 때 아래 가운데 큰 버튼("훈련 시작" / "업그레이드" / "총 상점" / "환생" / "1-3 도전" · 못 들어가는 문은 "잠김"). `update(s: GameState, near: Facility | null)`.

- [ ] **Step 1:** Game이 AutoSaver(Task 6)로 상태를 불러오고, 매 프레임 이동·가까운 시설 계산, HUD 갱신.
- [ ] **Step 2:** 브라우저 확인: 시설마다 맞는 버튼, 새로고침해도 코인 유지(콘솔 `__game.setState({...__game.state, coins: 500})` → 새로고침 → 500). 개발 빌드에서만 `window.__game` 노출.
- [ ] **Step 3:** Commit `feat: game flow, HUD and facility prompts`.

### Task 11: 사격장 훈련

**Files:** Create `src/training/TrainingRange.ts`, `src/fx/HitFx.ts`, `src/ui/FloatText.ts`

**Interfaces — Consumes:** `coinPerShot`, `shotsPerSec`, `TapLimiter`, `addCoins`, `Avatar.getMuzzle`. **Produces:** `class TrainingRange { start(): void; stop(): void; update(dt: number, taps: number, now: number): void; catchUp(elapsedSec: number, now: number): number /* 정산 코인 */ }`.

- [ ] **Step 1:** 훈련 시작 → 캐릭터가 사격장 칸으로 이동해 과녁을 겨눔, shotsPerSec 간격 자동 발사, 탭은 TapLimiter(8) 통과분만 추가 발사. 발사마다 총구 섬광·과녁 흔들림·"+코인" 떠오르는 글자(같은 프레임 여러 발은 한 글자로 합침). 코인은 0.25초마다 모아서 `setState`.
- [ ] **Step 2:** 이펙트 material은 모듈에 하나씩 만들어 공유, 떠오르는 글자는 DOM 노드 풀(최대 12개) 재사용.
- [ ] **Step 3:** 탭 숨김 정산: `visibilitychange` hidden 시각 기록 → visible 때 훈련 중이었으면 `catchUp(min(경과, offline.capSec), now)` (100% 속도, 탭 없음) + "자리 비운 동안 +N" 글자.
- [ ] **Step 4:** 브라우저 확인: 자동 발사·탭 추가 발사, 연타해도 초당 8발 이상 안 늘어남(콘솔 카운터), 30초 동안 `renderer.info.memory.geometries/textures`가 그대로.
- [ ] **Step 5:** Commit `feat: shooting range training with tap bonus`.

### Task 12: 업그레이드 · 총 상점 창

**Files:** Create `src/ui/UpgradePanel.ts`, `src/ui/GunPanel.ts`, `src/ui/Panel.ts`

**Interfaces — Consumes:** `buyAtk`, `buySpd`, `maxAffordable`, `buyNextGun`, `GUNS`, `gunPrice`, `gunMult`, `Avatar.setGun`. **Produces:** `class Panel { open(): void; close(): void; readonly isOpen: boolean }` (공통 창: 제목·닫기·바깥 탭 닫기).

- [ ] **Step 1:** 업그레이드 창: 공격력·공격 속도 줄마다 현재 값 → 다음 값, 구매 단위 토글 [×1 | ×10 | 최대](선택 기억은 localStorage), 비용, 못 사면 버튼 흐림. 공격 속도 최대면 "최대".
- [ ] **Step 2:** 총 상점: 16자루 목록(월드별 묶음), 가진 것·다음 것(가격·피해 배율)·잠긴 월드("월드 2 열면"). 사면 즉시 Avatar 총 교체 + 짧은 축하 효과.
- [ ] **Step 3:** 브라우저 확인: 코인 넣고 ×1/×10/최대 구매 결과가 sim 함수와 같음, 총 교체 모습, 모바일 크기에서 버튼 누르기 쉬움.
- [ ] **Step 4:** Commit `feat: upgrade and gun shop panels`.

### Task 13: 스테이지 문 · 자동 전투 · 결과

**Files:** Create `src/battle/BattleScene.ts`, `src/battle/Boss.ts`, `src/ui/BattleHud.ts`, `src/ui/ResultCard.ts`

**Interfaces — Consumes:** `canAttempt`, `startBattle`, `stepBattle`, `tapBattle`, `TapLimiter`, `clearStage`, `stageLabel`, `stageHp`, `maxDps`. **Produces:** `class BattleScene { enter(stage: number): void; update(dt: number, taps: number): void; exit(): void; onEnd: (r: { win: boolean; stage: number }) => void }`, `class Boss { constructor(stage: number); root: THREE.Object3D; hit(): void; setHpRatio(r: number): void; defeat(): void; dispose(): void }`.

- [ ] **Step 1:** 문 버튼 → 광장 숨기고 작은 전투 무대(바닥 원판 + 월드 1 색) 표시, 캐릭터가 보스를 자동 사격. 보스 = 임시: 크게 키운 팝배틀 캐릭터(스테이지마다 크기 1.5→3배·색 변경, 10번은 4배 + 왕관 도형). 맞으면 통통·찌그러짐, 체력 50%·25%에서 색 진해짐, 쓰러지면 튀어 오르며 작아져 사라짐.
- [ ] **Step 2:** BattleHud: 보스 체력바(숫자 formatNum), 남은 시간, 내 DPS, "탭해서 더 쏘기!" 안내(처음 3번 전투만).
- [ ] **Step 3:** 결과 카드: 승리 = 코인(+팝젬, +캐릭터 해금 알림), [광장으로] [다음 도전](다음 스테이지 가능할 때). 패배 = "필요 DPS ≈ {formatNum(stageHp / stageTime)} / 지금 {formatNum(autoDps)}" + [업그레이드 하러 가기](업그레이드 창 열기) + [광장으로]. 이어하기 버튼 없음.
- [ ] **Step 4:** 전투 중에는 시설 버튼·환생 불가(Game.mode === 'battle'이면 시설 프롬프트 숨김). 전투 나가면 Boss·무대 dispose(공유 캐릭터 geometry는 dispose 안 함, clone skeleton은 dispose).
- [ ] **Step 5:** 브라우저 확인: 콘솔로 강한 상태 만들어 1-1 승리 → 1-2 문 열림, 약한 상태로 1-9 패배 화면, 전투 10회 반복 후 `renderer.info.memory.textures`가 시작 값으로 돌아옴.
- [ ] **Step 6:** Commit `feat: stage gates, auto battle and result card`.

### Task 14: 환생 제단 · 오프라인 보상 창 · 캐릭터 바꾸기

**Files:** Create `src/ui/RebirthPanel.ts`, `src/ui/OfflinePanel.ts`, `src/ui/CharacterPanel.ts`

**Interfaces — Consumes:** `canRebirth`, `rebirthTokens`, `rebirthMult`, `doRebirth`, `offlineReward`.

- [ ] **Step 1:** 환생 창: 잠김이면 "1-10을 깨면 열림". 열렸으면 "환생 배율 ×{현재} → ×{다음}", 초기화·유지 항목 목록, [환생하기] → 한 번 더 확인 → 짧은 연출(화면 하얗게 + 캐릭터 통통) → 상태 적용·저장.
- [ ] **Step 2:** 오프라인 창: 게임 시작 때 `offlineReward(state, Date.now())`가 0보다 크면 "자리 비운 {시간} 동안 +{코인}" [받기]. 광고 2배 버튼 자리는 계획 2에서(지금은 없음). 받으면 lastSeen 갱신.
- [ ] **Step 3:** 캐릭터 창(HUD 메뉴): 가진 캐릭터 고르기(표시 이름 BUBU·MOCHI·ROKO·POPI·SHONI·BAM), 잠긴 것은 해금 조건 표시("1-10 클리어" 등, SHONI·BAM은 "상점(준비 중)").
- [ ] **Step 4:** 브라우저 확인: 1-10 깬 상태로 환생 → 스탯 0·bestStage 유지·배율 올라감, lastSeen을 1시간 전으로 바꾸고 새로고침 → 오프라인 창.
- [ ] **Step 5:** Commit `feat: rebirth altar, offline reward and character select`.

### Task 15: 사운드 · 첫 로딩 · 튜토리얼 · 마무리

**Files:**
- Copy from pop-battle: `src/audio/AudioManager.ts`, `src/audio/sfxBank.ts`, `src/audio/musicTracks.ts`, `src/config/audio.ts`(쓰는 소리만 남김), 사격·처치 녹음 파일(`public/assets/audio/sfx/` 중 권총·라이플·샷건·스나이퍼 발사, 처치)
- Create: `src/ui/Tutorial.ts`, `src/ui/Loading.ts`

- [ ] **Step 1:** 소리: 총 모델별 발사음(같은 프레임 여러 발은 1번, 최대 동시 4개), 코인, 레벨업, 총 구매, 승리·패배, 보스 쓰러짐, 환생. 배경음: 광장·전투(합성, 첫 입력 뒤 시작). 설정 창에 전체·효과음·배경음 + 음소거.
- [ ] **Step 2:** 첫 로딩: 로고 "POP Shooter" + 진행 바(loadAssets onProgress), 다 되면 걷힘.
- [ ] **Step 3:** 튜토리얼(state.tutorial 단계): ① 사격장으로 화살표 → 훈련 시작 ② 코인 100 모이면 업그레이드 기계로 → 공격력 사기 ③ 1-1 문으로 → 도전 ④ 끝(99). 바닥 화살표 + 위쪽 한 줄 안내, 건너뛰기 버튼.
- [ ] **Step 4:** 처음부터 끝까지 확인: 새 저장으로 시작 → 튜토리얼 → 1-1 클리어까지 실제 시간 1~2분 안. 콘솔로 1-10까지 올린 상태에서 환생 1회. 모바일 크기 한 번. `npm test`·`npm run build` 통과.
- [ ] **Step 5:** Commit `feat: sound, loading screen, tutorial`.

---

## Self-Review 결과

- 스펙 4.1~4.7(광장·훈련·성장·전투·환생·오프라인·시간 배분), 6(캐릭터 해금), 10(화면 중 광장·전투·환생·오프라인·업그레이드·설정), 11(사운드), 12(구조의 sim/·world/·battle/·player/·ui/·audio/·tools/sim/), 13(임시 도형 대체)을 Task 2~15가 다룬다.
- 의도적으로 뺀 스펙 항목(다음 계획): 7 멀티, 8 서버 저장·검사, 9 광고·VX·팝젬 사용처·출석, 5 월드 2~4 에셋, 3 플랫폼 어댑터.
- 이름 일관성: `GameState`·`CharId`·`GunDef`·`Facility`·`Battle`는 정의한 Task의 이름을 뒤 Task가 그대로 씀.

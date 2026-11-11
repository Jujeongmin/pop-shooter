/**
 * 밸런스 상수 한곳. 스펙 4.3~4.6의 초기값에서 출발해 tools/sim/simulate.ts 결과로 조정한다.
 * 테스트는 이 값을 읽으므로 숫자를 바꿔도 깨지지 않는다.
 * 보스 체력은 공식이 아니라 표(stageTable.ts) — `npm run sim -- --fit`이 목표 시간(TARGET_MIN)에 맞춰 만든다.
 */
export const BALANCE = {
  atk: { baseCost: 10, costGrowth: 1.12, doubleEvery: 25 },
  spd: { baseCost: 25, costGrowth: 1.25, step: 0.25, cap: 12 },
  tap: { maxPerSec: 8 },
  gun: { count: 16, perWorld: 4, dmgStep: 2.5, priceMult: 8 },
  stage: {
    perWorld: 10, worlds: 4,
    timeNormal: 20, timeBoss: 30, firstClearCoinMult: 2, replayCoinMult: 0.3,
    /** 1-1 체력 고정: 처음 온 사람이 몇 초 훈련하면 바로 이기게 (사용자 2026-11-11). 표(fit)는 1-2부터 의미 있음 */
    firstHp: 300,
    /** 1-1부터 스테이지마다 체력 배수 (표에 닿을 때까지) */
    firstRamp: 6,
  },
  /**
   * 환생 (키보드 탈출 방식, 사용자 2026-11-11): 공격력 레벨이 reqBase + reqStep × 환생 횟수에 닿으면 환생 가능.
   * 보상은 환생마다 배율 ×multGrowth (토큰 1개, 곱으로 쌓임: 보스 체력이 기하급수라 덧셈 배율은 뒤 월드에서 모자람).
   * 32회 뒤 Ascend·결제로 조건 건너뛰기는 VX 상점 때.
   */
  rebirth: { reqBase: 60, reqStep: 30.5, multGrowth: 1.33 },
  /** 캐릭터 피해 배율: 해금 순서대로 점점 좋게 (사용자 2026-11-11). 코인도 피해에 비례해 같이 오름 */
  charMult: { blue: 1, yellow: 1.5, red: 2, pink: 3, white: 5, black: 8 },
  /** 월드별 보스 체력 배수: 앞 월드 대장으로 얻는 캐릭터 배율만큼 (캐릭터를 세게 한 만큼 진행 시간이 줄지 않게) */
  // 훈련 성장(training.ts)을 넣으며 다시 맞춤 (2026-11-11): 훈련치가 회차마다 공격·코인을 몇 배 올려서 그만큼 체력을 올림.
  // 월드 1은 앞쪽이 firstRamp 곡선이라 조금만 영향. 시뮬레이터로 찾은 값 (scratch tune: 목표 1-10 ~25분, 2-10 180, 3-10 360, 4-10 690분)
  worldHpMult: [30, 3970, 8290, 18700],
  range: { multByWorld: [1, 4, 16, 64] },
  offline: { rate: 0.5, capSec: 7200 },
  gems: { worldBossFirst: 50, perRebirth: 10 },
  boost: { coinMult: 2 },
  /**
   * 훈련 성장 (training.ts). gain = 기계 0레벨에서 한 발에 쌓이는 %, 기계 레벨마다 +levelStep (덧셈: 곱이면 코인과 같이 기하급수로 커져 진행이 무너짐),
   * 한도 = capBase + capStep × 기계 레벨 (%), 장비 하나마다 ×gearMult, 멘토 한 명마다 ×mentorMult (한도·속도). 초당 발사 훈련은 spdCap%까지.
   */
  train: {
    gain: { atk: 0.01, spd: 0.005, coin: 0.01 },
    capBase: { atk: 10, spd: 5, coin: 10 },
    capStep: { atk: 5, spd: 2, coin: 5 },
    levelStep: 0.1,
    machine: { atk: { base: 30, growth: 1.4 }, spd: { base: 45, growth: 1.4 }, coin: { base: 35, growth: 1.4 } },
    gearMult: 1.45,
    mentorMult: 1.28,
    spdCap: 100,
  },
} as const;

export const STAGE_COUNT = BALANCE.stage.perWorld * BALANCE.stage.worlds;

/** 스테이지 첫 클리어 목표 누적 시간(분). 월드 끝 = 60 / 180 / 360 / 630분 (스펙 4.7). 탭 3회/초, 광고·VX 없는 플레이 기준 */
export const WORLD_END_MIN = [60, 180, 360, 630] as const;
export const FIRST_STAGE_MIN = 1.5;

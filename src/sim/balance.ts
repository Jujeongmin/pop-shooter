/**
 * 밸런스 상수 한곳. 스펙 4.3~4.6의 초기값에서 출발해 tools/sim/simulate.ts 결과로 조정한다.
 * 테스트는 이 값을 읽으므로 숫자를 바꿔도 깨지지 않는다.
 */
export const BALANCE = {
  atk: { baseCost: 10, costGrowth: 1.12, doubleEvery: 25 },
  spd: { baseCost: 25, costGrowth: 1.25, step: 0.25, cap: 12 },
  tap: { maxPerSec: 8 },
  gun: { count: 16, perWorld: 4, dmgStep: 2.5, basePrice: 100, priceStep: 6 },
  stage: {
    perWorld: 10, worlds: 4, baseHp: 60, hpGrowth: 1.6, bossMult: 3,
    timeNormal: 20, timeBoss: 30, firstClearCoinMult: 2, replayCoinMult: 0.3,
  },
  rebirth: { unlockStage: 10, tokenOffset: 5, tokenDiv: 2, multPerToken: 0.5 },
  range: { multByWorld: [1, 4, 16, 64] },
  offline: { rate: 0.5, capSec: 7200 },
  gems: { worldBossFirst: 50, perRebirth: 10 },
  boost: { coinMult: 2 },
} as const;

export const STAGE_COUNT = BALANCE.stage.perWorld * BALANCE.stage.worlds;

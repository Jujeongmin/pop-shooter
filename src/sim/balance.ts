/**
 * 밸런스 상수 한곳. tools/sim/simulate.ts는 진행 시간을 보여 주기만 함 (사용자 2026-11-12: 플레이 시간 목표에 맞춰 조정하지 않음).
 * 테스트는 이 값을 읽으므로 숫자를 바꿔도 깨지지 않는다.
 *
 * 성장 구조 (사용자 2026-11-11, 포키 +1 MMA Fighter · 로블록스 +1 Speed Keyboard Escape 방식):
 * - 훈련 = 주 성장, 한도 없음. 훈련장(공격 과녁 / 움직이는 표적 / 코인 과녁)에서 쏘면 그 능력치만 오름.
 * - 골드 = 전투(첫 클리어·반복 도전)와 오프라인에서만. 골드로 총(피해 배율)·기구(훈련 속도)·장비(훈련 속도) 구매.
 * - 환생 = 공격 훈련치가 기준에 닿으면. 훈련치만 0, 골드·총·기구·장비 유지, 훈련 속도 영구 배율.
 */
export const BALANCE = {
  tap: { maxPerSec: 8 },
  /** 총: i번 가격 = priceBase × priceGrowth^(i−1) */
  gun: { count: 32, perWorld: 4, dmgStep: 2.5, priceBase: 400, priceGrowth: 6 },
  stage: {
    perWorld: 10, worlds: 8,
    timeNormal: 20, timeBoss: 30,
    /** 골드: 첫 클리어 = goldBase × goldGrowth^(번호−1) (대장 ×bossGold), 반복 = 그 × replayMult. 체력보다 느리게 늘어 뒤로 갈수록 오래 걸림 */
    goldBase: 60, goldGrowth: 1.45, bossGold: 3, replayMult: 0.25,
    /** 1-1 체력: 처음 온 사람이 몇 초 훈련하면 이김 */
    firstHp: 300,
    /** 스테이지마다 체력 배수 */
    hpGrowth: 3.6,
    bossMult: 2.5,
  },
  /** 월드별 체력 배수 (월드가 바뀔 때 뛰는 값). 1~4는 2026-11-11 시뮬레이터 탐색값, 5~8은 월드 4처럼 막힘 없이 이어지게만 (시간 목표 아님, 사용자 2026-11-12: 탭 3/초 시뮬 5-10 17h·6-10 29h·7-10 45h·8-10 69h) */
  worldHpMult: [1, 120, 12, 0.8, 0.02, 0.0005, 0.0000125, 0.0000003],
  /**
   * 환생: 공격 훈련치가 reqBase × reqGrowth^환생 횟수에 닿으면 가능.
   * 보상 = 훈련 속도 ×multGrowth (곱으로 쌓임).
   */
  rebirth: { reqBase: 3000, reqGrowth: 3.5, multGrowth: 1.4 },
  /** 캐릭터 피해 배율: 해금 순서대로 점점 좋게 */
  charMult: { blue: 1, yellow: 1.5, red: 2, pink: 3, white: 5, black: 8 },
  offline: { rate: 0.5, capSec: 7200, goldRate: 0.25 },
  gems: { worldBossFirst: 50, perRebirth: 10 },
  /** 팝젬으로 환생 조건 건너뛰기 (키보드 탈출 Skip Rebirth, 사용자 2026-11-12): 값 = base + step × 환생 횟수 */
  skipRebirth: { base: 100, step: 50 },
  boost: { coinMult: 2 },
  /**
   * 훈련 (training.ts). gain = 한 발에 오르는 양 (공격 = 점수, 연사·코인 = %),
   * 훈련장 등급(월드) ×station, 기구 레벨마다 ×machineStep, 장비 하나마다 ×gearMult, 멘토 한 명마다 ×mentorMult, 환생 배율.
   * 초당 발사 = 1 × (1 + 연사%/100), spdMax%(= 초당 12발)까지.
   */
  train: {
    gain: { atk: 1, spd: 0.25, coin: 0.5 },
    station: [1, 2, 4, 8, 16, 32, 64, 128],
    machineStep: 1.15,
    /** 기구 값 = base × growth^레벨 (첫 기구는 1-1 첫 클리어 골드로 살 수 있게) */
    machine: { base: 50, growth: 1.6 },
    /** 장비 값 = gearBase × gearGrowth^(단계−1) (종류별 같은 값) */
    gearBase: 800, gearGrowth: 40,
    gearMult: 1.6,
    mentorMult: 1.3,
    spdMax: 1100,
    /** 러닝머신(연사)·동전 분수(골드 보너스)의 기본 동작 수/초 (내 연사와 무관, 탭으로 더함). 사격장(공격)은 초당 발사 수 (사용자 2026-11-12) */
    actionsPerSec: 2,
  },
} as const;

export const STAGE_COUNT = BALANCE.stage.perWorld * BALANCE.stage.worlds;

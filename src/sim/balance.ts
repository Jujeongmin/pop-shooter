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
    /** 1-1 체력: 처음 온 사람이 몇 초 훈련하면 이김 (2026-11-13: 300 → 180, 모든 스테이지 체력 ×0.6 = 더 쉽게) */
    firstHp: 180,
    /**
     * 스테이지마다 체력 배수, 월드별 (2026-11-13: 예전엔 모든 월드 3.6 + 월드 입구에서 뛰는 배수 worldHpMult →
     * 2-1이 1-10의 수백 배라 입구에서 오래 막히고 그 뒤는 술술. 이제 앞 스테이지에서 그대로 이어지고 월드마다 오름폭만 다름).
     * 월드 2~8 값은 `npm run sim -- --fit 1`로 월드 대장 목표 시각(0.7·3·7·13·22·35·55·90시간)에 맞춘 것
     */
    hpGrowth: [3.6, 7.99, 3.37, 2.94, 2.74, 2.57, 2.61, 2.58],
    /**
     * 대장 체력 배수 (2026-11-13: 2.5 → 1.5). 대장은 제한 시간이 30초(보통 20초)라 필요 DPS 증가 = 오름폭 × 1.5 × 20/30 = 오름폭 그대로
     * = 다른 스테이지와 같은 오름폭 (예전 2.5는 6배라 1-10에서 갑자기 막힘, 사용자 2026-11-13)
     */
    bossMult: 1.5,
  },
  /**
   * 환생: 공격 훈련치가 reqBase × reqGrowth^환생 횟수에 닿으면 가능.
   * 보상 = 훈련 속도 배율 표 ×1.5, ×2, ×3, ×4, ×6, ×8 … (training.ts rebirthMult).
   */
  rebirth: { reqBase: 3000, reqGrowth: 6 },
  /** 캐릭터 피해 배율: 해금 순서대로 점점 좋게 */
  charMult: { blue: 1, yellow: 1.5, red: 2, pink: 3, white: 5, black: 8 },
  offline: { capSec: 7200, goldRate: 0.25 },
  gems: { worldBossFirst: 10, perRebirth: 0 },
  /** 팝젬으로 환생 조건 건너뛰기 (키보드 탈출 Skip Rebirth, 사용자 2026-11-12): 값 = base + step × 환생 횟수 */
  skipRebirth: { base: 100, step: 50 },
  boost: { coinMult: 2 },
  /**
   * 훈련 (training.ts). gain = 한 발에 오르는 양 (공격 = 점수, 연사·코인 = %),
   * 훈련장 등급(월드) ×station, 기구 레벨마다 ×machineStep, 장비 하나마다 ×gearMult, 멘토 한 명마다 ×mentorMult, 환생 배율.
   * 초당 발사 = 1 × (1 + 연사%/100), 상한 없음 (2026-11-13: 초당 12번을 넘으면 화면에서는 한 번에 여러 발, fx/fireGroup).
   */
  train: {
    gain: { atk: 1, spd: 0.25, coin: 0.5 },
    station: [1, 2, 4, 8, 16, 32, 64, 128],
    machineStep: 1.15,
    /** 기구 값 = base × growth^레벨 (첫 기구는 1-1 첫 클리어 골드로 살 수 있게) */
    machine: { base: 50, growth: 1.6 },
    /**
     * 장비 값 (단계 1~8, 종류별 같은 값). 2026-11-13: 800·32K·1.28M 세 단계는 금방 다 사서 '너무 싸다' → 8단계로 늘리고
     * 값은 시뮬레이터의 그때 재산(가진 골드 + 기구에 쓴 골드)에 맞춤: 열린 뒤 3~5스테이지쯤 더 가야 한 종류를 삼.
     * 골드 수입이 골드 훈련 배율로 월드마다 약 1.5만 배씩 늘어서 값도 그만큼 뜀
     */
    gearPrice: [1500, 15_000, 2e7, 3e13, 1e18, 3e22, 4e26, 5e30],
    gearMult: 1.6,
    mentorMult: 1.3,
    /** 초당 발사가 이 값을 넘으면 로그로만 오름 (training.ts softSpd) */
    spdSoft: 12,
    /** 러닝머신(연사)·동전 분수(골드 보너스)의 기본 동작 수/초 (내 연사와 무관, 탭으로 더함). 사격장(공격)은 초당 발사 수 (사용자 2026-11-12) */
    actionsPerSec: 2,
  },
} as const;

export const STAGE_COUNT = BALANCE.stage.perWorld * BALANCE.stage.worlds;

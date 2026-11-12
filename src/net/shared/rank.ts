// 기록판 (서버·클라이언트 공용, 순수 함수만).
// 순서 = 최고 DPS (사용자 2026-11-12: 지금 DPS가 아니라 지금까지 가장 높았던 DPS. 환생하면 지금 DPS는 내려가도 기록은 유지).
// 서버가 저장할 때마다 저장값으로 DPS(autoDps)를 계산해 기록판 줄의 최고값과 비교, 큰 값을 정렬 키로 씀.
// 클라이언트 저장 기반(서버 경제 검사를 거친 값)이라 공식 랭킹이 아님 (화면에 "기록판").
// 컬렉션 이름을 바꿈: 예전 키(환생·스테이지·공격력 합친 값)와 섞이지 않게 새 판에서 시작.

export const RANK_COLLECTION = 'ps_rank_dps';
/** 판에 보이는 줄 수 */
export const RANK_TOP = 10;

export interface RankRow {
  /** 닉네임 (없으면 null → 화면에서 '플레이어') */
  nick: string | null;
  rb: number;
  bs: number;
  /** 최고 DPS */
  pw: number;
  c: string;
  /** 내 줄이면 true (계정 id는 보내지 않음) */
  me?: boolean;
}

export interface RankBoard {
  ok: true;
  rows: RankRow[];
  /** 내 순위 (기록 없으면 0) */
  myRank: number;
  mine: RankRow | null;
}

/** 정렬 키 = 최고 DPS (이전 최고와 지금 중 큰 값, 숫자 아니면 0) */
export function bestDps(prevBest: unknown, now: number): number {
  const p = typeof prevBest === 'number' && Number.isFinite(prevBest) && prevBest > 0 ? prevBest : 0;
  const n = Number.isFinite(now) && now > 0 ? now : 0;
  return Math.max(p, n);
}

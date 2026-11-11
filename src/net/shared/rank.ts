// 기록판 (서버·클라이언트 공용, 순수 함수만).
// 순서: 환생 횟수 → 최고 스테이지 → 공격력 (모두 높은 순). 정렬 키 하나로 합쳐 서버가 내림차순 상위 N만 읽음 (pop-battle 랭킹과 같은 방식).
// 키 = (환생 × 100 + 최고 스테이지) × 1000 + 공격력 자리값(0..999, log10 × 20). 환생 1e8번까지 정밀도 안전 (2^53 미만).
// 클라이언트 저장 기반이라 공식 랭킹이 아님 (화면에 "기록판"). 코인 증가 상한 검사는 계획 3.

export const RANK_COLLECTION = 'ps_rank';
/** 판에 보이는 줄 수 */
export const RANK_TOP = 10;

export interface RankRow {
  /** 닉네임 (없으면 null → 화면에서 '플레이어') */
  nick: string | null;
  rb: number;
  bs: number;
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

/** 공격력 자리값 0..999 (1이면 0, 10배마다 +20) */
function powerDigits(pw: number): number {
  if (!(pw > 1)) return 0;
  return Math.min(999, Math.floor(Math.log10(pw) * 20));
}

export function rankKey(rb: number, bs: number, pw: number): number {
  return (Math.max(0, Math.floor(rb)) * 100 + Math.max(0, Math.min(99, Math.floor(bs)))) * 1000 + powerDigits(pw);
}

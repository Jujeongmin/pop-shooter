// 꾸미기 (서버·클라이언트 공용): 모자·옷 색, 승리 포즈, 이름표. 지금은 전부 무료.
// 원본 = 계정별 글로벌 사용자 상태 look (서버 lookSet이 normalizeLook으로 검사해 저장, hello·hubHello가 직접 읽음).
// 색은 팀 색 마스크(R = 모자, G = 상의)를 그대로 써서 칠함 → TDM에서는 팀 색이 우선.

/** 옷 색 팔레트 (sRGB). id는 저장·전송용이라 바꾸지 말 것 (이름·색은 바꿔도 됨) */
export const LOOK_COLORS = [
  { id: 'sky', name: '하늘', hex: '#5aa9ff' },
  { id: 'blue', name: '파랑', hex: '#2f6bff' },
  { id: 'mint', name: '민트', hex: '#3fd0a8' },
  { id: 'green', name: '초록', hex: '#5cc25a' },
  { id: 'lemon', name: '레몬', hex: '#ffd84a' },
  { id: 'orange', name: '오렌지', hex: '#ff9a3c' },
  { id: 'coral', name: '코랄', hex: '#ff6f61' },
  { id: 'red', name: '빨강', hex: '#e8423f' },
  { id: 'pink', name: '핑크', hex: '#ff8fc8' },
  { id: 'lilac', name: '라일락', hex: '#b48cff' },
  { id: 'purple', name: '보라', hex: '#7b5cff' },
  { id: 'cream', name: '크림', hex: '#fff1d6' },
  { id: 'white', name: '흰색', hex: '#f4f6ff' },
  { id: 'charcoal', name: '먹색', hex: '#4a4f63' },
] as const;
export type LookColorId = (typeof LOOK_COLORS)[number]['id'];

/**
 * 결과 화면 1위·TDM 승리 포즈 (cheer = 기존 만세). 브이·하트는 2026-10-30 뺌: 캐릭터 손이 주먹 메시(손가락 본 없음)라
 * 브이·하트 모양이 안 나옴 (Blender 렌더 점검). 예전에 저장된 peace·heart는 normalizeLook이 기본(만세)으로 읽음
 */
export const VICTORY_POSES = [
  { id: 'cheer', name: '만세' },
  { id: 'jump', name: '점프 환호' },
] as const;
export type VictoryPoseId = (typeof VICTORY_POSES)[number]['id'];

/** 이름표 (로비 머리 위·대기실 이름 칸). basic = 기존 모양 */
export const NAME_PLATES = [
  { id: 'basic', name: '기본', bg: '', ink: '' },
  { id: 'sky', name: '하늘', bg: '#cfe7ff', ink: '#1d4f9a' },
  { id: 'pink', name: '핑크', bg: '#ffd6ea', ink: '#a8326f' },
  { id: 'lemon', name: '레몬', bg: '#fff0a8', ink: '#8a6200' },
  { id: 'mint', name: '민트', bg: '#c9f4e4', ink: '#1d7a5c' },
  { id: 'lilac', name: '라일락', bg: '#e6dcff', ink: '#5a3fb0' },
] as const;
export type NamePlateId = (typeof NAME_PLATES)[number]['id'];

/** 꾸미기 값. h·t = 모자·옷 색 ('' = 원래 색) */
export interface Look {
  h: LookColorId | '';
  t: LookColorId | '';
  p: VictoryPoseId;
  n: NamePlateId;
}

export const DEFAULT_LOOK: Readonly<Look> = { h: '', t: '', p: 'cheer', n: 'basic' };

const has = <T extends { id: string }>(list: readonly T[], v: unknown): v is T['id'] => typeof v === 'string' && list.some((x) => x.id === v);

/** 받은 값 검사: 모르는 값·형식이 틀린 칸은 기본값 (언제나 올바른 Look을 돌려줌) */
export function normalizeLook(raw: unknown): Look {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    h: has(LOOK_COLORS, o.h) ? o.h : '',
    t: has(LOOK_COLORS, o.t) ? o.t : '',
    p: has(VICTORY_POSES, o.p) ? o.p : DEFAULT_LOOK.p,
    n: has(NAME_PLATES, o.n) ? o.n : DEFAULT_LOOK.n,
  };
}

export function sameLook(a: Look | null | undefined, b: Look | null | undefined): boolean {
  return !!a && !!b && a.h === b.h && a.t === b.t && a.p === b.p && a.n === b.n;
}

/** 색 id → hex (원래 색이면 null) */
export function lookColorHex(id: string | undefined): string | null {
  return LOOK_COLORS.find((c) => c.id === id)?.hex ?? null;
}

export function namePlate(id: string | undefined): (typeof NAME_PLATES)[number] {
  return NAME_PLATES.find((p) => p.id === id) ?? NAME_PLATES[0];
}

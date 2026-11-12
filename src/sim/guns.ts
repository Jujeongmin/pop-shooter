import { BALANCE } from './balance.ts';

export type GunModel = 'pistol' | 'rifle' | 'shotgun' | 'sniper';

export interface GunDef {
  index: number;
  /** 이 총의 월드 (1~8) */
  world: number;
  model: GunModel;
  /** 총 재질 색에 곱하는 색 (월드별) */
  tint: string;
  name: string;
}

const MODELS: readonly GunModel[] = ['pistol', 'rifle', 'shotgun', 'sniper'];
const MODEL_NAME: Record<GunModel, string> = { pistol: '권총', rifle: '라이플', shotgun: '샷건', sniper: '스나이퍼' };
const WORLD_STYLE = [
  { prefix: '장난감', tint: '#ffffff' },
  { prefix: '공사장', tint: '#ffbf5e' },
  { prefix: '사탕', tint: '#ff9ccf' },
  { prefix: '우주', tint: '#a9b8ff' },
  { prefix: '바다', tint: '#7fe0ff' },
  { prefix: '눈꽃', tint: '#d9ecff' },
  { prefix: '기사', tint: '#ffd77a' },
  { prefix: '무지개', tint: '#e2c4ff' },
] as const;

export const GUNS: readonly GunDef[] = Array.from({ length: BALANCE.gun.count }, (_, index) => {
  const w = Math.floor(index / BALANCE.gun.perWorld);
  const model = MODELS[index % MODELS.length]!;
  const style = WORLD_STYLE[w]!;
  return { index, world: w + 1, model, tint: style.tint, name: `${style.prefix} ${MODEL_NAME[model]}` };
});

export function gunMult(i: number): number {
  return BALANCE.gun.dmgStep ** i;
}

/** 0번(시작 권총) 무료, i번 = priceBase × priceGrowth^(i−1) */
export function gunPrice(i: number): number {
  return i <= 0 ? 0 : BALANCE.gun.priceBase * BALANCE.gun.priceGrowth ** (i - 1);
}

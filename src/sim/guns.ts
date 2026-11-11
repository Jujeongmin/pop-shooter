import { BALANCE } from './balance.ts';
import { stageHp } from './stages.ts';

export type GunModel = 'pistol' | 'rifle' | 'shotgun' | 'sniper';

export interface GunDef {
  index: number;
  world: 1 | 2 | 3 | 4;
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
] as const;

export const GUNS: readonly GunDef[] = Array.from({ length: BALANCE.gun.count }, (_, index) => {
  const w = Math.floor(index / BALANCE.gun.perWorld);
  const model = MODELS[index % MODELS.length]!;
  const style = WORLD_STYLE[w]!;
  return { index, world: (w + 1) as GunDef['world'], model, tint: style.tint, name: `${style.prefix} ${MODEL_NAME[model]}` };
});

export function gunMult(i: number): number {
  return BALANCE.gun.dmgStep ** i;
}

/** 총 가격 기준 스테이지: 월드 1은 2·4·6번, 월드 2~4는 앞 월드 대장·2·4·6번 (그 무렵 살 만한 값) */
export function gunRefStage(i: number): number {
  const w = Math.floor(i / BALANCE.gun.perWorld);
  const j = i % BALANCE.gun.perWorld;
  return w * BALANCE.stage.perWorld + 2 * j;
}

/** 0번(시작 권총) 무료, 나머지 = 기준 스테이지 체력 × priceMult */
export function gunPrice(i: number): number {
  return i <= 0 ? 0 : stageHp(gunRefStage(i)) * BALANCE.gun.priceMult;
}

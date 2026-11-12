/**
 * 월드 8개 테마 (사용자 2026-11-12: 월드마다 광장 따로, 테마 = 기획서 1~4 + 해변·눈 마을·장난감 성·무지개 구름 왕국).
 * 광장 바닥·하늘·바깥 꾸미기(HubDecor)와 전투 무대 색이 이 값을 씀. 시설 배치는 모든 월드가 같음 (facilities.ts).
 */
export type DecorKind = 'town' | 'construction' | 'candy' | 'space' | 'beach' | 'snow' | 'castle' | 'cloud';

export interface WorldTheme {
  world: number;
  decor: DecorKind;
  /** 하늘·안개 */
  sky: string;
  /** 바깥 땅 · 울타리 안 광장 · 길 · 울타리 · 먼 언덕 */
  ground: string;
  plaza: string;
  path: string;
  fence: string;
  hill: string;
  /** 전투 무대: 바깥 바닥 · 가운데 원 · 테두리 · 둘레 블록 색들 */
  arena: { floor: string; center: string; ring: string; blocks: readonly string[] };
  /** 보스 색 (스테이지마다 차례로) */
  bossTints: readonly string[];
}

export const WORLD_THEMES: readonly WorldTheme[] = [
  {
    world: 1, decor: 'town', sky: '#bfe3ff', ground: '#8fcf84', plaza: '#a8de98', path: '#ffe2b0', fence: '#ffffff', hill: '#7cc47a',
    arena: { floor: '#ffd9ec', center: '#fff3c4', ring: '#ff9ec4', blocks: ['#ff9ec4', '#7cc4ff', '#ffd34d', '#7fd78a', '#b9a6ff', '#ff8a5b'] },
    bossTints: ['#ff6b6b', '#ffb347', '#5aa9ff', '#9b87ff', '#4cc56a', '#ff7fbf', '#ffc93c', '#36c2c2', '#ff8a5b'],
  },
  {
    world: 2, decor: 'construction', sky: '#ffe9c2', ground: '#e8c27a', plaza: '#f3d79c', path: '#bfb3a3', fence: '#ffb347', hill: '#d9a95e',
    arena: { floor: '#f0cf8e', center: '#fff0c9', ring: '#ff9f2e', blocks: ['#ffb347', '#ffd34d', '#8d9db6', '#ff7a45', '#f4f4f4', '#5aa9ff'] },
    bossTints: ['#ffb347', '#ffd34d', '#ff7a45', '#8d9db6', '#5aa9ff', '#e06666', '#f4c430', '#7b8fa6', '#ff8f3d'],
  },
  {
    world: 3, decor: 'candy', sky: '#ffe3f1', ground: '#ffc6de', plaza: '#ffdcea', path: '#ffffff', fence: '#ff8fbf', hill: '#ff9fc8',
    arena: { floor: '#ffd1e6', center: '#e9fff5', ring: '#7fe3c6', blocks: ['#ff8fbf', '#7fe3c6', '#fff08a', '#c9a6ff', '#ffffff', '#ffb38a'] },
    bossTints: ['#ff6fae', '#62d9b5', '#ffd34d', '#b48cff', '#ff8a5b', '#5ec8ff', '#ff9ec4', '#7fd78a', '#ffb347'],
  },
  {
    world: 4, decor: 'space', sky: '#2e3470', ground: '#9ea6d6', plaza: '#c3c9ec', path: '#e8ebff', fence: '#7f8bd6', hill: '#6f78b8',
    arena: { floor: '#7c84c4', center: '#dfe3ff', ring: '#ffd34d', blocks: ['#a9b8ff', '#ffd34d', '#7cf0ff', '#ff9ec4', '#e8ebff', '#9b87ff'] },
    bossTints: ['#7cf0ff', '#ffd34d', '#a9b8ff', '#ff9ec4', '#9b87ff', '#7fd78a', '#ffffff', '#5aa9ff', '#ff8a5b'],
  },
  {
    world: 5, decor: 'beach', sky: '#aee9ff', ground: '#5fc9ef', plaza: '#ffe7b0', path: '#fff6dc', fence: '#ffffff', hill: '#f2d394',
    arena: { floor: '#7fd8f5', center: '#fff1c9', ring: '#ff8a5b', blocks: ['#5fc9ef', '#ffe7b0', '#ff8a5b', '#ffffff', '#7fd78a', '#ffd34d'] },
    bossTints: ['#36c2c2', '#ff8a5b', '#5aa9ff', '#ffd34d', '#ff6b6b', '#7fd78a', '#4ba3ff', '#ffb347', '#ff7fbf'],
  },
  {
    world: 6, decor: 'snow', sky: '#dcecff', ground: '#eef5ff', plaza: '#ffffff', path: '#d2e4fb', fence: '#9fc4f2', hill: '#dce9fb',
    arena: { floor: '#e2eeff', center: '#ffffff', ring: '#7cc4ff', blocks: ['#ffffff', '#bcd9ff', '#7cc4ff', '#ff9ec4', '#d4c4ff', '#9fe0e8'] },
    bossTints: ['#5aa9ff', '#ff6b6b', '#7fd0ff', '#9b87ff', '#36c2c2', '#ff9ec4', '#4f7bd9', '#ffffff', '#ffb347'],
  },
  {
    world: 7, decor: 'castle', sky: '#cfe0ff', ground: '#86c98a', plaza: '#cfd3dc', path: '#b5bac6', fence: '#8a92a6', hill: '#78b07c',
    arena: { floor: '#b9bfcc', center: '#efe6cf', ring: '#c0392b', blocks: ['#d9dde6', '#c0392b', '#3867d6', '#f6c344', '#8a92a6', '#ffffff'] },
    bossTints: ['#c0392b', '#3867d6', '#f6c344', '#8a92a6', '#27ae60', '#8e44ad', '#e67e22', '#2c3e50', '#d35400'],
  },
  {
    world: 8, decor: 'cloud', sky: '#ffe9fb', ground: '#f6eaff', plaza: '#ffffff', path: '#ffe3f4', fence: '#c9b3ff', hill: '#f1e3ff',
    arena: { floor: '#f6e6ff', center: '#ffffff', ring: '#ffb3e6', blocks: ['#ff9ec4', '#ffd34d', '#7fd78a', '#7cc4ff', '#b9a6ff', '#ffb38a'] },
    bossTints: ['#ff6b6b', '#ffb347', '#ffd34d', '#7fd78a', '#5aa9ff', '#9b87ff', '#ff7fbf', '#36c2c2', '#ff8a5b'],
  },
];

export function themeOf(world: number): WorldTheme {
  return WORLD_THEMES[Math.max(0, Math.min(WORLD_THEMES.length - 1, world - 1))]!;
}

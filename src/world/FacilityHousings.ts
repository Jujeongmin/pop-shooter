import type { HubDecor } from './HubDecor';
import { FOUNTAIN, RANGE_SPOT, RANGE_TARGET, TREADMILL, TREADMILL_LANES, WORLD1_FACILITIES } from './facilities';
import type { DecorKind } from './worldThemes';

/**
 * 월드 2~8 나머지 시설 겉모양 (사용자 2026-11-12: 나머지 시설 본체도 월드마다).
 * 사격장 아치 · 러닝머신 틀 · 동전 분수 몸통 · 환생 제단 받침 · 월드 이동 발판 · 탈의실을 월드 모양으로 그림.
 * 기능 부품(과녁·벨트·떨어지는 동전·꼭대기 동전·환생 고리·지구본·캐릭터 받침대)은 원래 것 그대로 (World1Hub가 원래 겉모양만 숨김).
 * 크기·높이는 원래와 같게 (벨트 높이 0.32, 동전 나오는 곳 = 분수 앞 위 y 2.2·z +1.45). 움직이지 않는 도형이라 HubDecor 묶음으로 그림.
 */

type Kind = Exclude<DecorKind, 'town'>;

/** 월드별 색 (본체 · 포인트 · 테두리) */
const COL: Record<Kind, { main: string; accent: string; trim: string }> = {
  construction: { main: '#ffc23d', accent: '#2b2f3a', trim: '#ff8a2e' },
  candy: { main: '#ff9ec4', accent: '#ffffff', trim: '#7fe3c6' },
  space: { main: '#c3c9ec', accent: '#7cf0ff', trim: '#6f78b8' },
  beach: { main: '#c98a5a', accent: '#e8c27a', trim: '#5aa9ff' },
  snow: { main: '#ffffff', accent: '#cfe8ff', trim: '#9fd0ff' },
  castle: { main: '#cfd3dc', accent: '#c0392b', trim: '#8a92a6' },
  cloud: { main: '#ffffff', accent: '#ffb3e6', trim: '#c9b3ff' },
};

/** 기둥 하나 (x, z, 높이 h): 월드 모양 */
function column(d: HubDecor, k: Kind, x: number, z: number, h: number): void {
  const c = COL[k];
  switch (k) {
    case 'construction': {
      const n = Math.max(2, Math.round(h / 0.5));
      for (let i = 0; i < n; i++) d.p('box', i % 2 ? c.accent : c.main, x, (i + 0.5) * (h / n), z, 0.3, h / n, 0.3);
      break;
    }
    case 'candy': {
      const n = Math.max(3, Math.round(h / 0.4));
      for (let i = 0; i < n; i++) d.p('cyl', i % 2 ? c.accent : '#ff4f6d', x, (i + 0.5) * (h / n), z, 0.26, h / n, 0.26);
      d.p('sph', c.trim, x, h + 0.1, z, 0.36);
      break;
    }
    case 'space':
      d.p('cyl', c.main, x, h / 2, z, 0.26, h, 0.26);
      for (let i = 1; i < 4; i++) d.p('ring', c.accent, x, (i / 4) * h, z, 0.32, 0.32, 0.32, Math.PI / 2);
      d.p('sph', c.accent, x, h + 0.08, z, 0.22);
      break;
    case 'beach':
      for (let i = 0; i < 3; i++) d.p('cyl', '#d9c27a', x, (i + 0.5) * (h / 3), z, 0.22, h / 3 - 0.04, 0.22);
      break;
    case 'snow':
      d.p('oct', c.accent, x, h / 2, z, 0.4, h, 0.4);
      d.p('hemi', c.main, x, 0, z, 0.6, 0.35, 0.6);
      break;
    case 'castle':
      d.p('cyl', c.main, x, h / 2, z, 0.42, h, 0.42);
      d.p('box', c.main, x, h + 0.1, z, 0.5, 0.2, 0.5);
      break;
    case 'cloud':
      for (let i = 0; i < 3; i++) d.p('sph', i % 2 ? c.accent : c.main, x, 0.35 + (i * h) / 3, z, 0.5 - i * 0.05);
      break;
  }
}

/** 가로 들보 (가운데 x, z, 높이 y, 길이 w) */
function beam(d: HubDecor, k: Kind, x: number, y: number, z: number, w: number): void {
  const c = COL[k];
  switch (k) {
    case 'candy':
      d.p('box', c.main, x, y, z, w, 0.26, 0.36);
      for (let i = 0; i < 8; i++) d.p('sph', c.main, x - w / 2 + (i + 0.5) * (w / 8), y - 0.16, z + 0.12, 0.18, 0.28, 0.18);
      break;
    case 'beach':
      d.p('box', c.main, x, y, z, w, 0.18, 0.3);
      d.p('pyr', c.accent, x, y + 0.3, z, w * 0.75, 0.45, 0.9, 0, Math.PI / 4);
      break;
    case 'castle':
      d.p('box', c.main, x, y, z, w, 0.3, 0.4);
      for (let i = 0; i < 7; i += 2) d.p('box', c.main, x - w / 2 + (i + 0.5) * (w / 7), y + 0.28, z, w / 7, 0.26, 0.4);
      break;
    case 'cloud': {
      const cs = ['#ff6b6b', '#ffd34d', '#7fd78a', '#5aa9ff'];
      cs.forEach((col, i) => d.p('arch', col, x, y - 0.6, z, w / 2 - i * 0.12, 0.8 - i * 0.05, 0.6));
      break;
    }
    case 'snow':
      d.p('box', c.accent, x, y, z, w, 0.2, 0.32);
      d.p('hemi', c.main, x, y + 0.08, z, w + 0.2, 0.35, 0.5);
      for (let i = 0; i < 8; i++) d.p('cone', c.trim, x - w / 2 + (i + 0.5) * (w / 8), y - 0.2, z + 0.12, 0.08, 0.28, 0.08, Math.PI);
      break;
    case 'space':
      d.p('box', c.trim, x, y, z, w, 0.22, 0.3);
      d.p('box', c.accent, x, y - 0.14, z + 0.16, w - 0.2, 0.06, 0.04);
      break;
    case 'construction':
      d.p('box', c.trim, x, y, z, w, 0.26, 0.26);
      for (let i = 0; i < 6; i++) d.p('box', c.accent, x - w / 2 + (i + 0.5) * (w / 6), y, z + 0.14, 0.12, 0.2, 0.02, 0, 0, 0.6);
      break;
  }
}

/** 둥근 발판 (x, z, 반지름 r, 높이 h): 제단·월드 이동 받침 */
function platform(d: HubDecor, k: Kind, x: number, z: number, r: number, h: number): void {
  const c = COL[k];
  switch (k) {
    case 'construction':
      d.p('box', '#c98a5a', x, h * 0.5, z, r * 1.8, h, r * 1.8);
      for (let i = 0; i < 4; i++) d.p('box', c.accent, x - r * 0.9 + i * (r * 0.6), h + 0.02, z, 0.12, 0.04, r * 1.8);
      break;
    case 'candy':
      d.p('cyl', c.main, x, h * 0.5, z, r * 2, h, r * 2);
      d.p('ring', c.accent, x, h, z, r * 2, r * 2, r * 2, Math.PI / 2);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        d.p('sph', ['#ff5e6a', '#5aa9ff', '#7fd78a', '#ffd34d'][i % 4]!, x + Math.cos(a) * r * 0.8, h + 0.04, z + Math.sin(a) * r * 0.8, 0.12);
      }
      break;
    case 'space':
      d.p('cyl', c.trim, x, h * 0.5, z, r * 2.1, h, r * 2.1);
      d.p('ring', c.accent, x, h + 0.02, z, r * 1.6, r * 1.6, r * 1.6, Math.PI / 2);
      d.p('ring', c.accent, x, h + 0.02, z, r * 1.0, r * 1.0, r * 1.0, Math.PI / 2);
      break;
    case 'beach':
      d.p('hemi', '#f2d394', x, 0, z, r * 2.2, h * 1.6, r * 2.2);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        d.p('oct', i % 2 ? '#ff8a5b' : '#ffe7b0', x + Math.cos(a) * r * 0.95, h * 0.6, z + Math.sin(a) * r * 0.95, 0.3, 0.12, 0.3, 0, a);
      }
      break;
    case 'snow':
      d.p('cyl', c.accent, x, h * 0.5, z, r * 2, h, r * 2);
      d.p('hemi', c.main, x, h, z, r * 2, 0.25, r * 2);
      break;
    case 'castle':
      d.p('cyl', c.trim, x, h * 0.3, z, r * 2.2, h * 0.6, r * 2.2);
      d.p('cyl', c.main, x, h * 0.8, z, r * 1.8, h * 0.4, r * 1.8);
      d.p('ring', c.accent, x, h + 0.02, z, r * 1.7, r * 1.7, r * 1.7, Math.PI / 2);
      break;
    case 'cloud':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        d.p('sph', i % 3 ? c.main : c.accent, x + Math.cos(a) * r * 0.75, h * 0.5, z + Math.sin(a) * r * 0.75, r * 0.8, h * 1.4, r * 0.8);
      }
      d.p('cyl', c.main, x, h * 0.6, z, r * 1.6, h * 0.5, r * 1.6);
      break;
  }
}

/** 동전 분수 몸통 (x, z = 기계 자리, 동전 나오는 곳 = z + 1.45, y 2.2) */
function fountainBody(d: HubDecor, k: Kind, x: number, z: number): void {
  const c = COL[k];
  switch (k) {
    case 'construction':
      // 물탱크 탑: 다리 넷 + 둥근 통
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) d.p('cyl', c.accent, x + sx * 0.5, 0.9, z + sz * 0.5, 0.1, 1.8, 0.1);
      d.p('cyl', c.main, x, 2.3, z, 1.2, 1.0, 1.2);
      d.p('cone', c.trim, x, 3.0, z, 1.3, 0.4, 1.3);
      break;
    case 'candy':
      // 사탕 병: 유리 대신 분홍 병 + 뚜껑 + 사탕 무늬
      d.p('cyl', c.main, x, 1.25, z, 1.2, 2.1, 1.2);
      d.p('cyl', c.trim, x, 2.4, z, 1.0, 0.25, 1.0);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        d.p('sph', ['#ff5e6a', '#ffd34d', '#5aa9ff', '#7fd78a'][i % 4]!, x + Math.cos(a) * 0.6, 0.6 + (i % 3) * 0.5, z + Math.sin(a) * 0.6, 0.18);
      }
      break;
    case 'space':
      // 캡슐 탱크 + 빛 고리
      d.p('cyl', c.main, x, 1.3, z, 1.1, 2.2, 1.1);
      d.p('sph', c.main, x, 2.4, z, 1.1, 0.8, 1.1);
      for (const y of [0.7, 1.4]) d.p('ring', c.accent, x, y, z, 1.2, 1.2, 1.2, Math.PI / 2);
      break;
    case 'beach':
      // 보물 상자 탑: 나무 상자 + 금 테두리
      d.p('box', c.main, x, 0.6, z, 1.3, 1.2, 1.1);
      d.p('box', '#ffd34d', x, 0.6, z + 0.56, 1.32, 0.14, 0.04);
      d.p('cyl', c.main, x, 1.65, z, 0.5, 1.0, 0.5);
      d.p('pyr', c.accent, x, 2.45, z, 1.1, 0.5, 1.1, 0, Math.PI / 4);
      break;
    case 'snow':
      // 눈사람 모양 통
      d.p('sph', c.main, x, 0.6, z, 1.3);
      d.p('sph', c.main, x, 1.55, z, 1.0);
      d.p('cyl', c.trim, x, 2.15, z, 0.6, 0.35, 0.6);
      break;
    case 'castle':
      // 돌 우물 + 지붕
      d.p('cyl', c.main, x, 0.45, z, 1.6, 0.9, 1.6);
      for (const sx of [-1, 1]) d.p('cyl', '#8a5a3a', x + sx * 0.7, 1.5, z, 0.1, 1.5, 0.1);
      d.p('pyr', c.accent, x, 2.5, z, 2.0, 0.7, 1.4, 0, Math.PI / 4);
      break;
    case 'cloud':
      for (const [dx, dy, r] of [[0, 0.7, 1.1], [-0.4, 1.4, 0.8], [0.4, 1.5, 0.75], [0, 2.0, 0.7]] as const) d.p('sph', c.main, x + dx, dy, z, r);
      d.p('sph', c.accent, x, 2.2, z + 0.2, 0.4);
      break;
  }
  // 관: 몸통 위에서 앞(서는 자리)으로, 끝 주둥이는 동전 나오는 곳
  d.p('cyl', c.trim, x, 2.25, z + 0.75, 0.24, 1.5, 0.24, Math.PI / 2);
  d.p('cyl', '#ffffff', x, 2.22, z + 1.45, 0.34, 0.16, 0.34);
}

/** 러닝머신 한 대 틀 (x = 가운데, z = 러닝머신 z): 받침 높이 0.32 그대로, 손잡이·화면만 월드 모양 */
function treadmillFrame(d: HubDecor, k: Kind, x: number, z: number): void {
  const c = COL[k];
  d.p('box', k === 'snow' || k === 'cloud' ? c.accent : k === 'construction' ? c.accent : c.trim, x, 0.16, z, 1.45, 0.32, 2.8);
  for (const sx of [-1, 1]) column(d, k, x + sx * 0.62, z - 1.15, 1.6);
  d.p('box', c.main, x, 1.65, z - 1.15, 1.4, 0.14, 0.16);
  d.p('box', k === 'space' ? c.accent : '#bfeaff', x, 1.88, z - 1.2, 0.85, 0.42, 0.1);
}

/** 탈의실 (g = 탈의실 묶음 자리): 칸막이 방 + 문, 받침대 자리(+1.6, +0.4)는 비움 */
function booth(d: HubDecor, k: Kind, gx: number, gz: number): void {
  const c = COL[k];
  const x = gx - 0.7;
  // 뒤·옆 벽
  d.p('box', c.main, x, 1.35, gz - 0.6, 1.8, 2.7, 0.12);
  for (const sx of [-1, 1]) d.p('box', c.main, x + sx * 0.9, 1.35, gz - 0.02, 0.12, 2.7, 1.15);
  // 지붕
  switch (k) {
    case 'construction': d.p('box', c.trim, x, 2.8, gz, 2.0, 0.2, 1.5); break;
    case 'candy': d.p('hemi', c.accent, x, 2.7, gz, 2.0, 0.6, 1.5); d.p('sph', '#ff3b4f', x, 3.05, gz, 0.25); break;
    case 'space': d.p('sph', c.main, x, 2.7, gz, 1.9, 0.6, 1.4); d.p('cyl', c.accent, x, 3.05, gz, 0.06, 0.4, 0.06); break;
    case 'beach': d.p('pyr', c.accent, x, 3.0, gz, 2.4, 0.8, 1.9, 0, Math.PI / 4); break;
    case 'snow': d.p('hemi', c.main, x, 2.7, gz, 2.1, 0.5, 1.6); break;
    case 'castle': d.p('cone', c.accent, x, 3.2, gz, 1.8, 1.0, 1.4); break;
    case 'cloud': for (const dx of [-0.6, 0, 0.6]) d.p('sph', c.main, x + dx, 2.8, gz, 0.8, 0.55, 0.8); break;
  }
  // 앞 커튼 (반쯤) + 포인트
  for (let i = 0; i < 4; i++) d.p('cyl', i % 2 ? c.accent : c.trim, x - 0.75 + i * 0.22, 1.4, gz + 0.55, 0.26, 2.3, 0.26);
  d.p('box', c.trim, x, 2.55, gz + 0.62, 1.9, 0.18, 0.08);
}

/** 월드 2~8 나머지 시설 겉모양 */
export function buildHousings(d: HubDecor, kind: DecorKind): void {
  if (kind === 'town') return;
  const k = kind;
  // 사격장 아치
  const rz = RANGE_TARGET.z - 0.45;
  for (const dx of [-3.25, 3.25]) column(d, k, RANGE_SPOT.x + dx, rz, 3.0);
  beam(d, k, RANGE_SPOT.x, 3.05, rz, 6.8);
  // 러닝머신 세 대
  for (const dx of TREADMILL_LANES) treadmillFrame(d, k, TREADMILL.x + dx, TREADMILL.z);
  // 동전 분수 몸통
  fountainBody(d, k, FOUNTAIN.x, FOUNTAIN.z - 1.5);
  // 환생 제단·월드 이동 받침
  const altar = WORLD1_FACILITIES.find((f) => f.id === 'altar')!;
  platform(d, k, altar.x, altar.z - 1.6, 1.8, 0.42);
  const travel = WORLD1_FACILITIES.find((f) => f.id === 'travel')!;
  platform(d, k, travel.x, travel.z - 1.6, 1.65, 0.38);
  // 탈의실
  const chars = WORLD1_FACILITIES.find((f) => f.id === 'chars')!;
  booth(d, k, chars.x, chars.z - 2.2);
}

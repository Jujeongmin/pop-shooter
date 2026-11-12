import type { HubDecor } from './HubDecor';
import { FOOTPRINTS, PORTAL_GATE, RANGE_SPOT, RANGE_TARGET, type Footprint } from './facilities';
import type { DecorKind } from './worldThemes';

/**
 * 월드별 광장 시설 모양 (사용자 2026-11-12: 색만 바꾸면 짜침 → 월드마다 시설 모양이 달라 보이게).
 * 시설 자리·동작·충돌은 그대로, 시설마다 테마 부품을 씌움: 받침(바닥 둘레) + 지붕류(cap 가능한 시설만) + 뒤쪽 모서리 소품,
 * 포털 양옆 기둥, 사격장 아치 위 장식. 그리기는 HubDecor 묶음(InstancedMesh)으로 → 월드 바꿀 때 같이 해제.
 * 월드 1(장난감 마을)은 원래 모양 그대로.
 */

type Dress = {
  base(d: HubDecor, f: Footprint): void;
  cap(d: HubDecor, f: Footprint): void;
  prop(d: HubDecor, x: number, z: number, i: number): void;
  pillar(d: HubDecor, x: number, z: number): void;
};

/** 바닥 둘레를 따라 일정 간격 자리 (모서리 포함) */
function around(f: Footprint, pad: number, step: number, fn: (x: number, z: number, i: number) => void): void {
  const hw = f.w / 2 + pad;
  const hd = f.d / 2 + pad;
  let i = 0;
  const nx = Math.max(1, Math.round((hw * 2) / step));
  const nz = Math.max(1, Math.round((hd * 2) / step));
  for (let k = 0; k <= nx; k++) {
    const x = f.x - hw + (k / nx) * hw * 2;
    fn(x, f.z - hd, i++);
    fn(x, f.z + hd, i++);
  }
  for (let k = 1; k < nz; k++) {
    const z = f.z - hd + (k / nz) * hd * 2;
    fn(f.x - hw, z, i++);
    fn(f.x + hw, z, i++);
  }
}

const DRESS: Record<Exclude<DecorKind, 'town'>, Dress> = {
  construction: {
    // 노랑·검정 경고 띠 받침 + 비계(모서리 기둥·가로대) + 고깔·드럼통
    base: (d, f) => around(f, 0.35, 0.6, (x, z, i) => d.p('box', i % 2 ? '#2b2f3a' : '#ffc23d', x, 0.06, z, 0.55, 0.12, 0.55)),
    cap: (d, f) => {
      const hw = f.w / 2 + 0.25;
      const hd = f.d / 2 + 0.25;
      const top = f.h + 0.55;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) d.p('cyl', '#ff8a2e', f.x + sx * hw, top / 2, f.z + sz * hd, 0.12, top, 0.12);
      for (const sz of [-1, 1]) d.p('box', '#ff8a2e', f.x, top, f.z + sz * hd, hw * 2 + 0.12, 0.12, 0.12);
      for (const sx of [-1, 1]) d.p('box', '#ff8a2e', f.x + sx * hw, top, f.z, 0.12, 0.12, hd * 2 + 0.12);
      d.p('box', '#ffc23d', f.x, top + 0.12, f.z - hd, hw * 2, 0.14, 0.3);
    },
    prop: (d, x, z, i) => {
      if (i % 2) { d.p('cyl', '#5aa9ff', x, 0.45, z, 0.6, 0.9, 0.6); d.p('ring', '#ffffff', x, 0.45, z, 1.25, 1.25, 1.25, Math.PI / 2); }
      else { d.p('cone', '#ff7a2e', x, 0.45, z, 0.6, 0.9, 0.6); d.p('cyl', '#ffffff', x, 0.45, z, 0.4, 0.12, 0.4); }
    },
    pillar: (d, x, z) => {
      for (let k = 0; k < 6; k++) d.p('box', k % 2 ? '#2b2f3a' : '#ffc23d', x, 0.45 + k * 0.85, z, 0.8, 0.85, 0.8);
      d.p('cone', '#ff7a2e', x, 5.6, z, 0.9, 0.9, 0.9);
    },
  },
  candy: {
    // 크림 받침 + 녹아내리는 크림 지붕(체리) + 막대 사탕
    base: (d, f) => around(f, 0.3, 0.55, (x, z, i) => d.p('hemi', i % 3 === 0 ? '#ff8fbf' : '#ffffff', x, 0, z, 0.6, 0.5, 0.6)),
    cap: (d, f) => {
      const y = f.h + 0.12;
      d.p('box', '#ffb3d9', f.x, y, f.z, f.w + 0.5, 0.28, f.d + 0.5);
      for (let k = 0; k < 6; k++) d.p('sph', '#ffb3d9', f.x - f.w / 2 + (k + 0.5) * (f.w / 6), y - 0.22, f.z + f.d / 2 + 0.2, 0.32, 0.5, 0.32);
      for (let k = 0; k < 5; k++) d.p('sph', ['#ff5e6a', '#5aa9ff', '#7fd78a', '#ffd34d', '#c9a6ff'][k]!, f.x - f.w / 3 + k * (f.w / 6), y + 0.17, f.z + (k % 2 ? 0.2 : -0.2), 0.12);
      d.p('sph', '#ff3b4f', f.x, y + 0.42, f.z, 0.42);
      d.p('cyl', '#3f9e5a', f.x + 0.08, y + 0.75, f.z, 0.04, 0.4, 0.04, 0, 0, -0.4);
    },
    prop: (d, x, z, i) => {
      d.p('cyl', '#ffffff', x, 0.9, z, 0.1, 1.8, 0.1);
      d.p('disc', ['#ff8fbf', '#7fe3c6', '#fff08a', '#c9a6ff'][i % 4]!, x, 1.95, z, 0.9, 0.9, 0.9, Math.PI / 2);
    },
    pillar: (d, x, z) => {
      for (let k = 0; k < 9; k++) d.p('cyl', k % 2 ? '#ffffff' : '#ff4f6d', x, 0.3 + k * 0.6, z, 0.7, 0.6, 0.7);
      d.p('sph', '#ff4f6d', x, 5.7, z, 0.9);
    },
  },
  space: {
    // 금속 발판(파란 불빛) + 안테나 접시 + 크리스털·등
    base: (d, f) => {
      d.p('box', '#6f78b8', f.x, 0.06, f.z, f.w + 0.9, 0.12, f.d + 0.9);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) d.p('sph', '#7cf0ff', f.x + sx * (f.w / 2 + 0.35), 0.16, f.z + sz * (f.d / 2 + 0.35), 0.22);
    },
    cap: (d, f) => {
      const y = f.h + 0.05;
      d.p('box', '#c3c9ec', f.x, y, f.z, f.w + 0.3, 0.16, f.d + 0.3);
      d.p('cyl', '#9aa6c4', f.x + f.w / 3, y + 0.5, f.z - f.d / 4, 0.08, 1, 0.08);
      d.p('hemi', '#f4f6ff', f.x + f.w / 3, y + 1.05, f.z - f.d / 4, 1.1, 0.4, 1.1, Math.PI * 0.75);
      d.p('sph', '#ff5e6a', f.x - f.w / 3, y + 0.35, f.z, 0.22);
      d.p('cyl', '#9aa6c4', f.x - f.w / 3, y + 0.15, f.z, 0.05, 0.3, 0.05);
    },
    prop: (d, x, z, i) => {
      if (i % 2) d.p('oct', '#7cf0ff', x, 0.7, z, 0.6, 1.4, 0.6, 0, i);
      else { d.p('cyl', '#9aa6c4', x, 0.6, z, 0.1, 1.2, 0.1); d.p('sph', '#ffd34d', x, 1.3, z, 0.3); }
    },
    pillar: (d, x, z) => {
      d.p('cyl', '#c3c9ec', x, 2.6, z, 0.9, 5.2, 0.9);
      for (let k = 0; k < 4; k++) d.p('ring', '#7cf0ff', x, 1 + k * 1.2, z, 1.1, 1.1, 1.1, Math.PI / 2);
      d.p('cone', '#ff5e6a', x, 5.6, z, 1, 0.9, 1);
    },
  },
  beach: {
    // 모래 받침 + 초가 지붕(뒤 기둥 둘) + 서핑보드·불가사리
    base: (d, f) => d.p('cyl', '#f2d394', f.x, 0.04, f.z, f.w + 1.4, 0.08, f.d + 1.4),
    cap: (d, f) => {
      const y = f.h + 0.55;
      for (const sx of [-1, 1]) d.p('cyl', '#c98a5a', f.x + sx * (f.w / 2 + 0.1), y / 2, f.z - f.d / 2 - 0.1, 0.12, y, 0.12);
      d.p('pyr', '#e8c27a', f.x, y + 0.2, f.z, f.w + 1.0, 1.1, f.d + 1.0, 0, Math.PI / 4);
      d.p('pyr', '#d9a95e', f.x, y + 0.05, f.z, f.w + 1.1, 0.25, f.d + 1.1, 0, Math.PI / 4);
    },
    prop: (d, x, z, i) => {
      if (i % 2) d.p('box', ['#ff6b6b', '#5aa9ff', '#ffd34d'][i % 3]!, x, 0.9, z, 0.5, 1.8, 0.1, -0.25, 0, 0.12);
      else d.p('oct', '#ff8a5b', x, 0.1, z, 0.7, 0.18, 0.7, 0, i);
    },
    pillar: (d, x, z) => {
      d.p('taper', '#c98a5a', x, 2.5, z, 0.7, 5, 0.7);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        d.p('box', '#4cc56a', x + Math.cos(a) * 0.9, 5, z + Math.sin(a) * 0.9, 2, 0.1, 0.6, 0, -a, -0.35);
      }
    },
  },
  snow: {
    // 눈 더미 받침 + 눈 지붕(고드름) + 작은 전나무·눈덩이
    base: (d, f) => around(f, 0.3, 0.7, (x, z) => d.p('hemi', '#ffffff', x, 0, z, 0.9, 0.5, 0.9)),
    cap: (d, f) => {
      const y = f.h + 0.02;
      d.p('hemi', '#ffffff', f.x, y, f.z, f.w + 0.4, 0.7, f.d + 0.4);
      for (let k = 0; k < 6; k++) d.p('cone', '#cfe8ff', f.x - f.w / 2 + (k + 0.5) * (f.w / 6), y - 0.15, f.z + f.d / 2 + 0.1, 0.14, 0.35, 0.14, Math.PI);
    },
    prop: (d, x, z, i) => {
      if (i % 2) d.p('sph', '#ffffff', x, 0.35, z, 0.7);
      else { d.p('cone', '#3f9e6b', x, 0.8, z, 1, 1.6, 1); d.p('cone', '#ffffff', x, 1.4, z, 0.5, 0.5, 0.5); }
    },
    pillar: (d, x, z) => {
      d.p('oct', '#cfe8ff', x, 2.8, z, 1.2, 5.6, 1.2);
      d.p('hemi', '#ffffff', x, 0, z, 1.6, 0.8, 1.6);
    },
  },
  castle: {
    // 돌 받침 + 성벽 톱니 지붕(깃발) + 깃발 기둥·횃불
    base: (d, f) => around(f, 0.3, 0.6, (x, z, i) => d.p('box', i % 2 ? '#b5bac6' : '#cfd3dc', x, 0.15, z, 0.55, 0.3, 0.55)),
    cap: (d, f) => {
      const y = f.h + 0.1;
      d.p('box', '#cfd3dc', f.x, y, f.z, f.w + 0.4, 0.2, f.d + 0.4);
      const n = Math.max(3, Math.round(f.w / 0.6));
      for (let k = 0; k < n; k += 2) d.p('box', '#cfd3dc', f.x - f.w / 2 + (k + 0.5) * (f.w / n), y + 0.3, f.z + f.d / 2 + 0.1, f.w / n, 0.4, 0.3);
      d.p('cyl', '#5b6577', f.x, y + 0.8, f.z, 0.05, 1.4, 0.05);
      d.p('box', '#c0392b', f.x + 0.35, y + 1.25, f.z, 0.7, 0.45, 0.04);
    },
    prop: (d, x, z, i) => {
      d.p('cyl', '#5b6577', x, 0.9, z, 0.1, 1.8, 0.1);
      if (i % 2) d.p('box', ['#3867d6', '#c0392b'][i % 2]!, x + 0.3, 1.5, z, 0.6, 0.8, 0.04);
      else d.p('cone', '#ff9a2e', x, 1.95, z, 0.3, 0.4, 0.3);
    },
    pillar: (d, x, z) => {
      d.p('cyl', '#cfd3dc', x, 2.4, z, 1.4, 4.8, 1.4);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        d.p('box', '#cfd3dc', x + Math.cos(a) * 0.65, 5, z + Math.sin(a) * 0.65, 0.35, 0.4, 0.35);
      }
      d.p('cone', '#3867d6', x, 5.9, z, 1.6, 1.4, 1.6);
    },
  },
  cloud: {
    // 구름 받침 + 작은 무지개 지붕 + 별 막대·구름
    base: (d, f) => around(f, 0.3, 0.6, (x, z, i) => d.p('sph', i % 4 === 0 ? '#ffe3f4' : '#ffffff', x, 0.15, z, 0.8, 0.5, 0.8)),
    cap: (d, f) => {
      const y = f.h + 0.05;
      const cs = ['#ff6b6b', '#ffb347', '#ffd34d', '#7fd78a', '#5aa9ff', '#9b87ff'];
      cs.forEach((c, k) => d.p('arch', c, f.x, y, f.z, f.w / 2 + 0.3 - k * 0.12, f.w / 2 + 0.3 - k * 0.12, 0.8));
      for (const sx of [-1, 1]) d.p('sph', '#ffffff', f.x + sx * (f.w / 2 + 0.2), y + 0.1, f.z, 0.7, 0.5, 0.7);
    },
    prop: (d, x, z, i) => {
      if (i % 2) { d.p('cyl', '#ffffff', x, 0.8, z, 0.08, 1.6, 0.08); d.p('oct', '#ffd34d', x, 1.7, z, 0.6, 0.6, 0.25, 0, 0, Math.PI / 4); }
      else d.p('sph', '#ffffff', x, 0.4, z, 1, 0.7, 0.8);
    },
    pillar: (d, x, z) => {
      for (let k = 0; k < 4; k++) d.p('sph', k % 2 ? '#ffe3f4' : '#ffffff', x + (k % 2 ? 0.2 : -0.2), 0.8 + k * 1.25, z, 1.5 - k * 0.15);
      d.p('oct', '#ffd34d', x, 5.8, z, 0.9, 0.9, 0.35, 0, 0, Math.PI / 4);
    },
  },
};

/** 월드 꾸미기에 시설 부품을 더함 (월드 1이면 아무것도 안 함) */
export function dressFacilities(d: HubDecor, kind: DecorKind): void {
  if (kind === 'town') return;
  const dr = DRESS[kind];
  for (const f of FOOTPRINTS) {
    dr.base(d, f);
    if (f.cap) dr.cap(d, f);
    // 뒤쪽 두 모서리 소품 (앞은 드나드는 쪽이라 비움)
    dr.prop(d, f.x - f.w / 2 - 0.7, f.z - f.d / 2 - 0.3, 0);
    dr.prop(d, f.x + f.w / 2 + 0.7, f.z - f.d / 2 - 0.3, 1);
  }
  // 포털 양옆 기둥 (고리 반지름 2.2 + 받침 3.5 바깥)
  for (const sx of [-1, 1]) dr.pillar(d, PORTAL_GATE.x + sx * 3.9, PORTAL_GATE.z);
  // 사격장 아치 양 끝 소품 + 아치 위 장식은 받침 모양으로 한 줄
  const arch: Footprint = { id: 'range', x: RANGE_SPOT.x, z: RANGE_TARGET.z - 0.45, w: 6.8, d: 0.4, h: 3.1, cap: false };
  dr.prop(d, arch.x - 4, arch.z - 0.5, 0);
  dr.prop(d, arch.x + 4, arch.z - 0.5, 1);
}

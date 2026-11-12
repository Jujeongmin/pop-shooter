import * as THREE from 'three';
import { BrickBatch, BRICK_SCALE, type BrickName, type KitModel } from './kit';
import { HUB_BOUNDS, HUB_SPAWN, PORTAL_SPOT } from './facilities';
import type { DecorKind, WorldTheme } from './worldThemes';
import { dressFacilities } from './FacilityDress';
import { buildHousings } from './FacilityHousings';

/**
 * 월드별 광장 바깥 꾸미기 (바닥·길·울타리·바깥 큰 소품·나무 자리 소품·먼 언덕). 시설(사격장·상점 등)은 World1Hub가 따로 가짐.
 * 월드 1 = 팝배틀 브릭 키트 집 + 둥근 나무, 2~8 = 코드 도형 소품 (사용자 2026-11-12, 테마는 worldThemes).
 * 같은 도형·색은 InstancedMesh 하나로 묶음 (월드 하나에 소품 수백 개 → 그리기 호출 수십 개).
 * 소유: 이 객체가 만든 geometry·material 전부 → dispose(). 키트 지오메트리·머티리얼은 공유라 해제 안 함.
 */

type GeoName = 'box' | 'cyl' | 'cone' | 'pyr' | 'sph' | 'hemi' | 'taper' | 'oct' | 'dode' | 'disc' | 'arch' | 'ring';

function makeGeo(n: GeoName): THREE.BufferGeometry {
  switch (n) {
    case 'box': return new THREE.BoxGeometry(1, 1, 1);
    case 'cyl': return new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
    case 'cone': return new THREE.ConeGeometry(0.5, 1, 16);
    case 'pyr': return new THREE.ConeGeometry(0.5, 1, 4);
    // 광장 장식 공 (나무·덤불, 100개 넘게 인스턴스): 16×12(352삼각형) → 14×9(224), 둥근 느낌 유지 (2026-11-12 삼각형 줄이기)
    case 'sph': return new THREE.SphereGeometry(0.5, 14, 9);
    case 'hemi': return new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    case 'taper': return new THREE.CylinderGeometry(0.35, 0.5, 1, 12);
    case 'oct': return new THREE.OctahedronGeometry(0.5);
    case 'dode': return new THREE.DodecahedronGeometry(0.5);
    case 'disc': return new THREE.CylinderGeometry(0.5, 0.5, 0.15, 24);
    case 'arch': return new THREE.TorusGeometry(1, 0.12, 10, 32, Math.PI);
    case 'ring': return new THREE.TorusGeometry(0.5, 0.08, 8, 24);
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** 소품 자리 하나: (x, z), 크기 s, 차례 i (모양 번갈아 고르기) */
interface Spot { x: number; z: number; s: number; i: number }

export class HubDecor {
  readonly root = new THREE.Group();
  private readonly owned: { dispose(): void }[] = [];
  private readonly mats = new Map<string, THREE.MeshStandardMaterial>();
  private readonly geos = new Map<GeoName, THREE.BufferGeometry>();
  /** 도형·색별 행렬 모음 → build에서 InstancedMesh */
  private readonly batches = new Map<string, { geo: GeoName; color: string; list: THREE.Matrix4[]; shadow: boolean }>();
  private seed = 7;

  constructor(theme: WorldTheme, kit: Record<BrickName, KitModel>) {
    this.ground(theme);
    this.fence(theme.fence);
    const big = this.bigSpots();
    const fill = this.fillSpots();
    const low = this.lowSpots();
    if (theme.decor === 'town') this.town(kit, big, fill, low);
    else {
      const d = DECOR[theme.decor];
      big.forEach((sp) => d.big(this, sp));
      fill.forEach((sp) => d.fill(this, sp));
      low.forEach((sp) => d.low(this, sp));
    }
    this.hills(theme.hill);
    // 월드별 시설 모양 (지붕·받침·소품·포털 기둥)
    dressFacilities(this, theme.decor);
    buildHousings(this, theme.decor);
    this.build();
  }

  rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  mat(color: string): THREE.MeshStandardMaterial {
    let m = this.mats.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
      this.mats.set(color, m);
      this.owned.push(m);
    }
    return m;
  }

  private geo(n: GeoName): THREE.BufferGeometry {
    let g = this.geos.get(n);
    if (!g) {
      g = makeGeo(n);
      this.geos.set(n, g);
      this.owned.push(g);
    }
    return g;
  }

  /** 도형 하나: 자리·크기·회전(라디안). shadow = 그림자 드리움 */
  p(geo: GeoName, color: string, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0, shadow = true): void {
    const key = `${geo}|${color}|${shadow ? 1 : 0}`;
    let b = this.batches.get(key);
    if (!b) {
      b = { geo, color, list: [], shadow };
      this.batches.set(key, b);
    }
    _q.setFromEuler(_e.set(rx, ry, rz));
    b.list.push(_m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)).clone());
  }

  private build(): void {
    for (const b of this.batches.values()) {
      const im = new THREE.InstancedMesh(this.geo(b.geo), this.mat(b.color), b.list.length);
      b.list.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.castShadow = b.shadow;
      im.receiveShadow = true;
      this.root.add(im);
    }
    this.batches.clear();
  }

  private ground(t: WorldTheme): void {
    const { hx, hz } = HUB_BOUNDS;
    const flat = (geo: THREE.BufferGeometry, color: string, y: number, x = 0, z = 0): void => {
      this.owned.push(geo);
      const m = new THREE.Mesh(geo, this.mat(color));
      m.position.set(x, y, z);
      m.receiveShadow = true;
      this.root.add(m);
    };
    flat(new THREE.BoxGeometry(220, 1, 220), t.ground, -0.5);
    // 울타리 안 광장 바닥 + 길 (스폰 → 포털, 가로 길)
    flat(new THREE.BoxGeometry(hx * 2 + 1, 0.04, hz * 2 + 1), t.plaza, 0.02);
    const len = HUB_SPAWN.z - PORTAL_SPOT.z + 4;
    flat(new THREE.BoxGeometry(4, 0.05, len), t.path, 0.03, 0, (HUB_SPAWN.z + PORTAL_SPOT.z) / 2);
    flat(new THREE.BoxGeometry(hx * 2 - 6, 0.05, 3.4), t.path, 0.031, 0, 1);
    flat(new THREE.CylinderGeometry(3.6, 3.6, 0.06, 40), t.path, 0.032, HUB_SPAWN.x, HUB_SPAWN.z);
  }

  /** 울타리: 말뚝 + 가로대 */
  private fence(color: string): void {
    const F = HUB_BOUNDS.hx + 0.8;
    const side = (x0: number, z0: number, x1: number, z1: number): void => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.round(len / 1.2);
      const ry = -Math.atan2(z1 - z0, x1 - x0);
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        this.p('box', color, x0 + (x1 - x0) * k, 0.6, z0 + (z1 - z0) * k, 0.22, 1.2, 0.22);
      }
      for (const y of [0.45, 0.9]) this.p('box', color, (x0 + x1) / 2, y, (z0 + z1) / 2, len, 0.16, 0.08, 0, ry);
    };
    side(-F, -F, F, -F);
    side(F, -F, F, F);
    side(F, F, -F, F);
    side(-F, F, -F, -F);
  }

  /** 바깥 큰 소품 자리: 북·동·서 (남쪽은 카메라 쪽이라 비움) */
  private bigSpots(): Spot[] {
    const { hx, hz } = HUB_BOUNDS;
    const X = hx + 7.5;
    const Z = hz + 6;
    const xs: [number, number][] = [
      [-hx * 0.9, -Z], [-hx * 0.3, -Z - 1], [hx * 0.3, -Z], [hx * 0.9, -Z - 1],
      [-X, -hz * 0.6], [-X, 0], [-X, hz * 0.6], [X, -hz * 0.6], [X, 0], [X, hz * 0.6],
    ];
    return xs.map(([x, z], i) => ({ x, z, s: 1, i }));
  }

  /** 나무 자리: 울타리 바깥을 빽빽하게 */
  private fillSpots(): Spot[] {
    const out: Spot[] = [];
    let i = 0;
    const { hx, hz } = HUB_BOUNDS;
    for (let x = -hx - 10; x <= hx + 10; x += 3.2) {
      out.push({ x: x + this.rnd() * 1.2, z: -hz - 2.5 - this.rnd() * 1.5, s: 0.9 + this.rnd() * 0.5, i: i++ });
      out.push({ x: x + this.rnd() * 1.2, z: -hz - 10.5 - this.rnd() * 3, s: 1.1 + this.rnd() * 0.5, i: i++ });
    }
    for (let z = -hz - 0.5; z <= hz + 2.5; z += 3.2) {
      for (const sx of [-1, 1]) {
        out.push({ x: sx * (hx + 3 + this.rnd() * 1.2), z: z + this.rnd(), s: 0.9 + this.rnd() * 0.5, i: i++ });
        out.push({ x: sx * (hx + 12.5 + this.rnd() * 3), z: z + this.rnd(), s: 1.1 + this.rnd() * 0.5, i: i++ });
      }
    }
    return out;
  }

  /** 남쪽 낮은 소품 자리 (카메라를 안 가리게 낮게) */
  private lowSpots(): Spot[] {
    const out: Spot[] = [];
    let i = 0;
    for (let x = -HUB_BOUNDS.hx - 0.5; x <= HUB_BOUNDS.hx + 0.5; x += 2.4) out.push({ x, z: HUB_BOUNDS.hz + 2.2, s: 1, i: i++ });
    return out;
  }

  /** 먼 언덕: 지평선을 가림 (안개와 섞임) */
  private hills(color: string): void {
    const hills: [number, number, number, number][] = [
      [-40, -45, 22, 9], [0, -52, 28, 12], [40, -45, 22, 10], [-60, -10, 20, 8], [60, -10, 20, 9], [-55, 25, 18, 7], [55, 25, 18, 7],
    ];
    const k = HUB_BOUNDS.hx / 15.5;
    for (const [x, z, r, h] of hills) this.p('hemi', color, x * k, -0.2, z * k, r * 2, h * 2, r * 2, 0, 0, 0, false);
  }

  /** 월드 1 장난감 마을: 팝배틀 브릭 집 + 둥근 나무 + 덤불 */
  private town(kit: Record<BrickName, KitModel>, big: Spot[], fill: Spot[], low: Spot[]): void {
    const cols: [string, string][] = [
      ['#ff9ec4', '#7cc4ff'], ['#ffd34d', '#ff8a5b'], ['#7cc4ff', '#ffd34d'], ['#b9a6ff', '#ff9ec4'], ['#7fd78a', '#ff8a5b'],
      ['#ff8a5b', '#7cc4ff'], ['#ffd34d', '#b9a6ff'], ['#ff9ec4', '#ffd34d'], ['#7cc4ff', '#ff8a5b'], ['#7fd78a', '#ff9ec4'],
    ];
    const b = new BrickBatch();
    const W = 0.318 * BRICK_SCALE;
    const D = 0.158 * BRICK_SCALE;
    const H = 0.114 * BRICK_SCALE;
    for (const sp of big) {
      const [wall, roof] = cols[sp.i % cols.length]!;
      for (let row = 0; row < 3; row++) {
        for (let cx = 0; cx < 2; cx++) {
          for (let cz = 0; cz < 2; cz++) b.add('brick-2x4', sp.x + (cx - 0.5) * W, row * H, sp.z + (cz - 0.5) * D, row === 1 ? '#ffffff' : wall);
        }
      }
      for (let cx = 0; cx < 4; cx++) {
        b.add('slope-2x4', sp.x + (cx - 1.5) * W * 0.5, 3 * H, sp.z - D * 0.5, roof, 0);
        b.add('slope-2x4', sp.x + (cx - 1.5) * W * 0.5, 3 * H, sp.z + D * 0.5, roof, Math.PI);
      }
    }
    this.root.add(b.build(kit));
    const leaf = ['#6fcf7a', '#5fc06c', '#82d98a'];
    for (const sp of fill) {
      this.p('taper', '#c98a5a', sp.x, sp.s, sp.z, 0.8 * sp.s, 2 * sp.s, 0.8 * sp.s);
      this.p('sph', leaf[sp.i % 3]!, sp.x, 3.2 * sp.s, sp.z, 3.6 * sp.s);
    }
    for (const sp of low) this.p('sph', '#6fcf7a', sp.x, 0.5, sp.z - 0.8, 2.2, 1.5, 2.2);
  }

  dispose(): void {
    for (const o of this.owned) o.dispose();
    this.root.removeFromParent();
  }
}

type Place = (d: HubDecor, sp: Spot) => void;

/** 월드 2~8 소품 (큰 소품 / 나무 자리 / 남쪽 낮은 소품) */
const DECOR: Record<Exclude<DecorKind, 'town'>, { big: Place; fill: Place; low: Place }> = {
  construction: {
    big: (d, { x, z, i }) => {
      if (i % 2 === 0) {
        // 크레인: 노란 탑 + 팔 + 추 + 갈고리
        d.p('box', '#ffc23d', x, 4, z, 0.9, 8, 0.9);
        d.p('box', '#ffc23d', x + 2.2, 8.2, z, 7, 0.5, 0.6);
        d.p('box', '#8d9db6', x - 1.4, 7.6, z, 1.2, 1, 1);
        d.p('cyl', '#5b6577', x + 4.8, 6.2, z, 0.08, 4, 0.08);
        d.p('box', '#ff7a45', x + 4.8, 4, z, 0.9, 0.7, 0.9);
        d.p('box', '#8d9db6', x, 0.25, z, 2.4, 0.5, 2.4);
      } else {
        // 블록 더미
        const cs = ['#ff7a45', '#5aa9ff', '#ffd34d'];
        for (let k = 0; k < 3; k++) d.p('box', cs[(i + k) % 3]!, x + (k - 1) * 0.3, 1.2 + k * 2.2, z, 3.6 - k * 0.6, 2.2, 3 - k * 0.5, 0, k * 0.4);
      }
    },
    fill: (d, { x, z, s, i }) => {
      if (i % 3 === 0) {
        // 드럼통
        d.p('cyl', '#5aa9ff', x, 0.9 * s, z, 1.2 * s, 1.8 * s, 1.2 * s);
        d.p('ring', '#ffffff', x, 0.9 * s, z, 2.5 * s, 2.5 * s, 2.5 * s, Math.PI / 2);
      } else {
        // 고깔
        d.p('cone', '#ff7a2e', x, 1 * s, z, 1.3 * s, 2 * s, 1.3 * s);
        d.p('cyl', '#ffffff', x, 1 * s, z, 0.85 * s, 0.25 * s, 0.85 * s);
        d.p('box', '#ff7a2e', x, 0.08, z, 1.6 * s, 0.16, 1.6 * s);
      }
    },
    low: (d, { x, z }) => d.p('cone', '#ff7a2e', x, 0.45, z - 0.8, 0.7, 0.9, 0.7),
  },
  candy: {
    big: (d, { x, z, i }) => {
      if (i % 2 === 0) {
        // 사탕 집: 분홍 벽 + 흰 크림 지붕 + 줄무늬 굴뚝
        d.p('box', i % 4 === 0 ? '#ff9ec4' : '#c9a6ff', x, 2, z, 5, 4, 4.4);
        d.p('pyr', '#ffffff', x, 5.3, z, 5.4, 2.6, 5.4, 0, Math.PI / 4);
        for (let k = 0; k < 4; k++) d.p('cyl', k % 2 ? '#ffffff' : '#ff5e8a', x + 1.6, 4.6 + k * 0.6, z, 0.9, 0.6, 0.9);
        d.p('box', '#7fe3c6', x, 1.2, z + 2.25, 1.2, 2.4, 0.1);
      } else {
        // 큰 컵케이크
        d.p('taper', '#c98a5a', x, 1.4, z, 3.6, 2.8, 3.6);
        d.p('hemi', '#ffb3d9', x, 2.7, z, 4.6, 3.2, 4.6);
        d.p('sph', '#ff4f6d', x, 4.4, z, 1);
      }
    },
    fill: (d, { x, z, s, i }) => {
      if (i % 3 === 2) {
        // 지팡이 사탕
        for (let k = 0; k < 5; k++) d.p('cyl', k % 2 ? '#ffffff' : '#ff4f6d', x, (0.4 + k * 0.7) * s, z, 0.4 * s, 0.7 * s, 0.4 * s);
        d.p('arch', '#ff4f6d', x + 0.6 * s, 3.5 * s, z, 0.6 * s, 0.6 * s, 0.6 * s * 2);
      } else {
        // 막대 사탕 나무
        const cs = ['#ff8fbf', '#7fe3c6', '#fff08a', '#c9a6ff', '#ffb38a'];
        d.p('cyl', '#ffffff', x, 1.6 * s, z, 0.25 * s, 3.2 * s, 0.25 * s);
        d.p('disc', cs[i % cs.length]!, x, 3.8 * s, z, 3 * s, 1.4 * s, 3 * s, Math.PI / 2);
        d.p('disc', '#ffffff', x, 3.8 * s, z + 0.02, 1.6 * s, 1.5 * s, 1.6 * s, Math.PI / 2);
      }
    },
    low: (d, { x, z, i }) => d.p('hemi', ['#ff8fbf', '#7fe3c6', '#fff08a', '#c9a6ff'][i % 4]!, x, 0, z - 0.8, 1.4, 1.8, 1.4),
  },
  space: {
    big: (d, { x, z, i }) => {
      if (i % 2 === 0) {
        // 로켓
        d.p('cyl', '#f4f6ff', x, 4, z, 2.2, 6, 2.2);
        d.p('cone', '#ff5e6a', x, 8, z, 2.2, 2, 2.2);
        d.p('disc', '#7cf0ff', x, 5.4, z + 1.05, 1, 0.8, 1, Math.PI / 2);
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2;
          d.p('box', '#ff5e6a', x + Math.cos(a) * 1.3, 1.4, z + Math.sin(a) * 1.3, 0.25, 2.4, 1.2, 0, -a);
        }
        d.p('cyl', '#8d9db6', x, 0.3, z, 3.4, 0.6, 3.4);
      } else {
        // 위성 접시
        d.p('cyl', '#c3c9ec', x, 1.6, z, 0.5, 3.2, 0.5);
        d.p('hemi', '#f4f6ff', x, 4.6, z, 4.4, 1.6, 4.4, Math.PI * 0.8);
        d.p('sph', '#ffd34d', x, 4.2, z + 0.9, 0.6);
      }
    },
    fill: (d, { x, z, s, i }) => {
      if (i % 3 === 0) d.p('oct', '#7cf0ff', x, 1.6 * s, z, 1.2 * s, 3.2 * s, 1.2 * s, 0, i);
      else d.p('dode', i % 2 ? '#8b93c9' : '#a3a9d8', x, 0.7 * s, z, 2.6 * s, 1.6 * s, 2.2 * s, 0, i);
    },
    low: (d, { x, z, i }) => d.p('dode', '#8b93c9', x, 0.3, z - 0.8, 1.2, 0.7, 1, 0, i),
  },
  beach: {
    big: (d, { x, z, i }) => {
      if (i % 2 === 0) {
        // 모래성
        d.p('box', '#f2d394', x, 1, z, 4.4, 2, 4.4);
        for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const) {
          d.p('cyl', '#f2d394', x + dx, 1.8, z + dz, 1.4, 3.6, 1.4);
          d.p('cone', '#ff8a5b', x + dx, 4.1, z + dz, 1.6, 1, 1.6);
        }
        d.p('cyl', '#e8c27a', x, 2.6, z, 2.2, 1.4, 2.2);
      } else {
        // 파라솔 + 수건
        d.p('cyl', '#ffffff', x, 2, z, 0.18, 4, 0.18);
        d.p('cone', i % 4 === 1 ? '#ff6b6b' : '#5aa9ff', x, 4.2, z, 5, 1.2, 5);
        d.p('box', '#ffd34d', x + 1.2, 0.06, z + 1, 1.4, 0.08, 2.6, 0, 0.3);
      }
    },
    fill: (d, { x, z, s, i }) => {
      // 야자나무: 기운 줄기 + 잎 5장
      const lean = (i % 2 ? 1 : -1) * 0.18;
      d.p('taper', '#c98a5a', x, 2 * s, z, 0.6 * s, 4 * s, 0.6 * s, 0, 0, lean);
      const tx = x - Math.sin(lean) * 4 * s;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + i;
        d.p('box', '#4cc56a', tx + Math.cos(a) * 1.1 * s, 4 * s, z + Math.sin(a) * 1.1 * s, 2.6 * s, 0.12 * s, 0.8 * s, 0, -a, -0.35);
      }
      d.p('sph', '#8a5a3a', tx, 3.8 * s, z, 0.5 * s);
    },
    low: (d, { x, z, i }) => d.p('oct', i % 2 ? '#ff8a5b' : '#ffd34d', x, 0.12, z - 0.8, 0.9, 0.25, 0.9, 0, i),
  },
  snow: {
    big: (d, { x, z, i }) => {
      if (i % 2 === 0) {
        // 이글루
        d.p('hemi', '#ffffff', x, 0, z, 5, 4.4, 5);
        d.p('cyl', '#f1f6ff', x, 0.9, z + 2.3, 1.8, 1.8, 1.8, Math.PI / 2);
        d.p('cyl', '#9fc4f2', x, 0.9, z + 3.1, 1.2, 0.1, 1.2, Math.PI / 2);
      } else {
        // 눈사람
        d.p('sph', '#ffffff', x, 1.4, z, 2.8);
        d.p('sph', '#ffffff', x, 3.4, z, 2);
        d.p('sph', '#ffffff', x, 4.9, z, 1.4);
        d.p('cone', '#ff8a2e', x, 4.9, z + 0.9, 0.3, 0.9, 0.3, Math.PI / 2);
        d.p('cyl', '#3867d6', x, 5.8, z, 1, 0.8, 1);
        d.p('cyl', '#ff6b6b', x, 4.2, z, 1.7, 0.3, 1.7);
      }
    },
    fill: (d, { x, z, s }) => {
      // 눈 덮인 전나무
      d.p('cyl', '#a0704a', x, 0.6 * s, z, 0.5 * s, 1.2 * s, 0.5 * s);
      for (let k = 0; k < 3; k++) {
        d.p('cone', '#3f9e6b', x, (1.8 + k * 1.2) * s, z, (3 - k * 0.7) * s, 2 * s, (3 - k * 0.7) * s);
        d.p('cone', '#ffffff', x, (2.3 + k * 1.2) * s, z, (1.6 - k * 0.35) * s, 1 * s, (1.6 - k * 0.35) * s);
      }
    },
    low: (d, { x, z }) => d.p('hemi', '#ffffff', x, 0, z - 0.8, 2, 1.2, 2),
  },
  castle: {
    big: (d, { x, z, i }) => {
      if (i % 2 === 0) {
        // 성탑 + 고깔 지붕 + 깃발
        const roof = ['#c0392b', '#3867d6', '#8e44ad'][i % 3]!;
        d.p('cyl', '#d9dde6', x, 3.5, z, 3.2, 7, 3.2);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          d.p('box', '#d9dde6', x + Math.cos(a) * 1.55, 7.3, z + Math.sin(a) * 1.55, 0.6, 0.6, 0.6, 0, -a);
        }
        d.p('cone', roof, x, 9, z, 3.6, 3, 3.6);
        d.p('cyl', '#5b6577', x, 11, z, 0.08, 1.4, 0.08);
        d.p('box', '#f6c344', x + 0.45, 11.4, z, 0.9, 0.55, 0.05);
        d.p('box', '#5b6577', x, 1, z + 1.55, 1.2, 2, 0.2);
      } else {
        // 성벽 조각
        d.p('box', '#cfd3dc', x, 2, z, 6, 4, 1.6);
        for (let k = 0; k < 5; k++) d.p('box', '#cfd3dc', x - 2.4 + k * 1.2, 4.35, z, 0.7, 0.7, 1.6);
        d.p('box', '#c0392b', x, 2.6, z + 0.82, 1.2, 2.2, 0.05);
      }
    },
    fill: (d, { x, z, s, i }) => {
      if (i % 4 === 3) {
        // 깃발 기둥
        d.p('cyl', '#8a92a6', x, 2 * s, z, 0.15 * s, 4 * s, 0.15 * s);
        d.p('box', ['#c0392b', '#3867d6', '#f6c344'][i % 3]!, x + 0.55 * s, 3.5 * s, z, 1.1 * s, 0.8 * s, 0.05);
      } else {
        d.p('taper', '#8a5a3a', x, s, z, 0.7 * s, 2 * s, 0.7 * s);
        d.p('sph', i % 2 ? '#3f8f4f' : '#4fa35f', x, 3 * s, z, 3.4 * s);
      }
    },
    low: (d, { x, z }) => d.p('sph', '#4fa35f', x, 0.45, z - 0.8, 2, 1.3, 2),
  },
  cloud: {
    big: (d, { x, z, i }) => {
      if (i % 2 === 0) {
        // 무지개 다리 + 양끝 구름
        const cs = ['#ff6b6b', '#ffb347', '#ffd34d', '#7fd78a', '#5aa9ff', '#9b87ff'];
        cs.forEach((c, k) => d.p('arch', c, x, 0, z, 4.2 - k * 0.28, 4.2 - k * 0.28, 1.6));
        for (const dx of [-4, 4]) for (let k = 0; k < 3; k++) d.p('sph', '#ffffff', x + dx + (k - 1) * 0.9, 0.6 + (k % 2) * 0.5, z, 2 - (k % 2) * 0.3);
      } else {
        // 구름 성: 구름 덩어리 + 분홍 탑
        for (let k = 0; k < 5; k++) d.p('sph', '#ffffff', x + Math.cos(k * 1.3) * 2, 1.2 + (k % 2), z + Math.sin(k * 1.3) * 1.6, 3.2);
        d.p('cyl', '#ffb3e6', x, 4.2, z, 1.6, 4, 1.6);
        d.p('cone', '#c9b3ff', x, 7.2, z, 2, 2, 2);
      }
    },
    fill: (d, { x, z, s, i }) => {
      if (i % 3 === 0) {
        // 떠 있는 별
        d.p('oct', '#ffd34d', x, 3.2 * s, z, 1.6 * s, 1.6 * s, 0.6 * s, 0, 0, Math.PI / 4);
        d.p('cyl', '#ffffff', x, 1.2 * s, z, 0.12 * s, 2.4 * s, 0.12 * s);
      } else {
        // 솜사탕 구름 나무
        const cs = ['#ffd6f0', '#e3d6ff', '#d6f0ff', '#fff3c4'];
        d.p('cyl', '#ffffff', x, 1.2 * s, z, 0.25 * s, 2.4 * s, 0.25 * s);
        for (let k = 0; k < 3; k++) d.p('sph', cs[(i + k) % 4]!, x + (k - 1) * 0.8 * s, (3 + (k % 2) * 0.6) * s, z, 2.2 * s);
      }
    },
    low: (d, { x, z }) => d.p('sph', '#ffffff', x, 0.4, z - 0.8, 2.2, 1.1, 1.6),
  },
};

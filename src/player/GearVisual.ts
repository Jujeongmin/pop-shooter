import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { TrainKind } from '../sim/training.ts';

/**
 * 캐릭터에 보이는 장비 (도형 조립, 로봇 보스와 같은 장난감 방식). 종류마다 가진 가장 높은 단계 하나:
 * 장갑(공격) = 양손, 고글(연사) = 이마, 돼지 저금통(코인) = 등.
 * 단계 색: 1 = 종류 색, 2 = 은, 3 = 금. geometry·material은 모듈 공유 (아바타가 여럿이어도 한 벌, dispose 안 함 — shared).
 */

const INK = '#2b3a67';
const TIER_METAL: Record<number, { color: string; metal: number; rough: number }> = {
  2: { color: '#dfe5f2', metal: 0.55, rough: 0.28 },
  3: { color: '#ffcf3a', metal: 0.6, rough: 0.25 },
};
const BASE_COLOR: Record<TrainKind, string> = { atk: '#ff5f6d', spd: '#4f9dff', coin: '#ff9ec4' };
const LENS: Record<number, string> = { 1: '#9fe3ff', 2: '#c9b6ff', 3: '#fff09a' };

// shared: 게임 내내 씀
const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, metal = 0.05, rough = 0.45, emissive?: string): THREE.MeshStandardMaterial {
  const key = `${color}|${metal}|${rough}|${emissive ?? ''}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive: emissive ?? '#000000', emissiveIntensity: emissive ? 0.35 : 0 });
    mats.set(key, m);
  }
  return m;
}

function tierMat(kind: TrainKind, tier: number): THREE.MeshStandardMaterial {
  const t = TIER_METAL[tier];
  return t ? mat(t.color, t.metal, t.rough) : mat(BASE_COLOR[kind]);
}

let geos: Record<string, THREE.BufferGeometry> | null = null;
function g(): Record<string, THREE.BufferGeometry> {
  geos ??= {
    ball: new THREE.SphereGeometry(1, 20, 14),
    cuff: new THREE.TorusGeometry(1, 0.32, 10, 24),
    thumb: new THREE.CapsuleGeometry(0.42, 0.6, 4, 10),
    lens: new THREE.CylinderGeometry(1, 1, 0.5, 24).rotateX(Math.PI / 2),
    ring: new THREE.TorusGeometry(1, 0.22, 10, 26),
    bridge: new RoundedBoxGeometry(1, 0.35, 0.35, 2, 0.12),
    pig: new THREE.SphereGeometry(1, 22, 16).scale(1, 0.85, 1.15),
    snout: new THREE.CylinderGeometry(0.42, 0.46, 0.3, 18).rotateX(Math.PI / 2),
    ear: new THREE.ConeGeometry(0.32, 0.5, 10),
    leg: new THREE.CylinderGeometry(0.2, 0.22, 0.4, 10),
    slot: new RoundedBoxGeometry(0.75, 0.14, 0.22, 2, 0.06),
  };
  return geos;
}

function part(geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, s: number | [number, number, number]): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  if (Array.isArray(s)) mesh.scale.set(...s); else mesh.scale.setScalar(s);
  mesh.castShadow = true;
  return mesh;
}

/** 장난감 장갑 한 짝 (크기 1 ≈ 주먹 지름 0.13m) */
export function makeGlove(tier: number): THREE.Group {
  const grp = new THREE.Group();
  const body = tierMat('atk', tier);
  const ink = mat(INK);
  grp.add(part(g().ball, body, 0, 0, 0, [0.07, 0.065, 0.075]));
  grp.add(part(g().thumb, body, 0.05, 0.01, 0.03, 0.035));
  const cuff = part(g().cuff, tier === 1 ? mat('#ffffff') : ink, 0, -0.045, 0, 0.055);
  cuff.rotation.x = Math.PI / 2;
  grp.add(cuff);
  return grp;
}

/** 고글 (이마에 걸침, 앞 = +z) */
export function makeGoggles(tier: number): THREE.Group {
  const grp = new THREE.Group();
  const frame = tierMat('spd', tier);
  const lens = mat(LENS[tier] ?? LENS[1]!, 0.1, 0.15, LENS[tier]);
  for (const x of [-0.085, 0.085]) {
    grp.add(part(g().ring, frame, x, 0, 0, 0.062));
    grp.add(part(g().lens, lens, x, 0, -0.005, 0.055));
  }
  grp.add(part(g().bridge, frame, 0, 0, 0, [0.07, 0.07, 0.07]));
  return grp;
}

/** 돼지 저금통 가방 (등에 멤, 앞 = +z: 돼지 얼굴은 바깥(−z)을 봄) */
export function makePiggy(tier: number): THREE.Group {
  const grp = new THREE.Group();
  const body = tierMat('coin', tier);
  const ink = mat(INK);
  const s = 0.11 + tier * 0.012;
  grp.add(part(g().pig, body, 0, 0, 0, s));
  grp.add(part(g().snout, body, 0, -0.01, -s * 1.12, s));
  for (const x of [-0.35, 0.35]) {
    grp.add(part(g().ball, ink, x * s * 0.55, -0.01, -s * 1.27, s * 0.07));
    const ear = part(g().ear, body, x * s, s * 0.85, -s * 0.35, s);
    ear.rotation.z = -x * 0.8;
    grp.add(ear);
    grp.add(part(g().ball, ink, x * s * 0.95, s * 0.25, -s * 0.95, s * 0.09));
  }
  for (const [x, z] of [[-0.5, -0.55], [0.5, -0.55], [-0.5, 0.55], [0.5, 0.55]] as const) grp.add(part(g().leg, body, x * s, -s * 0.8, z * s, s));
  grp.add(part(g().slot, ink, 0, s * 0.86, 0, s));
  return grp;
}

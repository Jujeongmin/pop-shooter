import * as THREE from 'three';
import { t } from '../i18n/i18n';
import type { GunModel } from '../sim/guns.ts';
import type { Facility } from './facilities';
import { RANGE_LANES, RANGE_SPOT, RANGE_TARGET } from './facilities';
import type { ToyBuilder } from './HubProps';
import type { Collider } from './movement';

/**
 * 시설 모양 (장난감 도형). 모두 앞 = +z (스폰·카메라 쪽).
 * - 업그레이드: 톱니바퀴가 도는 훈련 기계 + 피스톤 + 깜빡이는 불
 * - 총 상점: 줄무늬 차양 가판대 + 벽 진열대에 진짜 총 4종 + 받침 위에서 도는 총
 * - 환생 제단: 빛나는 원판 위 떠서 도는 환생 고리 + 반짝이
 * - 캐릭터: 커튼 탈의실 + 거울 + (받침대 위 캐릭터는 CharacterPanel이 올림)
 * - 사격장: 줄마다 아치 부스(줄 아이콘 간판), 큰 과녁은 World1Hub.buildRange
 */

/** 캐릭터 받침대 위치 (CharacterPanel이 현재 캐릭터를 올려 돌림) */
export const CHAR_TURNTABLE = { x: 9.6, z: 9.2 };

export function buildUpgrade(b: ToyBuilder, f: Facility, colliders: Collider[]): void {
  const g = new THREE.Group();
  g.position.set(f.x, 0, f.z - 1.6);
  b.root.add(g);
  b.toy(b.box(2.4, 0.4, 1.8, 0.12), '#5d6a92', 0, 0.2, 0, g);
  b.toy(b.box(2.0, 1.9, 1.4, 0.25), '#ff8a5b', 0, 1.35, 0, g);
  // 앞 화면 + 불 3개
  b.toy(b.box(1.1, 0.5, 0.1, 0.08), '#bfeaff', -0.25, 1.75, 0.72, g);
  const lights = ['#ff5f6d', '#ffd34d', '#5ccf6b'].map((c, i) => b.toy(new THREE.SphereGeometry(0.08, 12, 8), b.mat(c, { emissive: c }), 0.55 + i * 0, 1.95 - i * 0.22, 0.72, g, false));
  // 큰 톱니 (앞면)
  const gear = b.toy(b.gear(0.55, 0.16, 10), '#ffd34d', -0.25, 0.95, 0.78, g);
  const small = b.toy(b.gear(0.3, 0.14, 7), '#7cc4ff', 0.55, 0.62, 0.76, g);
  // 위 피스톤 + 굴뚝
  const piston = b.toy(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 14), '#dfe5f2', -0.45, 2.45, 0, g);
  b.toy(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 16), '#5d6a92', -0.45, 2.33, 0, g);
  b.toy(new THREE.CylinderGeometry(0.14, 0.18, 0.5, 12), '#ff9ec4', 0.55, 2.5, -0.2, g);
  b.animators.push((dt, c) => {
    gear.rotation.z -= dt * 1.6;
    small.rotation.z += dt * 2.9;
    piston.position.y = 2.45 + Math.abs(Math.sin(c * 3)) * 0.25;
    lights.forEach((l, i) => { l.visible = Math.sin(c * 4 + i * 2.1) > -0.3; });
  });
  colliders.push({ kind: 'box', x: f.x, z: f.z - 1.6, hx: 1.2, hz: 0.9 });
  b.sign('bolt', t('fac.upgrade'), f.x - 2.2, 2.2, f.z - 1.2, { w: 2.4, color: '#ff8a5b', rotY: 0.35 });
}

export function buildGunShop(b: ToyBuilder, f: Facility, colliders: Collider[], guns: Record<GunModel, THREE.Object3D> | null): void {
  const cx = f.x + 1.8;
  const g = new THREE.Group();
  g.position.set(cx, 0, f.z);
  b.root.add(g);
  // 계산대 + 뒷벽 진열판
  b.toy(b.box(3.2, 1.0, 1.1, 0.14), '#7cc4ff', 0, 0.5, 0.2, g);
  b.toy(b.box(3.4, 0.14, 1.3, 0.06), '#ffffff', 0, 1.05, 0.2, g);
  b.toy(b.box(3.2, 2.2, 0.2, 0.08), '#fffaf0', 0, 1.3, -0.65, g);
  for (const x of [-1.6, 1.6]) b.toy(new THREE.CylinderGeometry(0.09, 0.09, 2.9, 10), '#ffffff', x, 1.45, 0.75, g);
  // 줄무늬 차양 (분홍·흰색 번갈아, 앞으로 기울어짐)
  const aw = new THREE.Group();
  aw.position.set(0, 2.85, 0.15);
  aw.rotation.x = 0.35;
  g.add(aw);
  for (let i = 0; i < 6; i++) b.toy(b.box(0.6, 0.12, 1.8, 0.05), i % 2 ? '#ffffff' : '#ff9ec4', -1.5 + i * 0.6, 0, 0, aw);
  // 벽 진열대: 진짜 총 4종 (GLB 원본 복제, 공유 geometry)
  if (guns) {
    const models: GunModel[] = ['pistol', 'rifle', 'shotgun', 'sniper'];
    models.forEach((m, i) => {
      const gun = guns[m].clone(true);
      const box = new THREE.Box3().setFromObject(gun);
      const len = Math.max(0.01, box.max.x - box.min.x, box.max.z - box.min.z);
      gun.scale.multiplyScalar(0.9 / len);
      gun.position.set(-1.1 + (i % 2) * 2.2, 1.85 - Math.floor(i / 2) * 0.75, -0.5);
      gun.rotation.set(0, Math.PI / 2, 0);
      g.add(gun);
    });
    // 계산대 위에서 도는 총 (지금 가진 총이 아니라 라이플 진열)
    const spin = guns.rifle.clone(true);
    const box = new THREE.Box3().setFromObject(spin);
    spin.scale.multiplyScalar(1.1 / Math.max(0.01, box.max.x - box.min.x, box.max.z - box.min.z));
    spin.position.set(0, 1.5, 0.25);
    g.add(spin);
    b.toy(new THREE.CylinderGeometry(0.28, 0.32, 0.18, 18), '#ffd34d', 0, 1.2, 0.25, g);
    b.animators.push((dt, c) => { spin.rotation.y += dt * 1.2; spin.position.y = 1.5 + Math.sin(c * 2) * 0.06; });
  }
  colliders.push({ kind: 'box', x: cx, z: f.z, hx: 1.65, hz: 0.85 });
  b.sign('bullet', t('fac.guns'), cx, 3.45, f.z + 1.05, { w: 2.2, color: '#7cc4ff', post: false });
}

export function buildAltar(b: ToyBuilder, f: Facility, colliders: Collider[]): void {
  const g = new THREE.Group();
  g.position.set(f.x, 0, f.z - 1.6);
  b.root.add(g);
  b.toy(new THREE.CylinderGeometry(1.7, 1.95, 0.4, 8), '#b9a6ff', 0, 0.2, 0, g);
  b.toy(new THREE.CylinderGeometry(1.3, 1.3, 0.08, 40), b.mat('#f3ecff', { emissive: '#b9a6ff' }), 0, 0.44, 0, g, false);
  // 떠서 도는 환생 고리: 화살표 두 개가 원을 이룸
  const ring = new THREE.Group();
  ring.position.y = 1.9;
  g.add(ring);
  const purple = b.mat('#a98bff', { emissive: '#7b5cff' });
  for (let k = 0; k < 2; k++) {
    const arc = b.toy(new THREE.TorusGeometry(0.85, 0.14, 12, 36, Math.PI * 0.82), purple, 0, 0, 0, ring);
    arc.rotation.z = k * Math.PI;
    const head = b.toy(new THREE.ConeGeometry(0.28, 0.45, 14), purple, 0, 0, 0, ring);
    const a = k * Math.PI + Math.PI * 0.82;
    head.position.set(Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0);
    head.rotation.z = a;
  }
  // 반짝이 3개 (빙글빙글)
  const sparks = [0, 1, 2].map(() => b.toy(new THREE.OctahedronGeometry(0.13), b.mat('#fff09a', { emissive: '#ffd34d' }), 0, 0, 0, g, false));
  b.animators.push((dt, c) => {
    ring.rotation.y += dt * 1.1;
    ring.position.y = 1.9 + Math.sin(c * 1.8) * 0.15;
    sparks.forEach((s, i) => {
      const a = c * 1.4 + (i * Math.PI * 2) / 3;
      s.position.set(Math.cos(a) * 1.25, 1.5 + Math.sin(c * 2 + i) * 0.4, Math.sin(a) * 1.25);
      s.rotation.y += dt * 4;
    });
  });
  colliders.push({ kind: 'circle', x: f.x, z: f.z - 1.6, r: 1.8 });
  b.sign('reb', t('fac.altar'), f.x - 2.6, 2.1, f.z - 0.6, { w: 2.3, color: '#b9a6ff', rotY: 0.3 });
}

export function buildWardrobe(b: ToyBuilder, f: Facility, colliders: Collider[]): void {
  const g = new THREE.Group();
  g.position.set(f.x, 0, f.z - 2.2);
  b.root.add(g);
  // 탈의실: 분홍 틀 + 노란 커튼 주름 (살랑)
  b.toy(b.box(1.8, 0.2, 1.4, 0.06), '#ff9ec4', -0.7, 2.7, 0, g);
  for (const x of [-1.55, 0.15]) b.toy(new THREE.CylinderGeometry(0.08, 0.08, 2.7, 10), '#ff9ec4', x, 1.35, 0.55, g);
  b.toy(b.box(1.8, 2.6, 0.12, 0.05), '#ffe9b8', -0.7, 1.35, -0.6, g);
  const folds: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) folds.push(b.toy(new THREE.CylinderGeometry(0.15, 0.15, 2.3, 10), '#ffd34d', -1.42 + i * 0.27, 1.4, 0.55, g));
  // 거울 (둥근 틀)
  const mirror = new THREE.MeshStandardMaterial({ color: '#d9f0ff', metalness: 0.6, roughness: 0.12, emissive: '#bfe3ff', emissiveIntensity: 0.3 });
  b.own(mirror);
  const glass = b.toy(new THREE.CircleGeometry(0.62, 32), mirror, 1.0, 1.55, -0.02, g, false);
  glass.scale.set(0.75, 1.15, 1);
  const frame = b.toy(new THREE.TorusGeometry(0.62, 0.09, 10, 36), '#ff9ec4', 1.0, 1.55, 0, g);
  frame.scale.set(0.75, 1.15, 1);
  b.toy(b.box(0.2, 0.9, 0.2, 0.06), '#ff9ec4', 1.0, 0.45, 0, g);
  // 캐릭터 받침대 (돌아감, 위 캐릭터는 CharacterPanel)
  b.toy(new THREE.CylinderGeometry(0.62, 0.7, 0.24, 28), '#ffd34d', CHAR_TURNTABLE.x - f.x, 0.12, CHAR_TURNTABLE.z - (f.z - 2.2), g);
  b.animators.push((_dt, c) => folds.forEach((m, i) => { m.rotation.z = Math.sin(c * 1.6 + i * 0.7) * 0.04; }));
  colliders.push({ kind: 'box', x: f.x - 0.7, z: f.z - 2.2, hx: 0.95, hz: 0.7 });
  colliders.push({ kind: 'circle', x: f.x + 1.0, z: f.z - 2.2, r: 0.4 });
  colliders.push({ kind: 'circle', x: CHAR_TURNTABLE.x, z: CHAR_TURNTABLE.z, r: 0.65 });
  b.sign('heart', t('fac.chars'), f.x - 2.8, 2.1, f.z - 0.9, { w: 2.0, color: '#ff9ec4', rotY: 0.3 });
}

/** 사격장 줄마다 아치 부스 (줄 아이콘 간판) + 사격장 간판 */
export function buildRangeBooths(b: ToyBuilder): void {
  const icons = { atk: 'target', spd: 'rapid', coin: 'cointarget' } as const;
  const names = { atk: 'fac.rangeAtk', spd: 'fac.rangeSpd', coin: 'fac.rangeCoin' } as const;
  // 아치는 과녁 바로 뒤 (과녁을 감싸는 부스, 발판에서 과녁을 가리지 않게)
  for (const lane of RANGE_LANES) {
    const z = RANGE_TARGET.z - 0.45;
    for (const dx of [-0.92, 0.92]) b.toy(new THREE.CylinderGeometry(0.08, 0.08, 3.0, 10), lane.color, lane.x + dx, 1.5, z);
    b.toy(b.box(2.0, 0.18, 0.3, 0.06), lane.color, lane.x, 3.02, z);
    b.sign(icons[lane.kind], t(names[lane.kind]), lane.x, 3.45, z, { w: 1.7, h: 0.6, color: lane.color, post: false });
  }
  b.sign('target', t('fac.range'), RANGE_SPOT.x - 4.1, 2.0, RANGE_SPOT.z - 1.0, { w: 1.9, color: '#ffffff', rotY: 0.45 });
}

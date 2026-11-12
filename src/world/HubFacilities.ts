import * as THREE from 'three';
import { t } from '../i18n/i18n';
import type { GunModel } from '../sim/guns.ts';
import type { Facility } from './facilities';
import { FOUNTAIN, RANGE_LANES, RANGE_SPOT, RANGE_TARGET, TREADMILL, TREADMILL_LANES } from './facilities';
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
export const CHAR_TURNTABLE = { x: 12.6, z: 14.2 };

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
  // 제단 동쪽 (서쪽이면 러닝머신·동전 분수를 보는 카메라를 가림)
  b.sign('reb', t('fac.altar'), f.x + 2.7, 2.1, f.z - 0.6, { w: 2.3, color: '#b9a6ff', rotY: -0.3 });
}

export function buildWardrobe(b: ToyBuilder, f: Facility, colliders: Collider[]): void {
  const g = new THREE.Group();
  g.position.set(f.x, 0, f.z - 2.2);
  b.root.add(g);
  // 탈의실: 분홍 틀 + 노란 커튼 주름 (살랑)
  b.toy(b.box(1.8, 0.2, 1.4, 0.06), '#ff9ec4', -0.7, 2.7, 0, g);
  for (const x of [-1.55, 0.15]) b.toy(new THREE.CylinderGeometry(0.08, 0.08, 2.7, 10), '#ff9ec4', x, 1.35, 0.55, g);
  b.toy(b.box(1.8, 2.6, 0.12, 0.05), '#ffe9b8', -0.7, 1.35, -0.6, g);
  // 옆벽 (사용자 2026-11-12: 옆에서 안이 보이지 않게)
  for (const x of [-1.6, 0.2]) b.toy(b.box(0.12, 2.6, 1.15, 0.05), '#ff9ec4', x, 1.35, -0.02, g);
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

/** 사격장(공격): 과녁 셋을 감싸는 큰 아치 부스 + 간판 */
export function buildRangeBooths(b: ToyBuilder): void {
  const z = RANGE_TARGET.z - 0.45;
  const lane = RANGE_LANES[0];
  for (const dx of [-3.25, 3.25]) b.toy(new THREE.CylinderGeometry(0.1, 0.1, 3.0, 10), lane.color, RANGE_SPOT.x + dx, 1.5, z);
  b.toy(b.box(6.8, 0.2, 0.32, 0.07), lane.color, RANGE_SPOT.x, 3.02, z);
  b.sign('target', `${t('fac.range')} · ${t('fac.rangeAtk')}`, RANGE_SPOT.x, 3.5, z, { w: 2.8, h: 0.7, color: lane.color, post: false });
}

/** 러닝머신 세 대 (연사 훈련): 벨트가 흐르고 캐릭터가 위에서 달림. 앞 = −z (손잡이·화면). 여러 명이 각자 빈 벨트에 */
export interface TreadmillProps { setSpeed(v: number): void }
export function buildTreadmill(b: ToyBuilder, colliders: Collider[]): TreadmillProps {
  // 벨트 줄무늬 텍스처 (세 대 공유, 뒤(+z)로 흐름)
  const c = document.createElement('canvas');
  c.width = 32; c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3a466f'; ctx.fillRect(0, 0, 32, 128);
  ctx.fillStyle = '#4f9dff';
  for (let y = 0; y < 128; y += 32) ctx.fillRect(0, y, 32, 8);
  const tex = b.own(new THREE.CanvasTexture(c));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  const beltMat = b.own(new THREE.MeshBasicMaterial({ map: tex }));
  for (const dx of TREADMILL_LANES) {
    const g = new THREE.Group();
    g.position.set(TREADMILL.x + dx, 0, TREADMILL.z);
    b.root.add(g);
    b.toy(b.box(1.45, 0.32, 2.8, 0.12), '#5d6a92', 0, 0.16, 0, g);
    const belt = b.toy(new THREE.PlaneGeometry(1.15, 2.5), beltMat, 0, 0.33, 0.05, g, false);
    belt.rotation.x = -Math.PI / 2;
    for (const x of [-0.62, 0.62]) b.toy(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 10), '#dfe5f2', x, 0.95, -1.15, g);
    b.toy(b.box(1.4, 0.12, 0.14, 0.05), '#4f9dff', 0, 1.6, -1.15, g);
    b.toy(b.box(0.85, 0.45, 0.12, 0.06), '#bfeaff', 0, 1.82, -1.2, g);
    colliders.push({ kind: 'box', x: TREADMILL.x + dx, z: TREADMILL.z - 1.2, hx: 0.72, hz: 0.12 });
  }
  let speed = 0.6;
  b.animators.push((dt) => { tex.offset.y -= dt * speed * 0.9; });
  // 간판: 가운데 러닝머신 화면 위 (기둥 없음)
  b.sign('timer', t('fac.treadmill'), TREADMILL.x, 2.55, TREADMILL.z - 1.3, { w: 2.2, color: '#4f9dff', post: false });
  return { setSpeed: (v) => { speed = Math.max(0.6, v); } };
}

/** 동전 분수 (골드 보너스 훈련): 금색 기계 꼭대기 관에서 동전이 떨어지고 캐릭터가 받음. 기계는 서는 자리 북쪽 */
export interface FountainProps {
  /** 동전 하나 떨어뜨림 (받는 곳 = to). 닿으면 onCatch */
  drop(to: THREE.Vector3, onCatch: () => void): void;
}
export function buildFountain(b: ToyBuilder, colliders: Collider[]): FountainProps {
  const mx = FOUNTAIN.x;
  const mz = FOUNTAIN.z - 1.5;
  const g = new THREE.Group();
  g.position.set(mx, 0, mz);
  b.root.add(g);
  b.toy(new THREE.CylinderGeometry(0.9, 1.05, 0.35, 24), '#ffe48a', 0, 0.18, 0, g);
  // 몸통 + 뚜껑(동전 뿜을 때 통통 찌그러짐)
  const body = new THREE.Group();
  g.add(body);
  b.toy(new THREE.CylinderGeometry(0.62, 0.7, 1.7, 24), '#ffc928', 0, 1.2, 0, body);
  b.toy(new THREE.SphereGeometry(0.66, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), '#ff9ec4', 0, 2.05, 0, body);
  b.toy(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 18), '#ffffff', 0, 2.68, 0, body);
  // 앞으로 휘어진 관 (서는 자리 위에서 끝남)
  const spout = b.toy(new THREE.TorusGeometry(0.75, 0.14, 12, 24, Math.PI / 2), '#ffc928', 0, 2.2, 0.75, body);
  spout.rotation.set(0, Math.PI / 2, 0);
  // 꼭대기에서 도는 큰 동전 (늘 움직여서 동전 분수인 걸 알아보게)
  const coinMat = b.mat('#ffd34d', { emissive: '#ffb000', metal: 0.4, rough: 0.3 });
  const topper = b.toy(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 28), coinMat, 0, 3.35, 0, body);
  topper.rotation.x = Math.PI / 2;
  // 떨어지는 동전 (크게, 관 끝에서 위로 튀었다가 손으로)
  const coinGeo = b.own(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 18));
  const pool: { m: THREE.Mesh; t: number; from: THREE.Vector3; to: THREE.Vector3; done: (() => void) | null }[] = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.visible = false;
    m.castShadow = true;
    b.root.add(m);
    pool.push({ m, t: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), done: null });
  }
  const FALL = 0.7;
  let squash = 1;
  b.animators.push((dt, c) => {
    topper.rotation.z += dt * 3;
    topper.position.y = 3.35 + Math.sin(c * 2.4) * 0.08;
    squash = Math.min(1, squash + dt * 3);
    const k = Math.sin(squash * Math.PI) * 0.12;
    body.scale.set(1 + k, 1 - k, 1 + k);
    for (const p of pool) {
      if (p.t >= 1) continue;
      p.t = Math.min(1, p.t + dt / FALL);
      p.m.position.lerpVectors(p.from, p.to, p.t);
      p.m.position.y += Math.sin(p.t * Math.PI) * 1.3;
      p.m.rotation.x += dt * 12;
      p.m.rotation.z += dt * 5;
      if (p.t >= 1) { p.m.visible = false; p.done?.(); p.done = null; }
    }
  });
  colliders.push({ kind: 'circle', x: mx, z: mz, r: 1.0 });
  b.sign('cointarget', t('fac.fountain'), mx - 2.1, 2.0, mz + 0.6, { w: 2.1, color: '#ffc928', rotY: 0.35 });
  return {
    drop: (to, onCatch) => {
      const p = pool.find((x) => x.t >= 1) ?? pool[0]!;
      p.from.set(mx, 2.2, mz + 1.45);
      p.to.copy(to);
      p.t = 0;
      p.done = onCatch;
      p.m.visible = true;
      squash = 0;
    },
  };
}

/** 월드 이동 정류장: 둥근 발판 + 떠서 도는 지구본 + 둘레를 도는 작은 열기구 둘 + 간판 */
export function buildTravel(b: ToyBuilder, f: Facility, colliders: Collider[]): void {
  const g = new THREE.Group();
  g.position.set(f.x, 0, f.z - 1.6);
  b.root.add(g);
  b.toy(new THREE.CylinderGeometry(1.6, 1.8, 0.35, 24), '#7cc4ff', 0, 0.18, 0, g);
  b.toy(new THREE.CylinderGeometry(1.2, 1.2, 0.06, 32), b.mat('#e9f6ff', { emissive: '#7cc4ff' }), 0, 0.39, 0, g, false);
  const globe = new THREE.Group();
  globe.position.y = 2.1;
  g.add(globe);
  b.toy(new THREE.SphereGeometry(0.85, 24, 16), '#6fc3ff', 0, 0, 0, globe);
  // 대륙 조각 (초록 납작 구) + 적도 고리
  for (let k = 0; k < 5; k++) {
    const a = k * 1.3;
    const land = b.toy(new THREE.SphereGeometry(0.32, 12, 8), '#7fd78a', Math.cos(a) * 0.62, Math.sin(k * 2.1) * 0.45, Math.sin(a) * 0.62, globe, false);
    land.scale.set(1, 0.7, 0.45);
    land.lookAt(0, 0, 0);
  }
  const ring = b.toy(new THREE.TorusGeometry(1.15, 0.06, 8, 40), '#ffd34d', 0, 0, 0, globe);
  ring.rotation.x = Math.PI / 2.4;
  // 열기구 둘
  const balloons = ['#ff9ec4', '#ffd34d'].map((c) => {
    const bg = new THREE.Group();
    g.add(bg);
    b.toy(new THREE.SphereGeometry(0.32, 14, 10), c, 0, 0.3, 0, bg);
    b.toy(new THREE.BoxGeometry(0.18, 0.14, 0.18), '#c98a5a', 0, -0.12, 0, bg);
    return bg;
  });
  b.animators.push((dt, c) => {
    globe.rotation.y += dt * 0.8;
    globe.position.y = 2.1 + Math.sin(c * 1.5) * 0.12;
    balloons.forEach((bg, i) => {
      const a = c * 0.7 + i * Math.PI;
      bg.position.set(Math.cos(a) * 1.7, 1.9 + Math.sin(c * 1.3 + i) * 0.35, Math.sin(a) * 1.7);
    });
  });
  colliders.push({ kind: 'circle', x: f.x, z: f.z - 1.6, r: 1.7 });
  b.sign('globe', t('fac.travel'), f.x + 2.6, 2.1, f.z - 0.6, { w: 2.3, color: '#7cc4ff', rotY: -0.3 });
}

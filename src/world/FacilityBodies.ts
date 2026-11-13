import * as THREE from 'three';
import type { GunSource } from '../assets/loadAssets';
import type { GunModel } from '../sim/guns.ts';
import { gunSlot } from './gunSlot';
import type { Facility } from './facilities';
import type { ToyBuilder } from './HubProps';
import type { DecorKind } from './worldThemes';

/**
 * 월드별 상점·업그레이드 본체 (사용자 2026-11-12: 본체 모양도 월드마다). 월드 2~8만, 월드 1은 HubFacilities 원래 모양.
 * 자리·충돌·간판은 원래 것 그대로 (원래 본체만 숨김). 공통 신호는 남김: 업그레이드 = 앞면 톱니 + 화면 + 불, 상점 = 계산대 + 벽 총 진열 + 도는 총.
 * 소유: 이 ToyBuilder(월드마다 새로, 월드 바꿀 때 해제). 총은 GLB 원본 복제(공유 geometry, 해제 안 함).
 */

type Kind = Exclude<DecorKind, 'town'>;

/** 업그레이드 공통: 앞면 화면·불 3개·큰 톱니·작은 톱니 (g 기준 앞 = +z, zf = 앞면 z) */
function upgradeFace(b: ToyBuilder, g: THREE.Group, zf: number, y: number, gearColor: string): void {
  b.toy(b.box(0.9, 0.42, 0.1, 0.07), '#bfeaff', -0.3, y + 0.75, zf, g);
  const lights = ['#ff5f6d', '#ffd34d', '#5ccf6b'].map((c, i) => b.toy(new THREE.SphereGeometry(0.07, 12, 8), b.mat(c, { emissive: c }), 0.42, y + 0.92 - i * 0.2, zf, g, false));
  const gear = b.toy(b.gear(0.48, 0.14, 10), gearColor, -0.3, y, zf + 0.06, g);
  const small = b.toy(b.gear(0.26, 0.12, 7), '#ffffff', 0.45, y - 0.2, zf + 0.04, g);
  b.animators.push((dt, c) => {
    gear.rotation.z -= dt * 1.6;
    small.rotation.z += dt * 2.9;
    lights.forEach((l, i) => { l.visible = Math.sin(c * 4 + i * 2.1) > -0.3; });
  });
}

/** 상점 공통: 벽 총 4개 + 계산대 위 받침에서 도는 총 (g 기준) */
function gunDisplay(b: ToyBuilder, g: THREE.Group, guns: GunSource | null, wallZ: number, counterY: number): void {
  if (!guns) return;
  const models: GunModel[] = ['pistol', 'rifle', 'shotgun', 'sniper'];
  models.forEach((m, i) => {
    const gun = gunSlot(guns, m, 0.85);
    gun.position.set(-1.05 + (i % 2) * 2.1, 1.85 - Math.floor(i / 2) * 0.72, wallZ);
    gun.rotation.set(0, Math.PI / 2, 0);
    g.add(gun);
  });
  const spin = gunSlot(guns, 'rifle', 1.05);
  spin.position.set(0, counterY + 0.45, 0.25);
  g.add(spin);
  b.toy(new THREE.CylinderGeometry(0.26, 0.3, 0.16, 18), '#ffd34d', 0, counterY + 0.12, 0.25, g);
  b.animators.push((dt, c) => { spin.rotation.y += dt * 1.2; spin.position.y = counterY + 0.45 + Math.sin(c * 2) * 0.06; });
}

// ── 업그레이드 본체 (원래 자리: f.x, f.z − 1.6, 폭 2.4 · 깊이 1.8) ──
const UPGRADE: Record<Kind, (b: ToyBuilder, g: THREE.Group) => void> = {
  // 레미콘: 기운 회전 드럼 + 바퀴 받침 + 사다리
  construction: (b, g) => {
    b.toy(b.box(2.4, 0.35, 1.6, 0.1), '#5b6577', 0, 0.3, 0, g);
    for (const x of [-0.8, 0.8]) for (const z of [-0.65, 0.65]) b.toy(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 16), '#2b3150', x, 0.22, z, g).rotation.x = Math.PI / 2;
    const drum = new THREE.Group();
    drum.position.set(0, 1.35, -0.1);
    drum.rotation.z = 0.35;
    g.add(drum);
    b.toy(new THREE.CylinderGeometry(0.62, 0.45, 1.5, 20), '#ffc23d', 0, 0, 0, drum).rotation.z = Math.PI / 2;
    for (const x of [-0.4, 0, 0.4]) b.toy(new THREE.TorusGeometry(0.58, 0.05, 8, 24), '#2b2f3a', x, 0, 0, drum).rotation.y = Math.PI / 2;
    b.toy(b.box(0.08, 1.4, 0.4, 0.03), '#9aa6c4', 1.05, 0.9, 0.2, g);
    b.animators.push((dt) => { drum.rotation.x += dt * 1.4; });
    upgradeFace(b, g, 0.82, 0.85, '#ff8a2e');
  },
  // 뽑기 기계: 유리 돔 안 사탕 공들이 빙글 + 빨간 받침
  candy: (b, g) => {
    b.toy(b.box(1.7, 1.25, 1.4, 0.3), '#ff5e8a', 0, 0.7, 0, g);
    b.toy(new THREE.CylinderGeometry(0.75, 0.8, 0.15, 24), '#ffffff', 0, 1.4, 0, g);
    const glass = new THREE.MeshStandardMaterial({ color: '#e9fbff', transparent: true, opacity: 0.35, roughness: 0.1 });
    b.own(glass);
    b.toy(new THREE.SphereGeometry(0.78, 24, 16), glass, 0, 2.15, 0, g, false);
    const balls = new THREE.Group();
    balls.position.set(0, 1.85, 0);
    g.add(balls);
    const cs = ['#ff6b6b', '#ffd34d', '#7fd78a', '#5aa9ff', '#c9a6ff', '#ff9ec4'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.toy(new THREE.SphereGeometry(0.16, 12, 10), cs[i % cs.length]!, Math.cos(a) * 0.42, (i % 3) * 0.18, Math.sin(a) * 0.42, balls, false);
    }
    b.toy(new THREE.SphereGeometry(0.12, 12, 10), '#ff3b4f', 0, 3.0, 0, g);
    b.animators.push((dt) => { balls.rotation.y += dt * 0.9; });
    upgradeFace(b, g, 0.72, 0.6, '#ffd34d');
  },
  // 반응로: 빛나는 심 + 도는 고리 + 옆 패널
  space: (b, g) => {
    b.toy(new THREE.CylinderGeometry(1.0, 1.15, 0.35, 24), '#6f78b8', 0, 0.18, 0, g);
    b.toy(new THREE.CylinderGeometry(0.55, 0.55, 1.9, 20), '#c3c9ec', 0, 1.3, -0.2, g);
    const core = b.toy(new THREE.SphereGeometry(0.42, 20, 14), b.mat('#7cf0ff', { emissive: '#3ad8ff' }), 0, 2.45, -0.2, g, false);
    const rings = [0, 1].map((k) => {
      const r = b.toy(new THREE.TorusGeometry(0.7, 0.05, 8, 32), '#ffd34d', 0, 2.45, -0.2, g);
      r.rotation.x = k ? 1.1 : 0.4;
      return r;
    });
    for (const x of [-0.95, 0.95]) b.toy(b.box(0.35, 1.3, 0.9, 0.08), '#9ea6d6', x, 0.95, 0, g);
    b.animators.push((dt, c) => {
      rings[0]!.rotation.z += dt * 1.5;
      rings[1]!.rotation.y += dt * 1.1;
      core.scale.setScalar(1 + Math.sin(c * 3) * 0.06);
    });
    upgradeFace(b, g, 0.62, 0.9, '#7cf0ff');
  },
  // 대나무 오두막 기계: 나무통 + 대나무 기둥 + 앞의 배 키(돌아감)
  beach: (b, g) => {
    b.toy(new THREE.CylinderGeometry(0.85, 0.95, 1.7, 18), '#c98a5a', 0, 0.85, -0.1, g);
    for (const y of [0.35, 0.85, 1.35]) b.toy(new THREE.TorusGeometry(0.9, 0.05, 8, 28), '#8a5a3a', 0, y, -0.1, g).rotation.x = Math.PI / 2;
    for (const x of [-1.05, 1.05]) b.toy(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 10), '#d9c27a', x, 1.2, 0.3, g);
    b.toy(new THREE.ConeGeometry(1.35, 0.7, 6), '#e8c27a', 0, 2.45, 0.05, g);
    const helm = new THREE.Group();
    helm.position.set(0.45, 1.3, 0.85);
    g.add(helm);
    b.toy(new THREE.TorusGeometry(0.32, 0.05, 8, 24), '#8a5a3a', 0, 0, 0, helm);
    for (let k = 0; k < 6; k++) b.toy(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), '#8a5a3a', 0, 0, 0, helm).rotation.z = (k / 6) * Math.PI;
    b.animators.push((dt) => { helm.rotation.z += dt * 1.2; });
    upgradeFace(b, g, 0.88, 0.65, '#ffd34d');
  },
  // 눈 만드는 기계: 얼음 상자 + 위에서 도는 눈송이 바람개비
  snow: (b, g) => {
    b.toy(b.box(2.0, 1.7, 1.4, 0.3), '#cfe8ff', 0, 1.0, 0, g);
    b.toy(b.box(2.2, 0.3, 1.6, 0.15), '#ffffff', 0, 1.95, 0, g);
    for (let k = 0; k < 5; k++) b.toy(new THREE.ConeGeometry(0.07, 0.25, 8), '#9fd0ff', -0.8 + k * 0.4, 1.68, 0.78, g).rotation.x = Math.PI;
    const flake = new THREE.Group();
    flake.position.set(0, 2.75, 0);
    g.add(flake);
    for (let k = 0; k < 3; k++) b.toy(b.box(1.2, 0.1, 0.1, 0.04), '#ffffff', 0, 0, 0, flake).rotation.z = (k / 3) * Math.PI;
    b.toy(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), '#9aa6c4', 0, 2.3, 0, g);
    b.animators.push((dt) => { flake.rotation.z += dt * 2; });
    upgradeFace(b, g, 0.72, 0.8, '#7cc4ff');
  },
  // 대장간 화덕: 돌 화로(불) + 모루 + 도는 숫돌
  castle: (b, g) => {
    b.toy(b.box(2.2, 1.6, 1.5, 0.12), '#b5bac6', 0, 0.8, -0.1, g);
    b.toy(new THREE.CylinderGeometry(0.4, 0.55, 0.9, 12), '#8a92a6', 0.55, 2.0, -0.3, g);
    const fire = b.toy(new THREE.SphereGeometry(0.3, 14, 10), b.mat('#ff9a2e', { emissive: '#ff6a00' }), -0.3, 1.0, 0.62, g, false);
    b.toy(b.box(0.8, 0.5, 0.08, 0.04), '#3b2a2a', -0.3, 1.0, 0.66, g);
    b.toy(b.box(0.6, 0.25, 0.3, 0.05), '#5b6577', 1.35, 0.85, 0.45, g);
    b.toy(b.box(0.25, 0.6, 0.2, 0.05), '#5b6577', 1.35, 0.4, 0.45, g);
    const stone = b.toy(new THREE.CylinderGeometry(0.4, 0.4, 0.14, 20), '#cfc6b2', -1.35, 1.0, 0.2, g);
    stone.rotation.z = Math.PI / 2;
    b.animators.push((dt, c) => { stone.rotation.x += dt * 3; fire.scale.setScalar(1 + Math.sin(c * 9) * 0.12); });
    upgradeFace(b, g, 0.67, 0.45, '#f6c344');
  },
  // 무지개 공장: 구름 몸통 + 무지개 바람개비
  cloud: (b, g) => {
    for (const [x, y, z, r] of [[0, 1.0, 0, 0.85], [-0.7, 0.8, 0, 0.6], [0.7, 0.8, 0, 0.6], [-0.3, 1.6, -0.1, 0.55], [0.35, 1.55, -0.1, 0.5]] as const) b.toy(new THREE.SphereGeometry(r, 18, 14), '#ffffff', x, y, z, g);
    const wheel = new THREE.Group();
    wheel.position.set(0, 2.45, 0);
    g.add(wheel);
    const cs = ['#ff6b6b', '#ffb347', '#ffd34d', '#7fd78a', '#5aa9ff', '#9b87ff'];
    cs.forEach((c, k) => {
      const blade = b.toy(new THREE.ConeGeometry(0.22, 0.6, 3), c, 0, 0.3, 0, wheel);
      blade.position.set(Math.cos((k / 6) * Math.PI * 2) * 0.3, Math.sin((k / 6) * Math.PI * 2) * 0.3, 0);
      blade.rotation.z = (k / 6) * Math.PI * 2 - Math.PI / 2;
    });
    b.toy(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), '#ffffff', 0, 2.0, -0.05, g);
    b.animators.push((dt) => { wheel.rotation.z += dt * 2.2; });
    upgradeFace(b, g, 0.85, 0.8, '#ffb3e6');
  },
};

// ── 상점 본체 (원래 자리: f.x + 1.8, f.z, 폭 3.4 · 깊이 1.7) ──
const SHOP: Record<Kind, (b: ToyBuilder, g: THREE.Group) => { wallZ: number; counterY: number }> = {
  // 컨테이너 가게: 골함석 상자 + 경고 띠 문틀
  construction: (b, g) => {
    b.toy(b.box(3.4, 2.6, 0.2, 0.04), '#ff8a2e', 0, 1.3, -0.7, g);
    for (const x of [-1.6, 1.6]) b.toy(b.box(0.2, 2.6, 1.6, 0.04), '#ff8a2e', x, 1.3, 0.05, g);
    b.toy(b.box(3.4, 0.2, 1.6, 0.04), '#ff8a2e', 0, 2.65, 0.05, g);
    for (let k = 0; k < 7; k++) b.toy(b.box(0.48, 0.2, 0.06, 0.02), k % 2 ? '#2b2f3a' : '#ffc23d', -1.45 + k * 0.48, 2.45, 0.86, g);
    b.toy(b.box(3.0, 0.9, 0.8, 0.08), '#8d9db6', 0, 0.45, 0.35, g);
    return { wallZ: -0.55, counterY: 0.9 };
  },
  // 사탕 수레: 컵케이크 지붕 + 줄무늬 계산대 + 막대사탕 기둥
  candy: (b, g) => {
    b.toy(b.box(3.0, 1.0, 1.1, 0.25), '#ffd1e6', 0, 0.5, 0.2, g);
    for (let k = 0; k < 6; k++) b.toy(b.box(0.5, 1.02, 0.02, 0.01), k % 2 ? '#ffffff' : '#ff8fbf', -1.25 + k * 0.5, 0.5, 0.76, g);
    b.toy(b.box(3.2, 2.2, 0.2, 0.08), '#fff3c4', 0, 1.3, -0.65, g);
    for (const x of [-1.5, 1.5]) {
      b.toy(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 10), '#ffffff', x, 1.3, 0.75, g);
      b.toy(new THREE.SphereGeometry(0.22, 14, 10), '#ff5e8a', x, 2.7, 0.75, g);
    }
    b.toy(new THREE.SphereGeometry(1.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#ffb3d9', 0, 2.7, 0.05, g).scale.set(1.05, 0.45, 0.7);
    b.toy(new THREE.SphereGeometry(0.2, 12, 10), '#ff3b4f', 0, 3.45, 0.05, g);
    return { wallZ: -0.5, counterY: 1.0 };
  },
  // 캡슐 가게: 둥근 금속 몸통 + 네온 고리
  space: (b, g) => {
    b.toy(new THREE.CylinderGeometry(1.75, 1.75, 0.2, 28, 1, false, -Math.PI / 2, Math.PI), '#6f78b8', 0, 0.1, 0, g);
    b.toy(new THREE.CylinderGeometry(1.7, 1.7, 2.6, 28, 1, true, Math.PI / 2, Math.PI), '#c3c9ec', 0, 1.3, 0, g);
    b.toy(new THREE.SphereGeometry(1.7, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#e8ebff', 0, 2.6, 0, g).scale.set(1, 0.35, 1);
    b.toy(new THREE.TorusGeometry(1.72, 0.06, 8, 40), b.mat('#7cf0ff', { emissive: '#3ad8ff' }), 0, 2.62, 0, g, false).rotation.x = Math.PI / 2;
    b.toy(b.box(3.0, 0.95, 0.8, 0.2), '#9ea6d6', 0, 0.48, 0.45, g);
    return { wallZ: -0.9, counterY: 0.95 };
  },
  // 해변 오두막: 대나무 기둥 + 초가지붕 + 서핑보드 간판
  beach: (b, g) => {
    for (const [x, z] of [[-1.55, -0.6], [1.55, -0.6], [-1.55, 0.75], [1.55, 0.75]] as const) b.toy(new THREE.CylinderGeometry(0.09, 0.09, 2.7, 10), '#d9c27a', x, 1.35, z, g);
    b.toy(new THREE.ConeGeometry(2.4, 1.1, 4), '#e8c27a', 0, 3.1, 0.1, g).rotation.y = Math.PI / 4;
    b.toy(b.box(3.1, 2.0, 0.12, 0.04), '#c98a5a', 0, 1.25, -0.65, g);
    b.toy(b.box(3.0, 0.95, 0.9, 0.12), '#c98a5a', 0, 0.48, 0.3, g);
    for (let k = 0; k < 5; k++) b.toy(b.box(0.06, 0.95, 0.06, 0.02), '#8a5a3a', -1.2 + k * 0.6, 0.48, 0.76, g);
    b.toy(b.box(0.4, 1.6, 0.08, 0.15), '#5aa9ff', 1.95, 0.8, 0.6, g).rotation.z = -0.15;
    return { wallZ: -0.5, counterY: 0.95 };
  },
  // 이글루 가게: 반구 + 앞 입구 + 얼음 계산대
  snow: (b, g) => {
    // 앞이 트인 뒤쪽 반 돔 (안쪽 벽의 총이 보이게, 안쪽도 그림)
    const snowMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, side: THREE.DoubleSide });
    b.own(snowMat);
    b.toy(new THREE.SphereGeometry(1.75, 28, 14, Math.PI, Math.PI, 0, Math.PI / 2), snowMat, 0, 0, -0.1, g).scale.set(1, 1.45, 0.75);
    for (let k = 0; k < 3; k++) b.toy(new THREE.TorusGeometry(1.76, 0.03, 6, 40, Math.PI), '#d8e8fb', 0, 0.55 + k * 0.6, -0.1, g, false).scale.set(1 - k * 0.12, 1, 0.75 - k * 0.09);
    b.toy(b.box(2.6, 0.95, 0.7, 0.2), '#cfe8ff', 0, 0.48, 0.55, g);
    for (let k = 0; k < 4; k++) b.toy(new THREE.ConeGeometry(0.06, 0.22, 8), '#9fd0ff', -0.75 + k * 0.5, 2.15, 0.92, g).rotation.x = Math.PI;
    return { wallZ: -0.75, counterY: 0.95 };
  },
  // 기사 천막: 빨강·흰 줄무늬 고깔 천막 + 나무 계산대 + 깃발
  castle: (b, g) => {
    const stripes = ['#c0392b', '#ffffff'];
    for (let k = 0; k < 8; k++) b.toy(new THREE.ConeGeometry(2.1, 1.3, 16, 1, false, (k / 8) * Math.PI * 2, Math.PI / 4), stripes[k % 2]!, 0, 3.05, 0, g);
    for (const [x, z] of [[-1.6, -0.6], [1.6, -0.6], [-1.6, 0.75], [1.6, 0.75]] as const) b.toy(new THREE.CylinderGeometry(0.07, 0.07, 2.5, 10), '#8a5a3a', x, 1.25, z, g);
    b.toy(b.box(3.1, 2.2, 0.12, 0.04), '#f5ecd8', 0, 1.3, -0.65, g);
    b.toy(b.box(3.0, 0.9, 0.85, 0.08), '#8a5a3a', 0, 0.45, 0.3, g);
    b.toy(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), '#5b6577', 0, 4.05, 0, g);
    b.toy(b.box(0.6, 0.38, 0.03, 0.02), '#3867d6', 0.3, 4.25, 0, g);
    return { wallZ: -0.5, counterY: 0.9 };
  },
  // 구름 가게: 구름 계산대 + 무지개 차양
  cloud: (b, g) => {
    for (let k = 0; k < 5; k++) b.toy(new THREE.SphereGeometry(0.5, 16, 12), '#ffffff', -1.2 + k * 0.6, 0.55, 0.3, g).scale.set(1, 0.95, 0.9);
    b.toy(b.box(3.2, 2.2, 0.2, 0.15), '#fff3fb', 0, 1.3, -0.65, g);
    const cs = ['#ff6b6b', '#ffb347', '#ffd34d', '#7fd78a', '#5aa9ff', '#9b87ff'];
    cs.forEach((c, k) => b.toy(new THREE.TorusGeometry(1.75 - k * 0.1, 0.06, 8, 32, Math.PI), c, 0, 1.0, 0.75, g));
    for (const x of [-1.7, 1.7]) b.toy(new THREE.SphereGeometry(0.4, 14, 10), '#ffffff', x, 1.0, 0.75, g);
    return { wallZ: -0.5, counterY: 1.0 };
  },
};

/** 월드 테마 상점·업그레이드 본체를 b에 만듦 (원래 본체와 같은 자리) */
export function buildThemedBodies(b: ToyBuilder, kind: Kind, upgrade: Facility, guns: Facility, models: GunSource | null): void {
  const ug = new THREE.Group();
  ug.position.set(upgrade.x, 0, upgrade.z - 1.6);
  b.root.add(ug);
  UPGRADE[kind](b, ug);
  const sg = new THREE.Group();
  sg.position.set(guns.x + 1.8, 0, guns.z);
  b.root.add(sg);
  const s = SHOP[kind](b, sg);
  gunDisplay(b, sg, models, s.wallZ, s.counterY);
}

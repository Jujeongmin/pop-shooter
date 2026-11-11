import * as THREE from 'three';
import { BrickBatch, BRICK_SCALE, type BrickName, type KitModel } from './kit';
import { disposeLabel, makeLabel } from './labels';
import type { Collider } from './movement';
import { BALANCE } from '../sim/balance.ts';
import { stageLabel } from '../sim/stages.ts';
import { HUB_BOUNDS, PORTAL_GATE, RANGE_SPOT, RANGE_TARGET, WORLD1_FACILITIES, type Facility } from './facilities';

/** 이 광장 월드의 스테이지 수 (포털 기록은 월드 1 안에서만) */
const PER_WORLD = BALANCE.stage.perWorld;

/**
 * 월드 1 광장 "장난감 마을": 팝배틀 브릭 키트 + 임시 도형 시설.
 * 이 클래스가 만든 geometry·material·label은 dispose()에서 해제. 키트 지오메트리·머티리얼은 공유라 해제 안 함.
 */
export class World1Hub {
  readonly root = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly facilities: readonly Facility[] = WORLD1_FACILITIES;
  readonly bounds = HUB_BOUNDS;
  /** 과녁 (훈련 때 흔들기·조준 위치) */
  readonly targets: THREE.Object3D[] = [];
  private readonly owned: { dispose(): void }[] = [];
  private readonly labels: THREE.Sprite[] = [];
  private swirl: THREE.Mesh | null = null;
  private bestLabel: THREE.Sprite | null = null;
  private readonly mats = new Map<string, THREE.MeshStandardMaterial>();

  constructor(kit: Record<BrickName, KitModel>) {
    this.buildGround();
    const bricks = new BrickBatch();
    this.buildTown(bricks);
    this.root.add(bricks.build(kit));
    this.buildRange();
    this.buildFacilities();
    this.buildPortal();
  }

  private mat(color: string): THREE.MeshStandardMaterial {
    let m = this.mats.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
      this.mats.set(color, m);
      this.owned.push(m);
    }
    return m;
  }

  private mesh(geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, material?: THREE.Material): THREE.Mesh {
    this.owned.push(geo);
    const m = new THREE.Mesh(geo, material ?? this.mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.root.add(m);
    return m;
  }

  private label(text: string, x: number, y: number, z: number, size = 1.2): THREE.Sprite {
    const s = makeLabel(text, { size });
    s.position.set(x, y, z);
    this.root.add(s);
    this.labels.push(s);
    return s;
  }

  private buildGround(): void {
    const flat = (geo: THREE.BufferGeometry, color: string, y: number, x = 0, z = 0): void => {
      this.mesh(geo, color, x, y, z).castShadow = false;
    };
    flat(new THREE.BoxGeometry(HUB_BOUNDS.hx * 2 + 40, 1, HUB_BOUNDS.hz * 2 + 40), '#9ad48f', -0.5);
    flat(new THREE.CylinderGeometry(11, 11, 0.06, 48), '#ffe9b8', 0.03);
    flat(new THREE.BoxGeometry(56, 0.05, 5), '#ffd9a8', 0.025, 0, -22);
    flat(new THREE.BoxGeometry(4, 0.05, 30), '#ffd9a8', 0.026, 0, -8);
  }

  /** 시계탑(가운데) + 블록 집 + 나무 */
  private buildTown(b: BrickBatch): void {
    const towerColors = ['#ff9ec4', '#7cc4ff', '#ffd34d', '#ffffff'];
    const R = BRICK_SCALE * 2.6;
    const towerH = 4 * 0.114 * R;
    for (let i = 0; i < 4; i++) b.add('round-1x1', 0, i * 0.114 * R, 0, towerColors[i]!, 0, R);
    this.colliders.push({ kind: 'circle', x: 0, z: 0, r: 0.04 * R + 0.1 });
    const clock = this.mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.25, 32), '#ffffff', 0, towerH - 1.6, 0.04 * R + 0.05);
    clock.rotation.x = Math.PI / 2;
    this.label('POP 마을', 0, towerH + 1.2, 0, 1.6);

    const houses: [number, number, string, string][] = [
      [-22, 14, '#ff9ec4', '#7cc4ff'], [-22, 24, '#ffd34d', '#ff8a5b'], [22, 14, '#7cc4ff', '#ffd34d'],
      [22, 24, '#ff8a5b', '#ff9ec4'], [-8, 25, '#b9a6ff', '#ffd34d'], [8, 25, '#7fd78a', '#ff8a5b'],
    ];
    const W = 0.318 * BRICK_SCALE;
    const D = 0.158 * BRICK_SCALE;
    const H = 0.114 * BRICK_SCALE;
    for (const [x, z, wall, roof] of houses) {
      for (let row = 0; row < 3; row++) {
        for (let cx = 0; cx < 2; cx++) {
          for (let cz = 0; cz < 2; cz++) {
            b.add('brick-2x4', x + (cx - 0.5) * W, row * H, z + (cz - 0.5) * D, row === 1 ? '#ffffff' : wall);
          }
        }
      }
      for (let cx = 0; cx < 4; cx++) {
        b.add('slope-2x4', x + (cx - 1.5) * W * 0.5, 3 * H, z - D * 0.5, roof, 0);
        b.add('slope-2x4', x + (cx - 1.5) * W * 0.5, 3 * H, z + D * 0.5, roof, Math.PI);
      }
      this.colliders.push({ kind: 'box', x, z, hx: W, hz: D });
    }
    const trees: [number, number][] = [[-27, 4], [-27, -6], [27, 4], [27, -8], [-10, 14], [10, 14], [-27, -14], [27, -15]];
    const trunk = new THREE.CylinderGeometry(0.35, 0.45, 2, 12);
    const leaves = new THREE.SphereGeometry(1.7, 20, 14);
    this.owned.push(trunk, leaves);
    for (const [x, z] of trees) {
      const t = new THREE.Mesh(trunk, this.mat('#c98a5a'));
      t.position.set(x, 1, z);
      const l = new THREE.Mesh(leaves, this.mat('#6fcf7a'));
      l.position.set(x, 3.2, z);
      t.castShadow = l.castShadow = true;
      this.root.add(t, l);
      this.colliders.push({ kind: 'circle', x, z, r: 0.6 });
    }
  }

  /** 사격장: 파란 매트 + 과녁 3개 */
  private buildRange(): void {
    this.mesh(new THREE.BoxGeometry(6, 0.08, 4), '#7cc4ff', RANGE_SPOT.x, 0.04, RANGE_SPOT.z).castShadow = false;
    this.mesh(new THREE.BoxGeometry(6, 0.06, 10), '#e8f4ff', RANGE_SPOT.x, 0.03, (RANGE_SPOT.z + RANGE_TARGET.z) / 2 - 1).castShadow = false;
    const post = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8);
    this.owned.push(post);
    const discs = [0, 1, 2, 3].map((k) => new THREE.CylinderGeometry(0.7 - k * 0.16, 0.7 - k * 0.16, 0.12 + k * 0.02, 28));
    this.owned.push(...discs);
    const ringColors = ['#ffffff', '#ff6b6b', '#ffffff', '#ff6b6b'];
    for (let i = -1; i <= 1; i++) {
      const t = new THREE.Group();
      t.position.set(RANGE_TARGET.x + i * 2, 0, RANGE_TARGET.z);
      const p = new THREE.Mesh(post, this.mat('#c98a5a'));
      p.position.y = 0.6;
      t.add(p);
      discs.forEach((g, k) => {
        const d = new THREE.Mesh(g, this.mat(ringColors[k]!));
        d.rotation.x = Math.PI / 2;
        d.position.y = 1.6;
        d.castShadow = true;
        t.add(d);
      });
      this.root.add(t);
      this.targets.push(t);
      this.colliders.push({ kind: 'circle', x: t.position.x, z: t.position.z, r: 0.5 });
    }
    this.label('사격장', RANGE_SPOT.x - 3.4, 3, RANGE_SPOT.z - 2, 0.8);
  }

  /** 업그레이드 기계 · 총 상점 · 환생 제단 (임시 도형) */
  private buildFacilities(): void {
    const f = (id: string): Facility => this.facilities.find((x) => x.id === id)!;
    const up = f('upgrade');
    this.mesh(new THREE.BoxGeometry(2.2, 2.4, 1.6), '#ff8a5b', up.x, 1.2, up.z - 1.6);
    this.mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 20), '#ffd34d', up.x, 2.55, up.z - 1.6);
    this.colliders.push({ kind: 'box', x: up.x, z: up.z - 1.6, hx: 1.1, hz: 0.8 });
    this.label('업그레이드', up.x, 3.6, up.z - 1.6);

    const gs = f('guns');
    this.mesh(new THREE.BoxGeometry(3.2, 1.1, 1.4), '#7cc4ff', gs.x + 1.8, 0.55, gs.z);
    this.mesh(new THREE.BoxGeometry(3.6, 0.2, 2), '#ff9ec4', gs.x + 1.8, 2.6, gs.z).rotation.z = -0.15;
    this.mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8), '#ffffff', gs.x + 0.2, 1.25, gs.z - 0.8);
    this.mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8), '#ffffff', gs.x + 0.2, 1.25, gs.z + 0.8);
    this.colliders.push({ kind: 'box', x: gs.x + 1.8, z: gs.z, hx: 1.6, hz: 0.7 });
    this.label('총 상점', gs.x + 1.8, 3.6, gs.z);

    const al = f('altar');
    this.mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.6, 6), '#b9a6ff', al.x, 0.3, al.z + 1.6);
    const orbMat = new THREE.MeshStandardMaterial({ color: '#f3ecff', emissive: '#b9a6ff', emissiveIntensity: 0.6 });
    this.owned.push(orbMat);
    this.mesh(new THREE.SphereGeometry(0.7, 24, 16), '', al.x, 1.5, al.z + 1.6, orbMat);
    this.colliders.push({ kind: 'circle', x: al.x, z: al.z + 1.6, r: 1.8 });
    this.label('환생 제단', al.x, 3, al.z + 1.6);
  }

  /** 월드 포털: 받침 + 세운 고리 + 안쪽 소용돌이(돌아감) + 위에 최고 기록 */
  private buildPortal(): void {
    const g = PORTAL_GATE;
    this.mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.3, 40), '#ffe9b8', g.x, 0.15, g.z).castShadow = false;
    const ring = this.mesh(new THREE.TorusGeometry(2.2, 0.32, 16, 48), '#ffd34d', g.x, 2.6, g.z);
    ring.castShadow = true;
    // 소용돌이 텍스처 (캔버스 한 번, 직접 소유)
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, '#b9a6ff');
    grad.addColorStop(1, '#6b5bd6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 6;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      for (let t = 0; t < 1; t += 0.02) {
        const a = k * Math.PI / 2 + t * Math.PI * 2.2;
        const r = 6 + t * 58;
        ctx[t === 0 ? 'moveTo' : 'lineTo'](64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const swirlMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    this.owned.push(tex, swirlMat);
    this.swirl = this.mesh(new THREE.CircleGeometry(2.05, 48), '', g.x, 2.6, g.z, swirlMat);
    this.swirl.castShadow = false;
    for (const dx of [-2.2, 2.2]) this.colliders.push({ kind: 'circle', x: g.x + dx, z: g.z, r: 0.45 });
    this.colliders.push({ kind: 'box', x: g.x, z: g.z, hx: 2, hz: 0.25 });
    this.label('월드 1 포털', g.x, 5.6, g.z, 1.1);
  }

  /** 포털 위 최고 기록 (바뀔 때만 다시 그림) */
  setBest(bestStage: number): void {
    const text = bestStage <= 0 ? '최고 기록 없음' : `최고 기록 ${stageLabel(Math.min(bestStage, PER_WORLD))}`;
    if (this.bestLabel?.userData.text === text) return;
    if (this.bestLabel) {
      this.bestLabel.removeFromParent();
      disposeLabel(this.bestLabel);
      this.labels.splice(this.labels.indexOf(this.bestLabel), 1);
    }
    this.bestLabel = this.label(text, PORTAL_GATE.x, 4.7, PORTAL_GATE.z, 0.8);
    this.bestLabel.userData.text = text;
  }

  update(dt: number): void {
    if (this.swirl) this.swirl.rotation.z -= dt * 1.6;
  }

  dispose(): void {
    for (const o of this.owned) o.dispose();
    for (const l of this.labels) disposeLabel(l);
    this.root.removeFromParent();
  }
}

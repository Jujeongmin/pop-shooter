import { t } from '../i18n/i18n';
import * as THREE from 'three';
import { BrickBatch, BRICK_SCALE, type BrickName, type KitModel } from './kit';
import { disposeLabel, makeLabel } from './labels';
import type { Collider } from './movement';
import { BALANCE } from '../sim/balance.ts';
import { stageLabel } from '../sim/stages.ts';
import type { GunModel } from '../sim/guns.ts';
import { buildAltar, buildFountain, buildGunShop, buildRangeBooths, buildTreadmill, buildUpgrade, buildWardrobe, type FountainProps, type TreadmillProps } from './HubFacilities';
import { ToyBuilder } from './HubProps';
import { HUB_BOUNDS, PORTAL_GATE, RANGE_LANES, RANGE_SPOT, RANGE_TARGET, WORLD1_FACILITIES, type Facility } from './facilities';

/** 이 광장 월드의 스테이지 수 (포털 기록은 월드 1 안에서만) */
const PER_WORLD = BALANCE.stage.perWorld;
/** 3D 이름표가 흐려지기 시작·사라지는 카메라 거리(m) */
const LABEL_FAR = 11;
const LABEL_NEAR = 7;

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
  /** 시설 장난감 도형 (간판·외곽선·움직임) */
  private readonly toys = new ToyBuilder();
  private readonly guns: Record<GunModel, THREE.Object3D> | null;
  private clock = 0;
  /** 러닝머신·동전 분수 (Stations가 움직임) */
  treadmill!: TreadmillProps;
  fountain!: FountainProps;

  constructor(kit: Record<BrickName, KitModel>, guns: Record<GunModel, THREE.Object3D> | null = null) {
    this.guns = guns;
    this.root.add(this.toys.root);
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
    const { hx, hz } = HUB_BOUNDS;
    flat(new THREE.BoxGeometry(220, 1, 220), '#8fcf84', -0.5);
    // 울타리 안 광장 바닥 + 길 (스폰 → 포털, 가로 길)
    flat(new THREE.BoxGeometry(hx * 2 + 1, 0.04, hz * 2 + 1), '#a8de98', 0.02);
    flat(new THREE.BoxGeometry(4, 0.05, 20), '#ffe2b0', 0.03, 0, 1);
    flat(new THREE.BoxGeometry(24, 0.05, 3.4), '#ffe2b0', 0.031, 0, 1);
    flat(new THREE.CylinderGeometry(3.6, 3.6, 0.06, 40), '#ffe2b0', 0.032, 0, 6);
  }

  /** 울타리로 둘러싼 광장 + 바깥 집·나무 벽 + 먼 언덕 (빈 들판·지평선이 안 보이게) */
  private buildTown(b: BrickBatch): void {
    const F = HUB_BOUNDS.hx + 0.8;
    // 울타리: 말뚝 + 가로대 (InstancedMesh 둘)
    const postGeo = new THREE.BoxGeometry(0.22, 1.2, 0.22);
    const railGeo = new THREE.BoxGeometry(1, 0.16, 0.08);
    this.owned.push(postGeo, railGeo);
    const posts: THREE.Matrix4[] = [];
    const rails: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const side = (x0: number, z0: number, x1: number, z1: number): void => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.round(len / 1.2);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(z1 - z0, x1 - x0));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        posts.push(new THREE.Matrix4().makeTranslation(x0 + (x1 - x0) * t, 0.6, z0 + (z1 - z0) * t));
      }
      for (const y of [0.45, 0.9]) {
        m.compose(new THREE.Vector3((x0 + x1) / 2, y, (z0 + z1) / 2), q, new THREE.Vector3(len, 1, 1));
        rails.push(m.clone());
      }
    };
    side(-F, -F, F, -F);
    side(F, -F, F, F);
    side(F, F, -F, F);
    side(-F, F, -F, -F);
    for (const [geo, list] of [[postGeo, posts], [railGeo, rails]] as const) {
      const im = new THREE.InstancedMesh(geo, this.mat('#ffffff'), list.length);
      list.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.castShadow = true;
      im.receiveShadow = true;
      this.root.add(im);
    }

    // 바깥 집: 북·동·서 (남쪽은 카메라가 있는 쪽이라 비워 둠)
    const houses: [number, number, string, string][] = [
      [-14, -21, '#ff9ec4', '#7cc4ff'], [-4, -22, '#ffd34d', '#ff8a5b'], [7, -21, '#7cc4ff', '#ffd34d'], [17, -22, '#b9a6ff', '#ff9ec4'],
      [-23, -10, '#7fd78a', '#ff8a5b'], [-23, 1, '#ff8a5b', '#7cc4ff'], [-23, 12, '#ffd34d', '#b9a6ff'],
      [23, -10, '#ff9ec4', '#ffd34d'], [23, 1, '#7cc4ff', '#ff8a5b'], [23, 12, '#7fd78a', '#ff9ec4'],
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
    }

    // 나무: 울타리 바깥을 빽빽하게 (집 사이 틈 메움) + 남쪽은 낮은 덤불
    const trunk = new THREE.CylinderGeometry(0.35, 0.45, 2, 10);
    const leaves = new THREE.SphereGeometry(1.8, 16, 12);
    const bush = new THREE.SphereGeometry(1.1, 14, 10);
    this.owned.push(trunk, leaves, bush);
    const trees: [number, number, number][] = [];
    let seed = 7;
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let x = -26; x <= 26; x += 3.2) {
      trees.push([x + rnd() * 1.2, -18 - rnd() * 1.5, 0.9 + rnd() * 0.5]);
      trees.push([x + rnd() * 1.2, -26 - rnd() * 3, 1.1 + rnd() * 0.5]);
    }
    for (let z = -16; z <= 18; z += 3.2) {
      for (const sx of [-1, 1]) {
        trees.push([sx * (18.5 + rnd() * 1.2), z + rnd(), 0.9 + rnd() * 0.5]);
        trees.push([sx * (28 + rnd() * 3), z + rnd(), 1.1 + rnd() * 0.5]);
      }
    }
    const leafCols = ['#6fcf7a', '#5fc06c', '#82d98a'];
    for (const [x, z, s] of trees) {
      const t = new THREE.Mesh(trunk, this.mat('#c98a5a'));
      t.position.set(x, s, z);
      t.scale.setScalar(s);
      const l = new THREE.Mesh(leaves, this.mat(leafCols[Math.floor(rnd() * 3)]!));
      l.position.set(x, 3.2 * s, z);
      l.scale.setScalar(s);
      t.castShadow = l.castShadow = true;
      this.root.add(t, l);
    }
    for (let x = -16; x <= 16; x += 2.4) {
      const bsh = new THREE.Mesh(bush, this.mat('#6fcf7a'));
      bsh.position.set(x, 0.5, F + 1.4);
      bsh.scale.set(1, 0.7, 1);
      this.root.add(bsh);
    }

    // 먼 언덕: 지평선을 가림 (안개와 섞임)
    const hill = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    this.owned.push(hill);
    const hills: [number, number, number, number][] = [
      [-40, -45, 22, 9], [0, -52, 28, 12], [40, -45, 22, 10], [-60, -10, 20, 8], [60, -10, 20, 9], [-55, 25, 18, 7], [55, 25, 18, 7],
    ];
    for (const [x, z, r, h] of hills) {
      const mh = new THREE.Mesh(hill, this.mat('#7cc47a'));
      mh.position.set(x, -0.2, z);
      mh.scale.set(r, h, r);
      this.root.add(mh);
    }
  }

  /** 사격장: 파란 매트 + 과녁 3개 */
  private buildRange(): void {
    // 줄마다 발판 색 (공격 빨강 / 연사 파랑 / 코인 금색)
    for (const lane of RANGE_LANES) this.mesh(new THREE.BoxGeometry(6, 0.08, 4), lane.mat, lane.x, 0.04, RANGE_SPOT.z).castShadow = false;
    this.mesh(new THREE.BoxGeometry(6, 0.06, 10), '#e8f4ff', RANGE_SPOT.x, 0.03, (RANGE_SPOT.z + RANGE_TARGET.z) / 2 - 1).castShadow = false;
    const post = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8);
    this.owned.push(post);
    // 과녁 1.4배 (사용자 2026-11-11: 훈련장 존재감)
    const discs = [0, 1, 2, 3].map((k) => new THREE.CylinderGeometry((0.7 - k * 0.16) * 1.4, (0.7 - k * 0.16) * 1.4, 0.12 + k * 0.02, 28));
    this.owned.push(...discs);
    for (let i = -1; i <= 1; i++) {
      const lane = RANGE_LANES[0];
      const ringColors = ['#ffffff', lane.color, '#ffffff', lane.color];
      const t = new THREE.Group();
      t.position.set(RANGE_TARGET.x + i * 2, 0, RANGE_TARGET.z);
      const p = new THREE.Mesh(post, this.mat('#c98a5a'));
      // 막대는 과녁판 뒤에 (판 두께 최대 0.18 → 반 0.09 + 막대 반지름 0.08): 앞면을 뚫고 보이지 않게
      p.position.set(0, 0.6, -0.19);
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
    buildRangeBooths(this.toys);
  }

  /** 업그레이드 기계 · 총 상점 · 환생 제단 · 탈의실 (HubFacilities, 장난감 도형) */
  private buildFacilities(): void {
    const f = (id: string): Facility => this.facilities.find((x) => x.id === id)!;
    buildUpgrade(this.toys, f('upgrade'), this.colliders);
    buildGunShop(this.toys, f('guns'), this.colliders, this.guns);
    buildAltar(this.toys, f('altar'), this.colliders);
    buildWardrobe(this.toys, f('chars'), this.colliders);
    this.treadmill = buildTreadmill(this.toys, this.colliders);
    this.fountain = buildFountain(this.toys, this.colliders);
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
  }

  /** 포털 앞(받침 위, 낮게) 이름 + 최고 기록 한 줄. 고리 위는 따라가는 카메라 화면 밖이라 가려짐. 바뀔 때만 다시 그림 */
  setBest(bestStage: number): void {
    const text = `${t('fac.portal', { w: 1 })} · ${bestStage <= 0 ? t('portal.first') : t('portal.best', { s: stageLabel(Math.min(bestStage, PER_WORLD)) })}`;
    if (this.bestLabel?.userData.text === text) return;
    if (this.bestLabel) {
      this.bestLabel.removeFromParent();
      disposeLabel(this.bestLabel);
      this.labels.splice(this.labels.indexOf(this.bestLabel), 1);
    }
    this.bestLabel = this.label(text, PORTAL_GATE.x, 0.9, PORTAL_GATE.z + 1.6, 0.75);
    this.bestLabel.userData.text = text;
  }

  update(dt: number, camPos?: THREE.Vector3): void {
    if (this.swirl) this.swirl.rotation.z -= dt * 1.6;
    this.clock += dt;
    this.toys.update(dt, this.clock);
    // 3D 이름표: 카메라에 가까우면 흐리게 (가까이서 화면을 꽉 채우지 않게). LABEL_NEAR 안은 안 보임, LABEL_FAR 밖은 그대로
    if (!camPos) return;
    for (const l of this.labels) {
      const d = l.position.distanceTo(camPos);
      const a = Math.min(1, Math.max(0, (d - LABEL_NEAR) / (LABEL_FAR - LABEL_NEAR)));
      l.material.opacity = a;
      l.visible = a > 0.01;
    }
  }

  dispose(): void {
    for (const o of this.owned) o.dispose();
    for (const l of this.labels) disposeLabel(l);
    this.toys.dispose();
    this.root.removeFromParent();
  }
}

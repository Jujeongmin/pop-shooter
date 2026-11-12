import { t } from '../i18n/i18n';
import * as THREE from 'three';
import { type BrickName, type KitModel } from './kit';
import { HubDecor } from './HubDecor';
import { themeOf } from './worldThemes';
import { disposeLabel, makeLabel } from './labels';
import type { Collider } from './movement';
import { BALANCE } from '../sim/balance.ts';
import { stageLabel } from '../sim/stages.ts';
import type { GunModel } from '../sim/guns.ts';
import { buildAltar, buildFountain, buildGunShop, buildRangeBooths, buildTravel, buildTreadmill, buildUpgrade, buildWardrobe, type FountainProps, type TreadmillProps } from './HubFacilities';
import { ToyBuilder } from './HubProps';
import { HUB_BOUNDS, PORTAL_GATE, RANGE_LANES, RANGE_SPOT, RANGE_TARGET, WORLD1_FACILITIES, type Facility } from './facilities';

/** 월드 하나의 스테이지 수 (포털 기록은 이 광장 월드 안에서만) */
const PER_WORLD = BALANCE.stage.perWorld;
/** 3D 이름표가 흐려지기 시작·사라지는 카메라 거리(m) */
const LABEL_FAR = 11;
const LABEL_NEAR = 7;

/**
 * 월드 광장: 시설(사격장·러닝머신·동전 분수·상점·제단·탈의실·포털·월드 이동)은 모든 월드가 같은 자리,
 * 바닥·울타리·바깥 꾸미기는 월드마다 다름 (HubDecor, setWorld로 바꿈. 사용자 2026-11-12: 월드마다 광장 따로).
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

  /** 지금 광장 월드 (1~8) */
  world = 1;
  private decor: HubDecor;
  private readonly kit: Record<BrickName, KitModel>;
  private best = 0;

  constructor(kit: Record<BrickName, KitModel>, guns: Record<GunModel, THREE.Object3D> | null = null, world = 1) {
    this.guns = guns;
    this.kit = kit;
    this.world = world;
    this.decor = new HubDecor(themeOf(world), kit);
    this.root.add(this.decor.root);
    this.root.add(this.toys.root);
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
    buildTravel(this.toys, f('travel'), this.colliders);
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

  /**
   * 광장 월드 바꾸기: 바깥 꾸미기만 새로 (이전 것은 해제). 반환 = 해제된 꾸미기 root (가림 투명 대상에서 빼라고)
   */
  setWorld(world: number): THREE.Object3D | null {
    if (world === this.world) return null;
    const old = this.decor;
    this.world = world;
    this.decor = new HubDecor(themeOf(world), this.kit);
    this.root.add(this.decor.root);
    old.dispose();
    this.setBest(this.best);
    return old.root;
  }

  /** 포털 앞(받침 위, 낮게) 이 월드 이름 + 이 월드 안 최고 기록 한 줄. 고리 위는 따라가는 카메라 화면 밖이라 가려짐. 바뀔 때만 다시 그림 */
  setBest(bestStage: number): void {
    this.best = bestStage;
    const first = (this.world - 1) * PER_WORLD;
    const inWorld = Math.min(bestStage, first + PER_WORLD);
    const text = `${t('fac.portal', { w: this.world })} · ${inWorld <= first ? t('portal.first') : t('portal.best', { s: stageLabel(inWorld) })}`;
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
    this.decor.dispose();
    this.root.removeFromParent();
  }
}

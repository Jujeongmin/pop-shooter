import * as THREE from 'three';
import { ZoneRing } from '../fx/ZoneRing';
import type { CalloutText, ZoneCallout } from '../ui/ZoneCallout';
import type { Facility } from '../world/facilities';
import type { Game } from './Game';

/** 들어오면 자리로 폴짝 빨려 들어가는 시간·높이 (착지 클립은 공중 0.28초 넘어야 나옴) */
const SNAP_SEC = 0.38;
const SNAP_HOP = 0.9;
/** 착지 클립(landHold 0.3초)이 끝날 때까지 이동 잠금 */
const LAND_LOCK = 0.35;

export interface ZoneEntryOptions {
  /** 바닥 링 색 */
  color: string;
  /** 착지 때 화면 가장자리 번쩍 색 */
  flash: string;
  /** 폴짝 뛰어 내려앉을 자리 (없으면 구역 중심) */
  spot?: { x: number; z: number };
  /** 카메라: focus(1 = 당김, 음수 = 뒤로), lookUp(음수면 캐릭터가 화면 위쪽에: 아래 창이 가리지 않게) */
  cam?: { focus: number; lookUp: number };
  /** 착지 뒤 바라볼 곳 */
  face: { x: number; z: number };
  /** 착지 때 가운데 문구 (함수면 착지 순간 값으로, null이면 문구 없음: 창이 뜨는 시설) */
  text: CalloutText | (() => CalloutText) | null;
}

/**
 * 시설 구역 '잡히는' 연출 공통: 바닥 링(숨쉬기) → 들어오면 자리로 폴짝(점프·공중 클립) → 착지 클립 + 링 튕김 + 화면 번쩍 + 흔들림 + 문구.
 * 나가면 반대로 꺼짐. 시설은 onLanded / onLeave에 자기 동작만 붙임.
 * 링은 이 객체 소유 (dispose에서 해제).
 */
export class ZoneEntry {
  private readonly game: Game;
  private readonly callout: ZoneCallout;
  private readonly ring: ZoneRing;
  private readonly opt: ZoneEntryOptions;
  private readonly spot: { x: number; z: number };
  private snapT = -1;
  private readonly from = new THREE.Vector3();
  inside = false;
  onLanded: (() => void) | null = null;
  onLeave: (() => void) | null = null;

  constructor(game: Game, callout: ZoneCallout, zone: Facility, opt: ZoneEntryOptions) {
    this.game = game;
    this.callout = callout;
    this.opt = opt;
    this.spot = opt.spot ?? { x: zone.x, z: zone.z };
    this.ring = new ZoneRing(zone.x, zone.z, zone.radius, opt.color);
    // 광장에 붙여서 전투 중 광장을 숨기면 같이 숨음
    game.hub.root.add(this.ring.root);
  }

  /** 폴짝 중이면 true (시설은 이동안 자기 동작을 쉼) */
  get snapping(): boolean {
    return this.snapT >= 0;
  }

  enter(): void {
    if (this.inside) return;
    this.inside = true;
    this.ring.setInside(true);
    this.game.cam.focus = this.opt.cam?.focus ?? 1;
    this.game.cam.lookUp = this.opt.cam?.lookUp ?? 0;
    this.from.copy(this.game.pos);
    this.snapT = 0;
    this.game.moveLock = SNAP_SEC + LAND_LOCK;
  }

  leave(): void {
    if (!this.inside) return;
    this.inside = false;
    const g = this.game;
    g.pose.grounded = true;
    g.pos.y = 0;
    this.snapT = -1;
    this.ring.setInside(false);
    g.cam.focus = 0;
    g.cam.lookUp = 0;
    this.callout.hide();
    this.onLeave?.();
  }

  /** 문구만 바꾸기 (예: 도전 결과 뒤) */
  setText(t: CalloutText): void {
    if (this.inside && !this.snapping) this.callout.show(t);
  }

  update(dt: number): void {
    this.ring.update(dt);
    if (this.snapT < 0) return;
    const g = this.game;
    this.snapT += dt;
    const k = Math.min(1, this.snapT / SNAP_SEC);
    const e = 1 - (1 - k) ** 3;
    g.pos.x = this.from.x + (this.spot.x - this.from.x) * e;
    g.pos.z = this.from.z + (this.spot.z - this.from.z) * e;
    g.pos.y = Math.sin(Math.PI * k) * SNAP_HOP;
    g.yaw = Math.atan2(this.opt.face.x - g.pos.x, this.opt.face.z - g.pos.z);
    g.pose.grounded = false;
    if (k < 1) return;
    this.snapT = -1;
    g.pos.y = 0;
    g.pose.grounded = true;
    this.ring.burst();
    g.cam.shake(0.08);
    this.callout.flash(this.opt.flash);
    const t = this.opt.text;
    if (t) this.callout.show(typeof t === 'function' ? t() : t);
    this.onLanded?.();
  }

  dispose(): void {
    this.ring.dispose();
  }
}

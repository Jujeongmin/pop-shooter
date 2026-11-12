// 광장의 다른 플레이어 그리기: LobbyHub가 준 보간 버퍼 → 아바타(캐릭터 + 든 총) 위치·자세 + 머리 위 이름표.
// pop-battle src/net/LobbyPeers.ts를 복사해 고침 (2026-11-11): 이 게임 Avatar(player/Avatar.ts) 재사용, 이름표는 3D 글자 스프라이트(캔버스 텍스처).
// 충돌 없음: 나·서로를 밀거나 막지 않고 겹쳐도 됨 (사용자 2026-11-11). 이동 콜라이더에 넣지 않음.
// 이름표 = 닉네임 / 공격력 (환생 횟수는 넣지 않음, 사용자 2026-11-11). 계정 id는 절대 화면에 내지 않음 (닉네임 없으면 '플레이어').
// 상태: 훈련 중이면 사격장 과녁을 쏘는 연출(전용 HitFx 풀, 고정 개수), 전투 중이면 포털 앞에 서 있고 이름표에 '전투 중'.
// 모두 광장 root 아래 → 내가 전투 중이면 광장과 함께 숨음 (그동안은 갱신도 건너뜀).
//
// 리소스 (메모리 체크리스트):
// - 아바타: Avatar가 SkeletonUtils.clone → 나갈 때 avatar.dispose() (skeleton.dispose·복제 재질 해제). 캐릭터 geometry·texture는 GLB 원본 공유 → 해제 안 함
// - 이름표: 사람마다 캔버스 텍스처 + SpriteMaterial 소유 → 글자가 바뀔 때만 다시 만들고 이전 것은 해제, 나갈 때 해제. Sprite geometry는 three 공용
// - 발사 연출: LobbyPeers 하나당 HitFx 하나 (풀 고정, dispose에서 해제). 매 발사·매 프레임 새 재질 없음
// - 매 프레임 할당 없음: 사람마다 Vector3·자세 객체·보간 결과를 미리 만들어 재사용
import * as THREE from 'three';
import type { Assets } from '../assets/loadAssets';
import { HitFx } from '../fx/HitFx';
import { fontFamily, t } from '../i18n/i18n';
import { Avatar, type AvatarPose } from '../player/Avatar';
import { formatNum } from '../sim/format.ts';
import { GUNS } from '../sim/guns.ts';
import type { CharId } from '../sim/state.ts';
import type { HubSample } from './hubBuffer';
import type { HubPeer } from './LobbyHub';
import { battleSpot } from './peerView';
import { PowerAura } from '../player/PowerAura';
import { HUB_TIMING } from './shared/hub.ts';
import { NICK_PLACEHOLDER, safeDisplayNick } from './shared/nickFilter.ts';

export interface LobbyPeersContext {
  readonly assets: Assets;
  /** 붙일 곳 (광장 root) */
  readonly parent: THREE.Object3D;
  /** 사격장 과녁 (훈련 중인 사람이 겨눔) */
  readonly targets: readonly THREE.Object3D[];
}

interface Item {
  peer: HubPeer;
  avatar: Avatar;
  char: CharId;
  gun: number;
  /** 머리 위 이름표 (나가면 null) */
  label: THREE.Sprite | null;
  labelText: string;
  readonly pose: AvatarPose & { pos: THREE.Vector3; velocity: THREE.Vector3 };
  readonly aim: THREE.Vector3;
  readonly s: HubSample;
  /** 훈련 연출: 다음 발사까지 (초), 겨누는 과녁, 반동 */
  fireT: number;
  target: number;
  kick: number;
  /** DPS 오라 (광장 root 아래) */
  aura: PowerAura;
}

/** 남의 훈련 발사 연출 빈도 (초당, 실제 발사 속도와 무관한 고정값 — 가볍게) */
const PEER_SHOTS_PER_SEC = 2.5;
/** 이름표: 머리 위 높이(m), 판 높이(m) — 작게 (사용자 2026-11-11) */
const LABEL_LIFT = 0.3;
const LABEL_HEIGHT = 0.4;
/** 안 받은 글자 묶음(한글 웹폰트 unicode-range)을 기다리는 최대 시간 (ms). 넘으면 지금 글꼴 그대로 */
const GLYPH_WAIT_MS = 2500;

const _muzzle = new THREE.Vector3();
const _hit = new THREE.Vector3();
const _spot = { x: 0, z: 0, yaw: 0 };

/** 화면 닉네임: 규칙 통과한 이름, 없거나 예전 규칙 위반 이름이면 '플레이어' (계정 id는 쓰지 않음) */
export function peerName(nick: string): string {
  const n = safeDisplayNick(nick);
  return !n || n === NICK_PLACEHOLDER ? t('peer.player') : n;
}

/** 이름표 둘째 줄: 공격력 (· 전투 중) */
export function peerStats(peer: Pick<HubPeer, 'power' | 'status'>): string {
  const atk = t('peer.atk', { n: formatNum(peer.power) });
  return peer.status === 'battle' ? `${atk} · ${t('peer.battle')}` : atk;
}

/** 이 글자들이 이름표 글꼴로 이미 받아져 있는지 (아니면 캔버스가 다른 글꼴로 구움) */
function glyphsReady(text: string): boolean {
  try {
    return document.fonts.check(`56px ${fontFamily}`, text);
  } catch {
    return true;
  }
}

/** 글자 묶음 받기 (시간 제한). 끝나면 resolve (실패해도) */
function loadGlyphs(text: string): Promise<void> {
  let id = 0;
  return Promise.race([
    document.fonts.load(`56px ${fontFamily}`, text).then(() => undefined, () => undefined),
    new Promise<void>((r) => { id = window.setTimeout(r, GLYPH_WAIT_MS); }),
  ]).finally(() => clearTimeout(id));
}

/** 두 줄 이름표 스프라이트 (캔버스 텍스처 소유 → disposePlate) */
function makePlate(name: string, stats: string, battle: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const f1 = `bold 56px ${fontFamily}`;
  const f2 = `bold 40px ${fontFamily}`;
  ctx.font = f1;
  const w1 = ctx.measureText(name).width;
  ctx.font = f2;
  const w2 = ctx.measureText(stats).width;
  const w = Math.ceil(Math.max(w1, w2)) + 56;
  const h = 132;
  canvas.width = w;
  canvas.height = h;
  ctx.fillStyle = battle ? 'rgba(255, 214, 160, 0.94)' : 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, 34);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = f1;
  ctx.fillStyle = '#2b3a67';
  ctx.fillText(name, w / 2, 44);
  ctx.font = f2;
  ctx.fillStyle = battle ? '#b4441c' : '#5b6aa0';
  ctx.fillText(stats, w / 2, 98);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set((w / h) * LABEL_HEIGHT, LABEL_HEIGHT, 1);
  sprite.renderOrder = 5;
  return sprite;
}

function disposePlate(s: THREE.Sprite): void {
  s.removeFromParent();
  s.material.map?.dispose();
  s.material.dispose();
}

export class LobbyPeers {
  private readonly items = new Map<string, Item>();
  /** 매 프레임 순회용 (items와 같은 내용) */
  private readonly list: Item[] = [];
  /** 남의 발사 연출 전용 (내 훈련 연출 풀을 빼앗지 않게). 광장 root 아래 */
  private readonly fx: HitFx;
  private disposed = false;

  private readonly ctx: LobbyPeersContext;

  constructor(ctx: LobbyPeersContext) {
    this.ctx = ctx;
    this.fx = new HitFx(ctx.parent);
  }

  get size(): number {
    return this.items.size;
  }

  add(peer: HubPeer): void {
    if (this.disposed || this.items.has(peer.account)) return;
    const char = peer.char as CharId;
    const avatar = this.makeAvatar(char, peer.gun);
    const item: Item = {
      peer,
      avatar,
      char,
      gun: peer.gun,
      label: null,
      labelText: '',
      pose: { pos: new THREE.Vector3(), yaw: 0, velocity: new THREE.Vector3(), aimAt: null, kick: 0 },
      aim: new THREE.Vector3(),
      s: { x: 0, z: 0, yaw: 0, vx: 0, vz: 0, f: 0 },
      fireT: Math.random() / PEER_SHOTS_PER_SEC,
      target: Math.floor(Math.random() * 3),
      kick: 0,
      aura: new PowerAura(),
    };
    item.aura.setPower(peer.power);
    this.ctx.parent.add(item.aura.root);
    this.items.set(peer.account, item);
    this.list.push(item);
    this.setPlate(item);
  }

  /** 닉네임·캐릭터·총·환생·공격력·상태 변경 */
  change(peer: HubPeer): void {
    const item = this.items.get(peer.account);
    if (!item) return;
    item.peer = peer;
    item.aura.setPower(peer.power);
    const char = peer.char as CharId;
    if (char !== item.char) {
      this.releaseAvatar(item.avatar);
      item.avatar = this.makeAvatar(char, peer.gun);
      item.char = char;
      item.gun = peer.gun;
    } else if (peer.gun !== item.gun) {
      item.avatar.setGun(GUNS[peer.gun] ?? GUNS[0]!);
      item.gun = peer.gun;
    }
    this.setPlate(item);
  }

  remove(account: string): void {
    const item = this.items.get(account);
    if (!item) return;
    this.items.delete(account);
    const i = this.list.indexOf(item);
    if (i >= 0) this.list.splice(i, 1);
    this.releaseAvatar(item.avatar);
    item.aura.dispose();
    if (item.label) disposePlate(item.label);
    item.label = null;
  }

  clear(): void {
    for (const acc of [...this.items.keys()]) this.remove(acc);
  }

  /** 보간 지연만큼 늦은 시점의 상태로 위치·자세·이름표. 광장이 숨어 있으면(내가 전투 중) 건너뜀 */
  update(dt: number): void {
    if (!this.ctx.parent.visible) return;
    this.fx.update(dt);
    if (this.items.size === 0) return;
    const renderTime = performance.now() - HUB_TIMING.interpDelayMs;
    const targets = this.ctx.targets;
    // 고정 배열 index 순회 (매 프레임 반복자 객체 없음)
    const list = this.list;
    for (let li = 0; li < list.length; li++) {
      const item = list[li]!;
      const label = item.label;
      if (!label) continue;
      const p = item.pose;
      const s = item.s;
      const status = item.peer.status;
      p.aimAt = null;
      if (status === 'battle') {
        battleSpot(item.peer.account, _spot);
        p.pos.set(_spot.x, 0, _spot.z);
        p.velocity.set(0, 0, 0);
        p.yaw = _spot.yaw;
      } else {
        if (!item.peer.buffer.sample(renderTime, s)) {
          item.avatar.root.visible = false;
          item.aura.root.visible = false;
          label.visible = false;
          continue;
        }
        p.pos.set(s.x, 0, s.z);
        p.velocity.set(s.vx, 0, s.vz);
        p.yaw = s.yaw;
      }
      item.avatar.root.visible = true;
      label.visible = true;
      // 훈련 중 + 서 있음(비트 2): 과녁을 돌아가며 쏘는 연출
      const firing = status === 'training' && (s.f & 2) !== 0 && s.vx * s.vx + s.vz * s.vz < 0.04 && targets.length > 0;
      if (firing) {
        const tg = targets[item.target % targets.length]!;
        item.aim.set(tg.position.x, 1.6, tg.position.z);
        p.aimAt = item.aim;
        p.yaw = Math.atan2(tg.position.x - p.pos.x, tg.position.z - p.pos.z);
        item.fireT -= dt;
        if (item.fireT <= 0) {
          item.fireT += (0.8 + Math.random() * 0.4) / PEER_SHOTS_PER_SEC;
          if (item.fireT < 0) item.fireT = 0;
          item.kick = 0.06;
          item.avatar.getMuzzle(_muzzle);
          _hit.set(tg.position.x + (Math.random() - 0.5) * 0.4, 1.6 + (Math.random() - 0.5) * 0.4, tg.position.z + 0.12);
          this.fx.shot(_muzzle, _hit);
          item.target = (item.target + 1) % targets.length;
        }
      }
      item.kick = Math.max(0, item.kick - dt * 0.6);
      p.kick = item.kick;
      item.avatar.update(dt, p);
      item.aura.root.visible = true;
      item.aura.update(dt, p.pos.x, 0, p.pos.z);
      label.position.set(p.pos.x, item.avatar.headTop() + LABEL_LIFT, p.pos.z);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.clear();
    this.fx.dispose();
  }

  /**
   * 이름표를 지금 값으로 (글자가 바뀔 때만 다시 만들고 이전 것 해제). 글꼴에 안 받은 글자(한글 웹폰트 글자 묶음)가 있으면
   * 일단 지금 글꼴로 그리고, 글자 묶음을 받은 뒤 같은 글자면 다시 그림 (기본 글꼴로 구워진 채 남지 않게)
   */
  private setPlate(item: Item, force = false): void {
    const name = peerName(item.peer.nick);
    const stats = peerStats(item.peer);
    const key = `${name}\n${stats}`;
    if (!force && key === item.labelText && item.label) return;
    const old = item.label;
    const sprite = makePlate(name, stats, item.peer.status === 'battle');
    if (old) {
      sprite.position.copy(old.position);
      sprite.visible = old.visible;
      disposePlate(old);
    } else sprite.visible = false;
    item.label = sprite;
    item.labelText = key;
    this.ctx.parent.add(sprite);
    if (force || glyphsReady(key)) return;
    void loadGlyphs(key).then(() => {
      // 그사이 나갔거나 글자가 바뀌었으면 그쪽이 이미 다시 그림
      if (this.disposed || this.items.get(item.peer.account) !== item || item.labelText !== key) return;
      this.setPlate(item, true);
    });
  }

  private makeAvatar(char: CharId, gun: number): Avatar {
    const a = new Avatar(this.ctx.assets, char, GUNS[gun] ?? GUNS[0]!);
    this.ctx.parent.add(a.root);
    return a;
  }

  private releaseAvatar(a: Avatar): void {
    a.root.removeFromParent();
    a.dispose();
  }
}

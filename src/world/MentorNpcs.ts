import * as THREE from 'three';
import type { Game } from '../core/Game';
import { t, type StrKey } from '../i18n/i18n';
import { Avatar } from '../player/Avatar';
import { GUNS } from '../sim/guns.ts';
import { stageLabel } from '../sim/stages.ts';
import type { CharId } from '../sim/state.ts';
import { BALANCE } from '../sim/balance.ts';
import { MENTORS } from '../sim/training.ts';
import { disposeLabel, makeLabel } from './labels';

/** 멘토 = 팝배틀 로비 NPC 4명 그대로 (사용자 2026-11-11) */
export const MENTOR_CHAR: Record<string, CharId> = { coach: 'yellow', sniper: 'pink', captain: 'red', legend: 'white' };
/** 멘토 자리: 업그레이드 기계 동쪽, 울타리 앞에 한 줄 (서쪽 광장을 봄) */
const SPOTS: readonly { x: number; z: number }[] = [{ x: 13, z: -6 }, { x: 13, z: -3 }, { x: 13, z: 0 }, { x: 13, z: 3 }];
const FACE_YAW = -Math.PI / 2;
const TALK_DIST = 3.2;
const ZERO = new THREE.Vector3();

interface Npc {
  id: string;
  avatar: Avatar;
  pos: THREE.Vector3;
  yaw: number;
  joined: boolean;
  name: THREE.Sprite;
  /** 합류 전 조건 ("1-10 클리어로 영입"), 합류하면 없음 */
  need: THREE.Sprite | null;
  bubble: THREE.Sprite | null;
  bubbleKey: string;
}

/**
 * 광장 멘토 NPC: 합류 전 = 회색 반투명 + "{st} 클리어로 영입", 합류 = 원래 색·대기 동작·이름표,
 * 가까이 가면 나를 바라보고 말풍선(훈련 팁 + 모든 훈련 ×배율). 기록이 올라 새로 합류하면 아바타를 다시 만들어 색을 입힘.
 * 소유: 아바타 4개(dispose), 이름표·말풍선 텍스처. 충돌 원은 hub.colliders에 추가.
 */
export class MentorNpcs {
  private readonly game: Game;
  private readonly npcs: Npc[] = [];
  private readonly group = new THREE.Group();

  constructor(game: Game) {
    this.game = game;
    MENTORS.forEach((m, i) => {
      const at = SPOTS[i]!;
      const pos = new THREE.Vector3(at.x, 0, at.z);
      const joined = game.state.bestStage >= m.needStage;
      const npc: Npc = { id: m.id, avatar: this.makeAvatar(m.id, joined), pos, yaw: FACE_YAW, joined, name: this.nameLabel(m.id), need: null, bubble: null, bubbleKey: '' };
      this.placeLabels(npc, m.needStage);
      this.npcs.push(npc);
      game.hub.colliders.push({ kind: 'circle', x: at.x, z: at.z, r: 0.45 });
    });
    game.hub.root.add(this.group);
    game.onTick((dt) => this.update(dt));
    game.onStateChange((s) => {
      MENTORS.forEach((m, i) => {
        const n = this.npcs[i]!;
        if (n.joined || s.bestStage < m.needStage) return;
        this.rebuild(n, true, m.needStage);
      });
    });
  }

  private makeAvatar(id: string, joined: boolean): Avatar {
    const a = new Avatar(this.game.assets, MENTOR_CHAR[id] ?? 'yellow', GUNS[0]!);
    if (!joined) {
      // 합류 전: 회색 반투명 (재질은 이 아바타가 복제한 것이라 바꿔도 다른 캐릭터에 영향 없음)
      a.root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const sm = m as THREE.MeshStandardMaterial;
          sm.transparent = true;
          sm.opacity = 0.45;
          if (sm.color) sm.color.lerp(new THREE.Color('#9aa3bd'), 0.75);
          sm.depthWrite = false;
        }
      });
    }
    return a;
  }

  private nameLabel(id: string): THREE.Sprite {
    return makeLabel(t(`mentor.${id}` as StrKey), { size: 0.34 });
  }

  /** 이름표(머리 위) + 합류 전이면 조건 한 줄 (이름표 아래, 회색) */
  private placeLabels(n: Npc, needStage: number): void {
    n.name.position.set(n.pos.x, 1.95, n.pos.z);
    this.group.add(n.avatar.root, n.name);
    if (n.joined) return;
    n.need = makeLabel(t('mentor.need', { st: stageLabel(needStage) }), { size: 0.26, bg: 'rgba(220,226,240,0.92)', color: '#5d6a92' });
    n.need.position.set(n.pos.x, 1.66, n.pos.z);
    this.group.add(n.need);
  }

  private rebuild(n: Npc, joined: boolean, need: number): void {
    n.avatar.root.removeFromParent();
    n.avatar.dispose();
    n.avatar = this.makeAvatar(n.id, joined);
    n.joined = joined;
    if (n.need) { n.need.removeFromParent(); disposeLabel(n.need); n.need = null; }
    n.name.removeFromParent();
    this.placeLabels(n, need);
  }

  private update(dt: number): void {
    const g = this.game;
    if (g.mode === 'battle') return;
    for (const n of this.npcs) {
      const dx = g.pos.x - n.pos.x;
      const dz = g.pos.z - n.pos.z;
      const near = n.joined && dx * dx + dz * dz < TALK_DIST * TALK_DIST;
      // 가까이 오면 나를 봄, 멀어지면 원래 방향으로 천천히
      const want = near ? Math.atan2(dx, dz) : FACE_YAW;
      let d = want - n.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      n.yaw += d * Math.min(1, dt * 5);
      n.avatar.update(dt, { pos: n.pos, yaw: n.yaw, velocity: ZERO, aimAt: null, kick: 0 });
      this.setBubble(n, near);
    }
  }

  private setBubble(n: Npc, on: boolean): void {
    const key = on ? n.id : '';
    if (key === n.bubbleKey) return;
    n.bubbleKey = key;
    if (n.bubble) { n.bubble.removeFromParent(); disposeLabel(n.bubble); n.bubble = null; }
    if (!on) return;
    n.bubble = makeLabel(`${t(`mentor.tip.${n.id}` as StrKey)}  (${t('mentor.desc', { m: BALANCE.train.mentorMult })})`, { size: 0.36 });
    n.bubble.position.set(n.pos.x, 2.45, n.pos.z);
    this.group.add(n.bubble);
  }

  dispose(): void {
    for (const n of this.npcs) {
      n.avatar.dispose();
      disposeLabel(n.name);
      if (n.need) disposeLabel(n.need);
      if (n.bubble) disposeLabel(n.bubble);
    }
    this.group.removeFromParent();
  }
}

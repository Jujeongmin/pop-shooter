import * as THREE from 'three';
import { CHARACTERS } from '../config/characters';
import { gearTiers } from '../core/Game';
import { Avatar } from '../player/Avatar';
import { GUNS } from '../sim/guns.ts';
import { CHAR_TURNTABLE } from '../world/HubFacilities';
import type { Game } from '../core/Game';
import { ZoneEntry } from '../core/ZoneEntry';
import { WORLD1_FACILITIES } from '../world/facilities';
import type { ZoneCallout } from './ZoneCallout';
import { t } from '../i18n/i18n';
import { charMult, ownedCharMult } from '../sim/actions.ts';
import { stageLabel } from '../sim/stages.ts';
import { CHAR_IDS, type CharId } from '../sim/state.ts';
import { bakeCharIcons } from './charIcons';
import { button, el } from './dom';
import { icon } from './icons';
import { Panel } from './Panel';

const ZERO = new THREE.Vector3();

/** 잠긴 캐릭터 해금 조건: 월드 1~3 대장 첫 클리어 (sim BOSS_UNLOCKS와 같은 순서), 나머지는 상점 */
const UNLOCK: Partial<Record<CharId, number>> = { yellow: 10, red: 20, pink: 30 };

/** 캐릭터 발판: 올라가면 폴짝 + 아래 창 (6명 초상 + 사용 중 / 고르기 / 잠김 조건), 내려오면 닫힘 */
export class CharacterPanel {
  private readonly game: Game;
  private readonly panel: Panel;
  private thumbs: Record<CharId, string> | null = null;
  private readonly zone: ZoneEntry;
  /** 탈의실 받침대 위에서 도는 지금 캐릭터 (캐릭터·총이 바뀌면 다시 만듦) */
  private display: Avatar | null = null;
  private displayKey = '';
  private displayYaw = 0;
  private displayGear = -1;
  private readonly displayPos = new THREE.Vector3(CHAR_TURNTABLE.x, 0.24, CHAR_TURNTABLE.z);

  constructor(game: Game, ui: HTMLElement, callout: ZoneCallout) {
    this.game = game;
    this.panel = new Panel(ui, t('char.title'), 'chars');
    const f = WORLD1_FACILITIES.find((x) => x.id === 'chars')!;
    this.zone = new ZoneEntry(game, callout, f, {
      color: '#ffd34d',
      flash: 'rgba(255, 211, 77, 0.85)',
      spot: { x: f.x, z: f.z },
      face: { x: f.x, z: f.z - 3 },
      cam: { focus: -0.4, lookUp: -1.4 },
      text: null,
    });
    this.zone.onLanded = () => { this.render(); this.panel.open(); };
    game.facilityActions.chars = () => this.zone.enter();
    game.facilityLeave.chars = () => { this.zone.leave(); this.panel.close(); };
    game.onTick((dt) => {
      this.zone.update(dt);
      this.updateDisplay(dt);
    });
  }

  private updateDisplay(dt: number): void {
    const g = this.game;
    const key = `${g.state.char}:${g.state.gun}`;
    // 그 캐릭터를 아직 안 받았으면 받는 동안 예전 모습 그대로 (처음이면 받은 캐릭터로)
    const ready = !!g.assets.characters[g.state.char];
    if (!ready) void g.assets.char(g.state.char).catch(() => undefined);
    if (key !== this.displayKey && (ready || !this.display)) {
      if (ready) this.displayKey = key;
      this.display?.root.removeFromParent();
      this.display?.dispose();
      this.display = new Avatar(g.assets, g.state.char, GUNS[g.state.gun]!);
      g.hub.root.add(this.display.root);
      this.displayGear = -1;
    }
    const d = this.display!;
    if (g.mode === 'battle') return;
    // 장비가 바뀔 때만 다시 붙임 (매 프레임 setGear는 행렬 갱신이 들어 비쌈)
    if (g.state.gear !== this.displayGear) { this.displayGear = g.state.gear; d.setGear(gearTiers(g.state)); }
    // 진열 캐릭터도 멀면 가벼운 몸 (다른 사람·멘토와 같은 14m)
    const dx = g.pos.x - this.displayPos.x, dz = g.pos.z - this.displayPos.z;
    d.setDetail(dx * dx + dz * dz < 14 * 14);
    this.displayYaw += dt * 0.8;
    d.update(dt, { pos: this.displayPos, yaw: this.displayYaw, velocity: ZERO, aimAt: null, kick: 0 });
  }

  private render(): void {
    const s = this.game.state;
    this.thumbs ??= bakeCharIcons();
    // 보유 효과 합계 (사용자 2026-11-12: 가진 캐릭터마다 피해 보너스가 더해짐, 장착은 외형만)
    const total = el('div', 'up-hint', t('char.owned', { m: Number(ownedCharMult(s).toFixed(2)) }));
    const grid = el('div', 'char-grid');
    for (const id of CHAR_IDS) {
      const owned = s.chars.includes(id);
      const card = el('div', `char-card${id === s.char ? ' on' : ''}${owned ? '' : ' locked'}`);
      const img = el('img', 'char-img');
      img.src = this.thumbs[id];
      img.alt = '';
      img.draggable = false;
      card.append(img, el('div', 'char-name', CHARACTERS[id].name), el('div', 'char-power', id === 'blue' ? t('char.powerBase') : t('char.power', { m: Math.round((charMult(id) - 1) * 100) })));
      if (id === s.char) {
        const tag = el('span', 'tag eq');
        tag.append(icon('check'), el('span', '', t('char.using')));
        card.append(tag);
      } else if (owned) {
        card.append(button(t('char.pick'), () => { this.game.setChar(id); this.render(); }, 'btn small'));
      } else {
        const tag = el('span', 'tag');
        const need = UNLOCK[id];
        tag.append(icon('lock'), el('span', '', need ? t('char.unlockWorld', { s: stageLabel(need) }) : t('char.shop')));
        card.append(tag);
      }
      grid.append(card);
    }
    this.panel.body.replaceChildren(total, grid);
  }
}

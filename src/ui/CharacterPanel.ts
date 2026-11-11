import { CHARACTERS } from '../config/characters';
import type { Game } from '../core/Game';
import { ZoneEntry } from '../core/ZoneEntry';
import { WORLD1_FACILITIES } from '../world/facilities';
import type { ZoneCallout } from './ZoneCallout';
import { t } from '../i18n/i18n';
import { charMult } from '../sim/actions.ts';
import { stageLabel } from '../sim/stages.ts';
import { CHAR_IDS, type CharId } from '../sim/state.ts';
import { bakeCharIcons } from './charIcons';
import { button, el } from './dom';
import { icon } from './icons';
import { Panel } from './Panel';

/** 잠긴 캐릭터 해금 조건: 월드 1~3 대장 첫 클리어 (sim BOSS_UNLOCKS와 같은 순서), 나머지는 상점 */
const UNLOCK: Partial<Record<CharId, number>> = { yellow: 10, red: 20, pink: 30 };

/** 캐릭터 발판: 올라가면 폴짝 + 아래 창 (6명 초상 + 사용 중 / 고르기 / 잠김 조건), 내려오면 닫힘 */
export class CharacterPanel {
  private readonly game: Game;
  private readonly panel: Panel;
  private thumbs: Record<CharId, string> | null = null;
  private readonly zone: ZoneEntry;

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
    game.onTick((dt) => this.zone.update(dt));
  }

  private render(): void {
    const s = this.game.state;
    this.thumbs ??= bakeCharIcons(this.game.assets);
    const grid = el('div', 'char-grid');
    for (const id of CHAR_IDS) {
      const owned = s.chars.includes(id);
      const card = el('div', `char-card${id === s.char ? ' on' : ''}${owned ? '' : ' locked'}`);
      const img = el('img', 'char-img');
      img.src = this.thumbs[id];
      img.alt = '';
      img.draggable = false;
      card.append(img, el('div', 'char-name', CHARACTERS[id].name), el('div', 'char-power', t('char.power', { m: charMult(id) })));
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
    this.panel.body.replaceChildren(grid);
  }
}

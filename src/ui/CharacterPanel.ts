import { CHARACTERS } from '../config/characters';
import type { Game } from '../core/Game';
import { t } from '../i18n/i18n';
import { stageLabel } from '../sim/stages.ts';
import { CHAR_IDS, type CharId } from '../sim/state.ts';
import { bakeCharIcons } from './charIcons';
import { button, el } from './dom';
import { icon } from './icons';
import { Panel } from './Panel';

/** 잠긴 캐릭터 해금 조건: 월드 1~3 대장 첫 클리어 (sim BOSS_UNLOCKS와 같은 순서), 나머지는 상점 */
const UNLOCK: Partial<Record<CharId, number>> = { yellow: 10, red: 20, pink: 30 };

/** HUD [캐릭터] 메뉴: 6명 초상 + 사용 중 / 고르기 / 잠김(조건) */
export class CharacterPanel {
  private readonly game: Game;
  private readonly panel: Panel;
  private thumbs: Record<CharId, string> | null = null;

  constructor(game: Game, ui: HTMLElement) {
    this.game = game;
    this.panel = new Panel(ui, t('char.title'), 'chars');
    game.menuActions.character = () => { this.render(); this.panel.open(); };
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
      card.append(img, el('div', 'char-name', CHARACTERS[id].name));
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

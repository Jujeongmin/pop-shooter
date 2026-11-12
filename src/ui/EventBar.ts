import type { Game } from '../core/Game';
import { t, type StrKey } from '../i18n/i18n';
import type { Premium } from '../platform/Premium';
import { nextPassProduct, PASS_ORDER } from '../sim/premium.ts';
import { bakeCharIcons } from './charIcons';
import type { DailyPanel } from './DailyPanel';
import { el, setText } from './dom';
import { icon, type IconName } from './icons';
import type { ShopPanel } from './ShopPanel';
import { clockText } from './ShopPanel';

/**
 * 오른쪽 이벤트 버튼 묶음 (사용자 2026-11-12: 로블록스처럼 결제·보상을 화면 오른쪽에 이벤트처럼).
 * 세로로 둥근 버튼: 선물(출석, 받을 수 있으면 통통 + 빨간 점) · 골드 2배(광고 바로 보기, 켜져 있으면 남은 시간) ·
 * 공격력 패스(다음 단계) · 팝젬 · 새 캐릭터(안 가진 유료 캐릭터가 있을 때). 서버 연결이 없으면(혼자 모드) 결제·광고 버튼은 숨김.
 * 1초마다 표시만 갱신 (DOM은 처음 한 번 만듦).
 */
interface Item { root: HTMLButtonElement; label: HTMLSpanElement; dot: HTMLSpanElement }

export class EventBar {
  private readonly root: HTMLDivElement;
  private readonly game: Game;
  private readonly prem: Premium;
  private readonly items: Record<'daily' | 'boost' | 'pass' | 'gems' | 'hero', Item>;
  private acc = 1;
  private faces: Record<string, string> = {};
  private heroImg: HTMLImageElement | null = null;

  constructor(game: Game, ui: HTMLElement, prem: Premium, shop: ShopPanel, daily: DailyPanel) {
    this.game = game;
    this.prem = prem;
    this.root = el('div', 'event-bar ui-on');
    const make = (ic: IconName | HTMLElement, key: StrKey, cls: string, onTap: () => void): Item => {
      const b = el('button', `ev-btn ${cls}`);
      b.type = 'button';
      const face = el('span', 'ev-face');
      face.append(typeof ic === 'string' ? icon(ic) : ic);
      const dot = el('span', 'ev-dot');
      dot.hidden = true;
      const label = el('span', 'ev-label', t(key));
      b.append(face, dot, label);
      b.addEventListener('pointerup', (e) => { e.preventDefault(); e.stopPropagation(); onTap(); });
      this.root.append(b);
      return { root: b, label, dot };
    };
    const faces = bakeCharIcons(game.assets);
    this.faces = faces;
    const heroFace = el('img', 'ev-img');
    this.heroImg = heroFace;
    heroFace.src = faces.white;
    heroFace.alt = '';
    this.items = {
      daily: make('gift', 'ev.daily', 'ev-daily', () => daily.open()),
      boost: make('coin', 'ev.boost', 'ev-boost', () => {
        // 광고가 되면 바로 보기 (버튼 누름 안에서), 아니면 상점 무료 탭
        if (prem.adsShown('boost')) void prem.watch('boost');
        else shop.open('free');
      }),
      pass: make('bullet', 'ev.pass', 'ev-pass', () => shop.open('pass')),
      gems: make('gem', 'ev.gems', 'ev-gems', () => shop.open('gems')),
      hero: make(heroFace, 'ev.hero', 'ev-hero', () => shop.open('heroes')),
    };
    ui.append(this.root);
    game.onTick((dt) => {
      this.acc += dt;
      if (this.acc < 0.5) return;
      this.acc = 0;
      this.refresh();
    });
    prem.onChange(() => this.refresh());
  }

  private refresh(): void {
    const s = this.game.state;
    const online = this.prem.online;
    const it = this.items;
    // 전투 중에는 숨김 (광장에서만)
    this.root.hidden = this.game.mode === 'battle';
    it.daily.root.hidden = !online;
    it.daily.dot.hidden = !this.prem.daily.ready;
    it.daily.root.classList.toggle('ready', this.prem.daily.ready);
    const left = s.boostUntil - Date.now();
    it.boost.root.hidden = !online;
    setText(it.boost.label, left > 0 ? clockText(left) : t('ev.boost'));
    it.boost.root.classList.toggle('on', left > 0);
    const next = nextPassProduct(s.passMult);
    it.pass.root.hidden = !online || !next;
    if (next) {
      const tier = PASS_ORDER.indexOf(Number(next.slice(6)) as (typeof PASS_ORDER)[number]) + 1;
      setText(it.pass.label, `${t('ev.pass')} ${tier}`);
    }
    it.gems.root.hidden = !online;
    const missing = ['white', 'black'].find((c) => !s.chars.includes(c as 'white' | 'black'));
    it.hero.root.hidden = !online || !missing;
    // 안 가진 유료 캐릭터 얼굴 (SHONI → BAM)
    if (missing && this.heroImg && this.faces[missing] && this.heroImg.src !== this.faces[missing]) this.heroImg.src = this.faces[missing]!;
  }
}

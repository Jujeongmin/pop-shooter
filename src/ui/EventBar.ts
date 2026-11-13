import type { Game } from '../core/Game';
import { t, type StrKey } from '../i18n/i18n';
import type { Premium } from '../platform/Premium';
import { BOOST_AD_MS, nextPassProduct, PASS_ORDER } from '../sim/premium.ts';
import { bakeCharIcons } from './charIcons';
import type { DailyPanel } from './DailyPanel';
import type { RebirthPanel } from './RebirthPanel';
import { canRebirth, rebirthReq } from '../sim/actions.ts';
import { formatMult } from '../sim/format.ts';
import { rebirthMult } from '../sim/training.ts';
import { button, el, setText } from './dom';
import { icon, type IconName } from './icons';
import type { ShopPanel } from './ShopPanel';
import { clockText } from './ShopPanel';

/**
 * 오른쪽 이벤트 버튼 묶음 (사용자 2026-11-12: 로블록스처럼 결제·보상을 화면 오른쪽에 이벤트처럼).
 * 세로로 둥근 버튼: 선물(출석, 받을 수 있으면 통통 + 빨간 점) · 골드 2배(광고 바로 보기, 켜져 있으면 남은 시간) ·
 * 공격력 패스(다음 단계) · 새 캐릭터 (팝젬 버튼은 뺌, 사용자 2026-11-13 — 상점·충전 버튼으로)(안 가진 유료 캐릭터가 있을 때). 서버 연결이 없으면(혼자 모드) 결제·광고 버튼은 숨김.
 * 1초마다 표시만 갱신 (DOM은 처음 한 번 만듦).
 */
interface Item { root: HTMLButtonElement; label: HTMLSpanElement; dot: HTMLSpanElement }

export class EventBar {
  private readonly root: HTMLDivElement;
  private readonly game: Game;
  private readonly prem: Premium;
  private readonly items: Record<'reb' | 'daily' | 'boost' | 'pass' | 'hero', Item>;
  private acc = 1;
  private faces: Record<string, string> = {};
  private heroImg: HTMLImageElement | null = null;

  constructor(game: Game, ui: HTMLElement, prem: Premium, shop: ShopPanel, daily: DailyPanel, rebirth: RebirthPanel) {
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
      // 환생 (키보드 탈출처럼 늘 보임, 사용자 2026-11-13): 둘레 = 환생 조건(공격 훈련)이 찬 정도, 다 차면 반짝 + 다음 배율. 누르면 바로 환생 창
      reb: make('reb', 'ev.reb', 'ev-reb', () => rebirth.openDirect()),
      daily: make('gift', 'ev.daily', 'ev-daily', () => daily.open()),
      boost: make('coin', 'ev.boost', 'ev-boost', () => {
        // 광고가 되면 '광고 보시겠어요?' 창 → [광고 보기] 누름 안에서 재생 (바로 틀지 않음, 사용자 2026-11-12). 아니면 상점 무료 탭
        if (prem.adsShown('boost')) this.askBoost(ui);
        else shop.open('free');
      }),
      pass: make('bullet', 'ev.pass', 'ev-pass', () => shop.open('pass')),
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

  /** 골드 2배 광고 확인 창 (하나만) */
  private askBoost(ui: HTMLElement): void {
    if (ui.querySelector('.boost-ask')) return;
    const wrap = el('div', 'result-wrap ui-on in boost-ask');
    const card = el('div', 'result-card boost-card');
    const close = (): void => wrap.remove();
    const ic = el('div', 'boost-ico');
    ic.append(icon('coin'));
    const yes = button(t('ev.boostYes'), () => { close(); void this.prem.watch('boost'); }, 'btn big pink');
    const row = el('div', 'reb-btns');
    row.append(button(t('ev.boostNo'), close, 'btn'), yes);
    card.append(ic, el('div', 'result-title', t('ev.boost')), el('div', 'result-tip', t('ev.boostAsk', { m: BOOST_AD_MS / 60000 })), row);
    wrap.append(card);
    wrap.addEventListener('pointerup', (e) => { if (e.target === wrap) close(); });
    ui.append(wrap);
  }

  private refresh(): void {
    const s = this.game.state;
    // 개발 서버(로컬)는 서버 없이도 버튼이 보이게 (모양 확인용, 사용자 2026-11-13). 배포 빌드는 서버 없으면 결제·광고 버튼 숨김
    const online = this.prem.online || import.meta.env.DEV;
    const it = this.items;
    const ready = canRebirth(s);
    const face = it.reb.root.firstElementChild as HTMLElement;
    face.style.setProperty('--p', String(Math.round(Math.min(1, s.trAtk / rebirthReq(s)) * 100)));
    it.reb.root.classList.toggle('ready', ready);
    setText(it.reb.label, ready ? `×${formatMult(rebirthMult(s.tokens + 1))}` : t('ev.reb'));
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
    const missing = ['white', 'black'].find((c) => !s.chars.includes(c as 'white' | 'black'));
    it.hero.root.hidden = !online || !missing;
    // 안 가진 유료 캐릭터 얼굴 (SHONI → BAM)
    if (missing && this.heroImg && this.faces[missing] && this.heroImg.src !== this.faces[missing]) this.heroImg.src = this.faces[missing]!;
  }
}

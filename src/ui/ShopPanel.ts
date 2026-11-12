import type { Game } from '../core/Game';
import { t, type StrKey } from '../i18n/i18n';
import type { Premium } from '../platform/Premium';
import { charMult } from '../sim/actions.ts';
import { BOOST_AD_MS, GEM_BOOST, GEM_ITEMS, nextPassProduct, PASS_ORDER, PRODUCTS, type AdKind } from '../sim/premium.ts';
import { button, el, setText } from './dom';
import { icon, type IconName } from './icons';
import { Panel } from './Panel';

/** 가격·팝젬 개수는 줄이지 않고 그대로 (1,000 → "1.00K"로 보이면 헷갈림) */
const plain = (n: number): string => Math.floor(n).toLocaleString('en-US');

/** 상품 그림 (VXShop 대시보드에 올린 그림의 작은 사본, art-src/vxshop → public/ui/shop 160px WebP, 사용자 2026-11-12) */
function thumb(id: string): HTMLImageElement {
  const img = el('img', 'shop-thumb');
  img.src = `${import.meta.env.BASE_URL}ui/shop/${id}.webp`;
  img.alt = '';
  img.draggable = false;
  return img;
}

export type Tab = 'free' | 'pass' | 'gems' | 'heroes';
const TABS: readonly Tab[] = ['free', 'pass', 'gems', 'heroes'];

/** 남은 시간 mm:ss / h:mm:ss */
export function clockText(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * 상점 (계획 3, HUD [상점]): 무료(광고 골드 2배 15분 / 팝젬으로 골드 2배 30분) / 공격력 패스(팝젬, 순서대로, 단계마다 ×2) / 팝젬 묶음(VX) / 캐릭터(팝젬).
 * VX로 파는 것은 팝젬 묶음뿐 (사용자 2026-11-12: 팝젬 = 결제 화폐). VX 가격은 VXShop 조회값(못 받으면 버튼 끔), 지급·값은 서버(Premium) 응답만 반영.
 */
export class ShopPanel {
  private readonly game: Game;
  private readonly prem: Premium;
  private readonly panel: Panel;
  private tab: Tab = 'free';
  private readonly tabBtns = new Map<Tab, HTMLButtonElement>();
  private readonly body: HTMLDivElement;
  private msg = '';

  constructor(game: Game, ui: HTMLElement, prem: Premium) {
    this.game = game;
    this.prem = prem;
    this.panel = new Panel(ui, t('store.title'), 'shop');
    const tabs = el('div', 'tabs');
    for (const tb of TABS) {
      const b = el('button', tb === this.tab ? 'on' : '', t(`shop.tab.${tb}` as StrKey));
      b.type = 'button';
      b.addEventListener('pointerup', (e) => { e.preventDefault(); this.tab = tb; this.msg = ''; this.render(); });
      this.tabBtns.set(tb, b);
      tabs.append(b);
    }
    this.body = el('div', 'shop-body');
    this.panel.body.append(tabs, this.body);
    prem.onChange(() => { if (this.panel.isOpen) this.render(); });
    game.onStateChange(() => { if (this.panel.isOpen) this.render(); });
  }

  /** tab = 열 탭 (오른쪽 이벤트 버튼에서 바로 그 탭으로) */
  open(tab?: Tab): void {
    if (tab) { this.tab = tab; this.msg = ''; }
    this.prem.startShop();
    void this.prem.refresh();
    this.render();
    this.panel.open();
  }

  private row(ic: IconName | HTMLElement, title: string, desc: string, action: HTMLElement): HTMLDivElement {
    const r = el('div', 'up-row');
    const mid = el('div', 'up-mid');
    mid.append(el('div', 'up-name', title), el('div', 'up-val', desc));
    r.append(typeof ic === 'string' ? icon(ic) : ic, mid, action);
    return r;
  }

  private adButton(kind: AdKind): HTMLButtonElement {
    const left = this.prem.ads[kind];
    const b = button(`${t('shop.watch')} (${left})`, () => void this.watch(kind), 'btn buy');
    b.disabled = !this.prem.adsShown(kind);
    return b;
  }

  private async watch(kind: AdKind): Promise<void> {
    this.msg = t('shop.adWait');
    this.render();
    const r = await this.prem.watch(kind);
    this.msg = t(`shop.ad.${r}` as StrKey);
    this.render();
  }

  /** VX 상품 구매 버튼 (가격 VX, 못 사면 이유) */
  private vxButton(productId: string): HTMLButtonElement {
    const it = this.prem.item(productId);
    const label = it.price !== null ? `${plain(it.price)} VX` : t(`shop.vx.${it.reason}` as StrKey);
    const b = button(label, () => this.prem.buy(productId), 'btn buy');
    b.disabled = !it.canBuy;
    return b;
  }

  /** 보유 팝젬 한 줄 */
  private myGems(): HTMLDivElement {
    const d = el('div', 'up-hint my-gems');
    d.append(icon('gem'), el('span', '', t('shop.myGems', { n: plain(this.game.state.gems) })));
    return d;
  }

  /** 팝젬 구매 버튼: 팝젬이 모자라면 [팝젬 충전] → 팝젬 탭 */
  private gemButton(id: string): HTMLElement {
    const price = GEM_ITEMS[id]!.gems;
    if (this.prem.online && this.game.state.gems < price) {
      const c = button(t('shop.charge'), () => { this.tab = 'gems'; this.msg = ''; this.render(); }, 'btn buy charge');
      c.prepend(icon('gem'));
      const wrap = el('div', 'gem-need');
      wrap.append(el('div', 'gem-price', plain(price)), c);
      wrap.querySelector('.gem-price')!.prepend(icon('gem'));
      return wrap;
    }
    const b = button(plain(price), () => void this.gemBuy(id, b), 'btn buy');
    b.prepend(icon('gem'));
    b.disabled = !this.prem.online || !this.prem.known;
    return b;
  }

  private async gemBuy(id: string, b: HTMLButtonElement): Promise<void> {
    b.disabled = true;
    const r = await this.prem.gemBuy(id);
    this.msg = r === 'ok' ? t('shop.note.done') : r === 'gems' ? t('shop.gemShort') : t('shop.ad.failed');
    this.render();
  }

  private render(): void {
    for (const [k, b] of this.tabBtns) b.classList.toggle('on', k === this.tab);
    const s = this.game.state;
    const b = this.body;
    b.replaceChildren();
    if (!this.prem.online) b.append(el('div', 'up-hint', t('shop.offline')));
    if (this.tab === 'free') {
      const left = s.boostUntil - Date.now();
      b.append(el('div', 'up-hint', left > 0 ? t('shop.boostOn', { t: clockText(left) }) : t('shop.boostOff')));
      b.append(this.row('coin', t('shop.adBoost'), t('shop.adBoostDesc', { m: BOOST_AD_MS / 60000 }), this.adButton('boost')));
      const gb = button(`${GEM_BOOST.gems}`, () => void this.prem.gemBoost().then((ok) => { this.msg = ok ? t('shop.ad.granted') : t('shop.gemShort'); this.render(); }), 'btn buy');
      gb.prepend(icon('gem'));
      gb.disabled = !this.prem.online || s.gems < GEM_BOOST.gems;
      b.append(this.row('timer', t('shop.gemBoost'), t('shop.adBoostDesc', { m: GEM_BOOST.ms / 60000 }), gb));
    } else if (this.tab === 'pass') {
      b.append(el('div', 'up-hint', t('shop.passHint')), this.myGems());
      // 순서대로만 구매 (키보드 탈출 Speed Multiplier Tier 방식, 사용자 2026-11-12): 단계마다 피해 ×2가 쌓임.
      // 가진 것은 '보유', 바로 다음 단계만 구매 버튼, 그 뒤는 잠김
      const next = nextPassProduct(s.passMult);
      PASS_ORDER.forEach((m, i) => {
        const id = `pass_x${m}`;
        const action = s.passMult >= m ? el('div', 'mentor-st', t('shop.owned'))
          : id === next ? this.gemButton(id)
          : el('div', 'mentor-st', t('shop.passNeed'));
        b.append(this.row(thumb(id), t('shop.pass', { n: i + 1 }), t('shop.passDesc', { m }), action));
      });
    } else if (this.tab === 'gems') {
      for (const id of ['gems_s', 'gems_m', 'gems_l']) {
        const n = (PRODUCTS[id] as { gems: number }).gems;
        b.append(this.row(thumb(id), t('shop.gemPack', { n: plain(n) }), t('shop.gemPackDesc'), this.vxButton(id)));
      }
    } else {
      b.append(this.myGems());
      for (const [id, c, name] of [['char_shoni', 'white', 'SHONI'], ['char_bam', 'black', 'BAM']] as const) {
        const face = thumb(id);
        const owned = s.chars.includes(c);
        b.append(this.row(face, name, t('shop.heroDesc', { p: Math.round((charMult(c) - 1) * 100) }), owned ? el('div', 'mentor-st', t('shop.owned')) : this.gemButton(id)));
      }
    }
    // 결제·광고 결과 한 줄
    let note = this.msg;
    for (const n of this.prem.notes.values()) if (n) note = t(`shop.note.${n}` as StrKey);
    const line = el('div', 'up-hint shop-msg');
    setText(line, note);
    b.append(line);
  }
}

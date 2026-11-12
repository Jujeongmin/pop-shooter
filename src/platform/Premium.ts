import { VXShop, type VXShopDialogClosedPayload, type VXShopItem } from '@verse8/platform/vanilla';
import type { Game } from '../core/Game';
import type { NetClient } from '../net/NetClient';
import { AD_KINDS, AD_LIMIT, type AdKind } from '../sim/premium.ts';
import { adsAvailable, redeem, watchAd } from './ads';

/** 서버 premView (server.ts) */
export interface PremView {
  gems: number; passMult: number; boostUntil: number; chars: string[]; char: string; ads: Record<AdKind, number>;
  /** 출석 (예전 서버면 없음) */
  daily?: { ready: boolean; idx: number };
}

export type AdOutcome = 'granted' | 'dismissed' | 'busy' | 'unsupported' | 'failed' | 'limit' | 'offline';

/** 결제 후 서버 반영 재확인 간격 (ms) — 합계 약 15초 */
const RECHECK_MS = [800, 1500, 2500, 4000, 6000];

/**
 * 프리미엄 한곳 (계획 3): 서버 프리미엄 받기·광고 보상·팝젬 부스트·VXShop 결제.
 * 값은 늘 서버 응답(PremView)으로 게임에 반영 (game.adoptServer). 서버가 없으면(혼자 모드) 광고·결제 버튼 없음.
 */
export class Premium {
  private readonly game: Game;
  private readonly net: NetClient | null;
  ads: Record<AdKind, number> = { ...AD_LIMIT };
  /** 출석: 오늘 받을 수 있는지, 다음 칸 */
  daily = { ready: false, idx: 0 };
  /** 서버 값을 한 번이라도 받았는지 (못 받으면 결제 버튼 끔) */
  known = false;
  private shopStarted = false;
  private shopError = false;
  /** 결제창이 열린 상품 */
  busy: string | null = null;
  /** 상품별 안내 한 줄 */
  readonly notes = new Map<string, string>();
  private readonly listeners = new Set<() => void>();

  constructor(game: Game, net: NetClient | null) {
    this.game = game;
    this.net = net && net.hasVerse ? net : null;
  }

  get online(): boolean {
    return !!this.net;
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    for (const cb of this.listeners) cb();
  }

  private apply(p: PremView | undefined): void {
    if (!p) return;
    this.known = true;
    for (const k of AD_KINDS) this.ads[k] = Math.max(0, p.ads?.[k] ?? 0);
    if (p.daily) this.daily = { ready: !!p.daily.ready, idx: Math.max(0, Math.floor(p.daily.idx ?? 0)) % 7 };
    this.game.adoptServer({ ok: true, prem: p });
    this.emit();
  }

  /** 서버 프리미엄 다시 받기 (시작·결제 뒤) */
  async refresh(): Promise<boolean> {
    if (!this.net) return false;
    try {
      const r = await this.net.call<{ ok: boolean; prem: PremView }>('premGet');
      this.apply(r.prem);
      return true;
    } catch {
      return false;
    }
  }

  adsShown(kind: AdKind): boolean {
    return !!this.net && adsAvailable() && this.ads[kind] > 0;
  }

  /** 리워드 광고 보고 서버 보상 받기 (버튼 누름 안에서만 부름) */
  async watch(kind: AdKind): Promise<AdOutcome> {
    if (!this.net) return 'unsupported';
    if (this.ads[kind] <= 0) return 'limit';
    const ad = await watchAd(`popshooter_${kind}`);
    if (!ad.ok) { this.emit(); return ad.reason; }
    const net = this.net;
    try {
      const r = await redeem<{ status: 'granted'; prem: PremView }>((last) => net.call('adClaim', [kind, ad.requestId, last]));
      this.apply(r.prem);
      return 'granted';
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      return msg.includes('limit') ? 'limit' : msg.includes('nothing') ? 'offline' : 'failed';
    }
  }

  /** 출석 받기 (서버가 하루 한 번만). 받은 칸 번호, 못 받으면 null */
  async claimDaily(): Promise<number | null> {
    if (!this.net) return null;
    try {
      const r = await this.net.call<{ ok: boolean; idx?: number; prem: PremView }>('dailyClaim');
      this.apply(r.prem);
      return r.ok ? (r.idx ?? null) : null;
    } catch {
      return null;
    }
  }

  async gemBoost(): Promise<boolean> {
    if (!this.net) return false;
    try {
      const r = await this.net.call<{ ok: boolean; prem?: PremView }>('gemBoost');
      if (r.ok) this.apply(r.prem);
      return r.ok;
    } catch {
      return false;
    }
  }

  /** 팝젬으로 환생 조건 건너뛰기 1회 (서버가 팝젬을 뺌). 성공하면 바로 doRebirth(state, true) + 저장 */
  async skipRebirth(): Promise<'ok' | 'gems' | 'failed'> {
    if (!this.net) return 'failed';
    try {
      const r = await this.net.call<{ ok: boolean; reason?: string; prem?: PremView }>('skipRebirth');
      this.apply(r.prem);
      return r.ok ? 'ok' : r.reason === 'gems' ? 'gems' : 'failed';
    } catch {
      return 'failed';
    }
  }

  // ── VXShop ──

  startShop(): void {
    if (this.shopStarted || !this.net) return;
    this.shopStarted = true;
    try {
      VXShop.onClose((p) => void this.afterClose(p));
      VXShop.subscribe(() => this.emit());
      VXShop.init();
    } catch {
      this.shopError = true;
    }
  }

  /** 상품 가격·살 수 있는지 (VXShop 조회값, 못 받으면 못 삼) */
  item(productId: string): { price: number | null; canBuy: boolean; reason: 'ok' | 'loading' | 'none' | 'error' | 'busy' | 'limit' } {
    if (!this.net || this.shopError || window.parent === window) return { price: null, canBuy: false, reason: 'error' };
    const st = VXShop.getState();
    const it: VXShopItem | undefined = VXShop.getItem(productId);
    if (!it) return { price: null, canBuy: false, reason: st.isLoading ? 'loading' : st.error ? 'error' : 'none' };
    if (this.busy) return { price: it.price, canBuy: false, reason: 'busy' };
    if (it.purchaseLimitReached) return { price: it.price, canBuy: false, reason: 'limit' };
    return { price: it.price, canBuy: it.purchasable && this.known, reason: it.purchasable && this.known ? 'ok' : 'loading' };
  }

  buy(productId: string): void {
    if (!this.item(productId).canBuy) return;
    this.busy = productId;
    this.notes.delete(productId);
    this.emit();
    try {
      VXShop.buyItem(productId);
    } catch {
      this.busy = null;
      this.notes.set(productId, 'open_failed');
      this.emit();
    }
  }

  /** 결제창 닫힘: 결제했으면 서버 반영(프리미엄이 바뀜)될 때까지 다시 확인 */
  private async afterClose(p: VXShopDialogClosedPayload): Promise<void> {
    if (this.busy !== p.productId) return;
    this.busy = null;
    void VXShop.refresh().catch(() => undefined);
    if (!p.purchased) { this.notes.set(p.productId, 'cancelled'); this.emit(); return; }
    const before = JSON.stringify([this.game.state.gems, this.game.state.passMult, this.game.state.chars]);
    this.notes.set(p.productId, 'checking');
    this.emit();
    for (const ms of RECHECK_MS) {
      await new Promise((r) => window.setTimeout(r, ms));
      await this.refresh();
      const now = JSON.stringify([this.game.state.gems, this.game.state.passMult, this.game.state.chars]);
      if (now !== before) { this.notes.set(p.productId, 'done'); this.emit(); return; }
    }
    this.notes.set(p.productId, 'delayed');
    this.emit();
  }
}

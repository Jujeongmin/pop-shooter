import * as THREE from 'three';
import { audio } from '../audio/audio';
import type { Game } from '../core/Game';
import { t } from '../i18n/i18n';
import type { Premium } from '../platform/Premium';
import { canRebirth, doRebirth, rebirthReq, skipRebirthGems } from '../sim/actions.ts';
import { BALANCE } from '../sim/balance.ts';
import { formatMult, formatNum } from '../sim/format.ts';
import { GUNS } from '../sim/guns.ts';
import { rebirthMult } from '../sim/training.ts';
import { HUB_SPAWN } from '../world/facilities';
import { button, el } from './dom';
import type { FloatText } from './FloatText';
import { icon } from './icons';
import { Panel } from './Panel';
import type { ZoneCallout } from './ZoneCallout';

const HOP_SEC = 0.5;
const _at = new THREE.Vector3();

const mult = (tokens: number, pass: number): string => `×${formatMult(rebirthMult(tokens) * pass)}`;

/**
 * 환생 창 (키보드 탈출 방식, 오른쪽 환생 버튼으로 엶 — 광장 제단은 2026-11-13에 없앰). 배율 지금 → 다음(환생마다 ×multGrowth), 받는 팝젬,
 * 초기화·유지 목록, 조건 = 공격력 레벨 진행 막대(환생할수록 필요 레벨이 오름).
 * [환생하기] → 한 번 더 확인 → 화면 하얗게 + 캐릭터 폴짝 + 상태 적용·즉시 저장.
 * 조건이 안 되면 [팝젬 N 바로 환생] (키보드 탈출 Skip Rebirth): 확인 → 서버가 팝젬을 빼고 허락 → 같은 환생.
 */
export class RebirthPanel {
  private readonly game: Game;
  private readonly panel: Panel;
  private readonly float: FloatText;
  private readonly callout: ZoneCallout;
  /** 확인 중인 환생: 일반 / 팝젬 건너뛰기 */
  private confirming: false | 'normal' | 'skip' = false;
  private hopT = HOP_SEC;
  /** 서버 프리미엄 (없으면 건너뛰기 버튼 없음) */
  prem: Premium | null = null;
  private busy = false;
  private msg = '';

  constructor(game: Game, ui: HTMLElement, callout: ZoneCallout, float: FloatText) {
    this.game = game;
    this.float = float;
    this.callout = callout;
    this.panel = new Panel(ui, t('reb.title'));
    game.onTick((dt) => this.update(dt));
    game.onStateChange(() => { if (this.panel.isOpen && !this.confirming) this.render(); });
  }

  private render(): void {
    const s = this.game.state;
    const b = this.panel.body;
    b.replaceChildren();
    const can = canRebirth(s);
    const need = rebirthReq(s);
    const next = s.tokens + 1;
    const card = el('div', 'reb-mult');
    card.append(icon('reb', 'big'), el('div', 'reb-mult-l', t('reb.mult')));
    const v = el('div', 'reb-mult-v');
    v.append(el('span', '', mult(s.tokens, s.passMult)), el('span', 'arrow', '→'), el('b', '', mult(next, s.passMult)));
    card.append(v);
    const gems = el('div', 'reb-gems');
    gems.append(icon('gem'), el('span', '', `${t('reb.gems')} +${BALANCE.gems.perRebirth}`));
    const lists = el('div', 'reb-lists');
    const li = (title: string, body: string, cls: string): HTMLDivElement => {
      const d = el('div', `reb-list ${cls}`);
      d.append(el('div', 'reb-list-t', title), el('div', '', body));
      return d;
    };
    lists.append(li(t('reb.reset'), t('reb.resetList'), 'reset'), li(t('reb.keep'), t('reb.keepList'), 'keep'));
    // 조건: 공격 훈련 진행 막대 (지금 / 필요), 위에 환생 횟수
    const price = el('div', 'reb-price');
    const pv = el('span', 'reb-price-v');
    pv.append(icon('bullet'), el('span', '', `${formatNum(Math.min(s.trAtk, need))} / ${formatNum(need)}`));
    price.append(el('span', 'reb-price-l', t('reb.need', { n: s.rebirths })), pv);
    const bar = el('div', 'reb-bar');
    const fill = el('div', 'reb-fill');
    fill.style.transform = `scaleX(${Math.min(1, s.trAtk / need)})`;
    bar.append(fill);
    price.append(bar);
    const tip = el('div', 'reb-tip', can ? t('reb.tip') : t('reb.short', { n: formatNum(need - s.trAtk) }));
    b.append(card, ...(BALANCE.gems.perRebirth > 0 ? [gems] : []), lists, price, tip);
    const skipGems = skipRebirthGems(s);
    if (this.confirming === 'skip' && !can) {
      const row = el('div', 'reb-confirm');
      row.append(el('div', 'reb-sure', t('reb.skipSure', { n: formatNum(skipGems) })));
      const btns = el('div', 'reb-btns');
      const yes = button(t('reb.yes'), () => void this.skip(), 'btn pink');
      yes.disabled = this.busy;
      btns.append(button(t('reb.no'), () => { this.confirming = false; this.render(); }, 'btn'), yes);
      row.append(btns);
      b.append(row);
    } else if (this.confirming === 'normal' && can) {
      const row = el('div', 'reb-confirm');
      row.append(el('div', 'reb-sure', t('reb.sure')));
      const btns = el('div', 'reb-btns');
      btns.append(button(t('reb.no'), () => { this.confirming = false; this.render(); }, 'btn'), button(t('reb.yes'), () => this.rebirth(false), 'btn pink'));
      row.append(btns);
      b.append(row);
    } else {
      const go = button(t('reb.go'), () => { this.confirming = 'normal'; this.render(); }, 'btn big reb-go');
      go.disabled = !can;
      // 환생하기·팝젬 건너뛰기를 한 줄에 (사용자 2026-11-12: 창이 스크롤되지 않게)
      const acts = el('div', 'reb-acts');
      acts.append(go);
      b.append(acts);
      // 조건이 안 되면 팝젬으로 바로 환생 (서버 연결 때만)
      if (!can && this.prem?.online) {
        const sk = button(t('reb.skip', { n: formatNum(skipGems) }), () => { this.msg = ''; this.confirming = 'skip'; this.render(); }, 'btn reb-skip');
        sk.prepend(icon('gem'));
        sk.disabled = s.gems < skipGems;
        acts.append(sk);
      }
    }
    if (this.msg) b.append(el('div', 'reb-tip', this.msg));
  }

  /** 팝젬 건너뛰기: 서버가 팝젬을 빼고 허락하면 조건 없이 환생 + 즉시 저장 (서버 checkSave가 건너뛰기 1회를 씀) */
  private async skip(): Promise<void> {
    if (!this.prem || this.busy) return;
    this.busy = true;
    this.render();
    const r = await this.prem.skipRebirth();
    this.busy = false;
    if (r === 'ok') { this.rebirth(true); return; }
    this.confirming = false;
    this.msg = t(r === 'gems' ? 'shop.gemShort' : 'reb.skipFail');
    this.render();
  }

  /** 제단에 가지 않고 바로 열기 (오른쪽 환생 버튼, 사용자 2026-11-13) */
  openDirect(): void {
    this.confirming = false;
    this.msg = '';
    this.render();
    this.panel.open();
  }

  private rebirth(skip: boolean): void {
    const g = this.game;
    const next = doRebirth(g.state, skip);
    if (!next) return;
    g.setState(next, true);
    audio.play('rebirth');
    g.avatar.setGun(GUNS[next.gun]!);
    this.callout.flash('rgba(255, 255, 255, 1)');
    g.cam.shake(0.12);
    this.hopT = 0;
    g.avatar.getMuzzle(_at);
    _at.y += 0.8;
    this.float.show(t('reb.done', { m: formatMult(rebirthMult(next.tokens) * next.passMult) }), _at, 'coin big');
    this.confirming = false;
    this.render();
    this.respawn = true;
  }

  /** 환생 연출(폴짝)이 끝나면 처음 시작 자리로 (사용자 2026-11-12) */
  private respawn = false;

  private update(dt: number): void {
    // 환생 폴짝 (점프·착지 클립)
    if (this.hopT >= HOP_SEC) return;
    const g = this.game;
    this.hopT = Math.min(HOP_SEC, this.hopT + dt);
    const k = this.hopT / HOP_SEC;
    g.pos.y = Math.sin(Math.PI * k) * 1.1;
    g.pose.grounded = k >= 1;
    if (k >= 1) g.pos.y = 0;
    if (k >= 1 && this.respawn) {
      this.respawn = false;
      g.placeAt(HUB_SPAWN.x, HUB_SPAWN.z, Math.PI);
      g.cam.yaw = 0;
      this.callout.flash('rgba(255, 255, 255, 0.9)');
      // 환생 직후 체감 (사용자 2026-11-13): 가운데 크게 '훈련 ×N', 머리 위 환생 아이콘 + 배율
      this.panel.close();
      const m = formatMult(rebirthMult(g.state.tokens));
      this.callout.show({ title: t('reb.doneTitle'), big: t('reb.doneBig', { m }) });
      window.setTimeout(() => this.callout.hide(), 2200);
      _at.set(g.pos.x, g.avatar.headTop() + 0.35, g.pos.z);
      this.float.show(`×${m}`, _at, 'coin big stat', 'reb');
    }
  }
}

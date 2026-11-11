import * as THREE from 'three';
import { audio } from '../audio/audio';
import type { Game } from '../core/Game';
import { ZoneEntry } from '../core/ZoneEntry';
import { gunName, t } from '../i18n/i18n';
import { buyNextGun, worldUnlocked } from '../sim/actions.ts';
import { BALANCE } from '../sim/balance.ts';
import { formatMult, formatNum } from '../sim/format.ts';
import { gunMult, gunPrice, GUNS } from '../sim/guns.ts';
import { WORLD1_FACILITIES } from '../world/facilities';
import { button, el } from './dom';
import type { FloatText } from './FloatText';
import { icon } from './icons';
import { bakeGunIcons, tintedGun } from './gunIcons';
import { bump, Panel } from './Panel';
import type { ZoneCallout } from './ZoneCallout';

const _at = new THREE.Vector3();


/**
 * 총 상점: 구역에 들어가면 폴짝 + 아래 창. 16자루를 월드별로 묶어 보여 줌 (총은 순서대로만 삼).
 * 줄 상태: 장착 중 / 보유 / 다음 것(가격 버튼) / 앞 총 먼저 / 월드 잠김. 사면 바로 손에 든 총이 바뀌고 축하.
 */
export class GunPanel {
  private readonly game: Game;
  private readonly panel: Panel;
  private readonly float: FloatText;
  private readonly callout: ZoneCallout;
  private readonly zone: ZoneEntry;
  /** 총 썸네일 (처음 창 열 때 한 번 구움) */
  private thumbs: string[] | null = null;
  /** 가판대 진열 총: 복제 material 소유 (광장과 수명 같음) */
  private readonly displayMats: THREE.Material[] = [];

  constructor(game: Game, ui: HTMLElement, callout: ZoneCallout, float: FloatText) {
    this.game = game;
    this.float = float;
    this.callout = callout;
    this.panel = new Panel(ui, t('shop.title'));
    const f = WORLD1_FACILITIES.find((x) => x.id === 'guns')!;
    this.zone = new ZoneEntry(game, callout, f, {
      color: '#ff9ec4',
      flash: 'rgba(255, 158, 196, 0.85)',
      face: { x: f.x + 2, z: f.z },
      text: null,
      spot: { x: f.x - 0.6, z: f.z + 1 },
      cam: { focus: -0.4, lookUp: -1.4 },
    });
    this.zone.onLanded = () => { this.render(); this.panel.open(); };
    game.facilityActions.guns = () => this.zone.enter();
    game.facilityLeave.guns = () => { this.zone.leave(); this.panel.close(); };
    game.onTick((dt) => this.zone.update(dt));
    game.onStateChange(() => { if (this.panel.isOpen) this.render(); });
    this.buildDisplay(f.x, f.z);
  }

  /** 가판대 위에 월드 1 총 4자루를 옆으로 눕혀 진열 */
  private buildDisplay(fx: number, fz: number): void {
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    GUNS.filter((g) => g.world === 1).forEach((g, i) => {
      const { obj, mats } = tintedGun(this.game.assets, g);
      this.displayMats.push(...mats);
      const holder = new THREE.Group();
      box.setFromObject(obj);
      box.getSize(size);
      box.getCenter(center);
      obj.position.sub(center);
      // 총열을 x축으로 (카메라가 남쪽에서 보므로 옆모습)
      if (size.z > size.x) obj.rotation.y = Math.PI / 2;
      holder.add(obj);
      holder.scale.setScalar(0.85 / Math.max(size.x, size.z));
      holder.position.set(fx + 0.75 + i * 0.72, 1.1 + 0.22, fz - 0.2 + (i % 2) * 0.4);
      holder.rotation.y = -0.15;
      obj.traverse((o) => { o.castShadow = true; });
      this.game.hub.root.add(holder);
    });
  }

  private render(): void {
    const s = this.game.state;
    const body = this.panel.body;
    const scroll = body.scrollTop;
    body.replaceChildren();
    let nextRow: HTMLElement | null = null;
    for (let w = 1; w <= BALANCE.stage.worlds; w++) {
      body.append(el('div', 'shop-world', t('shop.world', { w })));
      for (const g of GUNS.filter((x) => x.world === w)) {
        const row = el('div', 'gun-row');
        this.thumbs ??= bakeGunIcons(this.game.assets, GUNS);
        const gi = el('img', 'gun-thumb');
        gi.src = this.thumbs[g.index]!;
        gi.alt = '';
        gi.draggable = false;
        const mid = el('div', '');
        mid.append(el('div', 'gun-name', gunName(g.world, g.model)), el('div', 'gun-dmg', t('shop.dmg', { m: formatMult(gunMult(g.index)) })));
        let right: HTMLElement;
        if (g.index === s.gun) {
          row.classList.add('equipped');
          right = el('span', 'tag eq');
          right.append(icon('check'), el('span', '', t('shop.equipped')));
        } else if (g.index < s.gun) {
          right = el('span', 'tag', t('shop.owned'));
        } else if (!worldUnlocked(s, g.world)) {
          row.classList.add('locked');
          right = el('span', 'tag');
          right.append(icon('lock'), el('span', '', t('shop.locked', { w: g.world - 1 })));
        } else if (g.index === s.gun + 1) {
          const price = gunPrice(g.index);
          const b = button('', () => this.buy(), 'btn buy');
          const c = el('span', 'cost');
          c.append(icon('coin'), el('span', '', formatNum(price)));
          b.append(c);
          b.disabled = !(price <= s.coins);
          right = b;
          nextRow = row;
        } else {
          row.classList.add('locked');
          right = el('span', 'tag', t('shop.needPrev'));
        }
        row.append(gi, mid, right);
        body.append(row);
      }
    }
    // 처음 열 때는 다음에 살 총이 보이게
    if (scroll === 0 && nextRow) requestAnimationFrame(() => nextRow!.scrollIntoView({ block: 'center' }));
    else body.scrollTop = scroll;
  }

  private buy(): void {
    const g = this.game;
    const next = buyNextGun(g.state);
    if (!next) return;
    g.setState(next, true);
    audio.play('gunBuy');
    g.avatar.setGun(GUNS[next.gun]!);
    // setState가 창을 다시 그려서 누른 줄은 떨어져 나감 → 새로 그린 장착 줄을 튕김
    const row = this.panel.body.querySelector<HTMLElement>('.gun-row.equipped');
    if (row) bump(row);
    this.callout.flash('rgba(255, 211, 77, 0.9)');
    g.cam.shake(0.05);
    g.avatar.getMuzzle(_at);
    _at.y += 0.6;
    this.float.show(`${t('shop.newGun')} ${gunName(GUNS[next.gun]!.world, GUNS[next.gun]!.model)}`, _at, 'coin big');
  }
}

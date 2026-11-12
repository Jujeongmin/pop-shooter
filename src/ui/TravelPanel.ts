import type { Game } from '../core/Game';
import { ZoneEntry } from '../core/ZoneEntry';
import { t, type StrKey } from '../i18n/i18n';
import { highestWorld } from '../sim/actions.ts';
import { BALANCE } from '../sim/balance.ts';
import { stageLabel } from '../sim/stages.ts';
import { stationMult } from '../sim/training.ts';
import { audio } from '../audio/audio';
import { WORLD1_FACILITIES } from '../world/facilities';
import { themeOf } from '../world/worldThemes';
import { button, el } from './dom';
import { icon } from './icons';
import { Panel } from './Panel';
import type { ZoneCallout } from './ZoneCallout';

/**
 * 월드 이동 정류장 (사용자 2026-11-12: 월드마다 광장 따로): 구역에 들어가면 월드 8개 목록.
 * 열린 월드 = [이동] (화면 번쩍 + 그 월드 광장 시작 지점), 지금 월드 = '지금 여기', 닫힌 월드 = 앞 월드 대장을 깨면 열림.
 */
export class TravelPanel {
  private readonly game: Game;
  private readonly panel: Panel;
  private readonly zone: ZoneEntry;
  private readonly callout: ZoneCallout;

  constructor(game: Game, ui: HTMLElement, callout: ZoneCallout) {
    this.game = game;
    this.callout = callout;
    this.panel = new Panel(ui, t('travel.title'), 'travel');
    const f = WORLD1_FACILITIES.find((x) => x.id === 'travel')!;
    this.zone = new ZoneEntry(game, callout, f, {
      color: '#7cc4ff',
      flash: 'rgba(124, 196, 255, 0.9)',
      spot: { x: f.x, z: f.z + 0.4 },
      face: { x: f.x, z: f.z - 2 },
      cam: { focus: -0.4, lookUp: -1.2 },
      text: null,
    });
    this.zone.onLanded = () => { this.render(); this.panel.open(); };
    game.facilityActions.travel = () => this.zone.enter();
    game.facilityLeave.travel = () => { this.zone.leave(); this.panel.close(); };
    game.onTick((dt) => this.zone.update(dt));
  }

  private render(): void {
    const s = this.game.state;
    const top = highestWorld(s);
    const b = this.panel.body;
    b.replaceChildren(el('div', 'up-hint', t('travel.hint')));
    const list = el('div', 'travel-list');
    for (let w = 1; w <= BALANCE.stage.worlds; w++) {
      const th = themeOf(w);
      const row = el('div', `travel-row${w === this.game.world ? ' here' : ''}${w > top ? ' locked' : ''}`);
      // 썸네일 (Codex 그림 public/ui/worlds, 못 받으면 테마 색 + 번호)
      const badge = el('div', 'travel-badge');
      badge.style.background = `linear-gradient(160deg, ${th.sky}, ${th.plaza})`;
      const img = el('img', 'travel-img');
      img.src = `${import.meta.env.BASE_URL}ui/worlds/world_${w}.webp`;
      img.alt = '';
      img.draggable = false;
      img.onerror = () => img.remove();
      badge.append(img);
      badge.append(el('span', 'travel-num', String(w)));
      const mid = el('div', 'up-mid');
      mid.append(el('div', 'up-name', t(`world.${w}` as StrKey)), el('div', 'up-val', t('travel.train', { m: stationMult(w) })));
      let action: HTMLElement;
      if (w === this.game.world) action = el('div', 'mentor-st', t('travel.here'));
      else if (w > top) {
        action = el('div', 'mentor-st travel-lock');
        action.append(icon('lock'), el('span', '', t('travel.locked', { s: stageLabel((w - 1) * BALANCE.stage.perWorld) })));
      } else action = button(t('travel.go'), () => this.go(w), 'btn buy');
      row.append(badge, mid, action);
      list.append(row);
    }
    b.append(list);
  }

  private go(w: number): void {
    this.panel.close();
    this.zone.leave();
    this.callout.flash('rgba(255, 255, 255, 1)');
    audio.play('rebirth');
    this.game.setWorld(w);
    this.callout.show({ title: t('fac.travel'), big: t(`world.${w}` as StrKey) });
    window.setTimeout(() => this.callout.hide(), 1400);
  }
}

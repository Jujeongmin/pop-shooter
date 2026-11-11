import type { Game } from '../core/Game';
import { ZoneEntry } from '../core/ZoneEntry';
import { BALANCE } from '../sim/balance.ts';
import { stageLabel } from '../sim/stages.ts';
import type { ZoneCallout } from '../ui/ZoneCallout';
import { PORTAL_GATE, PORTAL_SPOT, WORLD1_FACILITIES } from '../world/facilities';

/**
 * 월드 포털 구역: 들어가면 포털 앞으로 폴짝 → 착지 연출. 연속 도전(전투)은 onEnterRun에 붙임.
 */
export class PortalZone {
  private readonly zone: ZoneEntry;
  /** 착지 뒤 연속 도전 시작 (전투 화면이 등록) */
  onEnterRun: (() => void) | null = null;

  /** 전투로 넘어갈 때: 구역 연출 끄기 (광장에서 순간이동하므로 나가기 이벤트가 안 옴) */
  release(): void {
    this.zone.leave();
  }

  get inside(): boolean {
    return this.zone.inside;
  }

  constructor(game: Game, callout: ZoneCallout) {
    this.zone = new ZoneEntry(game, callout, WORLD1_FACILITIES.find((f) => f.id === 'portal')!, {
      color: '#9b87ff',
      flash: 'rgba(155, 135, 255, 0.9)',
      spot: PORTAL_SPOT,
      face: PORTAL_GATE,
      text: () => ({
        title: game.state.bestStage > 0 ? `월드 1 포털 · 최고 ${stageLabel(Math.min(game.state.bestStage, BALANCE.stage.perWorld))}` : '월드 1 포털',
        big: '1-1부터 연속 도전!',
      }),
    });
    this.zone.onLanded = () => this.onEnterRun?.();
    game.facilityActions.portal = () => this.zone.enter();
    game.facilityLeave.portal = () => this.zone.leave();
    game.onTick((dt) => this.zone.update(dt));
  }
}

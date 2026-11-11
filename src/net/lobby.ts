// 광장 멀티를 게임에 붙이기: LobbyHub(세션) + LobbyPeers(표시) + 내 상태 → 보이는 정보·위치.
// 서버에 연결됐을 때만 시작. 멀티 층이 없거나 실패해도 혼자 게임은 그대로 (여기서 던지는 것은 모두 잡음).
import type { Game } from '../core/Game';
import type { CloudSave } from '../platform/CloudSave';
import { damagePerShot } from '../sim/actions.ts';
import type { GameState } from '../sim/state.ts';
import type { TrainingRange } from '../training/TrainingRange';
import { LobbyHub, type HubLocal } from './LobbyHub';
import { LobbyPeers } from './LobbyPeers';
import type { NetClient } from './NetClient';
import type { HubInfo, HubStatus } from './shared/hub.ts';

/** 지금 광장 월드 (계획 1·2 = 월드 1) */
const HUB_WORLD = 1;

export interface Lobby {
  readonly hub: LobbyHub;
  readonly peers: LobbyPeers;
}

function infoOf(s: GameState, status: HubStatus): HubInfo {
  return { c: s.char, g: s.gun, r: s.rebirths, pw: damagePerShot(s), s: status };
}

export function startLobby(game: Game, net: NetClient, cloud: CloudSave, training: TrainingRange): Lobby | null {
  if (!net.connected) return null;
  try {
    const peers = new LobbyPeers({ assets: game.assets, parent: game.hub.root, targets: game.hub.targets });
    const hub = new LobbyHub(net, {
      onPeerJoin: (p) => peers.add(p),
      onPeerLeave: (a) => peers.remove(a),
      onPeerChange: (p) => peers.change(p),
    });
    const statusNow = (): HubStatus => (game.mode === 'battle' ? 'battle' : training.active ? 'training' : 'hub');
    let status = statusNow();
    game.onStateChange((s) => hub.setInfo(infoOf(s, status)));
    cloud.onSaved.add((saved) => {
      const s = saved as unknown as GameState;
      if (typeof s.rebirths === 'number') hub.savedCovers(s.rebirths, damagePerShot(s));
    });
    const local: HubLocal = { x: 0, z: 0, yaw: 0, vx: 0, vz: 0, f: 0 };
    let warned = false;
    game.onTick((dt) => {
      try {
        const st = statusNow();
        if (st !== status) {
          status = st;
          hub.setStatus(st);
        }
        let l: HubLocal | null = null;
        // 전투 중엔 위치를 보내지 않음 (game.pos가 전투장 좌표)
        if (st !== 'battle') {
          const v = game.velocity;
          const moving = v.x * v.x + v.z * v.z > 0.0025;
          local.x = game.pos.x;
          local.z = game.pos.z;
          local.yaw = game.yaw;
          local.vx = v.x;
          local.vz = v.z;
          local.f = (moving ? 1 : 0) | (st === 'training' && !moving ? 2 : 0);
          l = local;
        }
        hub.update(dt, l);
        peers.update(dt);
      } catch (e) {
        // 멀티 표시 오류가 게임 프레임을 멈추지 않게 (한 번만 로그)
        if (!warned) console.warn('[lobby]', e);
        warned = true;
      }
    });
    hub.start(HUB_WORLD, infoOf(game.state, status));
    return { hub, peers };
  } catch (e) {
    console.warn('[lobby] 시작 실패 (혼자 모드)', e);
    return null;
  }
}

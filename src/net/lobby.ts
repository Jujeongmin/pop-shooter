// 광장 멀티를 게임에 붙이기: LobbyHub(세션) + LobbyPeers(표시) + 내 상태 → 보이는 정보·위치.
// 서버에 연결됐을 때만 시작. 멀티 층이 없거나 실패해도 혼자 게임은 그대로 (여기서 던지는 것은 모두 잡음).
import type { Game } from '../core/Game';
import type { CloudSave } from '../platform/CloudSave';
import { autoDps } from '../sim/actions.ts';
import type { GameState } from '../sim/state.ts';
import type { TrainingRange } from '../training/TrainingRange';
import { LobbyHub, type HubLocal } from './LobbyHub';
import { LobbyPeers } from './LobbyPeers';
import type { NetClient } from './NetClient';
import type { HubInfo, HubStatus } from './shared/hub.ts';

export interface Lobby {
  readonly hub: LobbyHub;
  readonly peers: LobbyPeers;
}

/** 상태 → 보이는 정보 (out에 씀: 상태 변경마다 새 객체 안 만듦) */
function infoOf(s: GameState, status: HubStatus, out: HubInfo): HubInfo {
  out.c = s.char;
  out.g = s.gun;
  out.r = s.rebirths;
  // 머리 위 숫자·오라 = DPS (사용자 2026-11-12: 띄운다면 DPS)
  out.pw = autoDps(s);
  out.s = status;
  out.q = s.gear;
  return out;
}

export function startLobby(game: Game, net: NetClient, cloud: CloudSave, training: TrainingRange): Lobby | null {
  // verse가 있으면 첫 연결이 실패했어도 시작 (LobbyHub가 연결·재시도 간격을 맡음). verse 없는 빌드는 멀티 없음
  if (!net.hasVerse) return null;
  try {
    const peers = new LobbyPeers({ assets: game.assets, parent: game.hub.root, targets: game.hub.targets, me: game.pos, camera: game.stage.camera });
    const hub = new LobbyHub(net, {
      onPeerJoin: (p) => peers.add(p),
      onPeerLeave: (a) => peers.remove(a),
      onPeerChange: (p) => peers.change(p),
    });
    const statusNow = (): HubStatus => (game.mode === 'battle' ? 'battle' : training.active ? 'training' : 'hub');
    let status = statusNow();
    const info: HubInfo = { c: 'blue', g: 0, r: 0, pw: 0, s: 'hub', q: 0 };
    game.onStateChange((s) => hub.setInfo(infoOf(s, status, info)));
    cloud.onSaved.add((saved) => {
      const s = saved as unknown as GameState;
      if (typeof s.rebirths === 'number') hub.savedCovers(s.rebirths, autoDps(s));
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
          // 비트: 1 걷기, 2 훈련 중 서 있음, 4 만세 (동전 분수, 다른 사람 화면에도 만세)
          local.f = (moving ? 1 : 0) | (st === 'training' && !moving ? 2 : 0) | (game.pose.cheer > 0.5 ? 4 : 0);
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
    hub.start(game.world, infoOf(game.state, status, info));
    // 다른 월드 광장으로 가면 그 월드 방으로 옮김 (룸 = 월드별, 사용자 2026-11-12)
    game.onWorldChange((w) => {
      void hub.stop().then(() => {
        peers.clear();
        if (game.world === w) hub.start(w, infoOf(game.state, status, info));
      });
    });
    return { hub, peers };
  } catch (e) {
    console.warn('[lobby] 시작 실패 (혼자 모드)', e);
    return null;
  }
}

// 광장·닉네임 서버 함수의 얇은 타입 래퍼 (server/src/server.ts hub*·nick*). 화면·세션 로직 없음 (계획 2 Task 3·4).
// 연결은 NetClient 하나를 계정 저장과 함께 씀. 연결이 없으면 호출은 던짐 → 부르는 쪽(LobbyHub 등)이 잡아서 혼자 모드로.
import type { NetClient } from './NetClient';
import { HUB_TIMING, type HubInfo, type HubPacket, type HubUserState } from './shared/hub.ts';
import type { NickFailReason } from './shared/nickFilter.ts';
import type { RankBoard } from './shared/rank.ts';

/** bad_world = 열리지 않은 월드 (HUB_OPEN_WORLDS) */
export type HubFindResult = { ok: true; roomId: string; max: number } | { ok: false; reason: 'bad_world' };
/** reason: not_in_hub · no_reservation(hubFind 없이 들어옴) · full · bad_c · bad_g · bad_r · bad_pw · bad_s. 재접속 뒤에는 hello를 다시 보내야 다시 보임 */
export interface HubHelloResult { ok: boolean; reason?: string; max: number; count: number }
/** reason: not_in_hub · not_joined(hello 전·끊김·hubBye 뒤) · bad_<칸>. 환생·공격력은 서버가 저장값으로 상한 */
export interface HubInfoResult { ok: boolean; reason?: string }
export type HubUser = HubUserState & { account: string };
export interface NickGetResult { ok: true; nick: string | null; mustChange?: boolean }
export interface NickSetResult { ok: boolean; nick?: string; reason?: NickFailReason | 'taken' | 'rate'; retryMs?: number }

export class LobbyApi {
  private readonly net: NetClient;

  constructor(net: NetClient) {
    this.net = net;
  }

  /** 월드 광장 룸 배정 (룸 밖에서). 결과 roomId로 net.joinRoom */
  hubFind(world: number): Promise<HubFindResult> {
    return this.net.call('hubFind', [world]);
  }

  /** 광장 룸 입장 직후: 보이는 정보 등록. 'full'이면 나가서 hubFind부터 다시 */
  hubHello(info: HubInfo): Promise<HubHelloResult> {
    return this.net.call('hubHello', [info]);
  }

  /** 보이는 정보 중 바뀐 칸만 */
  hubInfo(patch: Partial<HubInfo>): Promise<HubInfoResult> {
    return this.net.call('hubInfo', [patch]);
  }

  /** 위치 (응답 없음, throttle). HUB_TIMING.sendIntervalMs보다 자주 부르지 않음 */
  hubMove(pkt: HubPacket): void {
    this.net.stream('hubMove', [pkt], HUB_TIMING.throttleMs);
  }

  /** 같은 룸 사용자 상태 (입장 직후 한 번, 이후는 net.subscribeUsers) */
  async hubState(): Promise<HubUser[]> {
    const r = await this.net.call<{ ok: boolean; users: HubUser[] }>('hubState');
    return r?.ok ? r.users : [];
  }

  /** 광장에서 나감 (응답 기다리지 않음: 탭 닫힘·전환 중에도 보냄). 이어서 net.leaveRoom */
  hubBye(): void {
    this.net.fire('hubBye');
  }

  /** 기록판 상위 + 내 순위 (계정 id 없음) */
  rankTop(): Promise<RankBoard> {
    return this.net.call('rankTop');
  }

  nickGet(): Promise<NickGetResult> {
    return this.net.call('nickGet');
  }

  nickSet(nick: string): Promise<NickSetResult> {
    return this.net.call('nickSet', [nick]);
  }
}

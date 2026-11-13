// 광장 멀티 세션: 광장 룸(w<월드>-N) 배정·입장·등록, 내 위치·보이는 정보 전송, 같은 룸 사람들 상태 수신.
// pop-battle src/net/LobbyHub.ts를 복사해 고침 (2026-11-11): 평지 패킷(HubPacket), 보이는 정보(캐릭터·총·환생·공격력·상태), 매치 룸 없음.
// 게임 객체(three.js)는 모름 → 원격 사람은 HubPeer(보간 버퍼)로 내보내고 그리기는 LobbyPeers.
// 멀티 층이 꺼지거나 실패해도 혼자 게임은 그대로 (여기 오류는 모두 잡아서 로그만, 다음 시도 예약).
import { errText, type NetClient } from './NetClient';
import { LobbyApi, type HubUser } from './LobbyApi';
import { HubBuffer } from './hubBuffer';
import { HUB_MAX_PLAYERS, HUB_TIMING, isHubRoom, sanitizeHubField, type HubInfo, type HubPacket, type HubStatus } from './shared/hub.ts';

/**
 * idle = 시작 전·멈춤 · offline = 서버 기능 없음(verse 미설정) · connecting = 입장 중 · online ·
 * disconnected = 끊김·실패 후 다음 시도 대기 · reconnecting = 다시 입장하는 중
 */
export type HubSession = 'idle' | 'offline' | 'connecting' | 'online' | 'disconnected' | 'reconnecting';

/** 같은 광장의 다른 사람 (계정은 식별용, 화면에는 절대 내지 않음 — 닉네임만) */
export interface HubPeer {
  readonly account: string;
  /** 서버 저장 닉네임 ('' = 없음 → 화면은 '플레이어') */
  nick: string;
  char: HubInfo['c'];
  gun: number;
  rebirths: number;
  power: number;
  status: HubStatus;
  /** 장비 비트 (보이는 장비) */
  gear: number;
  readonly buffer: HubBuffer;
}

export interface HubEvents {
  onPeerJoin(peer: HubPeer): void;
  onPeerLeave(account: string): void;
  /** 닉네임·캐릭터·총·환생·공격력·상태가 바뀜 */
  onPeerChange(peer: HubPeer): void;
}

/** 이번 프레임 내 상태 (발 위치·몸 방향·속도·비트 1 걷는 중 · 2 훈련 발사) */
export interface HubLocal {
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  f: number;
}

/** 다시 입장 간격 (ms) */
const RETRY_MS = [2000, 4000, 8000, 15000, 30000];
/** 보이는 정보(hubInfo) 최소 간격 (ms): 업그레이드를 연타해도 함수 호출 빈도 제한(초당 10회)에 안 걸리게 */
const INFO_INTERVAL_MS = 500;
/** 입장 시도당 배정 다시 받기 (full·no_reservation) */
const FIND_ATTEMPTS = 3;

const INFO_KEYS = ['c', 'g', 'r', 'pw', 's', 'q'] as const;
/** 서버가 나를 숨긴 것(x ≠ 0)을 끊김으로 보기 전 hello 뒤 대기 (ms): hello 직후 푸시는 아직 예전 상태일 수 있음 */
const SELF_HIDDEN_GRACE_MS = 2000;

const r1 = (v: number): number => Math.round(v * 10) / 10;
const r2 = (v: number): number => Math.round(v * 100) / 100;

export class LobbyHub {
  status: HubSession = 'idle';
  roomId: string | null = null;
  max = HUB_MAX_PLAYERS;
  readonly peers = new Map<string, HubPeer>();
  /** 진단 (개발): 보낸 위치 패킷·안 움직여서 건너뛴 횟수·받은 상태 푸시·보낸 hubInfo */
  readonly stats = { sent: 0, skipped: 0, recv: 0, info: 0 };
  /** 마지막 실패 이유 (개발 로그) */
  lastError = '';
  private readonly api: LobbyApi;
  private wanted = false;
  private token = 0;
  private world = 1;
  /** 지금 내 보이는 정보 (게임이 알려 줌) */
  private readonly info: HubInfo = { c: 'blue', g: 0, r: 0, pw: 0, s: 'hub', q: 0 };
  /** 서버에 보낸 값 (다른 칸만 hubInfo) */
  private readonly sent: HubInfo = { c: 'blue', g: 0, r: 0, pw: 0, s: 'hub', q: 0 };
  private infoAt = 0;
  private infoBusy = false;
  /**
   * 환생·공격력을 저장이 따라잡은 뒤 다시 보내야 함: 서버는 저장값으로 상한을 씀 → 저장보다 먼저 보낸 값은 낮게 잘림.
   * savedCovers()가 이 값 이상을 확인하면 다시 보내고 지움
   */
  private resendRP = false;
  private seq = 0;
  private sendTimer = 0;
  private readonly last: HubPacket = [0, 0, 0, 0, 0, 0, 0, 0];
  private hasLast = false;
  private retry = 0;
  private retryAt = 0;
  private readonly seen = new Set<string>();
  private readonly listener = {
    onDisconnect: (r: string) => this.dropped(r),
    onRoomDisconnect: (r: string) => this.dropped(r),
  };
  private helloAt = 0;
  private readonly onPageHide = (): void => {
    if (this.inHubRoom) this.api.hubBye();
  };
  /** bfcache 복원: pagehide 때 hubBye로 숨겨졌으니 다시 입장 */
  private readonly onPageShow = (e: PageTransitionEvent): void => {
    if (e.persisted) this.dropped('pageshow', true);
  };

  private readonly client: NetClient;
  private readonly events: HubEvents;

  constructor(client: NetClient, events: HubEvents) {
    this.client = client;
    this.events = events;
    this.api = new LobbyApi(client);
    client.listeners.add(this.listener);
    addEventListener('pagehide', this.onPageHide);
    addEventListener('pageshow', this.onPageShow);
  }

  get active(): boolean {
    return this.wanted;
  }

  /** 같은 광장 인원 (나 포함, 접속 완료 때만) */
  get count(): number | null {
    return this.status === 'online' ? 1 + this.peers.size : null;
  }

  private get inHubRoom(): boolean {
    return this.status === 'online' && isHubRoom(this.client.currentRoomId);
  }

  /** 광장 접속 시작 (이미 시작했으면 정보만 갱신). 연결이 없는 빌드면 offline으로 끝 */
  start(world: number, info: HubInfo): void {
    this.setInfo(info);
    if (this.wanted) return;
    this.world = world;
    this.wanted = true;
    this.retry = 0;
    void this.enter();
  }

  /** 광장에서 나감: 다른 사람 화면에서 바로 숨김 → 룸 퇴장 → 원격 사람 정리 */
  async stop(): Promise<void> {
    if (!this.wanted && this.status === 'idle') return;
    this.wanted = false;
    this.token++;
    if (this.inHubRoom) {
      await Promise.race([this.client.call('hubBye').catch(() => undefined), new Promise((r) => setTimeout(r, 600))]);
    }
    this.leaveHubRoom();
    this.status = 'idle';
    this.roomId = null;
  }

  /**
   * 내 보이는 정보 (바뀐 칸만 다음 update에서 hubInfo). 값은 서버 규칙으로 먼저 정리 (잘못된 값으로 거절당해 전체가 안 바뀌는 일 없게).
   * 환생·공격력이 바뀌면 저장 뒤에 한 번 더 보냄 (savedCovers)
   */
  setInfo(info: Partial<HubInfo>): void {
    for (const k of INFO_KEYS) {
      const v = info[k];
      if (v === undefined) continue;
      const ok = sanitizeHubField(k, k === 'r' ? Math.floor(v as number) : v);
      if (ok === undefined) continue;
      if ((k === 'r' || k === 'pw' || k === 'q') && ok !== this.info[k]) this.resendRP = true;
      (this.info as unknown as Record<string, unknown>)[k] = ok;
    }
  }

  /** 상태만 바꿈 (매 프레임 비교해 바뀔 때만 부름, 객체 할당 없음) */
  setStatus(s: HubStatus): void {
    this.info.s = s;
  }

  /**
   * 계정 저장이 끝남 (CloudSave): 저장한 환생·공격력이 지금 값 이상이면 서버 상한이 풀렸으니 다시 보냄.
   * 저장 전에 보낸 hubInfo·hubHello는 낮게 잘렸을 수 있음
   */
  savedCovers(rebirths: number, power: number): void {
    if (!this.resendRP || !this.inHubRoom) return;
    if (rebirths < this.info.r || power < this.info.pw * (1 - 1e-9)) return;
    this.resendRP = false;
    // 보낸 값을 비워서 다음 update가 r·pw를 다시 보내게
    this.sent.r = -1;
    this.sent.pw = -1;
    this.sent.q = -1;
  }

  /**
   * 매 프레임: 다시 입장 시도 + 보이는 정보 + 내 위치 (최대 6회/초, 안 움직이면 보내지 않음).
   * local = null이면 위치를 보내지 않음 (전투 중: game.pos가 전투장 좌표)
   */
  update(dt: number, local: HubLocal | null): void {
    if (this.wanted && this.status === 'disconnected' && performance.now() >= this.retryAt) void this.enter();
    if (!this.inHubRoom) return;
    this.flushInfo();
    if (!local) return;
    this.sendTimer += dt * 1000;
    if (this.sendTimer < HUB_TIMING.sendIntervalMs) return;
    this.sendTimer = 0;
    const x = r2(local.x);
    const z = r2(local.z);
    const yaw = r2(local.yaw);
    const vx = r1(local.vx);
    const vz = r1(local.vz);
    const l = this.last;
    // 멈춰 있고 직전 패킷도 멈춘 상태로 같은 자리면 건너뜀 (멈춘 자리는 직전 패킷이 이미 알림).
    // 훈련 중(비트 2)엔 과녁마다 몸 방향이 바뀌지만 보는 쪽이 과녁을 직접 겨누므로 방향 변화는 무시
    const still = Math.hypot(vx, vz) < 0.05 && Math.hypot(l[5], l[6]) < 0.05;
    const yawSame = (local.f & 2) !== 0 || Math.abs(yaw - l[4]) < 0.02;
    if (this.hasLast && still && local.f === l[7] && Math.abs(x - l[2]) < 0.01 && Math.abs(z - l[3]) < 0.01 && yawSame) {
      this.stats.skipped++;
      return;
    }
    l[0] = ++this.seq;
    l[1] = Math.round(performance.now());
    l[2] = x;
    l[3] = z;
    l[4] = yaw;
    l[5] = vx;
    l[6] = vz;
    l[7] = local.f;
    this.hasLast = true;
    this.stats.sent++;
    // 패킷 배열은 SDK가 직렬화하는 동안 바뀌면 안 되므로 사본 (6회/초)
    this.api.hubMove([l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7]]);
  }

  dispose(): void {
    void this.stop();
    this.client.listeners.delete(this.listener);
    removeEventListener('pagehide', this.onPageHide);
    removeEventListener('pageshow', this.onPageShow);
  }

  // ---------------- 보이는 정보 ----------------

  private flushInfo(): void {
    if (this.infoBusy) return;
    const now = performance.now();
    if (now - this.infoAt < INFO_INTERVAL_MS) return;
    let patch: Partial<HubInfo> | null = null;
    for (const k of INFO_KEYS) {
      if (this.info[k] === this.sent[k]) continue;
      patch ??= {};
      (patch as Record<string, unknown>)[k] = this.info[k];
    }
    if (!patch) return;
    const p = patch;
    Object.assign(this.sent, p);
    this.infoAt = now;
    this.infoBusy = true;
    this.stats.info++;
    const token = this.token;
    this.api
      .hubInfo(p)
      .then((r) => {
        if (r.ok) return;
        this.client.addLog('warn', `hubInfo 거절: ${r.reason ?? '-'}`);
        // 서버가 나를 광장 멤버로 안 봄 (끊김 처리됨 등) → 다시 입장 (hubFind → hello)
        if (r.reason === 'not_joined' && token === this.token) this.dropped('not_joined', true);
      })
      .catch((e) => {
        // 못 보냈으면 다음에 다시 (같은 세션일 때만)
        if (token === this.token) for (const k of Object.keys(p) as (keyof HubInfo)[]) (this.sent as unknown as Record<string, unknown>)[k] = undefined;
        this.client.addLog('warn', `hubInfo: ${errText(e)}`);
      })
      .finally(() => (this.infoBusy = false));
  }

  // ---------------- 입장·퇴장 ----------------

  /**
   * 배정(hubFind) → 입장 → 구독 → 등록(hubHello). full·no_reservation이면 배정부터 다시 (최대 3번).
   * 끊긴 뒤 다시 들어올 때도 같은 길: 유예(30초) 안이면 hubFind가 같은 룸(장부의 끊김 자리)을 주고, hello로 다시 보임
   */
  private async enter(): Promise<void> {
    const token = ++this.token;
    this.status = this.retry > 0 ? 'reconnecting' : 'connecting';
    try {
      if (!(await this.client.connect())) {
        if (token !== this.token) return;
        if (this.client.status === 'no-verse') {
          this.status = 'offline';
          return;
        }
        throw new Error(this.client.statusReason || '연결 실패');
      }
      for (let attempt = 0; attempt < FIND_ATTEMPTS; attempt++) {
        const found = await this.api.hubFind(this.world);
        if (token !== this.token) return;
        if (!found.ok) throw new Error(found.reason);
        // 광장 말고 다른 룸에 있으면 건드리지 않음 (지금은 다른 룸이 없지만 같은 계정 룸은 하나)
        if (this.client.currentRoomId && !isHubRoom(this.client.currentRoomId)) throw new Error('다른 룸에 있음');
        await this.client.joinRoom(found.roomId);
        if (token !== this.token) {
          this.leaveHubRoom();
          return;
        }
        this.client.subscribeUsers((states) => {
          this.stats.recv++;
          this.applyStates(states as HubUser[]);
        });
        const hello = await this.api.hubHello({ ...this.info });
        if (token !== this.token) {
          this.leaveHubRoom();
          return;
        }
        if (hello.ok) {
          this.roomId = found.roomId;
          this.max = hello.max;
          this.status = 'online';
          this.helloAt = performance.now();
          this.retry = 0;
          this.hasLast = false;
          this.sendTimer = HUB_TIMING.sendIntervalMs;
          this.lastError = '';
          Object.assign(this.sent, this.info);
          this.infoAt = performance.now();
          // hello 값도 저장 상한에 잘렸을 수 있음 → 다음 저장 뒤 다시
          this.resendRP = true;
          this.client.addLog('info', `광장 입장 ${found.roomId} (${hello.count}/${hello.max})`);
          // 이미 있던 사람들 (구독 첫 푸시를 기다리지 않고 바로)
          const users = await this.api.hubState().catch(() => null);
          if (token === this.token && users) this.applyStates(users);
          return;
        }
        this.leaveHubRoom();
        if (hello.reason !== 'full' && hello.reason !== 'no_reservation') throw new Error(hello.reason ?? '입장 거절');
      }
      throw new Error('광장 입장 실패 (full·no_reservation 반복)');
    } catch (e) {
      if (token !== this.token) return;
      this.lastError = errText(e);
      this.client.addLog('warn', `광장 입장 실패: ${this.lastError}`);
      this.leaveHubRoom();
      this.status = 'disconnected';
      this.scheduleRetry();
    }
  }

  /** 같은 룸 전체 상태 반영 (구독 푸시·입장 직후 목록 공용): 나타남·바뀜·사라짐. x ≠ 0(끊김·퇴장)·hello 전은 숨김 */
  private applyStates(states: ReadonlyArray<HubUser>): void {
    const now = performance.now();
    const me = this.client.account;
    const seen = this.seen;
    seen.clear();
    for (const u of states) {
      if (!u || typeof u.account !== 'string') continue;
      if (u.account === me) {
        // 서버가 나를 숨김(끊김 처리 등)인데 나는 접속 중이라고 생각함 → 다시 hello하지 않으면 영영 안 보임
        if (u.x !== 0 && this.status === 'online' && now - this.helloAt >= SELF_HIDDEN_GRACE_MS) {
          this.dropped('self_hidden', true);
          return;
        }
        continue;
      }
      if (u.x !== 0 || !Array.isArray(u.p) || typeof u.c !== 'string') continue;
      seen.add(u.account);
      const nick = typeof u.n === 'string' ? u.n : '';
      const c = (sanitizeHubField('c', u.c) as HubInfo['c'] | undefined) ?? 'blue';
      const g = (sanitizeHubField('g', u.g) as number | undefined) ?? 0;
      const r = (sanitizeHubField('r', u.r) as number | undefined) ?? 0;
      const pw = (sanitizeHubField('pw', u.pw) as number | undefined) ?? 0;
      const s = (sanitizeHubField('s', u.s) as HubStatus | undefined) ?? 'hub';
      const q = (sanitizeHubField('q', u.q) as number | undefined) ?? 0;
      let peer = this.peers.get(u.account);
      if (!peer) {
        peer = { account: u.account, nick, char: c, gun: g, rebirths: r, power: pw, status: s, gear: q, buffer: new HubBuffer() };
        this.peers.set(u.account, peer);
        peer.buffer.push(u.p, now);
        this.events.onPeerJoin(peer);
        continue;
      }
      if (nick !== peer.nick || c !== peer.char || g !== peer.gun || r !== peer.rebirths || pw !== peer.power || s !== peer.status || q !== peer.gear) {
        peer.gear = q;
        peer.nick = nick;
        peer.char = c;
        peer.gun = g;
        peer.rebirths = r;
        peer.power = pw;
        peer.status = s;
        this.events.onPeerChange(peer);
      }
      if (u.p[0] !== peer.buffer.lastSeq) peer.buffer.push(u.p, now);
    }
    for (const acc of this.peers.keys()) if (!seen.has(acc)) this.removePeer(acc);
  }

  /** 실제 끊김 (SDK 알림, 의도적인 퇴장은 오지 않음) → 정리 후 다시 입장 (hubFind → hello) */
  /**
   * leave = true: 연결은 살아 있고 룸에도 있지만 서버가 나를 숨김(self_hidden·not_joined·bfcache 복원) → 룸을 정식으로 나간 뒤 다시 입장
   */
  private dropped(reason: string, leave = false): void {
    if (!this.wanted || (this.status !== 'online' && this.status !== 'connecting' && this.status !== 'reconnecting')) return;
    if (this.client.currentRoomId && !isHubRoom(this.client.currentRoomId)) return;
    this.client.addLog('warn', `광장 연결 끊김 (${reason || '-'}) → 다시 입장`);
    this.token++;
    if (leave) this.leaveHubRoom();
    else this.client.dropRoom();
    this.clearPeers();
    this.status = 'disconnected';
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    this.retryAt = performance.now() + RETRY_MS[Math.min(this.retry, RETRY_MS.length - 1)]!;
    this.retry++;
  }

  /** 광장 룸에 있으면 나감 + 원격 사람 정리 */
  private leaveHubRoom(): void {
    if (isHubRoom(this.client.currentRoomId)) this.client.leaveRoom();
    this.clearPeers();
  }

  private clearPeers(): void {
    for (const acc of [...this.peers.keys()]) this.removePeer(acc);
  }

  private removePeer(account: string): void {
    if (!this.peers.delete(account)) return;
    this.events.onPeerLeave(account);
  }
}

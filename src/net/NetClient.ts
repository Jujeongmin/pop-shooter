// Verse8 Agent8 SDK(@agent8/gameserver) 연결 하나. 게임 객체(three.js)는 모른다.
// pop-battle src/net/NetClient.ts에서 복사해 광장에 필요한 것만 남김 (2026-11-11): 지연 시뮬레이션·통계 뺌.
// SDK 연결은 계정당 하나 → 계정 저장(CloudSave)·광장(LobbyApi)이 이 클라이언트를 함께 씀.
// SDK는 connect 안에서 동적 import: 모듈 초기화가 던져도(localStorage 막힌 iframe 등, storageFallback.ts 참고) 게임 부팅은 계속.
// SDK index는 React 훅까지 끌어오므로 클래스 파일만 import.
import type { GameServer } from '@agent8/gameserver/dist/src/server/GameServer.js';

export type NetStatus = 'idle' | 'no-verse' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface NetLogEntry {
  t: number;
  level: 'info' | 'warn' | 'error';
  text: string;
}

const CONNECT_TIMEOUT_MS = 5000;
const CALL_TIMEOUT_MS = 6000;

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined;
  const timer = new Promise<T>((_, rej) => { id = setTimeout(() => rej(new Error('timeout')), ms); });
  return Promise.race([p, timer]).finally(() => clearTimeout(id));
}

/** 개발 서버 전용 verse 직접 지정 (?verse=). 없으면 .env */
function verseOverride(): string | null {
  if (!import.meta.env.DEV) return null;
  try {
    return new URLSearchParams(location.search).get('verse')?.trim() || null;
  } catch {
    return null;
  }
}

/** 이 빌드에 verse가 있는지 (.env의 VITE_AGENT8_VERSE — Verse8 저장소에서는 플랫폼이 관리) */
function configuredVerse(): string | null {
  return verseOverride() || (import.meta.env.VITE_AGENT8_VERSE as string | undefined)?.trim() || null;
}

/**
 * 접속할 verse: 개발 서버는 <verse>-preview(develop 푸시가 배포되는 곳), 배포 빌드는 <verse> (SDK 문서 규칙).
 * Vite 개발 서버 사전 번들에서는 SDK가 import.meta.env를 못 읽어 'default'로 가므로 직접 계산해 넘김. ?verse= 지정은 그대로
 */
function targetVerse(configured: string): string {
  const o = verseOverride();
  if (o) return o;
  return import.meta.env.DEV ? `${configured}-preview` : configured;
}

export function errText(e: unknown): string {
  if (e instanceof Error) {
    const code = (e as Error & { code?: string }).code;
    return code ? `${code}: ${e.message}` : e.message;
  }
  try {
    return typeof e === 'string' ? e : JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/**
 * 연결 실패(verse 없음·네트워크·시간 초과) = 혼자 모드: connect가 false, 호출은 던짐(호출한 쪽이 잡음).
 * 끊긴 뒤 다시 connect하면 새 SDK 객체로 다시 붙음 (serverEpoch가 바뀜 → 구독자는 다시 걸어야 함)
 */
export class NetClient {
  readonly log: NetLogEntry[] = [];
  status: NetStatus = 'idle';
  statusReason = '';
  private readonly configured = configuredVerse();
  private server: GameServer | null = null;
  private roomId: string | null = null;
  private readonly offs: Array<() => void> = [];
  private connecting: Promise<boolean> | null = null;
  /** 룸 구독이 바뀔 때마다 1씩 (입장·퇴장·끊김 정리 → 구독자가 다시 걸어야 하는지 판단) */
  roomEpoch = 0;
  /** SDK 연결 객체가 바뀔 때마다 1씩 (전체 메시지 구독은 연결 객체에 붙음) */
  serverEpoch = 0;
  /**
   * 구독자 (계정 저장·광장): 의도적인 퇴장(leaveRoom·다른 룸 joinRoom)은 SDK가 끊김 알림을 보내지 않음 → 실제 끊김에만 불림
   */
  readonly listeners = new Set<{ onDisconnect?(reason: string): void; onRoomDisconnect?(reason: string): void }>();

  constructor() {
    if (!this.configured) {
      this.status = 'no-verse';
      this.statusReason = 'VITE_AGENT8_VERSE 없음 (배포 전)';
    }
  }

  /** 이 빌드에 verse가 있음 (없으면 연결을 시도하지 않음 — 공용 'default' verse에 붙지 않게) */
  get hasVerse(): boolean {
    return !!this.configured;
  }

  get verse(): string | null {
    return this.server?.verse ?? (this.configured ? targetVerse(this.configured) : null);
  }

  /** 접속한 계정 (연결 전·실패면 '') */
  get account(): string {
    return this.server?.account ?? '';
  }

  get currentRoomId(): string | null {
    return this.roomId;
  }

  get connected(): boolean {
    return this.status === 'connected' && !!this.server?.connected;
  }

  get rsConnected(): boolean {
    return !!this.server?.rsConnected;
  }

  addLog(level: NetLogEntry['level'], text: string): void {
    this.log.push({ t: performance.now(), level, text });
    if (this.log.length > 80) this.log.shift();
    if (level === 'error') console.warn('[net]', text);
  }

  private setStatus(s: NetStatus, reason = ''): void {
    this.status = s;
    this.statusReason = reason;
    this.addLog(s === 'error' ? 'error' : 'info', `연결 상태 ${s}${reason ? ` (${reason})` : ''}`);
  }

  /** 게임 서버 연결 (동시에 여러 곳이 불러도 연결은 하나: 진행 중이면 같은 결과를 기다림) */
  connect(timeoutMs = CONNECT_TIMEOUT_MS): Promise<boolean> {
    if (this.connecting) return this.connecting;
    this.connecting = this.connectOnce(timeoutMs).finally(() => (this.connecting = null));
    return this.connecting;
  }

  private async connectOnce(timeoutMs: number): Promise<boolean> {
    if (!this.configured) {
      this.setStatus('no-verse', 'VITE_AGENT8_VERSE 없음');
      return false;
    }
    if (this.connected) return true;
    this.setStatus('connecting');
    // 끊긴 이전 연결이 남아 있으면 정리 (재접속 때 소켓·구독이 겹치지 않게)
    if (this.server) {
      this.dropRoom();
      const old = this.server;
      this.server = null;
      try { old.disconnect().catch(() => undefined); } catch { /* 이미 끊김 */ }
    }
    let s: GameServer | null = null;
    try {
      const { GameServer: Server } = await import('@agent8/gameserver/dist/src/server/GameServer.js');
      // 계정: SDK가 ?account= 를 읽음 (인증 토큰이 없을 때만). 같은 브라우저 두 탭은 계정을 따로 줘야 함 (공식 문서)
      s = new Server({
        verse: targetVerse(this.configured),
        onDisconnect: (code, reason) => {
          if (this.server !== s) return;
          this.setStatus('disconnected', `code ${code ?? '-'} ${reason ?? ''}`.trim());
          for (const l of this.listeners) l.onDisconnect?.(reason ?? String(code ?? ''));
        },
        onError: (e) => this.addLog('error', `GS 오류: ${errText(e)}`),
        onRsDisconnect: (code, reason) => {
          if (this.server !== s) return;
          this.addLog('warn', `룸 서버 연결 끊김 code ${code ?? '-'} ${reason ?? ''}`);
          for (const l of this.listeners) l.onRoomDisconnect?.(reason ?? String(code ?? ''));
        },
        onRsError: (e) => this.addLog('error', `RS 오류: ${errText(e)}`),
      });
      this.server = s;
      this.serverEpoch++;
      const ok = await withTimeout(s.connect(), timeoutMs);
      if (!ok || !s.account) throw new Error('connect() false');
      this.setStatus('connected', `verse ${s.verse}`);
      return true;
    } catch (e) {
      // 버린 연결은 끊음 (시간 초과 뒤 늦게 붙어 소켓이 남지 않게)
      if (this.server === s) this.server = null;
      try { s?.disconnect().catch(() => undefined); } catch { /* 이미 끊김 */ }
      this.setStatus('error', errText(e));
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.leaveRoom();
    try {
      await this.server?.disconnect();
    } catch (e) {
      this.addLog('warn', `disconnect: ${errText(e)}`);
    }
    this.server = null;
    this.setStatus('idle', '연결 해제');
  }

  async joinRoom(roomId: string): Promise<void> {
    const s = this.requireServer();
    // 다른 룸의 구독이 남아 있으면 먼저 해제 (같은 콜백이 두 번 걸리거나 새 구독이 풀리지 않게)
    for (const off of this.offs.splice(0)) off();
    this.roomEpoch++;
    await s.joinRoom(roomId);
    this.roomId = roomId;
    this.roomEpoch++;
    this.addLog('info', `룸 입장 ${roomId}`);
  }

  /** 룸 구독만 정리 (연결이 이미 끊겼을 때). 다시 들어가면 구독이 두 번 걸리지 않게 */
  dropRoom(): void {
    for (const off of this.offs.splice(0)) off();
    this.roomEpoch++;
    this.roomId = null;
  }

  leaveRoom(): void {
    for (const off of this.offs.splice(0)) off();
    this.roomEpoch++;
    if (this.roomId && this.server) {
      try { this.server.leaveRoom(); } catch (e) { this.addLog('warn', `leaveRoom: ${errText(e)}`); }
      this.addLog('info', `룸 퇴장 ${this.roomId}`);
    }
    this.roomId = null;
  }

  /** 일반 호출 (응답 있음, 시간 제한). 함수 이름당 초당 10회 (SDK가 클라이언트에서 셈) */
  async call<T>(name: string, args: unknown[] = [], timeoutMs = CALL_TIMEOUT_MS): Promise<T> {
    const s = this.requireServer();
    return (await withTimeout(s.remoteFunction(name, args), timeoutMs)) as T;
  }

  /** 응답 없는 호출 (탭 닫힐 때 퇴장 알림 등) */
  fire(name: string, args: unknown[] = []): void {
    if (!this.server?.connected) return;
    this.server.remoteFunction(name, args, { needResponse: false }).catch(() => undefined);
  }

  /** 상태 스트림 (throttle 호출, 응답 없음). 호출 간격이 throttle 창보다 길어야 버려지지 않는다 */
  stream(name: string, args: unknown[], throttleMs: number): void {
    const s = this.server;
    if (!s?.rsConnected) return;
    s.remoteFunction(name, args, { throttle: throttleMs }).catch((e) => this.addLog('error', `${name}: ${errText(e)}`));
  }

  /** 룸 메시지 구독. 룸을 나가면 자동 해제, 돌려준 함수로 먼저 해제할 수도 있음 */
  onRoomMessage<T>(type: string, cb: (msg: T) => void): () => void {
    const s = this.requireServer();
    const raw = s.onRoomMessage(this.requireRoom(), type, cb);
    let done = false;
    const off = () => {
      if (done) return;
      done = true;
      const i = this.offs.indexOf(off);
      if (i >= 0) this.offs.splice(i, 1);
      raw();
    };
    this.offs.push(off);
    return off;
  }

  /** 룸 전체 사용자 상태 (SDK가 바뀔 때마다 전체 목록 푸시, 바뀐 항목은 __updated). 룸을 나가면 자동 해제 */
  subscribeUsers(cb: (states: Array<Record<string, unknown> & { account: string; __updated?: boolean }>) => void): void {
    const s = this.requireServer();
    this.offs.push(s.subscribeRoomAllUserStates(this.requireRoom(), cb));
  }

  private requireServer(): GameServer {
    if (!this.server) throw new Error('서버에 연결되지 않음');
    return this.server;
  }

  private requireRoom(): string {
    if (!this.roomId) throw new Error('룸에 들어가 있지 않음');
    return this.roomId;
  }
}

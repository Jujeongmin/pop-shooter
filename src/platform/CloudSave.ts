// 계정 저장: 서버 함수 saveLoad·saveWrite 래퍼. 게임 객체는 모름.
// SDK 연결은 계정당 하나 → NetClient(net/NetClient.ts)를 광장과 함께 씀. SDK 동적 import·시간 제한·실패 정리는 NetClient가 함
// (모듈 초기화가 던져도(localStorage 막힘 등) 게임 부팅은 계속, 기기 저장으로).
import { NetClient } from '../net/NetClient';

const CONNECT_TIMEOUT_MS = 5000;
const CALL_TIMEOUT_MS = 6000;

export interface CloudLoad {
  save: Record<string, unknown> | null;
  /** 서버 지금 시각 (ms) */
  now: number;
}

/**
 * 서버 연결이 안 되면(verse 없음·네트워크·시간 초과) online = false → 게임은 기기 저장만으로 계속.
 * 저장은 실패해도 던지지 않음 (다음 저장 때 다시 보냄).
 */
/** saveWrite 응답 (server/src/server.ts SaveWriteResult) */
export interface ServerSaveReply {
  ok: boolean;
  reason?: string;
  prem?: { gems: number; passMult: number; boostUntil: number; chars: string[]; char: string };
  /** 코인을 상한으로 잘랐으면 서버 코인 */
  coins?: number;
  /** 거절됐으면 서버에 남은 저장 (그대로 받아들임) */
  fix?: Record<string, unknown>;
}

export class CloudSave {
  online = false;
  account: string | null = null;
  private writing: Promise<unknown> | null = null;
  private pending: Record<string, unknown> | null = null;

  /** 서버 저장 성공 알림 (광장: 서버가 저장값으로 환생·공격력 상한을 쓰므로 저장 뒤 보이는 정보를 다시 보냄) */
  readonly onSaved = new Set<(save: Record<string, unknown>) => void>();
  /** 서버가 정한 값 (프리미엄·잘린 코인·거절 시 서버 저장) → 게임이 맞춤 */
  readonly onServerState = new Set<(r: ServerSaveReply) => void>();

  /** 광장과 함께 쓰는 연결 */
  readonly net: NetClient;

  constructor(net: NetClient = new NetClient()) {
    this.net = net;
  }

  async connect(): Promise<boolean> {
    if (!this.net.hasVerse) return false;
    const ok = await this.net.connect(CONNECT_TIMEOUT_MS);
    if (ok && this.net.account) {
      this.account = this.net.account;
      this.online = true;
      return true;
    }
    return false;
  }

  async load(): Promise<CloudLoad | null> {
    if (!this.online) return null;
    try {
      const r = await this.net.call<{ ok: boolean; save: Record<string, unknown> | null; now: number }>('saveLoad', [], CALL_TIMEOUT_MS);
      return r && r.ok ? { save: r.save, now: r.now } : null;
    } catch {
      return null;
    }
  }

  /** 저장 보내기: 보내는 중이면 마지막 것만 이어서 보냄 (함수 호출 빈도 제한 안 넘게) */
  write(save: Record<string, unknown>): void {
    if (!this.online) return;
    this.pending = save;
    if (this.writing) return;
    const flush = async (): Promise<void> => {
      while (this.pending) {
        const s = this.pending;
        this.pending = null;
        let ok = false;
        try {
          const r = await this.net.call<ServerSaveReply | null>('saveWrite', [s], CALL_TIMEOUT_MS);
          ok = !!r && r.ok !== false;
          if (r && (r.prem || r.fix)) for (const fn of this.onServerState) { try { fn(r); } catch { /* 맞추기 실패는 저장과 무관 */ } }
        } catch { /* 다음 저장 때 다시 */ }
        if (ok) for (const fn of this.onSaved) { try { fn(s); } catch { /* 알림 실패는 저장과 무관 */ } }
      }
      this.writing = null;
    };
    this.writing = flush();
  }
}

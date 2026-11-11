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
export class CloudSave {
  online = false;
  account: string | null = null;
  private writing: Promise<unknown> | null = null;
  private pending: Record<string, unknown> | null = null;

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
        try { await this.net.call('saveWrite', [s], CALL_TIMEOUT_MS); } catch { /* 다음 저장 때 다시 */ }
      }
      this.writing = null;
    };
    this.writing = flush();
  }
}

// 계정 저장: Verse8 Agent8 SDK 래퍼 (서버 함수 saveLoad·saveWrite). 게임 객체는 모름.
// SDK index는 React 훅까지 끌어오므로 클래스 파일만 import (pop-battle과 같은 방식).
import { GameServer } from '@agent8/gameserver/dist/src/server/GameServer.js';

const CONNECT_TIMEOUT_MS = 5000;
const CALL_TIMEOUT_MS = 6000;

/**
 * 접속할 verse: 개발 서버는 <verse>-preview, 배포 빌드는 <verse> (SDK 문서 규칙).
 * Vite 개발 서버 사전 번들에서는 SDK가 import.meta.env를 못 읽어 'default'로 가므로 직접 넘김.
 */
function targetVerse(): string | null {
  const v = (import.meta.env.VITE_AGENT8_VERSE as string | undefined)?.trim();
  if (!v) return null;
  return import.meta.env.DEV ? `${v}-preview` : v;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

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
  private server: GameServer | null = null;
  online = false;
  account: string | null = null;
  private writing: Promise<unknown> | null = null;
  private pending: Record<string, unknown> | null = null;

  async connect(): Promise<boolean> {
    const verse = targetVerse();
    if (!verse) return false;
    try {
      const s = new GameServer({ verse });
      const ok = await withTimeout(s.connect(), CONNECT_TIMEOUT_MS);
      if (!ok) return false;
      this.server = s;
      this.account = s.account || null;
      this.online = !!this.account;
      return this.online;
    } catch {
      return false;
    }
  }

  async load(): Promise<CloudLoad | null> {
    if (!this.server || !this.online) return null;
    try {
      const r = (await withTimeout(this.server.remoteFunction('saveLoad', []), CALL_TIMEOUT_MS)) as { ok: boolean; save: Record<string, unknown> | null; now: number };
      return r && r.ok ? { save: r.save, now: r.now } : null;
    } catch {
      return null;
    }
  }

  /** 저장 보내기: 보내는 중이면 마지막 것만 이어서 보냄 (함수 호출 빈도 제한 안 넘게) */
  write(save: Record<string, unknown>): void {
    if (!this.server || !this.online) return;
    this.pending = save;
    if (this.writing) return;
    const flush = async (): Promise<void> => {
      while (this.pending) {
        const s = this.pending;
        this.pending = null;
        try { await withTimeout(this.server!.remoteFunction('saveWrite', [s]), CALL_TIMEOUT_MS); } catch { /* 다음 저장 때 다시 */ }
      }
      this.writing = null;
    };
    this.writing = flush();
  }
}

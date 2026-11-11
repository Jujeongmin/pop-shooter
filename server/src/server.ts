/**
 * POP Shooter 서버: 계정별 진행 저장 (원본 = Verse8 글로벌 사용자 상태 `save`).
 * - 계정은 인자가 아니라 $sender.account (플랫폼이 인증, 클라이언트가 못 바꿈).
 * - 저장값은 sim/normalize로 형식·범위를 고친 뒤 저장, lastSeen은 서버 시각으로 찍음 (오프라인 보상 = 서버 시각 기준).
 * - 같은 계정 동시 저장은 $lock으로 한 줄로.
 * - 코인 증가량 상한 검사(스펙 7장)는 아직 없음 → 기록은 공식 랭킹이 아님.
 * 위치·전투 중 상태는 저장하지 않음: 다시 켜면 늘 광장 시작 지점, 끝나지 않은 연속 도전은 버려짐.
 */
import { normalizeState } from '../../src/sim/normalize.ts';

/** 저장 한 건 최대 크기 (문서 1MB 한도보다 훨씬 작게) */
const MAX_SAVE_CHARS = 20000;

function saveOf(st: unknown): Record<string, unknown> | null {
  if (!st || typeof st !== 'object') return null;
  const s = (st as { save?: unknown }).save;
  return s && typeof s === 'object' ? (s as Record<string, unknown>) : null;
}

export class Server {
  /** 내 저장 + 서버 지금 시각 (오프라인 보상 계산용) */
  async saveLoad(): Promise<{ ok: true; save: Record<string, unknown> | null; now: number }> {
    const st = await $global.getMyState();
    return { ok: true, save: saveOf(st), now: Date.now() };
  }

  /** 저장: 형식 고쳐서 저장, lastSeen = 서버 시각 */
  async saveWrite(raw: unknown): Promise<{ ok: boolean; reason?: string; now: number }> {
    const now = Date.now();
    let size = 0;
    try { size = JSON.stringify(raw).length; } catch { return { ok: false, reason: 'bad', now }; }
    if (!raw || typeof raw !== 'object' || size > MAX_SAVE_CHARS) return { ok: false, reason: 'bad', now };
    const account = $sender.account;
    await $lock(`save:${account}`, async () => {
      const clean = normalizeState(raw, now);
      await $global.updateMyState({ save: { ...clean, lastSeen: now } });
    });
    return { ok: true, now };
  }
}

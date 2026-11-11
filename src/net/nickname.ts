// 표시용 닉네임의 이 기기 사본 (localStorage). pop-battle에서 복사 (2026-11-11).
// 원본은 서버의 계정별 글로벌 사용자 상태(nickGet·nickSet) — 서버 연결 전·혼자 모드에서는 이 값을 씀. 화면 표시에만 씀.
// 규칙(길이·허용 문자·금칙어)은 서버와 같은 checkNickname (shared/nickFilter.ts).
import { sanitizeNick } from './shared/nickFilter.ts';

const KEY = 'popshooter.nick';

/** 저장된 닉네임 (없거나 규칙에 안 맞으면 null) */
export function loadNickname(): string | null {
  try {
    return sanitizeNick(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function clearNickname(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}

export function saveNickname(nick: string): void {
  try {
    localStorage.setItem(KEY, nick);
  } catch {
    // 저장 못 해도 이번 접속에서는 그대로 사용
  }
}

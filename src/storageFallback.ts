// localStorage가 막힌 iframe(서드파티 쿠키 차단 등)에서는 window.localStorage를 읽기만 해도 던짐.
// Agent8 SDK(GameServer 클래스의 static 초기화)가 try 없이 localStorage를 읽어서 모듈 그래프 전체가 죽음(검은 화면).
// main.ts 맨 첫 import로 먼저 실행해서, 막혀 있으면 메모리 저장소로 바꿔 끼움 (새로고침하면 사라짐). 지우지 말 것.

class MemoryStorage implements Storage {
  private readonly m = new Map<string, string>();
  get length(): number { return this.m.size; }
  clear(): void { this.m.clear(); }
  getItem(key: string): string | null { return this.m.has(key) ? this.m.get(key)! : null; }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
  removeItem(key: string): void { this.m.delete(key); }
  setItem(key: string, value: string): void { this.m.set(key, String(value)); }
}

function usable(name: 'localStorage' | 'sessionStorage'): boolean {
  try {
    const s = window[name];
    const k = '__popshooter_probe__';
    s.setItem(k, '1');
    s.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (usable(name)) continue;
  try {
    Object.defineProperty(window, name, { value: new MemoryStorage(), configurable: true, writable: false });
  } catch { /* 못 바꾸면 각 저장 코드의 try에 맡김 */ }
}

export {};

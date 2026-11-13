// 서버 런타임(isolated-vm)에 있는 console (로그는 Verse8 서버 콘솔로).
// Node 타입 전체(@types/node)는 넣지 않음: 서버 런타임에는 fs·process 등이 없어서, 쓰면 타입검사에서 걸리게
declare const console: { log(...args: unknown[]): void };

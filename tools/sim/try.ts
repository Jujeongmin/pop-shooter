// 임시: 월드 체력 배수를 바꿔 simulate 실행 (node tools/sim/try.ts 1,120,12,0.8,a,b,c,d)
import { BALANCE } from '../../src/sim/balance.ts';
const v = (process.argv[2] ?? '').split(',').map(Number);
(BALANCE.worldHpMult as unknown as number[]).splice(0, v.length, ...v);
await import('./simulate.ts');

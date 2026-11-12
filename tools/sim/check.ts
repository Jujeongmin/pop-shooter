// 진행이 막히지 않는지만 확인 (사용자 2026-11-12: 플레이 시간 목표에 맞춰 조정하지 않음). 0 = 모든 월드 대장까지 도달
import { execFileSync } from 'node:child_process';
const out = execFileSync('node', ['tools/sim/simulate.ts', '--hours', '150'], { encoding: 'utf8' });
let ok = true;
for (let w = 1; w <= 8; w++) {
  const m = out.match(new RegExp(String.raw`^${w}-10\s+(\d+)h(\d+)m`, 'm'));
  ok &&= !!m;
  console.log(`${w}-10 ${m ? `${m[1]}h${m[2]}m` : 'not reached'}`);
}
process.exit(ok ? 0 : 1);

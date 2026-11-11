// 표가 스펙 4.7 목표 범위 안인지 (npm run sim 출력 형식을 직접 계산): 0 = 통과
import { execFileSync } from 'node:child_process';
const out = execFileSync('node', ['tools/sim/simulate.ts'], { encoding: 'utf8' });
const min = (label: string): number => {
  const m = out.match(new RegExp(String.raw`^${label}\s+(\d+)h(\d+)m`, 'm'));
  return m ? Number(m[1]) * 60 + Number(m[2]) : Infinity;
};
const ranges: [string, number, number][] = [['1-1', 0, 2], ['1-10', 20, 45], ['2-10', 150, 210], ['3-10', 300, 420], ['4-10', 600, 780]];
let ok = true;
for (const [l, lo, hi] of ranges) {
  const v = min(l);
  const pass = v >= lo && v <= hi;
  ok &&= pass;
  console.log(`${l} ${v}min [${lo}-${hi}] ${pass ? 'ok' : 'OUT'}`);
}
process.exit(ok ? 0 : 1);

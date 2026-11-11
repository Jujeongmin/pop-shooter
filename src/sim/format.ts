/** 큰 숫자 표기: 1.23K → 45.6M → 7.80B → 1.50T → 2.00aa, ab … az, ba … (1000배마다). 유효숫자 3자리, 내림 */
const NAMED = ['', 'K', 'M', 'B', 'T'];

function unitName(k: number): string {
  if (k < NAMED.length) return NAMED[k]!;
  const j = k - NAMED.length;
  return String.fromCharCode(97 + Math.floor(j / 26)) + String.fromCharCode(97 + (j % 26));
}

function floorTo(v: number, decimals: number): string {
  const p = 10 ** decimals;
  return (Math.floor(v * p + 1e-7) / p).toFixed(decimals);
}

export function formatNum(n: number): string {
  if (Number.isNaN(n) || n <= 0) return '0';
  if (!Number.isFinite(n)) return '∞';
  if (n < 1000) return String(Math.floor(n));
  let k = Math.floor(Math.log10(n) / 3);
  let m = n / 1000 ** k;
  if (m >= 1000) { k++; m /= 1000; }
  else if (m < 1) { k--; m *= 1000; }
  const decimals = m < 10 ? 2 : m < 100 ? 1 : 0;
  return floorTo(m, decimals) + unitName(k);
}

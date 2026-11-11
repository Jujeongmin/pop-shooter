export type Collider =
  | { kind: 'circle'; x: number; z: number; r: number }
  | { kind: 'box'; x: number; z: number; hx: number; hz: number };

export interface Bounds { hx: number; hz: number }

const MAX_STEP = 0.15;

function resolve(p: { x: number; z: number }, radius: number, colliders: readonly Collider[]): void {
  for (const c of colliders) {
    if (c.kind === 'circle') {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const min = c.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      if (d < 1e-6) { p.z = c.z - min; continue; }
      p.x = c.x + (dx / d) * min;
      p.z = c.z + (dz / d) * min;
    } else {
      const cx = Math.max(c.x - c.hx, Math.min(p.x, c.x + c.hx));
      const cz = Math.max(c.z - c.hz, Math.min(p.z, c.z + c.hz));
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-12) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * radius;
        p.z = cz + (dz / d) * radius;
      } else {
        // 중심이 상자 안: 가장 가까운 면으로
        const ox = c.hx - Math.abs(p.x - c.x);
        const oz = c.hz - Math.abs(p.z - c.z);
        if (ox < oz) p.x = c.x + Math.sign(p.x - c.x || 1) * (c.hx + radius);
        else p.z = c.z + Math.sign(p.z - c.z || 1) * (c.hz + radius);
      }
    }
  }
}

/** 원형 캐릭터를 (dx, dz)만큼 옮김: 작은 걸음으로 나눠 밀어내기(벽 따라 미끄러짐) + 경계 */
export function moveWithColliders(
  x: number, z: number, dx: number, dz: number, radius: number, colliders: readonly Collider[], bounds: Bounds,
): { x: number; z: number } {
  const p = { x, z };
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_STEP));
  for (let i = 0; i < steps; i++) {
    p.x += dx / steps;
    p.z += dz / steps;
    resolve(p, radius, colliders);
    p.x = Math.max(-bounds.hx + radius, Math.min(bounds.hx - radius, p.x));
    p.z = Math.max(-bounds.hz + radius, Math.min(bounds.hz - radius, p.z));
  }
  return p;
}

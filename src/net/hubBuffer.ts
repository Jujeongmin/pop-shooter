// 광장 원격 플레이어 위치 보간 (순수 계산, three.js 없음 → node 테스트).
// pop-battle SnapshotBuffer를 광장 패킷(HubPacket, 평지)에 맞게 줄임: 보낸 시각을 로컬 시각으로 옮겨(가장 빨리 온 패킷 기준 오프셋)
// 도착 흔들림을 없애고, 화면은 "지금 - HUB_TIMING.interpDelayMs" 시점을 두 스냅샷 사이로 보간. 최신보다 앞서면 속도로 짧게 외삽 후 멈춤.
// 매 프레임 할당 없음: 고정 크기 고리 버퍼 + 결과는 부르는 쪽 객체에 씀.
import type { HubPacket } from './shared/hub.ts';

export interface HubSample {
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  /** 가까운 쪽 패킷의 비트 (1 걷는 중 · 2 훈련 발사) */
  f: number;
}

interface Snap {
  time: number;
  q: number;
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  f: number;
}

/** 고리 버퍼 크기: 6회/초 × 1.5초 보관 + 여유 */
const CAP = 16;
/** 이 시간(ms)보다 오래된 스냅샷은 버림 (최소 2개는 남김) */
const KEEP_MS = 1500;

function lerpAngle(a: number, b: number, t: number): number {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
}

export class HubBuffer {
  private readonly snaps: Snap[] = Array.from({ length: CAP }, () => ({ time: 0, q: 0, x: 0, z: 0, yaw: 0, vx: 0, vz: 0, f: 0 }));
  /** 가장 오래된 칸 index, 개수 */
  private head = 0;
  private n = 0;
  private offset: number | null = null;
  private lastRelax = 0;
  lastSeq = -1;
  /** 외삽 최대 시간 (ms, pop-battle 로비 값) */
  maxExtrapolateMs = 150;
  /** 이 거리(m)보다 크게 움직이면 보간하지 않고 바로 이동 (순간이동: 시설 스냅·전투 복귀) */
  teleportDistance = 4;
  /** 마지막 패킷 뒤 이 시간(ms)이 지나면 멈춘 것으로 (속도 0 → 제자리 달리기 방지) */
  staleMs = 600;

  get size(): number {
    return this.n;
  }

  private at(i: number): Snap {
    return this.snaps[(this.head + i) % CAP]!;
  }

  clear(): void {
    this.head = 0;
    this.n = 0;
    this.offset = null;
    this.lastSeq = -1;
  }

  /** 패킷 넣기 (now = 받은 로컬 시각 ms). 순번이 같거나 작으면 버림, 아주 작아지면(보낸 쪽 새로고침) 처음부터 */
  push(p: HubPacket, now: number): void {
    if (this.lastSeq >= 0 && p[0] < this.lastSeq - 1000) this.clear();
    if (p[0] <= this.lastSeq) return;
    this.lastSeq = p[0];
    const off = now - p[1];
    // 오프셋 = 관측된 최소 지연. 시계 차이 변화에 따라가게 1초마다 0.5ms씩 늦춤 (pop-battle 그대로)
    if (this.offset === null || off < this.offset) this.offset = off;
    else if (now - this.lastRelax > 1000) {
      this.offset += 0.5;
      this.lastRelax = now;
    }
    let s: Snap;
    if (this.n < CAP) {
      s = this.snaps[(this.head + this.n) % CAP]!;
      this.n++;
    } else {
      s = this.snaps[this.head]!;
      this.head = (this.head + 1) % CAP;
    }
    s.time = p[1] + this.offset;
    s.q = p[0];
    s.x = p[2];
    s.z = p[3];
    s.yaw = p[4];
    s.vx = p[5];
    s.vz = p[6];
    s.f = p[7];
    while (this.n > 2 && this.at(0).time < now - KEEP_MS) {
      this.head = (this.head + 1) % CAP;
      this.n--;
    }
  }

  /** renderTime(로컬 ms) 시점 상태를 out에 씀. 스냅샷이 없으면 false */
  sample(renderTime: number, out: HubSample): boolean {
    if (this.n === 0) return false;
    const last = this.at(this.n - 1);
    if (renderTime >= last.time || this.n === 1) {
      const ahead = Math.max(0, renderTime - last.time);
      const dt = Math.min(ahead, this.maxExtrapolateMs) / 1000;
      const stale = ahead > this.staleMs;
      out.x = last.x + last.vx * dt;
      out.z = last.z + last.vz * dt;
      out.yaw = last.yaw;
      out.vx = stale ? 0 : last.vx;
      out.vz = stale ? 0 : last.vz;
      out.f = stale ? last.f & ~1 : last.f;
      return true;
    }
    let i = this.n - 2;
    while (i > 0 && this.at(i).time > renderTime) i--;
    const a = this.at(i);
    const b = this.at(i + 1);
    if (renderTime <= a.time) {
      this.copy(a, out);
      return true;
    }
    const t = (renderTime - a.time) / Math.max(1, b.time - a.time);
    if (Math.hypot(b.x - a.x, b.z - a.z) > this.teleportDistance) {
      this.copy(t < 0.5 ? a : b, out);
      return true;
    }
    out.x = a.x + (b.x - a.x) * t;
    out.z = a.z + (b.z - a.z) * t;
    out.yaw = lerpAngle(a.yaw, b.yaw, t);
    out.vx = a.vx + (b.vx - a.vx) * t;
    out.vz = a.vz + (b.vz - a.vz) * t;
    out.f = t < 0.5 ? a.f : b.f;
    return true;
  }

  private copy(s: Snap, out: HubSample): void {
    out.x = s.x;
    out.z = s.z;
    out.yaw = s.yaw;
    out.vx = s.vx;
    out.vz = s.vz;
    out.f = s.f;
  }
}

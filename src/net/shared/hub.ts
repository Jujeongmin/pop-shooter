// 광장 멀티 공용 규칙 (서버·클라이언트, 순수 함수·데이터). pop-battle protocol.ts의 허브 부분을 복사해 고침 (2026-11-11).
// 광장 룸 = 월드별 로비 룸 w<월드>-<번호> (정원 16, 사용자 2026-11-12). 광장에서는 서로 보이기만 함: 충돌 없음, 전투·훈련은 혼자.
// 서버는 물리가 없어 위치는 형식·범위·빈도·속도만 검사. 값은 모두 서버가 다시 검사 (sanitize*), 클라이언트 검사는 편의용.

/** 광장 인스턴스 정원 */
export const HUB_MAX_PLAYERS = 16;
/** 월드 수 (balance.ts stage.worlds). 룸 id에는 월드 번호를 둠 */
export const HUB_WORLDS = 8;
/** 지금 광장이 열린 월드 (서버가 이 밖의 월드 룸은 광장으로 치지 않음 → 장부 문서·룸이 마구 생기지 않게). 월드를 열 때 여기에 추가 */
export const HUB_OPEN_WORLDS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];

export function hubRoomId(world: number, n: number): string {
  return `w${world}-${n}`;
}

export function isHubWorld(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && HUB_OPEN_WORLDS.includes(v);
}

/** 광장 룸의 월드 번호 (열린 월드의 광장 룸이 아니면 0) */
export function hubWorldOf(roomId: string | null | undefined): number {
  if (typeof roomId !== 'string') return 0;
  const m = /^w(\d)-\d{1,4}$/.exec(roomId);
  const w = m ? Number(m[1]) : 0;
  return isHubWorld(w) ? w : 0;
}

export function isHubRoom(roomId: string | null | undefined): boolean {
  return hubWorldOf(roomId) > 0;
}

export const HUB_TIMING = {
  /** 위치 전송 최소 간격 (ms) = 최대 6회/초 (pop-battle 실측값). 움직이지 않으면 보내지 않음 */
  sendIntervalMs: 166,
  /** remoteFunction throttle 창 (ms) — 전송 간격보다 짧아야 버려지지 않음 */
  throttleMs: 140,
  /** 서버가 받는 최소 간격 (ms) — 이보다 잦은 패킷은 버림 */
  minAcceptMs: 70,
  /** 원격 보간 지연 (ms) */
  interpDelayMs: 280,
  /** 배정 예약 유지 (ms): hubFind 뒤 이 시간 안에 실제로 들어와야 함 */
  reserveMs: 20_000,
  /** 끊김 재접속 대기 (SDK 유예와 같은 30초) */
  graceMs: 30_000,
  /**
   * hubHello 뒤 이 시간 안에 온 onRoomLeave는 지난 세션의 늦은 알림으로 보고 장부를 지우지 않음
   * (나감 → 바로 다시 배정·입장·hello 뒤에 앞 퇴장 알림이 늦게 와서 새 자리를 지우는 것 방지). 진짜 퇴장은 hubBye가 바로 지움
   */
  leaveRaceMs: 2000,
  /** 이동이 이 시간 넘게 계속 거절되면 다음 패킷은 위치를 다시 맞춤 (정상 이동이 영영 막히지 않게) */
  resyncMs: 3000,
} as const;

/**
 * 광장 공간 (world/facilities.ts HUB_BOUNDS·HUB_SPAWN과 같은 값 — tests/net/hub.test.ts가 확인).
 * 평지라 높이 없음. 범위 밖 margin 안쪽은 경계로 자르고, 더 밖은 거절
 */
export const HUB_AREA = { hx: 22, hz: 21, margin: 0.5, spawn: { x: 0, z: 8 } } as const;

/**
 * 서버 이동 검사 (수평, m/s): 걷기 MOVE_SPEED 5.76 (core/Game.ts) × 1.35 여유 ≈ 7.8.
 * 패킷마다 + slack m (전송 간격 흔들림·보간). 경과 시간은 [0.05, 3]초로 자름
 */
export const HUB_MOVE = { maxSpeed: 7.8, slack: 1.5 } as const;

/**
 * 순간이동 허용 구역: 도착점이 구역 반경 r 안이고, 출발점에서 reach m 안이면 속도와 상관없이 받음.
 * - 시설 구역 자동 이동 (ZoneEntry 0.38초 스냅: 구역 반경 ≤ 2.6m 안에서 시설 자리로, 사격장은 판 위 무작위 자리 ±2.2 × ±1.3)
 * - 전투에서 돌아옴 (BattleScene: 포털 앞 (0, -3.3)) · 시작 지점 → reach = Infinity (광장 안 어디서든)
 */
export const HUB_SNAPS: ReadonlyArray<{ x: number; z: number; r: number; reach: number }> = [
  { x: 0, z: 8, r: 1, reach: Infinity }, // 시작 지점
  { x: 0, z: -7.3, r: 1, reach: Infinity }, // 전투 복귀 (PORTAL_SPOT.z + 3.2)
  { x: -14, z: 0, r: 3, reach: 7 }, // 사격장 판
  { x: 13, z: 4, r: 1, reach: 4 }, // 업그레이드
  { x: 7, z: -5, r: 1, reach: 4 }, // 총
  { x: -11, z: 17, r: 1, reach: 4 }, // 환생 제단
  { x: 11, z: 16, r: 1, reach: 4 }, // 캐릭터
  { x: 0, z: -10.5, r: 1, reach: 4 }, // 포털
  { x: -18.5, z: 10.2, r: 2.2, reach: 5 }, // 러닝머신 세 대 (연사)
  { x: -9.5, z: 9, r: 1.6, reach: 5 }, // 동전 분수 세 자리 (골드 보너스)
  { x: -17, z: -15, r: 1, reach: 4 }, // 월드 이동 정류장
];

/**
 * 광장 위치 패킷 (throttle 호출 'hubMove', 숫자 배열로 압축):
 * [순번, 보낸 시각(ms), x, z, 몸 방향(rad), vx, vz, 비트(1 걷는 중 · 2 훈련 발사)]
 */
export type HubPacket = [number, number, number, number, number, number, number, number];

/** 광장에서 보이는 상태: 광장 / 사격장 훈련 중 / 전투 중 (포털 앞에 서 있음) */
export type HubStatus = 'hub' | 'training' | 'battle';
export const HUB_STATUSES: readonly HubStatus[] = ['hub', 'training', 'battle'];

/** 캐릭터 id (sim/state.ts CHAR_IDS와 같음 — 테스트가 확인) */
export const HUB_CHARS = ['blue', 'yellow', 'red', 'pink', 'white', 'black'] as const;
export type HubChar = (typeof HUB_CHARS)[number];
/** 총 index 범위 (balance.ts gun.count = 32) */
export const HUB_GUN_COUNT = 32;
/** 환생 횟수 상한 (sim/normalize.ts와 같은 1e9) */
export const HUB_MAX_REBIRTHS = 1e9;

/** 클라이언트가 보내는 보이는 정보 (hubHello 전부, hubInfo 일부). 닉네임은 서버 저장값만 씀 (보내지 않음) */
export interface HubInfo {
  /** 캐릭터 id */
  c: HubChar;
  /** 든 총 index 0..15 */
  g: number;
  /** 환생 횟수 */
  r: number;
  /** 공격력 (표시용, 유한한 수 ≥ 0) = sim/actions damagePerShot (HUD·업그레이드 창과 같은 '한 발 피해'). 서버는 저장값으로 계산한 값을 상한으로 씀 */
  pw: number;
  /** 상태 */
  s: HubStatus;
}

/** 광장 룸 사용자 상태 (서버가 저장, SDK가 같은 룸에 푸시) */
export interface HubUserState extends Partial<HubInfo> {
  /** 표시 닉네임 (서버 저장값, 없으면 '') */
  n?: string;
  /** 마지막으로 받아들인 위치 패킷 */
  p?: HubPacket;
  /** 서버가 패킷을 받은 시각 (ms) */
  t?: number;
  /** 숨김: 0 = 보임, 1 = 끊김 (30초 유예 중에도 바로 숨김), 2 = 정상 퇴장 (hubBye). 다시 보이려면 hubHello (hubMove로는 안 바뀜) */
  x?: number;
}

export type HubInfoField = keyof HubInfo;

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** 보이는 정보 한 칸 검사: 통과하면 정리된 값, 아니면 undefined */
export function sanitizeHubField(k: HubInfoField, v: unknown): HubInfo[HubInfoField] | undefined {
  switch (k) {
    case 'c':
      return typeof v === 'string' && (HUB_CHARS as readonly string[]).includes(v) ? (v as HubChar) : undefined;
    case 'g':
      return finite(v) && Number.isInteger(v) && v >= 0 && v < HUB_GUN_COUNT ? v : undefined;
    case 'r':
      return finite(v) && Number.isInteger(v) && v >= 0 && v <= HUB_MAX_REBIRTHS ? v : undefined;
    case 'pw':
      return finite(v) && v >= 0 ? v : undefined;
    case 's':
      return typeof v === 'string' && (HUB_STATUSES as readonly string[]).includes(v) ? (v as HubStatus) : undefined;
    default:
      return undefined;
  }
}

/** 위치 패킷 검사: 길이·숫자·광장 범위. 범위 밖 margin 안은 경계로 자름, 더 밖은 null. 통과하면 반올림한 사본 */
export function sanitizeHubPacket(pkt: unknown): HubPacket | null {
  if (!Array.isArray(pkt) || pkt.length !== 8 || !pkt.every((v) => finite(v) && Math.abs(v) < 1e13)) return null;
  const [q, t, x, z, yaw, vx, vz, f] = pkt as number[];
  const { hx, hz, margin } = HUB_AREA;
  if (Math.abs(x!) > hx + margin || Math.abs(z!) > hz + margin) return null;
  if (Math.abs(yaw!) > 100 || Math.hypot(vx!, vz!) > 20) return null;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const cx = Math.max(-hx, Math.min(hx, x!));
  const cz = Math.max(-hz, Math.min(hz, z!));
  return [Math.floor(q!), Math.floor(t!), r3(cx), r3(cz), r3(Math.atan2(Math.sin(yaw!), Math.cos(yaw!))), r2(vx!), r2(vz!), Math.round(f!) & 0x7];
}

/** 순간이동 허용 구역으로의 이동인지 */
export function isHubSnap(prev: HubPacket, next: HubPacket): boolean {
  const d = Math.hypot(next[2] - prev[2], next[3] - prev[3]);
  return HUB_SNAPS.some((s) => Math.hypot(next[2] - s.x, next[3] - s.z) <= s.r && d <= s.reach);
}

/**
 * 이동 검사 (물리 없음): 직전에 받아들인 위치에서 경과 시간 동안 갈 수 있는 거리 안인지, 또는 순간이동 허용 구역.
 * 직전 위치가 없으면(첫 패킷) 범위 검사만
 */
export function hubMoveOk(prev: HubPacket | undefined, prevT: number, next: HubPacket, now: number): boolean {
  if (!prev) return true;
  if (isHubSnap(prev, next)) return true;
  const dt = Math.min(3, Math.max(0.05, (now - prevT) / 1000));
  return Math.hypot(next[2] - prev[2], next[3] - prev[3]) <= HUB_MOVE.maxSpeed * dt + HUB_MOVE.slack;
}

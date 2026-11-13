/**
 * POP Shooter 서버
 * 1) 계정별 진행 저장 (원본 = Verse8 글로벌 사용자 상태 `save`).
 *    - 저장값은 sim/normalize로 형식·범위를 고친 뒤 저장, lastSeen은 서버 시각으로 찍음 (오프라인 보상 = 서버 시각 기준).
 *    - 코인 증가량 상한 검사(스펙 8장)는 아직 없음 → 기록은 공식 랭킹이 아님.
 *    위치·전투 중 상태는 저장하지 않음: 다시 켜면 늘 광장 시작 지점, 끝나지 않은 연속 도전은 버려짐.
 * 2) 광장 멀티 (월드별 룸 w<월드>-<번호>, 정원 16): 서로 보이기만 함 (충돌 없음, 전투·훈련은 혼자). pop-battle 허브를 복사해 고침.
 * 3) 닉네임 (계정별 글로벌 사용자 상태 nick + 중복 방지 컬렉션 ps_nick). pop-battle에서 복사.
 *
 * 공통 규칙 (verse8-upload 4장): 계정은 인자가 아니라 $sender.account (플랫폼이 인증, 클라이언트가 못 바꿈).
 * 모든 메서드가 공개 엔드포인트 → 인자는 모두 다시 검사. 같은 계정·같은 장부의 읽기-수정-쓰기는 $lock.
 * 요청마다 새 인스턴스라 상태는 모듈 변수에 두지 않음.
 */
import { normalizeState } from '../../src/sim/normalize.ts';
import { allowedChars, checkSave } from '../../src/sim/econ.ts';
import { AD_KINDS, AD_LIMIT, buySkipRebirth, buyWithGems, claimAd, PRODUCTS, claimDaily, dailyReady, dayKey, grantPurchase, readPrem, spendGemBoost, type AdKind, type PremState } from '../../src/sim/premium.ts';
import { offlineReward } from '../../src/sim/offline.ts';
import { newState, type CharId, type GameState } from '../../src/sim/state.ts';
import { autoDps, skipRebirthGems } from '../../src/sim/actions.ts';
import {
  HUB_MAX_PLAYERS,
  HUB_TIMING,
  HUB_AREA,
  hubMoveOk,
  hubRoomId,
  hubWorldOf,
  isHubRoom,
  isHubWorld,
  sanitizeHubField,
  sanitizeHubPacket,
  type HubInfo,
  type HubInfoField,
  type HubPacket,
} from '../../src/net/shared/hub.ts';
import { checkNickname } from '../../src/net/shared/nickFilter.ts';
import { dayLabel, rate, RETENTION_DAYS, utcDay, type RetentionCohortRow, type RetentionDailyRow, type RetentionResult, type RetentionView } from '../../src/net/shared/retention.ts';
import { bestDps, RANK_COLLECTION, RANK_TOP, type RankBoard, type RankRow } from '../../src/net/shared/rank.ts';

/** 저장 응답: 서버가 정한 프리미엄 값 + (잘렸으면) 코인 + (거절이면) 서버 저장 */
interface SaveWriteResult {
  ok: boolean;
  reason?: string;
  now: number;
  prem?: PremView;
  coins?: number;
  fix?: Record<string, unknown>;
}

/** 화면에 돌려주는 프리미엄 (광고 남은 횟수 포함, 기록 id는 안 줌) */
interface PremView {
  gems: number; passMult: number; boostUntil: number; chars: string[]; char: string; ads: Record<AdKind, number>;
  /** 출석: 오늘 받을 수 있는지, 다음 칸 (0..6) */
  daily: { ready: boolean; idx: number };
}

/** 서버 프리미엄 (글로벌 사용자 상태 prem, sim/premium). 처음이면 0에서 시작 (기기 저장의 팝젬은 믿지 않음: 팝젬 = 결제 화폐) */
function premOf(st: Record<string, unknown>, _prev: GameState | null): PremState {
  return readPrem(st.prem && typeof st.prem === 'object' ? st.prem : null);
}

function premView(p: PremState, s: GameState | null, now = Date.now()): PremView {
  const chars = allowedChars(s?.bestStage ?? 0, p.paid);
  const today = p.adDay === dayKey(now);
  const ads = {} as Record<AdKind, number>;
  for (const k of AD_KINDS) ads[k] = AD_LIMIT[k] - (today ? p.adUsed[k] : 0);
  return { gems: p.gems, passMult: p.passMult, boostUntil: p.boostUntil, chars, char: s && chars.includes(s.char) ? s.char : 'blue', ads, daily: { ready: dailyReady(p, now), idx: p.dailyIdx } };
}

/**
 * Verse8 광고 검증 (docs.verse8.io 광고 서버 검증): 끝까지 봄 / 아직 모름 / 안 봄 / 확인 불가(게임 서버에 fetch가 없거나 실패).
 * 읽기만 하므로 두 번 물어도 안전. monster-bbq와 같은 방식.
 */
type AdCheck = 'verified' | 'pending' | 'rejected' | 'unknown';
const AD_VERIFIER = 'https://ads-verifier.verse8.io/ads/status?requestId=';
async function checkAd(requestId: string): Promise<AdCheck> {
  const get = (globalThis as { fetch?: (url: string) => Promise<{ status: number; json(): Promise<unknown> }> }).fetch;
  if (typeof get !== 'function') return 'unknown';
  try {
    const res = await get(AD_VERIFIER + encodeURIComponent(requestId));
    if (res.status === 202) return 'pending';
    if (res.status === 404) return 'rejected';
    if (res.status !== 200) return 'unknown';
    const body = (await res.json()) as { status?: unknown } | null;
    return body?.status === 'verified' ? 'verified' : body?.status === 'pending' ? 'pending' : 'rejected';
  } catch {
    return 'unknown';
  }
}

const isAdId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128 && /^[A-Za-z0-9_.:-]+$/.test(v);

/** 저장 한 건 최대 크기 (문서 1MB 한도보다 훨씬 작게) */
const MAX_SAVE_CHARS = 20000;

function saveOf(st: unknown): Record<string, unknown> | null {
  if (!st || typeof st !== 'object') return null;
  const s = (st as { save?: unknown }).save;
  return s && typeof s === 'object' ? (s as Record<string, unknown>) : null;
}

/** 서버 로그 (Verse8 서버 콘솔). 이동 패킷은 남기지 않음, 계정은 앞뒤만 */
function slog(event: string, roomId: string, account: string): void {
  const a = account.length > 14 ? `${account.slice(0, 6)}…${account.slice(-4)}` : account;
  console.log(`[ps] ${new Date().toISOString()} ${event} room=${roomId} account=${a}`);
}

// ---------------- 광장 장부 ----------------

/** 호출한 클라이언트의 광장 룸 (아니면 null — SDK는 룸 밖에서 '__no_room__'을 줌) */
function hubOf(): string | null {
  const r = $sender.roomId;
  return r && isHubRoom(r) ? r : null;
}

/**
 * 광장 인원 장부 (월드마다 글로벌 상태 하나 hub_book_w<월드>, 'hub:w<월드>' 락 안에서만 읽고 씀): 룸 → 계정 → 기록.
 * - a: 실제 접속 시각 (hubHello 뒤). 정상 퇴장(hubBye·onRoomLeave)하면 즉시 지움 → 바로 빈자리
 * - d: 연결 끊김 시각. 30초 재접속 대기 자리 (정원에는 넣고, 실제 접속 인원에서는 뺌)
 * - r: 배정 예약 시각 (hubFind 뒤 20초 안에 들어와야 함, 동시 입장 정원 초과 방지)
 * 크기: 지금 접속 중인 사람만 들어 있고 끝난 기록은 매번 지움 → 동시 접속자 수에 비례 (누적되지 않음).
 * SDK 룸 사용자 목록은 나간 사람도 30초 동안 남아 있어 인원 계산에 쓰지 않고, 서버가 놓친 퇴장(유령) 정리에만 씀
 */
type HubEntry = { a?: number; d?: number; r?: number };
type HubBook = Record<string, Record<string, HubEntry>>;
const bookKey = (world: number) => `hub_book_w${world}`;
const bookLock = (world: number) => `hub:w${world}`;

async function readBook(world: number): Promise<HubBook> {
  const key = bookKey(world);
  const g = ((await $global.getGlobalState([key])) || {}) as Record<string, unknown>;
  const v = g[key];
  return v && typeof v === 'object' ? (v as HubBook) : {};
}

/** 끝난 예약·재접속 대기를 지움 (빈 룸 키도) */
function pruneBook(book: HubBook, now: number): void {
  for (const [id, accs] of Object.entries(book)) {
    for (const [acc, e] of Object.entries(accs)) {
      if (e.d !== undefined && !(now - e.d < HUB_TIMING.graceMs)) delete accs[acc];
      else if (e.a === undefined && e.d === undefined && !(now - (e.r ?? 0) < HUB_TIMING.reserveMs)) delete accs[acc];
    }
    if (Object.keys(accs).length === 0) delete book[id];
  }
}

/** 자리 수 (실제 접속 + 재접속 대기 + 예약), except = 셈에서 뺄 계정 */
function hubSeats(accs: Record<string, HubEntry> | undefined, except?: string): number {
  return accs ? Object.keys(accs).filter((a) => a !== except).length : 0;
}

/** 실제 접속 인원 (재접속 대기·예약 제외) */
function hubActive(accs: Record<string, HubEntry> | undefined): number {
  return accs ? Object.values(accs).filter((e) => e.a !== undefined && e.d === undefined).length : 0;
}

/** 장부 고치기 (월드 락 안에서 읽고 씀). fn이 false를 돌려주면 쓰지 않음 */
async function editBook(world: number, fn: (book: HubBook, now: number) => boolean | void): Promise<void> {
  await $lock(bookLock(world), async () => {
    const now = Date.now();
    const book = await readBook(world);
    if (fn(book, now) === false) return;
    pruneBook(book, now);
    await $global.updateGlobalState({ [bookKey(world)]: book });
  });
}

/** 보이는 정보 검사: 들어온 칸만 검사해 patch로. 잘못된 칸이 하나라도 있으면 그 칸 이름 */
function hubPatch(raw: unknown, fields: readonly HubInfoField[]): { patch: Partial<HubInfo>; bad?: HubInfoField } {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const patch: Record<string, unknown> = {};
  for (const k of fields) {
    if (src[k] === undefined) continue;
    const v = sanitizeHubField(k, src[k]);
    if (v === undefined) return { patch: {}, bad: k };
    patch[k] = v;
  }
  return { patch: patch as Partial<HubInfo> };
}

const HUB_FIELDS: readonly HubInfoField[] = ['c', 'g', 'r', 'pw', 's', 'q'];
const HUB_DEFAULTS: HubInfo = { c: 'blue', g: 0, r: 0, pw: 0, s: 'hub', q: 0 };

/**
 * 보이는 환생·DPS는 내 저장값을 넘지 못함 (글로벌 사용자 상태 한 번 읽은 것 st): 환생 ≤ save.rebirths, pw(= DPS, 사용자 2026-11-12) ≤ 저장으로 계산한 autoDps.
 * 저장이 조금 늦으면 잠깐 낮게 보일 수 있음 → 클라이언트는 저장 뒤 hubInfo를 다시 보냄 (Task 3)
 */
function capBySave(patch: Partial<HubInfo>, st: Record<string, unknown>): void {
  if (patch.r === undefined && patch.pw === undefined && patch.q === undefined) return;
  const saved = normalizeState(saveOf(st) ?? {}, Date.now());
  if (patch.r !== undefined) patch.r = Math.min(patch.r, saved.rebirths);
  if (patch.pw !== undefined) patch.pw = Math.min(patch.pw, autoDps(saved));
  // 장비는 저장에 있는 것만 보임
  if (patch.q !== undefined) patch.q = patch.q & saved.gear;
}

/** 광장 룸 사용자 상태 중 서버가 보는 것 */
type HubMine = { c?: string; p?: HubPacket; t?: number; x?: number };

/** hubHello를 마치고 아직 광장에 보이는 사람 (끊김 x 1·정상 퇴장 x 2·hello 전·정원 초과로 거절된 사람은 아님) */
function hubJoined(st: HubMine): boolean {
  return typeof st.c === 'string' && st.x === 0;
}

// ---------------- 닉네임 ----------------
// 원본 = 계정별 글로벌 사용자 상태 nick (save와 같은 문서, updateMyState는 합치기라 서로 덮지 않음).
// 중복 방지 등록부: 컬렉션 ps_nick 한 줄 = { key: 비교용 닉네임, acc: 주인 계정 } (항목당 문서 하나 → 단일 문서가 커지지 않음).
// 비교는 NFC + 앞뒤 공백 제거 + 대소문자 무시. 같은 이름 동시 요청은 이름별 락으로 한 명만 차지. 바꾸면 새 이름을 먼저 차지한 뒤 예전 이름을 놓음.

/** 닉네임 변경 간격 (첫 설정은 제한 없음) */
const NICK_CHANGE_MS = 10_000;
const NICK_COLLECTION = 'ps_nick';

function nickKey(nick: string): string {
  return nick.normalize('NFC').trim().toLowerCase();
}

async function nickOwner(key: string): Promise<{ id: string; acc: string } | null> {
  const items = await $global.getCollectionItems(NICK_COLLECTION, { filters: [{ field: 'key', operator: '==', value: key }], limit: 1 });
  const it = items[0];
  return it ? { id: it.__id, acc: String(it.acc) } : null;
}

/** 이 계정이 이 닉네임을 차지 (이미 내 것이면 그대로). 다른 계정 것이면 false */
async function claimNick(account: string, nick: string): Promise<boolean> {
  const key = nickKey(nick);
  return $lock(`nick:${key}`, async () => {
    const owner = await nickOwner(key);
    if (owner) return owner.acc === account;
    await $global.addCollectionItem(NICK_COLLECTION, { key, acc: account, t: Date.now() });
    return true;
  });
}

/** 내 것인 닉네임 등록을 놓음 (바꾼 뒤 예전 이름) */
async function releaseNick(account: string, nick: string): Promise<void> {
  const key = nickKey(nick);
  await $lock(`nick:${key}`, async () => {
    const owner = await nickOwner(key);
    if (owner && owner.acc === account) await $global.deleteCollectionItem(NICK_COLLECTION, owner.id);
  });
}

/** 저장된 닉네임이 지금 규칙에 걸림 (금칙어 목록이 바뀐 뒤 등) → 바꿀 때까지 표시 안 함, 저장값은 지우지 않음 */
function nickNeedsChange(st: Record<string, unknown> | null): boolean {
  const raw = st?.nick;
  return typeof raw === 'string' && raw.trim() !== '' && !checkNickname(raw).ok;
}

// ---------------- 리텐션 기록 (개발자 콘솔 retention(), 팝배틀과 같은 방식 2026-11-13) ----------------
// 컬렉션은 클라이언트도 이름을 알면 구독할 수 있음(SDK에 서버 전용 컬렉션·권한이 없음) → 계정·닉네임 없이 날짜 숫자만 저장하고,
// 이름은 서버 코드에만 둠 (클라이언트 번들에 없음). 계정 ↔ 유저 문서 연결은 그 계정의 비공개 사용자 상태 act에만.
/** 유저 문서 {f: 최초 접속일, l: 마지막 접속일} (UTC 일 번호) */
const RET_USERS = 'ps_ret_u4m9';
/** 접속일 문서 {d: 접속일, f: 최초 접속일, k: d - f} — 계정당 하루 1개 */
const RET_DAYS = 'ps_ret_d4m9';
/**
 * 리텐션 조회 관리자 (Verse8 계정 주소, 소문자 비교). SDK에 관리자 권한 체계가 없어 서버 코드의 허용 목록으로만 판단.
 * $sender.account는 플랫폼이 인증한 값이라 클라이언트가 바꿀 수 없음. 추가·변경은 이 목록을 고치고 서버 다시 배포
 */
const RETENTION_ADMINS = new Set(['0x7b47aa40357441418909f83728da906b7c85d261']);
/** 관리자 한 명당 조회 간격 (집계에 count 질의가 많아서) */
const RETENTION_COOLDOWN_MS = 5000;
/** 코호트·일별 표 범위 (일) */
const RETENTION_WINDOW = 30;

/** 내 리텐션 기록 (비공개 사용자 상태) */
interface ActRecord {
  /** 최초 접속일 */
  f: number;
  /** 마지막 접속일 */
  l: number;
  /** 유저 문서 id */
  id: string;
}

function readAct(st: Record<string, unknown> | null): ActRecord | null {
  const a = st?.act as Partial<ActRecord> | undefined;
  return a && Number.isInteger(a.f) && Number.isInteger(a.l) && typeof a.id === 'string' ? (a as ActRecord) : null;
}

type RetFilter = { field: string; operator: string; value: number };
function retCount(id: string, filters: RetFilter[]): Promise<number> {
  return $global.countCollectionItems(id, { filters });
}

export class Server {
  // ---------------- 리텐션 ----------------

  /**
   * 접속 기록 (클라이언트가 게임 시작 때 한 번, 응답을 기다리지 않음): 계정당 UTC 하루 1번만 접속일 문서를 남김.
   * 같은 날 여러 번 와도(새로고침·다른 기기) 계정 상태의 마지막 접속일로 걸러 1명. 과거 기록은 만들지 않음
   */
  async actPing(): Promise<{ ok: boolean; first?: boolean }> {
    const account = $sender.account;
    if (!account) return { ok: false };
    return $lock(`act:${account}`, async () => {
      const today = utcDay(Date.now());
      const st = ((await $global.getMyState()) || {}) as Record<string, unknown>;
      const act = readAct(st);
      if (act && act.l >= today) return { ok: true, first: false };
      if (!act) {
        const doc = await $global.addCollectionItem(RET_USERS, { f: today, l: today });
        await $global.addCollectionItem(RET_DAYS, { d: today, f: today, k: 0 });
        await $global.updateMyState({ act: { f: today, l: today, id: doc.__id } satisfies ActRecord });
        return { ok: true, first: true };
      }
      await $global.addCollectionItem(RET_DAYS, { d: today, f: act.f, k: today - act.f });
      await $global.updateCollectionItem(RET_USERS, { __id: act.id, f: act.f, l: today });
      await $global.updateMyState({ act: { ...act, l: today } });
      return { ok: true, first: false };
    });
  }

  /**
   * 리텐션 집계 (관리자만, 서버가 계정으로 확인). 집계된 숫자만 돌려줌 — 계정·닉네임 등 개인 정보 없음.
   * summary: 전체 가입·오늘 접속·Dn, cohort: 최근 30일 최초 접속일별, daily: 최근 30일 DAU·신규
   */
  async retentionGet(view?: unknown): Promise<RetentionResult> {
    const account = $sender.account;
    if (!account || !RETENTION_ADMINS.has(account.toLowerCase())) {
      slog('retention_denied', '-', account || '-');
      return { ok: false, reason: 'not_admin', account };
    }
    const v: RetentionView | '' = view === undefined || view === null || view === 'summary' ? 'summary' : view === 'cohort' || view === 'daily' ? view : '';
    if (!v) return { ok: false, reason: 'bad_view' };
    const now = Date.now();
    const st = ((await $global.getMyState()) || {}) as { rtAt?: unknown };
    const last = typeof st.rtAt === 'number' ? st.rtAt : 0;
    if (now - last < RETENTION_COOLDOWN_MS) return { ok: false, reason: 'too_fast', waitMs: RETENTION_COOLDOWN_MS - (now - last) };
    await $global.updateMyState({ rtAt: now });
    const today = utcDay(now);
    try {
      if (v === 'summary') {
        const [users, active30, activeToday, earliest] = await Promise.all([
          retCount(RET_USERS, []),
          retCount(RET_USERS, [{ field: 'l', operator: '>=', value: today - (RETENTION_WINDOW - 1) }]),
          retCount(RET_DAYS, [{ field: 'd', operator: '==', value: today }]),
          $global.getCollectionItems(RET_USERS, { orderBy: [{ field: 'f', direction: 'asc' }], limit: 1 }),
        ]);
        const cells = await Promise.all(
          RETENTION_DAYS.map(async (n) => {
            const [eligible, retained] = await Promise.all([
              retCount(RET_USERS, [{ field: 'f', operator: '<=', value: today - n }]),
              retCount(RET_DAYS, [{ field: 'k', operator: '==', value: n }]),
            ]);
            return { n, eligible, retained, rate: rate(retained, eligible) };
          }),
        );
        const first = earliest[0]?.f;
        return { ok: true, view: 'summary', data: { today: dayLabel(today), users, active30, activeToday, since: Number.isInteger(first) ? dayLabel(first) : null, cells } };
      }
      if (v === 'cohort') {
        const rows: RetentionCohortRow[] = [];
        for (let f = today - (RETENTION_WINDOW - 1); f <= today; f++) {
          const size = await retCount(RET_USERS, [{ field: 'f', operator: '==', value: f }]);
          if (size === 0) continue;
          const cells = await Promise.all(
            RETENTION_DAYS.map(async (n) => {
              if (f + n > today) return { n, retained: null, rate: null };
              const retained = await retCount(RET_DAYS, [
                { field: 'f', operator: '==', value: f },
                { field: 'k', operator: '==', value: n },
              ]);
              return { n, retained, rate: rate(retained, size) };
            }),
          );
          rows.push({ day: dayLabel(f), users: size, cells });
        }
        return { ok: true, view: 'cohort', data: rows };
      }
      const rows: RetentionDailyRow[] = await Promise.all(
        Array.from({ length: RETENTION_WINDOW }, async (_, i) => {
          const d = today - (RETENTION_WINDOW - 1) + i;
          const [dau, newUsers] = await Promise.all([
            retCount(RET_DAYS, [{ field: 'd', operator: '==', value: d }]),
            retCount(RET_DAYS, [
              { field: 'd', operator: '==', value: d },
              { field: 'k', operator: '==', value: 0 },
            ]),
          ]);
          return { day: dayLabel(d), dau, newUsers };
        }),
      );
      return { ok: true, view: 'daily', data: rows };
    } catch (e) {
      console.log(`[ps] retention_error ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, reason: 'error' };
    }
  }


  // ---------------- 저장 ----------------

  /** 내 저장 + 서버 지금 시각 (오프라인 보상 계산용) */
  async saveLoad(): Promise<{ ok: true; save: Record<string, unknown> | null; now: number }> {
    const st = await $global.getMyState();
    return { ok: true, save: saveOf(st), now: Date.now() };
  }

  /**
   * 계정 초기화 (설정 → 계정 초기화, 사용자 2026-11-13): 진행 저장을 새 판으로 바꾸고 기록판 줄을 지움.
   * 산 것(팝젬·패스·유료 캐릭터 = prem)과 닉네임은 그대로. 빈 저장 대신 새 판을 넣음: 빈 저장이면 다음 저장이
   * '첫 저장'이라 검사 없이 받아져, 다른 탭·기기에 남은 예전 진행이 그대로 다시 올라옴
   */
  async saveReset(): Promise<{ ok: boolean; now: number }> {
    const now = Date.now();
    const account = $sender.account;
    if (!account) return { ok: false, now };
    return $lock(`save:${account}`, async () => {
      await $global.updateMyState({ save: { ...newState(now), lastSeen: now } });
      try {
        const found = await $global.getCollectionItems(RANK_COLLECTION, { filters: [{ field: 'acc', operator: '==', value: account }], limit: 5 });
        for (const it of found) await $global.deleteCollectionItem(RANK_COLLECTION, it.__id);
      } catch { /* 기록판 줄은 다음 저장 때 새 값으로 덮임 */ }
      slog('save_reset', '-', account);
      return { ok: true, now };
    });
  }

  /**
   * 저장: 형식 고침 → 경제 검사(checkSave: 프리미엄은 서버 값, 늘어난 가치 상한, 깰 수 있는 스테이지, 환생 조건) → 저장 (lastSeen = 서버 시각).
   * 돌려줌: 서버가 정한 프리미엄 값(팝젬·패스·부스트·캐릭터)과, 코인을 잘랐거나 거절했으면 서버 저장값 → 클라이언트가 맞춤.
   */
  async saveWrite(raw: unknown): Promise<SaveWriteResult> {
    const now = Date.now();
    let size = 0;
    try { size = JSON.stringify(raw).length; } catch { return { ok: false, reason: 'bad', now }; }
    if (!raw || typeof raw !== 'object' || size > MAX_SAVE_CHARS) return { ok: false, reason: 'bad', now };
    const account = $sender.account;
    return $lock(`save:${account}`, async (): Promise<SaveWriteResult> => {
      const st = ((await $global.getMyState()) || {}) as Record<string, unknown>;
      const prevRaw = saveOf(st);
      const prev = prevRaw ? normalizeState(prevRaw, now) : null;
      const prem = premOf(st, prev);
      const clean = normalizeState(raw, now);
      const elapsed = prev ? (now - prev.lastSeen) / 1000 : 0;
      const r = checkSave(prev, clean, elapsed, prem, now);
      if (!r.ok) {
        slog(`save_reject_${r.reason}`, '-', account);
        // 이전 서버 저장 유지, 클라이언트는 이 값으로 맞춤 (거절이 반복되지 않게)
        return { ok: false, reason: r.reason, now, prem: premView(prem, prev), fix: prev ? { ...prev } as unknown as Record<string, unknown> : undefined };
      }
      const saved = { ...r.state, lastSeen: now };
      // checkSave는 econ Premium 형태로 돌려줌 → 광고·결제 기록까지 담은 PremState로 (필드는 그대로 실려 있음)
      const premNext = readPrem(r.prem);
      await $global.updateMyState({ save: saved, prem: premNext });
      if (r.clamped) slog('save_clamped', '-', account);
      // 기록판 한 줄 (계정마다 하나, 항목당 문서 하나라 커지지 않음). 실패해도 저장은 그대로
      try {
        const nk = checkNickname(st.nick);
        const found = await $global.getCollectionItems(RANK_COLLECTION, { filters: [{ field: 'acc', operator: '==', value: account }], limit: 1 });
        // 최고 DPS: 이 줄의 이전 최고와 지금 저장으로 계산한 DPS 중 큰 값 (사용자 2026-11-12)
        const pw = bestDps((found[0] as Record<string, unknown> | undefined)?.pw, autoDps(saved));
        const row = { acc: account, nick: nk.ok ? nk.value : '', rb: saved.rebirths, bs: saved.bestStage, pw, c: saved.char, k: pw, t: now };
        if (found[0]) await $global.updateCollectionItem(RANK_COLLECTION, { __id: found[0].__id, ...row });
        else await $global.addCollectionItem(RANK_COLLECTION, row);
      } catch { /* 기록판은 다음 저장 때 다시 */ }
      return { ok: true, now, prem: premView(premNext, saved), coins: r.clamped ? saved.coins : undefined };
    });
  }

  /** 프리미엄 지금 값 (팝젬·패스·부스트·캐릭터·오늘 남은 광고 횟수). 결제 뒤 다시 확인용 */
  async premGet(): Promise<{ ok: true; prem: PremView; now: number }> {
    const st = ((await $global.getMyState()) || {}) as Record<string, unknown>;
    const raw = saveOf(st);
    const prev = raw ? normalizeState(raw, Date.now()) : null;
    return { ok: true, prem: premView(premOf(st, prev), prev), now: Date.now() };
  }

  /**
   * 리워드 광고 보상 (계획 3, verse8-upload 6장): 광고 id를 Verse8 검증기로 확인. 아직 확인 중이면 pending (클라이언트가 잠시 뒤 다시,
   * 마지막 시도(last)나 검증기에 못 닿으면 하루 횟수만이 한도). 같은 id는 한 번만, 계정 락 안에서.
   * offline = 서버가 마지막 저장 시각으로 계산한 오프라인 골드만큼 다음 저장에서 더 허용 (클라이언트가 2배로 받음).
   */
  async adClaim(kind: unknown, requestId: unknown, last: unknown): Promise<{ status: 'granted' | 'pending'; prem?: PremView; reason?: string }> {
    if (!(AD_KINDS as readonly unknown[]).includes(kind)) throw new Error('bad_kind');
    if (!isAdId(requestId)) throw new Error('bad_ad');
    const check = await checkAd(requestId);
    if (check === 'rejected') throw new Error('ad_not_watched');
    if (check === 'pending' && last !== true) return { status: 'pending' };
    const account = $sender.account;
    return $lock(`save:${account}`, async () => {
      const now = Date.now();
      const st = ((await $global.getMyState()) || {}) as Record<string, unknown>;
      const raw = saveOf(st);
      const prev = raw ? normalizeState(raw, now) : null;
      const prem = premOf(st, prev);
      const offline = kind === 'offline' && prev ? offlineReward(prev, now).coins : 0;
      const r = claimAd(prem, kind as AdKind, requestId, now, offline);
      if (!r.ok) throw new Error(`ad_${r.reason}`);
      await $global.updateMyState({ prem: r.prem });
      slog(`ad_${kind as string}`, '-', account);
      return { status: 'granted' as const, prem: premView(r.prem, prev, now) };
    });
  }

  /** 출석 보상 받기 (하루 한 번, 서버 날짜 기준, sim/premium claimDaily). 이미 받았으면 ok false + 지금 값 */
  async dailyClaim(): Promise<{ ok: boolean; idx?: number; prem: PremView }> {
    const account = $sender.account;
    return $lock(`save:${account}`, async () => {
      const now = Date.now();
      const st = ((await $global.getMyState()) || {}) as Record<string, unknown>;
      const raw = saveOf(st);
      const prev = raw ? normalizeState(raw, now) : null;
      const prem = premOf(st, prev);
      const r = claimDaily(prem, now);
      if (!r) return { ok: false, prem: premView(prem, prev, now) };
      await $global.updateMyState({ prem: r.prem });
      slog('daily', String(r.idx), account);
      return { ok: true, idx: r.idx, prem: premView(r.prem, prev, now) };
    });
  }

  /** 팝젬으로 골드 2배 30분 */
  async gemBoost(): Promise<{ ok: boolean; prem?: PremView }> {
    const account = $sender.account;
    return $lock(`save:${account}`, async () => {
      const now = Date.now();
      const st = ((await $global.getMyState()) || {}) as Record<string, unknown>;
      const raw = saveOf(st);
      const prev = raw ? normalizeState(raw, now) : null;
      const next = spendGemBoost(premOf(st, prev), now);
      if (!next) return { ok: false };
      await $global.updateMyState({ prem: next });
      return { ok: true, prem: premView(next, prev, now) };
    });
  }

  /**
   * 팝젬으로 환생 조건 건너뛰기 (키보드 탈출 Skip Rebirth): 값은 서버 저장의 환생 횟수로 계산, 팝젬을 빼고 skip 1회.
   * 클라이언트는 성공하면 바로 환생해 저장 → checkSave가 skip을 씀. 이미 하나 있으면 다시 안 팖 (팝젬 이중 차감 방지)
   */
  async skipRebirth(): Promise<{ ok: boolean; reason?: string; prem?: PremView }> {
    const account = $sender.account;
    return $lock(`save:${account}`, async () => {
      const now = Date.now();
      const st = ((await $global.getMyState()) || {}) as Record<string, unknown>;
      const raw = saveOf(st);
      const prev = raw ? normalizeState(raw, now) : null;
      if (!prev) return { ok: false, reason: 'no_save' };
      const prem = premOf(st, prev);
      if (prem.skip > 0) return { ok: true, prem: premView(prem, prev, now) };
      const next = buySkipRebirth(prem, skipRebirthGems(prev));
      if (!next) return { ok: false, reason: 'gems', prem: premView(prem, prev, now) };
      await $global.updateMyState({ prem: next });
      slog('skip_rebirth', '-', account);
      return { ok: true, prem: premView(next, prev, now) };
    });
  }

  /** 팝젬으로 공격력 패스(순서대로)·유료 캐릭터 사기 (sim/premium buyWithGems). 실패 이유 bad·owned·order·gems + 지금 값 */
  async gemBuy(id: unknown): Promise<{ ok: boolean; reason?: string; prem: PremView }> {
    const account = $sender.account;
    return $lock(`save:${account}`, async () => {
      const now = Date.now();
      const st = ((await $global.getMyState()) || {}) as Record<string, unknown>;
      const raw = saveOf(st);
      const prev = raw ? normalizeState(raw, now) : null;
      const prem = premOf(st, prev);
      const r = buyWithGems(prem, typeof id === 'string' ? id : '');
      if (!r.ok) return { ok: false, reason: r.reason, prem: premView(prem, prev, now) };
      await $global.updateMyState({ prem: r.prem });
      slog(`gem_${id as string}`, '-', account);
      return { ok: true, prem: premView(r.prem, prev, now) };
    });
  }

  /** VXShop 결제 웹훅 (Verse8이 부름): 저장과 같은 락, 같은 purchaseId는 한 번만 (sim/premium grantPurchase) */
  async $onItemPurchased(e: { account?: unknown; purchaseId?: unknown; productId?: unknown; quantity?: unknown; metadata?: unknown }): Promise<{ success: boolean; reason?: string }> {
    // purchaseId는 숫자로 올 수 있음 (2026-11-13 실제 테스트 구매 실패: 문자열만 받아서 success false) → 문자열로 맞춤. pop-battle과 같은 처리
    const account = typeof e?.account === 'string' ? e.account : '';
    const purchaseId = typeof e?.purchaseId === 'string' || typeof e?.purchaseId === 'number' ? String(e.purchaseId) : '';
    const productId = typeof e?.productId === 'string' ? e.productId : '';
    const quantity = Number(e?.quantity) || 1;
    if (!account || !purchaseId) {
      console.log('[ps] purchase_bad_event', JSON.stringify({ account: !!account, purchaseId: typeof e?.purchaseId, productId }));
      return { success: false, reason: 'bad_event' };
    }
    if (!Object.prototype.hasOwnProperty.call(PRODUCTS, productId)) {
      // 이 게임에 없는 상품 (대시보드 Product ID 확인)
      console.log('[ps] purchase_unknown_product', JSON.stringify({ account, productId }));
      return { success: false, reason: 'unknown_product' };
    }
    return $lock(`save:${account}`, async () => {
      const st = ((await $global.getUserState(account)) || {}) as Record<string, unknown>;
      const raw = saveOf(st);
      const prev = raw ? normalizeState(raw, Date.now()) : null;
      const prem = premOf(st, prev);
      // 이미 준 결제 id면 성공으로 답함 (Verse8이 다시 보내도 한 번만)
      if (prem.buys.includes(purchaseId)) return { success: true };
      const r = grantPurchase(prem, productId, purchaseId, quantity);
      if (!r.ok) {
        console.log('[ps] purchase_grant_failed', JSON.stringify({ account, productId, purchaseId }));
        return { success: false, reason: 'grant_failed' };
      }
      await $global.updateUserState(account, { prem: r.prem });
      slog(`buy_${productId}`, '-', account);
      return { success: true };
    });
  }

  /** 기록판: 상위 RANK_TOP (키 > 0) + 내 순위. 계정 id는 돌려주지 않음 (내 줄은 me 표시) */
  async rankTop(): Promise<RankBoard> {
    const me = $sender.account;
    const toRow = (it: Record<string, unknown>): RankRow => ({
      nick: typeof it.nick === 'string' && it.nick ? it.nick : null,
      rb: Number(it.rb) || 0,
      bs: Number(it.bs) || 0,
      pw: Number(it.pw) || 0,
      c: typeof it.c === 'string' ? it.c : 'blue',
      ...(it.acc === me ? { me: true } : {}),
    });
    const [top, mineArr] = await Promise.all([
      $global.getCollectionItems(RANK_COLLECTION, { filters: [{ field: 'k', operator: '>', value: 0 }], orderBy: [{ field: 'k', direction: 'desc' }], limit: RANK_TOP }),
      $global.getCollectionItems(RANK_COLLECTION, { filters: [{ field: 'acc', operator: '==', value: me }], limit: 1 }),
    ]);
    const mineIt = mineArr[0] as Record<string, unknown> | undefined;
    const myKey = Number(mineIt?.k) || 0;
    const myRank = myKey > 0 ? (await $global.countCollectionItems(RANK_COLLECTION, { filters: [{ field: 'k', operator: '>', value: myKey }] })) + 1 : 0;
    return { ok: true, rows: (top as Record<string, unknown>[]).map(toRow), myRank, mine: mineIt ? toRow(mineIt) : null };
  }

  // ---------------- 광장 (w<월드>-<번호> 룸) ----------------

  /**
   * 광장 인스턴스 배정 (룸 밖에서 호출, 클라이언트가 결과 룸에 joinRoom). world ∈ HUB_OPEN_WORLDS (지금 1만), 아니면 bad_world.
   * 이 월드에 이미 자리(접속·재접속 대기·예약)가 있으면 그 룸 → 중복 입장 방지·재접속은 같은 룸.
   * 아니면 정원이 남은 룸 중 가장 많이 찬 곳 (적은 수의 룸에 모음), 모두 차면 새 번호.
   * 실제 접속자 + 아직 들어오지 않은 예약을 함께 셈 (동시에 여러 명이 배정받아도 정원을 넘지 않게)
   */
  async hubFind(world: unknown): Promise<{ ok: true; roomId: string; max: number } | { ok: false; reason: string }> {
    if (!isHubWorld(world)) return { ok: false, reason: 'bad_world' };
    const me = $sender.account;
    return $lock(bookLock(world), async () => {
      const now = Date.now();
      const book = await readBook(world);
      pruneBook(book, now);
      // 유령 정리: 실제 접속으로 적혀 있는데 SDK 룸에도 없는 계정 (서버가 퇴장 알림을 놓친 경우)
      for (const [id, accs] of Object.entries(book)) {
        const inRoom = new Set(await $global.getRoomUserAccounts(id));
        for (const [acc, e] of Object.entries(accs)) if (e.a !== undefined && !inRoom.has(acc)) delete accs[acc];
      }
      pruneBook(book, now);
      let pick: string | null = null;
      for (const [id, accs] of Object.entries(book)) if (accs[me]) pick = id;
      if (!pick) {
        for (const [id, accs] of Object.entries(book)) if (hubSeats(accs) < HUB_MAX_PLAYERS && (!pick || hubSeats(accs) > hubSeats(book[pick]))) pick = id;
      }
      if (!pick) {
        let n = 1;
        while (book[hubRoomId(world, n)]) n++;
        pick = hubRoomId(world, n);
      }
      const accs = (book[pick] ??= {});
      accs[me] = { ...accs[me], r: now };
      await $global.updateGlobalState({ [bookKey(world)]: book });
      return { ok: true as const, roomId: pick, max: HUB_MAX_PLAYERS };
    });
  }

  /**
   * 광장 입장 직후 (재접속 뒤에도 다시): 보이는 정보 등록 + 위치. 다시 보이게 되는 길은 이것뿐 (hubMove·hubInfo는 숨김을 풀지 않음).
   * - 장부에 이 룸 자리(예약 r·접속 a·재접속 대기 d)가 있어야 함 → 없으면 'no_reservation' (hubFind 없이 아무 룸에 들어온 경우)
   * - 정원 초과면 'full' (클라이언트가 나가서 다시 배정받음)
   * - c는 필수, g·r·pw·s는 없으면 기본값, 잘못된 값이 있으면 거절 (bad_<칸>). 환생·공격력은 저장값이 상한
   * - 닉네임은 서버 저장값만 (없으면 ''). 위치는 이 룸에서 마지막으로 받아들인 위치를 유지 (처음이면 시작 지점)
   */
  async hubHello(info: unknown): Promise<{ ok: boolean; reason?: string; max: number; count: number }> {
    const roomId = hubOf();
    if (!roomId) return { ok: false, reason: 'not_in_hub', max: HUB_MAX_PLAYERS, count: 0 };
    const { patch, bad } = hubPatch(info, HUB_FIELDS);
    if (bad) return { ok: false, reason: `bad_${bad}`, max: HUB_MAX_PLAYERS, count: 0 };
    if (!patch.c) return { ok: false, reason: 'bad_c', max: HUB_MAX_PLAYERS, count: 0 };
    const me = $sender.account;
    // 장부에 실제 접속으로 등록 (나를 뺀 자리 수가 정원이면 거절). 같은 월드의 다른 룸 기록은 지움 (중복 세션·유령 방지)
    let count = 0;
    let fail: 'full' | 'no_reservation' | null = null;
    await editBook(hubWorldOf(roomId), (book, now) => {
      pruneBook(book, now);
      const mine = book[roomId]?.[me];
      if (!mine) {
        fail = 'no_reservation';
        return false;
      }
      // 이미 접속(a)·재접속 대기(d) 중인 멤버는 자리가 있음. 예약(r)만 있으면 정원 확인 (hubFind가 정원을 넘겨 주지 않지만 방어)
      if (mine.a === undefined && mine.d === undefined && hubSeats(book[roomId], me) >= HUB_MAX_PLAYERS) {
        fail = 'full';
        count = hubSeats(book[roomId], me);
        return false;
      }
      for (const [id, accs] of Object.entries(book)) if (id !== roomId) delete accs[me];
      book[roomId]![me] = { a: now };
      count = hubActive(book[roomId]);
    });
    if (fail) return { ok: false, reason: fail, max: HUB_MAX_PLAYERS, count };
    const g = ((await $global.getMyState()) || {}) as Record<string, unknown>;
    capBySave(patch, g);
    const nr = checkNickname(g.nick);
    const prev = ((await $room.getMyState()) || {}) as HubMine;
    const s = HUB_AREA.spawn;
    const p: HubPacket = sanitizeHubPacket(prev.p) ?? [0, 0, s.x, s.z, Math.PI, 0, 0, 0];
    await $room.updateMyState({ ...HUB_DEFAULTS, ...patch, n: nr.ok ? nr.value : '', p, t: Date.now(), x: 0 }, { returnState: false });
    slog('hub_hello', roomId, me);
    return { ok: true, max: HUB_MAX_PLAYERS, count };
  }

  /**
   * 보이는 정보 바꾸기 (캐릭터·총·환생·공격력·상태 중 바뀐 칸만). hubHello를 마치고 보이는 사람만 ('not_joined').
   * 잘못된 칸이 있으면 아무것도 안 바꾸고 bad_<칸>. 환생·공격력은 저장값이 상한
   */
  async hubInfo(info: unknown): Promise<{ ok: boolean; reason?: string }> {
    if (!hubOf()) return { ok: false, reason: 'not_in_hub' };
    const { patch, bad } = hubPatch(info, HUB_FIELDS);
    if (bad) return { ok: false, reason: `bad_${bad}` };
    if (!Object.keys(patch).length) return { ok: true };
    if (!hubJoined(((await $room.getMyState()) || {}) as HubMine)) return { ok: false, reason: 'not_joined' };
    if (patch.r !== undefined || patch.pw !== undefined || patch.q !== undefined) capBySave(patch, ((await $global.getMyState()) || {}) as Record<string, unknown>);
    await $room.updateMyState(patch, { returnState: false });
    return { ok: true };
  }

  /**
   * 광장 위치 (throttle 호출, 응답 없음): 형식·범위·전송 빈도·이동 속도 검사 후 내 사용자 상태에 저장 → SDK가 같은 룸에 푸시.
   * 너무 잦으면 버림, 너무 멀리 갔으면 버림(직전 위치 유지) — 단 resyncMs 넘게 버려졌으면 다시 맞춤 (범위 검사는 그대로).
   * 순간이동 허용 구역(시설 스냅·전투 복귀·시작 지점)은 속도 검사 없이 받음 (hub.ts HUB_SNAPS).
   * hubHello를 마치고 보이는 사람만 (hello 전·정원 초과·끊김·hubBye 뒤에 늦게 온 패킷은 버림 → 유령 아바타·정원 우회 방지)
   */
  async hubMove(raw: unknown): Promise<void> {
    if (!hubOf()) return;
    const pkt = sanitizeHubPacket(raw);
    if (!pkt) return;
    const now = Date.now();
    const st = ((await $room.getMyState()) || {}) as HubMine;
    if (!hubJoined(st)) return;
    const lastT = st.t ?? 0;
    if (now - lastT < HUB_TIMING.minAcceptMs) return;
    if (!hubMoveOk(st.p, lastT, pkt, now) && now - lastT < HUB_TIMING.resyncMs) return;
    await $room.updateMyState({ p: pkt, t: now }, { returnState: false });
  }

  /** 같은 룸의 사용자 상태 (구독으로 받는 것과 같은 값). 입장 직후 한 번·테스트용 */
  async hubState(): Promise<{ ok: boolean; users: Array<{ account: string } & Record<string, unknown>> }> {
    if (!hubOf()) return { ok: false, users: [] };
    const all = await $room.getAllUserStates();
    return { ok: true, users: all.map((u) => ({ account: u.account, n: u.n, c: u.c, g: u.g, r: u.r, pw: u.pw, s: u.s, q: u.q, p: u.p, x: u.x })) };
  }

  /** 광장에서 나감 (정상 퇴장): 다른 사람 화면에서 바로 숨기고(x 2, 늦게 온 hubMove로 다시 보이지 않음) 장부에서 바로 지움 → 곧바로 빈자리 */
  async hubBye(): Promise<{ ok: boolean }> {
    const roomId = hubOf();
    if (!roomId) return { ok: false };
    const me = $sender.account;
    await $room.updateMyState({ x: 2 }, { returnState: false });
    await editBook(hubWorldOf(roomId), (book) => {
      if (!book[roomId]?.[me]) return false;
      delete book[roomId]![me];
    });
    slog('hub_bye', roomId, me);
    return { ok: true };
  }

  // ---------------- 닉네임 (룸 안팎 모두) ----------------

  /** 저장된 내 닉네임 (없으면 null → 클라이언트가 첫 설정 화면). 지금 규칙에 걸리는 예전 이름은 mustChange */
  async nickGet(): Promise<{ ok: true; nick: string | null; mustChange?: boolean }> {
    const me = $sender.account;
    const st0 = ((await $global.getMyState()) || {}) as Record<string, unknown>;
    if (nickNeedsChange(st0)) return { ok: true, nick: null, mustChange: true };
    const r = checkNickname(st0.nick);
    const nick = r.ok ? r.value : null;
    // 등록부에 비어 있으면(등록부 쓰기가 실패했던 경우 등) 이 계정 것으로 등록 — nickSet과 같은 계정 락 안에서 다시 읽고 (그 사이 바뀐 이름을 등록하지 않게)
    if (nick && st0.nickReg !== nickKey(nick)) {
      try {
        await $lock(`nickacc:${me}`, async () => {
          const st = ((await $global.getMyState()) || {}) as Record<string, unknown>;
          if (st.nick !== st0.nick || st.nickReg === nickKey(nick)) return;
          if (await claimNick(me, nick)) await $global.updateMyState({ nickReg: nickKey(nick) });
        });
      } catch {
        // 등록부를 못 써도 접속은 그대로
      }
    }
    return { ok: true, nick };
  }

  /**
   * 닉네임 저장 (최종 검사): 형식(2~12자, 한글·영문·숫자·공백)·금칙어·사칭 통과 + 다른 계정이 쓰지 않는 이름만 ('taken').
   * 실패하면 이전 값 그대로. 바꾸는 간격 10초 (첫 설정·규칙에 걸려 바꿔야 하는 경우 제외).
   * 광장 안이면 광장 사용자 상태도 바꿈 → 다른 사람 머리 위 이름이 바로 바뀜.
   * 계정 락(nickacc:<계정>) 안에서 읽기·차지·저장·놓기를 한 번에 → 같은 계정의 동시 요청이 이름을 여러 개 차지해 남기지 않음
   * (이름별 락 nick:<이름>은 claim·release 안쪽, 순서는 늘 계정 → 이름이라 교착 없음)
   */
  async nickSet(raw: unknown): Promise<{ ok: boolean; nick?: string; reason?: string; retryMs?: number }> {
    const r = checkNickname(raw);
    if (!r.ok) return { ok: false, reason: r.reason };
    const me = $sender.account;
    const res = await $lock(`nickacc:${me}`, async (): Promise<{ ok: boolean; reason?: string; retryMs?: number }> => {
      const now = Date.now();
      const st = ((await $global.getMyState()) || {}) as Record<string, unknown>;
      if (st.nick === r.value) return { ok: true };
      const last = typeof st.nickAt === 'number' ? st.nickAt : 0;
      const forced = nickNeedsChange(st);
      if (!forced && typeof st.nick === 'string' && st.nick && now - last < NICK_CHANGE_MS) return { ok: false, reason: 'rate', retryMs: NICK_CHANGE_MS - (now - last) };
      if (!(await claimNick(me, r.value))) return { ok: false, reason: 'taken' };
      await $global.updateMyState({ nick: r.value, nickAt: now, nickReg: nickKey(r.value) });
      // 예전 이름은 놓음 (대소문자만 바꾼 경우는 같은 등록이라 그대로)
      if (typeof st.nick === 'string' && st.nick && nickKey(st.nick) !== nickKey(r.value)) await releaseNick(me, st.nick).catch(() => undefined);
      return { ok: true };
    });
    if (!res.ok) return res;
    if (hubOf()) await $room.updateMyState({ n: r.value }, { returnState: false });
    return { ok: true, nick: r.value };
  }

  // ---------------- 룸 수명 주기 (광장 룸만 있음) ----------------

  /** 끊김: 30초 유예 동안 다른 사람 화면에서 숨김 (다시 보이려면 재접속 뒤 hubHello — 클라이언트는 재접속하면 hello를 다시 보냄), 장부는 재접속 대기 자리로 */
  async onRoomDisconnect(roomId: string, account: string): Promise<void> {
    if (!isHubRoom(roomId)) return;
    await $room.updateUserState(account, { x: 1 }, { returnState: false });
    await editBook(hubWorldOf(roomId), (book, now) => {
      const e = book[roomId]?.[account];
      if (!e || e.a === undefined) return false;
      e.d = now;
    });
  }

  /**
   * 나감(leaveRoom)·재접속 대기 끝: 장부에서 지움. 남기는 것:
   * - 그 사이 다시 배정받은 예약(r만 있음)
   * - 방금(leaveRaceMs 안) hubHello한 접속 기록 — 나감 → 바로 같은 룸에 다시 들어와 hello한 뒤 앞 퇴장 알림이 늦게 온 경우.
   *   SDK 훅에 퇴장 시각이 없어 hello 시각(a)으로 판단. 정말 그 사이에 나간 사람은 hubBye가 이미 지웠거나, 다음 hubFind의 유령 정리가 지움
   */
  async onRoomLeave(roomId: string, account: string): Promise<void> {
    if (!isHubRoom(roomId)) return;
    await editBook(hubWorldOf(roomId), (book, now) => {
      const e = book[roomId]?.[account];
      if (!e || (e.a === undefined && e.d === undefined)) return false;
      if (e.d === undefined && e.a !== undefined && now - e.a < HUB_TIMING.leaveRaceMs) return false;
      delete book[roomId]![account];
    });
    slog('hub_leave', roomId, account);
  }

  /** 빈 룸: 남은 장부 정리 (방금 배정받아 들어오는 중인 예약은 남김) */
  async onRoomDestroy(roomId: string): Promise<void> {
    if (!isHubRoom(roomId)) return;
    await editBook(hubWorldOf(roomId), (book) => {
      const accs = book[roomId];
      if (!accs) return false;
      for (const [acc, e] of Object.entries(accs)) if (e.a !== undefined || e.d !== undefined) delete accs[acc];
    });
  }
}

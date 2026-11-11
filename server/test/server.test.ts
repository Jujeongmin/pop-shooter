/**
 * 계정별 저장·광장·닉네임 (로컬 하네스: cd server && npx -y @agent8/gameserver-node test).
 * 하네스는 실제 네트워크 없이 같은 isolated-vm 런타임에서 훅·함수를 부름 → 푸시·지연은 여기서 검증되지 않음.
 */
import { checkNickname, safeDisplayNick } from '../../src/net/shared/nickFilter.ts';
import { normalizeState } from '../../src/sim/normalize.ts';
import { damagePerShot } from '../../src/sim/actions.ts';

/** 환생 3번·공격력 레벨 40·총 5인 저장 (보이는 환생·공격력 상한 검사용) */
const BIG_SAVE = { v: 1, rebirths: 3, tokens: 3, atkLv: 40, gun: 5, char: 'blue', chars: ['blue'] };

const HUB = 'w1-1';
const OUT = '__no_room__';

/** 하네스 안에는 타이머가 없어 시간 경과는 바쁜 대기로 */
function spin(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* wait */
  }
}

/** 광장 위치 패킷: [순번, 시각, x, z, 방향, vx, vz, 비트] */
function hubPkt(q: number, x: number, z: number): number[] {
  return [q, q * 166, x, z, 0, 0, 0, 1];
}

const INFO = { c: 'blue', g: 0, r: 0, pw: 10, s: 'hub' };

/** 장부에 예약을 직접 적음 (hubFind가 다른 룸을 고를 상황에서 특정 룸으로 넣을 때) */
async function reserve(roomId: string, account: string): Promise<void> {
  const key = 'hub_book_' + roomId.split('-')[0];
  const book = (await $global.getGlobalState([key]))[key] || {};
  book[roomId] = book[roomId] || {};
  book[roomId][account] = { ...book[roomId][account], r: Date.now() };
  await $global.updateGlobalState({ [key]: book });
}

async function book(): Promise<any> {
  return (await $global.getGlobalState(['hub_book_w1'])).hub_book_w1 || {};
}

/** 광장에 들어와 hubHello까지 한 계정들 (예약 → 입장 → hello) */
async function fillHub(server: any, roomId: string, accounts: string[]): Promise<void> {
  for (const a of accounts) {
    await reserve(roomId, a);
    await server.simulateJoin(roomId, a);
    server.connect({ account: a, roomId });
    expect((await server.hubHello(INFO)).ok).toBe(true);
  }
}

async function hubUser(server: any, account: string, roomId = HUB): Promise<any> {
  server.connect({ account, roomId });
  const st = await server.hubState();
  return st.users.find((u: any) => u.account === account);
}

describe('account save', () => {
  test('round trip, lastSeen is server time', async (server) => {
    server.connect({ account: 'alice' });
    expect((await server.saveLoad()).save).toBe(null);
    const w = await server.saveWrite({ v: 1, coins: 1234, atkLv: 5, bestStage: 3, char: 'blue', chars: ['blue'], lastSeen: 1 });
    expect(w.ok).toBe(true);
    const r = await server.saveLoad();
    expect(r.save.coins).toBe(1234);
    expect(r.save.atkLv).toBe(5);
    expect(r.save.bestStage).toBe(3);
    expect(r.save.lastSeen > Date.now() - 60000).toBe(true);
  });

  test('accounts are separate', async (server) => {
    server.connect({ account: 'alice' });
    await server.saveWrite({ v: 1, coins: 50 });
    server.connect({ account: 'bob' });
    expect((await server.saveLoad()).save).toBe(null);
  });

  test('bad values are normalized', async (server) => {
    server.connect({ account: 'carol' });
    await server.saveWrite({ v: 1, coins: -5, atkLv: 'x', char: 'nope', chars: ['nope'] });
    const r = await server.saveLoad();
    expect(r.save.coins).toBe(0);
    expect(r.save.atkLv).toBe(0);
    expect(r.save.char).toBe('blue');
  });

  test('non-object or huge saves are rejected', async (server) => {
    server.connect({ account: 'dave' });
    expect((await server.saveWrite(null)).ok).toBe(false);
    expect((await server.saveWrite({ v: 1, junk: 'x'.repeat(30000) })).ok).toBe(false);
    expect((await server.saveLoad()).save).toBe(null);
  });
});

// ---------------- 광장 (w1-N 룸, 정원 8) ----------------

describe('hub rooms (find / join / capacity)', () => {
  test('hubFind: only open worlds, same room for the same account, 8 per room, 9th goes to w1-2', async (server) => {
    server.connect({ account: 'x', roomId: OUT });
    for (const w of [0, 2, 4, 5, 7, 1.5, '1', null]) expect((await server.hubFind(w)).reason).toBe('bad_world');
    for (const a of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8']) {
      server.connect({ account: a, roomId: OUT });
      expect((await server.hubFind(1)).roomId).toBe('w1-1');
    }
    server.connect({ account: 'h3', roomId: OUT });
    expect((await server.hubFind(1)).roomId).toBe('w1-1');
    server.connect({ account: 'h9', roomId: OUT });
    expect((await server.hubFind(1)).roomId).toBe('w1-2');
    // 월드 2~4는 아직 닫힘 (HUB_OPEN_WORLDS = [1])
    expect((await server.hubFind(2)).reason).toBe('bad_world');
  });

  test('20 reservations in a row never put more than 8 seats in one room', async (server) => {
    const count: Record<string, number> = {};
    for (let i = 0; i < 20; i++) {
      server.connect({ account: `c${i}`, roomId: OUT });
      const id = (await server.hubFind(1)).roomId as string;
      count[id] = (count[id] ?? 0) + 1;
    }
    expect(count['w1-1']).toBe(8);
    expect(count['w1-2']).toBe(8);
    expect(count['w1-3']).toBe(4);
  });

  test('hubHello rejects the 9th user in one room; a member saying hello again is not rejected', async (server) => {
    await fillHub(server, HUB, ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']);
    await reserve(HUB, 'a9');
    await server.simulateJoin(HUB, 'a9');
    server.connect({ account: 'a9', roomId: HUB });
    expect((await server.hubHello(INFO)).reason).toBe('full');
    // 정원 초과로 거절된 사람은 hubMove·hubInfo로도 나타나지 못함
    spin(80);
    server.connect({ account: 'a9', roomId: HUB });
    await server.hubMove(hubPkt(1, 0, 5));
    expect((await server.hubInfo({ g: 3 })).reason).toBe('not_joined');
    expect((await hubUser(server, 'a9'))?.c).toBe(undefined);
    server.connect({ account: 'a2', roomId: HUB });
    const again = await server.hubHello(INFO);
    expect(again.ok).toBe(true);
    expect(again.count).toBe(8);
  });

  test('hubBye frees the seat at once (SDK still lists the user) and hides the user', async (server) => {
    await fillHub(server, HUB, ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']);
    server.connect({ account: 'q3', roomId: HUB });
    expect((await server.hubBye()).ok).toBe(true);
    expect((await hubUser(server, 'q3')).x).toBe(2);
    // hubBye 뒤에 늦게 도착한 위치·정보(throttle 스트림)는 다시 보이게 하지 않음
    spin(80);
    server.connect({ account: 'q3', roomId: HUB });
    await server.hubMove(hubPkt(1, 0, 5));
    expect((await server.hubInfo({ g: 2 })).reason).toBe('not_joined');
    const q3 = await hubUser(server, 'q3');
    expect(q3.x).toBe(2);
    expect(q3.p[3]).toBe(6);
    server.connect({ account: 'new1', roomId: OUT });
    expect((await server.hubFind(1)).roomId).toBe('w1-1');
    await server.simulateJoin(HUB, 'new1');
    server.connect({ account: 'new1', roomId: HUB });
    const h = await server.hubHello(INFO);
    expect(h.ok).toBe(true);
    expect(h.count).toBe(8);
  });

  test('onRoomLeave frees the seat; a reservation is not counted as a member', async (server) => {
    await fillHub(server, HUB, ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8']);
    spin(2100); // hello 직후의 퇴장 알림은 지난 세션 것으로 보고 무시함 (leaveRaceMs)
    await server.simulateLeave(HUB, 'l5');
    server.connect({ account: 'l9', roomId: OUT });
    expect((await server.hubFind(1)).roomId).toBe('w1-1');
    server.connect({ account: 'l1', roomId: HUB });
    expect((await server.hubHello(INFO)).count).toBe(7);
  });

  test('disconnect keeps the seat (grace) and hides the user; same account returns to the same room; leave after grace frees it', async (server) => {
    await fillHub(server, HUB, ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8']);
    await server.simulateDisconnect(HUB, 'g4');
    expect((await hubUser(server, 'g4')).x).toBe(1);
    server.connect({ account: 'other', roomId: OUT });
    expect((await server.hubFind(1)).roomId).toBe('w1-2');
    server.connect({ account: 'g4', roomId: OUT });
    expect((await server.hubFind(1)).roomId).toBe('w1-1');
    server.connect({ account: 'g4', roomId: HUB });
    expect((await server.hubHello(INFO)).ok).toBe(true);
    await server.simulateDisconnect(HUB, 'g4');
    await server.simulateLeave(HUB, 'g4');
    server.connect({ account: 'later', roomId: OUT });
    expect((await server.hubFind(1)).roomId).toBe('w1-1');
  });

  test('one account in two rooms of a world keeps only the newest seat; empty room destroy clears seats', async (server) => {
    await fillHub(server, HUB, ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'dup']);
    await fillHub(server, 'w1-2', ['dup']);
    server.connect({ account: 'fresh', roomId: OUT });
    expect((await server.hubFind(1)).roomId).toBe('w1-1');
    // 장부는 월드별 문서 하나, 지금 있는 사람만: dup은 w1-2에만
    let book = (await $global.getGlobalState(['hub_book_w1'])).hub_book_w1;
    expect(book['w1-1'].dup).toBe(undefined);
    expect(book['w1-2'].dup.a > 0).toBe(true);
    // 빈 룸 정리 (onRoomDestroy): 남은 접속 기록을 지우고 빈 룸 키도 지움
    await fillHub(server, 'w1-3', ['e1']);
    book = (await $global.getGlobalState(['hub_book_w1'])).hub_book_w1;
    expect(book['w1-3'].e1.a > 0).toBe(true);
    await server.onRoomDestroy('w1-3');
    book = (await $global.getGlobalState(['hub_book_w1'])).hub_book_w1;
    expect(book['w1-3']).toBe(undefined);
  });

  test('hubHello needs a seat in the ledger for this room (no joining arbitrary rooms)', async (server) => {
    // hubFind 없이 아무 번호 룸에 들어옴 → 거절, 장부 그대로
    for (const roomId of ['w1-9999', HUB]) {
      await server.simulateJoin(roomId, 'sneak');
      server.connect({ account: 'sneak', roomId });
      expect((await server.hubHello(INFO)).reason).toBe('no_reservation');
    }
    expect((await book())['w1-9999']).toBe(undefined);
    // 다른 룸 예약으로는 이 룸에 못 들어옴
    server.connect({ account: 'sneak', roomId: OUT });
    expect((await server.hubFind(1)).roomId).toBe('w1-1');
    await server.simulateJoin('w1-2', 'sneak');
    server.connect({ account: 'sneak', roomId: 'w1-2' });
    expect((await server.hubHello(INFO)).reason).toBe('no_reservation');
    // 배정받은 룸은 됨
    server.connect({ account: 'sneak', roomId: HUB });
    expect((await server.hubHello(INFO)).ok).toBe(true);
  });

  test('a late onRoomLeave right after a quick rejoin keeps the new seat; a later one frees it', async (server) => {
    await fillHub(server, HUB, ['rj']);
    // 나감 → 다시 배정 → 입장 → hello, 그 뒤 앞 세션의 퇴장 알림이 늦게 옴
    server.connect({ account: 'rj', roomId: OUT });
    expect((await server.hubFind(1)).roomId).toBe(HUB);
    server.connect({ account: 'rj', roomId: HUB });
    expect((await server.hubHello(INFO)).ok).toBe(true);
    await server.onRoomLeave(HUB, 'rj');
    expect((await book())[HUB].rj.a > 0).toBe(true);
    spin(2100);
    await server.onRoomLeave(HUB, 'rj');
    expect((await book())[HUB]).toBe(undefined);
  });

  test('hub functions are rejected outside a hub room', async (server) => {
    for (const roomId of [OUT, 'pb-abc123', 'lb-1', 'w0-1', 'w2-1', 'w7-1', 'w1-12345']) {
      server.connect({ account: 'o', roomId });
      expect((await server.hubHello(INFO)).reason).toBe('not_in_hub');
      expect((await server.hubInfo({ g: 1 })).reason).toBe('not_in_hub');
      expect((await server.hubState()).ok).toBe(false);
      expect((await server.hubBye()).ok).toBe(false);
    }
  });
});

describe('hub info (hello / info validation)', () => {
  test('hubHello: values checked, defaults filled, nickname only from the server, spawn stored', async (server) => {
    await reserve(HUB, 'alice');
    await server.simulateJoin(HUB, 'alice');
    server.connect({ account: 'alice', roomId: HUB });
    expect((await server.hubHello({})).reason).toBe('bad_c');
    expect((await server.hubHello(null)).reason).toBe('bad_c');
    expect((await server.hubHello({ c: 'nope' })).reason).toBe('bad_c');
    expect((await server.hubHello({ c: 'red', g: 16 })).reason).toBe('bad_g');
    expect((await server.hubHello({ c: 'red', g: 1.5 })).reason).toBe('bad_g');
    expect((await server.hubHello({ c: 'red', r: -1 })).reason).toBe('bad_r');
    expect((await server.hubHello({ c: 'red', pw: NaN })).reason).toBe('bad_pw');
    expect((await server.hubHello({ c: 'red', pw: '9' })).reason).toBe('bad_pw');
    expect((await server.hubHello({ c: 'red', s: 'pvp' })).reason).toBe('bad_s');
    const ok = await server.hubHello({ c: 'pink', n: 'ClientName' });
    expect(ok.ok).toBe(true);
    const u = await hubUser(server, 'alice');
    expect(u.c).toBe('pink');
    expect(u.g).toBe(0);
    expect(u.r).toBe(0);
    expect(u.pw).toBe(0);
    expect(u.s).toBe('hub');
    expect(u.n).toBe('');
    expect(u.p[2]).toBe(0);
    expect(u.p[3]).toBe(6);
    expect(u.x).toBe(0);
  });

  test('hubInfo: changes only given fields; any bad field changes nothing', async (server) => {
    await fillHub(server, HUB, ['bob']);
    server.connect({ account: 'bob', roomId: HUB });
    await server.saveWrite(BIG_SAVE);
    const cap = damagePerShot(normalizeState(BIG_SAVE, Date.now()));
    expect((await server.hubInfo({ g: 15, r: 3, pw: cap / 2, s: 'training' })).ok).toBe(true);
    let u = await hubUser(server, 'bob');
    expect(u.g).toBe(15);
    expect(u.r).toBe(3);
    expect(u.pw).toBe(cap / 2);
    expect(u.s).toBe('training');
    expect(u.c).toBe('blue');
    server.connect({ account: 'bob', roomId: HUB });
    expect((await server.hubInfo({ c: 'black', g: -1 })).reason).toBe('bad_g');
    expect((await server.hubInfo({ s: 'battle', pw: Infinity })).reason).toBe('bad_pw');
    expect((await server.hubInfo({ c: '<img>' })).reason).toBe('bad_c');
    u = await hubUser(server, 'bob');
    expect(u.c).toBe('blue');
    expect(u.s).toBe('training');
    server.connect({ account: 'bob', roomId: HUB });
    expect((await server.hubInfo({ c: 'black', s: 'battle' })).ok).toBe(true);
    expect((await hubUser(server, 'bob')).s).toBe('battle');
    server.connect({ account: 'bob', roomId: HUB });
    expect((await server.hubInfo(null)).ok).toBe(true);
  });

  test('visible rebirths and power are capped by the saved progress (hello and info)', async (server) => {
    await reserve(HUB, 'cap');
    await server.simulateJoin(HUB, 'cap');
    server.connect({ account: 'cap', roomId: HUB });
    // 저장 없음 → 새 판 기준 (환생 0, 기본 공격력)
    const base = damagePerShot(normalizeState({}, Date.now()));
    expect((await server.hubHello({ c: 'blue', r: 99, pw: 1e30 })).ok).toBe(true);
    let u = await hubUser(server, 'cap');
    expect(u.r).toBe(0);
    expect(u.pw).toBe(base);
    server.connect({ account: 'cap', roomId: HUB });
    await server.saveWrite(BIG_SAVE);
    const cap = damagePerShot(normalizeState(BIG_SAVE, Date.now()));
    expect(cap > base).toBe(true);
    expect((await server.hubInfo({ r: 1e6, pw: 1e300 })).ok).toBe(true);
    u = await hubUser(server, 'cap');
    expect(u.r).toBe(3);
    expect(u.pw).toBe(cap);
    // 저장보다 낮은 값은 그대로
    server.connect({ account: 'cap', roomId: HUB });
    await server.hubInfo({ r: 1, pw: 1 });
    u = await hubUser(server, 'cap');
    expect(u.r).toBe(1);
    expect(u.pw).toBe(1);
  });

  test('hello again keeps the last accepted position (no jump back to spawn)', async (server) => {
    await fillHub(server, HUB, ['pos']);
    spin(80);
    server.connect({ account: 'pos', roomId: HUB });
    await server.hubMove(hubPkt(1, 1, 5));
    server.connect({ account: 'pos', roomId: HUB });
    expect((await server.hubHello({ c: 'red' })).ok).toBe(true);
    const u = await hubUser(server, 'pos');
    expect(u.p[2]).toBe(1);
    expect(u.p[3]).toBe(5);
    expect(u.c).toBe('red');
  });
});

describe('hub move validation', () => {
  test('normal walk accepted; too frequent, too fast, bad format and far out of bounds rejected; edge clamped', async (server) => {
    await fillHub(server, HUB, ['mv']);
    spin(80);
    server.connect({ account: 'mv', roomId: HUB });
    await server.hubMove(hubPkt(1, 0, 5));
    expect((await hubUser(server, 'mv')).p[3]).toBe(5);
    // 최소 간격 안 → 버림
    server.connect({ account: 'mv', roomId: HUB });
    await server.hubMove(hubPkt(2, 0, 4.9));
    expect((await hubUser(server, 'mv')).p[3]).toBe(5);
    // 0.1초에 12m → 버림
    spin(100);
    server.connect({ account: 'mv', roomId: HUB });
    await server.hubMove(hubPkt(3, 12, 5));
    expect((await hubUser(server, 'mv')).p[2]).toBe(0);
    // 걷기 (0.1초에 1m)
    spin(100);
    server.connect({ account: 'mv', roomId: HUB });
    await server.hubMove(hubPkt(4, 1, 5));
    expect((await hubUser(server, 'mv')).p[2]).toBe(1);
    // 광장 밖 (margin 넘음) → 버림
    spin(100);
    server.connect({ account: 'mv', roomId: HUB });
    await server.hubMove(hubPkt(5, 1, 40));
    expect((await hubUser(server, 'mv')).p[3]).toBe(5);
    // 잘못된 형식
    spin(100);
    server.connect({ account: 'mv', roomId: HUB });
    const bads: unknown[] = [[1, 2, 3], ['a', 1, 1, 5, 0, 0, 0, 1], [1, 1, 1, NaN, 0, 0, 0, 1], [1, 1, 1, 5, 0, 99, 0, 1], 'x', null, [1, 1, 1, 5, 1e9, 0, 0, 1]];
    for (const b of bads) await server.hubMove(b);
    let u = await hubUser(server, 'mv');
    expect(u.p[2]).toBe(1);
    expect(u.p[3]).toBe(5);
    // 경계 바로 밖 (margin 안) → 경계로 자름, 방향은 -π..π, 비트는 하위 2비트만
    await fillHub(server, HUB, ['edge']);
    spin(80);
    server.connect({ account: 'edge', roomId: HUB });
    await server.hubMove([1, 1, 0, 15.9, 7, 0, 0, 255]);
    spin(3100);
    server.connect({ account: 'edge', roomId: HUB });
    await server.hubMove([2, 2, 15.8, 15.9, 7, 0, 0, 255]);
    u = await hubUser(server, 'edge');
    expect(u.p[2]).toBe(15.5);
    expect(u.p[3]).toBe(15.5);
    expect(Math.abs(u.p[4]) <= Math.PI).toBe(true);
    expect(u.p[7]).toBe(3);
  });

  test('snaps: range mat, return from battle and spawn are allowed; long-rejected moves resync after 3 s', async (server) => {
    await fillHub(server, HUB, ['sn']);
    spin(80);
    server.connect({ account: 'sn', roomId: HUB });
    await server.hubMove(hubPkt(1, -1.5, 5));
    for (const [i, x, z] of [[2, -3, 4], [3, -4.5, 3], [4, -6, 2.2]]) {
      spin(100);
      server.connect({ account: 'sn', roomId: HUB });
      await server.hubMove(hubPkt(i!, x!, z!));
    }
    expect((await hubUser(server, 'sn')).p[2]).toBe(-6);
    // 사격장 구역 가장자리 → 판 위 무작위 자리 (0.1초에 4.6m)
    spin(100);
    server.connect({ account: 'sn', roomId: HUB });
    await server.hubMove(hubPkt(5, -10.2, 0.4));
    expect((await hubUser(server, 'sn')).p[2]).toBe(-10.2);
    // 전투에서 돌아옴: 포털 앞 (0, -3.3)으로 순간이동
    spin(100);
    server.connect({ account: 'sn', roomId: HUB });
    await server.hubMove(hubPkt(6, 0, -3.3));
    expect((await hubUser(server, 'sn')).p[3]).toBe(-3.3);
    // 순간이동 구역이 아닌 먼 곳 → 버림, 3초 넘게 버려진 뒤에는 다시 맞춤
    spin(100);
    server.connect({ account: 'sn', roomId: HUB });
    await server.hubMove(hubPkt(7, 12, 12));
    expect((await hubUser(server, 'sn')).p[2]).toBe(0);
    spin(3050);
    server.connect({ account: 'sn', roomId: HUB });
    await server.hubMove(hubPkt(8, 12, 12));
    expect((await hubUser(server, 'sn')).p[2]).toBe(12);
    // 시작 지점은 어디서든
    spin(100);
    server.connect({ account: 'sn', roomId: HUB });
    await server.hubMove(hubPkt(9, 0, 6));
    expect((await hubUser(server, 'sn')).p[3]).toBe(6);
  });

  test('after a disconnect only a new hubHello shows the user again (moves do not); seat stays counted; moves outside a hub room are ignored', async (server) => {
    await fillHub(server, HUB, ['erin']);
    await server.simulateDisconnect(HUB, 'erin');
    expect((await hubUser(server, 'erin')).x).toBe(1);
    expect((await book())[HUB].erin.d > 0).toBe(true);
    spin(80);
    server.connect({ account: 'erin', roomId: HUB });
    await server.hubMove(hubPkt(1, 0, 5.5));
    let u = await hubUser(server, 'erin');
    expect(u.x).toBe(1);
    expect(u.p[3]).toBe(6);
    // 재접속 뒤 hello (장부의 재접속 대기 자리 d로 들어옴) → 다시 보임, 장부는 접속(a)으로
    server.connect({ account: 'erin', roomId: HUB });
    const h = await server.hubHello(INFO);
    expect(h.ok).toBe(true);
    expect(h.count).toBe(1);
    expect((await hubUser(server, 'erin')).x).toBe(0);
    const e = (await book())[HUB].erin;
    expect(e.a > 0 && e.d === undefined).toBe(true);
    spin(80);
    server.connect({ account: 'erin', roomId: HUB });
    await server.hubMove(hubPkt(2, 0, 5.5));
    expect((await hubUser(server, 'erin')).p[3]).toBe(5.5);
    server.connect({ account: 'erin', roomId: OUT });
    await server.hubMove(hubPkt(3, 0, 5));
    u = await hubUser(server, 'erin');
    expect(u.p[3]).toBe(5.5);
  });
});

// ---------------- 닉네임 ----------------

describe('nickname storage (server final check)', () => {
  test('nickGet empty at first; nickSet validates format and profanity, keeps the old nickname on failure', async (server) => {
    server.connect({ account: 'nk', roomId: OUT });
    expect((await server.nickGet()).nick).toBe(null);
    expect((await server.nickSet('뽀야')).ok).toBe(true);
    expect((await server.nickGet()).nick).toBe('뽀야');
    expect((await server.nickSet('a')).reason).toBe('length');
    expect((await server.nickSet('   ')).reason).toBe('empty');
    expect((await server.nickSet(42)).reason).toBe('empty');
    expect((await server.nickSet('a<b>c')).reason).toBe('chars');
    expect((await server.nickSet('씨1발')).reason).toBe('blocked');
    expect((await server.nickSet('F u c k')).reason).toBe('blocked');
    expect((await server.nickSet('팝슈터운영')).reason).toBe('blocked');
    expect((await server.nickGet()).nick).toBe('뽀야');
  });

  test('duplicate nickname refused (case and spaces ignored), freed after a rename', async (server) => {
    server.connect({ account: 'alice', roomId: OUT });
    expect((await server.nickSet('Bubu')).ok).toBe(true);
    server.connect({ account: 'bob', roomId: OUT });
    expect((await server.nickSet('bubu')).reason).toBe('taken');
    expect((await server.nickSet('  BUBU  ')).reason).toBe('taken');
    expect((await server.nickGet()).nick).toBe(null);
    expect((await server.nickSet('Momo')).ok).toBe(true);
    server.connect({ account: 'alice', roomId: OUT });
    spin(10_100);
    expect((await server.nickSet('BUBU')).ok).toBe(true);
    spin(10_100);
    expect((await server.nickSet('Pang')).ok).toBe(true);
    server.connect({ account: 'bob', roomId: OUT });
    spin(10_100);
    expect((await server.nickSet('bubu')).ok).toBe(true);
  });

  test('one account never owns more than one ps_nick row (first set, refused changes, renames)', async (server) => {
    // 하네스의 $lock은 동시 대기를 못 해 실서버가 계정 락(nickacc)으로 줄 세운 결과와 같은 순차 호출로 불변식을 검사
    const owned = async (acc: string) => (await $global.getCollectionItems('ps_nick', { filters: [{ field: 'acc', operator: '==', value: acc }] })).map((it: any) => it.key);
    server.connect({ account: 'sq', roomId: OUT });
    expect((await server.nickSet('Alpha')).ok).toBe(true);
    expect((await server.nickSet('Beta')).reason).toBe('rate');
    expect((await server.nickSet('Gamma')).reason).toBe('rate');
    expect(await owned('sq')).toEqual(['alpha']);
    spin(10_100);
    expect((await server.nickSet('Delta')).ok).toBe(true);
    expect(await owned('sq')).toEqual(['delta']);
    // nickGet 등록부 고치기도 계정 락 안: 지금 이름만 등록, 줄이 늘지 않음
    expect((await server.nickGet()).nick).toBe('Delta');
    expect(await owned('sq')).toEqual(['delta']);
    // 다른 계정은 풀린 이름을 쓸 수 있음
    server.connect({ account: 'sq2', roomId: OUT });
    expect((await server.nickSet('alpha')).ok).toBe(true);
  });

  test('rate limit (first set free, change within 10 s refused, same name fine)', async (server) => {
    server.connect({ account: 'nr', roomId: OUT });
    expect((await server.nickSet('First')).ok).toBe(true);
    const rate = await server.nickSet('Second');
    expect(rate.reason).toBe('rate');
    expect(rate.retryMs > 0 && rate.retryMs <= 10_000).toBe(true);
    expect((await server.nickSet('First')).ok).toBe(true);
    expect((await server.nickGet()).nick).toBe('First');
  });

  test('stored nickname shows in the hub (client value ignored); nickSet inside the hub updates it; save is untouched', async (server) => {
    server.connect({ account: 'ns', roomId: OUT });
    await server.saveWrite({ v: 1, coins: 77 });
    await server.nickSet('저장된이름');
    await fillHub(server, HUB, ['ns']);
    expect((await hubUser(server, 'ns')).n).toBe('저장된이름');
    await fillHub(server, HUB, ['nt']);
    expect((await hubUser(server, 'nt')).n).toBe('');
    server.connect({ account: 'nt', roomId: HUB });
    expect((await server.nickSet('After')).ok).toBe(true);
    expect((await hubUser(server, 'nt')).n).toBe('After');
    server.connect({ account: 'ns', roomId: OUT });
    expect((await server.saveLoad()).save.coins).toBe(77);
  });

  test('legacy name that fails the current rules: mustChange, hidden in the hub, can be changed at once', async (server) => {
    await $global.updateUserState('mallory', { nick: '보ㅈㅣ킹', nickAt: Date.now() });
    server.connect({ account: 'mallory', roomId: OUT });
    const g = await server.nickGet();
    expect(g.mustChange).toBe(true);
    expect(g.nick).toBe(null);
    await fillHub(server, HUB, ['mallory']);
    expect((await hubUser(server, 'mallory')).n).toBe('');
    server.connect({ account: 'mallory', roomId: OUT });
    expect((await server.nickSet('새로운이름')).ok).toBe(true);
    expect((await server.nickGet()).nick).toBe('새로운이름');
  });
});

describe('nickname filter (shared client/server check)', () => {
  const ok = (raw: string, value = raw) => {
    const r = checkNickname(raw);
    if (!r.ok) throw new Error(`expected ok: ${JSON.stringify(raw)} -> ${r.reason}`);
    expect(r.value).toBe(value);
  };
  const bad = (raw: unknown, reason: string) => {
    const r = checkNickname(raw);
    if (r.ok) throw new Error(`expected ${reason}: ${JSON.stringify(raw)} passed as ${JSON.stringify(r.value)}`);
    expect(r.reason).toBe(reason);
  };

  test('normal names: Korean, English, digits, mixed, inner space, trimmed', async () => {
    for (const n of ['뽀삐', '버블파이터', 'Popi', 'player1', '뽀삐123', 'Mochi 짱', 'ab', '가나다라마바사아자차카타', 'A1B2C3D4E5F6']) ok(n);
    ok('  앨리스  짱 ', '앨리스 짱');
    ok('뽀\t삐', '뽀 삐');
  });

  test('length (2..12, counted after trim) and empty', async () => {
    bad('', 'empty');
    bad('     ', 'empty');
    bad(undefined, 'empty');
    bad(42, 'empty');
    bad('a', 'length');
    bad('가', 'length');
    bad('a'.repeat(13), 'length');
    bad('가나다라마바사아자차카타파', 'length');
    ok(' a b ', 'a b');
  });

  test('characters: no symbols, emoji, control characters or HTML', async () => {
    for (const n of ['a<b>c', '<script>', 'na_me', 'name!', 'hi@there', 'abc' + String.fromCharCode(7) + 'd', '뽀삐😀', 'ｆｕｌｌ', 'a.b', '이름#1']) bad(n, 'chars');
  });

  test('Korean profanity incl. evasion (spaces, digits, elongation, jamo split, initials)', async () => {
    for (const n of ['씨발', '시발놈', '씨 발', '씨1발', '씨이발', '시ㅂ알', 'ㅅㅂ', 'ㅅ ㅂ', 'ㅂㅅ아', '병신', '병 신 아', '븅신', '개새끼', '개 새 끼', '존나', '지랄', '좆밥', '니애미', '느금마', '섹스', '한남충', '김치녀', '틀딱', 'ㅅ1발놈', 'ㅅ발', 'ㅆ발', '시ㅂ', 'ㅂ신', 'ㅄ아', 'ㅈ랄'])
      bad(n, 'blocked');
  });

  test('English profanity incl. case, spaces, repeats, leetspeak', async () => {
    for (const n of ['fuck', 'FUCK', 'Fuck You', 'f u c k', 'fuuuuck', 'fvck', 'sh1t', 'B1TCH', 'b i t c h', 'a55hole', 'n1gger', 'p0rn', 'ass', 'ASS', 'dick', 'Big Dick', 'sexy', 'wtf', 'nazi', 'h1tler', 'sibal', 'SSIBAL', 'tlqkf', 'qudtls', 'rotoRl'])
      bad(n, 'blocked');
  });

  test('false positives: normal words that contain a blocked piece stay allowed', async () => {
    for (const n of ['class', 'Classic', 'bass', 'assassin', 'passion', 'grass', 'Dickens', 'cocktail', 'peacock', 'cockpit', 'Essex', 'sussex', 'Scunthorpe', 'shitake', 'therapist', 'Hancock', 'title', 'analyst'])
      ok(n);
    for (const n of ['시발점', '시바견', '새끼손가락', '자지러지다', '보지마', '조지', '곳바', '시바이누', '지하철']) ok(n);
    for (const n of ['스시바', '미친듯이', '병아리', '신발', '시계', '새우깡', '개구리', '닥터', '꺼벙이', '조심해']) ok(n);
    for (const n of ['사방', 'ㅋㅋ사방', 'ㅎㅎ신발', '바보ㅋ', '수박ㅋㅋ', 'ㅇㅇ지수']) ok(n);
  });

  test('jamo / lookalike / repeat bypasses and impersonation are blocked; normal names stay allowed', async () => {
    for (const n of ['보ㅈㅣ킹', '보 지 킹', 'ㅂㅗㅈㅣ킹', '보ㅈl킹', '보ㅈ1킹', '보ㅗ지킹', '보오오지', '운영자', '관리자짱', 'GM', 'GM 팝슈터', 'admin', 'Admin123', '팝슈터운영', '팝슈터공식', 'PopShooterTeam', '개발자'])
      expect(checkNickname(n).ok).toBe(false);
    for (const n of ['보지마', '하늘빛', '조지', '시바견', '팝슈터테스터', 'gamer', 'Model', 'Dev Kim', '모드', '관리', '운영', 'Lily', '지니', '보물'])
      expect(checkNickname(n).ok).toBe(true);
    expect(safeDisplayNick('보ㅈㅣ킹')).toBe('닉네임 변경 필요');
    expect(safeDisplayNick(' 하늘빛 ')).toBe('하늘빛');
  });
});

// ---------------- 기록판 ----------------

describe('rank board', () => {
  test('saves become rows ordered by rebirths, then best stage, then power; my rank; no account ids', async (server) => {
    const put = async (acc: string, rebirths: number, bestStage: number, atkLv: number) => {
      server.connect({ account: acc });
      await server.saveWrite({ v: 1, rebirths, tokens: rebirths, bestStage, runBest: 0, atkLv, char: 'blue', chars: ['blue'] });
    };
    await put('r1', 0, 5, 10);
    await put('r2', 1, 2, 0);
    await put('r3', 0, 5, 40);
    await put('r4', 0, 0, 0);
    server.connect({ account: 'r1' });
    const b = await server.rankTop();
    expect(b.ok).toBe(true);
    expect(b.rows.length).toBe(3);
    expect(b.rows[0].rb).toBe(1);
    expect(b.rows[1].pw > b.rows[2].pw).toBe(true);
    expect(b.myRank).toBe(3);
    expect(b.rows[2].me).toBe(true);
    expect(JSON.stringify(b).includes('"acc"')).toBe(false);
    expect(JSON.stringify(b).includes('r1')).toBe(false);
  });

  test('saving again updates the same row (one per account) and picks up the nickname', async (server) => {
    server.connect({ account: 'nk1' });
    await server.saveWrite({ v: 1, bestStage: 1, char: 'blue', chars: ['blue'] });
    expect((await server.nickSet('기록왕')).ok).toBe(true);
    await server.saveWrite({ v: 1, bestStage: 1, coins: 10, char: 'blue', chars: ['blue'] });
    const b = await server.rankTop();
    expect(b.rows.length).toBe(1);
    expect(b.rows[0].bs).toBe(1);
    expect(b.rows[0].nick).toBe('기록왕');
  });
});


// ---------------- 경제 검사 (저장) ----------------

describe('save economy check', () => {
  test('coins far beyond what the time allows are clamped and the clamp is returned', async (server) => {
    server.connect({ account: 'ec1' });
    await server.saveWrite({ v: 1, coins: 100, char: 'blue', chars: ['blue'] });
    const r = await server.saveWrite({ v: 1, coins: 1e15, char: 'blue', chars: ['blue'] });
    expect(r.ok).toBe(true);
    expect(typeof r.coins).toBe('number');
    expect(r.coins < 1e6).toBe(true);
    expect((await server.saveLoad()).save.coins).toBe(r.coins);
  });

  test('impossible stage / levels / skipped rebirths are rejected and the server save is returned to adopt', async (server) => {
    server.connect({ account: 'ec2' });
    await server.saveWrite({ v: 1, coins: 0, char: 'blue', chars: ['blue'] });
    for (const bad of [{ bestStage: 15 }, { atkLv: 500 }, { rebirths: 3, tokens: 3 }]) {
      const r = await server.saveWrite({ v: 1, char: 'blue', chars: ['blue'], ...bad });
      expect(r.ok).toBe(false);
      expect(r.fix.bestStage).toBe(0);
    }
    expect((await server.saveLoad()).save.bestStage).toBe(0);
  });

  test('premium values are server-owned: client gems / pass / paid chars are ignored', async (server) => {
    server.connect({ account: 'ec3' });
    await server.saveWrite({ v: 1, gems: 5, char: 'blue', chars: ['blue'] });
    const r = await server.saveWrite({ v: 1, gems: 999999, passMult: 64, char: 'black', chars: ['blue', 'black'] });
    expect(r.ok).toBe(true);
    // 새 계정은 서버 팝젬 0에서 시작 (첫 저장의 팝젬도 믿지 않음), 이후에도 클라이언트 값 무시
    expect(r.prem.gems).toBe(0);
    expect(r.prem.passMult).toBe(1);
    expect(r.prem.char).toBe('blue');
    const s = (await server.saveLoad()).save;
    expect(s.gems).toBe(0);
    expect(s.char).toBe('blue');
  });
});

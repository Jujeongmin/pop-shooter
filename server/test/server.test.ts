/**
 * 계정별 저장 (로컬 하네스: cd server && npx -y @agent8/gameserver-node test).
 */

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

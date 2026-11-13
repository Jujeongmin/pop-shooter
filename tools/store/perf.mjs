// 광장 프레임 재기 (개발 서버 페이지 안에서 실행할 코드를 만들어 줌): 가짜 접속자 N명을 광장에 걷게 하고
// 몇 초 동안 프레임 시간·그리기 호출·삼각형을 잼. 내장 브라우저(실제 GPU)에서 javascript_tool로 붙여 넣어 씀.
// node tools/store/perf.mjs [사람 수=16] [초=6]  → 붙여 넣을 코드를 출력
const n = Number(process.argv[2] ?? 16);
const sec = Number(process.argv[3] ?? 6);
console.log(`
for (let i = 0; i < 100 && !window.__game; i++) await new Promise((r) => setTimeout(r, 100));
const g = window.__game;
await g.assets.allGuns();
for (const id of ['blue','yellow','red','pink','white','black']) await g.assets.char(id);
const { LobbyPeers } = await import('/src/net/LobbyPeers.ts');
const { HubBuffer } = await import('/src/net/hubBuffer.ts');
const peers = window.__perfPeers ?? new LobbyPeers({ assets: g.assets, parent: g.hub.root, targets: g.hub.targets, me: g.pos, camera: g.stage.camera });
window.__perfPeers = peers;
const chars = ['blue','yellow','red','pink','white','black'];
const list = [];
for (let i = 0; i < ${n}; i++) {
  const p = { account: 'perf' + i, nick: '점검' + i, char: chars[i % 6], gun: i % 8, rebirths: i, power: 1e6 * (i + 1), status: 'hub', gear: 0b111111111, buffer: new HubBuffer() };
  peers.add(p); list.push(p);
}
let seq = 1;
const t0 = performance.now();
const tick = setInterval(() => {
  const t = performance.now();
  list.forEach((p, i) => {
    const a = (t - t0) / 4000 + i * 0.4;
    const x = Math.cos(a) * (4 + (i % 4) * 2.5), z = 2 + Math.sin(a) * (4 + (i % 4) * 2.5);
    p.buffer.push([seq, t, x, z, a + Math.PI / 2, -Math.sin(a) * 2, Math.cos(a) * 2, 1], t);
  });
  seq++;
}, 166);
await new Promise((r) => setTimeout(r, 1500));
const r = g.stage.renderer;
// 렌더 CPU 시간 (화면 갱신 주기에 묶인 프레임 간격과 달리 실제 일한 시간)
const orig = r.render.bind(r);
let renderMs = 0, renders = 0, perCall = 0, perTri = 0;
r.render = (s, c) => { const a = performance.now(); orig(s, c); renderMs += performance.now() - a; renders++; perCall += r.info.render.calls; perTri += r.info.render.triangles; };
const frames = [];
let n = 0, last = performance.now();
await new Promise((done) => {
  const f = () => {
    const now = performance.now(); frames.push(now - last); last = now;
    n++;
    if (now - t0 < ${sec * 1000} + 1500) requestAnimationFrame(f); else done();
  };
  requestAnimationFrame(f);
});
clearInterval(tick);
r.render = orig;
for (const p of list) peers.remove(p.account);
frames.sort((a, b) => a - b);
const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
JSON.stringify({ peers: ${n}, frames: frames.length, avgMs: +avg.toFixed(2), p95Ms: +frames[Math.floor(frames.length * 0.95)].toFixed(2), callsPerRender: Math.round(perCall / renders), trisPerRender: Math.round(perTri / renders), renderCpuMs: +(renderMs / renders).toFixed(2), autoReset: r.info.autoReset, pixelRatio: r.getPixelRatio(), geos: r.info.memory.geometries, tex: r.info.memory.textures, programs: r.info.programs.length });
`);

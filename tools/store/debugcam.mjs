// 전투 중 캐릭터가 사라지는 문제 추적: 스테이지마다 카메라·캐릭터 위치 기록
import { launch } from './cdp.mjs';
const b = await launch({ width: 720, height: 720, port: 9336 });
await b.send('Network.enable');
await b.send('Network.setBlockedURLs', { urls: ['*verse8.io*', '*verse8.games*'] });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('pop-shooter.guide','off')}catch(e){}" });
await b.send('Page.navigate', { url: 'http://localhost:5220/' });
await new Promise((r) => setTimeout(r, 12000));
const log = await b.evaluate(`
  const g = window.__game;
  const { stageHp } = await import('/src/sim/stages.ts');
  const { autoDps } = await import('/src/sim/actions.ts');
  let s = { ...g.state, tutorial: 99 };
  const want = stageHp(10) / 2.5; let lo = 0, hi = 1e15;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (autoDps({ ...s, trAtk: mid }) < want) lo = mid; else hi = mid; }
  g.setState({ ...s, trAtk: hi }, false);
  const st = g.stage; cancelAnimationFrame(st.raf); st.raf = 0;
  const step = (dt) => { for (const f of st.frames) f(dt); st.renderer.render(st.scene, st.camera); };
  window.__battle.start(1);
  const out = []; let last = '';
  for (let i = 0; i < 30 * 20; i++) {
    step(1 / 30);
    const run = window.__battle.run; const stage = run ? run.stage : 'end';
    const key = String(stage);
    if (key !== last || i % 45 === 0) {
      last = key;
      const c = st.camera.position; const a = g.avatar.root;
      let vis = true; for (let o = a; o; o = o.parent) if (!o.visible) { vis = false; break; }
      out.push({ t: (i / 30).toFixed(1), stage, pos: [g.pos.x, g.pos.y, g.pos.z].map((v) => +v.toFixed(2)), cam: [c.x, c.y, c.z].map((v) => +v.toFixed(2)), focus: +g.cam.focus.toFixed(2), lookUp: +g.cam.lookUp.toFixed(2), avatarVis: vis, avatarPos: [a.position.x, a.position.y, a.position.z].map((v) => +v.toFixed(2)), mode: g.mode });
    }
    if (!run && i > 60) break;
  }
  return out;
`);
for (const l of log) console.log(JSON.stringify(l));
b.close();

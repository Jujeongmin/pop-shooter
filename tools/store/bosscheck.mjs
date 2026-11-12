// 큰 보스 화면 확인: 월드 w의 대장 스테이지를 바로 띄우고 찍음. node tools/store/bosscheck.mjs <w> <폭> <높이> <파일>
import { launch } from './cdp.mjs';
const [w, W, H, file] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4]), process.argv[5]];
const b = await launch({ width: W, height: H, port: 9337 });
await b.send('Network.enable');
await b.send('Network.setBlockedURLs', { urls: ['*verse8.io*', '*verse8.games*'] });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('pop-shooter.guide','off')}catch(e){}" });
await b.send('Page.navigate', { url: 'http://localhost:5220/' });
await new Promise((r) => setTimeout(r, 12000));
const info = await b.evaluate(`
  const g = window.__game; const bs = window.__battle;
  const { startBattle } = await import('/src/sim/battle.ts');
  for (const s of ['.nick-wrap', '.daily-wrap']) document.querySelectorAll(s).forEach((e) => e.remove());
  g.setState({ ...g.state, tutorial: 99, bestStage: ${w * 10 - 1}, trAtk: 0 }, false);
  bs.start(${w});
  await new Promise((r) => setTimeout(r, 2600));
  const run = bs.run; run.stage = ${w * 10}; run.battle = startBattle(run.from, run.stage);
  bs.boss.dispose(); bs.boss.root.removeFromParent(); bs.boss = null;
  await new Promise((r) => setTimeout(r, 1800));
  const c = g.stage.camera.position;
  return { h: bs.boss?.height, cam: [c.x, c.y, c.z].map((v) => +v.toFixed(2)) };
`);
console.log(JSON.stringify(info));
await b.shot(file);
b.close();

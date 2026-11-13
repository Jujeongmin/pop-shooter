// 연사 초당 30발: 사격장 한 번에 여러 줄기 확인 (오프라인 헤드리스)
import { launch } from './cdp.mjs';
const b = await launch({ width: 900, height: 600, port: 9339 });
await b.send('Network.enable');
await b.send('Network.setBlockedURLs', { urls: ['*verse8.io*', '*verse8.games*'] });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('pop-shooter.guide','off')}catch(e){}" });
await b.send('Page.navigate', { url: 'http://localhost:5220/' });
await new Promise((r) => setTimeout(r, 12000));
const r = await b.evaluate(`
  const g = window.__game;
  for (const s of ['.nick-wrap', '.daily-wrap']) document.querySelectorAll(s).forEach((e) => e.remove());
  g.setState({ ...g.state, tutorial: 99, trSpd: 2900, trAtk: 0 }, false);
  g.facilityActions.range({ id: 'range' });
  await new Promise((r) => setTimeout(r, 2500));
  const before = g.state.trAtk;
  // 렌더 직후 보이는 탄 줄기 수를 여러 번 셈
  let maxVis = 0;
  for (let i = 0; i < 40; i++) { await new Promise((r) => requestAnimationFrame(r)); let v = 0; g.stage.scene.traverse((o) => { if (o.isMesh && o.visible && o.scale.z > 2 && o.material?.transparent && o.material.blending === 2) v++; }); maxVis = Math.max(maxVis, v); }
  await new Promise((r) => setTimeout(r, 2000));
  return { sps: 1 + 2900 / 100, hud: document.querySelector('.hud-stats')?.innerText.split(String.fromCharCode(10)).slice(0, 6).join(' / '), maxTracers: maxVis, atkGain2s: g.state.trAtk - before };
`);
console.log(JSON.stringify(r));
await b.shot('store-assets/_multi.png');
b.close();

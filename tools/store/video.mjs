// 스토어 플레이 영상 720×720 mp4 (무음). 게임을 프레임 단위로 진행하며 화면(DOM 포함)을 JPEG로 받아 ffmpeg로 묶음.
// 광장 → 포털 전투(월드 1, 1-1부터 연속 클리어) → 대장 처치·만세. node tools/store/video.mjs <출력 폴더>
import { spawn } from 'node:child_process';
import path from 'node:path';
import { launch } from './cdp.mjs';

const OUT = process.argv[2] ?? 'store-assets';
const S = 720;
const FPS = 30;
/** 게임 시간 배속 (전투 사이 쉬는 시간이 길어 조금 빠르게) */
const SPEED = 1.35;
const MAX_SEC = 14.8;

const b = await launch({ width: S, height: S, port: 9335 });
await b.send('Network.enable');
await b.send('Network.setBlockedURLs', { urls: ['*verse8.io*', '*verse8.games*'] });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('pop-shooter.guide','off');localStorage.setItem('pop-shooter.lang','ko')}catch(e){}" });
await b.send('Page.navigate', { url: 'http://localhost:5220/?offline=1&guns=lod0&allchars=1' });
await new Promise((r) => setTimeout(r, 12000));

// 준비: 창 닫기, 대장(1-10)을 약 2.5초에 깨는 공격력, 실시간 루프 멈춤 → step(dt)로 진행
await b.evaluate(`
  const g = window.__game;
  for (const s of ['.nick-wrap', '.daily-wrap']) document.querySelectorAll(s).forEach((e) => e.remove());
  document.querySelectorAll('.result-wrap:not([hidden])').forEach((e) => e.remove());
  for (const el of document.querySelectorAll('#ui *')) if (el.childElementCount === 0 && /마우스 고정/.test(el.textContent || '')) el.style.display = 'none';
  const { stageHp } = await import('/src/sim/stages.ts');
  const { autoDps } = await import('/src/sim/actions.ts');
  let s = { ...g.state, gun: 4, bestStage: 9, runBest: 9, chars: ['blue', 'yellow', 'red'], tutorial: 99, gear: 0b111111, trSpd: 1e6, mAtk: 20 };
  // 공격 훈련치를 이분 탐색: 대장 체력 / 2.5초
  const want = stageHp(10) / 2.5; let lo = 0, hi = 1e15;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (autoDps({ ...s, trAtk: mid }) < want) lo = mid; else hi = mid; }
  s = { ...s, trAtk: hi };
  g.setState(s, false);
  g.setWorld(1);
  g.placeAt(0, -6.2, Math.PI); g.cam.yaw = 0; g.cam.pitch = 0;
  const st = g.stage;
  cancelAnimationFrame(st.raf); st.raf = 0;
  window.__step = (dt) => { for (const f of st.frames) f(dt); st.renderer.render(st.scene, st.camera); };
  for (let i = 0; i < 20; i++) window.__step(1 / 30);
  return 'ok';
`);

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS),
  path.join(OUT, 'gameplay_720x720.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });

const total = Math.round(MAX_SEC * FPS);
const dt = (1 / FPS) * SPEED;
let ended = -1;
for (let f = 0; f < total; f++) {
  // 0.8초 광장 → 전투 시작
  if (f === Math.round(0.8 * FPS)) await b.evaluate(`window.__battle.start(1); return 1;`);
  const st = await b.evaluate(`window.__step(${dt}); return document.querySelector('.result-wrap:not([hidden])') ? 'result' : 'run';`);
  const jpg = await b.shot(null, { format: 'jpeg', quality: 90 });
  if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
  // 결과 카드가 뜨면 1.2초 더 찍고 끝
  if (st === 'result' && ended < 0) ended = f;
  if (ended >= 0 && f - ended > 1.2 * FPS) break;
  if (f % 60 === 0) console.log('frame', f, st);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
b.close();
console.log('video done');

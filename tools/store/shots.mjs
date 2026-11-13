// 스토어 스크린샷 (1280×720 PNG, 장면마다 기능 하나 + 위쪽 자막). node tools/store/shots.mjs <출력 폴더>
// 서버(verse8)는 막아서 오프라인으로 찍음 → 실제 계정·서버 저장과 무관. 진행 상태는 보여 주기용으로 페이지 안에서만 바꿈.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './cdp.mjs';

const OUT = process.argv[2] ?? 'store-assets';
fs.mkdirSync(OUT, { recursive: true });
const W = 1280;
const H = 720;
const b = await launch({ width: W, height: H });
await b.send('Network.enable');
await b.send('Network.setBlockedURLs', { urls: ['*verse8.io*', '*verse8.games*'] });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('pop-shooter.guide','off');localStorage.setItem('pop-shooter.lang','ko')}catch(e){}" });
await b.send('Page.navigate', { url: 'http://localhost:5220/?offline=1&guns=lod0&allchars=1' });
await new Promise((r) => setTimeout(r, 12000));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 공통 준비: 창 닫기, 안내 끄기, 자막 틀, 보여 주기용 진행 상태 (월드 4까지 연 중반 플레이)
await b.evaluate(`
  const g = window.__game;
  const st = await import('/src/sim/state.ts');
  window.__clean = () => {
    for (const s of ['.nick-wrap', '.daily-wrap', '.boost-ask']) document.querySelectorAll(s).forEach((e) => e.remove());
    document.querySelectorAll('.result-wrap:not([hidden])').forEach((e) => { if (!e.closest('.bhud')) e.remove(); });
    document.querySelectorAll('.tut-bar').forEach((e) => { e.hidden = true; e.style.display = 'none'; });
    document.querySelectorAll('.zone-top, .zone-center, .zone-flash').forEach((e) => { e.style.display = 'none'; });
    for (const el of document.querySelectorAll('#ui *')) if (el.childElementCount === 0 && /마우스 고정/.test(el.textContent || '')) el.style.display = 'none';
  };
  const cap = document.createElement('div');
  cap.id = 'store-cap';
  cap.style.cssText = 'position:fixed;left:50%;top:78px;transform:translateX(-50%);z-index:99999;pointer-events:none;font-family:"Do Hyeon",sans-serif;text-align:center;';
  document.body.append(cap);
  window.__cap = (title, sub, pos) => {
    cap.style.top = pos === 'bottom' ? 'auto' : '78px';
    cap.style.bottom = pos === 'bottom' ? '40px' : 'auto';
    cap.innerHTML = '<div style="display:inline-block;padding:10px 30px 12px;border-radius:999px;background:linear-gradient(#fff,#fff3c4);border:4px solid #2b3a67;box-shadow:0 6px 0 #2b3a67;font-size:44px;color:#2b3a67;white-space:nowrap">' + title + '</div>' +
      (sub ? '<div style="margin-top:12px;font-size:24px;color:#fff;-webkit-text-stroke:5px #2b3a67;paint-order:stroke fill;white-space:nowrap">' + sub + '</div>' : '');
  };
  const s = { ...g.state, coins: 4.2e9, gems: 0, gun: 9, bestStage: 34, runBest: 34, rebirths: 3, tokens: 3, chars: ['blue', 'yellow', 'red', 'pink'], char: 'blue', tutorial: 99,
    trAtk: 3.1e7, trSpd: 520, trCoin: 900, mAtk: 38, mSpd: 30, mCoin: 26, gear: 0b111111 };
  g.setState(s, false);
  window.__clean();
  return 'ok';
`);

const scenes = [
  {
    file: '1', pos: 'bottom', title: '포털에 들어가면 자동 전투!', sub: '가만히 있어도 보스를 쓰러뜨려요',
    run: `const g = window.__game; g.setWorld(4); await new Promise(r=>setTimeout(r,800)); window.__battle.start(4); await new Promise(r=>setTimeout(r,2350));
      const run = window.__battle.run; if (run) { run.battle.hp = run.battle.maxHp * 0.42; } g.placeAt(0.4, 1.2, Math.PI); g.cam.yaw = 0.3; g.cam.focus = 1; g.cam.pitch = -0.25; g.cam.lookUp = 0.6; await new Promise(r=>setTimeout(r,900));`,
    after: `const b = window.__battle; b.run = null; b.exit(); window.__game.cam.pitch = 0; document.querySelector('.bhud') && (document.querySelector('.bhud').hidden = true);`,
  },
  {
    file: '2', pos: 'bottom', title: '훈련장에서 쏘면 공격력 UP', sub: '훈련할수록 강해지는 방치형 슈팅',
    run: `const g = window.__game; g.setWorld(1); await new Promise(r=>setTimeout(r,600)); g.facilityActions.range({ id: 'range' }); await new Promise(r=>setTimeout(r,3800));`,
    after: `window.__game.facilityLeave.range?.();`,
  },
  {
    file: '3', title: '골드로 훈련 기구·장비 업그레이드', sub: '',
    run: `const g = window.__game; g.facilityActions.upgrade({ id: 'upgrade' }); await new Promise(r=>setTimeout(r,2200));`,
    after: `window.__game.facilityLeave.upgrade?.();`,
  },
  {
    file: '4', title: '더 강한 장난감 총을 모아요', sub: '',
    run: `const g = window.__game; g.facilityActions.guns({ id: 'guns' }); await new Promise(r=>setTimeout(r,2200));`,
    after: `window.__game.facilityLeave.guns?.();`,
  },
  {
    file: '5', title: '귀여운 캐릭터 6종', sub: '모을수록 모두 함께 강해져요',
    run: `const g = window.__game; g.facilityActions.chars({ id: 'chars' }); await new Promise(r=>setTimeout(r,2400));`,
    after: `window.__game.facilityLeave.chars?.();`,
  },
  {
    file: '6', pos: 'bottom', title: '8개의 장난감 월드', sub: '보스를 깨면 새 월드가 열려요',
    run: `const g = window.__game; g.setWorld(3); await new Promise(r=>setTimeout(r,1200)); g.placeAt(2, 10, Math.PI); g.cam.yaw = 0.5; g.cam.pitch = -0.12; await new Promise(r=>setTimeout(r,1500));`,
    after: `const g = window.__game; g.cam.pitch = 0;`,
  },
  {
    file: '7', pos: 'bottom', title: '함께 노는 광장', sub: '최대 16명이 같은 광장에서 만나요',
    run: `const g = window.__game; g.setWorld(1); await new Promise(r=>setTimeout(r,800));
      const { LobbyPeers } = await import('/src/net/LobbyPeers.ts'); const { CHAR_IDS } = await import('/src/sim/state.ts');
      const p = new LobbyPeers({ assets: g.assets, parent: g.hub.root, targets: g.hub.targets, me: g.pos, camera: g.stage.camera });
      window.__fp = p; g.onTick((dt) => window.__fp?.update(dt));
      const spots = [[-3,4,1],[3,5,1],[-6,1,0],[5,0,0],[-1,-2,1],[2,-4,0],[-8,6,0],[7,6,1],[0,2,4],[-4,-5,0],[6,-3,1]];
      spots.forEach(([x,z,f],i) => { const buf = { sample(t,o){ const a=t/1000*0.5+i; const mv = f===1; o.x = x + (mv?Math.cos(a)*1.6:0); o.z = z + (mv?Math.sin(a)*1.6:0); o.vx = mv?-Math.sin(a)*0.8:0; o.vz = mv?Math.cos(a)*0.8:0; o.yaw = mv?Math.atan2(o.vx,o.vz):Math.PI*0.9+i; o.f = f; return true; } };
        p.add({ account:'s'+i, nick:['뽀짝','토끼총','POPPY','말랑','Jelly','쿠키','별사탕','Toyo','몽글','Bubble','하루'][i], char: CHAR_IDS[i % CHAR_IDS.length], gun: i % 10, rebirths: i, power: 10 ** (3 + i % 9), status: 'hub', buffer: buf }); });
      g.placeAt(0, 9, Math.PI); g.cam.yaw = 0; g.cam.pitch = 0.08; await new Promise(r=>setTimeout(r,2500));`,
    after: `window.__fp?.dispose(); window.__fp = null; window.__game.cam.pitch = 0;`,
  },
  {
    file: '8', title: '환생하면 훈련이 더 빨라져요', sub: '',
    run: `document.querySelector('.ev-reb').dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); await new Promise(r=>setTimeout(r,1200));`,
    after: `document.querySelector('.sheet:not([hidden]) .sheet-x')?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));`,
  },
];

for (const sc of scenes) {
  if (process.env.ONLY && sc.file !== process.env.ONLY) continue;
  await b.evaluate(`${sc.run} window.__clean(); window.__cap(${JSON.stringify(sc.title)}, ${JSON.stringify(sc.sub)}, ${JSON.stringify(sc.pos ?? 'top')}); await new Promise(r=>setTimeout(r,250)); return 'ok';`);
  await b.shot(path.join(OUT, `${sc.file}.png`));
  await b.evaluate(`${sc.after} window.__cap('', ''); await new Promise(r=>setTimeout(r,600)); return 'ok';`);
  console.log('shot', sc.file);
}
b.close();

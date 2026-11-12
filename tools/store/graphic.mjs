// 스토어 그래픽 이미지 1024×578 (광장 + 여러 캐릭터 + 제목). node tools/store/graphic.mjs <출력 폴더>
import path from 'node:path';
import { launch } from './cdp.mjs';

const OUT = process.argv[2] ?? 'store-assets';
const b = await launch({ width: 1024, height: 578, port: 9334 });
await b.send('Network.enable');
await b.send('Network.setBlockedURLs', { urls: ['*verse8.io*', '*verse8.games*'] });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('pop-shooter.guide','off');localStorage.setItem('pop-shooter.lang','ko')}catch(e){}" });
await b.send('Page.navigate', { url: 'http://localhost:5220/?guns=lod0' });
await new Promise((r) => setTimeout(r, 12000));
await b.evaluate(`
  const g = window.__game;
  g.setState({ ...g.state, gun: 9, bestStage: 34, rebirths: 3, tokens: 3, chars: ['blue', 'yellow', 'red', 'pink'], tutorial: 99, trAtk: 3.1e7, gear: 0b111111 }, false);
  const { LobbyPeers } = await import('/src/net/LobbyPeers.ts');
  const p = new LobbyPeers({ assets: g.assets, parent: g.hub.root, targets: g.hub.targets, me: g.pos, camera: g.stage.camera });
  g.onTick((dt) => p.update(dt));
  // 주인공 양옆에 캐릭터 5명 (모두 카메라 쪽을 봄, 만세 둘)
  const crew = [['pink', -4.25, 7.0, 4], ['yellow', -2.55, 7.5, 0], ['red', 0.85, 7.7, 4], ['white', 2.55, 7.5, 0], ['black', 4.25, 7.0, 0]];
  crew.forEach(([c, x, z, f], i) => p.add({ account: 'g' + i, nick: '', char: c, gun: 3 + i, rebirths: 0, power: 10 ** (4 + i * 2), status: 'hub',
    buffer: { sample(t, o) { o.x = x; o.z = z; o.vx = 0; o.vz = 0; o.yaw = 0; o.f = f; return true; } } }));
  // 이름표 숨김
  p.items.forEach((it) => { if (it.label) it.label.material.opacity = 0; });
  g.placeAt(-0.85, 7.9, 0);
  g.pose.cheer = 0;
  g.cam.yaw = -0.3; g.cam.pitch = -0.3; g.cam.focus = 1.5; g.cam.lookUp = 1.1;
  document.getElementById('ui').style.visibility = 'hidden';
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;left:0;right:0;top:26px;text-align:center;z-index:99999;font-family:"Do Hyeon",sans-serif;pointer-events:none';
  t.innerHTML = '<div style="font-size:92px;line-height:1;color:#ffd34d;-webkit-text-stroke:12px #2b3a67;paint-order:stroke fill;letter-spacing:2px;text-shadow:0 8px 0 #2b3a67">POP SHOOTER</div>' +
    '<div style="display:inline-block;margin-top:14px;padding:6px 22px 8px;border-radius:999px;background:#fff;border:4px solid #2b3a67;box-shadow:0 5px 0 #2b3a67;font-size:30px;color:#2b3a67">훈련하고, 쏘고, 장난감 월드를 정복하자!</div>';
  document.body.append(t);
  await new Promise((r) => setTimeout(r, 2500));
  p.items.forEach((it) => { if (it.label) it.label.visible = false; });
  return 'ok';
`);
await b.shot(path.join(OUT, 'graphic_1024x578.png'));
b.close();
console.log('graphic done');

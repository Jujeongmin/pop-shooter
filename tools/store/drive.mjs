// 실제 키·마우스로 게임을 조작해 보는 점검 도구 (Chrome DevTools 입력 이벤트: 키를 누르고 있기·클릭·글자 입력·화면 캡처).
// 내장 브라우저 도구는 키를 눌렀다 바로 떼서 캐릭터가 걷지 않음 → 헤드리스 Chrome을 띄워 두고 단계마다 붙어서 조작.
//   1) 띄우기 (한 번, 백그라운드): node tools/store/drive.mjs launch <프로필 폴더> [폭] [높이]
//   2) 조작:                        node tools/store/drive.mjs do '<동작 JSON 배열>'
//      동작: ["nav",url] ["wait",ms] ["click",x,y] ["hold","KeyW",ms] ["holds",["KeyW","KeyA"],ms] ["key","Tab"] ["type","글자"]
//            ["drag",x1,y1,x2,y2,ms] ["shot","파일.jpg"] ["text"] (바깥 페이지 글자)
//   3) 끝: node tools/store/drive.mjs quit
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 9351;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'launch') {
  const [profile, w = '1280', h = '720'] = rest;
  fs.mkdirSync(profile, { recursive: true });
  const proc = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--lang=ko-KR',
    '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--mute-audio', `--window-size=${w},${h}`, '--force-device-scale-factor=1',
    '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--headless=new', 'about:blank',
  ], { stdio: 'ignore', detached: true });
  proc.unref();
  console.log('launched', proc.pid);
  process.exit(0);
}

const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.rej(new Error(JSON.stringify(m.error))); else p.res(m.result); }
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

if (cmd === 'quit') { await send('Browser.close').catch(() => undefined); process.exit(0); }

const VK = { Tab: 9, Enter: 13, Escape: 27, Space: 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
const keyOf = (code) => {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return { code, key: letter[1].toLowerCase(), windowsVirtualKeyCode: letter[1].charCodeAt(0) };
  return { code, key: code === 'Space' ? ' ' : code, windowsVirtualKeyCode: VK[code] ?? 0 };
};
const down = (code) => send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...keyOf(code) });
const up = (code) => send('Input.dispatchKeyEvent', { type: 'keyUp', ...keyOf(code) });
const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });

const actions = JSON.parse(rest[0]);
for (const a of actions) {
  const [op, ...p] = a;
  if (op === 'nav') { await send('Page.enable'); await send('Page.navigate', { url: p[0] }); }
  else if (op === 'wait') await wait(p[0]);
  else if (op === 'click') { await mouse('mouseMoved', p[0], p[1], { buttons: 0 }); await mouse('mousePressed', p[0], p[1]); await wait(60); await mouse('mouseReleased', p[0], p[1]); }
  else if (op === 'hold') { await down(p[0]); await wait(p[1]); await up(p[0]); }
  else if (op === 'holds') { for (const k of p[0]) await down(k); await wait(p[1]); for (const k of p[0]) await up(k); }
  else if (op === 'key') { await down(p[0]); await wait(50); await up(p[0]); }
  else if (op === 'type') await send('Input.insertText', { text: p[0] });
  else if (op === 'drag') {
    const [x1, y1, x2, y2, ms] = p;
    await mouse('mouseMoved', x1, y1, { buttons: 0 }); await mouse('mousePressed', x1, y1);
    const n = 12;
    for (let i = 1; i <= n; i++) { await mouse('mouseMoved', x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n); await wait(ms / n); }
    await mouse('mouseReleased', x2, y2);
  } else if (op === 'shot') {
    const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: p[1] ?? 70 });
    fs.writeFileSync(p[0], Buffer.from(r.data, 'base64'));
  } else if (op === 'text') {
    const r = await send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0, 400)', returnByValue: true });
    console.log(JSON.stringify(r.result.value));
  } else throw new Error(`모르는 동작 ${op}`);
}
ws.close();
console.log('ok');

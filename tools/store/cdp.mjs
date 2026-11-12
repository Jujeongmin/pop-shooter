// 스토어 이미지·영상 캡처용 아주 작은 Chrome DevTools 클라이언트 (패키지 설치 없음, Node 내장 WebSocket).
// 크롬을 따로 띄운 프로필(임시 폴더)로 열어 개발 서버(localhost:5220)를 찍는다. 서버 저장·계정과 무관 (verse 연결 없음).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export async function launch({ width, height, port = 9333, headless = true }) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'popshooter-store-'));
  const args = [
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--lang=ko-KR', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--mute-audio',
    `--window-size=${width},${height}`, '--force-device-scale-factor=1', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
  ];
  if (headless) args.push('--headless=new');
  args.push('about:blank');
  const proc = spawn(CHROME, args, { stdio: 'ignore' });
  let list = null;
  for (let i = 0; i < 50 && !list; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try { list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { /* 아직 */ }
  }
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result);
    } else for (const l of listeners) l(m);
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const shot = async (file, { format = 'png', quality = 92 } = {}) => {
    const r = await send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? quality : undefined, captureBeyondViewport: false });
    if (file) fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return Buffer.from(r.data, 'base64');
  };
  const close = () => { try { ws.close(); } catch { /* */ } proc.kill(); };
  return { send, evaluate, shot, close, onEvent: (f) => listeners.add(f) };
}

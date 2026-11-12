/**
 * UI 아이콘 세트 (인라인 SVG, 번들에 포함 → 요청·로딩 없음). 장난감 톤: 굵은 남색 외곽선 + 위쪽 하이라이트.
 * 이모지 대신 쓴다 (기기마다 모양이 달라지고 싸 보임).
 */
const INK = '#2b3a67';
const S = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

const SVG: Record<string, string> = {
  coin: `
    <defs><radialGradient id="ic-coin" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#fff3a6"/><stop offset=".55" stop-color="#ffc928"/><stop offset="1" stop-color="#e89a10"/></radialGradient></defs>
    <circle cx="32" cy="32" r="27" fill="url(#ic-coin)" ${S}/>
    <circle cx="32" cy="32" r="19" fill="none" stroke="#d98a0c" stroke-width="3"/>
    <path d="M32 19l3.9 8 8.8 1.2-6.4 6.1 1.6 8.7L32 38.8 24.1 43l1.6-8.7-6.4-6.1 8.8-1.2z" fill="#ffe27a" stroke="#d98a0c" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="23" cy="17" rx="7" ry="3.5" fill="#fff" opacity=".7" transform="rotate(-30 23 17)"/>`,
  gem: `
    <defs><linearGradient id="ic-gem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd3ec"/><stop offset="1" stop-color="#ff4f9e"/></linearGradient></defs>
    <path d="M12 24L21 11h22l9 13-20 30z" fill="url(#ic-gem)" ${S}/>
    <path d="M12 24h40M21 11l6 13 5 30M43 11l-6 13-5 30" fill="none" stroke="#d93a85" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M23 15l3 6" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".85"/>`,
  reb: `
    <defs><radialGradient id="ic-reb" cx="38%" cy="32%" r="72%"><stop offset="0" stop-color="#f4eeff"/><stop offset=".6" stop-color="#b9a6ff"/><stop offset="1" stop-color="#7c63e6"/></radialGradient></defs>
    <circle cx="32" cy="32" r="27" fill="url(#ic-reb)" ${S}/>
    <path d="M20 26a13 13 0 0 1 23-4M44 38a13 13 0 0 1-23 4" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M44 15v8h-8M20 49v-8h8" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M32 26l1.8 4.2 4.2 1.8-4.2 1.8L32 38l-1.8-4.2L26 32l4.2-1.8z" fill="#fff"/>`,
  hand: `
    <path d="M25 33V12a6 6 0 0 1 12 0v17a5.5 5.5 0 0 1 10.5 2 5.5 5.5 0 0 1 9.5 3.6V45c0 9.4-7.6 15-16.5 15h-5c-7 0-11.4-3.4-15-9.4L13.4 42a5.2 5.2 0 0 1 8.4-6.2z" fill="#fff" ${S}/>
    <path d="M37 29v7M47.5 31v6" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <path d="M29 9.5a3.5 3.5 0 0 1 4 0" fill="none" stroke="#c9d2ea" stroke-width="3" stroke-linecap="round"/>`,
  timer: `
    <rect x="27" y="4" width="10" height="7" rx="2.5" fill="#ff8a5b" ${S}/>
    <path d="M47 15l4-4" ${S}/>
    <circle cx="32" cy="36" r="23" fill="#fff" ${S}/>
    <circle cx="32" cy="36" r="17" fill="#eaf4ff"/>
    <path d="M32 24v12l8 6" fill="none" stroke="#ff4f5e" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="32" cy="36" r="3" fill="${INK}"/>`,
  bolt: `
    <path d="M37 5L13 37h15l-4 22 26-34H34z" fill="#ffd34d" ${S}/>
    <path d="M34 12l-6 11" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>`,
  bullet: `
    <path d="M20 40V26c0-10 6-19 12-22 6 3 12 12 12 22v14z" fill="#ffc94d" ${S}/>
    <rect x="17" y="40" width="30" height="18" rx="4" fill="#ff8a5b" ${S}/>
    <path d="M27 14c-1.5 3-2.5 7-2.5 11" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>`,
  lock: `
    <path d="M20 30v-8a12 12 0 0 1 24 0v8" fill="none" ${S} stroke-width="5"/>
    <rect x="13" y="28" width="38" height="30" rx="7" fill="#c9d2ea" ${S}/>
    <circle cx="32" cy="41" r="4" fill="${INK}"/><path d="M32 43v7" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  target: `
    <circle cx="32" cy="32" r="27" fill="#fff" ${S}/>
    <circle cx="32" cy="32" r="18" fill="#ff5e6a"/>
    <circle cx="32" cy="32" r="11" fill="#fff"/>
    <circle cx="32" cy="32" r="5" fill="#ff5e6a"/>`,
  rapid: `
    <circle cx="32" cy="32" r="27" fill="#7cc4ff" ${S}/>
    <path d="M14 26h14M10 34h18M14 42h14" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M34 22l14 10-14 10z" fill="#fff" ${S}/>`,
  cointarget: `
    <circle cx="32" cy="32" r="27" fill="#fff" ${S}/>
    <circle cx="32" cy="32" r="18" fill="#ffc928"/>
    <circle cx="32" cy="32" r="11" fill="#fff3a6"/>
    <path d="M32 25v14M27.5 28.5h7a2.5 2.5 0 0 1 0 5h-5a2.5 2.5 0 0 0 0 5h7" fill="none" stroke="#d98a0c" stroke-width="3" stroke-linecap="round"/>`,
  gloves: `
    <path d="M18 56V30c0-3 2-5 4.5-5S27 27 27 30V16c0-3 2-5 4.5-5S36 13 36 16v-2c0-3 2-5 4.5-5S45 11 45 14v14l4-4c2.5-2.5 6.5-1 6.5 2.5 0 1.2-.4 2.3-1.2 3.2L45 44v12z" fill="#ff8a5b" ${S}/>
    <rect x="16" y="50" width="31" height="9" rx="3" fill="#2b3a67"/>
    <path d="M30 18v10M39 16v12" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
  goggles: `
    <path d="M6 30c8-4 44-4 52 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <rect x="9" y="22" width="21" height="20" rx="8" fill="#9be7ff" ${S}/>
    <rect x="34" y="22" width="21" height="20" rx="8" fill="#9be7ff" ${S}/>
    <path d="M30 32h4" stroke="${INK}" stroke-width="4"/>
    <path d="M14 27l5-1M39 27l5-1" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`,
  piggy: `
    <ellipse cx="32" cy="36" rx="23" ry="17" fill="#ffaecb" ${S}/>
    <path d="M18 25l-3-9 9 5" fill="#ffaecb" ${S}/>
    <rect x="26" y="17" width="12" height="4" rx="2" fill="${INK}"/>
    <ellipse cx="53" cy="36" rx="5" ry="6" fill="#ff8fb5" ${S}/>
    <circle cx="40" cy="31" r="2.5" fill="${INK}"/>
    <path d="M20 51v6M42 51v6" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
  medal: `
    <path d="M20 4h10l4 18H24zM34 4h10l-4 18H30z" fill="#7cc4ff" ${S}/>
    <circle cx="32" cy="40" r="19" fill="#ffd34d" ${S}/>
    <path d="M32 29l3.4 7 7.6 1-5.5 5.3 1.3 7.6L32 46.3l-6.8 3.6 1.3-7.6L21 37l7.6-1z" fill="#fff6c2" stroke="#d98a0c" stroke-width="2" stroke-linejoin="round"/>`,
  close: `
    <circle cx="32" cy="32" r="27" fill="#fff" ${S}/>
    <path d="M23 23l18 18M41 23L23 41" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`,
  heart: `
    <path d="M32 55C14 43 6 33 6 22a13 13 0 0 1 26-5 13 13 0 0 1 26 5c0 11-8 21-26 33z" fill="#ff5e6a" ${S}/>
    <path d="M17 18a7 7 0 0 1 8-3" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`,
  check: `
    <circle cx="32" cy="32" r="27" fill="#5ccf6b" ${S}/>
    <path d="M20 33l8 8 16-17" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  globe: `
    <circle cx="32" cy="32" r="26" fill="#6fc3ff" ${S}/>
    <path d="M18 20c6 2 8 8 4 12s2 10 8 10M40 12c-3 5 2 9 7 9s6 6 3 10M36 50c0-6 6-8 10-6" fill="#7fd78a" stroke="#3f9e5a" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="24" cy="18" rx="7" ry="3.5" fill="#fff" opacity=".7" transform="rotate(-30 24 18)"/>`,
  cross: `
    <circle cx="32" cy="32" r="27" fill="#ff5e6a" ${S}/>
    <path d="M22 22l20 20M42 22L22 42" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`,
};

export type IconName = 'coin' | 'gem' | 'reb' | 'hand' | 'timer' | 'bolt' | 'bullet' | 'check' | 'cross' | 'heart' | 'lock' | 'close' | 'target' | 'rapid' | 'cointarget' | 'gloves' | 'goggles' | 'piggy' | 'medal' | 'globe';

/** 그림 파일 없이 SVG로만 그리는 아이콘 (없는 파일 요청 안 함) */
const SVG_ONLY: ReadonlySet<string> = new Set(['globe']);

const BASE = `${import.meta.env.BASE_URL}ui/icons/`;

/**
 * 아이콘 span (크기는 CSS .ico / 추가 클래스). 그림 = Codex로 만든 장난감풍 아이콘 (원본 art-src/ui-icons, 변환 tools/ui/icons_to_webp.py → public/ui/icons/<이름>.webp, 128px).
 * 그림을 못 받으면 예전 SVG로 대신 그림.
 */
export function icon(name: IconName, cls = ''): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = `ico ico-${name}${cls ? ` ${cls}` : ''}`;
  if (SVG_ONLY.has(name)) {
    s.innerHTML = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${SVG[name]}</svg>`;
    return s;
  }
  const img = document.createElement('img');
  img.src = `${BASE}${name}.webp`;
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  img.onerror = () => { s.innerHTML = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${SVG[name]}</svg>`; };
  s.append(img);
  return s;
}

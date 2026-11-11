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
  close: `
    <circle cx="32" cy="32" r="27" fill="#fff" ${S}/>
    <path d="M23 23l18 18M41 23L23 41" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`,
  check: `
    <circle cx="32" cy="32" r="27" fill="#5ccf6b" ${S}/>
    <path d="M20 33l8 8 16-17" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  cross: `
    <circle cx="32" cy="32" r="27" fill="#ff5e6a" ${S}/>
    <path d="M22 22l20 20M42 22L22 42" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`,
};

export type IconName = 'coin' | 'gem' | 'reb' | 'hand' | 'timer' | 'bolt' | 'bullet' | 'check' | 'cross' | 'lock' | 'close';

/** 아이콘 span (크기는 CSS .ico / 추가 클래스) */
export function icon(name: IconName, cls = ''): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = `ico ico-${name}${cls ? ` ${cls}` : ''}`;
  s.innerHTML = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${SVG[name]}</svg>`;
  return s;
}

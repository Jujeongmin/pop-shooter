/**
 * 화면 문구 5개 언어: 영어·한국어·일본어·번체·간체.
 * 처음엔 브라우저 언어로 고르고, 설정에서 바꾸면 기기에 저장(localStorage) 후 새로고침 (3D 글자 라벨까지 다시 그리기 위해).
 * 규칙·저장 데이터(sim/)는 언어와 무관. 새 문구는 STRINGS에 5개 언어를 모두 넣을 것 (빠지면 영어로 나옴).
 */
export type Lang = 'en' | 'ko' | 'ja' | 'zh-TW' | 'zh-CN';
export const LANGS: readonly Lang[] = ['en', 'ko', 'ja', 'zh-TW', 'zh-CN'];
/** 언어 고르기 버튼에 그 언어로 쓴 이름 */
export const LANG_NAME: Record<Lang, string> = { en: 'English', ko: '한국어', ja: '日本語', 'zh-TW': '繁體中文', 'zh-CN': '简体中文' };

const KEY = 'pop-shooter.lang';

type Entry = Record<Lang, string>;

const STRINGS = {
  'hud.character': { en: 'Hero', ko: '캐릭터', ja: 'キャラ', 'zh-TW': '角色', 'zh-CN': '角色' },
  'hud.settings': { en: 'Settings', ko: '설정', ja: '設定', 'zh-TW': '設定', 'zh-CN': '设置' },
  'stat.atk': { en: 'Attack', ko: '공격력', ja: '攻撃力', 'zh-TW': '攻擊力', 'zh-CN': '攻击力' },
  'stat.sps': { en: 'Shots/sec', ko: '초당 발사', ja: '秒間発射', 'zh-TW': '每秒射擊', 'zh-CN': '每秒射击' },
  'stat.dps': { en: 'DPS', ko: 'DPS', ja: 'DPS', 'zh-TW': 'DPS', 'zh-CN': 'DPS' },

  'fac.range': { en: 'Shooting Range', ko: '사격장', ja: '射撃場', 'zh-TW': '射擊場', 'zh-CN': '射击场' },
  'fac.upgrade': { en: 'Upgrades', ko: '업그레이드', ja: 'アップグレード', 'zh-TW': '升級', 'zh-CN': '升级' },
  'fac.guns': { en: 'Gun Shop', ko: '총 상점', ja: '銃ショップ', 'zh-TW': '槍械商店', 'zh-CN': '枪械商店' },
  'fac.altar': { en: 'Rebirth Altar', ko: '환생 제단', ja: '転生の祭壇', 'zh-TW': '轉生祭壇', 'zh-CN': '转生祭坛' },
  'fac.portal': { en: 'World {w} Portal', ko: '월드 {w} 포털', ja: 'ワールド{w}ポータル', 'zh-TW': '世界{w}傳送門', 'zh-CN': '世界{w}传送门' },
  'portal.first': { en: 'First run', ko: '첫 도전', ja: '初挑戦', 'zh-TW': '首次挑戰', 'zh-CN': '首次挑战' },
  'portal.best': { en: 'Best {s}', ko: '최고 {s}', ja: '最高 {s}', 'zh-TW': '最佳 {s}', 'zh-CN': '最佳 {s}' },
  'portal.big': { en: 'Run from {s}!', ko: '{s}부터 연속 도전!', ja: '{s}から連続チャレンジ!', 'zh-TW': '從{s}連續挑戰!', 'zh-CN': '从{s}连续挑战!' },

  'range.title': { en: 'Training!', ko: '사격장 훈련 중!', ja: '訓練中!', 'zh-TW': '訓練中!', 'zh-CN': '训练中!' },
  'range.big': { en: 'Tap to shoot faster!', ko: '화면을 탭하면 더 빨리 쏴요!', ja: 'タップでもっと速く撃てる!', 'zh-TW': '點擊畫面射得更快!', 'zh-CN': '点击屏幕射得更快!' },
  'float.pop': { en: 'Pop!', ko: '팡!', ja: 'パン!', 'zh-TW': '砰!', 'zh-CN': '砰!' },
  'float.away': { en: 'While away +{n}', ko: '자리 비운 동안 +{n}', ja: '留守中 +{n}', 'zh-TW': '離開期間 +{n}', 'zh-CN': '离开期间 +{n}' },

  'battle.hint': { en: 'Tap to shoot more!', ko: '화면을 탭하면 더 쏴요!', ja: 'タップでもっと撃てる!', 'zh-TW': '點擊畫面多射幾發!', 'zh-CN': '点击屏幕多射几发!' },
  'battle.boss': { en: '{s} BOSS', ko: '{s} 대장', ja: '{s} ボス', 'zh-TW': '{s} 首領', 'zh-CN': '{s} 首领' },
  'battle.sec': { en: '{n}s', ko: '{n}초', ja: '{n}秒', 'zh-TW': '{n}秒', 'zh-CN': '{n}秒' },
  'battle.bossIn': { en: 'Boss incoming!', ko: '대장 등장!', ja: 'ボス登場!', 'zh-TW': '首領登場!', 'zh-CN': '首领登场!' },
  'battle.run': { en: 'Stage run', ko: '연속 도전', ja: '連続チャレンジ', 'zh-TW': '連續挑戰', 'zh-CN': '连续挑战' },
  'battle.timeUp': { en: "Time's up!", ko: '시간 초과!', ja: '時間切れ!', 'zh-TW': '時間到!', 'zh-CN': '时间到!' },
  'battle.failed': { en: '{s} failed', ko: '{s} 실패', ja: '{s} 失敗', 'zh-TW': '{s} 失敗', 'zh-CN': '{s} 失败' },
  'battle.cleared': { en: '{s} clear!', ko: '{s} 클리어!', ja: '{s} クリア!', 'zh-TW': '{s} 通關!', 'zh-CN': '{s} 通关!' },

  'result.world': { en: 'World {w} clear!', ko: '월드 {w} 클리어!', ja: 'ワールド{w}クリア!', 'zh-TW': '世界{w}通關!', 'zh-CN': '世界{w}通关!' },
  'result.stages': { en: '{n} stages cleared!', ko: '{n}스테이지 돌파!', ja: '{n}ステージ突破!', 'zh-TW': '突破{n}關!', 'zh-CN': '突破{n}关!' },
  'result.none': { en: 'So close!', ko: '아쉬워요!', ja: 'おしい!', 'zh-TW': '好可惜!', 'zh-CN': '好可惜!' },
  'result.tip': {
    en: '{s} needs about {need} DPS\nYour DPS is {now}. Train at the range!',
    ko: '{s}에 필요한 DPS ≈ {need}\n지금 DPS {now} — 사격장에서 더 강해져요!',
    ja: '{s}に必要なDPS ≈ {need}\n今のDPS {now} — 射撃場で強くなろう!',
    'zh-TW': '{s}需要 DPS ≈ {need}\n目前 DPS {now} — 去射擊場變強吧!',
    'zh-CN': '{s}需要 DPS ≈ {need}\n当前 DPS {now} — 去射击场变强吧!',
  },
  'result.unlock': { en: 'New hero {c} unlocked!', ko: '새 캐릭터 {c} 열림!', ja: '新キャラ {c} 解放!', 'zh-TW': '新角色 {c} 解鎖!', 'zh-CN': '新角色 {c} 解锁!' },
  'result.toHub': { en: 'Back to town', ko: '광장으로', ja: '広場へ', 'zh-TW': '回到廣場', 'zh-CN': '回到广场' },

  'settings.title': { en: 'Settings', ko: '설정', ja: '設定', 'zh-TW': '設定', 'zh-CN': '设置' },
  'settings.lang': { en: 'Language', ko: '언어', ja: '言語', 'zh-TW': '語言', 'zh-CN': '语言' },
  'settings.close': { en: 'Close', ko: '닫기', ja: '閉じる', 'zh-TW': '關閉', 'zh-CN': '关闭' },

  'up.title': { en: 'Upgrades', ko: '업그레이드', ja: 'アップグレード', 'zh-TW': '升級', 'zh-CN': '升级' },
  'up.atkDesc': { en: 'Damage per shot', ko: '한 발 피해', ja: '1発のダメージ', 'zh-TW': '每發傷害', 'zh-CN': '每发伤害' },
  'up.spsDesc': { en: 'Auto shots per second', ko: '1초에 자동 발사', ja: '1秒の自動発射', 'zh-TW': '每秒自動射擊', 'zh-CN': '每秒自动射击' },
  'up.max': { en: 'MAX', ko: '최대', ja: '最大', 'zh-TW': '最大', 'zh-CN': '最大' },
  'up.lv': { en: 'Lv {n}', ko: 'Lv {n}', ja: 'Lv {n}', 'zh-TW': 'Lv {n}', 'zh-CN': 'Lv {n}' },
  'up.maxed': { en: 'Maxed!', ko: '최대치!', ja: 'MAX!', 'zh-TW': '已滿級!', 'zh-CN': '已满级!' },
  'up.levelUp': { en: 'Level up!', ko: '레벨 업!', ja: 'レベルアップ!', 'zh-TW': '升級了!', 'zh-CN': '升级了!' },
  'shop.title': { en: 'Gun Shop', ko: '총 상점', ja: '銃ショップ', 'zh-TW': '槍械商店', 'zh-CN': '枪械商店' },
  'shop.world': { en: 'World {w}', ko: '월드 {w}', ja: 'ワールド{w}', 'zh-TW': '世界{w}', 'zh-CN': '世界{w}' },
  'shop.dmg': { en: 'Damage ×{m}', ko: '피해 ×{m}', ja: 'ダメージ ×{m}', 'zh-TW': '傷害 ×{m}', 'zh-CN': '伤害 ×{m}' },
  'shop.equipped': { en: 'Equipped', ko: '장착 중', ja: '装備中', 'zh-TW': '裝備中', 'zh-CN': '装备中' },
  'shop.owned': { en: 'Owned', ko: '보유', ja: '所持', 'zh-TW': '已擁有', 'zh-CN': '已拥有' },
  'shop.needPrev': { en: 'Buy the one above first', ko: '위 총부터 사요', ja: '上の銃から買おう', 'zh-TW': '先買上面的槍', 'zh-CN': '先买上面的枪' },
  'shop.locked': { en: 'Clear World {w} to unlock', ko: '월드 {w} 깨면 열려요', ja: 'ワールド{w}クリアで解放', 'zh-TW': '通關世界{w}後解鎖', 'zh-CN': '通关世界{w}后解锁' },
  'shop.newGun': { en: 'New gun!', ko: '새 총!', ja: '新しい銃!', 'zh-TW': '新槍!', 'zh-CN': '新枪!' },
  'gun.pistol': { en: 'Pistol', ko: '권총', ja: 'ピストル', 'zh-TW': '手槍', 'zh-CN': '手枪' },
  'gun.rifle': { en: 'Rifle', ko: '라이플', ja: 'ライフル', 'zh-TW': '步槍', 'zh-CN': '步枪' },
  'gun.shotgun': { en: 'Shotgun', ko: '샷건', ja: 'ショットガン', 'zh-TW': '霰彈槍', 'zh-CN': '霰弹枪' },
  'gun.sniper': { en: 'Sniper', ko: '스나이퍼', ja: 'スナイパー', 'zh-TW': '狙擊槍', 'zh-CN': '狙击枪' },
  'gun.w1': { en: 'Toy {g}', ko: '장난감 {g}', ja: 'おもちゃの{g}', 'zh-TW': '玩具{g}', 'zh-CN': '玩具{g}' },
  'gun.w2': { en: 'Builder {g}', ko: '공사장 {g}', ja: '工事現場の{g}', 'zh-TW': '工地{g}', 'zh-CN': '工地{g}' },
  'gun.w3': { en: 'Candy {g}', ko: '사탕 {g}', ja: 'キャンディ{g}', 'zh-TW': '糖果{g}', 'zh-CN': '糖果{g}' },
  'gun.w4': { en: 'Space {g}', ko: '우주 {g}', ja: '宇宙{g}', 'zh-TW': '太空{g}', 'zh-CN': '太空{g}' },
} satisfies Record<string, Entry>;

export type StrKey = keyof typeof STRINGS;

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang;
  } catch { /* 저장소 막힘: 브라우저 언어로 */ }
  const nav = typeof navigator === 'undefined' ? null : navigator;
  for (const raw of nav ? (nav.languages ?? [nav.language]) : []) {
    const l = raw.toLowerCase();
    if (l.startsWith('ko')) return 'ko';
    if (l.startsWith('ja')) return 'ja';
    if (l.startsWith('zh')) return /tw|hk|mo|hant/.test(l) ? 'zh-TW' : 'zh-CN';
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
}

export const lang: Lang = detect();

/** 문구 (params의 {이름}을 값으로 바꿈) */
export function t(key: StrKey, params?: Record<string, string | number>): string {
  const e: Entry = STRINGS[key];
  let s = e[lang] || e.en;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** 총 이름 (월드 스타일 + 모델) */
export function gunName(world: number, model: 'pistol' | 'rifle' | 'shotgun' | 'sniper'): string {
  return t(`gun.w${Math.min(4, Math.max(1, world))}` as StrKey, { g: t(`gun.${model}` as StrKey) });
}

/** 언어별 글꼴 (Jua는 한글·영문만 있음 → 일본어·중국어는 둥근 글꼴 따로) */
const FONTS: Record<Lang, { family: string; css: string | null }> = {
  en: { family: "'Jua'", css: null },
  ko: { family: "'Jua'", css: null },
  ja: { family: "'M PLUS Rounded 1c'", css: 'M+PLUS+Rounded+1c:wght@800' },
  'zh-TW': { family: "'Noto Sans TC'", css: 'Noto+Sans+TC:wght@800' },
  'zh-CN': { family: "'ZCOOL KuaiLe'", css: 'ZCOOL+KuaiLe' },
};

/** 화면 글꼴 이름 (3D 라벨 캔버스도 같이 씀) */
export const fontFamily = `${FONTS[lang].family}, 'Jua', system-ui, sans-serif`;

/** html lang·글꼴 적용. 일본어·중국어 글꼴을 다 받을 때까지 기다림 (3D 라벨이 기본 글꼴로 구워지지 않게, 최대 2.5초) */
export async function applyLang(): Promise<void> {
  document.documentElement.lang = lang;
  document.documentElement.style.setProperty('--font', fontFamily);
  const f = FONTS[lang];
  if (!f.css) {
    await waitFont("64px 'Jua'");
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${f.css}&display=swap`;
  document.head.appendChild(link);
  await waitFont(`64px ${f.family}`);
}

async function waitFont(spec: string): Promise<void> {
  try {
    await Promise.race([document.fonts.load(spec, '가あ字A'), new Promise((r) => setTimeout(r, 2500))]);
  } catch { /* 글꼴 실패: 기본 글꼴 */ }
}

export function setLang(l: Lang): void {
  try { localStorage.setItem(KEY, l); } catch { /* 저장 못 해도 이번 새로고침은 기본 언어 */ }
  location.reload();
}

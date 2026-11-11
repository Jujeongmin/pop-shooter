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
  'hud.settings': { en: 'Settings', ko: '설정', ja: '設定', 'zh-TW': '設定', 'zh-CN': '设置' },
  'stat.atk': { en: 'Attack', ko: '공격력', ja: '攻撃力', 'zh-TW': '攻擊力', 'zh-CN': '攻击力' },
  'stat.sps': { en: 'Shots/sec', ko: '초당 발사', ja: '秒間発射', 'zh-TW': '每秒射擊', 'zh-CN': '每秒射击' },
  'stat.dps': { en: 'DPS', ko: 'DPS', ja: 'DPS', 'zh-TW': 'DPS', 'zh-CN': 'DPS' },

  'fac.range': { en: 'Shooting Range', ko: '사격장', ja: '射撃場', 'zh-TW': '射擊場', 'zh-CN': '射击场' },
  'fac.upgrade': { en: 'Upgrades', ko: '업그레이드', ja: 'アップグレード', 'zh-TW': '升級', 'zh-CN': '升级' },
  'fac.guns': { en: 'Gun Shop', ko: '총 상점', ja: '銃ショップ', 'zh-TW': '槍械商店', 'zh-CN': '枪械商店' },
  'fac.altar': { en: 'Rebirth Altar', ko: '환생 제단', ja: '転生の祭壇', 'zh-TW': '轉生祭壇', 'zh-CN': '转生祭坛' },
  'fac.chars': { en: 'Heroes', ko: '캐릭터', ja: 'キャラ', 'zh-TW': '角色', 'zh-CN': '角色' },
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
  'battle.timeUp': { en: 'Knocked out!', ko: '쓰러졌어요!', ja: 'やられた!', 'zh-TW': '被擊倒了!', 'zh-CN': '被击倒了!' },
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

  'peer.player': { en: 'Player', ko: '플레이어', ja: 'プレイヤー', 'zh-TW': '玩家', 'zh-CN': '玩家' },
  'peer.atk': { en: 'ATK {n}', ko: '공격력 {n}', ja: '攻撃力 {n}', 'zh-TW': '攻擊力 {n}', 'zh-CN': '攻击力 {n}' },
  'peer.battle': { en: 'In battle', ko: '전투 중', ja: 'バトル中', 'zh-TW': '戰鬥中', 'zh-CN': '战斗中' },

  'settings.title': { en: 'Settings', ko: '설정', ja: '設定', 'zh-TW': '設定', 'zh-CN': '设置' },
  'settings.lang': { en: 'Language', ko: '언어', ja: '言語', 'zh-TW': '語言', 'zh-CN': '语言' },
  'settings.master': { en: 'Master volume', ko: '전체 음량', ja: '全体の音量', 'zh-TW': '總音量', 'zh-CN': '总音量' },
  'settings.sfx': { en: 'Sound effects', ko: '효과음', ja: '効果音', 'zh-TW': '音效', 'zh-CN': '音效' },
  'settings.music': { en: 'Music', ko: '배경음악', ja: 'BGM', 'zh-TW': '背景音樂', 'zh-CN': '背景音乐' },
  'settings.soundOn': { en: 'Sound: ON', ko: '소리: 켜짐', ja: 'サウンド: ON', 'zh-TW': '聲音:開', 'zh-CN': '声音:开' },
  'settings.soundOff': { en: 'Sound: OFF (muted)', ko: '소리: 꺼짐 (음소거)', ja: 'サウンド: OFF(ミュート)', 'zh-TW': '聲音:關(靜音)', 'zh-CN': '声音:关(静音)' },
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
  'reb.title': { en: 'Rebirth Altar', ko: '환생 제단', ja: '転生の祭壇', 'zh-TW': '轉生祭壇', 'zh-CN': '转生祭坛' },
  'reb.need': { en: 'Rebirth #{n} needs Attack', ko: '{n}회 환생 · 필요 공격력', ja: '{n}回転生 · 必要な攻撃力', 'zh-TW': '已轉生{n}次 · 所需攻擊力', 'zh-CN': '已转生{n}次 · 所需攻击力' },
  'reb.short': { en: '{n} more Attack levels to go', ko: '공격력 레벨을 {n} 더 올려요', ja: '攻撃力レベルをあと{n}上げよう', 'zh-TW': '再提升 {n} 級攻擊力', 'zh-CN': '再提升 {n} 级攻击力' },
  'reb.tip': { en: 'Each rebirth needs a higher level', ko: '환생할 때마다 필요한 레벨이 올라가요', ja: '転生するたびに必要なレベルが上がるよ', 'zh-TW': '每次轉生所需等級都會提高', 'zh-CN': '每次转生所需等级都会提高' },
  'char.power': { en: 'Damage ×{m}', ko: '피해 ×{m}', ja: 'ダメージ ×{m}', 'zh-TW': '傷害 ×{m}', 'zh-CN': '伤害 ×{m}' },
  'reb.mult': { en: 'Power multiplier', ko: '환생 배율', ja: '転生倍率', 'zh-TW': '轉生倍率', 'zh-CN': '转生倍率' },
  'reb.gems': { en: 'Pop gems', ko: '팝젬', ja: 'ポップジェム', 'zh-TW': '泡泡寶石', 'zh-CN': '泡泡宝石' },
  'reb.reset': { en: 'Resets', ko: '초기화', ja: 'リセット', 'zh-TW': '重置', 'zh-CN': '重置' },
  'reb.keep': { en: 'Keeps', ko: '유지', ja: 'そのまま', 'zh-TW': '保留', 'zh-CN': '保留' },
  'reb.resetList': { en: 'Coins · Attack · Shots/sec · Guns', ko: '코인 · 공격력 · 초당 발사 · 총', ja: 'コイン・攻撃力・秒間発射・銃', 'zh-TW': '金幣・攻擊力・每秒射擊・槍械', 'zh-CN': '金币・攻击力・每秒射击・枪械' },
  'reb.keepList': { en: 'Best stage · Pop gems · Heroes', ko: '최고 기록 · 팝젬 · 캐릭터', ja: '最高記録・ポップジェム・キャラ', 'zh-TW': '最佳紀錄・泡泡寶石・角色', 'zh-CN': '最佳纪录・泡泡宝石・角色' },
  'reb.go': { en: 'Rebirth', ko: '환생하기', ja: '転生する', 'zh-TW': '轉生', 'zh-CN': '转生' },
  'reb.sure': { en: 'Really rebirth?', ko: '정말 환생할까요?', ja: '本当に転生する?', 'zh-TW': '確定要轉生嗎?', 'zh-CN': '确定要转生吗?' },
  'reb.yes': { en: 'Yes!', ko: '네, 환생!', ja: 'はい!', 'zh-TW': '是的!', 'zh-CN': '是的!' },
  'reb.no': { en: 'Not yet', ko: '아직', ja: 'まだ', 'zh-TW': '還不要', 'zh-CN': '还不要' },
  'reb.done': { en: 'Reborn! ×{m}', ko: '환생! ×{m}', ja: '転生! ×{m}', 'zh-TW': '轉生! ×{m}', 'zh-CN': '转生! ×{m}' },
  'off.title': { en: 'Welcome back!', ko: '어서 와요!', ja: 'おかえり!', 'zh-TW': '歡迎回來!', 'zh-CN': '欢迎回来!' },
  'off.body': { en: 'Training while you were away ({t})', ko: '자리 비운 {t} 동안 훈련했어요', ja: '留守の{t}の間に訓練したよ', 'zh-TW': '離開的{t}期間持續訓練', 'zh-CN': '离开的{t}期间持续训练' },
  'off.claim': { en: 'Collect', ko: '받기', ja: '受け取る', 'zh-TW': '領取', 'zh-CN': '领取' },
  'time.hm': { en: '{h}h {m}m', ko: '{h}시간 {m}분', ja: '{h}時間{m}分', 'zh-TW': '{h}小時{m}分', 'zh-CN': '{h}小时{m}分' },
  'time.m': { en: '{m}m', ko: '{m}분', ja: '{m}分', 'zh-TW': '{m}分鐘', 'zh-CN': '{m}分钟' },
  'char.title': { en: 'Heroes', ko: '캐릭터', ja: 'キャラ', 'zh-TW': '角色', 'zh-CN': '角色' },
  'char.using': { en: 'Playing', ko: '사용 중', ja: '使用中', 'zh-TW': '使用中', 'zh-CN': '使用中' },
  'char.pick': { en: 'Pick', ko: '고르기', ja: '選ぶ', 'zh-TW': '選擇', 'zh-CN': '选择' },
  'char.unlockWorld': { en: 'Clear {s}', ko: '{s} 클리어', ja: '{s}クリア', 'zh-TW': '通關{s}', 'zh-CN': '通关{s}' },
  'char.shop': { en: 'Shop (soon)', ko: '상점 (준비 중)', ja: 'ショップ(準備中)', 'zh-TW': '商店(準備中)', 'zh-CN': '商店(准备中)' },
  'g.range': { en: 'Train at the Shooting Range to earn coins', ko: '사격장에서 훈련해 코인을 모아요', ja: '射撃場で訓練してコインを集めよう', 'zh-TW': '在射擊場訓練收集金幣', 'zh-CN': '在射击场训练收集金币' },
  'g.upgrade': { en: 'Coins piled up! Raise Attack at Upgrades', ko: '코인이 모였어요! 업그레이드에서 공격력을 올려요', ja: 'コインが貯まった! アップグレードで攻撃力を上げよう', 'zh-TW': '金幣夠了! 到升級提升攻擊力', 'zh-CN': '金币够了! 到升级提升攻击力' },
  'g.guns': { en: 'You can buy a new gun! Go to the Gun Shop', ko: '새 총을 살 수 있어요! 총 상점으로 가요', ja: '新しい銃が買える! 銃ショップへ', 'zh-TW': '可以買新槍了! 去槍械商店', 'zh-CN': '可以买新枪了! 去枪械商店' },
  'g.portal': { en: 'Strong enough for {s}! Enter the portal', ko: '지금 공격력이면 {s} 클리어 가능! 포털로 가요', ja: '今なら{s}をクリアできる! ポータルへ', 'zh-TW': '現在可以通關{s}! 進入傳送門', 'zh-CN': '现在可以通关{s}! 进入传送门' },
  'g.altar': { en: 'Rebirth is ready! Go to the Rebirth Altar', ko: '환생할 수 있어요! 환생 제단으로 가요', ja: '転生できる! 転生の祭壇へ', 'zh-TW': '可以轉生了! 去轉生祭壇', 'zh-CN': '可以转生了! 去转生祭坛' },
  'g.close': { en: 'Close', ko: '닫기', ja: '閉じる', 'zh-TW': '關閉', 'zh-CN': '关闭' },
  'settings.guideOn': { en: 'Hints: ON', ko: '안내: 켜짐', ja: 'ヒント: ON', 'zh-TW': '提示:開', 'zh-CN': '提示:开' },
  'settings.guideOff': { en: 'Hints: OFF', ko: '안내: 꺼짐', ja: 'ヒント: OFF', 'zh-TW': '提示:關', 'zh-CN': '提示:关' },
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

/** 언어별 글꼴 (Do Hyeon은 한글·영문만 있음 (Jua는 'ㅋ' 등이 깨져 보여 바꿈, 사용자 2026-11-11) → 일본어·중국어는 둥근 글꼴 따로) */
const FONTS: Record<Lang, { family: string; css: string | null }> = {
  en: { family: "'Do Hyeon'", css: null },
  ko: { family: "'Do Hyeon'", css: null },
  ja: { family: "'M PLUS Rounded 1c'", css: 'M+PLUS+Rounded+1c:wght@800' },
  'zh-TW': { family: "'Noto Sans TC'", css: 'Noto+Sans+TC:wght@800' },
  'zh-CN': { family: "'ZCOOL KuaiLe'", css: 'ZCOOL+KuaiLe' },
};

/** 화면 글꼴 이름 (3D 라벨 캔버스도 같이 씀) */
export const fontFamily = `${FONTS[lang].family}, 'Do Hyeon', system-ui, sans-serif`;

/** html lang·글꼴 적용. 일본어·중국어 글꼴을 다 받을 때까지 기다림 (3D 라벨이 기본 글꼴로 구워지지 않게, 최대 2.5초) */
export async function applyLang(): Promise<void> {
  document.documentElement.lang = lang;
  document.documentElement.style.setProperty('--font', fontFamily);
  const f = FONTS[lang];
  if (!f.css) {
    await waitFont("64px 'Do Hyeon'", usedText());
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${f.css}&display=swap`;
  document.head.appendChild(link);
  await waitFont(`64px ${f.family}`, usedText());
}

/**
 * 이 언어로 화면에 쓸 수 있는 글자 전부 (문구 표 + 숫자·기호). 한글·한자 웹폰트는 글자 묶음(unicode-range)별로
 * 따로 받아지므로, 일부만 받으면 3D 라벨(캔버스)이 안 받은 글자를 기본 글꼴로 구움 (예: '최고'의 '고'만 다른 글꼴).
 */
function usedText(): string {
  const set = new Set<string>('0123456789.,·×+-/%()!?:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzKMBT');
  for (const e of Object.values(STRINGS) as Entry[]) for (const ch of e[lang] || e.en) set.add(ch);
  return [...set].join('');
}

async function waitFont(spec: string, text: string): Promise<void> {
  try {
    await Promise.race([document.fonts.load(spec, text), new Promise((r) => setTimeout(r, 3500))]);
  } catch { /* 글꼴 실패: 기본 글꼴 */ }
}

export function setLang(l: Lang): void {
  try { localStorage.setItem(KEY, l); } catch { /* 저장 못 해도 이번 새로고침은 기본 언어 */ }
  location.reload();
}

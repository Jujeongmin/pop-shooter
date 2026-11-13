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
  'fac.rangeAtk': { en: 'Attack', ko: '공격', ja: '攻撃', 'zh-TW': '攻擊', 'zh-CN': '攻击' },
  'hud.shop': { en: 'Shop', ko: '상점', ja: 'ショップ', 'zh-TW': '商店', 'zh-CN': '商店' },
  'store.title': { en: 'Shop', ko: '상점', ja: 'ショップ', 'zh-TW': '商店', 'zh-CN': '商店' },
  'shop.tab.free': { en: 'Free', ko: '무료', ja: '無料', 'zh-TW': '免費', 'zh-CN': '免费' },
  'shop.tab.pass': { en: 'Attack Pass', ko: '공격력 패스', ja: '攻撃パス', 'zh-TW': '攻擊通行證', 'zh-CN': '攻击通行证' },
  'shop.tab.gems': { en: 'Pop Gems', ko: '팝젬', ja: 'ポップジェム', 'zh-TW': '泡泡寶石', 'zh-CN': '泡泡宝石' },
  'shop.tab.heroes': { en: 'Heroes', ko: '캐릭터', ja: 'キャラ', 'zh-TW': '角色', 'zh-CN': '角色' },
  'shop.watch': { en: 'Watch ad', ko: '광고 보기', ja: '広告を見る', 'zh-TW': '看廣告', 'zh-CN': '看广告' },
  'shop.adWait': { en: 'Playing the ad...', ko: '광고 재생 중...', ja: '広告を再生中...', 'zh-TW': '廣告播放中...', 'zh-CN': '广告播放中...' },
  'shop.ad.granted': { en: 'Reward received!', ko: '보상을 받았어요!', ja: '報酬をゲット!', 'zh-TW': '已領取獎勵!', 'zh-CN': '已领取奖励!' },
  'shop.ad.dismissed': { en: 'The ad was closed early, so no reward', ko: '광고를 끝까지 보지 않아 보상이 없어요', ja: '広告を最後まで見ていないので報酬なし', 'zh-TW': '未看完廣告, 沒有獎勵', 'zh-CN': '未看完广告, 没有奖励' },
  'shop.ad.busy': { en: 'An ad is already playing', ko: '이미 광고가 재생 중이에요', ja: 'すでに広告を再生中', 'zh-TW': '廣告正在播放', 'zh-CN': '广告正在播放' },
  'shop.ad.unsupported': { en: 'Ads are not available here', ko: '여기서는 광고를 볼 수 없어요', ja: 'ここでは広告を見られません', 'zh-TW': '此處無法觀看廣告', 'zh-CN': '此处无法观看广告' },
  'shop.ad.failed': { en: 'Could not confirm the reward. Try again later', ko: '보상을 확인하지 못했어요. 잠시 후 다시 해 주세요', ja: '報酬を確認できませんでした。後でもう一度', 'zh-TW': '無法確認獎勵, 請稍後再試', 'zh-CN': '无法确认奖励, 请稍后再试' },
  'shop.ad.limit': { en: 'No more today', ko: '오늘은 더 받을 수 없어요', ja: '今日はもう受け取れません', 'zh-TW': '今天無法再領取', 'zh-CN': '今天无法再领取' },
  'shop.ad.offline': { en: 'There is no offline reward to double', ko: '2배로 받을 오프라인 보상이 없어요', ja: '2倍にするオフライン報酬がありません', 'zh-TW': '沒有可加倍的離線獎勵', 'zh-CN': '没有可加倍的离线奖励' },
  'shop.vx.ok': { en: 'Buy', ko: '구매', ja: '購入', 'zh-TW': '購買', 'zh-CN': '购买' },
  'shop.vx.loading': { en: 'Loading...', ko: '불러오는 중...', ja: '読み込み中...', 'zh-TW': '載入中...', 'zh-CN': '加载中...' },
  'shop.vx.none': { en: 'Not on sale', ko: '판매 전', ja: '販売前', 'zh-TW': '尚未販售', 'zh-CN': '尚未销售' },
  'shop.vx.error': { en: 'Unavailable', ko: '구매 불가', ja: '購入不可', 'zh-TW': '無法購買', 'zh-CN': '无法购买' },
  'shop.vx.busy': { en: 'In checkout', ko: '결제 중', ja: '決済中', 'zh-TW': '結帳中', 'zh-CN': '结账中' },
  'shop.vx.limit': { en: 'Purchased', ko: '구매함', ja: '購入済み', 'zh-TW': '已購買', 'zh-CN': '已购买' },
  'shop.offline': { en: 'Not connected to the server: ads and purchases are off', ko: '서버에 연결되지 않아 광고·구매를 할 수 없어요', ja: 'サーバー未接続のため広告・購入はできません', 'zh-TW': '未連線伺服器, 無法觀看廣告或購買', 'zh-CN': '未连接服务器, 无法观看广告或购买' },
  'shop.boostOn': { en: 'Gold ×2 active: {t} left', ko: '골드 2배 중: {t} 남음', ja: 'ゴールド2倍中: 残り{t}', 'zh-TW': '金幣2倍中: 剩餘{t}', 'zh-CN': '金币2倍中: 剩余{t}' },
  'shop.boostOff': { en: 'Gold ×2 boosts stack up to 2 hours', ko: '골드 2배는 최대 2시간까지 쌓여요', ja: 'ゴールド2倍は最大2時間まで重なる', 'zh-TW': '金幣2倍最多可累積2小時', 'zh-CN': '金币2倍最多可累积2小时' },
  'shop.adBoost': { en: 'Gold ×2', ko: '골드 2배', ja: 'ゴールド2倍', 'zh-TW': '金幣2倍', 'zh-CN': '金币2倍' },
  'shop.adBoostDesc': { en: 'Battle gold ×2 for {m} min', ko: '전투 골드 2배 {m}분', ja: 'バトルのゴールド2倍 {m}分', 'zh-TW': '戰鬥金幣2倍 {m}分鐘', 'zh-CN': '战斗金币2倍 {m}分钟' },
  'shop.gemBoost': { en: 'Gold ×2 with Pop Gems', ko: '팝젬으로 골드 2배', ja: 'ジェムでゴールド2倍', 'zh-TW': '用寶石金幣2倍', 'zh-CN': '用宝石金币2倍' },
  'shop.gemShort': { en: 'Not enough Pop Gems', ko: '팝젬이 모자라요', ja: 'ジェムが足りません', 'zh-TW': '寶石不足', 'zh-CN': '宝石不足' },
  'shop.passHint': { en: 'Passes are forever. Buy them in order; each tier doubles your damage again.', ko: '패스는 영구예요. 순서대로 사고, 단계마다 피해가 2배씩 쌓여요.', ja: 'パスは永久。順番に購入し、段階ごとにダメージが2倍ずつ重なります。', 'zh-TW': '通行證永久有效。依序購買, 每一級傷害再 ×2。', 'zh-CN': '通行证永久有效。依次购买, 每一级伤害再 ×2。' },
  'shop.pass': { en: 'Attack Pass Tier {n}', ko: '공격력 패스 {n}단계', ja: '攻撃パス 第{n}段階', 'zh-TW': '攻擊通行證 第{n}級', 'zh-CN': '攻击通行证 第{n}级' },
  'shop.passDesc': { en: 'Damage ×{m}', ko: '피해 ×{m}', ja: 'ダメージ ×{m}', 'zh-TW': '傷害 ×{m}', 'zh-CN': '伤害 ×{m}' },
  'shop.passNeed': { en: 'Previous tier first', ko: '이전 단계 먼저', ja: '前の段階が先', 'zh-TW': '需先購買上一級', 'zh-CN': '需先购买上一级' },
  'shop.gemPack': { en: '{n} Pop Gems', ko: '팝젬 {n}개', ja: 'ポップジェム {n}個', 'zh-TW': '泡泡寶石 {n}個', 'zh-CN': '泡泡宝石 {n}个' },
  'shop.gemPackDesc': { en: 'For Attack Passes, heroes and Gold ×2', ko: '공격력 패스·캐릭터·골드 2배에 써요', ja: '攻撃パス・キャラ・ゴールド2倍に使える', 'zh-TW': '可用於攻擊通行證、角色、金幣2倍', 'zh-CN': '可用于攻击通行证、角色、金币2倍' },
  'shop.charge': { en: 'Get Gems', ko: '팝젬 충전', ja: 'ジェム補充', 'zh-TW': '儲值寶石', 'zh-CN': '充值宝石' },
  'shop.myGems': { en: 'Your Pop Gems: {n}', ko: '보유 팝젬 {n}', ja: '所持ジェム {n}', 'zh-TW': '持有寶石 {n}', 'zh-CN': '持有宝石 {n}' },
  'shop.heroDesc': { en: 'Owned bonus: damage +{p}% more', ko: '보유 효과: 피해 +{p}% 추가', ja: '所持効果: ダメージ +{p}% 追加', 'zh-TW': '持有效果: 傷害額外 +{p}%', 'zh-CN': '持有效果: 伤害额外 +{p}%' },
  'shop.note.open_failed': { en: 'Could not open checkout', ko: '결제창을 열지 못했어요', ja: '決済画面を開けませんでした', 'zh-TW': '無法開啟結帳', 'zh-CN': '无法打开结账' },
  'shop.note.cancelled': { en: 'Purchase cancelled', ko: '결제를 취소했어요', ja: '決済をキャンセルしました', 'zh-TW': '已取消購買', 'zh-CN': '已取消购买' },
  'shop.note.checking': { en: 'Confirming the purchase...', ko: '구매 확인 중...', ja: '購入を確認中...', 'zh-TW': '確認購買中...', 'zh-CN': '确认购买中...' },
  'shop.note.done': { en: 'Purchase complete!', ko: '구매 완료!', ja: '購入完了!', 'zh-TW': '購買完成!', 'zh-CN': '购买完成!' },
  'shop.note.delayed': { en: 'Paid, but not delivered yet. Reopen the shop in a moment.', ko: '결제는 됐지만 아직 반영 전이에요. 잠시 뒤 상점을 다시 열어 주세요.', ja: '決済済みですがまだ反映されていません。少し後でショップを開き直してください。', 'zh-TW': '已付款但尚未到帳, 請稍後重新開啟商店。', 'zh-CN': '已付款但尚未到账, 请稍后重新打开商店。' },
  'off.ad2x': { en: 'Watch ad: ×2', ko: '광고 보고 2배', ja: '広告で2倍', 'zh-TW': '看廣告領2倍', 'zh-CN': '看广告领2倍' },
  'fac.treadmill': { en: 'Treadmill', ko: '러닝머신', ja: 'ランニングマシン', 'zh-TW': '跑步機', 'zh-CN': '跑步机' },
  'fac.fountain': { en: 'Coin Fountain', ko: '동전 분수', ja: 'コインの噴水', 'zh-TW': '金幣噴泉', 'zh-CN': '金币喷泉' },
  'st.run': { en: 'Run! Fire rate training', ko: '달려라! 연사 훈련 중', ja: '走れ! 連射トレーニング', 'zh-TW': '快跑! 連射訓練中', 'zh-CN': '快跑! 连射训练中' },
  'st.coin': { en: 'Catch coins! Gold bonus training', ko: '동전을 받아라! 골드 보너스 훈련 중', ja: 'コインをキャッチ! ゴールドボーナス訓練', 'zh-TW': '接金幣! 金幣加成訓練中', 'zh-CN': '接金币! 金币加成训练中' },
  'st.tap': { en: 'Training on its own!', ko: '자동으로 훈련해요!', ja: '自動でトレーニング!', 'zh-TW': '自動訓練中!', 'zh-CN': '自动训练中!' },
  'fac.rangeSpd': { en: 'Fire rate', ko: '연사', ja: '連射', 'zh-TW': '連射', 'zh-CN': '连射' },
  'fac.rangeCoin': { en: 'Gold bonus', ko: '골드 보너스', ja: 'ゴールドボーナス', 'zh-TW': '金幣加成', 'zh-CN': '金币加成' },
  'range.atk': { en: 'Attack training!', ko: '공격 훈련 중!', ja: '攻撃トレーニング!', 'zh-TW': '攻擊訓練中!', 'zh-CN': '攻击训练中!' },
  'range.spd': { en: 'Fire-rate training!', ko: '연사 훈련 중!', ja: '連射トレーニング!', 'zh-TW': '連射訓練中!', 'zh-CN': '连射训练中!' },
  'range.coin': { en: 'Gold bonus training!', ko: '골드 보너스 훈련 중!', ja: 'ゴールドボーナス訓練!', 'zh-TW': '金幣加成訓練中!', 'zh-CN': '金币加成训练中!' },
  'fac.upgrade': { en: 'Upgrades', ko: '업그레이드', ja: 'アップグレード', 'zh-TW': '升級', 'zh-CN': '升级' },
  'fac.guns': { en: 'Gun Shop', ko: '총 상점', ja: '銃ショップ', 'zh-TW': '槍械商店', 'zh-CN': '枪械商店' },
  'fac.altar': { en: 'Rebirth Altar', ko: '환생 제단', ja: '転生の祭壇', 'zh-TW': '轉生祭壇', 'zh-CN': '转生祭坛' },
  'fac.chars': { en: 'Heroes', ko: '캐릭터', ja: 'キャラ', 'zh-TW': '角色', 'zh-CN': '角色' },
  'daily.title': { en: 'Daily Gift', ko: '오늘의 선물', ja: '今日のプレゼント', 'zh-TW': '每日禮物', 'zh-CN': '每日礼物' },
  'daily.body': { en: 'Come back every day for a gift! Missing a day is okay.', ko: '매일 들어오면 선물을 받아요! 하루 빠져도 괜찮아요.', ja: '毎日来るとプレゼント！休んでも大丈夫。', 'zh-TW': '每天上線就有禮物！漏一天也沒關係。', 'zh-CN': '每天上线就有礼物！漏一天也没关系。' },
  'daily.day': { en: 'Day {n}', ko: '{n}일째', ja: '{n}日目', 'zh-TW': '第{n}天', 'zh-CN': '第{n}天' },
  'daily.claim': { en: 'Claim', ko: '받기', ja: '受け取る', 'zh-TW': '領取', 'zh-CN': '领取' },
  'daily.boost': { en: 'Gold ×2 {m}m', ko: '골드 2배 {m}분', ja: 'ゴールド2倍 {m}分', 'zh-TW': '金幣×2 {m}分', 'zh-CN': '金币×2 {m}分' },
  'daily.done': { en: 'See you tomorrow!', ko: '내일 또 만나요!', ja: 'また明日！', 'zh-TW': '明天見！', 'zh-CN': '明天见！' },
  'ev.daily': { en: 'Gift', ko: '선물', ja: 'ギフト', 'zh-TW': '禮物', 'zh-CN': '礼物' },
  'ev.boost': { en: 'Gold ×2', ko: '골드 2배', ja: 'ゴールド2倍', 'zh-TW': '金幣×2', 'zh-CN': '金币×2' },
  'ev.pass': { en: 'Attack Pass', ko: '공격력 패스', ja: '攻撃パス', 'zh-TW': '攻擊通行證', 'zh-CN': '攻击通行证' },
  'ev.gems': { en: 'Gems', ko: '팝젬', ja: 'ジェム', 'zh-TW': '寶石', 'zh-CN': '宝石' },
  'ev.hero': { en: 'New Hero', ko: '새 캐릭터', ja: '新キャラ', 'zh-TW': '新角色', 'zh-CN': '新角色' },
  'fac.travel': { en: 'World Travel', ko: '월드 이동', ja: 'ワールド移動', 'zh-TW': '世界移動', 'zh-CN': '世界移动' },
  'travel.title': { en: 'World Travel', ko: '월드 이동', ja: 'ワールド移動', 'zh-TW': '世界移動', 'zh-CN': '世界移动' },
  'travel.here': { en: 'You are here', ko: '지금 여기', ja: '現在地', 'zh-TW': '目前位置', 'zh-CN': '当前位置' },
  'travel.go': { en: 'Go', ko: '이동', ja: '移動', 'zh-TW': '前往', 'zh-CN': '前往' },
  'travel.locked': { en: 'Beat {s} to open', ko: '{s} 깨면 열려요', ja: '{s}クリアで解放', 'zh-TW': '通關 {s} 後開放', 'zh-CN': '通关 {s} 后开放' },
  'travel.hint': { en: 'Each world has a stronger range. Beat a world boss to open the next world.', ko: '월드마다 훈련장이 더 좋아요. 월드 대장을 깨면 다음 월드가 열려요.', ja: 'ワールドごとに訓練場が強くなるよ。ボスを倒すと次のワールドが開く。', 'zh-TW': '每個世界的訓練場更好。擊敗世界首領就會開放下一個世界。', 'zh-CN': '每个世界的训练场更好。击败世界首领就会开放下一个世界。' },
  'travel.train': { en: 'Training ×{m}', ko: '훈련 ×{m}', ja: '訓練 ×{m}', 'zh-TW': '訓練 ×{m}', 'zh-CN': '训练 ×{m}' },
  'travel.opened': { en: 'World {w} opened!', ko: '월드 {w} 열림!', ja: 'ワールド{w}解放!', 'zh-TW': '世界{w}開放!', 'zh-CN': '世界{w}开放!' },
  'world.1': { en: 'Toy Town', ko: '장난감 마을', ja: 'おもちゃの町', 'zh-TW': '玩具小鎮', 'zh-CN': '玩具小镇' },
  'world.2': { en: 'Block Builders', ko: '블록 공사장', ja: 'ブロック工事現場', 'zh-TW': '積木工地', 'zh-CN': '积木工地' },
  'world.3': { en: 'Candy Factory', ko: '사탕 공장', ja: 'キャンディ工場', 'zh-TW': '糖果工廠', 'zh-CN': '糖果工厂' },
  'world.4': { en: 'Toy Space Base', ko: '장난감 우주기지', ja: 'おもちゃ宇宙基地', 'zh-TW': '玩具太空基地', 'zh-CN': '玩具太空基地' },
  'world.5': { en: 'Sunny Beach', ko: '해변 바다', ja: 'ビーチ', 'zh-TW': '陽光海灘', 'zh-CN': '阳光海滩' },
  'world.6': { en: 'Snow Village', ko: '눈 마을', ja: '雪の村', 'zh-TW': '雪之村', 'zh-CN': '雪之村' },
  'world.7': { en: 'Toy Castle', ko: '장난감 성', ja: 'おもちゃの城', 'zh-TW': '玩具城堡', 'zh-CN': '玩具城堡' },
  'world.8': { en: 'Rainbow Cloud Kingdom', ko: '무지개 구름 왕국', ja: '虹の雲の王国', 'zh-TW': '彩虹雲王國', 'zh-CN': '彩虹云王国' },
  'fac.portal': { en: 'World {w} Portal', ko: '월드 {w} 포털', ja: 'ワールド{w}ポータル', 'zh-TW': '世界{w}傳送門', 'zh-CN': '世界{w}传送门' },
  'portal.first': { en: 'First run', ko: '첫 도전', ja: '初挑戦', 'zh-TW': '首次挑戰', 'zh-CN': '首次挑战' },
  'portal.best': { en: 'Best {s}', ko: '최고 {s}', ja: '最高 {s}', 'zh-TW': '最佳 {s}', 'zh-CN': '最佳 {s}' },
  'portal.big': { en: 'Run from {s}!', ko: '{s}부터 연속 도전!', ja: '{s}から連続チャレンジ!', 'zh-TW': '從{s}連續挑戰!', 'zh-CN': '从{s}连续挑战!' },

  'range.title': { en: 'Training!', ko: '사격장 훈련 중!', ja: '訓練中!', 'zh-TW': '訓練中!', 'zh-CN': '训练中!' },
  'range.big': { en: 'Shooting on its own!', ko: '자동으로 쏴요!', ja: '自動で撃つよ!', 'zh-TW': '自動射擊!', 'zh-CN': '自动射击!' },
  'float.pop': { en: 'Pop!', ko: '팡!', ja: 'パン!', 'zh-TW': '砰!', 'zh-CN': '砰!' },
  'float.away': { en: 'While away +{n}', ko: '자리 비운 동안 +{n}', ja: '留守中 +{n}', 'zh-TW': '離開期間 +{n}', 'zh-CN': '离开期间 +{n}' },

  'battle.hint': { en: 'Tap to shoot more!', ko: '화면을 탭하면 더 쏴요!', ja: 'タップでもっと撃てる!', 'zh-TW': '點擊畫面多射幾發!', 'zh-CN': '点击屏幕多射几发!' },
  'battle.boss': { en: '{s} BOSS', ko: '{s} 대장', ja: '{s} ボス', 'zh-TW': '{s} 首領', 'zh-CN': '{s} 首领' },
  'battle.sec': { en: '{n}s', ko: '{n}초', ja: '{n}秒', 'zh-TW': '{n}秒', 'zh-CN': '{n}秒' },
  'battle.bossIn': { en: 'Boss incoming!', ko: '대장 등장!', ja: 'ボス登場!', 'zh-TW': '首領登場!', 'zh-CN': '首领登场!' },
  'battle.ready': { en: 'Ready...', ko: '준비...', ja: '準備...', 'zh-TW': '準備...', 'zh-CN': '准备...' },
  'battle.go': { en: 'GO!', ko: '시작!', ja: 'スタート!', 'zh-TW': '開始!', 'zh-CN': '开始!' },
  'battle.auto': { en: 'Auto battle: just watch!', ko: '자동 전투! 가만히 있어도 돼요', ja: 'オートバトル! 見てるだけでOK', 'zh-TW': '自動戰鬥! 看著就好', 'zh-CN': '自动战斗! 看着就好' },
  'ev.boostAsk': { en: 'Watch an ad for Gold ×2 ({m} min)?', ko: '광고를 보고 골드 2배({m}분)를 받을까요?', ja: '広告を見てゴールド2倍({m}分)をもらう?', 'zh-TW': '看廣告獲得金幣2倍({m}分鐘)?', 'zh-CN': '看广告获得金币2倍({m}分钟)?' },
  'ev.boostYes': { en: 'Watch ad', ko: '광고 보기', ja: '広告を見る', 'zh-TW': '看廣告', 'zh-CN': '看广告' },
  'ev.boostNo': { en: 'Not now', ko: '취소', ja: 'やめる', 'zh-TW': '取消', 'zh-CN': '取消' },
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
  'peer.atk': { en: 'DPS {n}', ko: 'DPS {n}', ja: 'DPS {n}', 'zh-TW': 'DPS {n}', 'zh-CN': 'DPS {n}' },
  'peer.battle': { en: 'In battle', ko: '전투 중', ja: 'バトル中', 'zh-TW': '戰鬥中', 'zh-CN': '战斗中' },

  'settings.title': { en: 'Settings', ko: '설정', ja: '設定', 'zh-TW': '設定', 'zh-CN': '设置' },
  'settings.lang': { en: 'Language', ko: '언어', ja: '言語', 'zh-TW': '語言', 'zh-CN': '语言' },
  'settings.master': { en: 'Master volume', ko: '전체 음량', ja: '全体の音量', 'zh-TW': '總音量', 'zh-CN': '总音量' },
  'settings.sfx': { en: 'Sound effects', ko: '효과음', ja: '効果音', 'zh-TW': '音效', 'zh-CN': '音效' },
  'settings.music': { en: 'Music', ko: '배경음악', ja: 'BGM', 'zh-TW': '背景音樂', 'zh-CN': '背景音乐' },
  'settings.soundOn': { en: 'Sound: ON', ko: '소리: 켜짐', ja: 'サウンド: ON', 'zh-TW': '聲音:開', 'zh-CN': '声音:开' },
  'settings.soundOff': { en: 'Sound: OFF (muted)', ko: '소리: 꺼짐 (음소거)', ja: 'サウンド: OFF(ミュート)', 'zh-TW': '聲音:關(靜音)', 'zh-CN': '声音:关(静音)' },
  'net.retrying': { en: 'Connecting to the server… (retry {n})', ko: '서버에 연결하는 중… (다시 시도 {n})', ja: 'サーバーに接続中… (再試行 {n})', 'zh-TW': '正在連線伺服器… (重試 {n})', 'zh-CN': '正在连接服务器… (重试 {n})' },
  'settings.close': { en: 'Close', ko: '닫기', ja: '閉じる', 'zh-TW': '關閉', 'zh-CN': '关闭' },
  'settings.reset': { en: 'Reset account', ko: '계정 초기화', ja: 'アカウント初期化', 'zh-TW': '重置帳號', 'zh-CN': '重置账号' },
  'settings.resetAsk': { en: 'Tap again: all progress resets (purchases kept)', ko: '한 번 더 누르면 진행이 모두 지워져요 (산 것은 유지)', ja: 'もう一度押すと進行がすべて消えます (購入品は残ります)', 'zh-TW': '再按一次將清除所有進度 (購買項目保留)', 'zh-CN': '再按一次将清除所有进度 (购买项目保留)' },
  'settings.resetting': { en: 'Resetting…', ko: '초기화 중…', ja: '初期化中…', 'zh-TW': '重置中…', 'zh-CN': '重置中…' },
  'settings.resetFail': { en: 'Reset failed, try again', ko: '초기화 실패, 다시 눌러 주세요', ja: '初期化に失敗、もう一度', 'zh-TW': '重置失敗，請再試一次', 'zh-CN': '重置失败，请再试一次' },

  'up.tab.mach': { en: 'Machines', ko: '훈련 기구', ja: '訓練器具', 'zh-TW': '訓練器材', 'zh-CN': '训练器材' },
  'up.tab.gear': { en: 'Gear', ko: '장비', ja: '装備', 'zh-TW': '裝備', 'zh-CN': '装备' },
  'up.tab.mentor': { en: 'Mentors', ko: '멘토', ja: 'メンター', 'zh-TW': '導師', 'zh-CN': '导师' },
  'tr.atk': { en: 'Attack', ko: '공격', ja: '攻撃', 'zh-TW': '攻擊', 'zh-CN': '攻击' },
  'tr.spd': { en: 'Fire rate', ko: '연사', ja: '連射', 'zh-TW': '連射', 'zh-CN': '连射' },
  'tr.coin': { en: 'Coins', ko: '코인', ja: 'コイン', 'zh-TW': '金幣', 'zh-CN': '金币' },
  'tr.title': { en: 'Training', ko: '훈련', ja: '訓練', 'zh-TW': '訓練', 'zh-CN': '训练' },
  'tr.hint': { en: 'Machines make each shot, step or coin at the training spots count for more. Gold comes from stages.', ko: '기구를 올리면 사격장·러닝머신·동전 분수에서 한 번에 오르는 양이 늘어요. 골드는 스테이지에서 벌어요.', ja: '器具を上げると射撃場・ランニングマシン・コインの噴水で1回に上がる量が増えるよ。ゴールドはステージで稼ごう。', 'zh-TW': '升級器具後，射擊場、跑步機、金幣噴泉每次提升更多。金幣靠關卡賺。', 'zh-CN': '升级器具后，射击场、跑步机、金币喷泉每次提升更多。金币靠关卡赚。' },
  'mach.atk': { en: 'Range Target', ko: '사격장 과녁', ja: '射撃場の的', 'zh-TW': '射擊場靶', 'zh-CN': '射击场靶' },
  'mach.spd': { en: 'Treadmill', ko: '러닝머신', ja: 'ランニングマシン', 'zh-TW': '跑步機', 'zh-CN': '跑步机' },
  'mach.coin': { en: 'Coin Fountain', ko: '동전 분수', ja: 'コインの噴水', 'zh-TW': '金幣噴泉', 'zh-CN': '金币喷泉' },
  'mach.desc.atk': { en: '{s}: +{g} per shot', ko: '{s}: 한 발에 +{g}', ja: '{s}: 1発 +{g}', 'zh-TW': '{s}：每發 +{g}', 'zh-CN': '{s}：每发 +{g}' },
  'mach.desc.spd': { en: '{s}: +{g} per step', ko: '{s}: 한 걸음에 +{g}', ja: '{s}: 1歩 +{g}', 'zh-TW': '{s}：每步 +{g}', 'zh-CN': '{s}：每步 +{g}' },
  'mach.desc.coin': { en: '{s}: +{g} per coin', ko: '{s}: 동전 하나에 +{g}', ja: '{s}: コイン1枚 +{g}', 'zh-TW': '{s}：每枚金幣 +{g}', 'zh-CN': '{s}：每枚金币 +{g}' },
  'gear.gloves': { en: 'Shooting Gloves', ko: '사격 장갑', ja: '射撃グローブ', 'zh-TW': '射擊手套', 'zh-CN': '射击手套' },
  'gear.goggles': { en: 'Aim Goggles', ko: '조준 고글', ja: '照準ゴーグル', 'zh-TW': '瞄準護目鏡', 'zh-CN': '瞄准护目镜' },
  'gear.piggy': { en: 'Piggy Bank', ko: '돼지 저금통', ja: 'ブタの貯金箱', 'zh-TW': '小豬撲滿', 'zh-CN': '小猪存钱罐' },
  'gear.gloves2': { en: 'Pro Gloves', ko: '프로 장갑', ja: 'プログローブ', 'zh-TW': '專業手套', 'zh-CN': '专业手套' },
  'gear.goggles2': { en: 'Pro Goggles', ko: '프로 고글', ja: 'プロゴーグル', 'zh-TW': '專業護目鏡', 'zh-CN': '专业护目镜' },
  'gear.piggy2': { en: 'Golden Piggy', ko: '황금 저금통', ja: '金の貯金箱', 'zh-TW': '黃金撲滿', 'zh-CN': '黄金存钱罐' },
  'gear.gloves3': { en: 'Legend Gloves', ko: '전설 장갑', ja: '伝説のグローブ', 'zh-TW': '傳說手套', 'zh-CN': '传说手套' },
  'gear.goggles3': { en: 'Legend Goggles', ko: '전설 고글', ja: '伝説のゴーグル', 'zh-TW': '傳說護目鏡', 'zh-CN': '传说护目镜' },
  'gear.piggy3': { en: 'Diamond Piggy', ko: '다이아 저금통', ja: 'ダイヤの貯金箱', 'zh-TW': '鑽石撲滿', 'zh-CN': '钻石存钱罐' },
  'gear.gloves4': { en: 'Emerald Gloves', ko: '에메랄드 장갑', ja: 'エメラルドグローブ', 'zh-TW': '翡翠手套', 'zh-CN': '翡翠手套' },
  'gear.goggles4': { en: 'Emerald Goggles', ko: '에메랄드 고글', ja: 'エメラルドゴーグル', 'zh-TW': '翡翠護目鏡', 'zh-CN': '翡翠护目镜' },
  'gear.piggy4': { en: 'Emerald Piggy', ko: '에메랄드 저금통', ja: 'エメラルド貯金箱', 'zh-TW': '翡翠撲滿', 'zh-CN': '翡翠存钱罐' },
  'gear.gloves5': { en: 'Sapphire Gloves', ko: '사파이어 장갑', ja: 'サファイアグローブ', 'zh-TW': '藍寶石手套', 'zh-CN': '蓝宝石手套' },
  'gear.goggles5': { en: 'Sapphire Goggles', ko: '사파이어 고글', ja: 'サファイアゴーグル', 'zh-TW': '藍寶石護目鏡', 'zh-CN': '蓝宝石护目镜' },
  'gear.piggy5': { en: 'Sapphire Piggy', ko: '사파이어 저금통', ja: 'サファイア貯金箱', 'zh-TW': '藍寶石撲滿', 'zh-CN': '蓝宝石存钱罐' },
  'gear.gloves6': { en: 'Amethyst Gloves', ko: '자수정 장갑', ja: 'アメジストグローブ', 'zh-TW': '紫水晶手套', 'zh-CN': '紫水晶手套' },
  'gear.goggles6': { en: 'Amethyst Goggles', ko: '자수정 고글', ja: 'アメジストゴーグル', 'zh-TW': '紫水晶護目鏡', 'zh-CN': '紫水晶护目镜' },
  'gear.piggy6': { en: 'Amethyst Piggy', ko: '자수정 저금통', ja: 'アメジスト貯金箱', 'zh-TW': '紫水晶撲滿', 'zh-CN': '紫水晶存钱罐' },
  'gear.gloves7': { en: 'Ruby Gloves', ko: '루비 장갑', ja: 'ルビーグローブ', 'zh-TW': '紅寶石手套', 'zh-CN': '红宝石手套' },
  'gear.goggles7': { en: 'Ruby Goggles', ko: '루비 고글', ja: 'ルビーゴーグル', 'zh-TW': '紅寶石護目鏡', 'zh-CN': '红宝石护目镜' },
  'gear.piggy7': { en: 'Ruby Piggy', ko: '루비 저금통', ja: 'ルビー貯金箱', 'zh-TW': '紅寶石撲滿', 'zh-CN': '红宝石存钱罐' },
  'gear.gloves8': { en: 'Rainbow Gloves', ko: '무지개 장갑', ja: 'レインボーグローブ', 'zh-TW': '彩虹手套', 'zh-CN': '彩虹手套' },
  'gear.goggles8': { en: 'Rainbow Goggles', ko: '무지개 고글', ja: 'レインボーゴーグル', 'zh-TW': '彩虹護目鏡', 'zh-CN': '彩虹护目镜' },
  'gear.piggy8': { en: 'Rainbow Piggy', ko: '무지개 저금통', ja: 'レインボー貯金箱', 'zh-TW': '彩虹撲滿', 'zh-CN': '彩虹存钱罐' },
  'gear.desc': { en: '{s} training ×{m}', ko: '{s} 훈련 ×{m}', ja: '{s}訓練 ×{m}', 'zh-TW': '{s}訓練 ×{m}', 'zh-CN': '{s}训练 ×{m}' },
  'gear.owned': { en: 'Equipped', ko: '장착함', ja: '装備中', 'zh-TW': '已裝備', 'zh-CN': '已装备' },
  'gear.need': { en: 'Clear {st}', ko: '{st} 클리어', ja: '{st} クリア', 'zh-TW': '通關 {st}', 'zh-CN': '通关 {st}' },
  'mentor.coach': { en: 'Coach MOCHI', ko: '코치 MOCHI', ja: 'コーチ MOCHI', 'zh-TW': '教練 MOCHI', 'zh-CN': '教练 MOCHI' },
  'mentor.sniper': { en: 'Sniper POPI', ko: '저격수 POPI', ja: 'スナイパー POPI', 'zh-TW': '狙擊手 POPI', 'zh-CN': '狙击手 POPI' },
  'mentor.captain': { en: 'Captain ROKO', ko: '대장 ROKO', ja: 'キャプテン ROKO', 'zh-TW': '隊長 ROKO', 'zh-CN': '队长 ROKO' },
  'mentor.legend': { en: 'Legend SHONI', ko: '전설 SHONI', ja: '伝説の SHONI', 'zh-TW': '傳說 SHONI', 'zh-CN': '传说 SHONI' },
  'mentor.desc': { en: 'All training ×{m}', ko: '모든 훈련 ×{m}', ja: '全訓練 ×{m}', 'zh-TW': '全部訓練 ×{m}', 'zh-CN': '全部训练 ×{m}' },
  'mentor.joined': { en: 'With you!', ko: '함께하는 중', ja: '仲間入り!', 'zh-TW': '已加入!', 'zh-CN': '已加入!' },
  'mentor.need': { en: 'Clear {st} to recruit', ko: '{st} 클리어로 영입', ja: '{st} クリアで加入', 'zh-TW': '通關 {st} 加入', 'zh-CN': '通关 {st} 加入' },
  'mentor.tip.coach': { en: 'Stand on a lane and keep shooting. Every shot counts!', ko: '발판에 서서 계속 쏴! 한 발 한 발이 다 훈련이야!', ja: 'レーンに立って撃ち続けて! 1発ずつが訓練だよ!', 'zh-TW': '站在跑道上一直射擊! 每一發都是訓練!', 'zh-CN': '站在跑道上一直射击! 每一发都是训练!' },
  'mentor.tip.sniper': { en: 'Fire rate stops at 12 per second. After that, train Attack.', ko: '연사는 초당 12발이 끝이야. 그다음엔 공격을 훈련해!', ja: '連射は秒12発が上限。そのあとは攻撃を鍛えて!', 'zh-TW': '連射上限每秒12發。之後就練攻擊!', 'zh-CN': '连射上限每秒12发。之后就练攻击!' },
  'mentor.tip.captain': { en: 'Replay stages for gold, then buy machines.', ko: '스테이지를 반복해 골드를 벌고 기구를 사!', ja: 'ステージを繰り返してゴールドを稼ぎ、器具を買おう!', 'zh-TW': '重複關卡賺金幣, 再買器材!', 'zh-CN': '重复关卡赚金币, 再买器材!' },
  'mentor.tip.legend': { en: 'Rebirth often. Training speed multiplies every time!', ko: '환생은 자주! 할 때마다 훈련 속도가 곱해져!', ja: '転生はこまめに! そのたび訓練速度が倍増!', 'zh-TW': '常常轉生! 每次訓練速度都會倍增!', 'zh-CN': '常常转生! 每次训练速度都会倍增!' },
  'mentor.new': { en: 'New mentor: {n}!', ko: '새 멘토: {n}!', ja: '新メンター: {n}!', 'zh-TW': '新導師: {n}!', 'zh-CN': '新导师: {n}!' },
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
  'reb.title': { en: 'Rebirth', ko: '환생', ja: '転生', 'zh-TW': '轉生', 'zh-CN': '转生' },
  'reb.need': { en: 'Rebirth #{n} needs Attack training', ko: '{n}회 환생 · 필요 공격 훈련', ja: '{n}回転生 · 必要な攻撃トレーニング', 'zh-TW': '已轉生{n}次 · 所需攻擊訓練', 'zh-CN': '已转生{n}次 · 所需攻击训练' },
  'reb.short': { en: 'Train {n} more Attack at the range', ko: '훈련장에서 공격을 {n} 더 훈련해요', ja: '訓練場で攻撃をあと{n}鍛えよう', 'zh-TW': '在訓練場再訓練 {n} 攻擊', 'zh-CN': '在训练场再训练 {n} 攻击' },
  'reb.tip': { en: 'Each rebirth needs a higher level', ko: '환생할 때마다 필요한 레벨이 올라가요', ja: '転生するたびに必要なレベルが上がるよ', 'zh-TW': '每次轉生所需等級都會提高', 'zh-CN': '每次转生所需等级都会提高' },
  'char.power': { en: 'Damage +{m}%', ko: '피해 +{m}%', ja: 'ダメージ +{m}%', 'zh-TW': '傷害 +{m}%', 'zh-CN': '伤害 +{m}%' },
  'char.powerBase': { en: 'Starter hero', ko: '기본 캐릭터', ja: '初期キャラ', 'zh-TW': '初始角色', 'zh-CN': '初始角色' },
  'char.owned': { en: 'Every hero you own adds damage. Total ×{m} (the one you play is just the look)', ko: '가진 캐릭터마다 피해가 더해져요. 합계 ×{m} (쓰는 캐릭터는 외형만 바뀌어요)', ja: '持っているキャラごとにダメージが加算。合計 ×{m} (使うキャラは見た目だけ)', 'zh-TW': '每個擁有的角色都會增加傷害。合計 ×{m} (使用的角色只改變外觀)', 'zh-CN': '每个拥有的角色都会增加伤害。合计 ×{m} (使用的角色只改变外观)' },
  'reb.mult': { en: 'Training speed', ko: '훈련 속도 배율', ja: '訓練速度倍率', 'zh-TW': '訓練速度倍率', 'zh-CN': '训练速度倍率' },
  'reb.gems': { en: 'Pop gems', ko: '팝젬', ja: 'ポップジェム', 'zh-TW': '泡泡寶石', 'zh-CN': '泡泡宝石' },
  'reb.reset': { en: 'Resets', ko: '초기화', ja: 'リセット', 'zh-TW': '重置', 'zh-CN': '重置' },
  'reb.keep': { en: 'Keeps', ko: '유지', ja: 'そのまま', 'zh-TW': '保留', 'zh-CN': '保留' },
  'reb.resetList': { en: 'Attack · Fire rate · Gold bonus training', ko: '공격 · 연사 · 골드 보너스 훈련치', ja: '攻撃・連射・ゴールドボーナスの訓練値', 'zh-TW': '攻擊・連射・金幣加成訓練值', 'zh-CN': '攻击・连射・金币加成训练值' },
  'reb.keepList': { en: 'Gold · Guns · Machines · Gear · Best stage · Pop gems · Heroes', ko: '골드 · 총 · 기구 · 장비 · 최고 기록 · 팝젬 · 캐릭터', ja: 'ゴールド・銃・器具・装備・最高記録・ポップジェム・キャラ', 'zh-TW': '金幣・槍・器材・裝備・最佳紀錄・泡泡寶石・角色', 'zh-CN': '金币・枪・器材・装备・最佳纪录・泡泡宝石・角色' },
  'reb.skip': { en: '{n} Rebirth now', ko: '{n} 바로 환생', ja: '{n} 今すぐ転生', 'zh-TW': '{n} 立即轉生', 'zh-CN': '{n} 立即转生' },
  'reb.skipSure': { en: 'Spend {n} gems to rebirth now?', ko: '팝젬 {n}개로 지금 환생할까요?', ja: 'ジェム{n}個で今すぐ転生する?', 'zh-TW': '花費 {n} 寶石立即轉生?', 'zh-CN': '花费 {n} 宝石立即转生?' },
  'reb.skipFail': { en: 'Could not reach the server. Try again.', ko: '서버에 닿지 못했어요. 다시 해 주세요.', ja: 'サーバーに接続できません。もう一度試してね。', 'zh-TW': '無法連線伺服器, 請再試一次。', 'zh-CN': '无法连接服务器, 请再试一次。' },
  'reb.go': { en: 'Rebirth', ko: '환생하기', ja: '転生する', 'zh-TW': '轉生', 'zh-CN': '转生' },
  'reb.sure': { en: 'Really rebirth?', ko: '정말 환생할까요?', ja: '本当に転生する?', 'zh-TW': '確定要轉生嗎?', 'zh-CN': '确定要转生吗?' },
  'reb.yes': { en: 'Yes!', ko: '네, 환생!', ja: 'はい!', 'zh-TW': '是的!', 'zh-CN': '是的!' },
  'reb.no': { en: 'Not yet', ko: '아직', ja: 'まだ', 'zh-TW': '還不要', 'zh-CN': '还不要' },
  'reb.doneTitle': { en: 'Reborn!', ko: '환생 완료!', ja: '転生完了!', 'zh-TW': '轉生完成!', 'zh-CN': '转生完成!' },
  'reb.doneBig': { en: 'Training ×{m}', ko: '훈련 ×{m}', ja: '訓練 ×{m}', 'zh-TW': '訓練 ×{m}', 'zh-CN': '训练 ×{m}' },
  'ev.reb': { en: 'Rebirth', ko: '환생', ja: '転生', 'zh-TW': '轉生', 'zh-CN': '转生' },
  'reb.done': { en: 'Reborn! ×{m}', ko: '환생! ×{m}', ja: '転生! ×{m}', 'zh-TW': '轉生! ×{m}', 'zh-CN': '转生! ×{m}' },
  'off.title': { en: 'Welcome back!', ko: '어서 와요!', ja: 'おかえり!', 'zh-TW': '歡迎回來!', 'zh-CN': '欢迎回来!' },
  'off.body': { en: 'Gold earned while you were away ({t})', ko: '자리 비운 {t} 동안 모은 골드예요', ja: '留守の{t}の間に集めたゴールド', 'zh-TW': '離開的{t}期間賺到的金幣', 'zh-CN': '离开的{t}期间赚到的金币' },
  'off.claim': { en: 'Collect', ko: '받기', ja: '受け取る', 'zh-TW': '領取', 'zh-CN': '领取' },
  'time.hm': { en: '{h}h {m}m', ko: '{h}시간 {m}분', ja: '{h}時間{m}分', 'zh-TW': '{h}小時{m}分', 'zh-CN': '{h}小时{m}分' },
  'time.m': { en: '{m}m', ko: '{m}분', ja: '{m}分', 'zh-TW': '{m}分鐘', 'zh-CN': '{m}分钟' },
  'char.title': { en: 'Heroes', ko: '캐릭터', ja: 'キャラ', 'zh-TW': '角色', 'zh-CN': '角色' },
  'char.using': { en: 'Playing', ko: '사용 중', ja: '使用中', 'zh-TW': '使用中', 'zh-CN': '使用中' },
  'char.pick': { en: 'Pick', ko: '고르기', ja: '選ぶ', 'zh-TW': '選擇', 'zh-CN': '选择' },
  'char.unlockWorld': { en: 'Clear {s}', ko: '{s} 클리어', ja: '{s}クリア', 'zh-TW': '通關{s}', 'zh-CN': '通关{s}' },
  'char.shop': { en: 'Shop', ko: '상점', ja: 'ショップ', 'zh-TW': '商店', 'zh-CN': '商店' },
  'g.range': { en: 'Shoot at the Training Range to grow your Attack', ko: '훈련장에서 쏘면 공격력이 올라요', ja: '訓練場で撃つと攻撃力が上がる', 'zh-TW': '在訓練場射擊提升攻擊力', 'zh-CN': '在训练场射击提升攻击力' },
  'g.treadmill': { en: 'Run on the Treadmill to fire faster', ko: '러닝머신에서 달리면 초당 발사가 올라요', ja: 'ランニングマシンで走ると連射が上がる', 'zh-TW': '在跑步機上跑步提升射速', 'zh-CN': '在跑步机上跑步提升射速' },
  'g.upgrade': { en: 'You got gold! Buy a training machine at Upgrades', ko: '골드를 얻었어요! 업그레이드에서 훈련 기구를 사요', ja: 'ゴールドをゲット! アップグレードで訓練器具を買おう', 'zh-TW': '獲得金幣! 到升級購買訓練器材', 'zh-CN': '获得金币! 到升级购买训练器材' },
  'g.portal': { en: 'Strong enough for {s}! Enter the portal: battles are automatic, just watch', ko: '{s} 클리어 가능! 포털에 들어가면 자동으로 싸워요, 가만히 있으면 돼요', ja: '{s}をクリアできる! ポータルに入ると自動で戦うよ、見てるだけでOK', 'zh-TW': '可以通關{s}! 進入傳送門會自動戰鬥，看著就好', 'zh-CN': '可以通关{s}! 进入传送门会自动战斗，看着就好' },
  'g.altar': { en: 'Rebirth is ready! Go to the Rebirth Altar', ko: '환생할 수 있어요! 환생 제단으로 가요', ja: '転生できる! 転生の祭壇へ', 'zh-TW': '可以轉生了! 去轉生祭壇', 'zh-CN': '可以转生了! 去转生祭坛' },
  'g.close': { en: 'Close', ko: '닫기', ja: '閉じる', 'zh-TW': '關閉', 'zh-CN': '关闭' },
  'ctl.lock': { en: 'Tab: lock mouse', ko: 'Tab: 마우스 고정', ja: 'Tab: マウス固定', 'zh-TW': 'Tab:鎖定滑鼠', 'zh-CN': 'Tab:锁定鼠标' },
  'ctl.unlock': { en: 'Tab: free mouse', ko: 'Tab: 마우스 풀기', ja: 'Tab: マウス解除', 'zh-TW': 'Tab:釋放滑鼠', 'zh-CN': 'Tab:释放鼠标' },
  'settings.guideOn': { en: 'Hints: ON', ko: '안내: 켜짐', ja: 'ヒント: ON', 'zh-TW': '提示:開', 'zh-CN': '提示:开' },
  'settings.guideOff': { en: 'Hints: OFF', ko: '안내: 꺼짐', ja: 'ヒント: OFF', 'zh-TW': '提示:關', 'zh-CN': '提示:关' },
  'nick.title': { en: 'Choose a nickname', ko: '닉네임을 정해요', ja: 'ニックネームを決めよう', 'zh-TW': '設定暱稱', 'zh-CN': '设定昵称' },
  'nick.rule': { en: '{min}–{max} chars · letters, numbers, Korean', ko: '{min}~{max}자 · 한글·영문·숫자', ja: '{min}~{max}文字 · 英数字・ハングル', 'zh-TW': '{min}~{max}字 · 英文、數字、韓文', 'zh-CN': '{min}~{max}字 · 英文、数字、韩文' },
  'nick.placeholder': { en: 'Nickname', ko: '닉네임', ja: 'ニックネーム', 'zh-TW': '暱稱', 'zh-CN': '昵称' },
  'nick.ok': { en: 'OK', ko: '확인', ja: 'OK', 'zh-TW': '確定', 'zh-CN': '确定' },
  'nick.change': { en: 'Nickname: {n} (change)', ko: '닉네임: {n} (바꾸기)', ja: 'ニックネーム: {n} (変更)', 'zh-TW': '暱稱:{n}(更改)', 'zh-CN': '昵称:{n}(更改)' },
  'nick.set': { en: 'Set nickname', ko: '닉네임 정하기', ja: 'ニックネームを決める', 'zh-TW': '設定暱稱', 'zh-CN': '设定昵称' },
  'nick.err.empty': { en: 'Please enter a nickname', ko: '닉네임을 입력해요', ja: 'ニックネームを入力してね', 'zh-TW': '請輸入暱稱', 'zh-CN': '请输入昵称' },
  'nick.err.length': { en: 'Use {min}–{max} characters', ko: '{min}~{max}자로 해요', ja: '{min}~{max}文字にしてね', 'zh-TW': '請用{min}~{max}字', 'zh-CN': '请用{min}~{max}字' },
  'nick.err.chars': { en: 'Only letters, numbers and Korean', ko: '한글·영문·숫자만 쓸 수 있어요', ja: '英数字・ハングルのみ使えます', 'zh-TW': '只能使用英文、數字、韓文', 'zh-CN': '只能使用英文、数字、韩文' },
  'nick.err.blocked': { en: "This nickname can't be used", ko: '쓸 수 없는 닉네임이에요', ja: 'このニックネームは使えません', 'zh-TW': '無法使用此暱稱', 'zh-CN': '无法使用此昵称' },
  'nick.err.taken': { en: 'Someone already uses this nickname', ko: '이미 누가 쓰고 있어요', ja: 'すでに使われています', 'zh-TW': '已被其他人使用', 'zh-CN': '已被其他人使用' },
  'nick.err.rate': { en: 'Try again in {s}s', ko: '{s}초 뒤에 다시 바꿀 수 있어요', ja: '{s}秒後にもう一度', 'zh-TW': '{s}秒後再試', 'zh-CN': '{s}秒后再试' },
  'nick.err.net': { en: 'Server not reachable, try again', ko: '서버에 연결이 안 돼요. 다시 해 봐요', ja: 'サーバーに接続できません', 'zh-TW': '無法連線伺服器,請再試一次', 'zh-CN': '无法连接服务器,请再试一次' },
  'rank.title': { en: 'Leaderboard · World {w}', ko: '기록판 · 월드 {w}', ja: '記録ボード · ワールド{w}', 'zh-TW': '紀錄榜 · 世界{w}', 'zh-CN': '纪录榜 · 世界{w}' },
  'rank.cols': { en: 'Rebirths · Best · Top DPS', ko: '환생 · 최고 · 최고 DPS', ja: '転生 · 最高 · 最高DPS', 'zh-TW': '轉生 · 最佳 · 最高DPS', 'zh-CN': '转生 · 最佳 · 最高DPS' },
  'rank.mine': { en: 'My rank #{n}', ko: '내 순위 {n}위', ja: '自分の順位 {n}位', 'zh-TW': '我的排名 第{n}名', 'zh-CN': '我的排名 第{n}名' },
  'rank.none': { en: 'Clear a stage to get on the board!', ko: '스테이지를 깨면 기록판에 올라가요!', ja: 'ステージをクリアするとボードに載るよ!', 'zh-TW': '通關一關就能上榜!', 'zh-CN': '通关一关就能上榜!' },
  'rank.empty': { en: 'No records yet', ko: '아직 기록이 없어요', ja: 'まだ記録がありません', 'zh-TW': '還沒有紀錄', 'zh-CN': '还没有纪录' },
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

// 맨 먼저: localStorage가 막힌 iframe에서도 SDK·저장 코드가 죽지 않게 메모리 저장소로 대신함 (지우지 말 것)
import './storageFallback';
import './style.css';
import './ui/ui.css';
import './ui/skin.css';
import { GUN_MODELS, loadAssets } from './assets/loadAssets';
import { DOHYEON_REST_SAMPLE } from './dohyeonRest';
import { GUNS, type GunModel } from './sim/guns.ts';
import { CHAR_IDS, type CharId } from './sim/state.ts';
import { Game } from './core/Game';
import { Stage3D } from './core/Stage3D';
import { MENTOR_CHAR, MentorNpcs } from './world/MentorNpcs';
import { Stations } from './training/Stations';
import { HitFx } from './fx/HitFx';
import { clearLocalSaves, guessStart, pickSave } from './save/localSave';
import { CloudSave } from './platform/CloudSave';
import { NetClient, withTimeout } from './net/NetClient';
import { startLobby } from './net/lobby';
import { LobbyApi } from './net/LobbyApi';
import { NicknamePanel } from './ui/NicknamePanel';
import { RankBoard } from './world/RankBoard';
import { TrainingRange } from './training/TrainingRange';
import { FloatText } from './ui/FloatText';
import { BattleScene } from './battle/BattleScene';
import { PortalZone } from './stage/PortalZone';
import { BattleHud } from './ui/BattleHud';
import { ResultCard } from './ui/ResultCard';
import { ZoneCallout } from './ui/ZoneCallout';
import { loadBricks } from './world/kit';
import { Loading } from './ui/Loading';
import { warmGpu } from './core/warmGpu';
import { Tutorial } from './ui/Tutorial';
import { applyLang, t } from './i18n/i18n';
import { audio } from './audio/audio';
import { SettingsPanel } from './ui/SettingsPanel';
import { UpgradePanel } from './ui/UpgradePanel';
import { GunPanel } from './ui/GunPanel';
import { RebirthPanel } from './ui/RebirthPanel';
import { TravelPanel } from './ui/TravelPanel';
import { DailyPanel } from './ui/DailyPanel';
import { EventBar } from './ui/EventBar';
import { startKeepAwake } from './platform/keepAwake';
import { CharacterPanel } from './ui/CharacterPanel';
import { showOfflineReward } from './ui/OfflinePanel';
import { Premium } from './platform/Premium';
import { ShopPanel } from './ui/ShopPanel';
import { installRetentionConsole } from './net/retentionConsole';
import type { RetentionResult } from './net/shared/retention';

async function boot(): Promise<void> {
  // 시작 구간 시간 (콘솔 한 줄 '[boot] …', 페이지 열린 뒤 ms): 로딩이 길 때 어디서 걸리는지 배포본에서 바로 보려고 (2026-11-13)
  const marks: Array<[string, number]> = [['script', Math.round(performance.now())]];
  const mark = (name: string): void => { marks.push([name, Math.round(performance.now())]); };
  window.addEventListener('load', () => mark('winload'), { once: true });
  // 바깥 페이지(Verse8)에서 물으면 시간만 답함: iframe 안 콘솔은 밖에서 안 보여서 (개인 정보 없음, 숫자만)
  window.addEventListener('message', (e) => {
    if ((e.data as { type?: unknown } | null)?.type !== 'POP_BOOT?') return;
    const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const slow = res.filter((r) => r.responseEnd - r.startTime > 300 || r.encodedBodySize > 150_000)
      .map((r) => [r.name.split('/').pop()!.split('?')[0]!.slice(0, 40), Math.round(r.startTime), Math.round(r.responseEnd), Math.round(r.encodedBodySize / 1024), Math.round(r.transferSize / 1024)]);
    window.parent.postMessage({ type: 'POP_BOOT', marks, slow, count: res.length }, '*');
  });
  const ui = document.getElementById('ui')!;
  const loading = new Loading(ui);
  // 첫 입력(클릭·터치·키)에서 소리를 켬. 광장 음악은 그때부터
  audio.attachUnlock(window);
  audio.setMusic('hub');
  const fontReady = applyLang();
  // 서버 연결은 에셋 받는 동안 같이 (안 되면 기기 저장으로, 혼자 모드). 연결은 계정당 하나: 계정 저장·광장이 net을 함께 씀
  const net = new NetClient();
  const cloud = new CloudSave(net);
  // 연결 → 저장 읽기까지 에셋 받는 동안 같이 (예전엔 에셋을 다 받은 뒤에야 저장을 읽기 시작: 새 컴퓨터 첫 시작이 느렸음).
  // 서버 저장을 읽을 때까지 계속 다시 시도 (2026-11-13: 예전엔 5초 안에 안 되면 알림 없이 기기 저장으로 시작 → 새 컴퓨터는 새 판처럼 보였음).
  // verse가 없는 빌드(?offline=1 등)만 기기 저장으로 바로
  const loadSave = async (): Promise<Awaited<ReturnType<typeof pickSave>>> => {
    if (!net.hasVerse) return pickSave(cloud);
    for (let attempt = 1; ; attempt++) {
      const up = await cloud.connect().catch(() => false);
      mark(up ? `conn${attempt}` : `connFail${attempt}`);
      if (up) {
        const sv = await pickSave(cloud);
        mark(sv.cloudOk ? `load${attempt}` : `loadFail${attempt}`);
        if (sv.cloudOk) { loading.note(null); return sv; }
      }
      loading.note(t('net.retrying', { n: attempt }));
      await new Promise((r) => window.setTimeout(r, Math.min(10_000, 2000 * attempt)));
    }
  };
  const savePick = loadSave();
  void savePick.then(() => mark('save'), () => undefined);
  const stage = new Stage3D(document.getElementById('view') as HTMLCanvasElement);
  // 캐릭터는 내 캐릭터(기기 사본으로 짐작)만 먼저, 나머지는 시작 뒤 뒤에서 (2026-11-13 로딩 줄이기). 개발용 ?allchars=1 = 6종 다
  const all = import.meta.env.DEV && new URLSearchParams(location.search).has('allchars');
  const guess = guessStart();
  const gunModelOf = (i: number): GunModel => (GUNS[i] ?? GUNS[0]!).model;
  const first = all ? { chars: [...CHAR_IDS], guns: [...GUN_MODELS] } : { chars: [guess.char] as CharId[], guns: [gunModelOf(guess.gun)] };
  const [assets, kit] = await Promise.all([
    loadAssets(stage.renderer, first, (p) => loading.set(p * 0.9), savePick.then((sv) => ({ char: sv.state.char, gun: gunModelOf(sv.state.gun) }), () => null)),
    loadBricks(),
  ]);
  mark('assets');
  // 3D 글자 라벨이 언어 글꼴로 구워지도록 글꼴 먼저
  await fontReady;
  mark('font');
  const save = await savePick;
  // retention access log: once per account per UTC day, not awaited
  if (cloud.online) void net.call('actPing').catch(() => undefined);
  // console retention(): server checks admin account, returns counts only
  // 관리자 콘솔 resetPass(): 내 공격력 패스를 ×1로 (서버가 관리자 계정인지 확인), 성공하면 새로고침
  Object.assign(window, {
    resetPass: async () => {
      try {
        const r = await withTimeout(net.call<{ ok: boolean; reason?: string; account?: string }>('adminResetPass', [], 10000), 12000);
        if (!r.ok) { console.warn('[resetPass]', r.reason === 'not_admin' ? `관리자 계정만 (지금 계정 ${r.account ?? '?'})` : r.reason); return r; }
        game.saver.hold = true;
        await cloud.stopWrites();
        location.reload();
        return r;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(msg.includes('Function not found') ? '[resetPass] 서버에 이 함수가 아직 없어요: 서버를 재배포하세요' : `[resetPass] 실패: ${msg}`);
        return null;
      }
    },
  });
  installRetentionConsole(async (view) => {
    if (!(await withTimeout(net.connect(), 10000))) throw new Error('connect');
    return withTimeout(net.call<RetentionResult>('retentionGet', [view], 20000), 25000);
  });
  // 서버 저장 캐릭터가 짐작과 다르면 그것도 받음 (못 받으면 받은 캐릭터로 시작, 받은 뒤 바꿔 입음)
  if (!assets.characters[save.state.char]) await assets.char(save.state.char).catch(() => undefined);
  if (!assets.guns[gunModelOf(save.state.gun)]) await assets.gun(gunModelOf(save.state.gun)).catch(() => undefined);
  // 서버 저장을 실제로 읽었을 때만 서버에 씀 (읽기 실패한 채 쓰면 새 판·옛 사본으로 서버 저장을 덮음)
  // 서버에 연결됐는데 저장을 못 읽은 판은 계정 사본에도 쓰지 않음(손님 키로): 다음 접속 때 '더 새 사본'으로 서버 진행을 덮지 않게
  const saveAccount = save.cloudOk || !cloud.online ? save.account : null;
  // 모바일 화면 꺼짐 방지 (iframe이면 Wake Lock 대신 무음 영상)
  startKeepAwake();
  const game = new Game(stage, assets, kit, save.state, ui, { account: saveAccount, cloud: save.cloudOk ? cloud : null });
  const fx = new HitFx(stage.scene);
  const float = new FloatText(ui, stage.camera);
  const callout = new ZoneCallout(ui);
  const training = new TrainingRange(game, fx, float, callout);
  new Stations(game, float, callout);
  const portal = new PortalZone(game, callout);
  const battle = new BattleScene(game, fx, float, new BattleHud(ui), new ResultCard(ui), callout);
  // 포털 착지 → 잠깐 보여 주고 전투로 (그 사이 걸어 나가면 취소)
  // 착지 뒤에도 이동 잠금(LAND_LOCK 0.35초) + 입력 한 번 놓기가 있어 700ms면 걸어 나갈 틈이 없음 → 1.2초
  portal.onEnterRun = () => window.setTimeout(() => {
    if (!portal.inside || battle.active) return;
    portal.release();
    battle.start(game.world);
  }, 1200);
  // 광장 배경음 = 지금 월드 곡 (월드 이동 때 바뀜)
  audio.setWorld(game.world);
  game.onWorldChange((w) => audio.setWorld(w));
  // 멘토는 캐릭터 넷(MOCHI·POPI·ROKO·SHONI)을 받은 뒤에 (시작 때는 내 캐릭터만 받음)
  void Promise.all(Object.values(MENTOR_CHAR).map((c) => assets.char(c))).then(() => new MentorNpcs(game)).catch(() => undefined);
  new TravelPanel(game, ui, callout);
  new UpgradePanel(game, ui, callout, float);
  new GunPanel(game, ui, callout, float);
  const rebirthPanel = new RebirthPanel(game, ui, callout, float);
  new CharacterPanel(game, ui, callout);
  const guide = new Tutorial(game, ui);
  const lobbyApi = net.hasVerse ? new LobbyApi(net) : null;
  const nickPanel = lobbyApi ? new NicknamePanel(ui, net, lobbyApi) : null;
  // 광장 3D 기록판 (북동쪽, 남쪽=카메라 쪽을 봄). 내 저장 뒤 조금 있다가 갱신
  // 기록판: 포털 오른쪽 옆 (시작 지점에서 포털을 보면 같이 보임, 2026-11-13 북동쪽 구석에서 옮김)
  const board = new RankBoard(6.8, -14.2, lobbyApi);
  game.hub.root.add(board.root);
  game.hub.colliders.push(board.collider);
  cloud.onSaved.add(() => board.refreshSoon());
  // 서버가 정한 값(프리미엄·잘린 코인·거절 시 서버 저장)으로 맞춤
  cloud.onServerState.add((r) => game.adoptServer(r));
  // 광장 구조물이 다 생긴 뒤: 카메라를 가리면 반투명이 될 대상 등록
  game.occlusion.register(game.hub.root);
  // 계정 초기화: 저장 멈춤 → 서버 새 판 + 기록판 줄 지움 → 기기 사본 지움 → 새로고침 (서버가 없으면 기기 사본만)
  const resetAccount = async (): Promise<boolean> => {
    game.saver.hold = true;
    if (cloud.online) {
      await cloud.stopWrites();
      try {
        const r = await withTimeout(net.call<{ ok: boolean }>('saveReset', [], 10000), 12000);
        if (!r?.ok) { cloud.resumeWrites(); game.saver.hold = false; return false; }
      } catch {
        cloud.resumeWrites();
        game.saver.hold = false;
        return false;
      }
    }
    clearLocalSaves(save.account);
    location.reload();
    return true;
  };
  const settings = new SettingsPanel(ui, guide, nickPanel, resetAccount);
  game.menuActions.settings = () => settings.open();
  // 처음 보이는 순간의 텍스처 올리기·셰이더 만들기 끊김을 로딩 중에 미리 (다른 사람이 쓸 캐릭터·총 원본까지)
  mark('built');
  warmGpu(stage.renderer, stage.scene, stage.camera, [...Object.values(assets.characters).map((c) => c.scene), ...Object.values(assets.guns)]);
  mark('warm');
  stage.start();
  loading.done();
  console.log(`[boot] ${marks.map(([n, t]) => `${n} ${t}`).join(' · ')} ms`);
  // 나머지 총·캐릭터(다른 사람·멘토·캐릭터 창)는 화면이 뜬 뒤 하나씩, 글꼴 나머지 한글(닉네임용: rest 파일에만 있는 글자로 받게 함)
  window.setTimeout(() => {
    assets.loadRest();
    void document.fonts.load("16px 'Do Hyeon'", DOHYEON_REST_SAMPLE).catch(() => undefined);
  }, 1500);
  // 고른 저장을 서버·기기에 맞춤 (오프라인 때 한 진행 올리기, 첫 접속 손님 진행 가져오기).
  // 오프라인 보상 창이 떠 있으면 [받기] 때 저장 (먼저 저장하면 lastSeen이 갱신돼 받기 전에 페이지를 닫으면 보상이 사라짐)
  // 프리미엄 (광고·결제): 서버 값 받아 두기 (서버 없으면 버튼 없음)
  const prem = new Premium(game, save.cloudOk ? net : null);
  void prem.refresh();
  rebirthPanel.prem = prem;
  const shop = new ShopPanel(game, ui, prem);
  // 팝젬 칸 [+] → 상점 팝젬 탭
  game.menuActions.shop = () => shop.open('gems');
  // 출석 창 + 오른쪽 이벤트 버튼 (선물·골드 2배·패스·팝젬·새 캐릭터)
  const daily = new DailyPanel(game, ui, prem, () => !nickPanel || nickPanel.settled);
  new EventBar(game, ui, prem, shop, daily, rebirthPanel);
  if (!showOfflineReward(game, ui, save.now, prem)) game.saver.saveNow();
  // 광장 멀티 (서버에 연결됐을 때만, 실패해도 혼자 게임은 그대로)
  const lobby = startLobby(game, net, cloud, training);
  // 첫 접속이면 닉네임 정하기: 화면이 뜨자마자 바로 확인 (게임 화면은 뒤에서 계속 그려짐). 오늘의 선물은 닉네임을 정한 뒤에 뜸
  // (예전엔 1.5초 뒤에 확인해서 선물 창이 먼저 떴음, 사용자 2026-11-13)
  if (nickPanel) void nickPanel.checkOnConnect();
  if (import.meta.env.DEV) Object.assign(window, { __hub: lobby });
  if (import.meta.env.DEV) {
    // 개발용 단축 (콘솔): __dev.fire(30) = 초당 30발, __dev.atk(1e6) = 공격 훈련치, __dev.gold(1e9) = 골드 (?offline=1과 같이 쓰면 서버가 되돌리지 않음)
    Object.assign(window, {
      __dev: {
        fire: (n: number) => game.setState({ ...game.state, trSpd: Math.max(0, (n - 1) * 100) }, true),
        atk: (v: number) => game.setState({ ...game.state, trAtk: v }, true),
        gold: (v: number) => game.setState({ ...game.state, coins: v }, true),
      },
    });
  }
  if (import.meta.env.DEV) Object.assign(window, { __game: game, __training: training, __portal: portal, __battle: battle, __cloud: cloud, __net: net, __audio: audio, __prem: prem, __daily: daily });
}

boot().catch((e) => {
  document.getElementById('ui')!.textContent = String(e);
  console.error(e);
});

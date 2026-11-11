// 맨 먼저: localStorage가 막힌 iframe에서도 SDK·저장 코드가 죽지 않게 메모리 저장소로 대신함 (지우지 말 것)
import './storageFallback';
import './style.css';
import './ui/ui.css';
import { loadAssets } from './assets/loadAssets';
import { Game } from './core/Game';
import { Stage3D } from './core/Stage3D';
import { HitFx } from './fx/HitFx';
import { pickSave } from './save/localSave';
import { CloudSave } from './platform/CloudSave';
import { NetClient } from './net/NetClient';
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
import { Tutorial } from './ui/Tutorial';
import { applyLang } from './i18n/i18n';
import { audio } from './audio/audio';
import { SettingsPanel } from './ui/SettingsPanel';
import { UpgradePanel } from './ui/UpgradePanel';
import { GunPanel } from './ui/GunPanel';
import { RebirthPanel } from './ui/RebirthPanel';
import { CharacterPanel } from './ui/CharacterPanel';
import { showOfflineReward } from './ui/OfflinePanel';

async function boot(): Promise<void> {
  const ui = document.getElementById('ui')!;
  const loading = new Loading(ui);
  // 첫 입력(클릭·터치·키)에서 소리를 켬. 광장 음악은 그때부터
  audio.attachUnlock(window);
  audio.setMusic('hub');
  const fontReady = applyLang();
  // 서버 연결은 에셋 받는 동안 같이 (안 되면 기기 저장으로, 혼자 모드). 연결은 계정당 하나: 계정 저장·광장이 net을 함께 씀
  const net = new NetClient();
  const cloud = new CloudSave(net);
  const cloudReady = cloud.connect();
  const stage = new Stage3D(document.getElementById('view') as HTMLCanvasElement);
  const [assets, kit] = await Promise.all([loadAssets(stage.renderer, (p) => loading.set(p * 0.9)), loadBricks()]);
  // 3D 글자 라벨이 언어 글꼴로 구워지도록 글꼴 먼저
  await fontReady;
  await cloudReady;
  const save = await pickSave(cloud);
  // 서버 저장을 실제로 읽었을 때만 서버에 씀 (읽기 실패한 채 쓰면 새 판·옛 사본으로 서버 저장을 덮음)
  // 서버에 연결됐는데 저장을 못 읽은 판은 계정 사본에도 쓰지 않음(손님 키로): 다음 접속 때 '더 새 사본'으로 서버 진행을 덮지 않게
  const saveAccount = save.cloudOk || !cloud.online ? save.account : null;
  const game = new Game(stage, assets, kit, save.state, ui, { account: saveAccount, cloud: save.cloudOk ? cloud : null });
  const fx = new HitFx(stage.scene);
  const float = new FloatText(ui, stage.camera);
  const callout = new ZoneCallout(ui);
  const training = new TrainingRange(game, fx, float, callout);
  const portal = new PortalZone(game, callout);
  const battle = new BattleScene(game, fx, float, new BattleHud(ui), new ResultCard(ui), callout);
  // 포털 착지 → 잠깐 보여 주고 전투로 (그 사이 걸어 나가면 취소)
  // 착지 뒤에도 이동 잠금(LAND_LOCK 0.35초) + 입력 한 번 놓기가 있어 700ms면 걸어 나갈 틈이 없음 → 1.2초
  portal.onEnterRun = () => window.setTimeout(() => {
    if (!portal.inside || battle.active) return;
    portal.release();
    battle.start(1);
  }, 1200);
  new UpgradePanel(game, ui, callout, float);
  new GunPanel(game, ui, callout, float);
  new RebirthPanel(game, ui, callout, float);
  new CharacterPanel(game, ui, callout);
  const guide = new Tutorial(game, ui);
  const lobbyApi = net.hasVerse ? new LobbyApi(net) : null;
  const nickPanel = lobbyApi ? new NicknamePanel(ui, net, lobbyApi) : null;
  // 광장 3D 기록판 (북동쪽, 남쪽=카메라 쪽을 봄). 내 저장 뒤 조금 있다가 갱신
  const board = new RankBoard(8.5, -12.6, lobbyApi);
  game.hub.root.add(board.root);
  game.hub.colliders.push(board.collider);
  cloud.onSaved.add(() => board.refreshSoon());
  // 광장 구조물이 다 생긴 뒤: 카메라를 가리면 반투명이 될 대상 등록
  game.occlusion.register(game.hub.root);
  const settings = new SettingsPanel(ui, guide, nickPanel);
  game.menuActions.settings = () => settings.open();
  stage.start();
  loading.done();
  // 고른 저장을 서버·기기에 맞춤 (오프라인 때 한 진행 올리기, 첫 접속 손님 진행 가져오기).
  // 오프라인 보상 창이 떠 있으면 [받기] 때 저장 (먼저 저장하면 lastSeen이 갱신돼 받기 전에 페이지를 닫으면 보상이 사라짐)
  if (!showOfflineReward(game, ui, save.now)) game.saver.saveNow();
  // 광장 멀티 (서버에 연결됐을 때만, 실패해도 혼자 게임은 그대로)
  const lobby = startLobby(game, net, cloud, training);
  // 첫 접속이면 닉네임 정하기 (서버 연결 뒤, 오프라인 보상 창과 겹치지 않게 조금 뒤)
  if (nickPanel) window.setTimeout(() => void nickPanel.checkOnConnect(), 1500);
  if (import.meta.env.DEV) Object.assign(window, { __hub: lobby });
  if (import.meta.env.DEV) Object.assign(window, { __game: game, __training: training, __portal: portal, __battle: battle, __cloud: cloud, __net: net, __audio: audio });
}

boot().catch((e) => {
  document.getElementById('ui')!.textContent = String(e);
  console.error(e);
});

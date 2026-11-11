import './style.css';
import './ui/ui.css';
import { loadAssets } from './assets/loadAssets';
import { Game } from './core/Game';
import { Stage3D } from './core/Stage3D';
import { HitFx } from './fx/HitFx';
import { loadSave } from './save/localSave';
import { TrainingRange } from './training/TrainingRange';
import { FloatText } from './ui/FloatText';
import { BattleScene } from './battle/BattleScene';
import { PortalZone } from './stage/PortalZone';
import { BattleHud } from './ui/BattleHud';
import { ResultCard } from './ui/ResultCard';
import { ZoneCallout } from './ui/ZoneCallout';
import { loadBricks } from './world/kit';
import { applyLang } from './i18n/i18n';
import { SettingsPanel } from './ui/SettingsPanel';
import { UpgradePanel } from './ui/UpgradePanel';
import { GunPanel } from './ui/GunPanel';
import { RebirthPanel } from './ui/RebirthPanel';
import { CharacterPanel } from './ui/CharacterPanel';
import { showOfflineReward } from './ui/OfflinePanel';

async function boot(): Promise<void> {
  const ui = document.getElementById('ui')!;
  const fontReady = applyLang();
  const stage = new Stage3D(document.getElementById('view') as HTMLCanvasElement);
  const [assets, kit] = await Promise.all([loadAssets(stage.renderer), loadBricks()]);
  // 3D 글자 라벨이 언어 글꼴로 구워지도록 글꼴 먼저
  await fontReady;
  const game = new Game(stage, assets, kit, loadSave(Date.now()), ui);
  const fx = new HitFx(stage.scene);
  const float = new FloatText(ui, stage.camera);
  const callout = new ZoneCallout(ui);
  const training = new TrainingRange(game, fx, float, callout);
  const portal = new PortalZone(game, callout);
  const battle = new BattleScene(game, fx, float, new BattleHud(ui), new ResultCard(ui), callout);
  // 포털 착지 → 잠깐 보여 주고 전투로 (그 사이 걸어 나가면 취소)
  portal.onEnterRun = () => window.setTimeout(() => {
    if (!portal.inside || battle.active) return;
    portal.release();
    battle.start(1);
  }, 700);
  new UpgradePanel(game, ui, callout, float);
  new GunPanel(game, ui, callout, float);
  new RebirthPanel(game, ui, callout, float);
  new CharacterPanel(game, ui, callout);
  const settings = new SettingsPanel(ui);
  game.menuActions.settings = () => settings.open();
  stage.start();
  showOfflineReward(game, ui, Date.now());
  if (import.meta.env.DEV) Object.assign(window, { __game: game, __training: training, __portal: portal, __battle: battle });
}

boot().catch((e) => {
  document.getElementById('ui')!.textContent = String(e);
  console.error(e);
});

import './style.css';
import './ui/ui.css';
import { loadAssets } from './assets/loadAssets';
import { Game } from './core/Game';
import { Stage3D } from './core/Stage3D';
import { HitFx } from './fx/HitFx';
import { loadSave } from './save/localSave';
import { TrainingRange } from './training/TrainingRange';
import { FloatText } from './ui/FloatText';
import { loadBricks } from './world/kit';

async function boot(): Promise<void> {
  const ui = document.getElementById('ui')!;
  const stage = new Stage3D(document.getElementById('view') as HTMLCanvasElement);
  const [assets, kit] = await Promise.all([loadAssets(stage.renderer), loadBricks()]);
  const game = new Game(stage, assets, kit, loadSave(Date.now()), ui);
  const fx = new HitFx(stage.scene);
  const float = new FloatText(ui, stage.camera);
  const training = new TrainingRange(game, fx, float);
  stage.start();
  if (import.meta.env.DEV) Object.assign(window, { __game: game, __training: training });
}

boot().catch((e) => {
  document.getElementById('ui')!.textContent = String(e);
  console.error(e);
});

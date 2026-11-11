import * as THREE from 'three';
import './style.css';
import { loadAssets } from './assets/loadAssets';
import { Stage3D } from './core/Stage3D';
import { Avatar } from './player/Avatar';
import { GUNS } from './sim/guns.ts';

async function boot(): Promise<void> {
  const stage = new Stage3D(document.getElementById('view') as HTMLCanvasElement);
  const assets = await loadAssets(stage.renderer);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(20, 48), new THREE.MeshStandardMaterial({ color: '#9ad48f' }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  stage.scene.add(ground);
  const avatar = new Avatar(assets, 'blue', GUNS[0]!);
  stage.scene.add(avatar.root);
  const aim = new THREE.Vector3(0, 1, 6);
  const pose = { pos: new THREE.Vector3(), yaw: 0, velocity: new THREE.Vector3(), aimAt: aim, kick: 0 };
  stage.camera.position.set(3, 2.2, 4);
  stage.camera.lookAt(0, 0.9, 0);
  stage.onFrame((dt) => avatar.update(dt, pose));
  stage.start();
  if (import.meta.env.DEV) Object.assign(window, { __avatar: avatar, __guns: GUNS });
}

boot().catch((e) => {
  document.getElementById('ui')!.textContent = String(e);
  console.error(e);
});

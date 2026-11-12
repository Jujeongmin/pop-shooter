import * as THREE from 'three';
import { CHARACTER } from '../config/gameConfig';
import { rotateBoneToward, setWorldQuaternion } from './ik';

/**
 * 만세 자세 (팝배틀 result/ResultStage.ts victoryPose '만세'를 옮김, 사용자 2026-11-12: 동전 분수·포털 클리어).
 * 애니메이션·IK가 끝난 뒤 본 회전을 덮어씀: 두 팔 V자로 번쩍 + 가슴 펴기 + 손목 곧게.
 * w = 0..1 (자세 섞는 정도). 치비 비율(큰 머리·짧은 팔)이라 팔은 머리 밖으로 벌려야 보임.
 */

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _h = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _out = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _dir2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qa = new THREE.Quaternion();
const _bm = new THREE.Matrix4();
const _bp = new THREE.Vector3();
const _bs = new THREE.Vector3();
/** 손 본의 부모 기준 바인드 회전 (본마다 한 번 계산) */
const bindLocal = new WeakMap<THREE.Object3D, THREE.Quaternion>();

interface Bones {
  spine: THREE.Bone; chest: THREE.Bone;
  upperArmL: THREE.Bone; lowerArmL: THREE.Bone; handL: THREE.Bone;
  upperArmR: THREE.Bone; lowerArmR: THREE.Bone; handR: THREE.Bone;
}

/** 캐릭터 root에서 본 찾기 (없으면 null) */
export function cheerBones(root: THREE.Object3D): Bones | null {
  const B = CHARACTER.bones;
  const get = (n: string): THREE.Bone | null => (root.getObjectByName(n) as THREE.Bone | undefined) ?? null;
  const b = {
    spine: get(B.spine), chest: get(B.chest),
    upperArmL: get(B.upperArmL), lowerArmL: get(B.lowerArmL), handL: get(B.handL),
    upperArmR: get(B.upperArmR), lowerArmR: get(B.lowerArmR), handR: get(B.handR),
  };
  return Object.values(b).every(Boolean) ? (b as Bones) : null;
}

function bend(bone: THREE.Bone, axis: THREE.Vector3, angle: number): void {
  if (Math.abs(angle) < 1e-5) return;
  bone.getWorldQuaternion(_q);
  _q.premultiply(_qa.setFromAxisAngle(axis, angle));
  setWorldQuaternion(bone, _q);
}

function straightenHand(root: THREE.Object3D, hand: THREE.Bone, w: number): void {
  let q = bindLocal.get(hand);
  if (!q) {
    let skel: THREE.Skeleton | null = null;
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!skel && m.isSkinnedMesh && m.skeleton.bones.includes(hand)) skel = m.skeleton;
    });
    const sk = skel as THREE.Skeleton | null;
    const i = sk ? sk.bones.indexOf(hand) : -1;
    const pi = sk && hand.parent ? sk.bones.indexOf(hand.parent as THREE.Bone) : -1;
    if (!sk || i < 0 || pi < 0) return;
    _bm.copy(sk.boneInverses[i]!).invert().premultiply(sk.boneInverses[pi]!);
    q = new THREE.Quaternion();
    _bm.decompose(_bp, q, _bs);
    bindLocal.set(hand, q);
  }
  hand.quaternion.slerp(q, Math.min(1, w));
}

function arm(root: THREE.Object3D, b: Bones, side: 'L' | 'R', upper: readonly [number, number, number], lower: readonly [number, number, number], w: number): void {
  const ua = side === 'L' ? b.upperArmL : b.upperArmR;
  const la = side === 'L' ? b.lowerArmL : b.lowerArmR;
  const hand = side === 'L' ? b.handL : b.handR;
  ua.getWorldPosition(_a);
  b.chest.getWorldPosition(_b);
  _out.subVectors(_a, _b).setY(0);
  if (_out.lengthSq() < 1e-8) _out.set(side === 'L' ? 1 : -1, 0, 0);
  _out.normalize();
  _dir.copy(_out).multiplyScalar(upper[0]).addScaledVector(UP, upper[1]).addScaledVector(_fwd, upper[2]).normalize();
  _dir2.copy(_out).multiplyScalar(lower[0]).addScaledVector(UP, lower[1]).addScaledVector(_fwd, lower[2]).normalize();
  ua.getWorldPosition(_a);
  la.getWorldPosition(_b);
  rotateBoneToward(ua, _a, _b, _c.copy(_a).add(_dir), w);
  la.getWorldPosition(_b);
  hand.getWorldPosition(_h);
  rotateBoneToward(la, _b, _h, _c.copy(_b).add(_dir2), w);
  straightenHand(root, hand, w);
}

/** 만세 자세 덮어쓰기 (yaw = 몸 방향, clock = 숨쉬기용 시간) */
export function applyCheer(root: THREE.Object3D, b: Bones, yaw: number, w: number, clock: number): void {
  if (w <= 0) return;
  _fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
  _axis.crossVectors(UP, _fwd).normalize();
  root.updateMatrixWorld(true);
  const breath = Math.sin(clock * 2.1) * 0.012;
  bend(b.spine, _axis, (-0.12 + breath) * w);
  arm(root, b, 'L', [0.95, 1, 0.3], [0.55, 1, 0.3], w);
  arm(root, b, 'R', [0.95, 1, 0.3], [0.55, 1, 0.3], w);
}

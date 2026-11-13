"""캐릭터 LOD 형상 만들기 (뼈 있는 캐릭터 GLB → 삼각형을 줄인 스킨 메시만 담은 GLB).

사용:
  blender -b --factory-startup -P tools/blender/char_lod.py -- <input.glb> <output.glb> --tris 2200

- 게임은 이 파일에서 메시 형상(위치·노멀·UV·뼈 번호·가중치)만 가져와, 원본 캐릭터의 뼈대·재질에 붙여 씀 (src/player/charLod.ts).
  그래서 텍스처·애니메이션은 넣지 않음 (파일이 작음). 뼈 번호는 런타임이 뼈 이름으로 다시 맞춤 (내보내며 순서가 바뀌어도 됨).
- Decimate(Collapse)로 줄임: UV·정점 그룹(스킨 가중치)이 유지됨. 축·크기·원점은 바꾸지 않음.
- 2026-11-13: 광장의 다른 사람·멘토가 멀리 있을 때 쓰는 용 (원본 약 7,600 삼각형).
"""
import argparse
import sys

import bpy


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("input")
    p.add_argument("output")
    p.add_argument("--tris", type=int, default=2200)
    return p.parse_args(argv)


def tri_count(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def main():
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=args.input)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in meshes:
        before = tri_count(o)
        if before <= args.tris:
            continue
        mod = o.modifiers.new('lod', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = args.tris / before
        mod.use_collapse_triangulate = True
        # 스킨(Armature) 모디파이어보다 먼저 적용되도록 맨 앞으로
        bpy.context.view_layer.objects.active = o
        while o.modifiers[0].name != 'lod':
            bpy.ops.object.modifier_move_up(modifier='lod')
        bpy.ops.object.modifier_apply(modifier='lod')
        print('LOD', o.name, before, '->', tri_count(o))
    bpy.ops.export_scene.gltf(
        filepath=args.output,
        export_format='GLB',
        export_image_format='NONE',
        export_animations=False,
        export_skins=True,
        export_morph=False,
        export_materials='PLACEHOLDER',
        export_texcoords=True,
        export_normals=True,
        export_apply=False,
        export_yup=True,
    )


main()

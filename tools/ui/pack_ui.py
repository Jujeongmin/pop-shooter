"""HUD 아이콘 20개 + 캐릭터 초상 6장을 파일 하나(public/ui/ui.pack)로 묶음.

2026-11-13: Verse8 배포 서버는 파일마다 응답이 1~3초 늦어서, 아이콘을 하나씩 받으면 첫 화면에서 20초 넘게 비어 있었음
→ 한 번에 받아 게임 시작 전에 준비 (src/ui/uiPack.ts 가 읽음). 낱개 파일은 그대로 둠 (묶음을 못 받았을 때 대신 씀).

형식: [4바이트 헤더 길이 LE][헤더 JSON {"icons/coin": [시작, 길이], ...}][WebP 바이트들]
아이콘은 96px로 줄여 다시 저장 (화면에서 최대 54px, 2배 화면까지 충분). 초상은 그대로.
사용: python tools/ui/pack_ui.py   (아이콘·초상 그림을 바꾸면 다시 실행)
"""
import glob
import io
import json
import os
import struct

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ICON_PX = 96


def main():
    items = []
    for path in sorted(glob.glob(os.path.join(ROOT, 'public', 'ui', 'icons', '*.webp'))):
        im = Image.open(path).convert('RGBA')
        im.thumbnail((ICON_PX, ICON_PX), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=86, method=6)
        items.append(('icons/' + os.path.splitext(os.path.basename(path))[0], buf.getvalue()))
    for path in sorted(glob.glob(os.path.join(ROOT, 'public', 'ui', 'chars', '*.webp'))):
        items.append(('chars/' + os.path.splitext(os.path.basename(path))[0], open(path, 'rb').read()))
    header = {}
    off = 0
    for key, data in items:
        header[key] = [off, len(data)]
        off += len(data)
    hj = json.dumps(header, separators=(',', ':')).encode('utf-8')
    out = os.path.join(ROOT, 'public', 'ui', 'ui.pack')
    with open(out, 'wb') as f:
        f.write(struct.pack('<I', len(hj)))
        f.write(hj)
        for _, data in items:
            f.write(data)
    print('%d images, %d bytes -> %s' % (len(items), os.path.getsize(out), out))


main()

"""Codex로 만든 아이콘 원본(art-src/ui-icons/icon_<id>.png, 1024px 투명)을 게임용 128px webp로 (public/ui/icons/<id>.webp).
투명 여백을 잘라 정사각형 가운데에 맞춤 (아이콘마다 크기가 달라 보이지 않게). 실행: python tools/ui/icons_to_webp.py"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'art-src', 'ui-icons')
DST = os.path.join(ROOT, 'public', 'ui', 'icons')
SIZE = 128
PAD = 0.04

os.makedirs(DST, exist_ok=True)
for f in sorted(os.listdir(SRC)):
    if not (f.startswith('icon_') and f.endswith('.png')):
        continue
    im = Image.open(os.path.join(SRC, f)).convert('RGBA')
    box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if box:
        im = im.crop(box)
    side = int(max(im.size) * (1 + PAD * 2))
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.size[0]) // 2, (side - im.size[1]) // 2))
    out = sq.resize((SIZE, SIZE), Image.LANCZOS)
    name = f[len('icon_'):-len('.png')]
    path = os.path.join(DST, name + '.webp')
    out.save(path, 'WEBP', quality=90, method=6)
    print(name, os.path.getsize(path))

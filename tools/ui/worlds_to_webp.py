"""월드 썸네일 원본(art-src/world-icons/world_<n>.png, Codex 1024px)을 게임용 160px webp로 (public/ui/worlds/world_<n>.webp).
실행: python tools/ui/worlds_to_webp.py"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'art-src', 'world-icons')
DST = os.path.join(ROOT, 'public', 'ui', 'worlds')
SIZE = 160

os.makedirs(DST, exist_ok=True)
for f in sorted(os.listdir(SRC)):
    if not (f.startswith('world_') and f.endswith('.png')):
        continue
    im = Image.open(os.path.join(SRC, f)).convert('RGB')
    s = min(im.size)
    im = im.crop(((im.size[0] - s) // 2, (im.size[1] - s) // 2, (im.size[0] + s) // 2, (im.size[1] + s) // 2))
    out = im.resize((SIZE, SIZE), Image.LANCZOS)
    path = os.path.join(DST, f[:-4] + '.webp')
    out.save(path, 'WEBP', quality=85, method=6)
    print(f, os.path.getsize(path))

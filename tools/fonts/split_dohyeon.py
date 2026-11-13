"""Do Hyeon 글꼴을 두 파일로 나눔 (2026-11-13 첫 방문 로딩: 한 파일 200KB → 처음엔 core만).

  core = 한글 음절이 아닌 글자 전부(영문·숫자·기호) + 게임 소스의 문자열에 나오는 한글 음절
  rest = 나머지 한글 음절 (닉네임 등에서 처음 쓰일 때 브라우저가 받음, 게임은 시작 뒤 뒤에서 미리 받음)

사용: python tools/fonts/split_dohyeon.py
  입력 art-src/fonts/DoHyeon-Regular.woff2 (패치된 원본) → public/fonts/DoHyeon-core.woff2, DoHyeon-rest.woff2, src/dohyeon.css, src/dohyeonRest.ts
소스 문구를 많이 바꿨으면 다시 실행 (안 해도 글자는 맞게 나옴: 시작할 때 쓰는 글자를 다 받을 때까지 기다리므로 rest를 더 받을 뿐).
"""
import glob
import io
import os
import re

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'art-src', 'fonts', 'DoHyeon-Regular.woff2')


def is_syllable(cp):
    return 0xAC00 <= cp <= 0xD7A3


def source_hangul():
    """src/**/*.ts 의 주석을 뺀 본문에 나오는 한글 음절 (문구 표·코드에 박힌 이름)"""
    out = set()
    for path in glob.glob(os.path.join(ROOT, 'src', '**', '*.ts'), recursive=True) + [os.path.join(ROOT, 'index.html')]:
        text = io.open(path, encoding='utf-8').read()
        text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
        text = re.sub(r'(^|[^:\'"`])//[^\n]*', r'\1', text)
        out.update(ord(ch) for ch in text if is_syllable(ord(ch)))
    return out


def ranges(cps):
    cps = sorted(cps)
    parts = []
    i = 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1:
            j += 1
        parts.append('U+%X' % cps[i] if i == j else 'U+%X-%X' % (cps[i], cps[j]))
        i = j + 1
    return ', '.join(parts)


def make(cps, name):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    font = TTFont(SRC)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=cps)
    sub.subset(font)
    out = os.path.join(ROOT, 'public', 'fonts', name)
    font.flavor = 'woff2'
    font.save(out)
    return os.path.getsize(out)


def main():
    cmap = set(TTFont(SRC).getBestCmap().keys())
    used = source_hangul() & cmap
    core = {cp for cp in cmap if not is_syllable(cp)} | used
    rest = cmap - core
    a = make(core, 'DoHyeon-core.woff2')
    b = make(rest, 'DoHyeon-rest.woff2')
    css = """/* tools/fonts/split_dohyeon.py 가 만든 파일 (직접 고치지 말 것). Do Hyeon (OFL, public/fonts/DoHyeon-OFL.txt)을 둘로 나눔:
   core = 영문·숫자·기호 + 게임 문구의 한글 %d자, rest = 나머지 한글 %d자. 뒤에 적은 core가 겹치는 글자에서 이김 */
@font-face {
  font-family: 'Do Hyeon';
  src: url('/fonts/DoHyeon-rest.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: block;
  unicode-range: %s;
}
@font-face {
  font-family: 'Do Hyeon';
  src: url('/fonts/DoHyeon-core.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: block;
  unicode-range: %s;
}
""" % (len(used), len(rest), ranges(rest), ranges(core))
    io.open(os.path.join(ROOT, 'src', 'dohyeon.css'), 'w', encoding='utf-8', newline='').write(css)
    ts = """// tools/fonts/split_dohyeon.py 가 만든 파일 (직접 고치지 말 것)
/** rest 글꼴 파일에만 있는 글자 하나: 시작 뒤 이 글자로 rest를 미리 받게 함 */
export const DOHYEON_REST_SAMPLE = '%s';
""" % chr(min(rest))
    io.open(os.path.join(ROOT, 'src', 'dohyeonRest.ts'), 'w', encoding='utf-8', newline='').write(ts)
    print('core %d glyph codes %d bytes, rest %d codes %d bytes (source hangul %d)' % (len(core), a, len(rest), b, len(used)))


main()

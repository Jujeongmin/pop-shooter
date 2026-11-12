"""효과음 원본(art-src/sfx/<id>_pixabay-<n>.mp3, Pixabay)을 게임용으로 (public/assets/audio/sfx/<id>.mp3).
앞 무음 자르기(또는 지정 구간) + 길이 제한 + 끝 페이드 + 최고점 -1 dBFS로 맞춤 + 모노 96kbps.
실행: python tools/audio/sfx_to_game.py   (ffmpeg 필요)"""
import glob
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'art-src', 'sfx')
DST = os.path.join(ROOT, 'public', 'assets', 'audio', 'sfx')

# id: (시작 초 또는 None = 앞 무음 자동 제거, 최대 길이 초, 끝 페이드 초)
CUT = {
    'coin': (None, 0.65, 0.08),
    'zoneLand': (None, 0.6, 0.1),
    'upgrade': (None, 1.6, 0.3),
    'gunBuy': (None, 1.1, 0.15),
    'rebirth': (None, 2.6, 0.5),
    'bossThrow': (None, 0.7, 0.15),
    'playerHit': (None, 0.8, 0.2),
    'win': (None, 3.8, 0.5),
    'lose': (None, 2.2, 0.3),
    'uiTick': (0.0, 0.28, 0.05),   # 5초 파일 안 첫 클릭만
    'step': (1.30, 0.25, 0.05),    # 46초 걷기 중 첫 발자국만
    'travel': (None, 1.8, 0.4),
    'cheer': (None, 2.5, 0.3),
}


def peak_db(path: str) -> float:
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.search(r'max_volume: (-?[\d.]+) dB', out)
    return float(m.group(1)) if m else 0.0


os.makedirs(DST, exist_ok=True)
for f in sorted(glob.glob(os.path.join(SRC, '*_pixabay-*.mp3'))):
    sid = os.path.basename(f).split('_pixabay-')[0]
    if sid not in CUT:
        continue
    start, dur, fade = CUT[sid]
    tmp = os.path.join(DST, f'_{sid}.wav')
    chain = []
    if start is None:
        chain.append('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.005')
    else:
        chain.append(f'atrim=start={start}')
        chain.append('asetpts=PTS-STARTPTS')
    chain.append(f'atrim=end={dur}')
    chain.append(f'afade=t=out:st={max(0.0, dur - fade)}:d={fade}')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', f, '-af', ','.join(chain), '-ac', '1', '-ar', '44100', tmp], check=True)
    gain = -1.0 - peak_db(tmp)
    out = os.path.join(DST, f'{sid}.mp3')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-af', f'volume={gain:.2f}dB', '-b:a', '96k', out], check=True)
    os.remove(tmp)
    print(sid, os.path.getsize(out))

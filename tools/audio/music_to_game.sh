#!/usr/bin/env bash
# 배경음 원본(art-src/music/<id>_*.mp3, Pixabay)을 게임용으로: 음량 맞춤(-16 LUFS) + 96kbps 스테레오 mp3 → public/assets/audio/music/<id>.mp3
# 실행: bash tools/audio/music_to_game.sh
cd "$(dirname "$0")/../.."
for f in art-src/music/*.mp3; do
  id="$(basename "$f" | cut -d_ -f1)"
  ffmpeg -hide_banner -loglevel error -y -i "$f" -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 44100 -ac 2 -b:a 96k "public/assets/audio/music/${id}.mp3"
  echo "$id $(wc -c < "public/assets/audio/music/${id}.mp3")"
done

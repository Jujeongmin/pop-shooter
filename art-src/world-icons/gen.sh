#!/usr/bin/env bash
# 월드 이동 창 썸네일 8장 (Codex 이미지 생성). 실행: bash art-src/world-icons/gen.sh
cd "$(dirname "$0")"
BASE="Square game UI thumbnail for a cute pastel toy shooter's world select list. Style: glossy 3D plastic toy diorama, soft rounded shapes, bright cheerful colors, soft lighting, thick dark navy (#2b3a67) outline on shapes, no characters, no text, no letters, no numbers. Fill the whole square edge to edge (no transparent background, no border). Generate a 1024x1024 PNG and save it in the current directory as"
gen() {
  [ -f "world_$1.png" ] && return
  codex exec --skip-git-repo-check -s workspace-write "$BASE world_$1.png. Subject: $2" < /dev/null > "codex_$1.log" 2>&1
}
gen 1 "a tiny toy town: colorful toy-brick houses with roofs, round green trees, a clock tower, blue sky." &
gen 2 "a toy block construction site: yellow toy crane, orange traffic cones, stacked colorful building blocks, sandy ground, warm sky." &
gen 3 "a candy factory land: giant lollipop trees, candy canes, a pink candy house with white frosting roof, cupcake, pink ground." &
gen 4 "a toy space base: white-and-red toy rocket on a launch pad, satellite dish, lavender moon rocks and cyan crystals, dark navy starry sky." &
wait
gen 5 "a sunny toy beach: palm trees, a sand castle, striped beach umbrella, turquoise sea, light blue sky." &
gen 6 "a snowy toy village: snowy pine trees, a snowman with a carrot nose, an igloo, white snow ground, pale blue sky." &
gen 7 "a toy knight castle: grey stone towers with red and blue cone roofs and flags, castle wall, green grass, light blue sky." &
gen 8 "a rainbow cloud kingdom: rainbow arch, fluffy white and pastel cotton-candy clouds, a pink cloud castle tower, floating golden stars, pink sky." &
wait
echo done

/**
 * UI 그림 묶음 (public/ui/ui.pack, tools/ui/pack_ui.py): HUD 아이콘 20개 + 캐릭터 초상 6장을 요청 한 번으로 받아 blob 주소로 둠.
 * 2026-11-13: Verse8 배포 서버는 파일마다 응답이 1~3초 늦어서 아이콘을 하나씩 받으면 첫 화면에서 20초 넘게 비어 있었음.
 * 묶음을 못 받으면 url()이 undefined → 부르는 쪽이 낱개 파일 주소를 그대로 씀. blob 주소는 게임 내내 씀 (revoke 안 함).
 */
const urls = new Map<string, string>();
let loading: Promise<void> | null = null;

/** 묶음 받기 (한 번만). 실패해도 reject하지 않음 */
export function loadUiPack(): Promise<void> {
  loading ??= (async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}ui/ui.pack`);
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      const headLen = new DataView(buf).getUint32(0, true);
      const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headLen))) as Record<string, [number, number]>;
      const base = 4 + headLen;
      for (const [key, [off, len]] of Object.entries(head)) {
        urls.set(key, URL.createObjectURL(new Blob([new Uint8Array(buf, base + off, len)], { type: 'image/webp' })));
      }
    } catch { /* 낱개 파일로 */ }
  })();
  return loading;
}

/** 묶음에 든 그림의 주소 ('icons/coin', 'chars/white'), 없으면 undefined */
export function packUrl(key: string): string | undefined {
  return urls.get(key);
}

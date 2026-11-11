/** 작은 DOM 도우미. 게임 UI는 #ui 층(pointer-events: none) 위에 .ui-on 요소만 입력을 받음 */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** 누르고 같은 버튼 위에서 떼면 실행 (마우스·터치 같은 동작). disabled면 무시 */
export function button(label: string, onPress: () => void, cls = 'btn'): HTMLButtonElement {
  const b = el('button', `${cls} ui-on`, label);
  b.type = 'button';
  b.addEventListener('pointerup', (e) => {
    if (b.disabled || e.button > 0) return;
    e.preventDefault();
    onPress();
  });
  // 키보드 접근 (Enter/Space)
  b.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !b.disabled) { e.preventDefault(); onPress(); }
  });
  return b;
}

/** 값이 바뀔 때만 textContent를 씀 (매 프레임 호출해도 DOM 안 건드림) */
export function setText(e: HTMLElement, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

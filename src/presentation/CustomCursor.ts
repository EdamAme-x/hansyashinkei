const TRAIL_COUNT = 12;

export function setupCustomCursor(hideCallback?: () => boolean): void {
  const cursor = document.getElementById("custom-cursor");
  const isTouchOnly = navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;
  if (!cursor || isTouchOnly) return;

  const trails: HTMLElement[] = [];
  for (let i = 0; i < TRAIL_COUNT; i++) {
    const t = document.createElement("div");
    t.className = "cursor-trail";
    t.style.opacity = "0";
    document.body.appendChild(t);
    trails.push(t);
  }

  let mx = -100;
  let my = -100;
  const positions: { x: number; y: number }[] = Array.from(
    { length: TRAIL_COUNT },
    () => ({ x: -100, y: -100 }),
  );

  window.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;
    cursor.style.left = `${mx}px`;
    cursor.style.top = `${my}px`;
  });

  const animateTrails = () => {
    positions[0].x += (mx - positions[0].x) * 0.5;
    positions[0].y += (my - positions[0].y) * 0.5;
    for (let i = 1; i < TRAIL_COUNT; i++) {
      positions[i].x += (positions[i - 1].x - positions[i].x) * 0.45;
      positions[i].y += (positions[i - 1].y - positions[i].y) * 0.45;
    }

    const hidden = hideCallback?.() ?? false;
    cursor.classList.toggle("hide", hidden);

    for (let i = 0; i < trails.length; i++) {
      const t = trails[i];
      const p = positions[i];
      const size = 12 - i * 0.8;
      const alpha = hidden ? 0 : 0.45 * (1 - i / trails.length);
      t.style.left = `${p.x}px`;
      t.style.top = `${p.y}px`;
      t.style.width = `${size}px`;
      t.style.height = `${size}px`;
      t.style.opacity = String(alpha);
    }
    requestAnimationFrame(animateTrails);
  };
  requestAnimationFrame(animateTrails);
}

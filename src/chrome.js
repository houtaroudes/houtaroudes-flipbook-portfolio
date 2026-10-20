// The chrome around the book: the reading light pill, the spread counter and
// the way into a page from Contents. The rules live here rather than in
// main.js, so they can be exercised without WebGL, a canvas or a camera.
// main.js paints; this file decides what the paint says.

// A page index (0..9) to the spread that shows it. Page p is the right hand
// page of spread p/2 + 1 when p is even, and the left hand page of the spread
// after it when p is odd.
export function spreadForPage(index, NI) {
  return Math.min(NI - 1, Math.ceil((index + 2) / 2));
}

// Which page sits on a side of a spread. -1 and the page past the last one are
// the endpapers, which is why the caller checks for a title rather than an
// index.
export function pageAt(spread, side) {
  return side === "left" ? 2 * spread - 3 : 2 * spread - 2;
}

// The visible counter. It carries the cover and the back cover as words
// because "00 / 06" and "07 / 06" both read as a fault.
export function spreadCountText(target, NI) {
  if (target === 0) return "Cover";
  if (target >= NI) return "Back";
  return `${String(target).padStart(2, "0")} / ${String(NI - 1).padStart(2, "0")}`;
}

// The same state for a screen reader. The total is the number of spreads, not
// the number of sheets: five sheets open six spreads, and saying "of 5" left
// the last one describing itself as six of five.
export function pageStatusText(target, NI, label) {
  if (target === 0) return "Closed";
  if (target >= NI) return "Back cover";
  return `Spread ${target} of ${NI - 1}: ${label}`;
}

export function spreadLabel(leftTitle, rightTitle) {
  return `${leftTitle || "Front endpaper"} and ${rightTitle || "Back endpaper"}`;
}

// The reading light is one state with several faces: the pill's words, its
// tooltip and its pressed flag all come from the same boolean, so none of them
// can describe a different room than the lamp does.
export function readingLight(on) {
  return {
    label: on ? "Lamp on" : "Lamp off",
    title: on ? "Reading light on. Dim the room (L)" : "Reading light off. Bring it up (L)",
    pressed: String(on),
  };
}

export function paintReadingLight(root, btn, textEl, on) {
  const state = readingLight(on);
  if (root) root.classList.toggle("lamp-off", !on);
  if (btn) {
    btn.setAttribute("aria-pressed", state.pressed);
    btn.title = state.title;
  }
  if (textEl) textEl.textContent = state.label;
  return state;
}

export function paintStepper(countEl, statusEl, body, target, NI, label) {
  const text = spreadCountText(target, NI);
  if (countEl) countEl.textContent = text;
  if (statusEl) statusEl.textContent = pageStatusText(target, NI, label);
  if (body) body.classList.toggle("book-open", target > 0 && target < NI);
  return text;
}

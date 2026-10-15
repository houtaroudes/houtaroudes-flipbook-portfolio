import * as THREE from "three";
import { setupScene, makeTableTexture, makeContactShadow, makePaperTexture, makePaperBump } from "./env.js";
import { Book, PAGE_W, OV } from "./book.js";
import { loadPages, loadBoards, caseHtml } from "./pages.js";
import * as sound from "./audio.js";

const canvas = document.getElementById("scene");
const statusEl = document.getElementById("page-status");
const resetBtn = document.getElementById("reset-view");

// Cover text is set in Inter Tight, so the webfont has to be in the canvas
// font set before any page is drawn, otherwise the first paint falls back to
// Helvetica and the whole book looks off.
async function whenFontsReady() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load("500 26px 'Inter Tight'"),
      document.fonts.load("600 66px 'Inter Tight'"),
      document.fonts.load("400 21px 'Inter Tight'"),
    ]);
    await document.fonts.ready;
  } catch {
    /* a missing font just means a fallback face */
  }
}

const { renderer, scene, camera } = setupScene(canvas);
const aniso = renderer.capabilities.getMaxAnisotropy();

// ---------------- table ----------------

const tableTex = makeTableTexture(renderer, 400);
tableTex.repeat.set(6, 6);
const table = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.92, metalness: 0 })
);
table.rotation.x = -Math.PI / 2;
table.receiveShadow = true;
scene.add(table);

// ---------------- book ----------------

let book = null;
let pages = [];

// The book's own origin sits halfway up the closed stack, so the whole thing
// has to be lifted until its underside rests on the table. Without this the
// lower half of the book, and every page swinging past the spine, render
// below the tabletop and get cut off by it.
const FLOOR_LIFT = 0.0015;

async function start() {
  await whenFontsReady();

  const paper = makePaperTexture();
  const paperBump = makePaperBump(6, 4);
  pages = loadPages(aniso);

  const sheets = [];
  for (let i = 0; i < pages.length; i += 2) {
    sheets.push({
      front: pages[i].poster,
      back: pages[i + 1] ? pages[i + 1].poster : paper,
    });
  }

  book = new Book({
    sheets,
    paper,
    boards: loadBoards(aniso),
    paperBump,
  });
  book.root.position.y = book.T / 2 + FLOOR_LIFT;
  scene.add(book.root);

  // Contact shadow lives on the table, not on the book, so raising the book
  // leaves it on the tabletop where it belongs.
  const shadowTex = makeContactShadow();
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.75 })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.0012;
  contact.scale.set((PAGE_W + OV) * 2.7, 2.0, 1);
  scene.add(contact);

  wireUi();
  // Screenshot passes need to read pile state back out and render a fixed pose
  // without waiting on the animation loop. Nothing else uses these.
  if (new URLSearchParams(location.search).has("capture")) {
    window.__book = book;
    window.__camera = camera;
    window.__cam = camState;
    window.__step = applyCamera;
    window.__render = (t = clock()) => {
      applyCamera(1);
      applyCamera(1);
      camera.lookAt(CAM_TARGET);
      book.update(t, 1 / 60);
      renderer.render(scene, camera);
    };
  }
  book.update(clock(), 1 / 60);
  camera.lookAt(CAM_TARGET);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
  document.body.classList.add("ready");
  syncHash();
}

// ---------------- camera ----------------

// The book has one resting angle. The intro drift settles into it and any free
// look eases back to it once the pointer goes quiet, so a visitor who wanders
// off leaves the book presented the way it was meant to be seen.
const CAM_TARGET = new THREE.Vector3(0, 0.1, 0);
const CAM_HOME = { yaw: 0.26, pitch: 0, dist: 3.6 };
const CAM_IDLE = 3;   // seconds of quiet before the look walks itself home
const LOOK = { yaw: 1.25, up: 0.5, down: 0.42, in: 1.2, out: 1.8 };

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const camState = {
  yaw: 0.55, pitch: 0.12,
  tYaw: CAM_HOME.yaw, tPitch: CAM_HOME.pitch,
  dist: CAM_HOME.dist, tDist: CAM_HOME.dist,
  pitchBase: 0.62,
  look: { yaw: 0, pitch: 0, dist: 0 },   // the visitor's offset from home
  lookT: { yaw: 0, pitch: 0, dist: 0 },  // where that offset is heading
  idleAt: -Infinity,
};

// Called by every camera gesture. The offsets accumulate, so a visitor can
// keep swinging past the limit instead of the drag dying at the edge.
function nudgeLook(yaw, pitch, dist) {
  const t = camState.lookT;
  t.yaw = clamp(t.yaw + yaw, -LOOK.yaw, LOOK.yaw);
  t.pitch = clamp(t.pitch + pitch, -LOOK.down, LOOK.up);
  t.dist = clamp(t.dist + dist, -LOOK.in, LOOK.out);
  camState.idleAt = clock();
}

function applyCamera(dt) {
  const k = 3.2;
  camState.yaw += (camState.tYaw - camState.yaw) * (1 - Math.exp(-k * dt));
  camState.pitch += (camState.tPitch - camState.pitch) * (1 - Math.exp(-k * dt));
  camState.dist += (camState.tDist - camState.dist) * (1 - Math.exp(-k * dt));

  // Free look tracks the pointer quickly and returns home slowly, so the
  // drift back reads as the book settling rather than as a snap back.
  const home = clock() - camState.idleAt > CAM_IDLE;
  if (home) {
    camState.lookT.yaw = 0;
    camState.lookT.pitch = 0;
    camState.lookT.dist = 0;
  }
  const lk = home ? 1.1 : 9;
  const l = camState.look;
  const lt = camState.lookT;
  l.yaw += (lt.yaw - l.yaw) * (1 - Math.exp(-lk * dt));
  l.pitch += (lt.pitch - l.pitch) * (1 - Math.exp(-lk * dt));
  l.dist += (lt.dist - l.dist) * (1 - Math.exp(-lk * dt));

  const yaw = camState.yaw + l.yaw;
  const ang = camState.pitchBase + camState.pitch + l.pitch;
  const dist = camState.dist + l.dist;
  camera.position.set(
    CAM_TARGET.x + Math.sin(yaw) * Math.cos(ang) * dist,
    CAM_TARGET.y + Math.sin(ang) * dist,
    CAM_TARGET.z + Math.cos(yaw) * Math.cos(ang) * dist
  );
}

// The rest of the book's furniture can be anywhere; this is only about the
// look offsets, so a visitor who has not touched the camera never sees the
// reset button at all.
const LOOK_EPS = 0.004;

function viewAtRest() {
  const l = camState.look;
  const t = camState.lookT;
  return (
    Math.abs(l.yaw) + Math.abs(l.pitch) + Math.abs(l.dist) < LOOK_EPS &&
    Math.abs(t.yaw) + Math.abs(t.pitch) + Math.abs(t.dist) < LOOK_EPS
  );
}

// Puts the camera back on its resting angle in a single frame, which is what
// the pill and the R key are for: the slow drift is the default, this is the
// direct way there. Any look drag in flight is dropped first, otherwise the
// next pointermove would push the view straight back off home.
function resetView() {
  if (lookDrag.id !== null) stopLookGesture();
  camState.look = { yaw: 0, pitch: 0, dist: 0 };
  camState.lookT = { yaw: 0, pitch: 0, dist: 0 };
  paintReset();
}

function paintReset() {
  if (!resetBtn) return;
  const rest = viewAtRest();
  if (resetBtn.hidden !== rest) resetBtn.hidden = rest;
}

// ---------------- interaction ----------------

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const KEYS = { ArrowRight: 1, PageDown: 1, " ": 1, ArrowLeft: -1, PageUp: -1 };

const clock0 = performance.now();
const clock = () => (performance.now() - clock0) / 1000;

let overlayOpen = false;

function setNdc(e, rect) {
  ndc.set(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
}

function faceAt(e) {
  const rect = canvas.getBoundingClientRect();
  setNdc(e, rect);
  raycaster.setFromCamera(ndc, camera);
  const meshes = [];
  for (const it of book.items) {
    if (it.kind === "cover") {
      if (it.pivot.rotation.z < Math.PI / 2 + 0.05) meshes.push(it.board);
    } else if (it.kind === "sheet" && (it.front.visible || it.back.visible)) {
      meshes.push(it.front, it.back);
    }
  }
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) return null;
  const hit = hits[0];
  const k = book.faceOf(hit.object);
  return { k, side: hit.point.x >= 0 ? 1 : -1, u: hit.uv ? hit.uv.x : 0.5 };
}

const isSheet = (k) => k > 0 && k < book.NI;
// A sheet carries two projects: the front face of sheet k is page 2k-2, the
// back face is page 2k-1.
const pageIndexOf = (hit) => 2 * (hit.k - 1) + (hit.side < 0 ? 1 : 0);

function soundForMove(prev, next) {
  const d = Math.abs(next - prev);
  if (next === 0 || next === book.NI) sound.thud();
  else if (prev === 0 || prev === book.NI) {
    sound.thud();
    sound.turn(0.5);
  } else sound.turn(Math.min(2, 0.6 + 0.35 * d));
}

function goToTarget(t, { silent = false } = {}) {
  const prev = book.target;
  if (!book.goTo(t, clock())) return;
  if (!silent) soundForMove(prev, book.target);
  syncHash();
}

function syncHash() {
  try {
    history.replaceState(null, "", book.target ? `#${book.target}` : location.pathname + location.search);
  } catch {}
  const total = book.N;
  statusEl.textContent =
    book.target === 0
      ? "Closed"
      : book.target >= book.NI
        ? "Back cover"
        : `Spread ${book.target} of ${total}: ${spreadLabel(book.target)}`;
  document.body.classList.toggle("book-open", book.target > 0 && book.target < book.NI);
}

// What the open spread actually shows: the page in the left pile then the one
// in the right pile. Target 1 opens on the front endpaper, and the last spread
// runs out on the back endpaper.
function spreadLabel(target) {
  const left = pages[2 * target - 3];
  const right = pages[2 * target - 2];
  return `${left ? left.entry.title : "Front endpaper"} and ${right ? right.entry.title : "Back endpaper"}`;
}

// ---------------- the in-book page ----------------

function openProject(hit) {
  const index = pageIndexOf(hit);
  const page = pages[index];
  if (!page) return false;
  const proj = page.entry;
  const frame = document.getElementById("site-frame");
  const iframe = document.getElementById("site-iframe");
  const title = document.getElementById("site-title");
  const tab = document.getElementById("site-open-tab");
  const note = document.getElementById("site-note");

  title.textContent = proj.title;
  if (proj.embed) {
    iframe.removeAttribute("srcdoc");
    iframe.src = proj.url;
    note.hidden = true;
    tab.hidden = false;
    tab.href = proj.url;
  } else {
    iframe.removeAttribute("src");
    iframe.srcdoc = caseHtml(proj, index);
    note.hidden = !proj.url;
    note.textContent = proj.reason || "";
    tab.hidden = !proj.url;
    if (proj.url) tab.href = proj.url;
  }
  frame.hidden = false;
  overlayOpen = true;
  requestAnimationFrame(() => frame.classList.add("is-open"));
  document.getElementById("site-back").focus({ preventScroll: true });
  return true;
}

function closeSite() {
  const frame = document.getElementById("site-frame");
  const iframe = document.getElementById("site-iframe");
  frame.classList.remove("is-open");
  overlayOpen = false;
  canvas.focus({ preventScroll: true });
  setTimeout(() => {
    frame.hidden = true;
    iframe.removeAttribute("src");
    iframe.removeAttribute("srcdoc");
  }, 450);
}

function wireUi() {
  document.getElementById("site-back").addEventListener("click", closeSite);

  const soundToggle = document.getElementById("sound-toggle");
  const paintSound = () => {
    const on = !sound.isMuted();
    soundToggle.setAttribute("aria-pressed", String(on));
    soundToggle.textContent = on ? "Sound on" : "Sound off";
  };
  soundToggle.addEventListener("click", () => {
    sound.setMuted(!sound.isMuted());
    if (!sound.isMuted()) sound.unlock();
    paintSound();
  });
  paintSound();

  document.getElementById("prev").addEventListener("click", () => goToTarget(book.target - 1));
  document.getElementById("next").addEventListener("click", () => goToTarget(book.target + 1));
  resetBtn.addEventListener("click", resetView);

  window.addEventListener("keydown", (e) => {
    // While a project is open in the book, the keyboard belongs to that page.
    if (overlayOpen) {
      if (e.key === "Escape") closeSite();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    sound.unlock();
    if (e.key in KEYS) {
      e.preventDefault();
      goToTarget(book.target + KEYS[e.key]);
    } else if (e.key === "Home") goToTarget(0);
    else if (e.key === "End") goToTarget(book.NI);
    else if (e.key === "r" || e.key === "R") resetView();
  });

  window.addEventListener("hashchange", () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (Number.isFinite(n)) book.goTo(n, clock());
  });

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", (e) => endPointer(e));
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("wheel", onWheel, { passive: false });
}

const pointer = { down: null };

// Free look: the camera takes the empty table, the right button anywhere, and
// any second finger. The left button on the book keeps turning pages.
const lookDrag = { id: null, x: 0, y: 0, pinch: 0 };
const livePointers = new Map();

function pointerCentroid() {
  let x = 0;
  let y = 0;
  for (const p of livePointers.values()) {
    x += p.x;
    y += p.y;
  }
  const n = livePointers.size;
  return n ? { x: x / n, y: y / n } : null;
}

function pinchSpread() {
  const [a, b] = [...livePointers.values()];
  return b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

function startLookGesture(id) {
  sound.unlock();
  const c = pointerCentroid();
  lookDrag.id = id;
  lookDrag.x = c ? c.x : 0;
  lookDrag.y = c ? c.y : 0;
  lookDrag.pinch = pinchSpread();
  // Stamps the idle timer, so a fresh gesture gets the whole quiet window
  // before the view starts drifting home.
  camState.idleAt = clock();
  try {
    canvas.setPointerCapture(id);
  } catch {}
  canvas.style.cursor = "grabbing";
}

function onWheel(e) {
  if (overlayOpen) return;
  e.preventDefault();
  nudgeLook(0, 0, e.deltaY * 0.0016);
}
const hitPlane = new THREE.Plane();

function pickX(e) {
  const rect = canvas.getBoundingClientRect();
  setNdc(e, rect);
  raycaster.setFromCamera(ndc, camera);
  // Pick against a plane through the book's own stack height, so a drag maps
  // cleanly to angle even while the page is curled.
  hitPlane.set(new THREE.Vector3(0, 1, 0), -book.root.position.y);
  const p = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(hitPlane, p)) return null;
  return p;
}

function cancelPageDrag() {
  if (!book.drag) return;
  book.endDrag(clock());
  syncHash();
}

function onPointerDown(e) {
  if (overlayOpen) return;
  if (e.button !== 0 && e.button !== 2) return;
  livePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  // A second finger means the camera, never a page turn, so a pinch cannot
  // leave a page stuck halfway over.
  if (livePointers.size > 1) {
    cancelPageDrag();
    pointer.down = null;
    startLookGesture(e.pointerId);
    return;
  }

  const hit = e.button === 2 ? null : faceAt(e);
  if (!hit) {
    startLookGesture(e.pointerId);
    return;
  }
  sound.unlock();
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {}
  pointer.down = { id: e.pointerId, x: e.clientX, y: e.clientY, hit, moved: false, dragging: false };
  canvas.style.cursor = "grabbing";
}

function onPointerMove(e) {
  if (livePointers.has(e.pointerId)) livePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (lookDrag.id !== null) {
    const c = pointerCentroid();
    if (c) {
      // Dragging the table pulls the book with the pointer: sideways swings the
      // camera the other way, downward lifts the view.
      nudgeLook(-(c.x - lookDrag.x) * 0.005, (c.y - lookDrag.y) * 0.004, 0);
      lookDrag.x = c.x;
      lookDrag.y = c.y;
    }
    const spread = pinchSpread();
    if (spread && lookDrag.pinch) nudgeLook(0, 0, (lookDrag.pinch - spread) * 0.006);
    lookDrag.pinch = spread;
    return;
  }

  const d = pointer.down;
  if (!d) {
    hover(faceAt(e));
    return;
  }
  if (d.id !== e.pointerId) return;
  if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) {
    d.moved = true;
    // Only sheets turn. The boards are opened from the covers.
    if (isSheet(d.hit.k) && !book.drag) {
      const it = book.items[d.hit.k];
      if (it && !it.active && !it.dragging) {
        const dir = d.hit.side > 0 ? 1 : -1;
        const world = pickX(e);
        d.dragging = book.beginDrag(d.hit.k, dir, world ? world.x : dir * PAGE_W, d.hit.side, clock());
      }
    }
  }
  if (d.dragging) {
    const world = pickX(e);
    if (world) book.dragTo(world.x, clock());
  }
}

function onPointerUp(e) {
  endPointer(e);
}

function stopLookGesture() {
  try {
    canvas.releasePointerCapture(lookDrag.id);
  } catch {}
  lookDrag.id = null;
  lookDrag.pinch = 0;
  canvas.style.cursor = "default";
}

function endPointer(e) {
  if (e) livePointers.delete(e.pointerId);
  else livePointers.clear();

  if (lookDrag.id !== null && (!e || e.pointerId === lookDrag.id || !livePointers.has(lookDrag.id))) {
    stopLookGesture();
  }

  const d = pointer.down;
  if (!d || (e && d.id !== e.pointerId)) return;
  pointer.down = null;
  canvas.style.cursor = "default";
  if (book.drag) {
    book.endDrag(clock());
    syncHash();
    sound.turn(0.9);
    return;
  }
  if (d.moved || !d.hit || book.busy) return;
  // A plain click: step inside the project on that page.
  if (isSheet(d.hit.k)) {
    if (openProject(d.hit)) return;
    return;
  }
  // Covers behave like a real book: the front board opens and closes it.
  if (d.hit.k === 0) goToTarget(book.target === 0 ? 1 : 0);
  else if (d.hit.k === book.NI) goToTarget(book.target >= book.NI ? book.NI - 1 : book.NI);
}

function hover(hit) {
  if (!hit || book.busy || overlayOpen) {
    book.setHover(-1);
    canvas.style.cursor = "default";
    return;
  }
  canvas.style.cursor = "pointer";
  if (!isSheet(hit.k)) {
    book.setHover(-1);
    return;
  }
  const it = book.items[hit.k];
  if (!it || it.active || it.dragging) {
    book.setHover(-1);
    return;
  }
  const edge = 0.3 + 0.7 * smooth01(Math.abs(hit.u - 0.5) * 2);
  book.setHover(hit.k, edge, hit.side);
}

function smooth01(x) {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
}

// ---------------- loop ----------------

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (prefersReduced) {
  camState.yaw = camState.tYaw;
  camState.pitch = camState.tPitch;
}

let prev = clock() - 1 / 60;
function frame() {
  requestAnimationFrame(frame);
  const t = clock();
  const dt = Math.min(0.05, t - prev);
  prev = t;
  if (overlayOpen) return;
  applyCamera(dt);
  paintReset();
  camera.lookAt(CAM_TARGET);
  book.update(t, dt);
  renderer.render(scene, camera);
}

start().then(() => {
  const startHash = parseInt(location.hash.slice(1), 10);
  if (Number.isFinite(startHash) && startHash > 0) {
    book.jump(startHash);
    syncHash();
  }
});

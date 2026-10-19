import * as THREE from "three";
import {
  setupScene,
  makeTableTexture,
  makeContactShadow,
  makePaperTexture,
  makePaperBump,
  makeWallTexture,
  makeGlowTexture,
  makeWindowTexture,
  makeMoteTexture,
} from "./env.js";
import { Book, PAGE_W, OV } from "./book.js";
import { loadPages, loadBoards, caseHtml, PROJECT_LIST } from "./pages.js";
import * as sound from "./audio.js";

const canvas = document.getElementById("scene");
const statusEl = document.getElementById("page-status");
const resetBtn = document.getElementById("reset-view");
const spreadCount = document.getElementById("spread-count");
const hintEl = document.getElementById("page-hint");
const hintTitle = document.getElementById("page-hint-title");
const hintMeta = document.getElementById("page-hint-meta");
const canHover = window.matchMedia("(hover: hover)");

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

const { renderer, scene, camera, spot: keyLight, fill: fillLight } = setupScene(canvas);
const aniso = renderer.capabilities.getMaxAnisotropy();

// ---------------- room ----------------

// The book used to sit on an endless dark plane, which read as a void once the
// camera could look around. It is a desk in a room now: a slab with visible
// edges, a floor, a plaster wall, and a pool of warm light from a lamp that is
// never modelled because the wall says it is there.
// The pool sits just above the desk, because that is the band of wall the
// camera can actually see: at the opening angle the frame ends at about waist
// height on the wall, and a light placed higher would never appear at all.
const GLOW_HOME = { x: -1.72, y: 0.78 };

const room = new THREE.Group();

const deskTex = makeTableTexture(renderer, 400);
deskTex.repeat.set(2.2, 1.5);
const desk = new THREE.Mesh(
  new THREE.BoxGeometry(8.6, 0.1, 5.8),
  new THREE.MeshStandardMaterial({ map: deskTex, roughness: 0.9, metalness: 0 })
);
desk.position.set(0, -0.05, 0.1);
desk.castShadow = true;
desk.receiveShadow = true;
room.add(desk);

const legMat = new THREE.MeshStandardMaterial({ color: 0x241d18, roughness: 0.85 });
[-4.14, 4.14].forEach((x) => {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 5.3), legMat);
  leg.position.set(x, -0.5, 0.1);
  leg.castShadow = true;
  leg.receiveShadow = true;
  room.add(leg);
});

const floorTex = makeTableTexture(renderer, 400);
floorTex.repeat.set(4, 4);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({ map: floorTex, color: 0x6f5b48, roughness: 1, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -0.9, -2);
floor.receiveShadow = true;
room.add(floor);

const wallTex = makeWallTexture();
wallTex.repeat.set(4, 1);
const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 14),
  new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1, metalness: 0 })
);
wall.position.set(0, 6.1, -4.4);
wall.receiveShadow = true;
room.add(wall);

const baseboard = new THREE.Mesh(
  new THREE.BoxGeometry(30, 0.13, 0.08),
  new THREE.MeshStandardMaterial({ color: 0x0b0908, roughness: 0.8 })
);
baseboard.position.set(0, -0.83, -4.35);
room.add(baseboard);

const glow = new THREE.Mesh(
  new THREE.PlaneGeometry(5.8, 3.4),
  new THREE.MeshBasicMaterial({
    map: makeGlowTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
glow.position.set(GLOW_HOME.x, GLOW_HOME.y, -4.33);
room.add(glow);

// ---------------- window ----------------

// The back wall was lit with no visible source. A window fixes that: it gives
// the room a horizon, a cool second temperature, and something to find when the
// camera swings away from the book. The view is painted, like the pool above.
// Low and wide, with the sill just above the desk: that keeps the bottom half
// of the glass inside the frame at the resting angle, so the cool light has a
// visible source instead of glowing from off-screen.
const WIN = { w: 2.1, h: 2.2, x: -3.3, y: 1.22 };
const windowFrame = new THREE.Group();
windowFrame.position.set(WIN.x, WIN.y, -4.37);
const glass = new THREE.Mesh(
  new THREE.PlaneGeometry(WIN.w, WIN.h),
  new THREE.MeshBasicMaterial({ map: makeWindowTexture(), toneMapped: false })
);
windowFrame.add(glass);

const joinery = new THREE.MeshStandardMaterial({ color: 0x191310, roughness: 0.78 });
const rail = (w, h, d, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), joinery);
  m.position.set(x, y, z);
  m.castShadow = true;
  windowFrame.add(m);
  return m;
};
const halfW = WIN.w / 2;
const halfH = WIN.h / 2;
rail(WIN.w + 0.16, 0.09, 0.075, 0, halfH + 0.01, 0.01);
rail(WIN.w + 0.16, 0.09, 0.075, 0, -halfH - 0.01, 0.01);
rail(0.09, WIN.h + 0.09, 0.075, -halfW - 0.01, 0, 0.01);
rail(0.09, WIN.h + 0.09, 0.075, halfW + 0.01, 0, 0.01);
// Two mullions, not three: a four-pane sash is the least fussy thing that
// still reads as a window rather than a lit rectangle.
rail(0.045, WIN.h, 0.055, 0, 0, 0.015);
rail(WIN.w, 0.045, 0.055, 0, halfH * 0.18, 0.015);
// Sill, deep enough to read from the side when the camera orbits.
const sill = rail(WIN.w + 0.34, 0.07, 0.2, 0, -halfH - 0.07, 0.07);
sill.castShadow = true;
room.add(windowFrame);

// Cold spill from the glass, weak and far from the book so it never competes
// with the warm pool. It costs one point light and no shadow map.
const windowLight = new THREE.PointLight(0x6f8ba8, 5.5, 8, 2);
windowLight.position.set(WIN.x + 0.1, WIN.y - 0.5, -3.8);
room.add(windowLight);

// ---------------- shelf ----------------

// A shelf of spines on the right wall. It exists for the same reason as the
// window: when the camera looks past the book, the room should keep going.
const shelf = new THREE.Group();
shelf.position.set(3.15, 1.78, -4.2);
const plank = new THREE.Mesh(
  new THREE.BoxGeometry(2.3, 0.055, 0.24),
  new THREE.MeshStandardMaterial({ color: 0x241b15, roughness: 0.85 })
);
plank.castShadow = true;
plank.receiveShadow = true;
shelf.add(plank);

const spineMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
const spineColors = [0x4a3527, 0x2e4038, 0x5b3b2c, 0x2f2d38, 0x6a5637, 0x3c2f2a];
let spineX = -1.04;
spineColors.forEach((color, i) => {
  const w = 0.085 + (i % 3) * 0.022;
  const h = 0.44 + ((i * 37) % 5) * 0.035;
  const book = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.185), spineMat(color));
  book.position.set(spineX + w / 2, h / 2 + 0.028, 0);
  book.castShadow = true;
  // The last one leans on the stack, which is what shelves actually look like.
  if (i === spineColors.length - 1) {
    book.rotation.z = -0.22;
    book.position.x += 0.06;
    book.position.y -= 0.02;
  }
  shelf.add(book);
  spineX += w + 0.014;
});
// A shallow bowl at the empty end, because a shelf with only books is a prop
// shelf. Its rim catches the desk lamp when the light is up.
const bowl = new THREE.Mesh(
  new THREE.CylinderGeometry(0.085, 0.055, 0.05, 20, 1, true),
  new THREE.MeshStandardMaterial({ color: 0x7a6448, roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide })
);
bowl.position.set(0.82, 0.055, 0);
bowl.castShadow = true;
shelf.add(bowl);
room.add(shelf);

// A reading lamp on the desk. It used to be a sconce on the back wall, but the
// camera sits high enough that the wall above the desk never enters the frame,
// so the lamp was invisible and its pool had no visible source. On the desk it
// is in shot, it explains the pool behind it, and it has a cord to pull.
// Its own light is weak on purpose: the pool is painted, and a real point light
// against plaster would burn a hole in it instead of adding to it.
const brass = new THREE.MeshStandardMaterial({ color: 0x8a6a3d, roughness: 0.4, metalness: 0.62 });
const lamp = new THREE.Group();
lamp.position.set(GLOW_HOME.x, 0, -1.28);
lamp.rotation.y = 0.4;

const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.195, 0.03, 28), brass);
base.position.y = 0.015;
base.castShadow = true;
base.receiveShadow = true;
lamp.add(base);

const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.54, 12), brass);
stem.position.set(0.035, 0.29, 0);
stem.rotation.z = -0.1;
stem.castShadow = true;
lamp.add(stem);

// The head is its own group so the shade, bulb, rim and light all tilt together
// and the mouth can be aimed at the book.
const head = new THREE.Group();
head.position.set(0.062, 0.57, 0.02);
head.rotation.x = -0.55;
lamp.add(head);

const shade = new THREE.Mesh(
  new THREE.CylinderGeometry(0.055, 0.145, 0.19, 28, 1, true),
  new THREE.MeshStandardMaterial({ color: 0x7d5f37, roughness: 0.34, metalness: 0.7, side: THREE.DoubleSide })
);
shade.castShadow = true;
head.add(shade);

// Warm disc at the mouth reads as the bulb without modelling a filament.
const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd2a0, toneMapped: false });
const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.115, 24), bulbMat);
bulb.position.y = -0.083;
bulb.rotation.x = Math.PI / 2;
head.add(bulb);

// A bright edge along the mouth of the shade. This is the one cue that says
// "the lamp is on" from across the room, and it keeps reading after the room
// is dimmed. The idea comes from the Lamp pattern on 21st.dev.
const rimMat = new THREE.MeshBasicMaterial({ color: 0xffc98a, toneMapped: false });
const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1445, 0.0055, 6, 32), rimMat);
rim.position.y = -0.09;
rim.rotation.x = Math.PI / 2;
head.add(rim);

const lampLight = new THREE.PointLight(0xffc287, 2.4, 2.4, 2);
lampLight.position.y = -0.12;
head.add(lampLight);

// A pull cord hanging from the shade. It is the affordance: the lamp is the
// switch, and a cord is where a hand goes to turn a lamp rather than a button.
const cord = new THREE.Mesh(
  new THREE.CylinderGeometry(0.0035, 0.0035, 0.34, 6),
  new THREE.MeshStandardMaterial({ color: 0x2a2119, roughness: 0.9 })
);
cord.position.set(0.2, 0.32, 0.09);
lamp.add(cord);
const bead = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), brass);
bead.position.set(0.2, 0.14, 0.09);
bead.castShadow = true;
lamp.add(bead);
room.add(lamp);

// One pencil, sharpened, lying where a hand would leave it. It is the only
// sign of a person in the room, and it gives the desk a scale the book alone
// does not. Hexagonal body because a round pencil reads as a dowel.
// The book is 1.6 units wide, so a real 19cm pencil measures about 1.2 units
// here; this one is shorter, as if it has been used down.
const pencil = new THREE.Group();
pencil.position.set(0.95, 0, 0.8);
pencil.rotation.y = 0.62;
const PENCIL_R = 0.019;
const woodMat = new THREE.MeshStandardMaterial({ color: 0x2f3a44, roughness: 0.62 });
const timberMat = new THREE.MeshStandardMaterial({ color: 0xc9a878, roughness: 0.85 });
const graphiteMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5 });
const body = new THREE.Mesh(new THREE.CylinderGeometry(PENCIL_R, PENCIL_R, 0.56, 6), woodMat);
body.rotation.z = Math.PI / 2;
body.position.x = 0;
const timber = new THREE.Mesh(new THREE.ConeGeometry(PENCIL_R, 0.08, 6), timberMat);
timber.rotation.z = -Math.PI / 2;
timber.position.x = 0.32;
const graphite = new THREE.Mesh(new THREE.ConeGeometry(PENCIL_R * 0.34, 0.028, 6), graphiteMat);
graphite.rotation.z = -Math.PI / 2;
graphite.position.x = 0.374;
const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(PENCIL_R * 1.04, PENCIL_R * 1.04, 0.036, 12), brass);
ferrule.rotation.z = Math.PI / 2;
ferrule.position.x = -0.298;
const eraser = new THREE.Mesh(
  new THREE.CylinderGeometry(PENCIL_R * 0.9, PENCIL_R * 0.9, 0.032, 12),
  new THREE.MeshStandardMaterial({ color: 0xa9736a, roughness: 0.95 })
);
eraser.rotation.z = Math.PI / 2;
eraser.position.x = -0.332;
// Every part sits on the pencil's centre line, one radius above the desk.
[body, timber, graphite, ferrule, eraser].forEach((m) => {
  m.castShadow = true;
  m.position.y = PENCIL_R;
  pencil.add(m);
});
room.add(pencil);

// ---------------- desk props ----------------

// Three objects, each doing a job the pencil cannot: the mug puts a person at
// the desk, the sketchbook says the book was made at it, and the plant keeps
// the far end from being a tabletop of rectangles.

// Everything on the desk has to live outside the open book's footprint: the
// spread runs from about -2.45 to 0.85 in x and 0.55 deep in z once both
// covers are flat. Props inside that box get passed through by a cover, which
// is exactly what a book on a desk must never do.
const MUG = { x: 1.25, z: 0.85 };
const stoneware = new THREE.MeshStandardMaterial({ color: 0xb6a58e, roughness: 0.74 });
const mug = new THREE.Group();
mug.position.set(MUG.x, 0, MUG.z);
mug.rotation.y = -0.45;
const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.082, 0.15, 22), stoneware);
mugBody.position.y = 0.075;
mugBody.castShadow = true;
mugBody.receiveShadow = true;
mug.add(mugBody);
const mugRim = new THREE.Mesh(new THREE.TorusGeometry(0.091, 0.0065, 6, 24), stoneware);
mugRim.rotation.x = Math.PI / 2;
mugRim.position.y = 0.149;
mug.add(mugRim);
const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 6, 20), stoneware);
handle.position.set(0.112, 0.08, 0);
handle.scale.y = 1.15;
mug.add(handle);
const coffee = new THREE.Mesh(
  new THREE.CircleGeometry(0.084, 22),
  new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.26 })
);
coffee.rotation.x = -Math.PI / 2;
coffee.position.y = 0.131;
mug.add(coffee);
room.add(mug);

// Steam, because a mug with nothing above it reads as a lamp. Fourteen points
// is enough to suggest heat without turning the desk into a fog bank.
const STEAM = 14;
const steamGeo = new THREE.BufferGeometry();
const steamPos = new Float32Array(STEAM * 3);
const steamPhase = new Float32Array(STEAM);
const steamSpeed = new Float32Array(STEAM);
const steamStart = new Float32Array(STEAM);
for (let i = 0; i < STEAM; i++) {
  steamPhase[i] = Math.random() * Math.PI * 2;
  steamSpeed[i] = 0.07 + Math.random() * 0.06;
  steamStart[i] = Math.random();
  steamPos.set([MUG.x, 0.16 + steamStart[i] * 0.5, MUG.z], i * 3);
}
steamGeo.setAttribute("position", new THREE.BufferAttribute(steamPos, 3));
const steam = new THREE.Points(
  steamGeo,
  new THREE.PointsMaterial({
    map: makeMoteTexture(),
    color: 0xfff4e6,
    size: 0.1,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    sizeAttenuation: true,
  })
);
steam.frustumCulled = false;
scene.add(steam);

const linen = new THREE.MeshStandardMaterial({ color: 0x33413c, roughness: 0.92 });
const paperStock = makePaperTexture();
const sketch = new THREE.Group();
sketch.position.set(1.05, 0, -1.02);
sketch.rotation.y = -0.2;
[
  [0.58, 0.014, 0.42, 0.007, linen, 0],
  [0.555, 0.03, 0.395, 0.029, new THREE.MeshStandardMaterial({ map: paperStock, roughness: 0.95 }), 0],
  [0.58, 0.014, 0.42, 0.051, linen, 0],
].forEach(([w, h, d, y, mat]) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  sketch.add(m);
});
const band = new THREE.Mesh(
  new THREE.BoxGeometry(0.022, 0.072, 0.426),
  new THREE.MeshStandardMaterial({ color: 0x191c1a, roughness: 0.85 })
);
band.position.set(0.17, 0.034, 0);
band.castShadow = true;
sketch.add(band);
room.add(sketch);

const plant = new THREE.Group();
plant.position.set(-1.98, 0, -0.9);
const potMat = new THREE.MeshStandardMaterial({ color: 0x8a5138, roughness: 0.88 });
const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.108, 0.2, 18), potMat);
pot.position.y = 0.1;
pot.castShadow = true;
pot.receiveShadow = true;
plant.add(pot);
const soil = new THREE.Mesh(
  new THREE.CircleGeometry(0.136, 18),
  new THREE.MeshStandardMaterial({ color: 0x1b1410, roughness: 1 })
);
soil.rotation.x = -Math.PI / 2;
soil.position.y = 0.198;
plant.add(soil);
const leafMat = new THREE.MeshStandardMaterial({ color: 0x33452f, roughness: 0.88, side: THREE.DoubleSide });
for (let i = 0; i < 7; i++) {
  const arm = new THREE.Group();
  arm.position.y = 0.19;
  arm.rotation.y = (i / 7) * Math.PI * 2 + 0.4;
  arm.rotation.z = 0.34 + (i % 3) * 0.13;
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 5), leafMat);
  leaf.scale.set(0.3, 1.05, 0.075);
  leaf.position.y = 0.11;
  leaf.castShadow = true;
  arm.add(leaf);
  plant.add(arm);
}
room.add(plant);

scene.add(room);

// ---------------- dust ----------------

// Motes drifting through the key light. Few, slow and faint: enough to make
// the air visible without turning the room into a snow globe.
const MOTES = 220;
const motesGeo = new THREE.BufferGeometry();
const motePos = new Float32Array(MOTES * 3);
const moteBaseX = new Float32Array(MOTES);
const moteSpeed = new Float32Array(MOTES);
const motePhase = new Float32Array(MOTES);
const MOTE_BOTTOM = 0.06;
const MOTE_TOP = 3.3;
for (let i = 0; i < MOTES; i++) {
  const x = (Math.random() - 0.5) * 9;
  const y = MOTE_BOTTOM + Math.random() * (MOTE_TOP - MOTE_BOTTOM);
  const z = -4 + Math.random() * 6.4;
  moteBaseX[i] = x;
  moteSpeed[i] = 0.012 + Math.random() * 0.035;
  motePhase[i] = Math.random() * Math.PI * 2;
  motePos.set([x, y, z], i * 3);
}
motesGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
const motes = new THREE.Points(
  motesGeo,
  new THREE.PointsMaterial({
    map: makeMoteTexture(),
    color: 0xffe2ba,
    size: 0.014,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
);
motes.frustumCulled = false;
scene.add(motes);

// The pointer does not add a sixth light. It nudges the existing warm fill and
// the painted pool on the wall, which costs nothing per fragment and keeps the
// shadow map current.
const pointerLight = { x: 0, y: 0, tx: 0, ty: 0 };

// ---------------- lamp ----------------

// The lamp is also the room's switch. Clicking it (or L) takes the reading
// light down to an ember: the pool fades, the shade keeps a warm edge, and the
// page copy stays legible. The direction comes from the Pull Lamp pattern on
// 21st.dev, where the desk lamp is the control rather than a separate toggle.
const LAMP_KEY = "flipbook:lamp";

// The preference is shared with the inline script in index.html, which applies
// it before the first paint. This only has to agree with it.
function readLamp() {
  try {
    return localStorage.getItem(LAMP_KEY) !== "0";
  } catch {
    return true;
  }
}

let lampOn = readLamp();
let lampMix = lampOn ? 1 : 0;
document.documentElement.classList.toggle("lamp-off", !lampOn);
const lampStatus = () => document.getElementById("lamp-status");

function toggleLamp() {
  lampOn = !lampOn;
  try {
    localStorage.setItem(LAMP_KEY, lampOn ? "1" : "0");
  } catch {}
  document.documentElement.classList.toggle("lamp-off", !lampOn);
  const status = lampStatus();
  if (status) status.textContent = lampOn ? "Reading light on." : "Reading light dimmed.";
}

function updateRoom(t, dt) {
  pointerLight.x += (pointerLight.tx - pointerLight.x) * (1 - Math.exp(-4.5 * dt));
  pointerLight.y += (pointerLight.ty - pointerLight.y) * (1 - Math.exp(-4.5 * dt));
  const px = pointerLight.x;
  const py = pointerLight.y;
  fillLight.position.set(3.5 + px * 1.15, 2.6 - py * 0.4, 3.5 + px * 0.35);
  glow.position.x = GLOW_HOME.x + px * 1.6;
  glow.position.y = GLOW_HOME.y - py * 0.85;

  // One value drives every lamp-lit surface, so the room dims as a room rather
  // than as a set of unrelated lights changing at once.
  lampMix += ((lampOn ? 1 : 0) - lampMix) * (1 - Math.exp(-3.4 * dt));
  glow.material.opacity = 0.16 + 0.84 * lampMix;
  lampLight.intensity = 0.16 + 2.24 * lampMix;
  keyLight.intensity = 74 + 46 * lampMix;
  fillLight.intensity = 9 + 17 * lampMix;
  bulbMat.color.setRGB(0.46 + 0.54 * lampMix, 0.3 + 0.52 * lampMix, 0.2 + 0.4 * lampMix);
  rimMat.color.setRGB(0.38 + 0.62 * lampMix, 0.24 + 0.55 * lampMix, 0.14 + 0.4 * lampMix);
  renderer.toneMappingExposure = 0.86 + 0.14 * lampMix;

  if (!prefersReduced) {
    const pos = motesGeo.attributes.position.array;
    for (let i = 0; i < MOTES; i++) {
      let y = pos[i * 3 + 1] + moteSpeed[i] * dt;
      if (y > MOTE_TOP) y = MOTE_BOTTOM;
      pos[i * 3 + 1] = y;
      pos[i * 3] = moteBaseX[i] + Math.sin(t * 0.18 + motePhase[i]) * 0.06;
    }
    motesGeo.attributes.position.needsUpdate = true;

    for (let i = 0; i < STEAM; i++) {
      let y = steamPos[i * 3 + 1] + steamSpeed[i] * dt;
      if (y > 0.68) y = 0.16;
      steamPos[i * 3 + 1] = y;
      steamPos[i * 3] = MUG.x + Math.sin(t * 0.7 + steamPhase[i]) * 0.03 * (1 + (y - 0.16) * 2.4);
      steamPos[i * 3 + 2] = MUG.z + Math.cos(t * 0.55 + steamPhase[i]) * 0.028;
    }
    steamGeo.attributes.position.needsUpdate = true;
  }
}

// ---------------- book ----------------

let book = null;
let pages = [];

// The book's own origin sits halfway up the closed stack, so the whole thing
// has to be lifted until its underside rests on the table. Without this the
// lower half of the book, and every page swinging past the spine, render
// below the tabletop and get cut off by it.
const FLOOR_LIFT = 0.0015;

// ---------------- ribbon marker ----------------

// A silk marker lying over the closed book. It remembers the last project you
// opened, so the way back in is a physical thing on the cover rather than a
// menu. It only appears once there is something to return to, and it fades
// out as soon as the book opens, because a marker on an open book is just
// clutter in the gutter.
const RIBBON_W = 0.084;
const ribbon = { mesh: null, opacity: 0, hover: 0 };
let lastPage = readLast();
let ribbonHitLast = false;
let copyTimer = 0;

function readLast() {
  try {
    const v = parseInt(localStorage.getItem("flipbook:last"), 10);
    return Number.isFinite(v) && v >= 0 && v < PROJECT_LIST.length ? v : null;
  } catch {
    return null;
  }
}

function writeLast(i) {
  try {
    localStorage.setItem("flipbook:last", String(i));
  } catch {}
}

function buildRibbon(bump) {
  // Centreline in the anchor's local frame (y up, z toward the reader): flat
  // across the cover, over the fore edge, then hanging down the front.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.001, 0),
    new THREE.Vector3(0.004, 0.001, 0.085),
    new THREE.Vector3(0.007, -0.002, 0.118),
    new THREE.Vector3(0.009, -0.028, 0.133),
    new THREE.Vector3(0.011, -0.1, 0.137),
    new THREE.Vector3(0.013, -0.19, 0.133),
    new THREE.Vector3(0.015, -0.25, 0.128),
  ]);

  const SEG = 22;
  const pos = new Float32Array((SEG + 1) * 2 * 3);
  const idx = [];
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG;
    const p = curve.getPointAt(u);
    // A ribbon narrows a little toward the cut end and is never perfectly
    // straight; the drift is what stops it reading as a plastic tag.
    const w = RIBBON_W * (1 - 0.16 * u * u);
    pos.set([-w / 2, p.y, p.z], i * 6);
    pos.set([w / 2, p.y, p.z], i * 6 + 3);
    if (i < SEG) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x8c2f27,
    roughness: 0.84,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    bumpMap: bump,
    bumpScale: 0.0012,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.visible = false;
  mesh.frustumCulled = false;
  book.markerAnchor.add(mesh);
  ribbon.mesh = mesh;
}

const ribbonShown = () => lastPage !== null && !!book && book.openness < 0.14;

function updateRibbon(dt) {
  if (!ribbon.mesh) return;
  const target = ribbonShown() ? 1 : 0;
  ribbon.opacity += (target - ribbon.opacity) * (1 - Math.exp(-7 * dt));
  if (ribbon.opacity < 0.01) ribbon.opacity = 0;
  ribbon.mesh.material.opacity = ribbon.opacity;
  ribbon.mesh.visible = ribbon.opacity > 0.005;
  ribbon.hover += ((ribbonHitLast ? 1 : 0) - ribbon.hover) * (1 - Math.exp(-10 * dt));
  // Lifting the tail is the whole hover state: the marker is cloth, so it
  // moves instead of changing colour.
  ribbon.mesh.rotation.x = -0.11 * ribbon.hover;
}

function pickRibbon(e) {
  if (!ribbon.mesh || !ribbon.mesh.visible || ribbon.opacity < 0.35) return false;
  const rect = canvas.getBoundingClientRect();
  setNdc(e, rect);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(ribbon.mesh, false).length > 0;
}

// The lamp hangs on the back wall, so this is only consulted when the ray has
// already missed every page.
function pickLamp(e) {
  const rect = canvas.getBoundingClientRect();
  setNdc(e, rect);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(lamp, true).length > 0;
}

function resumeProject() {
  if (lastPage === null || !book) return;
  sound.unlock();
  goToTarget(spreadForPage(lastPage));
  // The overlay opens once the cover has swung far enough to read as a book
  // being opened, rather than landing on a closed cover.
  setTimeout(() => openProjectIndex(lastPage), 460);
}

function recordLast(index) {
  lastPage = index;
  writeLast(index);
}

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
  buildRibbon(paperBump);

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
    window.__lamp = lamp;
    window.__lampState = () => ({ on: lampOn, mix: lampMix });
    window.__pick = (x, y) => faceAt({ clientX: x, clientY: y });
    window.__project = (x, y, z) => {
      const v = new THREE.Vector3(x, y, z).project(camera);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height };
    };
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

// The book is 3.25 units wide when open and 1 unit deep. On a portrait phone
// the horizontal field of view is only about 22 degrees, so the fixed 3.6
// desktop distance cropped both pages off the sides. The home distance is now
// derived from the viewport: far enough back that the whole spread fits, with
// a steeper look on narrow screens so the spread is not a thin ribbon.
function fitDistance(margin) {
  const halfV = (camera.fov * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
  return ((PAGE_W + OV) * margin) / Math.tan(halfH);
}

function applyHomeFraming({ snap = false } = {}) {
  const narrow = window.innerWidth < 720;
  const short = window.innerHeight < 560;
  // A landscape phone has almost no height to give, so the book is allowed to
  // fill the frame. The margin is larger than the portrait one because the
  // near edge of an open spread is closer to the camera than its centre, and
  // at 1.06 the corner still ran off the screen. Aiming slightly below the
  // book moves it up, which is what leaves the chrome a lane at the bottom.
  const dist = short ? fitDistance(1.5) : Math.max(3.6, fitDistance(1.12));
  CAM_HOME.dist = dist;
  CAM_TARGET.y = short ? -0.16 : 0.1;
  camState.pitchBase = narrow ? 0.92 : 0.62;
  if (snap) {
    camState.dist = camState.tDist = dist;
    camState.look = { yaw: 0, pitch: 0, dist: 0 };
    camState.lookT = { yaw: 0, pitch: 0, dist: 0 };
  } else {
    camState.tDist = dist;
  }
  paintReset();
}

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

// First paint and every resize land on the same framing rule, so a rotated
// phone is not left looking at a cropped book until it is touched.
applyHomeFraming({ snap: true });
window.addEventListener("resize", () => applyHomeFraming());

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
      // Both boards stay pickable. An open cover lies under its pile, so the
      // nearest hit is still the page; the case this used to break was the
      // face-down back cover, which sits on top and could not be clicked at
      // all once it had swung past ninety degrees.
      meshes.push(it.board);
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

// Sheet items are 1..N. NI is the target past the back board, not an item,
// so the upper bound has to be NI - 1; using NI made the back cover look like
// a page that could be opened, which swallowed every click on it.
const isSheet = (k) => k > 0 && k < book.NI - 1;
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
  // The same state, visible, because on a phone the spread is small enough
  // that the page titles alone do not tell you where in the book you are.
  if (spreadCount) {
    spreadCount.textContent =
      book.target === 0 ? "Cover" : book.target >= book.NI ? "Back" : `${String(book.target).padStart(2, "0")} / ${String(book.NI - 1).padStart(2, "0")}`;
  }
  document.body.classList.toggle("book-open", book.target > 0 && book.target < book.NI);
}

// A page index (0..9) to the spread that shows it. Page p is the right hand
// page of spread p/2 + 1 when p is even, and the left hand page of the spread
// after it when p is odd.
function spreadForPage(index) {
  return Math.min(book.NI - 1, Math.ceil((index + 2) / 2));
}

function jumpToPage(index) {
  if (!book) return;
  book.jump(spreadForPage(index));
  syncHash();
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
  return openProjectIndex(pageIndexOf(hit));
}

function openProjectIndex(index) {
  const page = pages[index];
  if (!page) return false;
  recordLast(index);
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

// The contents sheet is the second way into the book, and the only one that
// does not depend on hitting a moving 3D target. It is built once, from the
// same list that paints the covers.
let contentsBuilt = false;
function buildContents() {
  if (contentsBuilt) return;
  contentsBuilt = true;
  const list = document.getElementById("contents-list");
  PROJECT_LIST.forEach((project, index) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "contents-item";

    const num = document.createElement("span");
    num.className = "contents-num";
    num.textContent = String(index + 1).padStart(2, "0");

    const name = document.createElement("span");
    name.className = "contents-name";
    name.textContent = project.title;

    const kicker = document.createElement("span");
    kicker.className = "contents-kicker";
    kicker.textContent = project.kicker;

    button.append(num, name, kicker);
    button.addEventListener("click", () => {
      document.getElementById("contents-dialog").close();
      jumpToPage(index);
      openProjectIndex(index);
    });
    li.append(button);
    list.append(li);
  });
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
}// The Contents sheet and the sound pill are both reachable from the keyboard,
// so their handlers live at module scope and the buttons, the keys and the
// dialog all call the same two functions.
function openContents() {
  const dialog = document.getElementById("contents-dialog");
  if (!dialog || dialog.open) return;
  buildContents();
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  const first = document.querySelector(".contents-item");
  if (first) first.focus({ preventScroll: true });
}

function paintSound() {
  const el = document.getElementById("sound-toggle");
  const on = !sound.isMuted();
  el.setAttribute("aria-pressed", String(on));
  el.textContent = on ? "Sound on" : "Sound off";
}

function toggleSound() {
  sound.setMuted(!sound.isMuted());
  if (!sound.isMuted()) sound.unlock();
  paintSound();
}

function wireUi() {
  document.getElementById("site-back").addEventListener("click", closeSite);

  const contentsDialog = document.getElementById("contents-dialog");
  const contentsOpen = document.getElementById("contents-open");
  const contentsClose = document.getElementById("contents-close");
  contentsOpen.addEventListener("click", openContents);
  contentsClose.addEventListener("click", () => contentsDialog.close());

  // The spread lives in the hash, so the link is already shareable; this is
  // the affordance that tells people so. The label reports the result in
  // place, and the status line does it for screen readers.
  const copyBtn = document.getElementById("contents-copy");
  const copyStatus = document.getElementById("copy-status");
  copyBtn.addEventListener("click", async () => {
    const url = location.origin + location.pathname + (book.target ? `#${book.target}` : "");
    const ok = await copyText(url);
    clearTimeout(copyTimer);
    copyBtn.textContent = ok ? "Link copied" : "Copy failed";
    copyBtn.classList.toggle("is-done", ok);
    if (copyStatus) copyStatus.textContent = ok ? "Spread link copied to the clipboard." : "Could not reach the clipboard. Select the address bar instead.";
    copyTimer = setTimeout(() => {
      copyBtn.textContent = "Copy page link";
      copyBtn.classList.remove("is-done");
      if (copyStatus) copyStatus.textContent = "";
    }, 1900);
  });
  // A click on the sheet itself lands outside the panel, since the panel is
  // the dialog's only child; closing there is the expected dialog behaviour.
  contentsDialog.addEventListener("click", (e) => {
    if (e.target === contentsDialog) contentsDialog.close();
  });
  // The close event is queued, so a project picked from the list may already
  // have opened by the time it fires. In that case the back button owns focus.
  contentsDialog.addEventListener("close", () => {
    if (document.getElementById("site-frame").hidden) contentsOpen.focus({ preventScroll: true });
  });

  document.getElementById("sound-toggle").addEventListener("click", toggleSound);
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
    else if (e.key === "c" || e.key === "C") openContents();
    else if (e.key === "s" || e.key === "S") toggleSound();
    else if (e.key === "l" || e.key === "L") toggleLamp();
  });

  window.addEventListener("hashchange", () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (Number.isFinite(n)) book.goTo(n, clock());
  });

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", (e) => endPointer(e));
  canvas.addEventListener("pointerleave", () => {
    pointerLight.tx = 0;
    pointerLight.ty = 0;
    ribbonHitLast = false;
    book.setHover(-1);
    hideHint();
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("wheel", onWheel, { passive: false });
}

const pointer = { down: null, swipe: null };

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

let wheelAcc = 0;
let wheelAt = 0;

function onWheel(e) {
  if (overlayOpen) return;
  e.preventDefault();
  // A trackpad two-finger flick is horizontal. That has never meant zoom in
  // any browser, so it turns pages instead; vertical stays on the camera.
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.15) {
    wheelAcc += e.deltaX;
    const now = performance.now();
    if (Math.abs(wheelAcc) > 80 && now - wheelAt > 520) {
      goToTarget(book.target + (wheelAcc > 0 ? 1 : -1));
      wheelAcc = 0;
      wheelAt = now;
    }
    return;
  }
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
    pointer.swipe = null;
    startLookGesture(e.pointerId);
    return;
  }

  // The marker sits on top of the closed cover, so it has to be tested before
  // the cover it lies on or it could never be clicked.
  if (e.button === 0 && pickRibbon(e)) {
    sound.unlock();
    pointer.down = { id: e.pointerId, x: e.clientX, y: e.clientY, ribbon: true, moved: false };
    canvas.style.cursor = "pointer";
    return;
  }

  const hit = e.button === 2 ? null : faceAt(e);
  // The lamp sits behind the book, so it is only a candidate once the ray has
  // missed the pages; a click that lands on a sheet must stay a page click.
  if (e.button === 0 && !hit && pickLamp(e)) {
    sound.unlock();
    toggleLamp();
    return;
  }
  if (!hit) {
    // One finger on the table is a page swipe; two fingers are the camera.
    // On a portrait phone the book is a band in the middle of the screen, so
    // requiring the swipe to start on a page made turning needlessly fussy.
    if (e.pointerType === "touch") {
      pointer.swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, type: "swipe" };
      return;
    }
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

  if (e.pointerType !== "touch") {
    pointerLight.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointerLight.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }

  if (pointer.swipe && pointer.swipe.id === e.pointerId) return;

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
    hoverAt(e);
    return;
  }
  if (d.id !== e.pointerId) return;
  if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) {
    d.moved = true;
    // Sheets turn one at a time; the front board pulls open like a cover.
    if (!book.drag && d.hit && isSheet(d.hit.k)) {
      const it = book.items[d.hit.k];
      if (it && !it.active && !it.dragging) {
        const dir = d.hit.side > 0 ? 1 : -1;
        const world = pickX(e);
        d.dragging = book.beginDrag(d.hit.k, dir, world ? world.x : dir * PAGE_W, d.hit.side, clock());
      }
    } else if (!book.drag && d.hit && d.hit.k === 0) {
      const world = pickX(e);
      if (world) d.dragging = book.beginCoverDrag(0, world.x, clock());
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

  const sw = pointer.swipe;
  if (sw && (!e || sw.id === e.pointerId)) {
    pointer.swipe = null;
    // A cancelled pointer is not a gesture the visitor finished.
    if (e && e.type !== "pointercancel") {
      const dx = e.clientX - sw.x;
      const dy = e.clientY - sw.y;
      if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        goToTarget(book.target + (dx < 0 ? 1 : -1));
      }
    }
    return;
  }

  const d = pointer.down;
  if (!d || (e && d.id !== e.pointerId)) return;
  pointer.down = null;
  canvas.style.cursor = "default";
  if (d.ribbon) {
    if (!d.moved) resumeProject();
    return;
  }
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
  // The back board is item NI - 1; NI is the target past it, which is why this
  // comparison used to miss and the face-down cover did nothing.
  else if (d.hit.k === book.NI - 1) goToTarget(book.target >= book.NI ? book.NI - 1 : book.NI);
}

// One label for both hover targets: a page names the project it opens, and
// the ribbon says what it will take you back to. It is a caption, so it sits
// next to the pointer and never takes the click.
function showHint(title, meta, e) {
  if (!hintEl || !canHover.matches || !e) return;
  if (hintEl.dataset.title !== title) {
    hintTitle.textContent = title;
    hintMeta.textContent = meta;
    hintEl.dataset.title = title;
  }
  hintMeta.textContent = meta;
  hintEl.hidden = false;
  const box = { w: hintEl.offsetWidth, h: hintEl.offsetHeight };
  const pad = 16;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  if (x + box.w > window.innerWidth - 12) x = e.clientX - box.w - pad;
  if (y + box.h > window.innerHeight - 12) y = e.clientY - box.h - pad;
  hintEl.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
}

function hideHint() {
  if (hintEl && !hintEl.hidden) hintEl.hidden = true;
}

function hoverAt(e) {
  if (overlayOpen || book.busy) {
    ribbonHitLast = false;
    book.setHover(-1);
    canvas.style.cursor = "default";
    hideHint();
    return;
  }
  if (pickRibbon(e)) {
    ribbonHitLast = true;
    book.setHover(-1);
    canvas.style.cursor = "pointer";
    showHint(PROJECT_LIST[lastPage].title, "Pick up where you left off", e);
    return;
  }
  ribbonHitLast = false;
  const hit = faceAt(e);
  if (!hit && pickLamp(e)) {
    book.setHover(-1);
    canvas.style.cursor = "pointer";
    showHint("Wall lamp", lampOn ? "Click to dim the room" : "Click to bring it up", e);
    return;
  }
  if (!hit) {
    book.setHover(-1);
    canvas.style.cursor = "default";
    hideHint();
    return;
  }
  canvas.style.cursor = "pointer";
  if (!isSheet(hit.k)) {
    book.setHover(-1);
    // A closed book is an object you can pull open, so the cover says so.
    if (hit.k === 0 && book.items[0].p < 0.02) {
      canvas.style.cursor = "grab";
      showHint("Portfolio 2026", "Pull the cover open", e);
    } else if (hit.k === book.NI - 1 && book.items[book.NI - 1].p > 0.98) {
      canvas.style.cursor = "pointer";
      showHint("Back cover", "Click to open the book again", e);
    } else hideHint();
    return;
  }
  const it = book.items[hit.k];
  if (!it || it.active || it.dragging) {
    book.setHover(-1);
    hideHint();
    return;
  }
  const project = PROJECT_LIST[pageIndexOf(hit)];
  if (project) showHint(project.title, project.embed ? "Open project" : "Open project page", e);
  const edge = 0.3 + 0.7 * smooth01(Math.abs(hit.u - 0.5) * 2);
  book.setHover(hit.k, edge, hit.side);
}

// Clipboard write needs a secure context and a user gesture. On the file://
// or plain http check the API can be missing, so the textarea fallback keeps
// the button honest instead of silently doing nothing.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
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
  updateRoom(t, dt);
  if (book.update(t, dt)) renderer.shadowMap.needsUpdate = true;
  updateRibbon(dt);
  renderer.render(scene, camera);
}

start().then(() => {
  const startHash = parseInt(location.hash.slice(1), 10);
  if (Number.isFinite(startHash) && startHash > 0) {
    book.jump(startHash);
    syncHash();
  }
});

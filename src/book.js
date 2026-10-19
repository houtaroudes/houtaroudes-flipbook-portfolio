import * as THREE from "three";

// Book: rigid covers + CPU-deformed curl sheets. Behavioral recreation of the
// flip-book architecture observed on the reference site, with original art.

const PI = Math.PI;

export const PAGE_W = 16 / 10; // sheet width in world units; sheet height = 1
export const OV = 0.026;   // cover overshoot
export const C = 0.024;    // cover board thickness
export const G = 0.0065;   // gap between sheets
export const COLS = 45;    // sheet grid resolution (columns across the width)
export const ROWS = 13;    // rows across the height

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const clamp01 = (x) => clamp(x, 0, 1);
const smooth01 = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const spring = (t) => 1 - Math.pow(1 - t, 3);        // easeOutCubic
const stiff = (t) => 1 - Math.pow(1 - t, 4.2);       // steeper settle for drag release
const expEase = (cur, to, k, dt) => cur + (to - cur) * (1 - Math.exp(-k * dt));

export class Book {
  constructor({ sheets, paper, boards, paperBump }) {
    this.W = PAGE_W;
    this.H = 1;                      // sheet height (z span)
    this.ov = OV;
    this.c = C;
    this.g = G;
    this.Wc = this.W + this.ov;
    this.Hc = this.H + this.ov * 2;
    this.N = sheets.length;
    this.NI = this.N + 2;
    this.T = 2 * this.c + (this.N + 1) * this.g;  // total stack thickness
    this.paper = paper;
    // Three shared fibre maps at three scales: one tile is tiny next to a
    // whole sheet, so each surface gets its own repeat setting.
    this.bumpSheet = paperBump ? paperBump.clone() : null;
    this.bumpCover = paperBump ? paperBump.clone() : null;
    this.bumpEdge = paperBump ? paperBump.clone() : null;
    [[this.bumpSheet, 6, 4], [this.bumpCover, 3, 2], [this.bumpEdge, 1, 6]].forEach(([tex, rx, ry]) => {
      if (!tex) return;
      tex.needsUpdate = true;
      tex.repeat.set(rx, ry);
    });
    this.target = 0;
    this.drag = null;
    this.items = [];

    this.root = new THREE.Group();
    this.inner = new THREE.Group();
    this.root.add(this.inner);

    this.#makeCover(0, { outer: boards.front, inner: boards.innerFront }, true);
    sheets.forEach((pair, i) => this.#makeSheet(i, pair));
    this.#makeCover(this.NI - 1, { outer: boards.back, inner: boards.innerBack }, false);
    this.#makeEdgeBlocks();
    this.#makeSpine();
    // Anchor for the ribbon marker: on the top face of the closed block, near
    // the fore edge so the tail hangs over the edge the camera faces instead
    // of disappearing behind the book. It lives on the inner group so it
    // travels with the spine when the covers swing open.
    this.markerAnchor = new THREE.Group();
    this.markerAnchor.position.set(this.Wc - 0.2, this.T / 2 + 0.001, this.Hc / 2 - 0.13);
    this.inner.add(this.markerAnchor);
    this.items.forEach((it) => this.#applyPose(it));
    this.#layout();
  }

  // Resting heights in centered book coords (book bottom at -T/2, top at +T/2):
  // right pile base = closed back cover inner face, growing upward;
  // left pile base = opened front cover inner face (y = -T/2 + c), growing upward.
  hRight(i) { return this.T / 2 - this.c - (i - 0.5) * this.g; }
  hLeft(i) { return -this.T / 2 + this.c + (i - 0.5) * this.g; }

  #makeCover(k, faces, isFront) {
    const { Wc, c, Hc, T } = this;
    const it = this.#newItem(k, "cover");

    const boardMat = new THREE.MeshStandardMaterial({ color: 0x2a2521, roughness: 0.5, metalness: 0, bumpMap: this.bumpCover, bumpScale: 0.0014 });
    // Outer face is the printed cover, inner face is the endpaper. A box face
    // maps its texture the same way up as the board's own +y side, so the
    // underside prints 180 degrees round and has to be turned to read right
    // once the board has swung over.
    const mkArt = (tex, rough, turn) => {
      if (!tex) return this.#papered(null, {}, this.bumpCover);
      if (turn) {
        tex.center.set(0.5, 0.5);
        tex.rotation = PI;
        tex.needsUpdate = true;
      }
      return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: rough,
        metalness: 0,
        bumpMap: this.bumpCover,
        bumpScale: 0.0018,
      });
    };
    // Box face order: [+x, -x, +y(top), -y(bottom), +z, -z].
    const topMat = mkArt(isFront ? faces.outer : faces.inner, isFront ? 0.46 : 0.82, false);
    const botMat = mkArt(isFront ? faces.inner : faces.outer, isFront ? 0.82 : 0.46, true);
    const mats = [boardMat, boardMat, topMat, botMat, boardMat, boardMat];

    // Cover pivots at the spine center (y=0); board sits at its own slab.
    const board = new THREE.Mesh(new THREE.BoxGeometry(Wc, c, Hc), mats);
    board.position.set(Wc / 2, isFront ? T / 2 - c / 2 : -(T / 2 - c / 2), 0);
    board.castShadow = true;
    board.receiveShadow = true;

    const pivot = new THREE.Group();
    pivot.position.set(0, 0, 0);
    pivot.add(board);
    this.inner.add(pivot);
    Object.assign(it, { pivot, board });
  }

  #makeSheet(i, pair) {
    const { W } = this;
    const it = this.#newItem(i + 1, "sheet");

    const verts = ROWS * COLS;
    const pos = new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const norF = new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const norB = new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const uvF = new Float32Array(verts * 2);
    const uvB = new Float32Array(verts * 2);
    const spine = new Float32Array(verts);
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const n = r * COLS + col;
        const u = col / COLS;
        const v = 1 - r / ROWS;
        uvF.set([u, v], n * 2);
        uvB.set([1 - u, v], n * 2); // mirrored u so text reads correctly when flipped
        spine[n] = u;
      }
    }
    // Front sheet winding faces up at rest; back sheet reversed so it faces
    // down at rest and up after the page flips over the spine.
    const idxF = [];
    const idxB = [];
    for (let r = 0; r < ROWS - 1; r++) {
      for (let col = 0; col < COLS - 1; col++) {
        const a = r * COLS + col;
        const b = a + 1;
        const d = a + COLS;
        const e2 = d + 1;
        idxF.push(a, d, b, b, d, e2);
        idxB.push(a, b, d, d, b, e2);
      }
    }
    const mkGeo = (uvs, idx, nor) => {
      const geo = new THREE.BufferGeometry();
      geo.setIndex(idx);
      geo.setAttribute("position", pos);
      geo.setAttribute("normal", nor);
      geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      geo.setAttribute("aSpine", new THREE.BufferAttribute(spine, 1));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), W + 0.4);
      return geo;
    };
    const geoF = mkGeo(uvF, idxF, norF);
    const geoB = mkGeo(uvB, idxB, norB);

    const mkMat = (map) => this.#papered(map, { shadowSide: THREE.DoubleSide });    const front = new THREE.Mesh(geoF, mkMat(pair.front));
    const back = new THREE.Mesh(geoB, mkMat(pair.back));
    back.castShadow = false;
    [front, back].forEach((m) => {
      m.frustumCulled = false;
      this.inner.add(m);
    });
    Object.assign(it, { geo: geoF, geoB, front, back, W, H: 1, hR: this.hRight(i + 1) });
  }

  #papered(map, extra = {}, bump = this.bumpSheet) {
    return new THREE.MeshStandardMaterial({
      ...(map ? { map } : {}),
      ...(bump ? { bumpMap: bump, bumpScale: 0.0022 } : {}),
      roughness: map ? 0.78 : 0.95,
      metalness: 0,
      ...extra,
    });
  }

  #makeEdgeBlocks() {
    const mk = () => {
      const tex = this.paper.clone();
      tex.needsUpdate = true;
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, bumpMap: this.bumpEdge, bumpScale: 0.0026 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
      m.castShadow = true;
      m.receiveShadow = true;
      this.inner.add(m);
      return m;
    };
    this.blockR = mk();
    this.blockL = mk();
  }

  #makeSpine() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a2521, roughness: 0.5 });
    // Unit box scaled each frame: full T height closed, flattens as pages turn.
    this.spine = new THREE.Mesh(new THREE.BoxGeometry(this.c, 1, this.Hc), mat);
    this.spine.castShadow = true;
    this.spine.receiveShadow = true;
    this.inner.add(this.spine);
  }

  #newItem(k, kind) {
    const it = {
      k, kind,
      p: 0, from: 0, to: 0, t0: 0, dur: 1, dir: 1,
      ease: spring, active: false, dragging: false,
      curl: 1.15, twistSign: 1,
      hover: 0, hoverTarget: 0, hoverDir: 1,
      dirty: true, moving: false,
    };
    this.items[k] = it;
    return it;
  }

  get frontCoverBoard() { return this.items[0].board; }
  // 0 = closed, 1 = fully open.
  get openness() { return (this.items[0].p + this.items[this.NI - 1].p) / 2; }

  // ---- pose + deformation --------------------------------------------------

  #applyPose(it) {
    it.moving = (it.p > 0 && it.p < 1) || it.hover > 0.002;
    if (it.kind === "cover") {
      const ang = clamp(PI * it.p + it.hoverDir * it.hover * 0.06, 0, PI);
      it.pivot.rotation.z = isFinite(ang) ? ang : 0;
    } else {
      if (it.hover > 0.002 && !it.active && !it.dragging) it.dir = it.hoverDir;
      this.#deform(it);
      it.front.castShadow = it.moving;
      it.front.receiveShadow = !it.moving;
      it.back.receiveShadow = !it.moving;
    }
  }

  #deform(it) {
    const { W } = this;
    const arr = it.geo.attributes.position.array;
    const p = it.p;
    const dir = it.dir;
    // Page swings around the spine center: rest heights mirror through y=0.
    const turnY = (1 - 2 * p) * it.hR;
    const curlAmp = Math.sin(PI * p) * it.curl;
    const hv = it.hover * 0.3;
    // Peel near the spine, only while the page is actually lifting. Leaving a
    // static tilt on a resting page makes the pile sink through itself, and a
    // negative one at the end of a turn drives the sheet down into the pile
    // below it.
    const cornerLift = p < 0.5 ? 0.12 * Math.sin(PI * clamp01(p * 2)) : 0;
    const step = W / COLS;
    let o = 0;
    for (let row = 0; row <= ROWS - 1; row++) {
      const f = row / (ROWS - 1) - 0.5;
      const side = f * it.twistSign;
      const m = f * this.H;
      let x = 0;
      let y = turnY;
      arr[o++] = 0; arr[o++] = y; arr[o++] = m;
      for (let col = 1; col < COLS; col++) {
        const t = (col - 0.5) / COLS;
        let a = PI * p + dir * (curlAmp * (Math.pow(t, 1.6) - 0.38 + 0.45 * side * t) + hv * smooth01((t - 0.4) / 0.6) * (0.65 + 0.7 * side));
        a = clamp(a, 0, PI);
        if (t < 0.3) a += cornerLift * Math.cos((PI * t) / 0.3);
        x += Math.cos(a) * step;
        y += Math.sin(a) * step;
        arr[o++] = x; arr[o++] = y; arr[o++] = m;
      }
    }
    it.geo.attributes.position.needsUpdate = true;
    it.geo.computeVertexNormals();
    // Back geometry mirrors positions; normals negate with the flipped winding.
    const arrB = it.geoB.attributes.position.array;
    arrB.set(arr);
    it.geoB.attributes.position.needsUpdate = true;
    const nf = it.geo.attributes.normal.array;
    const nb = it.geoB.attributes.normal.array;
    for (let i = 0; i < nf.length; i += 3) {
      nb[i] = -nf[i]; nb[i + 1] = -nf[i + 1]; nb[i + 2] = -nf[i + 2];
    }
    it.geoB.attributes.normal.needsUpdate = true;
  }

  // The top face of each pile. Sheets turn in order, so the right pile is
  // topped by the lowest unturned sheet and the left pile by the highest
  // turned one. Picking the first turned sheet instead would pin the left page
  // to sheet 1 for the whole book.
  #state() {
    let right = -1, left = -1;
    for (let n = 1; n <= this.N; n++) {
      const it = this.items[n];
      if (it.moving) continue;
      if (it.p <= 0 && right < 0) right = n;
      if (it.p >= 1) left = n;
    }
    return { right, left };
  }

  #layout() {
    const { W, Wc, c, g, T } = this;
    const fc = this.items[0].p;
    const bc = this.items[this.NI - 1].p;
    // Keep the pile centered under the camera as covers swing out.
    this.inner.position.x = -(Wc / 2) * (1 - fc) + (Wc / 2) * bc;

    const { right, left } = this.#state();
    const base = -T / 2 + c; // both piles rest on a cover inner face at this height

    const showBlock = (block, topY, sign) => {
      const h = topY - base - g * 0.5;
      block.visible = h > c * 0.4;
      if (!block.visible) return;
      const w = W - 0.008;
      block.scale.set(w, h, this.H - 0.004);
      block.position.set(sign * (0.006 + w / 2), base + h / 2, 0);
      if (block.material.map) block.material.map.repeat.set(1, Math.max(1, Math.round(h / this.g)));
    };
    // Right stack tops out just under the first unturned sheet.
    showBlock(this.blockR, right > 0 ? this.hRight(right) : base, 1);
    // Left stack tops out just under the last flipped sheet.
    showBlock(this.blockL, left > 0 ? this.hLeft(left) : base, -1);

    for (let n = 1; n <= this.N; n++) {
      const it = this.items[n];
      const vis = it.moving || n === right || n === left;
      it.front.visible = it.back.visible = vis;
    }

    // Spine: full height closed, flattens toward a thin strip when open.
    const h = c + (T - c) * (1 - (fc + bc) / 2);
    this.spine.scale.set(1, h, 1);
    this.spine.position.set(0, -T / 2 + h / 2, 0);
  }

  // ---- interaction ---------------------------------------------------------

  goTo(e, t) {
    e = Math.round(clamp(e, 0, this.NI));
    if (e === this.target || this.drag) return false;
    const big = Math.abs(e - this.target) > 1;
    const stagger = big ? 0.09 : 0;
    let i = 0;
    if (e > this.target) {
      for (let a = this.target; a < e; a++, i += stagger) this.#animate(this.items[a], 1, t, i);
    } else {
      for (let a = this.target - 1; a >= e; a--, i += stagger) this.#animate(this.items[a], 0, t, i);
    }
    this.target = e;
    return true;
  }

  jump(e) {
    this.target = Math.round(clamp(e, 0, this.NI));
    this.items.forEach((it, i) => {
      Object.assign(it, { p: +(i < this.target), active: false, dragging: false, dirty: true });
    });
  }

  setHover(e, t, n) {
    this.items.forEach((it, i) => {
      it.hoverTarget = i === e ? t : 0;
      if (i === e) {
        it.hoverDir = n;
        it.twistSign = 1;
      }
    });
  }

  beginDrag(e, dir, x, twistSign, t) {
    const it = this.items[e];
    if (!it || it.active || this.drag) return false;
    this.setHover(-1);
    Object.assign(it, { dragging: true, dir, curl: 1.35, twistSign: twistSign >= 0 ? 1 : -1 });
    const x0 = dir > 0 ? Math.max(x, this.W * 0.35) : Math.min(x, -this.W * 0.35);
    if (x0 === 0) { it.dragging = false; return false; }
    this.drag = { it, dir, x0, samples: [{ t, p: it.p }] };
    return true;
  }

  dragTo(x, t) {
    const d = this.drag;
    if (!d) return;
    if (d.cover) {
      // A cover has no curl to aim at, so the pull maps straight onto the
      // angle: one board width of travel swings it through 180 degrees.
      d.it.p = clamp(d.p0 + (d.x0 - x) / this.Wc, 0, 1);
      d.it.dirty = true;
    } else {
      const r = clamp(x / d.x0, -1, 1);
      const ang = Math.acos(r) / PI;
      d.it.p = d.dir > 0 ? ang : 1 - ang;
      d.it.dirty = true;
    }
    d.samples.push({ t, p: d.it.p });
    while (d.samples.length > 2 && t - d.samples[0].t > 0.12) d.samples.shift();
  }

  // The front board can be pulled open like a real cover. Only from closed:
  // dragging a board that is already lying flat is a knuckle against a table.
  beginCoverDrag(k, x, t) {
    const it = this.items[k];
    if (!it || it.kind !== "cover" || this.drag || it.active || it.p > 0.02) return false;
    this.setHover(-1);
    it.dragging = true;
    this.drag = { it, cover: true, x0: x, p0: it.p, samples: [{ t, p: it.p }] };
    return true;
  }

  endDrag(t) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const { it } = d;
    const s0 = d.samples[0];
    const s1 = d.samples[d.samples.length - 1];
    const vel = s1.t > s0.t ? (s1.p - s0.p) / (s1.t - s0.t) : 0;
    const done = vel > 0.9 || (vel > -0.9 && it.p > 0.5);
    it.dragging = false;
    this.#animate(it, done ? 1 : 0, t, 0, 0.75, stiff);
    it.curl = 1.15;
    // A cover settles into an end state rather than a neighbouring page: open
    // front board means spread 1, shut means the closed cover.
    if (it.kind === "cover" && it.k === 0) this.target = done ? 1 : 0;
    else this.target = done ? it.k + 1 : it.k;
  }

  get busy() {
    return !!this.drag || this.items.some((it) => it.active);
  }

  #animate(it, to, t, delay = 0, dur, ease) {
    if (it.p === to && !it.active) return;
    it.from = it.p;
    it.to = to;
    it.t0 = t + delay;
    it.dur = dur ?? 0.95;
    it.ease = ease ?? spring;
    it.active = true;
  }

  update(t, dt) {
    let dirty = false;
    for (const it of this.items) {
      if (it.active && !it.dragging) {
        const u = (t - it.t0) / it.dur;
        if (u >= 0) {
          it.p = it.from + (it.to - it.from) * it.ease(clamp01(u));
          if (u >= 1) { it.p = it.to; it.active = false; }
          it.dirty = true;
        }
      }
      const hd = it.hoverTarget === it.hover ? it.hover : expEase(it.hover, it.hoverTarget, 10, dt);
      if (Math.abs(hd - it.hover) > 0.0004) it.dirty = true;
      it.hover = hd;
      if (it.dirty) {
        this.#applyPose(it);
        it.dirty = false;
        dirty = true;
      }
    }
    this.#layout();
    return dirty;
  }

  faceOf(mesh) {
    for (const it of this.items) {
      if (it.kind === "cover" && it.board === mesh) return it.k;
      else if (it.kind === "sheet" && (it.front === mesh || it.back === mesh)) return it.k;
    }
    return -1;
  }

  faceIndex(mesh) {
    for (const it of this.items) {
      if (it.kind === "sheet") {
        if (it.front === mesh) return 0;
        if (it.back === mesh) return 1;
      }
    }
    return 0;
  }
}

import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Book } from "../src/book.js";
import { pickMeshes, isSheet, pageIndexOf, coverTarget } from "../src/faces.js";

// Ten projects, five sheets, seven item slots: the front board, five sheets and
// the back board. The back board is item NI - 1, not NI, and that difference is
// what broke it once already.
const PAGES = 10;
const SHEETS = PAGES / 2;

// Book only ever wants textures, so a one-pixel data texture stands in for each
// print. Identity matters more than pixels here: a hit is checked against the
// page it should have opened.
function tex() {
  const t = new THREE.DataTexture(new Uint8Array([16, 16, 16, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

const pageTex = Array.from({ length: PAGES }, tex);
const boards = { front: tex(), innerFront: tex(), back: tex(), innerBack: tex() };

function buildBook() {
  const sheets = [];
  for (let i = 0; i < SHEETS; i++) {
    sheets.push({ front: pageTex[i * 2], back: pageTex[i * 2 + 1] });
  }
  const book = new Book({ sheets, paper: tex(), boards, paperBump: tex() });
  // main.js lifts the book so the pile rests on the table; a click test needs
  // the same stage, or the rays come in at the wrong height.
  book.root.position.y = book.T / 2 + 0.0015;
  return book;
}

function stage(book) {
  const camera = new THREE.PerspectiveCamera(38, 1.6, 0.05, 50);
  camera.position.set(1.5, 1.35, 3.1);
  camera.lookAt(0, 0.1, 0);
  camera.updateMatrixWorld();
  return camera;
}

function spread(book, target) {
  book.jump(target);
  book.update(1, 1 / 60);
  book.root.updateMatrixWorld(true);
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

// The same ray main.js casts, minus the canvas rectangle: fx and fy are screen
// fractions, not pixels.
function click(book, camera, fx, fy) {
  ndc.set(fx * 2 - 1, -(fy * 2 - 1));
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(pickMeshes(book), false)[0];
  if (!hit) return null;
  return { k: book.faceOf(hit.object), side: hit.point.x >= 0 ? 1 : -1, mesh: hit.object };
}

// A click sweep at one spread: what lands on each half of the book.
function sweep(book, camera) {
  const hits = [];
  const cols = 48;
  const rows = 32;
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const hit = click(book, camera, (x + 0.5) / cols, (y + 0.5) / rows);
      if (hit) hits.push(hit);
    }
  }
  return hits;
}

test("every spread is clickable on both pages, and each hit names the page it printed", () => {
  const book = buildBook();
  const camera = stage(book);
  const NI = book.NI;
  assert.equal(NI, SHEETS + 2);

  for (let target = 1; target < NI; target++) {
    spread(book, target);
    const hits = sweep(book, camera);
    assert.ok(hits.length > 0, `spread ${target}: nothing under the pointer`);

    const left = hits.filter((h) => h.side < 0);
    const right = hits.filter((h) => h.side > 0);
    assert.ok(left.length > 0, `spread ${target}: the left page cannot be clicked`);
    assert.ok(right.length > 0, `spread ${target}: the right page cannot be clicked`);

    for (const hit of hits) {
      assert.ok(hit.k >= 0, "a pickable mesh must belong to an item");
      assert.ok(hit.k < NI, `item ${hit.k} is past the last board`);
      if (!isSheet(hit.k, NI)) continue;
      const index = pageIndexOf(hit.k, hit.side);
      assert.ok(
        index >= 0 && index < PAGES,
        `spread ${target}: sheet ${hit.k} side ${hit.side} resolved to page ${index}`,
      );
      assert.equal(
        hit.mesh.material.map,
        pageTex[index],
        `spread ${target}: the page under the pointer should be page ${index}`,
      );
    }
  }
});

test("every board and sheet face can be clicked somewhere in the book", () => {
  const book = buildBook();
  const camera = stage(book);
  const seen = new Set();

  for (let target = 0; target <= book.NI; target++) {
    spread(book, target);
    for (const hit of sweep(book, camera)) seen.add(hit.mesh);
  }

  for (const mesh of pickMeshes(book)) {
    assert.ok(seen.has(mesh), "a mesh in the pick set was never reached by a click");
  }

  // Both boards specifically, at the two ends of the book, because those are
  // the clicks that regressed.
  spread(book, 0);
  const closed = sweep(book, camera).find((h) => h.k === 0);
  assert.ok(closed, "the front cover is not clickable while the book is closed");
  assert.equal(coverTarget(0, book.NI, 0), 1, "the front cover should open the book");

  spread(book, book.NI);
  const last = book.NI - 1;
  const back = sweep(book, camera).find((h) => h.k === last);
  assert.ok(back, "the back cover is not clickable at the end of the book");
  assert.equal(back.mesh, book.items[last].board);
  assert.equal(coverTarget(last, book.NI, book.NI), last, "the back cover should reopen the book");
});

test("the back board reads as a cover, never as a page", () => {
  const book = buildBook();
  const NI = book.NI;

  assert.equal(isSheet(NI - 1, NI), false, "the back board must not be treated as a sheet");
  assert.equal(isSheet(NI, NI), false, "NI is a target, not an item");
  assert.equal(isSheet(0, NI), false, "the front board is not a sheet either");
  for (let k = 1; k <= book.N; k++) assert.ok(isSheet(k, NI), `sheet ${k} should be a sheet`);

  // The arithmetic that opened a project from the back cover ran off the end of
  // the page list; keeping the two apart is the fix.
  assert.ok(pageIndexOf(NI - 1, 1) >= PAGES);

  for (let k = 1; k <= book.N; k++) {
    for (const side of [1, -1]) {
      const index = pageIndexOf(k, side);
      assert.ok(index >= 0 && index < PAGES, `sheet ${k} side ${side} is page ${index}`);
    }
  }

  assert.equal(coverTarget(0, NI, 0), 1);
  assert.equal(coverTarget(0, NI, 3), 0);
  assert.equal(coverTarget(NI - 1, NI, NI), NI - 1);
  assert.equal(coverTarget(NI - 1, NI, 0), NI);
  assert.equal(coverTarget(1, NI, 2), null, "a sheet is not a cover");
  assert.equal(coverTarget(NI, NI, 0), null);
});

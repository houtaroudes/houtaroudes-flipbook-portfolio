import test from "node:test";
import assert from "node:assert/strict";
import {
  spreadForPage,
  pageAt,
  spreadCountText,
  pageStatusText,
  spreadLabel,
  readingLight,
  paintReadingLight,
  paintStepper,
} from "../src/chrome.js";

// The chrome is painted through real elements in the app, so the test uses the
// three methods those elements are asked for, and nothing else.
function element() {
  const attrs = new Map();
  const classes = new Set();
  return {
    textContent: "",
    title: "",
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    getAttribute(name) {
      return attrs.has(name) ? attrs.get(name) : null;
    },
    classList: {
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
      contains: (name) => classes.has(name),
    },
  };
}

const NI = 7; // five sheets and two boards
const TITLES = Array.from({ length: 10 }, (_, i) => `Project ${i}`);

test("the reading light pill, its tooltip and the room are one state", () => {
  for (const on of [true, false]) {
    const root = element();
    const btn = element();
    const text = element();
    const painted = paintReadingLight(root, btn, text, on);

    assert.deepEqual(painted, readingLight(on), "the paint and the label must agree");
    assert.equal(root.classList.contains("lamp-off"), !on, "the room follows the pill");
    assert.equal(btn.getAttribute("aria-pressed"), String(on));
    assert.equal(text.textContent, on ? "Lamp on" : "Lamp off");
    assert.match(btn.title, on ? /Reading light on/ : /Reading light off/);
  }

  // Painting the same state twice does not drift, and the two states really
  // differ, so a pill stuck on one label fails.
  const root = element();
  const btn = element();
  const text = element();
  paintReadingLight(root, btn, text, false);
  paintReadingLight(root, btn, text, false);
  assert.equal(btn.getAttribute("aria-pressed"), "false");
  assert.equal(text.textContent, "Lamp off");
  assert.notEqual(readingLight(true).label, readingLight(false).label);
  assert.notEqual(readingLight(true).pressed, readingLight(false).pressed);
});

test("the counter, the status line and the body class follow the spread", () => {
  const count = element();
  const status = element();
  const body = element();

  paintStepper(count, status, body, 0, NI, spreadLabel(TITLES[pageAt(0, "left")], TITLES[pageAt(0, "right")]));
  assert.equal(count.textContent, "Cover");
  assert.equal(status.textContent, "Closed");
  assert.equal(body.classList.contains("book-open"), false);

  paintStepper(count, status, body, 3, NI, spreadLabel(TITLES[pageAt(3, "left")], TITLES[pageAt(3, "right")]));
  assert.equal(count.textContent, "03 / 06");
  assert.equal(status.textContent, "Spread 3 of 6: Project 3 and Project 4");
  assert.equal(body.classList.contains("book-open"), true);

  paintStepper(count, status, body, NI, NI, "Back endpaper");
  assert.equal(count.textContent, "Back");
  assert.equal(status.textContent, "Back cover");
  assert.equal(body.classList.contains("book-open"), false);

  // Every spread in between is an open book, and none of them describe
  // themselves by the sheet count.
  for (let target = 1; target < NI; target++) {
    paintStepper(count, status, body, target, NI, "x");
    assert.equal(count.textContent, `${String(target).padStart(2, "0")} / 06`);
    assert.equal(body.classList.contains("book-open"), true);
    assert.ok(status.textContent.includes(`of ${NI - 1}`), `spread ${target} says ${status.textContent}`);
  }

  // A layout that hides the counter still has to paint the rest.
  assert.doesNotThrow(() => paintStepper(null, status, body, 2, NI, "x"));
  assert.equal(spreadCountText(0, NI), "Cover");
  assert.equal(spreadCountText(NI, NI), "Back");
  assert.equal(pageStatusText(0, NI, "x"), "Closed");
  assert.equal(pageStatusText(NI, NI, "x"), "Back cover");
});

test("a Contents entry lands on the spread that shows that project", () => {
  const seen = new Map();

  for (let index = 0; index < TITLES.length; index++) {
    const spread = spreadForPage(index, NI);
    assert.ok(spread >= 1 && spread < NI, `page ${index} resolved to spread ${spread}`);

    const side = index % 2 === 0 ? "right" : "left";
    assert.equal(pageAt(spread, side), index, `page ${index} should sit on the ${side} of spread ${spread}`);

    const label = spreadLabel(TITLES[pageAt(spread, "left")], TITLES[pageAt(spread, "right")]);
    assert.ok(label.includes(TITLES[index]), `spread ${spread} does not name ${TITLES[index]}: ${label}`);

    seen.set(spread, (seen.get(spread) || 0) + 1);
  }

  // Ten pages over six spreads: the two end spreads carry one project each,
  // and every spread in between carries two.
  assert.deepEqual([...seen.keys()].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
  assert.equal(seen.get(1), 1);
  assert.equal(seen.get(6), 1);
  for (const spread of [2, 3, 4, 5]) assert.equal(seen.get(spread), 2);

  // The endpapers are named, not numbered, and no spread is ever empty.
  assert.equal(spreadLabel(undefined, TITLES[0]), "Front endpaper and Project 0");
  assert.equal(spreadLabel(TITLES[9], undefined), "Project 9 and Back endpaper");
});

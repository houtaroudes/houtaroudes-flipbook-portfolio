// What a click on the book can land on, and what each hit means. Kept out of
// main.js so the rules can be exercised without a canvas, a camera or a
// renderer: test/faces.test.mjs builds the real Book and clicks it through
// here.

// Every mesh a click is allowed to hit. Both boards stay in the set at all
// times: an open cover lies under its pile, so the nearest hit is still the
// page, and the face-down back cover has to remain clickable after it has
// swung past ninety degrees.
export function pickMeshes(book) {
  const meshes = [];
  for (const it of book.items) {
    if (it.kind === "cover") meshes.push(it.board);
    else if (it.kind === "sheet" && (it.front.visible || it.back.visible)) {
      meshes.push(it.front, it.back);
    }
  }
  return meshes;
}

// Sheet items are 1..N. NI is the target past the back board, not an item, so
// the upper bound is NI - 1. Using NI made the back cover look like a page
// that could be opened, which swallowed every click on it.
export const isSheet = (k, NI) => k > 0 && k < NI - 1;

// A sheet carries two projects: the front face of sheet k is page 2k-2, and
// the back face is page 2k-1.
export const pageIndexOf = (k, side) => 2 * (k - 1) + (side < 0 ? 1 : 0);

// Covers turn the book rather than open a project. The front board opens it
// from closed and shuts it again from anywhere else; the back board does the
// same at the end. Returns the spread to land on, or null when k is not a
// board.
export function coverTarget(k, NI, target) {
  if (k === 0) return target === 0 ? 1 : 0;
  if (k === NI - 1) return target >= NI ? NI - 1 : NI;
  return null;
}

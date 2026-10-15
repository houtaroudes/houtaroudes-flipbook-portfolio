# Flipbook Portfolio

Ten of Bryan Sacueza's projects bound into one 3D book, built with three.js and
Vite. The book sits on a table: open a page and that project runs inside the
overlay, drag a page or use the arrow keys to turn one.

Every cover, board design and endpaper is drawn on a canvas at load time, so the
book ships no image assets.

## Run it

    npm install
    npm run dev

## Build it

    npm run build

## Where things live

| Path | What it is |
| --- | --- |
| `src/book.js` | The book itself: boards, deforming sheets, the turn state machine |
| `src/pages.js` | Cover artwork for the ten pages, the two boards, the endpapers, and the in-book card |
| `src/main.js` | Scene, camera, pointer and keyboard input, the project overlay |
| `src/audio.js` | Page turn sound, synthesised in the browser, no audio files |
| `src/env.js` | Lighting, table, paper stock and fibre textures |
| `covers.html` | Cover proof sheet for reviewing all fourteen designs at full size |
| `tools/shot-server.mjs` | Loopback sink that screenshot passes post their captures to |

Two projects cannot be embedded in a page (no deploy, or a site that refuses
framing) and one has no live build, so those open an in-book card instead of a
running site.

Append `?capture=1` to keep the drawing buffer readable and expose the render
hooks used by a screenshot pass.

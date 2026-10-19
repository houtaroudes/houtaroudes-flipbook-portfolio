# Flipbook Portfolio

Ten of Bryan Sacueza's projects bound into one 3D book, built with three.js and
Vite. The book sits on a desk in a dark room: open a page and that project runs
inside the overlay, pull the cover or a page corner, or use the arrow keys to
turn one. Contents is an index of the same ten projects for anyone who would
rather pick a name than hit a moving page.

Every cover, board design and endpaper is drawn on a canvas at load time, so the
book ships no image assets. The room, desk, paper and dust are procedural too:
reading lamp with a pull cord, mug with steam, sketchbook, pencil, plant, window
and a shelf of spines, all built from primitives.

## What moves

The lamp is the room's switch. Click it, or press `L`, and the reading light
drops to an ember; the pool on the wall, the key light and the shade's edge all
follow one value so the room dims as a room. Pull the closed front cover with the
pointer to open the book, drag a page corner to turn it, swipe the table with one
finger, or flick a trackpad sideways. Two fingers or the mouse move the camera,
scroll zooms, and `C` opens Contents, `S` mutes the page sounds, `R` returns the
camera to its opening angle. The marker ribbon on the cover reopens the last
project you visited.

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
| `src/main.js` | Scene, camera, room and props, lamp state, contents, pointer and keyboard input, the project overlay |
| `src/audio.js` | Page turn sound, synthesised in the browser, no audio files |
| `src/env.js` | Lighting, room and desk textures, paper stock and fibre textures |
| `covers.html` | Cover proof sheet for reviewing all fourteen designs at full size |
| `tools/shot-server.mjs` | Loopback sink that screenshot passes post their captures to |

Two projects cannot be embedded in a page (no deploy, or a site that refuses
framing) and one has no live build, so those open an in-book card instead of a
running site.

## On a phone

Portrait frames the whole spread, because a 3.2:1 book on a 0.46:1 screen can be
no taller than the screen is wide. One finger swipes the table to turn a page,
two fingers move the camera, and Contents is the readable way in. Landscape uses
the same framing as the desktop and drops the hero so the book can fill the
height.

Append `?capture=1` to keep the drawing buffer readable and expose the render
hooks used by a screenshot pass.

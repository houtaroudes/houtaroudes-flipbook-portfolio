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
follow one value so the room dims as a room. The chrome follows it too, warm
bone and brown glass under the lamp, cool slate with it down, including the
Contents sheet and the project overlay. The choice is stored in
`localStorage`, and an inline script applies it before the first paint so a
dim-room visitor never gets a bright flash. Pull the closed front cover with the
pointer to open the book, drag a page corner to turn it, swipe the table with one
finger, or flick a trackpad sideways. Two fingers or the mouse move the camera,
scroll zooms, and `C` opens Contents, `S` mutes the page sounds, `R` returns the
camera to its opening angle. The marker ribbon on the cover reopens the last
project you visited.

## Run it locally

    cd houtaroudes-flipbook-portfolio
    npm install
    npm run dev

Then open **http://localhost:5360**. The port is fixed in `vite.config.js`
with `strictPort: true`, so if 5360 is taken the server fails loudly instead of
sliding onto another project's slot. Everything runs from the browser: no API,
no database, no environment file.

## Build it

    npm run build

## Test it

    npm test

The pick test builds the real book in node, without a renderer, and casts
clicks through it. Every cover, sheet face and page is checked at every spread:
that it can be reached, that the item it reports is the page under the pointer,
and that a board turns the book instead of opening a project. It exists because
the back cover stopped responding once, for two separate reasons at once.

The chrome test drives the reading light pill, the spread counter and the
Contents mapping through fake elements, so the rules that keep them agreeing
with the book are checked without a browser.
    npm run preview

`npm run preview` serves the production bundle from the same port rule.

## Screenshot pass

    node tools/shot-server.mjs shots 5299

Open **http://localhost:5360/?capture=1** so the drawing buffer stays readable
and the render hooks are exposed, then post captures to that loopback sink.

## Where things live

| Path | What it is |
| --- | --- |
| `src/book.js` | The book itself: boards, deforming sheets, the turn state machine |
| `src/faces.js` | What a click can land on, and what each hit means: pick set, page arithmetic, cover behaviour |
| `src/chrome.js` | The chrome rules: light pill labels, spread counter, status line, Contents to spread |
| `test/faces.test.mjs` | Headless click test: the real book, every spread, no browser |
| `test/chrome.test.mjs` | Headless chrome test: the pill, the stepper and where a Contents entry lands |
| `src/pages.js` | Cover artwork for the ten pages, the two boards, the endpapers, and the in-book card |
| `src/main.js` | Scene, camera, room and props, lamp state, contents, pointer and keyboard input, the project overlay |
| `src/audio.js` | Page turn sound, synthesised in the browser, no audio files |
| `src/env.js` | Lighting, room and desk textures, paper stock and fibre textures |
| `covers.html` | Cover proof sheet for reviewing all fourteen designs at full size |
| `tools/shot-server.mjs` | Loopback sink that screenshot passes post their captures to |

Most pages run the deployed site inside the sheet. PixelPodWeb embeds its live
landing page, which links to the booth. Modern Filipino Homes refuses framing
and GitHub does not allow it, while MediQueue and Houtarou Cafe have no live
build, so those open an in-book card instead.

## On a phone

Portrait frames the whole spread, because a 3.2:1 book on a 0.46:1 screen can be
no taller than the screen is wide. One finger swipes the table to turn a page,
two fingers move the camera, and Contents is the readable way in. Landscape uses
the same framing as the desktop and drops the hero so the book can fill the
height.

The reading light has two controls and one state: the lamp on the desk, and a
pill beside the sound button. Both store the same preference, so the room, the
chrome and the button stay together whichever one is used.

Append `?capture=1` to keep the drawing buffer readable and expose the render
hooks used by a screenshot pass.

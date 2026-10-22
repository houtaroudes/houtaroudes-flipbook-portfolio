import * as THREE from "three";

// Covers for the real highlight projects from the v2 portfolio
// (houtaroudes-portfolio), in that list's exact order. Everything is drawn
// on a canvas right here: no screenshots, no copied assets.
//
// Each entry also carries what the book needs to open the project inside the
// book itself. `embed` is false when the live site refuses to be framed, or
// when there is no live site at all. Those pages open an in-book card drawn by
// caseHtml() instead, so every page still leads somewhere.

const PROJECTS = [
  {
    slug: "random-web-dev",
    title: "Random Web Dev",
    kicker: "Flagship build",
    blurb: "A gamified learning hub: 26+ quests with live previews and code challenges.",
    tags: ["React", "Vite", "CSS"],
    hue: 216,
    dark: true,
    url: "https://random-learning-webdev-site.vercel.app",
    repo: "https://github.com/houtaroudes/Random-Learning-WebDev",
    embed: true,
  },
  {
    slug: "st-joseph-village",
    title: "St. Joseph Village",
    kicker: "Cinematic build",
    blurb: "A generated 3D village you fly through on scroll, a 68-lot site plan and a financing calculator.",
    tags: ["React", "Vite", "Three.js"],
    hue: 142,
    dark: true,
    url: "https://st-joseph-village.vercel.app",
    repo: "https://github.com/houtaroudes/st-joseph-village",
    embed: true,
  },
  {
    slug: "motion",
    title: "Motion Website",
    kicker: "Frontend",
    blurb: "An inspiration hub for layout and animation patterns.",
    tags: ["HTML", "CSS", "JS"],
    hue: 262,
    dark: false,
    url: "https://motion-website-des.vercel.app",
    repo: "https://github.com/houtaroudes/motion-website",
    embed: true,
  },
  {
    slug: "pixcodes",
    title: "PixCodes",
    kicker: "Playable build",
    blurb: "A browser game about CSS: write real code against a rendered target and get graded in a sandbox.",
    tags: ["React", "Vite", "CodeMirror"],
    hue: 268,
    dark: true,
    url: "https://pixcodes.vercel.app",
    repo: "https://github.com/houtaroudes/pixcodes",
    embed: true,
  },
  {
    slug: "voltcart",
    title: "Voltcart",
    kicker: "Storefront build",
    blurb: "A gadget storefront with category filters, deal countdowns, cart and wishlist.",
    tags: ["React", "Vite", "Supabase"],
    hue: 158,
    dark: true,
    url: "https://voltcart-gadgets.vercel.app",
    repo: "https://github.com/houtaroudes/voltcart",
    embed: true,
  },
  {
    slug: "pixelpod",
    title: "PixelPodWeb",
    kicker: "Full stack",
    blurb: "A photobooth web app: pick a layout and a look, sit for the countdown, leave with one strip. PHP and MySQL behind it.",
    tags: ["PHP", "MySQL", "JS"],
    hue: 320,
    dark: true,
    // The app itself is PHP and MySQL, but the public site is deployed as a
    // static snapshot (site-preview/), and the booth runs as its own Vercel
    // project. That makes the page embeddable now; it used to open a card
    // saying there was no live deploy at all.
    url: "https://pixelpodweb.vercel.app",
    repo: "https://github.com/houtaroudes/PixelPodWeb",
    embed: true,
  },
  {
    slug: "mfh",
    title: "Modern Filipino Homes",
    kicker: "Proptech platform",
    blurb: "A secure proptech platform: property showcase, financing calculator and lead capture.",
    tags: ["React", "tRPC", "MySQL"],
    hue: 32,
    dark: false,
    url: "https://modern-fil-homes.vercel.app",
    repo: null,
    embed: false,
    reason: "The live site sends X-Frame-Options: DENY, so it cannot run inside a page.",
  },
  {
    slug: "mediqueue",
    title: "MediQueue",
    kicker: "Full stack",
    blurb: "Campus clinic booking and walk-in queueing with a live NOW SERVING board.",
    tags: ["PHP", "MySQL", "JS"],
    hue: 205,
    dark: true,
    url: null,
    repo: "https://github.com/houtaroudes/mediqueue",
    embed: false,
    reason: "No live deploy: PHP and MySQL do not run on Vercel.",
  },
  {
    slug: "houtarou-cafe",
    title: "Houtarou Cafe",
    kicker: "Concept",
    blurb: "A concept cafe site with an ordering flow and a reservation system.",
    tags: ["HTML", "CSS", "JS"],
    hue: 22,
    dark: false,
    url: null,
    repo: "https://github.com/houtaroudes/houtarou-cafe",
    embed: false,
    reason: "Concept build, not deployed.",
  },
  {
    slug: "repos",
    title: "Everything Else",
    kicker: "All repositories",
    blurb: "Experiments and loose ends, kept in the open over on GitHub.",
    tags: ["GitHub"],
    hue: 228,
    dark: true,
    url: "https://github.com/houtaroudes?tab=repositories",
    repo: "https://github.com/houtaroudes",
    embed: false,
    reason: "GitHub refuses to be framed, so the profile opens in its own tab.",
  },
];

export const PROJECT_LIST = PROJECTS;

const COVER_W = 800;
const COVER_H = 500;

function hsl(h, s, l) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// Paper stock for the printed folio: warm off white when the page is light,
// deep ink when it is dark.
function palette(p) {
  return p.dark
    ? {
        paper: hsl(p.hue, 30, 9),
        ink: hsl(p.hue, 24, 88),
        soft: hsl(p.hue, 18, 62),
        plate: hsl(p.hue, 46, 22),
        accent: hsl(p.hue, 78, 58),
        rule: "rgba(255,255,255,0.14)",
        fibreLight: "rgba(255,255,255,",
        fibreDark: "rgba(0,0,0,",
      }
    : {
        paper: hsl(p.hue, 40, 92),
        ink: hsl(p.hue, 45, 12),
        soft: hsl(p.hue, 26, 34),
        plate: hsl(p.hue, 52, 78),
        accent: hsl(p.hue, 62, 38),
        rule: "rgba(0,0,0,0.14)",
        fibreLight: "rgba(255,255,255,",
        fibreDark: "rgba(0,0,0,",
      };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Wraps a byline so the blurb never runs off the plate.
function wrap(g, text, x, y, maxW, lineH) {
  const words = text.split(" ");
  let line = "";
  let rows = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y + rows * lineH);
      line = word;
      rows++;
    } else {
      line = test;
    }
  }
  if (line) {
    g.fillText(line, x, y + rows * lineH);
    rows++;
  }
  return rows;
}

// Print grain: soft speckle plus longer fibres, so the covers read as paper
// rather than as a flat gradient.
function paperGrain(g, pal, w, h) {
  for (let i = 0; i < 5200; i++) {
    const v = Math.random() * 0.05;
    g.fillStyle = `${Math.random() > 0.5 ? pal.fibreLight : pal.fibreDark}${v.toFixed(3)})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random(), 1 + Math.random());
  }
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const len = 8 + Math.random() * 46;
    const ang = Math.random() * Math.PI;
    g.strokeStyle = `${pal.fibreDark}${(0.02 + Math.random() * 0.03).toFixed(3)})`;
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  // A whisper of vignette at the paper edge.
  const vg = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.95);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, pal.dark ? "rgba(0,0,0,0.42)" : "rgba(0,0,0,0.1)");
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
}

// One project page. Left column is the printed record, right column is a
// geometric plate in the project's own colour.
export function drawCoverCanvas(project, index) {
  const W = COVER_W;
  const H = COVER_H;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const pal = palette(project);

  g.fillStyle = pal.paper;
  g.fillRect(0, 0, W, H);

  // Faint layout grid, the way a folio page is ruled.
  g.strokeStyle = pal.dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
  g.lineWidth = 1;
  for (let x = 56; x < W; x += 56) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }
  for (let y = 56; y < H; y += 56) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }

  // Right side plate: two offset blocks, one solid and one outlined.
  const px = W * 0.58;
  const py = H * 0.26;
  const size = H * 0.44;
  g.fillStyle = pal.plate;
  roundRect(g, px, py, size, size, 14);
  g.fill();
  g.strokeStyle = pal.accent;
  g.lineWidth = 3;
  roundRect(g, px + size * 0.34, py + size * 0.34, size, size, 14);
  g.stroke();
  g.fillStyle = pal.accent;
  g.globalAlpha = 0.16;
  roundRect(g, px + size * 0.34, py + size * 0.34, size, size, 14);
  g.fill();
  g.globalAlpha = 1;

  // Hairline that anchors the printed block.
  g.strokeStyle = pal.rule;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(64, H - 150);
  g.lineTo(W - 64, H - 150);
  g.stroke();

  // Page number.
  g.fillStyle = pal.soft;
  g.font = "500 26px 'Inter Tight', sans-serif";
  g.fillText(String(index + 1).padStart(2, "0"), 64, 78);

  // Kicker.
  g.fillStyle = pal.accent;
  g.font = "600 22px 'Inter Tight', sans-serif";
  try { g.letterSpacing = "3px"; } catch { /* older engines just ignore it */ }
  g.fillText(project.kicker.toUpperCase(), 64, 130);
  try { g.letterSpacing = "0px"; } catch {}

  // Title, shrunk to fit if the name is long.
  let titleSize = 66;
  g.font = `600 ${titleSize}px 'Inter Tight', sans-serif`;
  while (g.measureText(project.title).width > W - 240 && titleSize > 34) {
    titleSize -= 2;
    g.font = `600 ${titleSize}px 'Inter Tight', sans-serif`;
  }
  g.fillStyle = pal.ink;
  g.fillText(project.title, 64, H - 172);

  // Blurb.
  g.fillStyle = pal.soft;
  g.font = "400 21px 'Inter Tight', sans-serif";
  wrap(g, project.blurb, 64, H - 128, W - 300, 27);

  // Tag row along the foot.
  g.fillStyle = pal.soft;
  g.font = "500 18px 'Inter Tight', sans-serif";
  try { g.letterSpacing = "2px"; } catch {}
  g.fillText(project.tags.join("   /   ").toUpperCase(), 64, H - 44);
  try { g.letterSpacing = "0px"; } catch {}

  paperGrain(g, pal, W, H);
  return c;
}

export function drawCover(project, index) {
  const tex = new THREE.CanvasTexture(drawCoverCanvas(project, index));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---- the boards -----------------------------------------------------------

// The four board faces. The front and back boards carry the cover design, the
// two endpapers carry the instructions and the colophon.

const STOCK_DARK = "#15110e";
const STOCK_LIGHT = "#e9e2d4";

function cloth(g, w, h, dark) {
  for (let i = 0; i < 9000; i++) {
    const v = Math.random() * 0.05;
    g.fillStyle = dark ? `rgba(255,255,255,${v.toFixed(3)})` : `rgba(0,0,0,${v.toFixed(3)})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random(), 1 + Math.random());
  }
  const vg = g.createRadialGradient(w / 2, h * 0.45, h * 0.25, w / 2, h * 0.5, h * 1.05);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.12)");
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
}

function frame(g, W, H, color) {
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.strokeRect(38, 38, W - 76, H - 76);
}

function boardFront() {
  const W = COVER_W;
  const H = COVER_H;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");

  g.fillStyle = STOCK_DARK;
  g.fillRect(0, 0, W, H);
  frame(g, W, H, "rgba(226,214,190,0.26)");

  // Small brass square, the only ornament.
  g.strokeStyle = "rgba(214,168,96,0.75)";
  g.lineWidth = 2;
  g.strokeRect(W - 132, 84, 44, 44);

  g.fillStyle = "rgba(226,214,190,0.55)";
  g.font = "600 20px 'Inter Tight', sans-serif";
  try { g.letterSpacing = "5px"; } catch {}
  g.fillText("PORTFOLIO 2026", 76, 106);
  try { g.letterSpacing = "0px"; } catch {}

  g.fillStyle = "#f0e9dc";
  g.font = "600 104px 'Inter Tight', sans-serif";
  g.fillText("Ten builds", 74, 300);

  g.fillStyle = "rgba(226,214,190,0.62)";
  g.font = "400 30px 'Inter Tight', sans-serif";
  g.fillText("bound in one book", 78, 348);

  g.strokeStyle = "rgba(226,214,190,0.3)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(78, H - 106);
  g.lineTo(W - 78, H - 106);
  g.stroke();

  g.fillStyle = "#f0e9dc";
  g.font = "500 28px 'Inter Tight', sans-serif";
  g.fillText("Bryan Sacueza", 78, H - 62);

  g.fillStyle = "rgba(226,214,190,0.55)";
  g.font = "400 22px 'Inter Tight', sans-serif";
  g.textAlign = "right";
  g.fillText("Front end developer", W - 78, H - 62);
  g.textAlign = "left";

  cloth(g, W, H, true);
  return c;
}

function boardBack() {
  const W = COVER_W;
  const H = COVER_H;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");

  g.fillStyle = STOCK_DARK;
  g.fillRect(0, 0, W, H);
  frame(g, W, H, "rgba(226,214,190,0.26)");

  g.fillStyle = "rgba(226,214,190,0.55)";
  g.font = "600 20px 'Inter Tight', sans-serif";
  try { g.letterSpacing = "5px"; } catch {}
  g.fillText("CONTENTS", 76, 106);
  try { g.letterSpacing = "0px"; } catch {}

  // Two columns of five, the order the pages run in.
  g.font = "500 25px 'Inter Tight', sans-serif";
  PROJECTS.forEach((p, i) => {
    const col = i < 5 ? 0 : 1;
    const row = i % 5;
    const x = 76 + col * 348;
    const y = 176 + row * 44;
    g.fillStyle = "rgba(214,168,96,0.85)";
    g.fillText(String(i + 1).padStart(2, "0"), x, y);
    g.fillStyle = "rgba(240,233,220,0.9)";
    let size = 25;
    g.font = `500 ${size}px 'Inter Tight', sans-serif`;
    while (g.measureText(p.title).width > 250 && size > 16) {
      size -= 1;
      g.font = `500 ${size}px 'Inter Tight', sans-serif`;
    }
    g.fillText(p.title, x + 50, y);
  });

  g.strokeStyle = "rgba(226,214,190,0.3)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(76, H - 106);
  g.lineTo(W - 76, H - 106);
  g.stroke();

  g.fillStyle = "rgba(226,214,190,0.7)";
  g.font = "400 22px 'Inter Tight', sans-serif";
  g.fillText("github.com/houtaroudes", 76, H - 62);
  g.textAlign = "right";
  g.fillText("Every cover drawn in the browser", W - 76, H - 62);
  g.textAlign = "left";

  cloth(g, W, H, true);
  return c;
}

function endpaperFront() {
  const W = COVER_W;
  const H = COVER_H;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");

  g.fillStyle = STOCK_LIGHT;
  g.fillRect(0, 0, W, H);

  g.fillStyle = "rgba(46,38,30,0.5)";
  g.font = "600 20px 'Inter Tight', sans-serif";
  try { g.letterSpacing = "5px"; } catch {}
  g.fillText("HOW TO READ THIS BOOK", 76, 128);
  try { g.letterSpacing = "0px"; } catch {}

  g.fillStyle = "#2b241c";
  g.font = "500 34px 'Inter Tight', sans-serif";
  wrap(g, "Click a page and that project opens inside the book, running for real. Nothing here sends you off to another tab.", 76, 208, W - 200, 46);

  g.fillStyle = "rgba(46,38,30,0.62)";
  g.font = "400 26px 'Inter Tight', sans-serif";
  wrap(g, "To turn a page, drag its outer edge or press the arrow keys. The two buttons in the corner step one spread at a time.", 76, 350, W - 220, 38);

  g.fillStyle = "rgba(46,38,30,0.45)";
  g.font = "400 22px 'Inter Tight', sans-serif";
  g.fillText("Ten projects, in the order they were built.", 76, H - 78);

  cloth(g, W, H, false);
  return c;
}

function endpaperBack() {
  const W = COVER_W;
  const H = COVER_H;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");

  g.fillStyle = STOCK_LIGHT;
  g.fillRect(0, 0, W, H);

  g.fillStyle = "#2b241c";
  g.font = "600 40px 'Inter Tight', sans-serif";
  g.fillText("Bryan Sacueza", 76, H / 2 - 40);

  g.fillStyle = "rgba(46,38,30,0.62)";
  g.font = "400 26px 'Inter Tight', sans-serif";
  g.fillText("Front end developer, Philippines", 76, H / 2 + 6);

  g.strokeStyle = "rgba(46,38,30,0.2)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(76, H / 2 + 54);
  g.lineTo(W - 76, H / 2 + 54);
  g.stroke();

  g.fillStyle = "rgba(46,38,30,0.62)";
  g.font = "400 24px 'Inter Tight', sans-serif";
  g.fillText("houtaroudes@gmail.com", 76, H / 2 + 104);
  g.textAlign = "right";
  g.fillText("github.com/houtaroudes", W - 76, H / 2 + 104);
  g.textAlign = "left";

  cloth(g, W, H, false);
  return c;
}

export function boardCanvases() {
  return {
    front: boardFront(),
    back: boardBack(),
    innerFront: endpaperFront(),
    innerBack: endpaperBack(),
  };
}

export function loadBoards(anisotropy) {
  const make = (canvas) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    return tex;
  };
  const canvases = boardCanvases();
  return {
    front: make(canvases.front),
    back: make(canvases.back),
    innerFront: make(canvases.innerFront),
    innerBack: make(canvases.innerBack),
  };
}

export function loadPages(anisotropy) {
  return PROJECTS.map((p, i) => {
    const tex = drawCover(p, i);
    tex.anisotropy = anisotropy;
    return { entry: p, poster: tex };
  });
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}

// An in-book page for the projects that cannot be framed. It is a document, so
// it can be dropped straight into the iframe with srcdoc: no network, no
// copied assets, and it matches the printed page it replaces.
export function caseHtml(project, index) {
  const pal = palette(project);
  const links = [];
  if (project.url) {
    links.push(`<a class="btn primary" href="${esc(project.url)}" target="_blank" rel="noopener noreferrer">Open the live site</a>`);
  }
  if (project.repo) {
    links.push(`<a class="btn${project.url ? "" : " primary"}" href="${esc(project.repo)}" target="_blank" rel="noopener noreferrer">Read the source</a>`);
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(project.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: ${project.dark ? "dark" : "light"}; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    background: ${pal.paper};
    color: ${pal.ink};
    font-family: "Inter Tight", Helvetica, Arial, sans-serif;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: center;
    gap: clamp(18px, 3vh, 34px);
    padding: clamp(28px, 7vw, 92px);
    min-height: 100vh;
  }
  .num { font-size: 13px; letter-spacing: 0.18em; color: ${pal.soft}; }
  .kicker { font-size: 13px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: ${pal.accent}; }
  h1 { margin: 0; font-size: clamp(30px, 5.4vw, 60px); font-weight: 600; letter-spacing: -0.02em; line-height: 1.04; }
  p { margin: 0; max-width: 40em; font-size: clamp(15px, 1.5vw, 19px); line-height: 1.55; color: ${pal.soft}; }
  .tags { display: flex; flex-wrap: wrap; gap: 10px; list-style: none; margin: 0; padding: 0; }
  .tags li {
    font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase;
    border: 1px solid ${pal.rule}; border-radius: 999px; padding: 6px 14px; color: ${pal.soft};
  }
  .links { display: flex; flex-wrap: wrap; gap: 12px; }
  .btn {
    font-size: 14px; font-weight: 500; text-decoration: none;
    border-radius: 999px; padding: 12px 22px;
    border: 1px solid ${pal.rule}; color: ${pal.ink};
  }
  .btn.primary { background: ${pal.accent}; border-color: ${pal.accent}; color: ${project.dark ? "#0b0a09" : "#fffaf4"}; }
  .btn:hover { filter: brightness(1.08); }
  .note { font-size: 13px; color: ${pal.soft}; border-top: 1px solid ${pal.rule}; padding-top: 16px; max-width: 44em; }
</style>
</head>
<body>
  <span class="num">${String(index + 1).padStart(2, "0")}</span>
  <span class="kicker">${esc(project.kicker)}</span>
  <h1>${esc(project.title)}</h1>
  <p>${esc(project.blurb)}</p>
  <ul class="tags">${project.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
  <div class="links">${links.join("")}</div>
  ${project.reason ? `<p class="note">${esc(project.reason)} Links open in a new tab.</p>` : ""}
</body>
</html>`;
}

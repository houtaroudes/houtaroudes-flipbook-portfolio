import * as THREE from "three";

export const PAGE_ASPECT = 16 / 10;

export function makeTableTexture(renderer, pxPerUnit) {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");

  // Dark wood grain: layered horizontal streaks with slight waviness.
  g.fillStyle = "#171310";
  g.fillRect(0, 0, size, size);
  const rings = 130;
  for (let i = 0; i < rings; i++) {
    const y = Math.random() * size;
    const wob = Math.sin(i * 0.35) * 4;
    g.strokeStyle = `rgba(${20 + Math.random() * 26 | 0}, ${14 + Math.random() * 20 | 0}, ${10 + Math.random() * 14 | 0}, ${0.25 + Math.random() * 0.35})`;
    g.lineWidth = 0.6 + Math.random() * 2.4;
    g.beginPath();
    for (let x = 0; x <= size; x += 16) {
      const yy = y + wob * Math.sin(x * 0.012 + i);
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  // occasional lighter flecks
  for (let i = 0; i < 240; i++) {
    g.fillStyle = `rgba(60, 45, 30, ${Math.random() * 0.05})`;
    g.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const aniso = renderer.capabilities.getMaxAnisotropy();
  tex.anisotropy = aniso;
  return tex;
}

// Soft radial contact shadow drawn to a canvas, used as an alpha map under the book.
export function makeContactShadow() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(0,0,0,0.5)");
  grad.addColorStop(0.6, "rgba(0,0,0,0.28)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function makePaperTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "#e8e4da";
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const v = 190 + (Math.random() * 46 | 0);
    g.fillStyle = `rgba(${v}, ${v - 4}, ${v - 12}, ${Math.random() * 0.16})`;
    g.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Paper fibre, used as a bump map so the sheets and covers catch the key light
// like real stock instead of reading as flat colour.
export function makePaperBump(repX = 6, repY = 4) {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 18000; i++) {
    const v = 96 + (Math.random() * 64 | 0);
    g.fillStyle = `rgba(${v}, ${v}, ${v}, ${0.25 + Math.random() * 0.5})`;
    g.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 4 + Math.random() * 22;
    const ang = Math.random() * Math.PI;
    g.strokeStyle = `rgba(${Math.random() > 0.5 ? 170 : 70}, ${Math.random() > 0.5 ? 170 : 70}, ${Math.random() > 0.5 ? 170 : 70}, 0.5)`;
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repX, repY);
  return tex;
}

export function setupScene(canvas) {
  // ?capture=1 keeps the drawing buffer around so the canvas can be read back
  // for a screenshot pass. It costs memory, so it stays off by default.
  const capture = new URLSearchParams(location.search).has("capture");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: capture,
  });
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0806); // dark warm room
  scene.fog = new THREE.Fog(0x0a0806, 10, 26);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);

  // Key light: warm spot from upper right, casts the book shadow.
  const spot = new THREE.SpotLight(0xfff0dd, 120, 0, Math.PI / 4.5, 0.6, 1.6);
  spot.position.set(-2.2, 6.4, 1.6);
  spot.target.position.set(0.1, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.camera.near = 2;
  spot.shadow.camera.far = 16;
  spot.shadow.bias = -0.0003;
  spot.shadow.normalBias = 0.012;
  spot.shadow.radius = 6;
  scene.add(spot, spot.target);

  scene.add(new THREE.AmbientLight(0x404a56, 0.55));
  scene.add(new THREE.HemisphereLight(0x3a3f48, 0x151210, 0.5));

  const fillA = new THREE.PointLight(0x334455, 22);
  fillA.position.set(4.5, 3, -5);
  const fillB = new THREE.PointLight(0xffe8c8, 26);
  fillB.position.set(3.5, 2.6, 3.5);
  scene.add(fillA, fillB);

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  resize();

  return { renderer, scene, camera, spot };
}

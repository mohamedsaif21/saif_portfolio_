import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ============================================================================
   APEX CIRCUIT — a small browser racing game
   ----------------------------------------------------------------------------
   Single-file game logic. Sections:
     1. Config
     2. DOM references
     3. Renderer / scene / camera / lights
     4. Sky, ground, fog
     5. Track generation (spline -> road mesh, curbs, start/finish)
     6. Roadside scenery (trees, posts)
     7. Vehicle loading (GLB) + fallback vehicle
     8. Input handling
     9. Physics + track-boundary logic
    10. Camera rig
    11. HUD + game state machine
    12. Main loop
   ========================================================================== */

/* --------------------------------- 1. CONFIG ------------------------------ */

const CONFIG = {
  // Track
  roadHalfWidth: 7,
  curbWidth: 1.1,
  trackSamples: 900,           // resolution of the sampled centerline
  trackControlPoints: [
    [0, -150], [95, -150], [150, -95], [150, 30], [95, 105],
    [35, 105], [20, 55], [-30, 35], [-45, 85], [-105, 95],
    [-155, 30], [-155, -95], [-95, -150],
  ],

  // Vehicle
  vehicleUrl: './assets/white_mesh.glb',
  vehicleTargetLength: 4.3,     // metres, after auto-scale
  // The source mesh's local axes (determined by inspection) are:
  //   local +X = car length, local -X = front of the car, +Y = up, Z = width.
  // This offset rotates the model so its front faces the rig's +Z (forward).
  // If a different GLB is dropped in and it drives backwards, add Math.PI here.
  vehicleYawOffset: Math.PI / 2,
  vehicleColor: 0xf2c200,

  // Physics (all distances in metres, time in seconds)
  accel: 15,
  brakeDecel: 28,
  reverseAccel: 9,
  coastFriction: 7.5,
  handbrakeDecel: 42,
  maxSpeed: 46,          // ~165 km/h
  maxReverseSpeed: 12,
  offroadMaxSpeed: 16,
  offroadExtraFriction: 16,
  offroadHardLimit: 34,  // metres from centerline before a soft return-nudge kicks in
  steerMaxRate: 2.6,      // rad/s
  steerLowSpeedRampRef: 6,
  steerHighSpeedDamp: 0.55,

  // Camera
  camDistance: 9.5,
  camHeight: 4.2,
  camLookAhead: 6,
  camLookHeight: 1.3,
  camPosSmooth: 6.5,
  camLookSmooth: 8,

  // Misc
  minRaceTimeBeforeFinish: 5, // seconds, avoids instant false finish
};

const COLORS = {
  skyTop: 0x8fc3ff,
  skyHorizon: 0xdcefff,
  fog: 0xcfe6ff,
  grass: 0x3d7a35,
  grassAccent: 0x356b2e,
  road: 0x33373d,
  roadLine: 0xf2d34a,
  curbA: 0xd8232a,
  curbB: 0xf3f3f3,
};

/* ------------------------------ 2. DOM REFS -------------------------------- */

const canvas = document.getElementById('game-canvas');
const hud = document.getElementById('hud');
const speedValueEl = document.getElementById('speed-value');
const timeValueEl = document.getElementById('time-value');
const lapValueEl = document.getElementById('lap-value');
const offroadWarningEl = document.getElementById('offroad-warning');
const helpPanelEl = document.getElementById('help-panel');
const startOverlay = document.getElementById('start-overlay');
const pauseOverlay = document.getElementById('pause-overlay');
const finishOverlay = document.getElementById('finish-overlay');
const finishTimeEl = document.getElementById('finish-time');
const loadingNoteEl = document.getElementById('loading-note');
const errorBannerEl = document.getElementById('error-banner');

const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const helpBtn = document.getElementById('help-btn');
const restartBtn = document.getElementById('restart-btn');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const raceAgainBtn = document.getElementById('race-again-btn');

/* ------------------------ 3. RENDERER / SCENE / CAMERA --------------------- */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COLORS.fog, 120, 420);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 12, -20);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/* Lighting: hemisphere for soft sky/ground ambient, directional "sun" that
   follows the car with a tight shadow frustum for crisp, cheap shadows. */

const hemiLight = new THREE.HemisphereLight(COLORS.skyTop, 0x4a5a3a, 0.65);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff3d6, 1.35);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 90;
sunLight.shadow.camera.left = -30;
sunLight.shadow.camera.right = 30;
sunLight.shadow.camera.top = 30;
sunLight.shadow.camera.bottom = -30;
sunLight.shadow.bias = -0.0015;
scene.add(sunLight);
scene.add(sunLight.target);

const SUN_OFFSET = new THREE.Vector3(-40, 55, -25);

/* ---------------------------- 4. SKY, GROUND, FOG --------------------------- */

function buildSky() {
  const canvasSize = 512;
  const c = document.createElement('canvas');
  c.width = canvasSize; c.height = canvasSize;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, canvasSize);
  grad.addColorStop(0, '#5fa2e8');
  grad.addColorStop(0.55, '#8fc3ff');
  grad.addColorStop(1, '#dcefff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const skyGeo = new THREE.SphereGeometry(500, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
}
buildSky();

function buildGround() {
  const groundGeo = new THREE.PlaneGeometry(1400, 1400, 1, 1);
  const groundMat = new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.position.y = -0.02;
  scene.add(ground);

  // subtle mowed-stripe rings for visual texture, cheap: a few large low-poly
  // rings of a slightly darker green under/around the track
  const accentGeo = new THREE.RingGeometry(150, 340, 64);
  const accentMat = new THREE.MeshStandardMaterial({ color: COLORS.grassAccent, roughness: 1 });
  const accentRing = new THREE.Mesh(accentGeo, accentMat);
  accentRing.rotation.x = -Math.PI / 2;
  accentRing.position.y = -0.015;
  scene.add(accentRing);
}
buildGround();

/* ------------------------------- 5. TRACK ---------------------------------- */

function buildTrackCurve() {
  const pts3d = CONFIG.trackControlPoints.map(([x, z]) => new THREE.Vector3(x, 0, z));
  return new THREE.CatmullRomCurve3(pts3d, true, 'centripetal', 0.5);
}

const trackCurve = buildTrackCurve();
const N = CONFIG.trackSamples;

// Precompute arc-length-spaced samples, tangents and left-normals once.
const trackPoints = trackCurve.getSpacedPoints(N);
const trackTangents = [];
const trackNormals = [];
for (let i = 0; i < N; i++) {
  const u = i / N;
  const t = trackCurve.getTangentAt(u).setY(0).normalize();
  trackTangents.push(t);
  trackNormals.push(new THREE.Vector3(-t.z, 0, t.x).normalize());
}

function makeStripedTexture(colorA, colorB, stripes = 10, vertical = true) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const stripeSize = size / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
    if (vertical) ctx.fillRect(0, i * stripeSize, size, stripeSize + 1);
    else ctx.fillRect(i * stripeSize, 0, stripeSize + 1, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeRoadTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#33373d';
  ctx.fillRect(0, 0, size, size);
  // faint asphalt grain
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  // center dashed line
  ctx.fillStyle = '#f2d34a';
  const dashLen = size * 0.16, gapLen = size * 0.14, dashW = size * 0.02;
  for (let y = 0; y < size * 2; y += dashLen + gapLen) {
    ctx.fillRect(size / 2 - dashW / 2, y - size, dashW, dashLen);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildRoadMesh() {
  const hw = CONFIG.roadHalfWidth;
  const positions = new Float32Array(N * 2 * 3);
  const uvs = new Float32Array(N * 2 * 2);
  const indices = [];

  for (let i = 0; i < N; i++) {
    const p = trackPoints[i];
    const n = trackNormals[i];
    const left = new THREE.Vector3().copy(p).addScaledVector(n, hw);
    const right = new THREE.Vector3().copy(p).addScaledVector(n, -hw);
    positions[i * 6 + 0] = left.x; positions[i * 6 + 1] = 0.001; positions[i * 6 + 2] = left.z;
    positions[i * 6 + 3] = right.x; positions[i * 6 + 4] = 0.001; positions[i * 6 + 5] = right.z;

    const v = i / 18; // texture tiling along length
    uvs[i * 4 + 0] = 0; uvs[i * 4 + 1] = v;
    uvs[i * 4 + 2] = 1; uvs[i * 4 + 3] = v;
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = i * 2 + 1;
    const c = ((i + 1) % N) * 2, d = ((i + 1) % N) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ map: makeRoadTexture(), roughness: 0.95, metalness: 0.02 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
}
buildRoadMesh();

function buildCurbs() {
  const hw = CONFIG.roadHalfWidth;
  const cw = CONFIG.curbWidth;
  const tex = makeStripedTexture('#d8232a', '#f3f3f3', 12, false);

  [1, -1].forEach((side) => {
    const positions = new Float32Array(N * 2 * 3);
    const uvs = new Float32Array(N * 2 * 2);
    const indices = [];
    for (let i = 0; i < N; i++) {
      const p = trackPoints[i];
      const n = trackNormals[i];
      const inner = new THREE.Vector3().copy(p).addScaledVector(n, side * hw);
      const outer = new THREE.Vector3().copy(p).addScaledVector(n, side * (hw + cw));
      positions[i * 6 + 0] = inner.x; positions[i * 6 + 1] = 0.02; positions[i * 6 + 2] = inner.z;
      positions[i * 6 + 3] = outer.x; positions[i * 6 + 4] = 0.02; positions[i * 6 + 5] = outer.z;
      const v = i / 3.2;
      uvs[i * 4 + 0] = 0; uvs[i * 4 + 1] = v;
      uvs[i * 4 + 2] = 1; uvs[i * 4 + 3] = v;
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2, b = i * 2 + 1;
      const c = ((i + 1) % N) * 2, d = ((i + 1) % N) * 2 + 1;
      indices.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });
}
buildCurbs();

function buildStartFinishBanner() {
  const hw = CONFIG.roadHalfWidth;
  const p = trackPoints[0];
  const t = trackTangents[0];
  const n = trackNormals[0];

  // checkered strip across the road
  const stripeTex = makeStripedTexture('#111214', '#f3f3f3', 8, true);
  stripeTex.repeat.set(1, 1);
  const bandGeo = new THREE.PlaneGeometry(hw * 2, 2.6);
  const bandMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.8 });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.rotation.x = -Math.PI / 2;
  const angle = Math.atan2(t.x, t.z);
  band.rotation.z = -angle;
  band.position.set(p.x, 0.03, p.z);
  band.receiveShadow = true;
  scene.add(band);

  // gantry: two posts + a beam
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.6, metalness: 0.3 });
  const postGeo = new THREE.CylinderGeometry(0.28, 0.28, 8, 10);
  [1, -1].forEach((side) => {
    const post = new THREE.Mesh(postGeo, postMat);
    const base = new THREE.Vector3().copy(p).addScaledVector(n, side * (hw + CONFIG.curbWidth + 1.2));
    post.position.set(base.x, 4, base.z);
    post.castShadow = true;
    scene.add(post);
  });
  const beamGeo = new THREE.BoxGeometry(hw * 2 + 6, 0.7, 0.7);
  const beam = new THREE.Mesh(beamGeo, postMat);
  beam.position.set(p.x, 7.6, p.z);
  beam.rotation.y = angle;
  beam.castShadow = true;
  scene.add(beam);
}
buildStartFinishBanner();

/* ------------------------------ 6. SCENERY ---------------------------------- */

function buildTrees() {
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.24, 2.2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 1 });
  const foliageGeo = new THREE.ConeGeometry(1.5, 3.2, 7);
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.9 });

  const spots = [];
  const step = 9;
  for (let i = 0; i < N; i += step) {
    // skip near the start/finish gantry for a clean view
    if (i < 20 || i > N - 20) continue;
    [1, -1].forEach((side) => {
      if (Math.random() < 0.35) return; // sparser, more natural placement
      const p = trackPoints[i];
      const n = trackNormals[i];
      const dist = CONFIG.roadHalfWidth + CONFIG.curbWidth + 3 + Math.random() * 9;
      const jitter = (Math.random() - 0.5) * 4;
      const pos = new THREE.Vector3().copy(p).addScaledVector(n, side * dist);
      pos.x += jitter * 0.3; pos.z += jitter * 0.3;
      spots.push(pos);
    });
  }

  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const foliageMesh = new THREE.InstancedMesh(foliageGeo, foliageMat, spots.length);
  trunkMesh.castShadow = true;
  foliageMesh.castShadow = true;

  const dummy = new THREE.Object3D();
  spots.forEach((pos, i) => {
    const scale = 0.75 + Math.random() * 0.6;
    dummy.position.set(pos.x, 1.1 * scale, pos.z);
    dummy.scale.setScalar(scale);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(pos.x, (2.2 + 1.6) * scale, pos.z);
    dummy.updateMatrix();
    foliageMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(trunkMesh, foliageMesh);
}
buildTrees();

function buildRoadsidePosts() {
  // small reflective marker posts along the outside of the curbs for extra detail
  const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.5 });
  const spots = [];
  const step = 14;
  for (let i = 0; i < N; i += step) {
    [1, -1].forEach((side) => {
      const p = trackPoints[i];
      const n = trackNormals[i];
      const dist = CONFIG.roadHalfWidth + CONFIG.curbWidth + 0.6;
      spots.push(new THREE.Vector3().copy(p).addScaledVector(n, side * dist));
    });
  }
  const mesh = new THREE.InstancedMesh(postGeo, postMat, spots.length);
  mesh.castShadow = true;
  const dummy = new THREE.Object3D();
  spots.forEach((pos, i) => {
    dummy.position.set(pos.x, 0.45, pos.z);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(mesh);
}
buildRoadsidePosts();

/* --------------------------- 7. VEHICLE LOADING ----------------------------- */

const vehicle = new THREE.Group();
scene.add(vehicle);
let vehicleReady = false;

function fitAndOrientModel(model) {
  // 1) Measure the raw mesh to work out the scale factor.
  const rawBox = new THREE.Box3().setFromObject(model);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const longestHorizontal = Math.max(rawSize.x, rawSize.z);
  const scale = CONFIG.vehicleTargetLength / longestHorizontal;

  // 2) Apply scale and the orientation correction FIRST, then measure the
  //    fully-transformed shape and cancel out its offset with position.
  //    (position is applied last in Three.js's T*R*S composition, so
  //    computing it after scale/rotation is what makes this exact.)
  model.scale.setScalar(scale);
  model.rotation.y = CONFIG.vehicleYawOffset;

  const fittedBox = new THREE.Box3().setFromObject(model);
  const center = fittedBox.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= fittedBox.min.y;
}

function buildFallbackVehicle() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: CONFIG.vehicleColor, roughness: 0.35, metalness: 0.5 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 1.8), bodyMat);
  cabin.position.set(0, 0.98, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.32, 14);
  [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    wheel.castShadow = true;
    group.add(wheel);
  });
  return group;
}

function loadVehicle() {
  const loader = new GLTFLoader();
  loader.load(
    CONFIG.vehicleUrl,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh) {
          if (!child.geometry.attributes.normal) {
            child.geometry.computeVertexNormals();
          }
          child.material = new THREE.MeshStandardMaterial({
            color: CONFIG.vehicleColor,
            metalness: 0.55,
            roughness: 0.32,
          });
          child.castShadow = true;
          child.receiveShadow = false;
        }
      });
      fitAndOrientModel(model);
      vehicle.add(model);
      vehicleReady = true;
      loadingNoteEl.textContent = 'Vehicle ready.';
      setTimeout(() => { loadingNoteEl.classList.add('hidden'); }, 900);
    },
    undefined,
    (err) => {
      console.error('GLB load failed:', err);
      const fallback = buildFallbackVehicle();
      vehicle.add(fallback);
      vehicleReady = true;
      showError('Could not load the vehicle model — using a placeholder car instead.');
      loadingNoteEl.classList.add('hidden');
    }
  );
}
loadVehicle();

function showError(msg) {
  errorBannerEl.textContent = msg;
  errorBannerEl.classList.remove('hidden');
  setTimeout(() => errorBannerEl.classList.add('hidden'), 6000);
}

/* ------------------------------ 8. INPUT ------------------------------------ */

const keys = { forward: false, back: false, left: false, right: false, brake: false };
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyR']);

function setKey(code, isDown) {
  switch (code) {
    case 'KeyW': case 'ArrowUp': keys.forward = isDown; break;
    case 'KeyS': case 'ArrowDown': keys.back = isDown; break;
    case 'KeyA': case 'ArrowLeft': keys.left = isDown; break;
    case 'KeyD': case 'ArrowRight': keys.right = isDown; break;
    case 'Space': keys.brake = isDown; break;
    case 'KeyR': if (isDown) resetRace(); break;
  }
}

window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  setKey(e.code, true);
});
window.addEventListener('keyup', (e) => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  setKey(e.code, false);
});

/* --------------------------- 9. PHYSICS + STATE ------------------------------ */

const car = {
  position: new THREE.Vector3(trackPoints[0].x, 0, trackPoints[0].z),
  heading: Math.atan2(trackTangents[0].x, trackTangents[0].z),
  speed: 0,
  nearestIndex: 0,
  lateral: 0,
  offroad: false,
};

function resetCarToStart() {
  car.position.set(trackPoints[0].x, 0, trackPoints[0].z);
  car.heading = Math.atan2(trackTangents[0].x, trackTangents[0].z);
  car.speed = 0;
  car.nearestIndex = 0;
  car.lateral = 0;
  car.offroad = false;
}

function forwardVector(heading) {
  return new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
}

function updateNearestTrackSample() {
  // Local windowed search around the last known index — cheap and robust
  // since the car moves continuously along the track.
  const searchWindow = 40;
  let best = car.nearestIndex;
  let bestDist = Infinity;
  for (let d = -searchWindow; d <= searchWindow; d++) {
    const idx = ((car.nearestIndex + d) % N + N) % N;
    const dist = car.position.distanceToSquared(trackPoints[idx]);
    if (dist < bestDist) { bestDist = dist; best = idx; }
  }
  car.nearestIndex = best;
  const p = trackPoints[best];
  const n = trackNormals[best];
  const delta = new THREE.Vector3().subVectors(car.position, p);
  car.lateral = delta.dot(n);
  car.offroad = Math.abs(car.lateral) > CONFIG.roadHalfWidth;
}

function updatePhysics(delta) {
  const steerInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

  const speedCap = car.offroad ? CONFIG.offroadMaxSpeed : CONFIG.maxSpeed;

  if (keys.forward) {
    car.speed += CONFIG.accel * delta;
  } else if (keys.back) {
    if (car.speed > 0.3) {
      car.speed -= CONFIG.brakeDecel * delta;
    } else {
      car.speed -= CONFIG.reverseAccel * delta;
    }
  } else {
    const decel = CONFIG.coastFriction * delta;
    if (car.speed > 0) car.speed = Math.max(0, car.speed - decel);
    else if (car.speed < 0) car.speed = Math.min(0, car.speed + decel);
  }

  if (keys.brake) {
    const decel = CONFIG.handbrakeDecel * delta;
    if (car.speed > 0) car.speed = Math.max(0, car.speed - decel);
    else car.speed = Math.min(0, car.speed + decel);
  }

  if (car.offroad) {
    if (car.speed > speedCap) {
      car.speed = Math.max(speedCap, car.speed - CONFIG.offroadExtraFriction * delta);
    } else if (car.speed < -speedCap) {
      car.speed = Math.min(-speedCap, car.speed + CONFIG.offroadExtraFriction * delta);
    }
  }

  car.speed = THREE.MathUtils.clamp(car.speed, -CONFIG.maxReverseSpeed, CONFIG.maxSpeed);

  // Steering: scales up with speed at low speed (no spinning in place),
  // and is slightly damped at very high speed for a heavier feel.
  const speedAbs = Math.abs(car.speed);
  const rampUp = THREE.MathUtils.clamp(speedAbs / CONFIG.steerLowSpeedRampRef, 0, 1);
  const highSpeedDamp = 1 - CONFIG.steerHighSpeedDamp * THREE.MathUtils.clamp(speedAbs / CONFIG.maxSpeed, 0, 1);
  const reverseSign = car.speed < 0 ? -1 : 1;
  car.heading -= steerInput * CONFIG.steerMaxRate * rampUp * highSpeedDamp * reverseSign * delta;

  const fwd = forwardVector(car.heading);
  car.position.addScaledVector(fwd, car.speed * delta);

  updateNearestTrackSample();

  // Gentle return-nudge only if the player has driven very far off the track,
  // so they can't drift away indefinitely, without hard-blocking normal cuts.
  if (Math.abs(car.lateral) > CONFIG.offroadHardLimit) {
    const p = trackPoints[car.nearestIndex];
    const n = trackNormals[car.nearestIndex];
    const clampedLateral = Math.sign(car.lateral) * CONFIG.offroadHardLimit;
    const target = new THREE.Vector3().copy(p).addScaledVector(n, clampedLateral);
    car.position.lerp(target, Math.min(1, delta * 2));
  }
}

/* ------------------------------- 10. CAMERA ---------------------------------- */

const cameraLookTarget = new THREE.Vector3().copy(car.position);

function updateCamera(delta) {
  const fwd = forwardVector(car.heading);
  const desiredPos = new THREE.Vector3()
    .copy(car.position)
    .addScaledVector(fwd, -CONFIG.camDistance)
    .add(new THREE.Vector3(0, CONFIG.camHeight, 0));

  const desiredLook = new THREE.Vector3()
    .copy(car.position)
    .addScaledVector(fwd, CONFIG.camLookAhead)
    .add(new THREE.Vector3(0, CONFIG.camLookHeight, 0));

  const posLerp = 1 - Math.pow(0.001, delta * (CONFIG.camPosSmooth / 6.5));
  const lookLerp = 1 - Math.pow(0.001, delta * (CONFIG.camLookSmooth / 8));
  camera.position.lerp(desiredPos, posLerp);
  cameraLookTarget.lerp(desiredLook, lookLerp);
  camera.lookAt(cameraLookTarget);
}

/* ------------------------- 11. HUD + STATE MACHINE ---------------------------- */

const STATE = { IDLE: 'idle', RACING: 'racing', PAUSED: 'paused', FINISHED: 'finished' };
let gameState = STATE.IDLE;
let elapsed = 0;
let prevU = 0;

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function formatTimePrecise(t) {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

function updateHUD() {
  const kmh = Math.abs(car.speed) * 3.6;
  speedValueEl.textContent = String(Math.round(kmh)).padStart(3, '0');
  timeValueEl.textContent = formatTime(elapsed);
  offroadWarningEl.classList.toggle('hidden', !car.offroad || gameState !== STATE.RACING);
}

function startRace() {
  startOverlay.classList.add('hidden');
  hud.classList.remove('hidden');
  gameState = STATE.RACING;
  elapsed = 0;
  prevU = 0;
}

function resetRace() {
  resetCarToStart();
  elapsed = 0;
  prevU = 0;
  finishOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  if (gameState !== STATE.IDLE) {
    hud.classList.remove('hidden');
    gameState = STATE.RACING;
  }
}

function finishRace() {
  gameState = STATE.FINISHED;
  finishTimeEl.textContent = formatTimePrecise(elapsed);
  finishOverlay.classList.remove('hidden');
}

function togglePause(forceState) {
  const shouldPause = forceState !== undefined ? forceState : gameState !== STATE.PAUSED;
  if (shouldPause && gameState === STATE.RACING) {
    gameState = STATE.PAUSED;
    pauseOverlay.classList.remove('hidden');
  } else if (!shouldPause && gameState === STATE.PAUSED) {
    gameState = STATE.RACING;
    pauseOverlay.classList.add('hidden');
  }
}

startBtn.addEventListener('click', startRace);
pauseBtn.addEventListener('click', () => togglePause());
resumeBtn.addEventListener('click', () => togglePause(false));
pauseRestartBtn.addEventListener('click', resetRace);
restartBtn.addEventListener('click', resetRace);
raceAgainBtn.addEventListener('click', () => {
  finishOverlay.classList.add('hidden');
  resetRace();
});
helpBtn.addEventListener('click', () => helpPanelEl.classList.toggle('hidden'));

/* --------------------------------- 12. LOOP ----------------------------------- */

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const rawDelta = clock.getDelta();
  const delta = Math.min(rawDelta, 1 / 20); // clamp to avoid huge steps on tab-switch

  if (gameState === STATE.RACING) {
    elapsed += delta;
    updatePhysics(delta);

    const u = car.nearestIndex / N;
    if (elapsed > CONFIG.minRaceTimeBeforeFinish && prevU > 0.85 && u < 0.15) {
      finishRace();
    }
    prevU = u;
  }

  // Vehicle transform always follows car state (even paused, for a frozen frame).
  vehicle.position.set(car.position.x, 0, car.position.z);
  vehicle.rotation.y = car.heading;

  updateCamera(gameState === STATE.RACING || gameState === STATE.FINISHED ? delta : Math.min(delta, 1 / 30));

  // Sun follows the car with a tight frustum for crisp, cheap shadows.
  sunLight.position.set(
    car.position.x + SUN_OFFSET.x,
    SUN_OFFSET.y,
    car.position.z + SUN_OFFSET.z
  );
  sunLight.target.position.copy(car.position);

  if (gameState === STATE.RACING) updateHUD();

  renderer.render(scene, camera);
}

// Initial camera framing before the race starts.
camera.position.set(car.position.x - 14, 9, car.position.z - 18);
camera.lookAt(car.position.x, 1, car.position.z);

animate();

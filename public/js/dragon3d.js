const THREE_CDN_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

function createWingMembraneGeometry(points) {
  // Build triangulated wing fan connecting shoulder origin (0) through elbow and wingtips.
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  for (let i = 1; i < points.length - 1; i += 1) {
    vertices.push(
      points[0].x, points[0].y, points[0].z,
      points[i].x, points[i].y, points[i].z,
      points[i + 1].x, points[i + 1].y, points[i + 1].z
    );
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

let THREE = null;

function buildWing(side, armorMat, crimsonMat, membraneMat) {
  const wingPivot = new THREE.Group();
  const s = side; // -1 for left wing, +1 for right wing

  const shoulder = new THREE.Vector3(0, 0, 0);
  const elbow = new THREE.Vector3(s * 1.45, 0.92, -0.32);
  const wrist = new THREE.Vector3(s * 2.95, 1.55, 0.08);
  const tipMain = new THREE.Vector3(s * 4.55, 1.12, -0.65);
  const tipMid = new THREE.Vector3(s * 3.85, -0.35, -0.95);
  const tipInner = new THREE.Vector3(s * 2.45, -1.05, -1.08);
  const bodyAnchor = new THREE.Vector3(s * 0.25, -1.15, -0.85);

  const addStrut = (start, end, rStart, rEnd, mat) => {
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    const geom = new THREE.CylinderGeometry(rEnd, rStart, len, 7);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(start).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    wingPivot.add(mesh);
  };

  addStrut(shoulder, elbow, 0.085, 0.068, armorMat);
  addStrut(elbow, wrist, 0.068, 0.052, armorMat);
  addStrut(wrist, tipMain, 0.048, 0.016, crimsonMat);
  addStrut(wrist, tipMid, 0.04, 0.015, armorMat);
  addStrut(wrist, tipInner, 0.036, 0.014, armorMat);

  const clawGeom = new THREE.ConeGeometry(0.055, 0.28, 6);
  const claw = new THREE.Mesh(clawGeom, crimsonMat);
  claw.position.copy(wrist).add(new THREE.Vector3(0, 0.16, 0.08));
  claw.rotation.x = 0.55;
  wingPivot.add(claw);

  const membraneGeom = createWingMembraneGeometry([
    shoulder,
    elbow,
    wrist,
    tipMain,
    tipMid,
    tipInner,
    bodyAnchor
  ]);
  const membrane = new THREE.Mesh(membraneGeom, membraneMat);
  wingPivot.add(membrane);

  wingPivot.position.set(s * 0.45, 0.65, -0.1);
  return wingPivot;
}

function buildDragonHead(armorMat, crimsonMat, eyeMat) {
  const headGroup = new THREE.Group();

  // Angular obsidian skull
  const skullGeom = new THREE.OctahedronGeometry(0.54, 1);
  skullGeom.scale(0.84, 0.68, 1.32);
  const skull = new THREE.Mesh(skullGeom, armorMat);
  headGroup.add(skull);

  // Upper snout wedge
  const snoutGeom = new THREE.ConeGeometry(0.38, 1.15, 6);
  snoutGeom.rotateX(Math.PI / 2);
  snoutGeom.scale(0.85, 0.62, 1.0);
  const snout = new THREE.Mesh(snoutGeom, armorMat);
  snout.position.set(0, -0.02, 0.72);
  headGroup.add(snout);

  // Articulated lower jaw
  const jawGroup = new THREE.Group();
  const jawGeom = new THREE.ConeGeometry(0.28, 0.96, 6);
  jawGeom.rotateX(Math.PI / 2);
  jawGeom.scale(0.82, 0.36, 1.0);
  const jaw = new THREE.Mesh(jawGeom, armorMat);
  jaw.position.set(0, -0.18, 0.58);
  jawGroup.add(jaw);
  headGroup.add(jawGroup);

  // Swept horns and nasal crest
  for (const side of [-1, 1]) {
    const hornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.22, 0.24, -0.05),
      new THREE.Vector3(side * 0.42, 0.62, -0.55),
      new THREE.Vector3(side * 0.52, 0.92, -1.18)
    ]);
    const hornGeom = new THREE.TubeGeometry(hornCurve, 12, 0.075, 6, false);
    const horn = new THREE.Mesh(hornGeom, crimsonMat);
    headGroup.add(horn);

    // Sharp glowing crimson eyes
    const eyeGeom = new THREE.OctahedronGeometry(0.085, 0);
    eyeGeom.scale(0.55, 0.45, 1.45);
    const eye = new THREE.Mesh(eyeGeom, eyeMat);
    eye.position.set(side * 0.29, 0.08, 0.42);
    eye.rotation.y = side * 0.35;
    headGroup.add(eye);
  }

  const nasalSpike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 5), crimsonMat);
  nasalSpike.position.set(0, 0.16, 0.96);
  nasalSpike.rotation.x = -0.35;
  headGroup.add(nasalSpike);

  headGroup.userData.jawGroup = jawGroup;
  return headGroup;
}

function buildDragonAssembly() {
  const dragonRoot = new THREE.Group();

  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x33282e,
    metalness: 0.68,
    roughness: 0.28,
    flatShading: true
  });

  const crimsonMat = new THREE.MeshStandardMaterial({
    color: 0xdc1e2e,
    emissive: 0x6e0812,
    emissiveIntensity: 0.85,
    metalness: 0.48,
    roughness: 0.26,
    flatShading: true
  });

  const eyeMat = new THREE.MeshBasicMaterial({
    color: 0xff4b5a
  });

  const membraneMat = new THREE.MeshStandardMaterial({
    color: 0x820c18,
    emissive: 0x42050b,
    emissiveIntensity: 0.8,
    metalness: 0.22,
    roughness: 0.48,
    transparent: true,
    opacity: 0.86,
    side: THREE.DoubleSide
  });

  // Sinuous spine curve spanning head-neck-torso-tail
  const spineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.05, 1.38, 1.58), // neck top
    new THREE.Vector3(0.28, 1.05, 0.85), // mid neck
    new THREE.Vector3(0.0, 0.42, 0.0),   // chest / wing origin
    new THREE.Vector3(-0.35, -0.38, -1.05), // lower torso
    new THREE.Vector3(0.15, -1.12, -2.25), // tail sweep 1
    new THREE.Vector3(1.15, -1.55, -3.35), // tail sweep 2
    new THREE.Vector3(2.25, -1.25, -4.15)  // tail tip
  ]);

  const segments = 34;
  const spinePoints = spineCurve.getPoints(segments);
  const tangents = spinePoints.map((_, idx) => spineCurve.getTangent(idx / segments));

  for (let i = 0; i < spinePoints.length; i += 1) {
    const t = i / segments;
    const radius =
      t < 0.22
        ? 0.24 + t * 1.15
        : t < 0.45
          ? 0.5 - (t - 0.22) * 0.6
          : Math.max(0.07, 0.36 * (1 - (t - 0.45) * 1.45));

    const segGeom = new THREE.OctahedronGeometry(radius, 1);
    segGeom.scale(0.92, 0.85, 1.28);
    const segMesh = new THREE.Mesh(segGeom, armorMat);
    segMesh.position.copy(spinePoints[i]);
    segMesh.lookAt(spinePoints[i].clone().add(tangents[i]));
    dragonRoot.add(segMesh);

    if (i % 2 === 0 && i < spinePoints.length - 1) {
      const spikeHeight = 0.22 + Math.sin(t * Math.PI) * 0.32;
      const spikeGeom = new THREE.ConeGeometry(Math.max(0.04, radius * 0.26), spikeHeight, 4);
      const spikeMesh = new THREE.Mesh(spikeGeom, crimsonMat);
      spikeMesh.position.copy(spinePoints[i]).add(new THREE.Vector3(0, radius * 0.92, 0));
      spikeMesh.rotation.x = -0.38;
      dragonRoot.add(spikeMesh);
    }
  }

  // Tail spade blade
  const tailTip = spinePoints[spinePoints.length - 1];
  const spadeGeom = new THREE.ConeGeometry(0.24, 0.72, 4);
  spadeGeom.scale(1.3, 1.0, 0.35);
  spadeGeom.rotateX(Math.PI / 2);
  const spade = new THREE.Mesh(spadeGeom, crimsonMat);
  spade.position.copy(tailTip).add(new THREE.Vector3(0.18, 0.06, -0.2));
  spade.lookAt(tailTip.clone().add(tangents[tangents.length - 1]));
  dragonRoot.add(spade);

  const head = buildDragonHead(armorMat, crimsonMat, eyeMat);
  head.position.set(0.02, 1.56, 1.88);
  head.rotation.set(0.18, -0.32, 0.04);
  dragonRoot.add(head);

  const leftWing = buildWing(-1, armorMat, crimsonMat, membraneMat);
  const rightWing = buildWing(1, armorMat, crimsonMat, membraneMat);
  dragonRoot.add(leftWing);
  dragonRoot.add(rightWing);

  // Position dragon slightly right on wide screens so left editorial headline stays legible.
  dragonRoot.position.set(1.55, -0.12, -0.2);
  dragonRoot.rotation.set(0.06, -0.48, -0.04);

  return { dragonRoot, head, leftWing, rightWing };
}

function buildEmberParticles(count) {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.35) * 10;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
    positions[i * 3 + 2] = (Math.random() - 0.6) * 7;
    speeds[i] = 0.16 + Math.random() * 0.32;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xf25764,
    size: 0.055,
    transparent: true,
    opacity: 0.72
  });

  const points = new THREE.Points(geometry, material);
  points.userData.speeds = speeds;
  return points;
}

/**
 * Mount and control the interactive WebGL 3D dragon canvas.
 * Falls back silently to the SVG dragon backdrop if WebGL or Three.js fails.
 */
export async function initDragonScene({ canvas, fallbackImg, motionToggleBtn }) {
  if (!canvas) {
    return { active: false };
  }

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let isPaused = reducedMotionQuery.matches;
  let rafId = null;
  let lastElapsedSec = 0.6;

  const updateMotionButton = () => {
    if (!motionToggleBtn) {
      return;
    }
    motionToggleBtn.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
    const labelSpan = motionToggleBtn.querySelector('.motion-label');
    if (labelSpan) {
      labelSpan.textContent = isPaused ? 'Jalankan animasi' : 'Jeda animasi';
    }
  };

  updateMotionButton();

  try {
    THREE = await import(THREE_CDN_URL);
  } catch (err) {
    console.warn('Three.js module failed to load, keeping SVG dragon fallback.', err);
    if (motionToggleBtn) {
      motionToggleBtn.hidden = true;
    }
    return { active: false };
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
  } catch (err) {
    console.warn('WebGL renderer unavailable, keeping SVG dragon fallback.', err);
    if (motionToggleBtn) {
      motionToggleBtn.hidden = true;
    }
    return { active: false };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x0a090b, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a090b, 0.032);

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 40);
  camera.position.set(0.15, 0.52, 6.2);

  // Sculptural rim lights: bright silver top-edge + intense crimson side/back highlights.
  const ambient = new THREE.AmbientLight(0x523f46, 1.85);
  const keyCrimson = new THREE.DirectionalLight(0xdc1e2e, 5.4);
  keyCrimson.position.set(4.5, 4.2, 3.2);
  const coolRim = new THREE.DirectionalLight(0xe2d9d5, 2.15);
  coolRim.position.set(-4.2, 3.2, 1.5);
  const backRim = new THREE.DirectionalLight(0xf25764, 3.4);
  backRim.position.set(2.0, 2.0, -4.5);
  const bellyGlow = new THREE.PointLight(0xdc1e2e, 5.5, 14);
  bellyGlow.position.set(1.6, -0.4, 1.8);

  scene.add(ambient, keyCrimson, coolRim, backRim, bellyGlow);

  const { dragonRoot, head, leftWing, rightWing } = buildDragonAssembly();
  scene.add(dragonRoot);

  const isSmallScreen = window.innerWidth < 768;
  const embers = buildEmberParticles(isSmallScreen ? 40 : 85);
  scene.add(embers);

  const pointerTarget = { x: 0, y: 0 };
  const pointerCurrent = { x: 0, y: 0 };

  const syncSize = () => {
    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect?.width || window.innerWidth));
    const height = Math.max(320, Math.round(rect?.height || window.innerHeight * 0.85));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;

    // Center dragon slightly lower on mobile viewports so top hero copy remains clear.
    if (width < 760) {
      dragonRoot.position.set(0.28, -0.48, -0.8);
      dragonRoot.scale.setScalar(0.82);
    } else {
      dragonRoot.position.set(1.55, -0.1, -0.15);
      dragonRoot.scale.setScalar(1.0);
    }

    camera.updateProjectionMatrix();
  };

  syncSize();

  window.addEventListener(
    'pointermove',
    (event) => {
      if (isPaused) {
        return;
      }
      pointerTarget.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointerTarget.y = (event.clientY / window.innerHeight - 0.5) * 2;
    },
    { passive: true }
  );

  let clockStart = performance.now();

  const renderFrame = (elapsedSec) => {
    lastElapsedSec = elapsedSec;
    pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * 0.04;
    pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * 0.04;

    const scrollRatio = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
    const breath = Math.sin(elapsedSec * 1.15);
    const wingBeat = Math.sin(elapsedSec * 1.55);

    dragonRoot.rotation.y = -0.48 + pointerCurrent.x * 0.18 + scrollRatio * 0.25;
    dragonRoot.rotation.x = 0.06 + pointerCurrent.y * 0.08 - scrollRatio * 0.1;
    dragonRoot.position.y = (window.innerWidth < 760 ? -0.48 : -0.1) + breath * 0.06;

    leftWing.rotation.z = 0.12 + wingBeat * 0.14;
    leftWing.rotation.y = 0.1 + wingBeat * 0.06;
    rightWing.rotation.z = -0.12 - wingBeat * 0.14;
    rightWing.rotation.y = -0.1 - wingBeat * 0.06;

    head.rotation.y = -0.32 + pointerCurrent.x * 0.14;
    head.rotation.x = 0.18 + breath * 0.03 + pointerCurrent.y * 0.08;
    if (head.userData.jawGroup) {
      head.userData.jawGroup.rotation.x = 0.04 + Math.max(0, breath) * 0.07;
    }

    const posAttr = embers.geometry.getAttribute('position');
    const speeds = embers.userData.speeds;
    for (let i = 0; i < speeds.length; i += 1) {
      let nextY = posAttr.getY(i) + speeds[i] * 0.016;
      if (nextY > 3.2) {
        nextY = -3.0;
      }
      posAttr.setY(i, nextY);
    }
    posAttr.needsUpdate = true;

    renderer.render(scene, camera);
  };

  window.addEventListener(
    'resize',
    () => {
      syncSize();
      renderFrame(lastElapsedSec);
    },
    { passive: true }
  );

  // Render first frame immediately and fade out static SVG fallback so WebGL replaces it smoothly.
  renderFrame(lastElapsedSec);
  canvas.classList.add('is-ready');
  if (fallbackImg) {
    fallbackImg.classList.add('is-hidden');
  }

  const loop = (now) => {
    if (isPaused) {
      rafId = null;
      return;
    }
    const elapsedSec = (now - clockStart) * 0.001;
    renderFrame(elapsedSec);
    rafId = window.requestAnimationFrame(loop);
  };

  const syncAnimationLoop = () => {
    updateMotionButton();
    if (isPaused) {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      renderFrame(lastElapsedSec);
      return;
    }
    if (rafId === null) {
      clockStart = performance.now() - lastElapsedSec * 1000;
      rafId = window.requestAnimationFrame(loop);
    }
  };

  if (motionToggleBtn) {
    motionToggleBtn.hidden = false;
    motionToggleBtn.addEventListener('click', () => {
      isPaused = !isPaused;
      syncAnimationLoop();
    });
  }

  reducedMotionQuery.addEventListener('change', (event) => {
    isPaused = event.matches;
    syncAnimationLoop();
  });

  syncAnimationLoop();
  return { active: true };
}

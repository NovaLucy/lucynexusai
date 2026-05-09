import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { MOOD_HSL, type AgentState, type Mood } from "@/apn/types";

/**
 * NeuronCore v2 — tissu cérébral vivant: dendrites tubulaires myélinisées,
 * soma organique déformé, flashs synaptiques, parallaxe souris + onde de choc.
 */

interface Props {
  mood: Mood;
  state: AgentState;
  speaking?: boolean;
  intensity?: number;
}

function moodColor(mood: Mood, lOff = 0, hShift = 0, sBoost = 0): THREE.Color {
  const m = MOOD_HSL[mood];
  const c = new THREE.Color();
  c.setHSL(
    ((m.h + hShift) % 360) / 360,
    Math.min(1, m.s / 100 + sBoost),
    Math.min(0.85, Math.max(0, m.l / 100 + lOff)),
  );
  return c;
}

interface BranchPath {
  pts: Float32Array;
  count: number;
  length: number;
  curve: THREE.CatmullRomCurve3;
  rootDir: THREE.Vector3;
}

function buildDendrites(branchCount: number, seed: number) {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s & 0xffffffff) / 0xffffffff;
  };

  const paths: BranchPath[] = [];
  const somaList: number[] = [];
  const tipList: number[] = [];

  const grow = (
    start: THREE.Vector3,
    dir: THREE.Vector3,
    depth: number,
    energy: number,
  ) => {
    const segs: THREE.Vector3[] = [start.clone()];
    const cur = start.clone();
    const d = dir.clone();
    const stepLen = 0.06 + rnd() * 0.04;
    let len = 0;
    let total = 0;
    const maxLen = energy;
    while (len < maxLen) {
      d.x += (rnd() - 0.5) * 0.35;
      d.y += (rnd() - 0.5) * 0.35;
      d.z += (rnd() - 0.5) * 0.35;
      d.normalize();
      cur.addScaledVector(d, stepLen);
      segs.push(cur.clone());
      len += stepLen;
      total += stepLen;
      if (depth < 3 && rnd() < 0.04 && len > 0.3) {
        const forkDir = d
          .clone()
          .add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.8))
          .normalize();
        grow(cur.clone(), forkDir, depth + 1, energy * (0.45 + rnd() * 0.25));
      }
      if (rnd() < 0.005) break;
    }
    tipList.push(cur.x, cur.y, cur.z);
    somaList.push(cur.x, cur.y, cur.z);

    const flat = new Float32Array(segs.length * 3);
    for (let i = 0; i < segs.length; i++) {
      flat[i * 3] = segs[i].x;
      flat[i * 3 + 1] = segs[i].y;
      flat[i * 3 + 2] = segs[i].z;
    }
    const curve = new THREE.CatmullRomCurve3(segs, false, "catmullrom", 0.5);
    paths.push({
      pts: flat,
      count: segs.length,
      length: total,
      curve,
      rootDir: dir.clone().normalize(),
    });
  };

  for (let i = 0; i < branchCount; i++) {
    const theta = rnd() * Math.PI * 2;
    const phi = Math.acos(2 * rnd() - 1);
    const r0 = 0.22 + rnd() * 0.06;
    const start = new THREE.Vector3(
      r0 * Math.sin(phi) * Math.cos(theta),
      r0 * Math.sin(phi) * Math.sin(theta),
      r0 * Math.cos(phi),
    );
    const dir = start.clone().normalize();
    const energy = 1.4 + rnd() * 1.6;
    grow(start, dir, 0, energy);
  }

  // Build a single merged tube geometry with tapered radius
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const aDistArr: number[] = [];
  let vertOffset = 0;

  const RADIAL = 6;
  for (const p of paths) {
    if (p.count < 4) continue; // CatmullRom needs enough points for frenet frames
    const tubularSegments = Math.max(8, Math.min(64, Math.floor(p.length * 22)));
    // Custom: build tube manually so radius can taper along curve
    const frames = p.curve.computeFrenetFrames(tubularSegments, false);
    const totalLen = p.length;
    for (let i = 0; i <= tubularSegments; i++) {
      const u = i / tubularSegments;
      const point = p.curve.getPointAt(u);
      const N = frames.normals[i];
      const B = frames.binormals[i];
      const distFromCenter = point.length();
      // taper: thicker near soma, thin at tip
      const radius = THREE.MathUtils.lerp(0.028, 0.005, u) *
        THREE.MathUtils.lerp(1, 0.7, Math.min(1, distFromCenter / 2.5));
      for (let j = 0; j < RADIAL; j++) {
        const v = (j / RADIAL) * Math.PI * 2;
        const sinV = Math.sin(v);
        const cosV = Math.cos(v);
        const nx = cosV * N.x + sinV * B.x;
        const ny = cosV * N.y + sinV * B.y;
        const nz = cosV * N.z + sinV * B.z;
        positions.push(point.x + nx * radius, point.y + ny * radius, point.z + nz * radius);
        normals.push(nx, ny, nz);
        uvs.push(u * totalLen * 14, j / RADIAL); // u scaled for myelin bands
        aDistArr.push(distFromCenter);
      }
    }
    for (let i = 0; i < tubularSegments; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = vertOffset + i * RADIAL + j;
        const b = vertOffset + i * RADIAL + ((j + 1) % RADIAL);
        const c = vertOffset + (i + 1) * RADIAL + ((j + 1) % RADIAL);
        const d = vertOffset + (i + 1) * RADIAL + j;
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
    vertOffset += (tubularSegments + 1) * RADIAL;
  }

  const tubeGeom = new THREE.BufferGeometry();
  tubeGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  tubeGeom.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  tubeGeom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  tubeGeom.setAttribute("aDist", new THREE.Float32BufferAttribute(aDistArr, 1));
  tubeGeom.setIndex(indices);

  return {
    paths,
    tubeGeom,
    somaPositions: new Float32Array(somaList),
    tipPositions: new Float32Array(tipList),
  };
}

function NeuronWeb({ mood, state, speaking, intensity = 1 }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const tubeMatRef = useRef<THREE.ShaderMaterial>(null);
  const pulsesRef = useRef<THREE.Points>(null);
  const flashRef = useRef<THREE.Points>(null);
  const somaRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const nucleusRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  const { paths, tubeGeom, somaPositions, tipPositions } = useMemo(
    () => buildDendrites(180, 1337),
    [],
  );

  const PULSE_COUNT = 380;
  const pulses = useMemo(() => {
    const arr: { path: number; t: number; speed: number }[] = [];
    for (let i = 0; i < PULSE_COUNT; i++) {
      arr.push({
        path: Math.floor(Math.random() * paths.length),
        t: Math.random(),
        speed: 0.35 + Math.random() * 0.7,
      });
    }
    return arr;
  }, [paths.length]);

  const FLASH_COUNT = 96;
  const flashes = useMemo(
    () =>
      Array.from({ length: FLASH_COUNT }, () => ({
        x: 0,
        y: 0,
        z: 0,
        life: 0, // 0 = dead, >0 fades down
      })),
    [],
  );

  const pulsePositions = useMemo(() => new Float32Array(PULSE_COUNT * 3), []);
  const pulseSeeds = useMemo(() => {
    const a = new Float32Array(PULSE_COUNT);
    for (let i = 0; i < PULSE_COUNT; i++) a[i] = Math.random();
    return a;
  }, []);
  const flashPositions = useMemo(() => new Float32Array(FLASH_COUNT * 3), []);
  const flashLives = useMemo(() => new Float32Array(FLASH_COUNT), []);

  const pulseGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pulsePositions, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(pulseSeeds, 1));
    return g;
  }, [pulsePositions, pulseSeeds]);

  const flashGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(flashPositions, 3));
    g.setAttribute("aLife", new THREE.BufferAttribute(flashLives, 1));
    return g;
  }, [flashPositions, flashLives]);

  const somaGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(somaPositions, 3));
    return g;
  }, [somaPositions]);

  // warmer palette: shift hue toward amber/red, boost saturation
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: moodColor(mood, 0.12, -8, 0.05) }, // periphery (cooler)
      uColor2: { value: moodColor(mood, -0.05, -25, 0.1) }, // hot core (warmer)
      uPulse: { value: 0 },
      uIntensity: { value: intensity },
      uMouse: { value: new THREE.Vector3(0, 0, 0) },
      uShockPos: { value: new THREE.Vector3(0, 0, 0) },
      uShockTime: { value: -10 },
    }),
    [],
  );

  useEffect(() => {
    uniforms.uColor.value = moodColor(mood, 0.12, -8, 0.05);
    uniforms.uColor2.value = moodColor(mood, -0.05, -25, 0.1);
  }, [mood, uniforms]);

  // mouse tracking
  const mouseNDC = useRef(new THREE.Vector2(0, 0));
  const mouseWorld = useRef(new THREE.Vector3(0, 0, 0));
  const { camera, gl, size } = useThree();

  useEffect(() => {
    const dom = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      mouseNDC.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDC.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      // project to z=0 plane
      const v = new THREE.Vector3(mouseNDC.current.x, mouseNDC.current.y, 0.5);
      v.unproject(camera);
      const dir = v.sub(camera.position).normalize();
      const dist = -camera.position.z / dir.z;
      mouseWorld.current.copy(camera.position).addScaledVector(dir, dist);
      uniforms.uMouse.value.copy(mouseWorld.current);
    };
    const onDown = () => {
      uniforms.uShockPos.value.copy(mouseWorld.current);
      uniforms.uShockTime.value = uniforms.uTime.value;
      // reset some pulses near click for an immediate burst of activity
      const cp = mouseWorld.current;
      let injected = 0;
      for (let i = 0; i < pulses.length && injected < 30; i++) {
        const p = paths[pulses[i].path];
        const dx = p.pts[0] - cp.x;
        const dy = p.pts[1] - cp.y;
        const dz = p.pts[2] - cp.z;
        if (dx * dx + dy * dy + dz * dz < 4) {
          pulses[i].t = 0;
          pulses[i].speed = 0.9 + Math.random() * 0.8;
          injected++;
        }
      }
    };
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerdown", onDown);
    return () => {
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerdown", onDown);
    };
  }, [camera, gl, uniforms, pulses, paths, size]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    const t = uniforms.uTime.value;

    const sp = speaking || state === "speaking";
    const thinking = state === "thinking";
    const listening = state === "listening";

    const target = sp ? 1.25 : thinking ? 0.75 : listening ? 0.45 : 0.2;
    uniforms.uPulse.value += (target - uniforms.uPulse.value) * 0.07;

    const speedMul = sp ? 2.4 : thinking ? 1.7 : listening ? 1.1 : 0.7;

    // Update pulses
    const pos = pulsePositions;
    for (let i = 0; i < PULSE_COUNT; i++) {
      const p = pulses[i];
      p.t += dt * p.speed * speedMul * 0.5;
      if (p.t >= 1) {
        // arrival -> spawn a flash at terminal
        const path = paths[p.path];
        const tipX = path.pts[(path.count - 1) * 3];
        const tipY = path.pts[(path.count - 1) * 3 + 1];
        const tipZ = path.pts[(path.count - 1) * 3 + 2];
        for (let k = 0; k < FLASH_COUNT; k++) {
          if (flashes[k].life <= 0) {
            flashes[k].x = tipX;
            flashes[k].y = tipY;
            flashes[k].z = tipZ;
            flashes[k].life = 1.0;
            break;
          }
        }
        p.t = 0;
        p.path = Math.floor(Math.random() * paths.length);
        p.speed = 0.35 + Math.random() * 0.7;
      }
      const path = paths[p.path];
      const idxF = p.t * (path.count - 1);
      const i0 = Math.floor(idxF);
      const f = idxF - i0;
      const i1 = Math.min(i0 + 1, path.count - 1);
      pos[i * 3] = path.pts[i0 * 3] * (1 - f) + path.pts[i1 * 3] * f;
      pos[i * 3 + 1] = path.pts[i0 * 3 + 1] * (1 - f) + path.pts[i1 * 3 + 1] * f;
      pos[i * 3 + 2] = path.pts[i0 * 3 + 2] * (1 - f) + path.pts[i1 * 3 + 2] * f;
    }
    if (pulsesRef.current) {
      (pulsesRef.current.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    }

    // Update flashes
    for (let k = 0; k < FLASH_COUNT; k++) {
      const fl = flashes[k];
      if (fl.life > 0) {
        fl.life -= dt * 3.0; // ~330ms
        if (fl.life < 0) fl.life = 0;
      }
      flashPositions[k * 3] = fl.x;
      flashPositions[k * 3 + 1] = fl.y;
      flashPositions[k * 3 + 2] = fl.z;
      flashLives[k] = fl.life;
    }
    if (flashRef.current) {
      (flashRef.current.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (flashRef.current.geometry.getAttribute("aLife") as THREE.BufferAttribute).needsUpdate = true;
    }

    // Group rotation + parallax
    if (groupRef.current) {
      groupRef.current.rotation.y += dt * (sp ? 0.1 : 0.04);
      const targetRotY = mouseNDC.current.x * 0.35;
      const targetRotX = -mouseNDC.current.y * 0.25 + Math.sin(t * 0.18) * 0.08;
      groupRef.current.rotation.y += (targetRotY - (groupRef.current.rotation.y % (Math.PI * 2))) * 0.0; // keep auto rotation, but tilt
      groupRef.current.rotation.x += (targetRotX - groupRef.current.rotation.x) * 0.05;
    }

    // Soma breathing — heart-like double beat
    if (coreRef.current) {
      const beatFreq = sp ? 3.0 : thinking ? 2.0 : 1.3;
      const beat =
        Math.pow(Math.max(0, Math.sin(t * beatFreq * Math.PI)), 4) * (sp ? 0.18 : 0.1);
      coreRef.current.scale.setScalar(1 + beat + uniforms.uPulse.value * 0.05);
    }
    if (nucleusRef.current) {
      nucleusRef.current.scale.setScalar(1 + Math.sin(t * 1.7) * 0.08);
    }
    if (haloRef.current) {
      const breath = 1 + Math.sin(t * 0.9) * 0.08;
      haloRef.current.scale.setScalar(breath);
      const m = haloRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.18 + uniforms.uPulse.value * 0.3;
    }
  });

  // ── Tube shader: myeline bands + fresnel + mouse deformation + shock wave
  const tubeVertex = /* glsl */ `
    uniform float uTime;
    uniform vec3 uMouse;
    uniform vec3 uShockPos;
    uniform float uShockTime;
    attribute float aDist;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying float vDist;
    varying float vShock;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vDist = aDist;
      vec3 p = position;
      // local mouse deformation (gauss falloff)
      float md = distance(p, uMouse);
      float push = exp(-md * md * 6.0) * 0.07;
      p += normal * push;
      // shock wave: ring of displacement traveling outward from click
      float dt = uTime - uShockTime;
      float waveR = dt * 2.2;
      float sd = distance(p, uShockPos);
      float ring = exp(-pow((sd - waveR) * 4.0, 2.0)) * exp(-dt * 1.2);
      p += normal * ring * 0.12;
      vShock = ring;
      vWorldPos = p;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `;
  const tubeFragment = /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uColor2;
    uniform float uPulse;
    uniform float uTime;
    uniform float uIntensity;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying float vDist;
    varying float vShock;
    void main() {
      // myelin bands along axon
      float band = 0.5 + 0.5 * sin(vUv.x * 6.28);
      float myelin = smoothstep(0.35, 0.85, band);
      // fresnel-ish on tube surface
      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      float fres = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 1.6);
      // distance gradient: warm core, cooler tips
      float t = smoothstep(0.2, 2.6, vDist);
      vec3 baseCol = mix(uColor2, uColor, t);
      vec3 sheath = mix(baseCol * 0.5, baseCol * 1.4, myelin);
      vec3 col = sheath + baseCol * fres * (0.6 + uPulse * 0.8);
      // traveling shimmer with pulse
      col += uColor2 * (0.3 + uPulse * 0.5) * smoothstep(0.7, 1.0,
        0.5 + 0.5 * sin(vUv.x * 1.2 - uTime * 3.0));
      // shock highlight
      col += vec3(1.0, 0.9, 0.8) * vShock * 2.0;
      float a = (0.85 - t * 0.35) * uIntensity;
      gl_FragColor = vec4(col, a);
    }
  `;

  const pulseVertex = /* glsl */ `
    uniform float uPulse;
    attribute float aSeed;
    varying float vSeed;
    void main() {
      vSeed = aSeed;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float size = (2.6 + aSeed * 3.4) * (1.0 + uPulse * 1.3);
      gl_PointSize = size * (340.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `;
  const pulseFragment = /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uColor2;
    uniform float uPulse;
    varying float vSeed;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d);
      vec3 hot = mix(uColor2, uColor, vSeed);
      vec3 col = hot * (1.7 + uPulse * 1.6) + vec3(1.0, 0.85, 0.7) * pow(a, 6.0) * 0.6;
      gl_FragColor = vec4(col, a * (0.85 + uPulse * 0.15));
    }
  `;

  const flashVertex = /* glsl */ `
    attribute float aLife;
    varying float vLife;
    void main() {
      vLife = aLife;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float size = (8.0 + aLife * 14.0);
      gl_PointSize = size * (340.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `;
  const flashFragment = /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uColor2;
    varying float vLife;
    void main() {
      if (vLife <= 0.0) discard;
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d) * vLife;
      vec3 col = mix(uColor, vec3(1.0, 0.95, 0.85), 0.6) * (1.5 + vLife * 1.5);
      gl_FragColor = vec4(col, a);
    }
  `;

  const somaVertex = /* glsl */ `
    uniform float uTime;
    varying float vFlick;
    void main() {
      float f = fract(sin(dot(position, vec3(12.9, 78.2, 37.7))) * 43758.5);
      vFlick = 0.5 + 0.5 * sin(uTime * 1.8 + f * 6.28);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = (1.6 + f * 1.4) * (240.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `;
  const somaFragment = /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uColor2;
    uniform float uPulse;
    varying float vFlick;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d) * (0.4 + vFlick * 0.6);
      vec3 col = mix(uColor, uColor2, vFlick) * (0.9 + uPulse * 0.6);
      gl_FragColor = vec4(col, a);
    }
  `;

  // ── Soma core: organic FBM-displaced membrane
  const somaCoreVertex = /* glsl */ `
    uniform float uTime;
    uniform float uPulse;
    varying vec3 vNormal;
    varying vec3 vPos;
    // simple 3D noise
    float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float noise(vec3 p) {
      vec3 i = floor(p); vec3 f = fract(p);
      f = f*f*(3.0-2.0*f);
      return mix(
        mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
            mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
            mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
    }
    float fbm(vec3 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; }
      return v;
    }
    void main() {
      vec3 n = normalize(normal);
      float f = fbm(position * 3.5 + uTime * 0.4);
      float disp = (f - 0.5) * (0.06 + uPulse * 0.08);
      vec3 p = position + n * disp;
      vNormal = normalize(normalMatrix * n);
      vPos = p;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `;
  const somaCoreFragment = /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uColor2;
    uniform float uPulse;
    varying vec3 vNormal;
    varying vec3 vPos;
    void main() {
      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      float fres = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 2.0);
      vec3 core = mix(uColor2 * 1.4, uColor, fres);
      core += uColor2 * (0.5 + uPulse * 1.0) * (1.0 - fres);
      float a = clamp(0.55 + fres * 0.5 + uPulse * 0.2, 0.0, 1.0);
      gl_FragColor = vec4(core, a);
    }
  `;

  return (
    <group ref={groupRef}>
      {/* outer halo */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshBasicMaterial
          color={uniforms.uColor.value}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* organic soma membrane */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.3, 5]} />
        <shaderMaterial
          vertexShader={somaCoreVertex}
          fragmentShader={somaCoreFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* bright nucleus */}
      <mesh ref={nucleusRef}>
        <sphereGeometry args={[0.12, 32, 32]} />
        <meshBasicMaterial
          color={uniforms.uColor2.value}
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* dendrites — myelinated tubes */}
      <mesh geometry={tubeGeom}>
        <shaderMaterial
          ref={tubeMatRef}
          vertexShader={tubeVertex}
          fragmentShader={tubeFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* synaptic terminals */}
      <points ref={somaRef} geometry={somaGeom}>
        <shaderMaterial
          vertexShader={somaVertex}
          fragmentShader={somaFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* live action potentials */}
      <points ref={pulsesRef} geometry={pulseGeom}>
        <shaderMaterial
          vertexShader={pulseVertex}
          fragmentShader={pulseFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* synaptic flash bursts */}
      <points ref={flashRef} geometry={flashGeom}>
        <shaderMaterial
          vertexShader={flashVertex}
          fragmentShader={flashFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export default function NeuronCore({ mood, state, speaking, intensity = 1 }: Props) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 5.2], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <fog attach="fog" args={["#0a0608", 3.8, 8.5]} />
      <ambientLight intensity={0.4} />
      <NeuronWeb mood={mood} state={state} speaking={speaking} intensity={intensity} />
    </Canvas>
  );
}

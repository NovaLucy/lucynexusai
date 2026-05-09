import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { MOOD_HSL, type AgentState, type Mood } from "@/apn/types";

/**
 * NeuronCore — hundreds of interconnected dendrites radiating from a glowing
 * soma, with live action-potential pulses traveling along the branches.
 * Inspired by neural tissue imagery.
 */

interface Props {
  mood: Mood;
  state: AgentState;
  speaking?: boolean;
  intensity?: number;
}

function moodColor(mood: Mood, lOff = 0): THREE.Color {
  const m = MOOD_HSL[mood];
  const c = new THREE.Color();
  c.setHSL(m.h / 360, m.s / 100, Math.min(0.75, m.l / 100 + lOff));
  return c;
}

interface BranchPath {
  pts: Float32Array; // flattened xyz, length = N*3
  count: number;
  length: number; // approx total length
}

function buildDendrites(
  branchCount: number,
  seed: number,
): { paths: BranchPath[]; lineGeom: THREE.BufferGeometry; somaPositions: Float32Array } {
  // pseudo-random
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s & 0xffffffff) / 0xffffffff;
  };

  const paths: BranchPath[] = [];
  const lineVerts: number[] = [];
  const somaList: number[] = [];

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
      // wiggle direction
      d.x += (rnd() - 0.5) * 0.35;
      d.y += (rnd() - 0.5) * 0.35;
      d.z += (rnd() - 0.5) * 0.35;
      // bias outward at start, allow curvature later
      d.normalize();
      cur.addScaledVector(d, stepLen);
      segs.push(cur.clone());
      len += stepLen;
      total += stepLen;
      // chance to fork
      if (depth < 3 && rnd() < 0.04 && len > 0.3) {
        const forkDir = d
          .clone()
          .add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.8))
          .normalize();
        grow(cur.clone(), forkDir, depth + 1, energy * (0.45 + rnd() * 0.25));
      }
      // terminate early sometimes
      if (rnd() < 0.005) break;
    }
    // bouton (synaptic tip)
    somaList.push(cur.x, cur.y, cur.z);

    // build line segment list
    const flat = new Float32Array(segs.length * 3);
    for (let i = 0; i < segs.length; i++) {
      flat[i * 3] = segs[i].x;
      flat[i * 3 + 1] = segs[i].y;
      flat[i * 3 + 2] = segs[i].z;
      if (i > 0) {
        lineVerts.push(segs[i - 1].x, segs[i - 1].y, segs[i - 1].z);
        lineVerts.push(segs[i].x, segs[i].y, segs[i].z);
      }
    }
    paths.push({ pts: flat, count: segs.length, length: total });
  };

  for (let i = 0; i < branchCount; i++) {
    // emit from soma surface
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

  const lineGeom = new THREE.BufferGeometry();
  lineGeom.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(lineVerts), 3),
  );

  return {
    paths,
    lineGeom,
    somaPositions: new Float32Array(somaList),
  };
}

function NeuronWeb({ mood, state, speaking, intensity = 1 }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const pulsesRef = useRef<THREE.Points>(null);
  const somaRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  const { paths, lineGeom, somaPositions } = useMemo(
    () => buildDendrites(180, 1337),
    [],
  );

  // Pulse pool — each pulse travels along a chosen path
  const PULSE_COUNT = 380;
  const pulses = useMemo(() => {
    const arr: { path: number; t: number; speed: number; life: number }[] = [];
    for (let i = 0; i < PULSE_COUNT; i++) {
      arr.push({
        path: Math.floor(Math.random() * paths.length),
        t: Math.random(),
        speed: 0.35 + Math.random() * 0.7,
        life: Math.random(),
      });
    }
    return arr;
  }, [paths.length]);

  const pulsePositions = useMemo(() => new Float32Array(PULSE_COUNT * 3), []);
  const pulseSeeds = useMemo(() => {
    const a = new Float32Array(PULSE_COUNT);
    for (let i = 0; i < PULSE_COUNT; i++) a[i] = Math.random();
    return a;
  }, []);

  const pulseGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pulsePositions, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(pulseSeeds, 1));
    return g;
  }, [pulsePositions, pulseSeeds]);

  const somaGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(somaPositions, 3));
    return g;
  }, [somaPositions]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: moodColor(mood, 0.15) },
      uColor2: { value: moodColor(mood, -0.1) },
      uPulse: { value: 0 },
      uIntensity: { value: intensity },
    }),
    [],
  );

  useMemo(() => {
    uniforms.uColor.value = moodColor(mood, 0.15);
    uniforms.uColor2.value = moodColor(mood, -0.1);
  }, [mood]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;

    const sp = speaking || state === "speaking";
    const thinking = state === "thinking";
    const listening = state === "listening";

    const target = sp ? 1.2 : thinking ? 0.7 : listening ? 0.4 : 0.18;
    uniforms.uPulse.value += (target - uniforms.uPulse.value) * 0.07;

    const speedMul = sp ? 2.4 : thinking ? 1.7 : listening ? 1.1 : 0.7;

    // Update pulses along their path
    const pos = pulsePositions;
    for (let i = 0; i < PULSE_COUNT; i++) {
      const p = pulses[i];
      p.t += dt * p.speed * speedMul * 0.5;
      if (p.t >= 1) {
        p.t = 0;
        p.path = Math.floor(Math.random() * paths.length);
        p.speed = 0.35 + Math.random() * 0.7;
      }
      const path = paths[p.path];
      const idxF = p.t * (path.count - 1);
      const i0 = Math.floor(idxF);
      const f = idxF - i0;
      const i1 = Math.min(i0 + 1, path.count - 1);
      const x = path.pts[i0 * 3] * (1 - f) + path.pts[i1 * 3] * f;
      const y = path.pts[i0 * 3 + 1] * (1 - f) + path.pts[i1 * 3 + 1] * f;
      const z = path.pts[i0 * 3 + 2] * (1 - f) + path.pts[i1 * 3 + 2] * f;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    }
    if (pulsesRef.current) {
      const attr = pulsesRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      attr.needsUpdate = true;
    }

    if (groupRef.current) {
      groupRef.current.rotation.y += dt * (sp ? 0.12 : 0.045);
      groupRef.current.rotation.x = Math.sin(uniforms.uTime.value * 0.18) * 0.12;
    }
    if (coreRef.current) {
      const breath = 1 + Math.sin(uniforms.uTime.value * (sp ? 4.5 : 1.4)) * (sp ? 0.12 : 0.05);
      coreRef.current.scale.setScalar(breath);
    }
    if (haloRef.current) {
      const breath = 1 + Math.sin(uniforms.uTime.value * 0.9) * 0.06;
      haloRef.current.scale.setScalar(breath);
      const m = haloRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.18 + uniforms.uPulse.value * 0.25;
    }
  });

  // ── Line shader: fades by distance from center, mood-tinted
  const lineVertex = /* glsl */ `
    varying float vDist;
    varying vec3 vPos;
    void main() {
      vDist = length(position);
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const lineFragment = /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uColor2;
    uniform float uPulse;
    uniform float uTime;
    uniform float uIntensity;
    varying float vDist;
    varying vec3 vPos;
    void main() {
      // closer = warmer (color2), farther = cooler (color)
      float t = smoothstep(0.2, 2.6, vDist);
      vec3 col = mix(uColor2 * 1.6, uColor, t);
      // subtle traveling shimmer
      float shimmer = 0.5 + 0.5 * sin(vDist * 6.0 - uTime * 2.0);
      col += uColor * shimmer * 0.15 * uPulse;
      float a = (1.0 - t * 0.65) * (0.55 + uPulse * 0.35) * uIntensity;
      gl_FragColor = vec4(col, a);
    }
  `;

  // ── Pulse shader (action potentials)
  const pulseVertex = /* glsl */ `
    uniform float uTime;
    uniform float uPulse;
    attribute float aSeed;
    varying float vSeed;
    void main() {
      vSeed = aSeed;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float size = (2.4 + aSeed * 3.2) * (1.0 + uPulse * 1.2);
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
      // hot core, mood halo
      vec3 hot = mix(uColor, uColor2, vSeed);
      vec3 col = hot * (1.5 + uPulse * 1.5);
      gl_FragColor = vec4(col, a * (0.85 + uPulse * 0.15));
    }
  `;

  // ── Soma (synaptic terminals) — small static glowing dots
  const somaVertex = /* glsl */ `
    uniform float uTime;
    attribute vec3 position;
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

  return (
    <group ref={groupRef}>
      {/* Soft glow halo behind soma */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshBasicMaterial
          color={uniforms.uColor.value}
          transparent
          opacity={0.25}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Glowing soma (cell body) */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.28, 48, 48]} />
        <meshBasicMaterial
          color={uniforms.uColor2.value}
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Dendrites */}
      <lineSegments ref={linesRef} geometry={lineGeom}>
        <shaderMaterial
          vertexShader={lineVertex}
          fragmentShader={lineFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* Synaptic terminals */}
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

      {/* Action potentials (live pulses along dendrites) */}
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
      <ambientLight intensity={0.4} />
      <NeuronWeb mood={mood} state={state} speaking={speaking} intensity={intensity} />
    </Canvas>
  );
}

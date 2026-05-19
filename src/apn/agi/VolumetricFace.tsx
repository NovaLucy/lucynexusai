import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { MOOD_HSL, type AgentState, type Mood } from "@/apn/types";

/**
 * Bio-organic volumetric face core — multi-layer additive sphere with FBM
 * vertex displacement, gaseous outer veil, particle aura and orbital rings.
 * Cinematic 4K — adapts to mood (color), state (pulse/distortion).
 */

interface CoreProps {
  mood: Mood;
  state: AgentState;
  speaking?: boolean;
  intensity?: number; // 0..1.5
  gazeX?: number;
  gazeY?: number;
  present?: boolean;
}

function moodColor(mood: Mood, lightOffset = 0.1): THREE.Color {
  const m = MOOD_HSL[mood];
  const c = new THREE.Color();
  c.setHSL(m.h / 360, m.s / 100, Math.min(0.7, m.l / 100 + lightOffset));
  return c;
}
function complementColor(mood: Mood): THREE.Color {
  const m = MOOD_HSL[mood];
  const c = new THREE.Color();
  c.setHSL(((m.h + 35) % 360) / 360, m.s / 100, Math.min(0.6, m.l / 100 + 0.05));
  return c;
}

function NeuralCore({ mood, state, speaking, intensity = 1, gazeX = 0, gazeY = 0, present = true }: CoreProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const veilRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const disc = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const gazeRef = useRef({ x: 0, y: 0, p: 1 });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: moodColor(mood) },
      uColor2: { value: complementColor(mood) },
      uPulse: { value: 0 },
      uDistortion: { value: 0.4 },
      uIntensity: { value: intensity },
    }),
    [],
  );

  const veilUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: moodColor(mood, 0.2) },
      uPulse: { value: 0 },
    }),
    [],
  );

  // Update colors reactively
  useMemo(() => {
    uniforms.uColor.value = moodColor(mood);
    uniforms.uColor2.value = complementColor(mood);
    veilUniforms.uColor.value = moodColor(mood, 0.2);
  }, [mood]);

  // Particles geometry — orbital aura
  const particles = useMemo(() => {
    const N = 220;
    const positions = new Float32Array(N * 3);
    const seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = 1.7 + Math.random() * 0.9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return geo;
  }, []);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    veilUniforms.uTime.value += dt;
    const sp = speaking || state === "speaking";
    const thinking = state === "thinking";
    const listening = state === "listening";

    const targetDist = sp ? 0.95 : thinking ? 0.7 : listening ? 0.55 : 0.42;
    uniforms.uDistortion.value += (targetDist - uniforms.uDistortion.value) * 0.06;

    const pulseTarget = sp ? 1.1 : thinking ? 0.55 : 0.18;
    uniforms.uPulse.value += (pulseTarget - uniforms.uPulse.value) * 0.08;
    veilUniforms.uPulse.value = uniforms.uPulse.value;

    if (meshRef.current) {
      meshRef.current.rotation.y += dt * (sp ? 0.32 : thinking ? 0.55 : 0.1);
      meshRef.current.rotation.x = Math.sin(uniforms.uTime.value * 0.3) * 0.18;
    }
    if (veilRef.current) {
      veilRef.current.rotation.y -= dt * 0.08;
      veilRef.current.rotation.z += dt * 0.04;
      const breath = 1 + Math.sin(uniforms.uTime.value * 0.7) * 0.04;
      veilRef.current.scale.setScalar(breath);
    }
    if (shellRef.current) {
      shellRef.current.rotation.y -= dt * 0.16;
      shellRef.current.rotation.z += dt * 0.05;
    }
    if (innerRef.current) {
      const breath = 1 + Math.sin(uniforms.uTime.value * (sp ? 5 : 1.4)) * (sp ? 0.09 : 0.035);
      innerRef.current.scale.setScalar(0.55 * breath);
    }
    if (ring1.current) ring1.current.rotation.z += dt * 0.35;
    if (ring2.current) {
      ring2.current.rotation.x += dt * 0.22;
      ring2.current.rotation.y += dt * 0.16;
    }
    if (disc.current) {
      disc.current.rotation.z += dt * 0.05;
      const op = (disc.current.material as THREE.MeshBasicMaterial);
      op.opacity = 0.06 + uniforms.uPulse.value * 0.05;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y += dt * (sp ? 0.18 : 0.05);
      particlesRef.current.rotation.x += dt * 0.02;
    }
  });

  // ── Core shader (FBM, double color, fresnel) ─────────────────────────
  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uDistortion;
    varying vec3 vNormal;
    varying float vNoise;
    varying vec3 vPos;

    vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
    vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0,0.5,1.0,2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute( permute( permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
    }

    // FBM 3 octaves — gives cellular/veined texture
    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 3; i++) {
        v += a * snoise(p);
        p *= 2.07;
        a *= 0.55;
      }
      return v;
    }

    void main() {
      vec3 pos = position;
      float n  = fbm(pos * 1.4 + vec3(uTime * 0.32));
      float n2 = snoise(pos * 3.6 - vec3(uTime * 0.55));
      float displ = (n * 0.75 + n2 * 0.25) * uDistortion;
      vNoise = displ;
      vec3 newPos = pos + normal * displ;
      vNormal = normalize(normalMatrix * normal);
      vPos = newPos;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uColor2;
    uniform float uPulse;
    uniform float uIntensity;
    varying vec3 vNormal;
    varying float vNoise;

    void main() {
      float rim = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 2.0);
      float core = smoothstep(-0.55, 0.85, vNoise);
      // Mix mood color with complementary on rim — cinematic depth
      vec3 base = mix(uColor * 0.22, uColor2 * 0.9, rim * 0.55);
      vec3 glow = uColor * (1.55 + uPulse * 1.4);
      vec3 col = mix(base, glow, rim * 0.85 + core * 0.45);
      // Veins
      col += uColor * uPulse * 0.5 * smoothstep(0.15, 0.95, vNoise);
      // Inner cellular highlight
      col += uColor2 * 0.25 * smoothstep(0.4, 1.0, core);
      float alpha = clamp(0.65 + rim * 0.4 + uPulse * 0.25, 0.0, 1.0) * uIntensity;
      gl_FragColor = vec4(col, alpha);
    }
  `;

  // ── Outer gaseous veil shader ────────────────────────────────────────
  const veilVertex = /* glsl */ `
    uniform float uTime;
    varying vec3 vNormal;
    varying float vN;
    // simple noise for veil deformation
    float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
    void main(){
      vec3 pos = position;
      float n = sin(pos.x*2.0 + uTime*0.6) * 0.5 + cos(pos.y*1.7 - uTime*0.4) * 0.5;
      pos += normal * n * 0.06;
      vN = n;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;
  const veilFragment = /* glsl */ `
    uniform vec3 uColor;
    uniform float uPulse;
    varying vec3 vNormal;
    varying float vN;
    void main(){
      float rim = pow(1.0 - max(dot(vNormal, vec3(0.0,0.0,1.0)), 0.0), 3.5);
      float a = rim * (0.32 + uPulse * 0.25);
      vec3 col = uColor * (0.6 + uPulse * 0.5);
      gl_FragColor = vec4(col, a);
    }
  `;

  // ── Particle shader ───────────────────────────────────────────────────
  const particleVertex = /* glsl */ `
    uniform float uTime;
    uniform float uPulse;
    attribute float aSeed;
    varying float vSeed;
    void main(){
      vSeed = aSeed;
      vec3 p = position;
      // gentle drift around home
      p += 0.05 * vec3(
        sin(uTime * (0.4 + aSeed * 0.6) + aSeed * 6.28),
        cos(uTime * (0.3 + aSeed * 0.5) + aSeed * 3.14),
        sin(uTime * (0.5 + aSeed * 0.4))
      );
      vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
      float size = (1.6 + aSeed * 2.4) * (1.0 + uPulse * 0.8);
      gl_PointSize = size * (320.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
    }
  `;
  const particleFragment = /* glsl */ `
    uniform vec3 uColor;
    uniform float uPulse;
    varying float vSeed;
    void main(){
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d);
      vec3 col = uColor * (0.8 + vSeed * 0.6 + uPulse * 0.4);
      gl_FragColor = vec4(col, a * (0.55 + vSeed * 0.45));
    }
  `;

  return (
    <group>
      {/* Equatorial dust disc — Saturn-like soft halo */}
      <mesh ref={disc} rotation={[Math.PI / 2.05, 0, 0]}>
        <ringGeometry args={[1.7, 2.6, 96]} />
        <meshBasicMaterial
          color={uniforms.uColor.value}
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Outer wireframe shell — bio cage */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[1.6, 2]} />
        <meshBasicMaterial
          color={uniforms.uColor.value}
          wireframe
          transparent
          opacity={0.16}
        />
      </mesh>

      {/* Two orbital rings */}
      <mesh ref={ring1} rotation={[Math.PI / 2.1, 0, 0]}>
        <torusGeometry args={[1.95, 0.006, 12, 160]} />
        <meshBasicMaterial color={uniforms.uColor.value} transparent opacity={0.6} />
      </mesh>
      <mesh ref={ring2} rotation={[0.85, 0.45, 0]}>
        <torusGeometry args={[2.18, 0.004, 8, 128]} />
        <meshBasicMaterial color={uniforms.uColor2.value} transparent opacity={0.4} />
      </mesh>

      {/* Particle aura */}
      <points ref={particlesRef} geometry={particles}>
        <shaderMaterial
          vertexShader={particleVertex}
          fragmentShader={particleFragment}
          uniforms={veilUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Gaseous outer veil */}
      <mesh ref={veilRef}>
        <icosahedronGeometry args={[1.32, 5]} />
        <shaderMaterial
          vertexShader={veilVertex}
          fragmentShader={veilFragment}
          uniforms={veilUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Main displaced organic core */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.0, 96]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner pulsing nucleus */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={uniforms.uColor.value}
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

interface Props {
  mood: Mood;
  state: AgentState;
  speaking?: boolean;
  intensity?: number;
}

export default function VolumetricFace({ mood, state, speaking, intensity = 1 }: Props) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 4.0], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[3, 3, 3]} intensity={0.8} />
      <NeuralCore mood={mood} state={state} speaking={speaking} intensity={intensity} />
    </Canvas>
  );
}

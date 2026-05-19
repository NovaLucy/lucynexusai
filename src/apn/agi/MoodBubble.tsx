import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { MOOD_HSL, type AgentState, type Mood } from "@/apn/types";

/**
 * MoodBubble — bulle/nuage organique vivante. Surface déformée par bruit 3D,
 * gradient interne, halo doux, couleur pilotée par l'humeur, amplitude par l'état.
 */

interface Props {
  mood: Mood;
  state: AgentState;
  speaking?: boolean;
  intensity?: number;
  medicalMode?: boolean;
  /** Position normalisée du visage de l'utilisateur (-1..1). */
  gazeX?: number;
  gazeY?: number;
  /** True si un visage est actuellement détecté. */
  present?: boolean;
}

function moodColor(mood: Mood, lOff = 0, hShift = 0, sBoost = 0, medical = false): THREE.Color {
  const c = new THREE.Color();
  if (medical) {
    // Vivid crimson heartbeat — high saturation, deep but luminous red
    c.setHSL(
      ((355 + hShift + 360) % 360) / 360,
      Math.min(1, 0.92 + sBoost),
      Math.min(0.65, Math.max(0.08, 0.22 + lOff)),
    );
    return c;
  }
  const m = MOOD_HSL[mood];
  c.setHSL(
    ((m.h + hShift + 360) % 360) / 360,
    Math.min(1, Math.max(0, m.s / 100 + sBoost)),
    Math.min(0.85, Math.max(0, m.l / 100 + lOff)),
  );
  return c;
}

function Bubble({ mood, state, speaking, intensity = 1, medicalMode = false, gazeX = 0, gazeY = 0, present = true }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const gazeRef = useRef({ x: 0, y: 0, present: 1 });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0.18 },
      uSpeed: { value: 0.6 },
      uColorA: { value: moodColor(mood, 0.05, -10, 0.05, medicalMode) },
      uColorB: { value: moodColor(mood, -0.1, 20, 0.1, medicalMode) },
      uColorRim: { value: moodColor(mood, 0.25, 0, 0, medicalMode) },
      uIntensity: { value: intensity },
      uPulse: { value: 0 },
      uMedical: { value: medicalMode ? 1.0 : 0.0 },
    }),
    [medicalMode],
  );

  useEffect(() => {
    uniforms.uColorA.value = moodColor(mood, 0.05, -10, 0.05, medicalMode);
    uniforms.uColorB.value = moodColor(mood, -0.1, 20, 0.1, medicalMode);
    uniforms.uColorRim.value = moodColor(mood, 0.25, 0, 0, medicalMode);
    uniforms.uMedical.value = medicalMode ? 1.0 : 0.0;
  }, [mood, medicalMode, uniforms]);

  useEffect(() => {
    uniforms.uIntensity.value = intensity;
  }, [intensity, uniforms]);

  useFrame((_, dt) => {
    // Smooth gaze target → look-at offset
    const gx = gazeRef.current;
    gx.x += ((gazeX ?? 0) - gx.x) * 0.12;
    gx.y += ((gazeY ?? 0) - gx.y) * 0.12;
    const presentTarget = present ? 1 : 0;
    gx.present += (presentTarget - gx.present) * 0.05;

    uniforms.uTime.value += dt;
    const t = uniforms.uTime.value;

    const sp = speaking || state === "speaking";
    const thinking = state === "thinking";
    const listening = state === "listening";
    const sleeping = state === "sleeping";

    // Soft heartbeat in medical mode (~45 bpm, gentle S1→S2)
    let heartBeat = 0;
    if (medicalMode && !sleeping) {
      const phase = (t * 0.75) % 1.0; // ~45 bpm — slower, calmer
      const s1 = Math.exp(-Math.pow(phase * 14, 2));
      const s2 = Math.exp(-Math.pow((phase - 0.37) * 18, 2));
      heartBeat = s1 * 0.50 + s2 * 0.28;
    }

    // Cinematic mix: standby = breath, listening = particle pull,
    // thinking = inner agitation, speaking = surface vibration, sleeping = near-zero.
    // Slowed down during interactions for a calmer, more meditative dark-matter feel.
    // Movement is intentionally restrained during interactions — calmer dark-matter feel.
    const ampTarget    = sleeping ? 0.015 : sp ? 0.075 : thinking ? 0.055 : listening ? 0.045 : 0.04;
    const speedTarget  = sleeping ? 0.05  : sp ? 0.22  : thinking ? 0.18  : listening ? 0.12  : 0.10;
    const pulseTarget  = sleeping ? 0.015 : sp ? 0.20  : thinking ? 0.14  : listening ? 0.10  : 0.06;

    uniforms.uAmp.value   += (ampTarget   - uniforms.uAmp.value)   * 0.018;
    uniforms.uSpeed.value += (speedTarget - uniforms.uSpeed.value) * 0.018;
    uniforms.uPulse.value += (pulseTarget + heartBeat * 2.0 - uniforms.uPulse.value) * 0.018;

    // Effective intensity dims when sleeping or when no user detected (yeux fermés)
    const presenceFactor = sleeping ? 0.25 : (0.35 + 0.65 * gx.present);
    const intTarget = intensity * presenceFactor * (1.0 + heartBeat * 0.35);
    uniforms.uIntensity.value += (intTarget - uniforms.uIntensity.value) * 0.04;

    if (meshRef.current) {
      // Speaking → softer spin + tiny vertical jitter (voice surface vibration)
      const spinBase = sleeping ? 0.003 : sp ? 0.05 : thinking ? 0.035 : listening ? 0.022 : 0.018;
      meshRef.current.rotation.y += dt * spinBase;
      meshRef.current.rotation.x = Math.sin(t * (sleeping ? 0.03 : 0.05)) * (sleeping ? 0.03 : 0.05);
      const breathFreq = sleeping ? 0.25 : sp ? 0.55 : thinking ? 0.45 : 0.4;
      const breathAmp  = sleeping ? 0.005 : sp ? 0.012 : thinking ? 0.009 : 0.007;
      const vibrato    = sp ? Math.sin(t * 8) * 0.0016 : 0;
      const heartScale = medicalMode && !sleeping ? heartBeat * 0.065 : 0;
      meshRef.current.scale.setScalar(1 + Math.sin(t * breathFreq) * breathAmp + vibrato + heartScale);
      // Sleeping → slight downward sag. Gaze → bubble subtly turns toward user.
      meshRef.current.position.x = gx.x * 0.18 * gx.present;
      meshRef.current.position.y = (sleeping ? -0.04 : 0) - gx.y * 0.14 * gx.present;
      meshRef.current.rotation.y += gx.x * 0.005 * gx.present;
    }
    if (innerRef.current) {
      // Thinking → inner whorl spins (mental agitation, slowed)
      const innerSpin = sleeping ? -0.003 : thinking ? -0.11 : sp ? -0.06 : -0.03;
      innerRef.current.rotation.y += dt * innerSpin;
      innerRef.current.rotation.z = Math.cos(t * (thinking ? 0.22 : 0.10)) * (thinking ? 0.18 : 0.10);
      const s = 0.7 + Math.sin(t * (sp ? 0.7 : 0.55)) * 0.018 + uniforms.uPulse.value * 0.03;
      innerRef.current.scale.setScalar(s);
    }
    if (haloRef.current) {
      // Listening → halo gently expands & contracts as if attracting particles
      const listenPull = listening ? Math.sin(t * 1.4) * 0.08 : 0;
      // Medical mode: halo pulses dramatically with each heartbeat
      const heartHalo = medicalMode && !sleeping ? heartBeat * 0.55 : 0;
      const s = 1.45 + Math.sin(t * (sleeping ? 0.3 : 0.7)) * 0.06 + uniforms.uPulse.value * 0.12 + listenPull + heartHalo;
      haloRef.current.scale.setScalar(s);
      const m = haloRef.current.material as THREE.MeshBasicMaterial;
      const haloOp = sleeping ? 0.015 : 0.06 + uniforms.uPulse.value * 0.12 + heartHalo * 0.6;
      m.opacity = haloOp;
      m.color = uniforms.uColorRim.value;
    }
  });

  // ---------- Shaders ----------
  const vertex = /* glsl */ `
    uniform float uTime;
    uniform float uAmp;
    uniform float uSpeed;
    varying vec3 vNormal;
    varying vec3 vPos;
    varying float vDisp;

    // simplex 3D noise (Ashima)
    vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
    vec4 mod289(vec4 x){return x - floor(x * (1.0/289.0)) * 289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    float snoise(vec3 v){
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
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
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      vec3 p = position;
      float t = uTime * uSpeed;
      float n = snoise(p * 1.4 + vec3(t * 0.6, t * 0.4, -t * 0.5));
      float n2 = snoise(p * 2.6 + vec3(-t * 0.3, t * 0.5, t * 0.2)) * 0.5;
      float disp = (n + n2) * uAmp;
      vDisp = disp;
      vec3 displaced = p + normal * disp;
      vNormal = normalize(normalMatrix * normal);
      vPos = displaced;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `;

  const fragment = /* glsl */ `
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorRim;
    uniform float uPulse;
    uniform float uIntensity;
    uniform float uTime;
    uniform float uMedical;
    varying vec3 vNormal;
    varying vec3 vPos;
    varying float vDisp;

    void main() {
      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      float ndv = abs(dot(normalize(vNormal), viewDir));
      float fres = pow(1.0 - ndv, 3.2);
      // dark matter base — almost black, faint mood tint deep inside
      vec3 deep = mix(vec3(0.008, 0.010, 0.014), vec3(0.060, 0.002, 0.002), uMedical);
      vec3 base = mix(deep, uColorA * 0.18, smoothstep(0.4, -0.2, vDisp));
      // bright rim light (water meniscus / dark drop edge)
      // Medical mode: rim pulses strongly with heartbeat
      vec3 rim = uColorRim * fres * (1.1 + uPulse * 0.8 + uMedical * 1.4);
      // subtle internal caustic shimmer
      float shimmer = 0.5 + 0.5 * sin(vPos.y * 5.0 + uTime * 1.4);
      vec3 col = base + rim + uColorB * shimmer * 0.04 * uPulse;
      // very transparent in the center, opaque at the rim — like a water drop
      // Medical mode: stronger alpha pulse
      float alpha = (0.10 + fres * 0.75 + uMedical * 0.15) * uIntensity;
      gl_FragColor = vec4(col, alpha);
    }
  `;

  return (
    <group>
      {/* outer halo */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[1.05, 48, 48]} />
        <meshBasicMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.25}
          color={uniforms.uColorRim.value}
        />
      </mesh>

      {/* main drop — dark glassy water */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 128, 128]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={vertex}
          fragmentShader={fragment}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* inner subtle nucleus — barely visible mood glow */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.55, 64, 64]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertex}
          fragmentShader={fragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

export default function MoodBubble(props: Props) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 3.4], fov: 38 }}
      gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.6} />
      <Bubble {...props} />
    </Canvas>
  );
}

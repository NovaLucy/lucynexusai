import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { MOOD_HSL, type AgentState, type Mood } from "@/apn/types";

/**
 * Bio-organic volumetric face core — a displaced sphere with vertex-noise
 * shader, pulsing inner glow, and orbital wireframe shells.
 * Reacts to mood (color), state (rotation/distortion), and speaking (pulse).
 */

interface CoreProps {
  mood: Mood;
  state: AgentState;
  speaking?: boolean;
  intensity?: number; // 0..1.5
}

function moodColor(mood: Mood): THREE.Color {
  const m = MOOD_HSL[mood];
  const c = new THREE.Color();
  c.setHSL(m.h / 360, m.s / 100, Math.min(0.65, m.l / 100 + 0.1));
  return c;
}

function NeuralCore({ mood, state, speaking, intensity = 1 }: CoreProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const ring3 = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: moodColor(mood) },
      uPulse: { value: 0 },
      uDistortion: { value: 0.4 },
      uIntensity: { value: intensity },
    }),
    [],
  );

  // Update color reactively
  useMemo(() => {
    uniforms.uColor.value = moodColor(mood);
  }, [mood]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    const sp = speaking || state === "speaking";
    const thinking = state === "thinking";
    const listening = state === "listening";

    // Distortion responds to state
    const targetDist =
      sp ? 0.85 : thinking ? 0.65 : listening ? 0.55 : 0.4;
    uniforms.uDistortion.value += (targetDist - uniforms.uDistortion.value) * 0.06;

    // Pulse
    const pulseTarget = sp ? 1 : thinking ? 0.5 : 0.15;
    uniforms.uPulse.value += (pulseTarget - uniforms.uPulse.value) * 0.08;

    if (meshRef.current) {
      meshRef.current.rotation.y += dt * (sp ? 0.35 : thinking ? 0.6 : 0.12);
      meshRef.current.rotation.x = Math.sin(uniforms.uTime.value * 0.3) * 0.15;
    }
    if (shellRef.current) {
      shellRef.current.rotation.y -= dt * 0.18;
      shellRef.current.rotation.z += dt * 0.06;
    }
    if (innerRef.current) {
      const breath = 1 + Math.sin(uniforms.uTime.value * (sp ? 5 : 1.4)) * (sp ? 0.08 : 0.03);
      innerRef.current.scale.setScalar(0.55 * breath);
    }
    // Orbital rings
    if (ring1.current) ring1.current.rotation.z += dt * 0.4;
    if (ring2.current) {
      ring2.current.rotation.x += dt * 0.25;
      ring2.current.rotation.y += dt * 0.18;
    }
    if (ring3.current) ring3.current.rotation.y -= dt * 0.32;
  });

  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uDistortion;
    varying vec3 vNormal;
    varying float vNoise;

    // Simplex-ish 3D noise (cheap)
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

    void main() {
      vec3 pos = position;
      float n = snoise(pos * 1.6 + vec3(uTime * 0.35));
      float n2 = snoise(pos * 3.2 - vec3(uTime * 0.6));
      float displ = (n * 0.7 + n2 * 0.3) * uDistortion;
      vNoise = displ;
      vec3 newPos = pos + normal * displ;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColor;
    uniform float uPulse;
    uniform float uIntensity;
    varying vec3 vNormal;
    varying float vNoise;
    void main() {
      // Fresnel rim
      float rim = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 2.2);
      float core = smoothstep(-0.5, 0.8, vNoise);
      vec3 deep = uColor * 0.25;
      vec3 glow = uColor * (1.4 + uPulse * 1.2);
      vec3 col = mix(deep, glow, rim * 0.85 + core * 0.4);
      // Inner pulse veins
      col += uColor * uPulse * 0.4 * smoothstep(0.2, 0.9, vNoise);
      float alpha = clamp(0.6 + rim * 0.4 + uPulse * 0.2, 0.0, 1.0) * uIntensity;
      gl_FragColor = vec4(col, alpha);
    }
  `;

  return (
    <group>
      {/* Outer wireframe shell — bio cage */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[1.55, 2]} />
        <meshBasicMaterial
          color={uniforms.uColor.value}
          wireframe
          transparent
          opacity={0.18}
        />
      </mesh>

      {/* Orbital rings */}
      <mesh ref={ring1} rotation={[Math.PI / 2.1, 0, 0]}>
        <torusGeometry args={[1.85, 0.006, 12, 128]} />
        <meshBasicMaterial color={uniforms.uColor.value} transparent opacity={0.55} />
      </mesh>
      <mesh ref={ring2} rotation={[0.8, 0.4, 0]}>
        <torusGeometry args={[2.05, 0.004, 8, 128]} />
        <meshBasicMaterial color={uniforms.uColor.value} transparent opacity={0.35} />
      </mesh>
      <mesh ref={ring3} rotation={[1.4, 1.1, 0.6]}>
        <torusGeometry args={[2.25, 0.003, 8, 96]} />
        <meshBasicMaterial color={uniforms.uColor.value} transparent opacity={0.22} />
      </mesh>

      {/* Main displaced organic core */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.0, 64]} />
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
          opacity={0.45}
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
      dpr={[1, 2]}
      camera={{ position: [0, 0, 4.2], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[3, 3, 3]} intensity={0.8} />
      <NeuralCore mood={mood} state={state} speaking={speaking} intensity={intensity} />
    </Canvas>
  );
}

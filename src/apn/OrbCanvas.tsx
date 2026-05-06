import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ENERGY_TARGET, MOOD_HUE, type AgentState, type Mood } from "@/apn/types";

const MOOD_INDEX: Record<Mood, number> = { calm: 0, empathetic: 1, focused: 2, alert: 3 };

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uHue;
  uniform float uMood;
  uniform float uIntensity;

  vec3 hsv2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
    rgb = rgb*rgb*(3.0-2.0*rgb);
    return c.z * mix(vec3(1.0), rgb, c.y);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = hash(i);
    float b = hash(i+vec2(1.0,0.0));
    float c = hash(i+vec2(0.0,1.0));
    float d = hash(i+vec2(1.0,1.0));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i=0;i<5;i++) {
      v += a * noise(p);
      p = p*2.02 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float ang = atan(p.y, p.x);
    float t = uTime;

    bool isAlert   = abs(uMood - 3.0) < 0.5;
    bool isFocused = abs(uMood - 2.0) < 0.5;

    // Breathing pulse
    float breathSpeed = isAlert ? 4.5 : 1.6;
    float breathAmp   = isAlert ? 0.10 : 0.05;
    float breath = 1.0 + breathAmp * sin(t * breathSpeed) * (0.5 + uEnergy);

    // Glass sphere envelope
    float R = 0.95 * breath;
    float sphereCore = smoothstep(R, R - 0.02, r);   // inside
    float rimRing    = smoothstep(R + 0.02, R, r) * smoothstep(R - 0.04, R, r); // thin outline
    float outerGlow  = smoothstep(R + 0.18, R, r) - smoothstep(R, R - 0.05, r);
    outerGlow = max(outerGlow, 0.0);

    // ---------- Radial filaments (plasma rays) ----------
    // Angular noise pattern: many thin streaks from center to rim
    float spin = isFocused ? t * 0.15 : t * 0.04;
    float a2 = ang + spin;
    // High-frequency angular noise modulated by per-strand flicker
    float n1 = noise(vec2(a2 * 18.0, t * 0.6));
    float n2 = noise(vec2(a2 * 42.0, t * 1.1 + 7.3));
    float strand = pow(n1, 2.0) * 0.7 + pow(n2, 4.0) * 1.2;
    // Radial profile: rays start near core, fade before rim
    float radial = smoothstep(0.05, 0.35, r) * smoothstep(R, 0.45, r);
    // Slight wobble along radius
    radial *= 0.85 + 0.15 * noise(vec2(r * 8.0, a2 * 6.0 + t));
    float filaments = strand * radial;

    // ---------- Bright central star ----------
    float core = exp(-r * r * 55.0) * 1.4;
    // 4-branch starburst spikes
    float spikes = (pow(max(0.0, cos(ang * 2.0)), 60.0) + pow(max(0.0, cos(ang * 2.0 + 1.5707)), 60.0));
    spikes *= exp(-r * 6.0) * 0.9;
    float starCore = (core + spikes) * (0.6 + 0.8 * uEnergy) * breath;

    // ---------- Sparkles on rim ----------
    float sparkle = 0.0;
    for (int i = 0; i < 14; i++) {
      float fi = float(i);
      float aSp = fi * 0.4488 + t * (0.05 + 0.03 * fract(fi * 0.731));
      float rSp = R - 0.02 - 0.04 * fract(fi * 0.317);
      vec2 sp = vec2(cos(aSp), sin(aSp)) * rSp;
      float d = length(p - sp);
      float blink = 0.5 + 0.5 * sin(t * (2.0 + fract(fi * 1.91) * 4.0) + fi);
      sparkle += exp(-d * d * 900.0) * (0.6 + 0.8 * blink);
    }

    // ---------- Mood palette ----------
    vec3 deep   = hsv2rgb(vec3(uHue, 0.95, 0.35));   // background plasma
    vec3 mid    = hsv2rgb(vec3(uHue, 0.85, 0.85));   // filaments
    vec3 bright = hsv2rgb(vec3(uHue + 0.02, 0.25, 1.0)); // core/sparkles

    // Compose interior
    vec3 interior = deep * 0.35;
    interior += mid * filaments * 1.6;
    interior += bright * starCore;
    interior *= sphereCore;

    // Rim & glow
    vec3 rimCol = bright * (rimRing * 1.2 + outerGlow * 0.6);
    vec3 sparkleCol = bright * sparkle;

    vec3 col = interior + rimCol + sparkleCol;
    col *= uIntensity;

    float a = clamp(
      sphereCore * (0.55 + 0.6 * (filaments + starCore))
      + rimRing * 0.9
      + outerGlow * 0.45
      + sparkle, 0.0, 1.0);

    gl_FragColor = vec4(col, a);
  }
`;

interface Props {
  state: AgentState;
  mood: Mood;
  intensity?: number;     // 0.5–1.5
  pixelRatioCap?: number; // default 4 (4K-ready)
}

export default function OrbCanvas({ state, mood, intensity = 1.0, pixelRatioCap = 4 }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const moodRef = useRef(mood);
  const intensityRef = useRef(intensity);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { moodRef.current = mood; }, [mood]);
  useEffect(() => { intensityRef.current = intensity; }, [intensity]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const uniforms = {
      uTime:      { value: 0 },
      uEnergy:    { value: 0.3 },
      uHue:       { value: MOOD_HUE.calm / 360 },
      uMood:      { value: 0 },
      uIntensity: { value: intensity },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthWrite: false,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let energy = 0.3;
    let hue = MOOD_HUE.calm / 360;
    let raf = 0;
    const start = performance.now();
    const animate = () => {
      const now = performance.now();
      const t = (now - start) / 1000;
      const targetEnergy = ENERGY_TARGET[stateRef.current];
      energy += (targetEnergy - energy) * 0.04;
      const targetHue = MOOD_HUE[moodRef.current] / 360;
      // shortest-path interpolation on hue circle
      let dh = targetHue - hue;
      if (dh > 0.5) dh -= 1;
      if (dh < -0.5) dh += 1;
      hue = (hue + dh * 0.06 + 1) % 1;

      uniforms.uTime.value = t;
      uniforms.uEnergy.value = energy;
      uniforms.uHue.value = hue;
      uniforms.uMood.value = MOOD_INDEX[moodRef.current];
      uniforms.uIntensity.value = intensityRef.current;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, [pixelRatioCap]);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />;
}

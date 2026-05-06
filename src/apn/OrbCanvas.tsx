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

  // Plasma sample at point p with given hue
  vec4 sampleOrb(vec2 p, float t, float hue, float energy, bool isAlert, bool isFocused) {
    float r = length(p);
    float ang = atan(p.y, p.x);

    // Breathing
    float breathSpeed = isAlert ? 4.5 : 1.6;
    float breathAmp   = isAlert ? 0.10 : 0.05;
    float breath = 1.0 + breathAmp * sin(t * breathSpeed) * (0.5 + energy);

    float R = 0.92 * breath;

    // Soft sphere envelope (anti-aliased)
    float aa = 0.012;
    float sphereCore = smoothstep(R + aa, R - aa, r);
    // Rim ring (thin bright outline)
    float rimRing = exp(-pow((r - R) / 0.018, 2.0));
    // Outer atmospheric glow
    float outerGlow = exp(-pow(max(r - R, 0.0) / 0.10, 1.4));

    // ---------- Radial filaments ----------
    float spin = isFocused ? t * 0.15 : t * 0.04;
    float a2 = ang + spin;
    // multi-octave angular noise for finer strands
    float n1 = noise(vec2(a2 * 22.0, t * 0.5));
    float n2 = noise(vec2(a2 * 55.0, t * 0.9 + 7.3));
    float n3 = noise(vec2(a2 * 110.0, t * 1.3 + 2.1));
    float strand = pow(n1, 2.2) * 0.55 + pow(n2, 4.0) * 1.1 + pow(n3, 8.0) * 0.6;
    // Radial profile
    float radial = smoothstep(0.04, 0.30, r) * smoothstep(R, 0.42, r);
    radial *= 0.82 + 0.18 * noise(vec2(r * 10.0, a2 * 7.0 + t));
    float filaments = strand * radial;

    // ---------- Bright central star ----------
    float core = exp(-r * r * 65.0) * 1.5;
    float spikes = pow(max(0.0, cos(ang * 2.0)), 80.0)
                 + pow(max(0.0, cos(ang * 2.0 + 1.5707)), 80.0);
    spikes *= exp(-r * 7.0) * 0.85;
    float starCore = (core + spikes) * (0.6 + 0.85 * energy) * breath;

    // ---------- Sparkles on rim ----------
    float sparkle = 0.0;
    for (int i = 0; i < 18; i++) {
      float fi = float(i);
      float aSp = fi * 0.349 + t * (0.04 + 0.035 * fract(fi * 0.731));
      float rSp = R - 0.015 - 0.035 * fract(fi * 0.317);
      vec2 sp = vec2(cos(aSp), sin(aSp)) * rSp;
      float d = length(p - sp);
      float blink = 0.5 + 0.5 * sin(t * (2.0 + fract(fi * 1.91) * 4.0) + fi);
      sparkle += exp(-d * d * 1400.0) * (0.5 + 0.9 * blink);
    }

    // ---------- Palette ----------
    vec3 deep   = hsv2rgb(vec3(hue, 0.95, 0.32));
    vec3 mid    = hsv2rgb(vec3(hue, 0.85, 0.92));
    vec3 bright = hsv2rgb(vec3(hue + 0.02, 0.22, 1.0));

    vec3 interior = deep * 0.32;
    interior += mid * filaments * 1.7;
    interior += bright * starCore;
    interior *= sphereCore;

    vec3 col = interior
             + bright * (rimRing * 1.3 + outerGlow * 0.55)
             + bright * sparkle;

    float a = clamp(
      sphereCore * (0.5 + 0.65 * (filaments + starCore))
      + rimRing * 0.95
      + outerGlow * 0.45
      + sparkle, 0.0, 1.0);

    return vec4(col, a);
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float t = uTime;
    bool isAlert   = abs(uMood - 3.0) < 0.5;
    bool isFocused = abs(uMood - 2.0) < 0.5;

    // 2x2 rotated-grid supersampling for crisp edges
    vec2 dx = dFdx(p) * 0.25;
    vec2 dy = dFdy(p) * 0.25;
    vec4 s0 = sampleOrb(p + vec2( dx.x + dy.x,  dx.y + dy.y), t, uHue, uEnergy, isAlert, isFocused);
    vec4 s1 = sampleOrb(p + vec2(-dx.x + dy.x, -dx.y + dy.y), t, uHue, uEnergy, isAlert, isFocused);
    // Slight chromatic aberration on the second pair (hue offset)
    vec4 s2 = sampleOrb(p + vec2( dx.x - dy.x,  dx.y - dy.y), t, uHue + 0.01, uEnergy, isAlert, isFocused);
    vec4 s3 = sampleOrb(p + vec2(-dx.x - dy.x, -dx.y - dy.y), t, uHue - 0.01, uEnergy, isAlert, isFocused);
    vec4 s = (s0 + s1 + s2 + s3) * 0.25;

    vec3 col = s.rgb * uIntensity;
    // Tonemap (Reinhard) for highlight rolloff
    col = col / (1.0 + col);
    // Gamma
    col = pow(col, vec3(1.0 / 2.2));
    // Subtle dithering to kill banding
    float d = (hash(gl_FragCoord.xy + t) - 0.5) / 255.0;
    col += d;

    gl_FragColor = vec4(col, s.a);
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

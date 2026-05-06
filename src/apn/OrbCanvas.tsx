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

  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = fract(sin(dot(i, vec2(127.1,311.7)))*43758.5453);
    float b = fract(sin(dot(i+vec2(1.0,0.0), vec2(127.1,311.7)))*43758.5453);
    float c2 = fract(sin(dot(i+vec2(0.0,1.0), vec2(127.1,311.7)))*43758.5453);
    float d = fract(sin(dot(i+vec2(1.0,1.0), vec2(127.1,311.7)))*43758.5453);
    return mix(mix(a,b,f.x), mix(c2,d,f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i=0;i<6;i++) {
      v += a * noise(p);
      p = p*2.0 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  // Single vertical filament: thin Gaussian curve drifting & curling, clipped to sphere.
  float strand(vec2 p, float seed, float t, float energy) {
    // sphere clip: max |x| where strand can live
    float maxY = sqrt(max(0.0, 0.25 - p.x*p.x));
    if (abs(p.y) > maxY) return 0.0;

    // base x position for this strand (already encoded in seed via caller)
    // bend the strand horizontally as a function of y
    float wob = fbm(vec2(seed * 13.1, p.y * 3.2 + t * 0.6));
    float curl = sin(p.y * 9.0 + seed * 31.0 + t * 1.4) * 0.018;
    float dx = (wob - 0.5) * 0.06 + curl;

    // distance to the curved strand (in x)
    float d = abs(p.x - (seed - 0.5) * 0.9 - dx);

    // taper at poles (hair-like)
    float taper = 1.0 - smoothstep(0.0, maxY, abs(p.y));
    float thickness = mix(0.0035, 0.010, taper) * (0.8 + 0.4 * energy);

    // gaussian core
    float g = exp(-(d*d) / (thickness*thickness));

    // per-strand flicker
    float flick = 0.55 + 0.45 * sin(t * (6.0 + seed * 11.0) + seed * 47.0);
    flick = mix(0.7, flick, 0.6);

    return g * flick * taper;
  }

  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p);
    float t = uTime;

    // Listening micro-tremble
    float tremble = 0.0;
    if (abs(uMood - 4.0) < 0.5) {
      tremble = sin(t*38.0)*0.010;
    }

    // sphere mask
    float sphere = smoothstep(0.5 + tremble, 0.495, r);
    float inside = step(r, 0.5);

    // Dense filaments — 40 vertical strands w/ golden ratio jitter
    float fil = 0.0;
    const int N = 40;
    for (int i = 0; i < N; i++) {
      float fi = float(i);
      // golden ratio distribution for natural irregular spacing
      float seed = fract(fi * 0.61803398875 + 0.137);
      fil += strand(p, seed, t + fi * 0.13, uEnergy);
    }
    fil = clamp(fil, 0.0, 2.4);

    // Crossings / hot spots — where filaments overlap, push white-pink core
    float hot = pow(fil, 2.2);

    // Dark core gradient (plasma globe has a dark electrode center)
    float darkCore = 1.0 - exp(-r * 4.0) * 0.85;

    // Outer halo
    float halo = exp(-r * 3.6) * 0.55 * uEnergy;

    float pulse = 0.7 + 0.3 * sin(t * 2.6) * uEnergy;
    float breathe = 0.9 + 0.1 * sin(t * 0.7);

    // Edge tint (mood hue) + hot white-pink center
    vec3 edgeCol = hsv2rgb(vec3(uHue, 0.85, 1.0));
    vec3 hotCol  = mix(vec3(1.0, 0.92, 0.98), edgeCol, 0.25);

    vec3 col = edgeCol * fil * darkCore * pulse * breathe;
    col += hotCol * hot * 0.55 * darkCore;
    col += hsv2rgb(vec3(uHue + 0.03, 0.7, 1.0)) * halo;

    // Specular sheen top-left (glass globe feel)
    vec2 sp = p - vec2(-0.18, 0.20);
    float spec = exp(-dot(sp, sp) * 38.0) * 0.18;
    col += vec3(spec);

    col *= sphere * uIntensity;

    // Alpha: visible where strands or halo present, fading at edge
    float a = clamp(fil * 0.9 + hot * 0.6 + halo * 0.8, 0.0, 1.0) * sphere;
    a = max(a, halo * 0.6);

    gl_FragColor = vec4(col, a);
  }
`;

interface Props {
  state: AgentState;
  mood: Mood;
  intensity?: number;     // 0.5–1.5
  pixelRatioCap?: number; // default 1.75
}

export default function OrbCanvas({ state, mood, intensity = 1.0, pixelRatioCap = 1.75 }: Props) {
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

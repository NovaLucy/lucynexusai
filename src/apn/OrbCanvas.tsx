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
    float t = uTime * 0.12;

    bool isAlert   = abs(uMood - 3.0) < 0.5;
    bool isFocused = abs(uMood - 2.0) < 0.5;

    // Soft spherical mask (no hard edge)
    float tremble = isAlert ? sin(uTime*30.0)*0.015 : 0.0;
    float sphere = smoothstep(1.10 + tremble, 0.05, r);
    sphere = pow(sphere, 1.4);

    // Slow rotation in focused mode (spiral feel)
    vec2 pp = p;
    if (isFocused) pp = rot(uTime * 0.08) * pp;

    // Domain-warp self-advected
    vec2 w1 = vec2(fbm(pp*1.1 + vec2(t, -t*0.7)),
                   fbm(pp*1.1 + vec2(-t*0.6, t*0.9)));
    vec2 w2 = vec2(fbm(pp*1.6 + w1*1.4 + t*0.5),
                   fbm(pp*1.6 + w1*1.4 - t*0.4));
    float density = fbm(pp*1.3 + w2*1.8);
    density = smoothstep(0.25, 0.85, density);

    // Bright gaussian core
    float core = exp(-r*r * 5.0) * (0.55 + 0.65 * uEnergy);
    if (isFocused) core *= 1.35;

    // Bokeh / particles around the orb
    float bk = 0.0;
    bk += pow(noise(p*7.0  + vec2(t*0.4, -t*0.3)),  14.0);
    bk += pow(noise(p*13.0 + vec2(-t*0.6, t*0.5)),  18.0) * 0.7;
    bk *= smoothstep(1.25, 0.2, r);

    // Mood palette: dark + light tints around uHue
    vec3 dark  = hsv2rgb(vec3(uHue, 0.55, 0.35));
    vec3 light = hsv2rgb(vec3(uHue + 0.04, 0.40, 1.00));
    vec3 mist  = mix(dark * 0.4, light, density);

    // Subtle iridescent rim
    float ang = atan(p.y, p.x);
    vec3 rimCol = hsv2rgb(vec3(fract(uHue + 0.05*sin(ang*2.0 + t)), 0.35, 1.0));
    float rim = smoothstep(0.4, 1.05, r) * smoothstep(1.15, 0.7, r) * 0.35;

    // Pulse — stronger in alert
    float pulseSpeed = isAlert ? 5.5 : 1.8;
    float pulseAmp   = isAlert ? 0.25 : 0.10;
    float pulse = 1.0 + pulseAmp * sin(uTime * pulseSpeed) * (0.4 + uEnergy);

    vec3 col = mist * (0.55 + 0.9 * density);
    col += vec3(1.0) * core;
    col += light * bk * 0.9;
    col += rimCol * rim;
    col *= pulse * uIntensity;

    float a = clamp(density * 0.75 + core * 0.95 + bk * 0.6 + rim * 0.5, 0.0, 1.0);
    a *= sphere;

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

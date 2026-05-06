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

  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p);
    float angle = atan(p.y, p.x);
    float t = uTime;

    float plasma = 0.0;
    plasma += sin(p.x * 6.0 + t * 1.1);
    plasma += sin(p.y * 6.0 + t * 0.9);
    plasma += sin((p.x + p.y) * 4.5 + t * 1.3);
    plasma += sin(sqrt(p.x*p.x + p.y*p.y) * 8.0 - t * 2.2);
    plasma = (plasma + 4.0) / 8.0;

    float f = fbm(p * 2.8 + vec2(t * 0.15, t * 0.12));
    plasma = mix(plasma, f, 0.38);

    float filament = sin(angle * 7.0 + t * 1.8 + fbm(p*3.0+t*0.1)*4.0) * 0.5 + 0.5;
    filament = pow(filament, 2.5);

    // Listening micro-tremble
    float tremble = (uMood < -0.5) ? 0.0 : 0.0;
    if (abs(uMood - 4.0) < 0.5) {
      tremble = sin(t*38.0)*0.012;
    }

    float edge = smoothstep(0.48 + tremble, 0.28, r);
    float core = exp(-r * 8.0) * 1.4;
    float mid  = exp(-r * 3.2) * (0.55 + 0.45 * plasma);

    float pulse = 0.65 + 0.35 * sin(t * 2.8) * uEnergy;
    float breathe = 0.88 + 0.12 * sin(t * 0.7);

    float saturation = 0.82 + 0.18 * plasma;
    float brightness = (core + mid * 0.7 + filament * 0.3 * edge) * pulse * breathe * uIntensity;
    vec3 col = hsv2rgb(vec3(uHue, saturation, brightness));

    float halo = exp(-r * 2.2) * 0.35 * uEnergy;
    col += hsv2rgb(vec3(uHue + 0.04, 0.6, halo));

    float a = edge * (0.88 + 0.12 * plasma) * pulse;
    a = clamp(a, 0.0, 1.0);

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

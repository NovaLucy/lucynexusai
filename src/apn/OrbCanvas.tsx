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
    for (int i=0;i<6;i++) {
      v += a * noise(p);
      p = p*2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0; // -1..1
    float r = length(p);
    float t = uTime * 0.45;

    // tremble in alert mood
    float tremble = (abs(uMood - 4.0) < 0.5) ? sin(uTime*38.0)*0.012 : 0.0;

    // Spherical mask with soft fresnel-ish edge
    float sphere = smoothstep(0.96 + tremble, 0.78, r);
    float rim    = smoothstep(0.78, 0.99, r) * smoothstep(1.02, 0.92, r);

    // Domain-warped FBM for bubbly cell interior
    vec2 q = vec2(fbm(p*1.6 + vec2(t, -t*0.7)),
                  fbm(p*1.6 + vec2(-t*0.8, t*0.6)));
    vec2 s = vec2(fbm(p*2.2 + q*2.0 + t*0.3),
                  fbm(p*2.2 + q*2.0 - t*0.4));
    float n = fbm(p*2.4 + s*2.4);

    // Cell blobs: threshold + smooth pockets
    float blob = smoothstep(0.35, 0.78, n);
    float hot  = pow(smoothstep(0.55, 0.92, n + 0.08*sin(t*1.7 + p.x*3.0)), 1.6);

    // Pseudo-3d shading: fake normal from gradient of n
    float e = 0.01;
    float nx = fbm((p+vec2(e,0))*2.4 + s*2.4) - n;
    float ny = fbm((p+vec2(0,e))*2.4 + s*2.4) - n;
    vec3 nrm = normalize(vec3(-nx, -ny, 0.6));
    vec3 L = normalize(vec3(-0.4, 0.6, 0.7));
    float lambert = clamp(dot(nrm, L), 0.0, 1.0);
    float spec = pow(clamp(dot(reflect(-L, nrm), vec3(0,0,1)), 0.0, 1.0), 24.0);

    float pulse = 0.85 + 0.15 * sin(uTime * 2.4) * uEnergy;

    // Color palette — hot interior (red/orange/magenta) with cool cyan/teal pockets
    vec3 deep   = hsv2rgb(vec3(uHue + 0.55, 0.85, 0.5));     // cyan/teal
    vec3 mid    = hsv2rgb(vec3(uHue + 0.95, 0.95, 0.95));    // magenta/red
    vec3 fire   = hsv2rgb(vec3(uHue + 0.07, 0.95, 1.10));    // orange/yellow
    vec3 inside = mix(deep, mid, blob);
    inside = mix(inside, fire, hot);
    inside *= 0.45 + 0.85 * lambert;
    inside += vec3(spec) * 0.5 * blob;

    // Iridescent rim — angle-based hue sweep
    float ang = atan(p.y, p.x);
    vec3 iri = hsv2rgb(vec3(fract(ang/6.2831 + uHue + 0.1*sin(t)), 0.85, 1.0));
    vec3 rimCol = iri * rim * 1.6;

    // Outer halo / bloom
    float halo = exp(-pow(max(r-0.95,0.0)*4.0, 2.0)) * 0.6 * uEnergy;
    vec3 haloCol = iri * halo;

    // Inner sparkle (high-freq grain that reads as plasma dust)
    float sparkle = pow(noise(p*40.0 + t*3.0), 12.0) * 1.6;
    inside += vec3(sparkle) * blob;

    vec3 col = inside * sphere * pulse + rimCol + haloCol;
    col *= uIntensity;

    float a = clamp(sphere * (0.55 + 0.6*blob) + rim*0.9 + halo, 0.0, 1.0);

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

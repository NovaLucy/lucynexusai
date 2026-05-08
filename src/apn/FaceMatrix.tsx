import { useEffect, useRef } from "react";
import { MOOD_HSL, type AgentState, type Mood } from "@/apn/types";
import faceUrl from "@/assets/apn-face.jpg";

/**
 * Realistic APN face revealed through cascading Matrix-style characters.
 * The underlying face image modulates the brightness of falling glyphs,
 * making the face "emerge" from the code rain.
 */

const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎ0123456789ABCDEFアイウエオAPN";

interface Props {
  mood: Mood;
  state: AgentState;
  /** 0..1 — fade in/out */
  opacity?: number;
  /** speaking pulses the face */
  speaking?: boolean;
  /** "reveal" boosts visibility & emits a shockwave on mount */
  intensity?: "ambient" | "reveal";
  /** When changes, retriggers a shockwave from center */
  shockKey?: number | string;
}

export default function FaceMatrix({ mood, state, opacity = 1, speaking, intensity = "ambient", shockKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moodRef = useRef(mood);
  const stateRef = useRef(state);
  const opacityRef = useRef(opacity);
  const speakingRef = useRef(speaking);
  const intensityRef = useRef(intensity);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const maskRef = useRef<{ data: Uint8ClampedArray; w: number; h: number } | null>(null);
  const shockStartRef = useRef<number>(0);

  useEffect(() => { moodRef.current = mood; }, [mood]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { opacityRef.current = opacity; }, [opacity]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => { intensityRef.current = intensity; }, [intensity]);
  // Trigger a shockwave whenever shockKey changes (or on first reveal mount)
  useEffect(() => { shockStartRef.current = performance.now(); }, [shockKey, intensity]);

  // Load the face image once and cache its luminance mask.
  useEffect(() => {
    const img = new Image();
    img.src = faceUrl;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      // Sample the face into a small offscreen buffer for fast lookups.
      const W = 128;
      const H = Math.round((img.height / img.width) * W);
      const off = document.createElement("canvas");
      off.width = W; off.height = H;
      const ictx = off.getContext("2d");
      if (!ictx) return;
      ictx.drawImage(img, 0, 0, W, H);
      const { data } = ictx.getImageData(0, 0, W, H);
      // Pre-compute luminance into a single channel.
      const lum = new Uint8ClampedArray(W * H);
      for (let i = 0; i < W * H; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
        lum[i] = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
      }
      maskRef.current = { data: lum, w: W, h: H };
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = Math.floor(r.width); H = Math.floor(r.height);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const cellW = 10;
    const cellH = 14;

    // Per-column rain state
    let cols = 0;
    let drops: number[] = [];
    let speeds: number[] = [];
    const initCols = () => {
      cols = Math.max(1, Math.floor(W / cellW));
      drops = new Array(cols).fill(0).map(() => Math.random() * (H / cellH));
      speeds = new Array(cols).fill(0).map(() => 0.35 + Math.random() * 0.55);
    };
    initCols();
    const ro2 = new ResizeObserver(initCols);
    ro2.observe(canvas);

    let raf = 0;
    const start = performance.now();

    const draw = () => {
      const now = performance.now();
      const t = (now - start) / 1000;
      const md = moodRef.current;
      const st = stateRef.current;
      const sp = speakingRef.current || st === "speaking";
      const op = opacityRef.current;
      const moodHSL = MOOD_HSL[md];

      // Trail fade
      ctx.fillStyle = `rgba(0,0,0,${0.16})`;
      ctx.fillRect(0, 0, W, H);

      ctx.font = `${cellH - 2}px 'JetBrains Mono', monospace`;
      ctx.textBaseline = "top";

      const mask = maskRef.current;
      const rows = Math.ceil(H / cellH);

      // Compute placement of face image within the canvas (contain + cover-ish).
      // We map the face to fill ~80% of the smaller dimension, centered slightly above.
      let fx0 = 0, fy0 = 0, fW = W, fH = H, hasMask = false;
      if (mask) {
        const targetH = H * 0.92;
        const targetW = (mask.w / mask.h) * targetH;
        fW = targetW; fH = targetH;
        fx0 = (W - fW) / 2;
        fy0 = (H - fH) / 2 - H * 0.02;
        hasMask = true;
      }

      const isReveal = intensityRef.current === "reveal";
      const pulse = sp ? 1 + 0.04 * Math.sin(t * 8) : 1;
      const speedMul = (sp ? 1.4 : st === "thinking" ? 1.2 : st === "listening" ? 0.9 : 1) * (isReveal ? 1.15 : 1);
      const trail = isReveal ? 22 : 14;
      const gamma = isReveal ? 0.6 : 0.85;
      const lumGain = isReveal ? 1.6 : 1.15;
      const baseDim = isReveal ? 0.1 : 0.18;

      // Shockwave: radial pulse expanding from face center over ~900ms
      const shockAge = (now - shockStartRef.current) / 1000;
      const shockActive = shockAge < 0.9;
      const shockRadius = shockAge * Math.max(W, H) * 1.1;
      const shockWidth = Math.max(W, H) * 0.18;

      const cx = W / 2, cy = H / 2 - H * 0.02;

      for (let c = 0; c < cols; c++) {
        const x = c * cellW + cellW / 2;
        const headRow = drops[c];

        for (let k = 0; k < trail; k++) {
          const row = Math.floor(headRow - k);
          if (row < 0 || row * cellH > H) continue;
          const y = row * cellH;

          // Face-mask brightness lookup
          let m = baseDim;
          if (hasMask && mask) {
            const px = x - fx0;
            const py = y - fy0;
            if (px >= 0 && px < fW && py >= 0 && py < fH) {
              const mx = Math.min(mask.w - 1, Math.max(0, Math.floor((px / fW) * mask.w)));
              const my = Math.min(mask.h - 1, Math.max(0, Math.floor((py / fH) * mask.h)));
              const lum = mask.data[my * mask.w + mx] / 255;
              m = Math.pow(lum, gamma) * lumGain;
              m = Math.min(1, Math.max(0.04, m));
            }
          }

          // Shockwave boost
          let shockBoost = 0;
          if (shockActive) {
            const dx = x - cx, dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const d = Math.abs(dist - shockRadius);
            if (d < shockWidth) {
              const ramp = 1 - d / shockWidth;
              shockBoost = ramp * (1 - shockAge / 0.9) * 0.9;
            }
          }

          const isHead = k === 0;
          const ch = GLYPHS[(Math.floor((row + c * 7 + t * 6) % GLYPHS.length) + GLYPHS.length) % GLYPHS.length];

          const fall = 1 - k / trail;
          const bright = Math.min(1.4, m * (0.35 + 0.65 * fall) * pulse + shockBoost);

          const sat = isReveal ? Math.min(100, moodHSL.s + 10) : moodHSL.s;

          if (isHead) {
            const lig = Math.min(98, 70 + bright * 28);
            ctx.fillStyle = `hsla(${moodHSL.h}, ${sat}%, ${lig}%, ${op})`;
          } else {
            const lig = Math.max(8, Math.min(80, 18 + bright * 65));
            const a = Math.min(1, 0.25 + bright * 0.95) * op;
            ctx.fillStyle = `hsla(${moodHSL.h}, ${sat}%, ${lig}%, ${a})`;
          }
          ctx.fillText(ch, x - cellW / 2 + 1, y);
        }

        drops[c] += speeds[c] * speedMul;
        if (drops[c] * cellH > H + Math.random() * 200) {
          drops[c] = -Math.random() * 20;
          speeds[c] = 0.35 + Math.random() * 0.55;
        }
      }

      // Vignette — tighter when revealing
      const innerR = Math.min(W, H) * (isReveal ? 0.18 : 0.25);
      const outerR = Math.max(W, H) * (isReveal ? 0.5 : 0.6);
      const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(0,0,0,${(isReveal ? 0.7 : 0.55) * op})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); ro2.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ mixBlendMode: "screen" }}
      aria-hidden
    />
  );
}

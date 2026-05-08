import { useEffect, useRef } from "react";
import { ENERGY_TARGET, MOOD_HSL, type AgentState, type Mood } from "@/apn/types";

/**
 * Pure ASCII rotating sphere — terminal donut.c style.
 * Renders on a 2D canvas. Color = current mood.
 */

const GLYPHS = ".,-:;+*=#%@";

interface Props {
  state: AgentState;
  mood: Mood;
  intensity?: number;
  pixelRatioCap?: number;
}

export default function OrbCanvas({ state, mood, intensity = 1.0, pixelRatioCap = 2 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const moodRef = useRef(mood);
  const intensityRef = useRef(intensity);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { moodRef.current = mood; }, [mood]);
  useEffect(() => { intensityRef.current = intensity; }, [intensity]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, pixelRatioCap);

    let W = 0, H = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = Math.floor(rect.width);
      H = Math.floor(rect.height);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let energy = 0.3;
    let curHue = MOOD_HSL.calm.h;
    let curSat = MOOD_HSL.calm.s;
    let curLig = MOOD_HSL.calm.l;
    let raf = 0;
    const start = performance.now();

    const draw = () => {
      const now = performance.now();
      const t = (now - start) / 1000;
      const st = stateRef.current;
      const md = moodRef.current;
      const inten = intensityRef.current;

      // Lerp energy
      const targetE = ENERGY_TARGET[st];
      energy += (targetE - energy) * 0.05;

      // Lerp color
      const tgt = MOOD_HSL[md];
      let dh = tgt.h - curHue;
      if (dh > 180) dh -= 360;
      if (dh < -180) dh += 360;
      curHue = (curHue + dh * 0.06 + 360) % 360;
      curSat += (tgt.s - curSat) * 0.06;
      curLig += (tgt.l - curLig) * 0.06;

      // Cell size — scales with width
      const cellW = Math.max(7, Math.min(11, W / 60));
      const cellH = cellW * 1.15;
      ctx.font = `${Math.floor(cellW * 1.5)}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const cols = Math.floor(W / cellW);
      const rows = Math.floor(H / cellH);

      // Clear
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      const cx = cols / 2;
      const cy = rows / 2;
      // Sphere radius in cells
      const baseR = Math.min(cols, rows) * 0.42;
      const breath = 1 + 0.04 * Math.sin(t * (st === "speaking" ? 3.2 : 1.6)) * (0.5 + energy);
      const R = baseR * breath;

      // Rotation speed by state
      const rotSpeed = st === "thinking" ? 1.6 : st === "speaking" ? 1.2 : st === "listening" ? 0.7 : 0.45;
      const A = t * rotSpeed;          // yaw
      const B = t * rotSpeed * 0.55;   // pitch

      // Light direction
      const Lx = Math.cos(t * 0.3) * 0.6;
      const Ly = -0.6;
      const Lz = -0.7;
      const Llen = Math.hypot(Lx, Ly, Lz);
      const lx = Lx / Llen, ly = Ly / Llen, lz = Lz / Llen;

      // Glitch (thinking) — random row offsets
      const doGlitch = st === "thinking" && Math.sin(t * 6.3) > 0.85;

      // Vortex spiral for "focused" mood
      const vortex = md === "focused";
      // Alert flicker
      const isAlert = md === "alert";
      const alertOn = !isAlert || Math.sin(t * 13.0) > -0.85;

      // For each "screen" cell decide a glyph from sphere surface
      // We sample the sphere parametrically (theta, phi) projecting forward.
      // Simpler: for each pixel cell, compute (x,y) -> if inside circle, derive z from sphere, rotate the surface point and pick brightness.
      const scale = R; // cells -> sphere radius units = 1
      const colorBase = `${curHue.toFixed(0)} ${curSat.toFixed(0)}% `;
      const dimColor = `hsl(${curHue.toFixed(0)} ${curSat.toFixed(0)}% ${(curLig * 0.35).toFixed(0)}%)`;
      void dimColor;

      // Pre-compute sin/cos
      const cA = Math.cos(A), sA = Math.sin(A);
      const cB = Math.cos(B), sB = Math.sin(B);

      for (let j = 0; j < rows; j++) {
        const rowOff = doGlitch && Math.random() > 0.92 ? (Math.random() - 0.5) * 6 : 0;
        for (let i = 0; i < cols; i++) {
          // Cell center in cell space (anisotropic — adjust for cellH/cellW)
          const dx = (i - cx);
          const dy = (j - cy) * (cellH / cellW);
          const r2 = dx * dx + dy * dy;
          if (r2 > scale * scale) continue;
          const z = Math.sqrt(scale * scale - r2);

          // Surface point on unit sphere
          let nx = dx / scale;
          let ny = dy / scale;
          let nz = z / scale;

          // Rotate around Y then X
          const x1 = nx * cA + nz * sA;
          const z1 = -nx * sA + nz * cA;
          const y1 = ny * cB + z1 * sB;
          const z2 = -ny * sB + z1 * cB;

          // Lambert lighting against rotated normal
          let lambert = nx * lx + ny * ly + nz * lz;
          lambert = Math.max(0, lambert);

          // Surface "texture" via a procedural pattern on rotated coords
          let theta = Math.atan2(x1, z2);
          const phi = Math.asin(Math.max(-1, Math.min(1, y1)));
          if (vortex) {
            theta += phi * 3.0 + t * 0.6;
          }
          const pat =
            0.5 +
            0.5 *
              Math.sin(theta * 8 + t * 0.7) *
              Math.cos(phi * 6 - t * 0.5);
          let bright = lambert * 0.7 + pat * 0.35 + energy * 0.15;
          bright = Math.max(0, Math.min(1, bright));

          // Outgoing wave for "speaking"
          if (st === "speaking") {
            const surfR = Math.sqrt(r2) / scale;
            const wave = Math.sin(surfR * 18 - t * 6.0);
            bright = Math.max(0, Math.min(1, bright + wave * 0.18));
          }

          // Map to glyph
          const gi = Math.min(GLYPHS.length - 1, Math.floor(bright * GLYPHS.length));
          if (gi < 1) continue; // skip near-black
          const ch = GLYPHS[gi];

          // Color: mood hue, lightness scaled by brightness, with iridescence near limb
          const limb = 1 - Math.abs(nz); // edge highlight
          const lig = (curLig * (0.45 + 0.55 * bright) + limb * 12) * inten;
          const finalLig = Math.max(8, Math.min(95, lig));
          const alpha = isAlert && !alertOn ? 0.35 : 1;
          ctx.fillStyle = `hsl(${colorBase}${finalLig.toFixed(0)}% / ${alpha})`;

          const px = i * cellW + cellW / 2;
          const py = j * cellH + cellH / 2 + rowOff;
          ctx.fillText(ch, px, py);
        }
      }

      // CRT scanline drift — drawn as faint horizontal bar
      const scanY = ((t * 60) % H);
      ctx.fillStyle = `hsl(${curHue.toFixed(0)} ${curSat.toFixed(0)}% 60% / 0.06)`;
      ctx.fillRect(0, scanY, W, 2);

      // Listening: small VU bars around base
      if (st === "listening") {
        const bars = 24;
        const barR = baseR * cellW * 1.12;
        for (let k = 0; k < bars; k++) {
          const ang = (k / bars) * Math.PI * 2 + t * 0.4;
          const amp = 4 + 10 * Math.abs(Math.sin(t * 4 + k * 0.7));
          const x1 = W / 2 + Math.cos(ang) * barR;
          const y1 = H / 2 + Math.sin(ang) * barR;
          const x2 = W / 2 + Math.cos(ang) * (barR + amp);
          const y2 = H / 2 + Math.sin(ang) * (barR + amp);
          ctx.strokeStyle = `hsl(${curHue.toFixed(0)} ${curSat.toFixed(0)}% 60% / 0.7)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [pixelRatioCap]);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full" aria-hidden />;
}

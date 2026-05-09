import { useEffect, useRef } from "react";
import { MOOD_HSL, type AgentState, type Mood } from "@/apn/types";

/**
 * Bio-organic neural network background — pulsing nodes connected by glowing
 * edges, drifting slowly. Reacts to APN's state (faster + brighter when
 * speaking/thinking) and mood (color hue).
 */

interface Props {
  mood: Mood;
  state: AgentState;
}

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
}

const NODE_COUNT = 140; // pool; visibility scales with state
const MAX_DIST = 180;

export default function NeuralNetwork({ mood, state }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const moodRef = useRef(mood);
  const stateRef = useRef(state);

  useEffect(() => { moodRef.current = mood; }, [mood]);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const canvas = ref.current;
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

    const nodes: Node[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      phase: Math.random() * Math.PI * 2,
      size: 1 + Math.random() * 1.8,
    }));

    let raf = 0;
    const start = performance.now();

    const draw = () => {
      const now = performance.now();
      const t = (now - start) / 1000;
      const md = moodRef.current;
      const st = stateRef.current;
      const moodHSL = MOOD_HSL[md];

      const speedMul = st === "speaking" ? 2.4 : st === "thinking" ? 1.8 : st === "listening" ? 1.2 : 0.9;
      const brightMul = st === "speaking" ? 1.5 : st === "thinking" ? 1.25 : st === "listening" ? 1.05 : 0.85;
      // Adaptive active node count — reveal more synapses when engaged
      const activeCount = st === "speaking" ? NODE_COUNT
        : st === "thinking" ? Math.floor(NODE_COUNT * 0.85)
        : st === "listening" ? Math.floor(NODE_COUNT * 0.65)
        : Math.floor(NODE_COUNT * 0.5);

      // Soft trail fade for after-glow
      ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
      ctx.fillRect(0, 0, W, H);

      // Update nodes
      for (let i = 0; i < activeCount; i++) {
        const n = nodes[i];
        n.x += n.vx * speedMul;
        n.y += n.vy * speedMul;
        n.phase += 0.012 * speedMul;
        if (n.x < -20) n.x = W + 20;
        if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20;
        if (n.y > H + 20) n.y = -20;
      }

      // Draw edges
      ctx.lineWidth = 0.8;
      for (let i = 0; i < activeCount; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < activeCount; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > MAX_DIST) continue;
          const closeness = 1 - d / MAX_DIST;
          const pulse = 0.5 + 0.5 * Math.sin(t * 0.8 + (a.phase + b.phase) * 0.5);
          const alpha = closeness * 0.32 * pulse * brightMul;
          // Mix mood + complementary on long edges → cinematic depth
          const useComp = ((a.phase + b.phase) % 1) > 0.65;
          const hue = useComp ? (moodHSL.h + 35) % 360 : moodHSL.h;
          ctx.strokeStyle = `hsla(${hue}, ${moodHSL.s}%, ${Math.min(75, moodHSL.l + 25)}%, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Draw nodes
      for (let i = 0; i < activeCount; i++) {
        const n = nodes[i];
        const pulse = 0.6 + 0.4 * Math.sin(t * 1.2 + n.phase);
        const r = n.size * (1 + pulse * 0.4);
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 6);
        grad.addColorStop(0, `hsla(${moodHSL.h}, ${moodHSL.s}%, 75%, ${0.85 * brightMul})`);
        grad.addColorStop(0.4, `hsla(${moodHSL.h}, ${moodHSL.s}%, 55%, ${0.25 * brightMul})`);
        grad.addColorStop(1, `hsla(${moodHSL.h}, ${moodHSL.s}%, 40%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 6, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.55 }}
      aria-hidden
    />
  );
}

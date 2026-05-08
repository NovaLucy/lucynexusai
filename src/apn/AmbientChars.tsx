import { useEffect, useRef } from "react";

const CHARS = ". . . . ' ' * + ` , : ;".split(" ");

export default function AmbientChars() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    let W = 0, H = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = Math.floor(rect.width);
      H = Math.floor(rect.height);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };
    type P = { x: number; y: number; vx: number; vy: number; ch: string; o: number };
    let parts: P[] = [];
    const seed = () => {
      const n = Math.floor((W * H) / 6500);
      parts = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        ch: CHARS[Math.floor(Math.random() * CHARS.length)],
        o: 0.04 + Math.random() * 0.06,
      }));
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
        ctx.fillStyle = `hsl(0 0% 70% / ${p.o})`;
        ctx.fillText(p.ch, p.x, p.y);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden />;
}

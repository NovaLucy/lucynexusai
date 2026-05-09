import { useEffect, useRef } from "react";

const CHARS = ". . . . ' ' * + ` , : ;".split(" ");
const FACES = ["( ◉◡◉ )", "( ^_^ )", "( -_- )", "( ◐.◑ )"];

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
    type P = { x: number; y: number; vx: number; vy: number; ch: string; o: number; isFace: boolean };
    let parts: P[] = [];
    const seed = () => {
      const isMobile = W < 768;
      const density = isMobile ? 18000 : 11000;
      const n = Math.floor((W * H) / density);
      parts = Array.from({ length: n }, () => {
        const isFace = Math.random() < 0.025;
        return {
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.06,
          vy: (Math.random() - 0.5) * 0.06,
          ch: isFace ? FACES[Math.floor(Math.random() * FACES.length)] : CHARS[Math.floor(Math.random() * CHARS.length)],
          o: isFace ? 0.05 + Math.random() * 0.04 : 0.022 + Math.random() * 0.03,
          isFace,
        };
      });
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
        if (p.isFace) {
          ctx.font = "13px 'JetBrains Mono', monospace";
          ctx.fillStyle = `hsl(var(--mood-h) var(--mood-s) var(--mood-l) / ${p.o})`;
        } else {
          ctx.font = "11px 'JetBrains Mono', monospace";
          ctx.fillStyle = `hsl(0 0% 70% / ${p.o})`;
        }
        ctx.fillText(p.ch, p.x, p.y);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden />;
}

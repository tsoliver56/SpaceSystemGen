import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  tw: number;
  ph: number;
  depth: 1 | 2;
  hue: 0 | 1 | 2;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

/** Full-viewport canvas: parallax star layers with twinkle + sporadic meteors. */
export default function Starfield({ tint }: { tint?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;

    const stars: Star[] = Array.from({ length: 260 }, () => {
      const roll = Math.random();
      return {
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.25 + 0.3,
        a: Math.random() * 0.55 + 0.2,
        tw: Math.random() * 1.6 + 0.4,
        ph: Math.random() * Math.PI * 2,
        depth: Math.random() < 0.35 ? 2 : 1,
        hue: roll < 0.14 ? 2 : roll < 0.5 ? 1 : 0,
      };
    });

    let meteor: Meteor | null = null;
    let nextMeteor = 4;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const palette = ["#dfe9ff", "#cfe2ff", tint ?? "#ffd9a0"];

    let last = performance.now();
    const frame = (now: number) => {
      const t = now / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const drift = (t * (s.depth === 2 ? 1.4 : 0.5)) % w;
        const x = (s.x * w + drift) % w;
        const alpha = s.a * (0.55 + 0.45 * Math.sin(t * s.tw + s.ph));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = palette[s.hue];
        ctx.beginPath();
        ctx.arc(x, s.y * h, s.r * (s.depth === 2 ? 0.85 : 1), 0, 7);
        ctx.fill();
      }

      nextMeteor -= dt;
      if (!meteor && nextMeteor <= 0) {
        meteor = {
          x: Math.random() * w * 0.7 + w * 0.15,
          y: -20,
          vx: (Math.random() * 90 + 60) * (Math.random() < 0.5 ? -1 : 1),
          vy: Math.random() * 130 + 160,
          life: 0,
          max: Math.random() * 1.2 + 1,
        };
        nextMeteor = Math.random() * 9 + 5;
      }
      if (meteor) {
        meteor.life += dt;
        meteor.x += meteor.vx * dt;
        meteor.y += meteor.vy * dt;
        const k = 1 - meteor.life / meteor.max;
        if (k <= 0 || meteor.y > h + 60) {
          meteor = null;
        } else {
          const tx = meteor.x - meteor.vx * 0.18;
          const ty = meteor.y - meteor.vy * 0.18;
          const grad = ctx.createLinearGradient(meteor.x, meteor.y, tx, ty);
          grad.addColorStop(0, `rgba(205,228,255,${0.85 * k})`);
          grad.addColorStop(1, "rgba(205,228,255,0)");
          ctx.globalAlpha = 1;
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(meteor.x, meteor.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [tint]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="fixed inset-0 z-0 h-full w-full"
    />
  );
}

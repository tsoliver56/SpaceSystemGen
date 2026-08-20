import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BASE_DAYS_PER_SEC,
  BODIES,
  fmtSim,
  orbitRadius,
  PLANETS,
  SUN,
  type CelestialBody,
} from "./data/bodies";
import Starfield from "./components/Starfield";
import InfoPanel from "./components/InfoPanel";
import Deck from "./components/Deck";

interface Geom {
  cx: number;
  cy: number;
  w: number;
  h: number;
  radii: number[];
  sunR: number;
  ready: boolean;
}

const INITIAL_GEOM: Geom = {
  cx: 0,
  cy: 0,
  w: 0,
  h: 0,
  radii: [],
  sunR: 34,
  ready: false,
};

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const beltCanvasRef = useRef<HTMLCanvasElement>(null);
  const planetEls = useRef<Record<string, HTMLButtonElement | null>>({});
  const trailPts = useRef<Record<string, { x: number; y: number }[]>>({});
  const simDaysRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(2);
  const zoomRef = useRef(1);
  const geomRef = useRef<Geom>(INITIAL_GEOM);

  const [geom, setGeom] = useState<Geom>(INITIAL_GEOM);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(2);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<CelestialBody | null>(null);
  const [touched, setTouched] = useState(false);
  const [clock, setClock] = useState("T+0y 000d");

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const recompute = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const maxR = Math.max(110, Math.min(w, h) / 2 - 22) * zoomRef.current;
    const sunR = Math.min(44, Math.max(24, maxR * 0.125));
    const next: Geom = {
      cx: w / 2,
      cy: h / 2,
      w,
      h,
      sunR,
      ready: true,
      radii: PLANETS.map((p) => orbitRadius(p.distanceAU, sunR, maxR)),
    };
    geomRef.current = next;
    trailPts.current = {};
    setGeom(next);
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
    recompute();
  }, [zoom, recompute]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recompute]);

  const asteroids = useMemo(
    () =>
      Array.from({ length: 360 }, () => ({
        t: Math.random(),
        a0: Math.random() * Math.PI * 2,
        w: (2 * Math.PI) / (1400 + Math.random() * 1300),
        s: 0.4 + Math.random() * 1.05,
        al: 0.12 + Math.random() * 0.4,
      })),
    []
  );

  /* ---------------- main simulation loop ---------------- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let clockAcc = 1;

    const sizeCanvas = (c: HTMLCanvasElement) => {
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.max(1, c.clientWidth * dpr);
      c.height = Math.max(1, c.clientHeight * dpr);
      const ctx = c.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    };

    // canvases mount once geometry is ready — acquire contexts lazily
    let tCtx: CanvasRenderingContext2D | null = null;
    let bCtx: CanvasRenderingContext2D | null = null;

    const onResize = () => {
      if (trailCanvasRef.current) tCtx = sizeCanvas(trailCanvasRef.current);
      if (beltCanvasRef.current) bCtx = sizeCanvas(beltCanvasRef.current);
    };
    window.addEventListener("resize", onResize);

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playingRef.current) {
        simDaysRef.current += dt * BASE_DAYS_PER_SEC * speedRef.current;
      }
      const g = geomRef.current;
      const sim = simDaysRef.current;

      if (!tCtx && trailCanvasRef.current) tCtx = sizeCanvas(trailCanvasRef.current);
      if (!bCtx && beltCanvasRef.current) bCtx = sizeCanvas(beltCanvasRef.current);

      if (g.ready && g.radii.length === PLANETS.length) {
        // asteroid belt (between Mars and Jupiter)
        const belt = bCtx;
        if (belt) {
          belt.clearRect(0, 0, g.w, g.h);
          const inner = g.radii[3] + 12;
          const outer = g.radii[4] - 12;
          if (outer > inner) {
            belt.fillStyle = "#a99c86";
            for (const a of asteroids) {
              const r = inner + a.t * (outer - inner);
              const ang = a.a0 + sim * a.w;
              belt.globalAlpha = a.al;
              belt.fillRect(g.cx + Math.cos(ang) * r, g.cy + Math.sin(ang) * r, a.s, a.s);
            }
            belt.globalAlpha = 1;
          }
        }

        // planet positions + motion trails
        const trail = tCtx;
        if (trail) {
          trail.clearRect(0, 0, g.w, g.h);
          trail.lineWidth = 1.4;
          trail.lineCap = "round";
          PLANETS.forEach((p, i) => {
            const el = planetEls.current[p.id];
            if (!el) return;
            const ang =
              (p.startAngle * Math.PI) / 180 - (2 * Math.PI * sim) / p.periodDays;
            const x = g.cx + g.radii[i] * Math.cos(ang);
            const y = g.cy + g.radii[i] * Math.sin(ang);
            el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;

            if (playingRef.current) {
              const pts = (trailPts.current[p.id] ||= []);
              pts.push({ x, y });
              if (pts.length > 60) pts.shift();
            }
            const pts = trailPts.current[p.id];
            if (pts && pts.length > 1) {
              trail.strokeStyle = p.color;
              for (let k = 1; k < pts.length; k++) {
                trail.globalAlpha = Math.pow(k / pts.length, 1.6) * 0.5;
                trail.beginPath();
                trail.moveTo(pts[k - 1].x, pts[k - 1].y);
                trail.lineTo(pts[k].x, pts[k].y);
                trail.stroke();
              }
            }
          });
          trail.globalAlpha = 1;
        }
      }

      clockAcc += dt;
      if (clockAcc > 0.2) {
        clockAcc = 0;
        setClock(fmtSim(sim));
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [asteroids]);

  /* ---------------- interaction ---------------- */

  const select = useCallback((b: CelestialBody) => {
    setSelected(b);
    setTouched(true);
  }, []);

  const handleReset = useCallback(() => {
    simDaysRef.current = 0;
    trailPts.current = {};
    setClock(fmtSim(0));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        setSelected((cur) => {
          const ids = BODIES.map((b) => b.id);
          const idx = cur ? ids.indexOf(cur.id) : -1;
          const nextId = ids[(idx + dir + ids.length * 2) % ids.length];
          setTouched(true);
          return BODIES.find((b) => b.id === nextId) ?? null;
        });
      } else if (e.key === "Escape") {
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ticks = useMemo(() => Array.from({ length: 72 }, (_, i) => i * 5), []);
  const outerR = geom.ready ? geom.radii[geom.radii.length - 1] + 16 : 0;

  /* ---------------- render ---------------- */

  return (
    <div className="relative h-dvh w-full select-none overflow-hidden bg-void font-body text-slate-100">
      <Starfield />

      {/* nebula wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(1100px 700px at 12% -8%, rgba(28,78,110,0.34), transparent 62%), radial-gradient(900px 650px at 108% 112%, rgba(126,54,26,0.22), transparent 60%), radial-gradient(1500px 1000px at 50% 46%, rgba(16,26,58,0.5), transparent 78%)",
        }}
      />
      {/* vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(2,4,10,0.55) 100%)",
        }}
      />

      {/* ================= STAGE ================= */}
      <div
        ref={stageRef}
        className="absolute inset-0"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
      >
        {geom.ready && (
          <>
            <canvas
              ref={beltCanvasRef}
              className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
            />

            {/* orbit rings + HUD */}
            <svg
              className="pointer-events-none absolute inset-0 z-[3]"
              width={geom.w}
              height={geom.h}
              aria-hidden="true"
            >
              <line
                x1={0}
                y1={geom.cy}
                x2={geom.w}
                y2={geom.cy}
                stroke="rgba(140,170,255,0.05)"
                strokeDasharray="2 7"
              />
              <line
                x1={geom.cx}
                y1={0}
                x2={geom.cx}
                y2={geom.h}
                stroke="rgba(140,170,255,0.05)"
                strokeDasharray="2 7"
              />
              <circle
                cx={geom.cx}
                cy={geom.cy}
                r={outerR}
                fill="none"
                stroke="rgba(150,178,235,0.12)"
                strokeDasharray="1 9"
              />
              {ticks.map((d) => {
                const a = (d * Math.PI) / 180;
                const r1 = outerR;
                const r2 = outerR + (d % 30 === 0 ? 11 : 5);
                return (
                  <line
                    key={d}
                    x1={geom.cx + Math.cos(a) * r1}
                    y1={geom.cy + Math.sin(a) * r1}
                    x2={geom.cx + Math.cos(a) * r2}
                    y2={geom.cy + Math.sin(a) * r2}
                    stroke="rgba(150,178,235,0.14)"
                  />
                );
              })}
              <g
                style={{
                  transformOrigin: `${geom.cx}px ${geom.cy}px`,
                  animation: "spin 80s linear infinite",
                }}
              >
                <line
                  x1={geom.cx}
                  y1={geom.cy}
                  x2={geom.cx + outerR}
                  y2={geom.cy}
                  stroke="rgba(120,190,255,0.09)"
                />
              </g>

              {PLANETS.map((p, i) => {
                const active = selected?.id === p.id;
                return (
                  <g key={p.id}>
                    <circle
                      cx={geom.cx}
                      cy={geom.cy}
                      r={geom.radii[i]}
                      fill="none"
                      stroke={active ? p.color : "rgba(150,178,235,0.16)"}
                      strokeOpacity={active ? 0.85 : 1}
                      strokeWidth={active ? 1.4 : 1}
                      style={{ transition: "stroke .4s, stroke-width .4s" }}
                    />
                    <circle
                      cx={geom.cx}
                      cy={geom.cy}
                      r={geom.radii[i]}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={16}
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}
                      onClick={() => select(p)}
                    />
                  </g>
                );
              })}
            </svg>

            <canvas
              ref={trailCanvasRef}
              className="pointer-events-none absolute inset-0 z-[4] h-full w-full"
            />

            {/* ---------- SUN ---------- */}
            <button
              onClick={() => select(SUN)}
              aria-label="Sun — view details"
              className="group absolute z-10 rounded-full outline-none"
              style={{
                left: geom.cx,
                top: geom.cy,
                width: geom.sunR * 2.4,
                height: geom.sunR * 2.4,
                transform: "translate(-50%,-50%)",
              }}
            >
              <span
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: geom.sunR * 3.6,
                  height: geom.sunR * 3.6,
                  transform: "translate(-50%,-50%)",
                  background:
                    "repeating-conic-gradient(from 0deg, rgba(255,190,90,0.10) 0deg 4deg, transparent 4deg 12deg)",
                  animation: "spin 44s linear infinite",
                }}
              />
              <span
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: geom.sunR * 4.8,
                  height: geom.sunR * 4.8,
                  background:
                    "radial-gradient(circle, rgba(255,170,60,0.30), rgba(255,140,40,0.10) 45%, transparent 70%)",
                  filter: "blur(6px)",
                  animation: "breathe 6s ease-in-out infinite",
                }}
              />
              <span
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: geom.sunR * 2.7,
                  height: geom.sunR * 2.7,
                  background:
                    "radial-gradient(circle, rgba(255,200,100,0.45), transparent 68%)",
                  animation: "breathe 3.8s ease-in-out infinite reverse",
                }}
              />
              <span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-300 group-hover:scale-105"
                style={{
                  width: geom.sunR * 2,
                  height: geom.sunR * 2,
                  background:
                    "radial-gradient(circle at 38% 35%, #fff8dc, #ffd978 45%, #ff9d3a 80%, #f97316 100%)",
                  boxShadow:
                    "0 0 40px 8px rgba(255,180,70,0.5), 0 0 120px 40px rgba(255,150,50,0.22)",
                }}
              />
              {selected?.id === "sun" && (
                <span
                  className="absolute left-1/2 top-1/2 rounded-full border border-dashed"
                  style={{
                    width: geom.sunR * 2.9,
                    height: geom.sunR * 2.9,
                    borderColor: SUN.color,
                    animation: "spinCenter 9s linear infinite",
                  }}
                />
              )}
              <span className="pointer-events-none absolute left-1/2 top-1/2 whitespace-nowrap opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ transform: `translate(${geom.sunR * 1.5 + 10}px, -50%)` }}
              >
                <span className="font-display text-[11px] font-bold tracking-[0.2em] text-solar">SOL</span>
                <span className="ml-2 text-[9px] tracking-widest text-white/50">G2V · 1.39M KM</span>
              </span>
            </button>

            {/* ---------- PLANETS ---------- */}
            {PLANETS.map((p) => {
              const hit = Math.max(36, p.sizePx + 18);
              const active = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  ref={(el) => {
                    planetEls.current[p.id] = el;
                  }}
                  onClick={() => select(p)}
                  aria-label={`${p.name} — view details`}
                  className={`group absolute left-0 top-0 z-20 rounded-full outline-none transition-opacity duration-500 ${
                    selected && !active ? "opacity-45" : "opacity-100"
                  }`}
                  style={{ width: hit, height: hit, willChange: "transform" }}
                >
                  {active && (
                    <>
                      <span
                        className="absolute inset-0 rounded-full border border-dashed"
                        style={{ borderColor: p.color, animation: "spin 8s linear infinite" }}
                      />
                      <span
                        className="absolute inset-0 rounded-full border"
                        style={{ borderColor: p.glow, animation: "pulseRing 2.2s ease-out infinite" }}
                      />
                    </>
                  )}
                  <span
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-[1.3]"
                    style={{
                      width: p.sizePx,
                      height: p.sizePx,
                      background: `radial-gradient(circle at 32% 30%, ${p.colorSoft} 0%, ${p.color} 48%, ${p.colorDark} 100%)`,
                      boxShadow: `0 0 ${Math.round(p.sizePx * 0.9)}px ${p.glow}`,
                    }}
                  >
                    {p.bands && (
                      <span
                        className="absolute inset-0 opacity-50"
                        style={{
                          background:
                            "repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0 2px, rgba(255,255,255,0.10) 2px 3px, transparent 3px 6px)",
                          animation: "bandflow 12s linear infinite",
                        }}
                      />
                    )}
                  </span>
                  {p.rings && (
                    <>
                      <span
                        className="pointer-events-none absolute left-1/2 top-1/2 rounded-[50%]"
                        style={{
                          width: p.sizePx * 2.3,
                          height: p.sizePx * 2.3,
                          border: "2px solid rgba(235,205,140,0.75)",
                          transform: "translate(-50%,-50%) rotate(-16deg) scaleY(0.32)",
                        }}
                      />
                      <span
                        className="pointer-events-none absolute left-1/2 top-1/2 rounded-[50%]"
                        style={{
                          width: p.sizePx * 1.8,
                          height: p.sizePx * 1.8,
                          border: "1px solid rgba(235,205,140,0.45)",
                          transform: "translate(-50%,-50%) rotate(-16deg) scaleY(0.32)",
                        }}
                      />
                    </>
                  )}
                  <span
                    className="pointer-events-none absolute left-1/2 top-1/2 whitespace-nowrap opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ transform: `translate(${hit / 2 + 8}px, -50%)` }}
                  >
                    <span
                      className="font-display text-[11px] font-bold tracking-[0.2em]"
                      style={{ color: p.colorSoft }}
                    >
                      {p.name.toUpperCase()}
                    </span>
                    <span className="ml-2 text-[9px] tracking-widest text-white/50">
                      {p.distanceAU} AU
                    </span>
                  </span>
                </button>
              );
            })}

            {/* HUD corner brackets */}
            <div className="pointer-events-none absolute inset-3 z-[5] hidden md:block" aria-hidden="true">
              <span className="absolute left-0 top-0 h-6 w-6 border-l border-t border-white/15" />
              <span className="absolute right-0 top-0 h-6 w-6 border-r border-t border-white/15" />
              <span className="absolute bottom-0 left-0 h-6 w-6 border-b border-l border-white/15" />
              <span className="absolute bottom-0 right-0 h-6 w-6 border-b border-r border-white/15" />
            </div>

            {/* first-run hint */}
            {!touched && (
              <div
                className="pointer-events-none absolute bottom-24 left-1/2 z-[6] flex items-center gap-2.5"
                style={{ animation: "hintbob 2.6s ease-in-out infinite" }}
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-terra" style={{ animation: "pulseRing 1.8s ease-out infinite" }} />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-terra" />
                </span>
                <span className="text-[10px] tracking-[0.35em] text-white/60">
                  CLICK ANY PLANET TO SCAN IT
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ================= HEADER ================= */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-4 px-5 pt-4 md:px-7 md:pt-5">
        <div>
          <p className="flex items-center gap-2 text-[9px] tracking-[0.35em] text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ animation: "blink 1.6s ease-in-out infinite" }} />
            LIVE ORBITAL MECHANICS · INTERACTIVE DEMO
          </p>
          <h1 className="font-display mt-1.5 text-[24px] font-black leading-none tracking-[0.06em] text-white md:text-[34px]">
            SOLAR <span className="text-solar">SYSTEM</span>
          </h1>
          <p className="mt-1.5 text-[10px] tracking-[0.18em] text-white/35">
            ONE STAR · EIGHT WORLDS · PERIODS IN TRUE RATIO
          </p>
        </div>

        <div className="hidden border-r-2 border-solar/60 pr-4 text-right sm:block">
          <p className="text-[8px] tracking-[0.3em] text-white/35">MISSION CLOCK</p>
          <p className="text-[17px] font-bold tabular-nums leading-tight text-solar">{clock}</p>
          <p className="mt-1 text-[9px] tabular-nums tracking-[0.15em] text-white/45">
            RATE {speed}× · {playing ? "RUNNING" : "HOLD"}
          </p>
          <p className="text-[9px] tracking-[0.15em] text-white/45">
            TARGET · <span className="text-white/85">{selected ? selected.name.toUpperCase() : "—"}</span>
          </p>
        </div>
      </header>

      <Deck
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        onReset={handleReset}
        speed={speed}
        onSpeed={setSpeed}
        zoom={zoom}
        onZoom={setZoom}
        selected={selected}
        onSelect={select}
        clock={clock}
      />

      {selected && (
        <InfoPanel body={selected} onClose={() => setSelected(null)} simDaysRef={simDaysRef} />
      )}

      {/* film grain */}
      <div className="grain pointer-events-none fixed inset-0 z-[70] opacity-[0.05] mix-blend-overlay" aria-hidden="true" />
    </div>
  );
}

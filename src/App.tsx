import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fmtSim,
  generateSystem,
  hexToRgba,
  orbitRadius,
  type Body,
} from "./lib/generator";
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
  sunVis: number;
  ready: boolean;
}

const INITIAL_GEOM: Geom = {
  cx: 0,
  cy: 0,
  w: 0,
  h: 0,
  radii: [],
  sunR: 34,
  sunVis: 34,
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

  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 0xffffff));
  const system = useMemo(() => generateSystem(seed), [seed]);

  const [geom, setGeom] = useState<Geom>(INITIAL_GEOM);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(2);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<Body | null>(null);
  const [touched, setTouched] = useState(false);
  const [warping, setWarping] = useState(false);
  const [clock, setClock] = useState("T+0y 000d");

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const starScale = useMemo(() => {
    const m = system.star.massSolar ?? 1;
    return Math.min(1.55, Math.max(0.8, 0.55 + m * 0.55));
  }, [system]);

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
      sunVis: sunR * starScale,
      ready: true,
      radii: system.planets.map((p) =>
        orbitRadius(p.distanceAU / system.maxAU, sunR, maxR)
      ),
    };
    geomRef.current = next;
    trailPts.current = {};
    setGeom(next);
  }, [system, starScale]);

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
    const planets = system.planets;
    const belt = system.belt;

    const sizeCanvas = (c: HTMLCanvasElement) => {
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.max(1, c.clientWidth * dpr);
      c.height = Math.max(1, c.clientHeight * dpr);
      const ctx = c.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    };

    let tCtx: CanvasRenderingContext2D | null = null;
    let bCtx: CanvasRenderingContext2D | null = null;

    const onResize = () => {
      if (trailCanvasRef.current) sizeCanvas(trailCanvasRef.current);
      if (beltCanvasRef.current) sizeCanvas(beltCanvasRef.current);
    };
    window.addEventListener("resize", onResize);

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playingRef.current) {
        simDaysRef.current += dt * 12 * speedRef.current;
      }
      const g = geomRef.current;
      const sim = simDaysRef.current;

      if (!tCtx && trailCanvasRef.current) tCtx = sizeCanvas(trailCanvasRef.current);
      if (!bCtx && beltCanvasRef.current) bCtx = sizeCanvas(beltCanvasRef.current);

      if (g.ready && g.radii.length === planets.length) {
        // asteroid belt between two neighbouring worlds
        const beltCtx = bCtx;
        if (beltCtx) {
          beltCtx.clearRect(0, 0, g.w, g.h);
          if (belt) {
            const inner = g.radii[belt.innerIdx] + 12;
            const outer = g.radii[belt.outerIdx] - 12;
            if (outer > inner) {
              beltCtx.fillStyle = "#a99c86";
              for (const a of asteroids) {
                const r = inner + a.t * (outer - inner);
                const ang = a.a0 + sim * a.w;
                beltCtx.globalAlpha = a.al;
                beltCtx.fillRect(
                  g.cx + Math.cos(ang) * r,
                  g.cy + Math.sin(ang) * r,
                  a.s,
                  a.s
                );
              }
              beltCtx.globalAlpha = 1;
            }
          }
        }

        // planet positions + motion trails
        const trail = tCtx;
        if (trail) {
          trail.clearRect(0, 0, g.w, g.h);
          trail.lineWidth = 1.4;
          trail.lineCap = "round";
          planets.forEach((p, i) => {
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
  }, [system, asteroids]);

  /* ---------------- interaction ---------------- */

  const select = useCallback((b: Body) => {
    setSelected(b);
    setTouched(true);
  }, []);

  const handleReset = useCallback(() => {
    simDaysRef.current = 0;
    trailPts.current = {};
    setClock(fmtSim(0));
  }, []);

  const regenerate = useCallback(() => {
    if (warping) return;
    setWarping(true);
    window.setTimeout(() => {
      setSeed(Math.floor(Math.random() * 0xffffff));
      setSelected(null);
      trailPts.current = {};
    }, 280);
    window.setTimeout(() => setWarping(false), 950);
  }, [warping]);

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
          const ids = system.bodies.map((b) => b.id);
          const idx = cur ? ids.indexOf(cur.id) : -1;
          const nextId = ids[(idx + dir + ids.length * 2) % ids.length];
          setTouched(true);
          return system.bodies.find((b) => b.id === nextId) ?? null;
        });
      } else if (e.key === "Escape") {
        setSelected(null);
      } else if (e.key.toLowerCase() === "n") {
        regenerate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [system, regenerate]);

  const ticks = useMemo(() => Array.from({ length: 72 }, (_, i) => i * 5), []);
  const outerR = geom.ready && geom.radii.length ? geom.radii[geom.radii.length - 1] + 16 : 0;

  const nebula = useMemo(() => {
    const c = system.star.color;
    return `radial-gradient(1100px 700px at 12% -8%, ${hexToRgba(c, 0.26)}, transparent 62%), radial-gradient(900px 650px at 108% 112%, ${hexToRgba(c, 0.12)}, transparent 60%), radial-gradient(1500px 1000px at 50% 46%, rgba(16,26,58,0.5), transparent 78%)`;
  }, [system]);

  /* ---------------- render ---------------- */

  return (
    <div className="relative h-dvh w-full select-none overflow-hidden bg-void font-body text-slate-100">
      <Starfield tint={system.star.color} />

      {/* nebula wash tinted by the star */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 transition-all duration-1000"
        style={{ background: nebula }}
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

      {/* warp flash on regeneration */}
      {warping && (
        <div
          key={seed}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[60]"
          style={{
            animation: "warpflash 0.95s ease-out forwards",
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,242,214,0.95), rgba(255,180,80,0.4) 42%, transparent 75%)",
          }}
        />
      )}

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
                const r2 = outerR + (d % 30 === 0 ? 11 : 5);
                return (
                  <line
                    key={d}
                    x1={geom.cx + Math.cos(a) * outerR}
                    y1={geom.cy + Math.sin(a) * outerR}
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

              {system.planets.map((p, i) => {
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

            {/* ---------- STAR ---------- */}
            <button
              onClick={() => select(system.star)}
              aria-label={`${system.star.name} — view details`}
              className="group absolute z-10 rounded-full outline-none"
              style={{
                left: geom.cx,
                top: geom.cy,
                width: geom.sunVis * 2.4,
                height: geom.sunVis * 2.4,
                transform: "translate(-50%,-50%)",
              }}
            >
              <span
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: geom.sunVis * 3.6,
                  height: geom.sunVis * 3.6,
                  transform: "translate(-50%,-50%)",
                  background: `repeating-conic-gradient(from 0deg, ${hexToRgba(system.star.color, 0.1)} 0deg 4deg, transparent 4deg 12deg)`,
                  animation: "spin 44s linear infinite",
                }}
              />
              <span
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: geom.sunVis * 4.8,
                  height: geom.sunVis * 4.8,
                  background: `radial-gradient(circle, ${system.star.glow} 0%, transparent 70%)`,
                  filter: "blur(6px)",
                  animation: "breathe 6s ease-in-out infinite",
                }}
              />
              <span
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: geom.sunVis * 2.7,
                  height: geom.sunVis * 2.7,
                  background: `radial-gradient(circle, ${system.star.glow}, transparent 68%)`,
                  animation: "breathe 3.8s ease-in-out infinite reverse",
                }}
              />
              <span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-300 group-hover:scale-105"
                style={{
                  width: geom.sunVis * 2,
                  height: geom.sunVis * 2,
                  background: `radial-gradient(circle at 38% 35%, ${system.star.colorSoft}, ${system.star.color} 45%, ${system.star.colorDark} 100%)`,
                  boxShadow: `0 0 40px 8px ${system.star.glow}, 0 0 120px 40px ${hexToRgba(system.star.color, 0.18)}`,
                }}
              />
              {selected?.id === system.star.id && (
                <span
                  className="absolute left-1/2 top-1/2 rounded-full border border-dashed"
                  style={{
                    width: geom.sunVis * 2.9,
                    height: geom.sunVis * 2.9,
                    borderColor: system.star.color,
                    animation: "spinCenter 9s linear infinite",
                  }}
                />
              )}
              <span
                className="pointer-events-none absolute left-1/2 top-1/2 whitespace-nowrap opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ transform: `translate(${geom.sunVis * 1.5 + 10}px, -50%)` }}
              >
                <span className="font-display text-[11px] font-bold tracking-[0.2em]" style={{ color: system.star.colorSoft }}>
                  {system.star.name.toUpperCase()}
                </span>
                <span className="ml-2 text-[9px] tracking-widest text-white/50">
                  {system.star.type.toUpperCase()}
                </span>
              </span>
            </button>

            {/* ---------- PLANETS ---------- */}
            {system.planets.map((p) => {
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
                          border: `2px solid ${p.glow}`,
                          transform: "translate(-50%,-50%) rotate(-16deg) scaleY(0.32)",
                        }}
                      />
                      <span
                        className="pointer-events-none absolute left-1/2 top-1/2 rounded-[50%]"
                        style={{
                          width: p.sizePx * 1.8,
                          height: p.sizePx * 1.8,
                          border: `1px solid ${p.glow}`,
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
                  CLICK ANY WORLD TO SCAN IT
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
            PROCEDURAL SURVEY · {system.catalog} · SEED {system.seedLabel}
          </p>
          <h1 className="font-display mt-1.5 text-[24px] font-black leading-none tracking-[0.06em] text-white md:text-[34px]">
            {system.star.name.toUpperCase()}{" "}
            <span style={{ color: system.star.color }}>SYSTEM</span>
          </h1>
          <p className="mt-1.5 text-[10px] tracking-[0.18em] text-white/35">
            {system.star.type.toUpperCase()} · {system.planets.length} WORLDS · PERIODS VIA KEPLER III
          </p>
        </div>

        <div className="hidden border-r-2 pr-4 text-right sm:block" style={{ borderColor: hexToRgba(system.star.color, 0.7) }}>
          <p className="text-[8px] tracking-[0.3em] text-white/35">MISSION CLOCK</p>
          <p className="text-[17px] font-bold tabular-nums leading-tight" style={{ color: system.star.colorSoft }}>
            {clock}
          </p>
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
        seedLabel={system.seedLabel}
        onRegenerate={regenerate}
        bodies={system.bodies}
      />

      {selected && (
        <InfoPanel
          key={`${seed}-${selected.id}`}
          body={selected}
          onClose={() => setSelected(null)}
          simDaysRef={simDaysRef}
        />
      )}

      {/* film grain */}
      <div className="grain pointer-events-none fixed inset-0 z-[70] opacity-[0.05] mix-blend-overlay" aria-hidden="true" />
    </div>
  );
}

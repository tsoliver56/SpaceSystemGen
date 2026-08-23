import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fmtSim,
  generateSystem,
  generateSystemPhased,
  habitableZone,
  hexToRgba,
  PIPELINE_PHASES,
  type Body,
} from "./lib/generator";
import {
  auToPx,
  frameOf,
  nodePoints,
  orbitPathD,
  orbitPointAtE,
  orbitPointFromM,
  planeBasis,
  project3,
  VIEW_ANGLES,
  VIEW_TILT,
  type ViewMode,
} from "./lib/kepler";

const VIEW_ORDER: ViewMode[] = ["top", "quarter", "side"];
import Starfield from "./components/Starfield";
import InfoPanel from "./components/InfoPanel";
import Deck from "./components/Deck";

interface Geom {
  cx: number;
  cy: number;
  w: number;
  h: number;
  radii: number[]; // semi-major axes, px
  sunR: number;
  sunVis: number;
  maxR: number;
  /** AU value that maps to maxR — maxAU plus apoapsis headroom */
  scaleAU: number;
  rocheR: number;
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
  maxR: 400,
  scaleAU: 33.8,
  rocheR: 0,
  ready: false,
};

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const beltCanvasRef = useRef<HTMLCanvasElement>(null);
  const planetEls = useRef<Record<string, HTMLButtonElement | null>>({});
  const termEls = useRef<Record<string, HTMLSpanElement | null>>({});
  const trailPts = useRef<Record<string, { x: number; y: number }[]>>({});
  const starSpinRef = useRef<HTMLSpanElement | null>(null);
  const simDaysRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(2);
  const zoomRef = useRef(1);
  const geomRef = useRef<Geom>(INITIAL_GEOM);

  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 0xffffff));
  const system = useMemo(() => generateSystem(seed), [seed]);

  /* camera: top / quarter / side. viewTilt eases between presets; the ref
     feeds the 60fps loop, the state re-renders the SVG geometry */
  const [viewMode, setViewMode] = useState<ViewMode>("quarter");
  const [viewTilt, setViewTilt] = useState<number>(VIEW_TILT);
  const tiltRef = useRef<number>(VIEW_TILT);
  useEffect(() => {
    const from = tiltRef.current;
    const to = VIEW_ANGLES[viewMode];
    if (Math.abs(from - to) < 1e-4) return;
    let raf = 0;
    const t0 = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const v = from + (to - from) * e;
      tiltRef.current = v;
      setViewTilt(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [viewMode]);

  const [geom, setGeom] = useState<Geom>(INITIAL_GEOM);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(2);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<Body | null>(null);
  const [touched, setTouched] = useState(false);
  const [warping, setWarping] = useState(false);
  const [forming, setForming] = useState(false);
  const [phase, setPhase] = useState(0);
  const formingRef = useRef(false);
  const [clock, setClock] = useState("T+0y 000d");
  const deckRef = useRef<HTMLDivElement>(null);
  const [deckH, setDeckH] = useState(64);

  /* the control deck wraps taller on narrow screens — the info panel's
     bottom edge must always clear it */
  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setDeckH(Math.ceil(el.getBoundingClientRect().height))
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    /* reserve 30% headroom beyond the outermost semi-major axis so the
       most eccentric apoapsis never leaves the stage */
    const scaleAU = system.maxAU * 1.3;
    const toPx = (au: number) =>
      auToPx(au, sunR * starScale, maxR, scaleAU);
    const next: Geom = {
      cx: w / 2,
      cy: h / 2,
      w,
      h,
      sunR,
      sunVis: sunR * starScale,
      maxR,
      scaleAU,
      ready: true,
      radii: system.planets.map((p) => toPx(p.distanceAU)),
      rocheR: 0,
    };
    /* Roche zone marker: drawn inside the innermost world's *periapsis*
       (its closest possible approach), which generation keeps ≥ 3× beyond
       the fluid Roche limit — so the forbidden disc is always clear. */
    const firstPeri = toPx(system.planets[0]?.periapsisAU ?? system.maxAU * 0.1);
    next.rocheR = Math.min(
      Math.max(next.sunVis + 8, next.sunVis + (firstPeri - next.sunVis) * 0.5),
      Math.max(next.sunVis + 8, firstPeri - 10)
    );
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
        s: 0.4 + Math.random() * 1.05,
        al: 0.12 + Math.random() * 0.4,
      })),
    []
  );

  /* static orbit geometry: projected ellipse path + apsides + node markers */
  const orbitArt = useMemo(() => {
    if (!geom.ready) return [];
    const toPx = (au: number) =>
      auToPx(au, geom.sunVis, geom.maxR, geom.scaleAU);
    return system.planets.map((p) => {
      const e = p.eccentricity ?? 0;
      const fr = frameOf(p);
      return {
        id: p.id,
        d: orbitPathD(p.distanceAU, e, fr, toPx, geom.cx, geom.cy, 148, viewTilt),
        peri: orbitPointAtE(p.distanceAU, e, fr, 0, toPx, viewTilt),
        apo: orbitPointAtE(p.distanceAU, e, fr, Math.PI, toPx, viewTilt),
        nodes:
          (p.inclinationDeg ?? 0) > 0.3
            ? nodePoints(p.distanceAU, e, fr, toPx, viewTilt)
            : null,
      };
    });
  }, [geom, system, viewTilt]);

  /* Invariable-plane grid: the fossil orientation of the protoplanetary
     disk, drawn as a dark-grey graticule lying in the total-angular-momentum
     plane. Rendered at the very bottom layer. Under a top view it reads as a
     full disk; under a side view it collapses to a line — giving the user an
     absolute orientation reference as the camera tilts. */
  const invGrid = useMemo(() => {
    if (!geom.ready) return null;
    const { u, v } = planeBasis(system.invariablePlane);
    const R = geom.maxR * 0.94; // disk radius in px
    const tilt = viewTilt;
    const seg = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
      const p = project3({ x: ax, y: ay, z: az }, tilt);
      const q = project3({ x: bx, y: by, z: bz }, tilt);
      return `M${(geom.cx + p.x).toFixed(1)} ${(geom.cy + p.y).toFixed(1)}L${(geom.cx + q.x).toFixed(1)} ${(geom.cy + q.y).toFixed(1)}`;
    };

    // square graticule, clipped analytically to the disk circle
    let grid = "";
    const step = R / 6;
    for (let c = step; c < R; c += step) {
      const half = Math.sqrt(Math.max(0, R * R - c * c));
      if (half < 2) continue;
      for (const s of [c, -c]) {
        grid += seg(s * u.x - half * v.x, s * u.y - half * v.y, s * u.z - half * v.z, s * u.x + half * v.x, s * u.y + half * v.y, s * u.z + half * v.z);
        grid += seg(-half * u.x + s * v.x, -half * u.y + s * v.y, -half * u.z + s * v.z, half * u.x + s * v.x, half * u.y + s * v.y, half * u.z + s * v.z);
      }
    }

    // the two principal axes through the star
    const axes =
      seg(-R * u.x, -R * u.y, -R * u.z, R * u.x, R * u.y, R * u.z) +
      seg(-R * v.x, -R * v.y, -R * v.z, R * v.x, R * v.y, R * v.z);

    // rim + two inner rings: concentric circles in the plane
    const ring = (rr: number, n = 72) => {
      let d = "";
      for (let k = 0; k <= n; k++) {
        const th = (k / n) * Math.PI * 2;
        const p = project3(
          { x: rr * Math.cos(th) * u.x + rr * Math.sin(th) * v.x, y: rr * Math.cos(th) * u.y + rr * Math.sin(th) * v.y, z: rr * Math.cos(th) * u.z + rr * Math.sin(th) * v.z },
          tilt
        );
        d += `${k === 0 ? "M" : "L"}${(geom.cx + p.x).toFixed(1)} ${(geom.cy + p.y).toFixed(1)}`;
      }
      return d + "Z";
    };

    // label anchor just past the rim along the u axis
    const lp = project3({ x: (R + 16) * u.x, y: (R + 16) * u.y, z: (R + 16) * u.z }, tilt);

    return {
      grid,
      axes,
      rim: ring(R),
      midRing: ring(R * 0.62),
      innerRing: ring(R * 0.3),
      lx: geom.cx + lp.x,
      ly: geom.cy + lp.y,
    };
  }, [geom, system, viewTilt]);

  /* circumstellar habitable zone annulus (in px). Rendered at the very
     bottom of the stage stack so it never covers the belt, orbit rings,
     markers, motion trails, the star, or any planet. The fill is kept
     extremely translucent on purpose. */
  const hz = useMemo(() => {
    if (!geom.ready) return null;
    const [rawIn, rawOut] = habitableZone(system.star.luminositySolar ?? 1);
    /* habitability is impossible where tides disrupt bodies — the zone can
       never begin inside the star's fluid Roche limit */
    const roche = system.rocheAU;
    const hzIn = Math.max(rawIn, roche * 1.02);
    const hzOut = Math.max(rawOut, hzIn + roche * 0.05 + 1e-4);
    const toPx = (au: number) =>
      auToPx(au, geom.sunVis, geom.maxR, geom.scaleAU);
    let inner = Math.max(toPx(hzIn), geom.sunVis + 6);
    let outer = Math.min(toPx(hzOut), geom.maxR - 2);
    /* around dim stars the compressed zone can collapse below the star's
       drawn limb — always keep a visible band anchored just outside it
       (the label + scan panel carry the exact AU limits) */
    if (outer - inner < 12) {
      inner = Math.min(geom.sunVis + 6, Math.max(0, geom.maxR - 16));
      outer = Math.min(inner + Math.max(12, outer - inner), geom.maxR - 2);
    }
    const fmtAU = (v: number) =>
      v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.round(v));
    const labelA = (-135 * Math.PI) / 180; // upper-left diagonal
    const mid = (inner + outer) / 2;
    return {
      inner,
      outer,
      mid,
      band: outer - inner,
      clipped: hzIn > rawIn + 1e-9,
      lx: Math.max(96, Math.min(geom.w - 96, geom.cx + Math.cos(labelA) * (outer + 14))),
      ly: Math.max(16, geom.cy + Math.sin(labelA) * (outer + 14) * Math.cos(viewTilt)),
      label: `HZ · ${fmtAU(hzIn)}–${fmtAU(hzOut)} AU`,
    };
  }, [geom, system, viewTilt]);

  /* ---------------- main simulation loop ---------------- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let clockAcc = 1;
    const planets = system.planets;
    const belt = system.belt;

    /* belt grains: fixed radial home in AU (inside the cleared gap), angular
       speed from Kepler III at each grain's own semi-major axis — inner
       grains visibly overtake outer ones */
    const mStar = system.star.massSolar ?? 1;
    const beltAst =
      belt && belt.outerAU > belt.innerAU
        ? asteroids.map((k) => {
            const aAU = belt.innerAU + k.t * (belt.outerAU - belt.innerAU);
            return {
              ...k,
              aAU,
              w:
                (2 * Math.PI) /
                (365.25 * Math.sqrt((aAU * aAU * aAU) / mStar)),
            };
          })
        : null;

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
        simDaysRef.current += dt * speedRef.current; // 1× = 1 day/s
      }
      const g = geomRef.current;
      const sim = simDaysRef.current;
      const tilt = tiltRef.current;
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);

      if (!tCtx && trailCanvasRef.current) tCtx = sizeCanvas(trailCanvasRef.current);
      if (!bCtx && beltCanvasRef.current) bCtx = sizeCanvas(beltCanvasRef.current);

      if (g.ready && g.radii.length === planets.length) {
        // asteroid belt — AU-space annulus inside the widest cleared gap
        const beltCtx = bCtx;
        if (beltCtx) {
          beltCtx.clearRect(0, 0, g.w, g.h);
          if (beltAst) {
            const toPxBelt = (au: number) =>
              auToPx(au, g.sunVis, g.maxR, g.scaleAU);
            beltCtx.fillStyle = "#a99c86";
            for (const k of beltAst) {
              const r = toPxBelt(k.aAU);
              const ang = k.a0 + sim * k.w;
              beltCtx.globalAlpha = k.al;
              beltCtx.fillRect(
                g.cx + Math.cos(ang) * r,
                g.cy + Math.sin(ang) * r * cosT,
                k.s,
                k.s
              );
            }
            beltCtx.globalAlpha = 1;
          }
        }

        // star selection reticle — its spin mirrors the star's generated
        // sidereal rotation (slower rotators crawl, fast ones whirl),
        // scaled so a visual turn takes (10 + rotH·0.12)s at 1×; pauses
        // and accelerates with the simulation
        const spinEl = starSpinRef.current;
        if (spinEl) {
          const rotH = system.star.rotationHours ?? 120;
          const visDays = 10 + rotH * 0.12;
          spinEl.style.transform = `rotate(${(((sim / visDays) * 360) % 360).toFixed(2)}deg)`;
        }

        // planet positions + motion trails
        const trail = tCtx;
        if (trail) {
          trail.clearRect(0, 0, g.w, g.h);
          trail.lineWidth = 1.4;
          trail.lineCap = "round";
          planets.forEach((p) => {
            const el = planetEls.current[p.id];
            if (!el) return;
            /* Keplerian motion: M(t) → E → ν → r, projected through the
               (i, Ω, ω) frame — worlds visibly race through periapsis */
            const M =
              ((p.startAngle * Math.PI) / 180 +
                (2 * Math.PI * sim) / p.periodDays) %
              (2 * Math.PI);
            const toPx = (au: number) =>
              auToPx(au, g.sunVis, g.maxR, g.scaleAU);
            const pt = orbitPointFromM(
              p.distanceAU,
              p.eccentricity ?? 0,
              frameOf(p),
              M,
              toPx,
              tilt
            );
            const x = g.cx + pt.x;
            const y = g.cy + pt.y;
            /* depth cue scales with the tilt — flat in top view, full in side */
            const s = Math.max(
              0.86,
              Math.min(1.14, 1 + (pt.depth * sinT) / (g.maxR * 2))
            );
            el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%) scale(${s.toFixed(3)})`;
            /* once the camera tilts, worlds on the far side of the star dip
               behind it and near-side worlds pass in front (transits) */
            el.style.zIndex =
              tilt > 0.35 ? (pt.depth >= 0 ? "24" : "6") : "20";

            /* terminator: night side always faces away from the star;
               thick atmospheres soften the day-night boundary */
            const termEl = termEls.current[p.id];
            if (termEl) {
              const deg = (Math.atan2(y - g.cy, x - g.cx) * 180) / Math.PI + 90;
              const shade = p.atmosphere?.termShade ?? 0.6;
              termEl.style.background = `linear-gradient(${deg.toFixed(1)}deg, transparent 36%, rgba(2,5,14,${shade}) 82%)`;
            }

            if (playingRef.current) {
              const pts = (trailPts.current[p.id] ||= []);
              pts.push({ x, y });
              if (pts.length > 110) pts.shift();
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

  const regenerate = useCallback(async () => {
    if (formingRef.current) return;
    formingRef.current = true;
    setWarping(true);
    window.setTimeout(() => setWarping(false), 950);
    await new Promise((r) => setTimeout(r, 300)); // let the warp bloom land
    setForming(true);
    setPhase(0);
    const s = Math.floor(Math.random() * 0xffffff);
    await generateSystemPhased(s, setPhase); // staged eight-step pipeline
    setSelected(null);
    trailPts.current = {};
    setSeed(s);
    setForming(false);
    formingRef.current = false;
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
      } else if (e.key.toLowerCase() === "v") {
        setViewMode((m) => VIEW_ORDER[(VIEW_ORDER.indexOf(m) + 1) % VIEW_ORDER.length]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [system, regenerate]);

  const ticks = useMemo(() => Array.from({ length: 72 }, (_, i) => i * 5), []);
  const outerR = geom.ready && geom.radii.length ? geom.radii[geom.radii.length - 1] + 16 : 0;

  /* ---------------- render ---------------- */

  return (
    <div className="relative h-dvh w-full select-none overflow-hidden bg-void font-body text-slate-100">
      <Starfield tint={system.star.color} />

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
            {/* invariable-plane graticule — the absolute orientation reference */}
            {invGrid && (
              <svg
                className="pointer-events-none absolute inset-0 z-[1]"
                width={geom.w}
                height={geom.h}
                aria-hidden="true"
                style={{ animation: "fadein 1.6s ease-out both" }}
              >
                <path d={invGrid.midRing} fill="none" stroke="rgba(148,156,178,0.07)" strokeWidth={1} />
                <path d={invGrid.innerRing} fill="none" stroke="rgba(148,156,178,0.06)" strokeWidth={1} />
                <path d={invGrid.grid} fill="none" stroke="rgba(148,156,178,0.09)" strokeWidth={1} />
                <path d={invGrid.axes} fill="none" stroke="rgba(148,156,178,0.15)" strokeWidth={1} />
                <path d={invGrid.rim} fill="none" stroke="rgba(160,168,190,0.22)" strokeWidth={1} />
                <text
                  x={invGrid.lx}
                  y={invGrid.ly}
                  textAnchor="middle"
                  fill="rgba(160,168,190,0.4)"
                  fontSize={8}
                  letterSpacing="0.2em"
                  style={{ fontFamily: "inherit" }}
                >
                  INVARIABLE PLANE
                </text>
              </svg>
            )}
            {/* circumstellar habitable zone — deliberately the bottom layer */}
            {hz && (
              <svg
                className="pointer-events-none absolute inset-0 z-[1]"
                width={geom.w}
                height={geom.h}
                aria-hidden="true"
                style={{ animation: "fadein 1.4s ease-out both" }}
              >
                {/* the annulus squashes with the camera like every other
                    in-plane feature (top view = full ring, side = a line) */}
                <g
                  style={{
                    transform: `scaleY(${Math.cos(viewTilt).toFixed(4)})`,
                    transformOrigin: `${geom.cx}px ${geom.cy}px`,
                  }}
                >
                  {/* translucent green band */}
                  <circle
                    cx={geom.cx}
                    cy={geom.cy}
                    r={hz.mid}
                    fill="none"
                    stroke="rgba(80,225,140,0.06)"
                    strokeWidth={hz.band}
                  />
                  {/* inner + outer boundary hairlines */}
                  <circle
                    cx={geom.cx}
                    cy={geom.cy}
                    r={hz.inner}
                    fill="none"
                    stroke="rgba(80,225,140,0.22)"
                    strokeWidth={1}
                    strokeDasharray="2 6"
                  />
                  <circle
                    cx={geom.cx}
                    cy={geom.cy}
                    r={hz.outer}
                    fill="none"
                    stroke="rgba(80,225,140,0.22)"
                    strokeWidth={1}
                    strokeDasharray="2 6"
                  />
                </g>
                <text
                  x={hz.lx}
                  y={hz.ly}
                  textAnchor="middle"
                  fill="rgba(120,235,170,0.5)"
                  fontSize={8}
                  letterSpacing="0.18em"
                  style={{ fontFamily: "inherit" }}
                >
                  {hz.label}
                </text>
              </svg>
            )}
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
              <g
                style={{
                  transform: `scaleY(${Math.cos(viewTilt).toFixed(4)})`,
                  transformOrigin: `${geom.cx}px ${geom.cy}px`,
                }}
              >
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
              </g>

              {/* Roche disruption zone — tides shred worlds inside this ring */}
              {geom.rocheR > 0 && (
                <g>
                  <g
                    style={{
                      transform: `scaleY(${Math.cos(viewTilt).toFixed(4)})`,
                      transformOrigin: `${geom.cx}px ${geom.cy}px`,
                    }}
                  >
                    <circle
                      cx={geom.cx}
                      cy={geom.cy}
                      r={geom.rocheR}
                      fill="rgba(255,72,60,0.05)"
                    />
                    <circle
                      cx={geom.cx}
                      cy={geom.cy}
                      r={geom.rocheR}
                      fill="none"
                      stroke="rgba(255,100,88,0.45)"
                      strokeWidth={1}
                      strokeDasharray="3 7"
                      className="dash-drift"
                    />
                  </g>
                  <text
                    x={geom.cx + geom.rocheR * 0.71 + 5}
                    y={geom.cy + (geom.rocheR * 0.71 + 11) * Math.cos(viewTilt)}
                    fill="rgba(255,132,120,0.62)"
                    fontSize={7.5}
                    letterSpacing={2.4}
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    ROCHE
                  </text>
                </g>
              )}

              {system.planets.map((p, i) => {
                const oa = orbitArt[i];
                if (!oa) return null;
                const active = selected?.id === p.id;
                const px = (pt: { x: number; y: number }) => ({
                  x: geom.cx + pt.x,
                  y: geom.cy + pt.y,
                });
                const peri = px(oa.peri);
                const apo = px(oa.apo);
                return (
                  <g key={p.id}>
                    {/* projected ellipse — shape set by a, e, i, Ω, ω */}
                    <path
                      d={oa.d}
                      fill="none"
                      stroke={active ? p.color : "rgba(150,178,235,0.17)"}
                      strokeOpacity={active ? 0.85 : 1}
                      strokeWidth={active ? 1.5 : 1}
                      style={{ transition: "stroke .4s, stroke-width .4s" }}
                    />
                    {/* periapsis (filled) & apoapsis (hollow) */}
                    <circle
                      cx={peri.x}
                      cy={peri.y}
                      r={2.1}
                      fill={p.color}
                      opacity={active ? 0.95 : 0.4}
                    />
                    <circle
                      cx={apo.x}
                      cy={apo.y}
                      r={2.1}
                      fill="none"
                      stroke="rgba(230,240,255,0.5)"
                      strokeWidth={1}
                      opacity={active ? 0.9 : 0.32}
                    />
                    {/* line of nodes — where the orbit pierces the reference plane */}
                    {oa.nodes && (
                      <>
                        {[oa.nodes.asc, oa.nodes.desc].map((nd, k) => {
                          const q = px(nd);
                          return (
                            <rect
                              key={k}
                              x={q.x - 2.3}
                              y={q.y - 2.3}
                              width={4.6}
                              height={4.6}
                              transform={`rotate(45 ${q.x} ${q.y})`}
                              fill="none"
                              stroke="rgba(190,210,255,0.55)"
                              strokeWidth={0.9}
                              opacity={active ? 0.95 : 0.28}
                            />
                          );
                        })}
                      </>
                    )}
                    {active && (
                      <g
                        fontSize={8}
                        letterSpacing={1.2}
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        <text x={peri.x + 6} y={peri.y + 3} fill={p.color}>
                          q {(p.periapsisAU ?? 0).toFixed(2)}
                        </text>
                        <text x={apo.x + 6} y={apo.y + 3} fill="rgba(230,240,255,0.72)">
                          Q {(p.apoapsisAU ?? 0).toFixed(2)}
                        </text>
                      </g>
                    )}
                    {/* fat invisible stroke = click target */}
                    <path
                      d={oa.d}
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
              {/* light rays — centering lives on the wrapper so the spin
                  animation on the inner disc can never displace it */}
              <span
                className="pointer-events-none absolute left-1/2 top-1/2"
                style={{
                  width: geom.sunVis * 3.6,
                  height: geom.sunVis * 3.6,
                  transform: "translate(-50%,-50%)",
                }}
              >
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `repeating-conic-gradient(from 0deg, ${hexToRgba(system.star.color, 0.1)} 0deg 4deg, transparent 4deg 12deg)`,
                    animation: "spin 44s linear infinite",
                  }}
                />
              </span>
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
              {/* selection reticle — fixed to the star's outer edge; its
                  rotation is driven by the sim loop from the star's own
                  sidereal rotation period */}
              {selected?.id === system.star.id && (
                <span
                  className="pointer-events-none absolute left-1/2 top-1/2"
                  style={{
                    width: geom.sunVis * 2 + 12,
                    height: geom.sunVis * 2 + 12,
                    transform: "translate(-50%,-50%)",
                  }}
                >
                  <span
                    ref={starSpinRef}
                    className="absolute inset-0 rounded-full border border-dashed"
                    style={{
                      borderColor: system.star.color,
                      boxShadow: `0 0 12px ${system.star.glow}`,
                    }}
                  />
                </span>
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
              /* cloud bands drift at the world's own spin rate and lean
                 with its axial tilt; gas giants visibly bulge (flattening) */
              const bandDur = Math.max(4, Math.min(30, (p.rotationHours ?? 24) * 0.85));
              const squash = 1 - (p.flattening ?? 0);
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
                  {/* atmosphere shell — haze tint & extent follow composition and pressure */}
                  {p.atmosphere && p.atmosphere.hazeAmt > 0.02 && (
                    <span
                      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        width: p.sizePx * (1.7 + p.atmosphere.hazeAmt * 0.9),
                        height: p.sizePx * (1.7 + p.atmosphere.hazeAmt * 0.9),
                        background: `radial-gradient(circle, rgba(${p.atmosphere.haze},0.5) 32%, rgba(${p.atmosphere.haze},0.16) 52%, transparent 64%)`,
                        opacity: p.atmosphere.hazeAmt,
                      }}
                    />
                  )}
                  <span
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-[1.3]"
                    style={{
                      width: p.sizePx,
                      height: p.sizePx,
                      background: `radial-gradient(circle at 32% 30%, ${p.colorSoft} 0%, ${p.color} 48%, ${p.colorDark} 100%)`,
                      boxShadow: `0 0 ${Math.round(p.sizePx * 0.9)}px ${p.glow}`,
                      transform: `scaleY(${squash.toFixed(4)})`,
                    }}
                  >
                    {p.bands && (
                      <span
                        className="absolute inset-0"
                        style={{
                          background:
                            "repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0 2px, rgba(255,255,255,0.10) 2px 3px, transparent 3px 6px)",
                          transform: `rotate(${p.axialTiltDeg ?? 0}deg)`,
                          animation: `bandflow ${bandDur.toFixed(1)}s linear infinite`,
                          opacity: p.atmosphere?.bandAmt ?? 0.5,
                        }}
                      />
                    )}
                    {/* day-night terminator — aimed away from the star every
                        frame; sharp on airless worlds, soft under thick air */}
                    <span
                      ref={(el) => {
                        termEls.current[p.id] = el;
                      }}
                      className="pointer-events-none absolute inset-0 rounded-full"
                    />
                  </span>
                  {p.rings && (
                    <>
                      <span
                        className="pointer-events-none absolute left-1/2 top-1/2 rounded-[50%]"
                        style={{
                          width: p.sizePx * 2.3,
                          height: p.sizePx * 2.3,
                          border: `2px solid ${p.glow}`,
                          transform: `translate(-50%,-50%) rotate(${-(p.axialTiltDeg ?? 16)}deg) scaleY(0.32)`,
                        }}
                      />
                      <span
                        className="pointer-events-none absolute left-1/2 top-1/2 rounded-[50%]"
                        style={{
                          width: p.sizePx * 1.8,
                          height: p.sizePx * 1.8,
                          border: `1px solid ${p.glow}`,
                          transform: `translate(-50%,-50%) rotate(${-(p.axialTiltDeg ?? 16)}deg) scaleY(0.32)`,
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
          <h1 className="font-display mt-1.5 whitespace-nowrap text-[clamp(15px,5.2vw,34px)] font-black leading-none tracking-[0.06em] text-white">
            {system.star.name.toUpperCase()}{" "}
            <span style={{ color: system.star.color }}>SYSTEM</span>
          </h1>
          <p className="mt-1.5 text-[10px] tracking-[0.18em] text-white/35">
            {system.star.type.toUpperCase()} · {system.planets.length} WORLDS
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

      {/* invisible twin of the control deck: mirrors its exact flex layout so
         the info panel always knows where the controls begin */}
      <div
        ref={deckRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 invisible border-t border-transparent"
      >
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 md:px-6">
          <div className="flex items-center gap-2.5">
            <span className="h-10 w-10" />
            <span className="h-8 w-8" />
            <span className="hidden text-[11px] tracking-wider sm:block">T+99999y 364d</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.25em]">RATE</span>
            <div className="flex overflow-hidden rounded border border-white/12">
              {[0.5, 1, 2, 5, 10, 50].map((m) => (
                <span key={m} className="px-2.5 py-1 text-[11px] tabular-nums">{m}×</span>
              ))}
            </div>
            <span className="hidden text-[9px] tabular-nums tracking-widest lg:block">{speed} d/s</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.25em]">ZOOM</span>
            <span className="w-24 md:w-28" />
            <span className="w-9 text-[10px] tabular-nums">100%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.25em]">VIEW</span>
            <div className="flex overflow-hidden rounded border border-white/12">
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.15em]">TOP</span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.15em]">QUARTER</span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.15em]">SIDE</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="border px-3 py-1.5 text-[10px] font-bold tracking-[0.2em]">NEW SYSTEM</span>
            <span className="hidden text-[9px] tabular-nums tracking-widest md:block">SEED 0000</span>
          </div>
          <div className="scroll-slim ml-auto flex max-w-full items-center gap-1 overflow-x-auto pb-0.5">
            {system.bodies.map((b) => (
              <span
                key={b.id}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[10px] tracking-[0.15em]"
              >
                <span className="h-1.5 w-1.5 rounded-full" />
                {b.name.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

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
        view={viewMode}
        onView={setViewMode}
      />

      {selected && (
        <InfoPanel
          key={`${seed}-${selected.id}`}
          body={selected}
          onClose={() => setSelected(null)}
          simDaysRef={simDaysRef}
          bottomOffset={deckH}
        />
      )}

      {/* formation sequence — runs while a new system condenses */}
      {forming && (
        <div className="fixed inset-0 z-[65] flex flex-col items-center justify-center gap-9 bg-black/95">
          <div className="text-center">
            <p className="text-[9px] tracking-[0.4em] text-white/35">
              SEQUENTIAL ACCRETION PROTOCOL
            </p>
            <h2 className="font-display mt-2 text-[22px] font-black tracking-[0.12em] text-white md:text-[28px]">
              FORMING <span className="text-solar">SYSTEM</span>
            </h2>
          </div>
          <div className="w-[min(430px,88vw)]">
            {PIPELINE_PHASES.map((label, i) => {
              const done = i < phase;
              const active = i === phase;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-3 py-[5px] text-[10px] tracking-[0.22em] transition-colors duration-300 ${
                    done
                      ? "text-white/65"
                      : active
                        ? "text-solar"
                        : "text-white/20"
                  }`}
                >
                  <span
                    className={`grid h-[18px] w-[18px] shrink-0 place-items-center border text-[8px] tabular-nums transition-all duration-300 ${
                      done
                        ? "border-solar/70 bg-solar/15 text-solar"
                        : active
                          ? "border-solar shadow-[0_0_12px_rgba(255,196,94,0.4)]"
                          : "border-white/15"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span className={active ? "animate-pulse" : ""}>{label}</span>
                </div>
              );
            })}
            <div className="mt-5 h-[3px] w-full overflow-hidden bg-white/10">
              <div
                className="h-full transition-all duration-300 ease-out"
                style={{
                  width: `${((phase + 1) / PIPELINE_PHASES.length) * 100}%`,
                  background: "linear-gradient(90deg, rgba(255,196,94,0.4), #ffc45e)",
                  boxShadow: "0 0 12px rgba(255,196,94,0.6)",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* film grain */}
      <div className="grain pointer-events-none fixed inset-0 z-[70] opacity-[0.05] mix-blend-overlay" aria-hidden="true" />
    </div>
  );
}

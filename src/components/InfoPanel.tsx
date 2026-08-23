import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import {
  fmtSim,
  GAS_DEFS,
  habitableZone,
  SUN_RADIUS_AU,
  type Body,
} from "../lib/generator";
import { nuFromE, solveKepler } from "../lib/kepler";
import { fmtGasPct, fmtKm, fmtMassKg, fmtPressure, sci } from "../lib/format";

interface InfoPanelProps {
  body: Body;
  onClose: () => void;
  simDaysRef: RefObject<number>;
  /** live height of the control deck — the panel never tucks under it */
  bottomOffset: number;
}

const M_EARTH_KG = 5.972e24;
const V_EARTH_KM3 = 1.08321e12;
const AU_KM = 149.6e6;

function auKm(au: number): string {
  const km = au * AU_KM;
  return km >= 1e9 ? `${(km / 1e9).toFixed(2)}B km` : `${(km / 1e6).toFixed(1)}M km`;
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const OrbitIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <ellipse cx="12" cy="12" rx="9" ry="5.2" />
    <circle cx="6" cy="11" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="8.6" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

const BodyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <circle cx="12" cy="12" r="7" />
    <path d="M5 12h14" />
    <path d="M6.2 8.6c3.6 1.6 8 1.6 11.6 0" />
    <path d="M6.2 15.4c3.6-1.6 8-1.6 11.6 0" />
  </svg>
);

function SectionHead({
  icon,
  title,
  count,
  accent,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  accent: string;
}) {
  return (
    <div className="mt-6 flex items-center gap-2.5">
      <span
        className="grid h-6 w-6 shrink-0 place-items-center border"
        style={{ borderColor: `${accent}66`, color: accent }}
      >
        {icon}
      </span>
      <h3 className="font-display text-[11px] font-bold tracking-[0.28em]" style={{ color: accent }}>
        {title}
      </h3>
      <span className="h-px flex-1 bg-white/10" />
      <span className="text-[8px] tabular-nums tracking-[0.2em] text-white/30">
        {String(count).padStart(2, "0")} FIELDS
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="border border-white/8 bg-white/[0.025] px-3 py-2.5 transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.05]">
      <div className="text-[8px] tracking-[0.22em] text-white/40">{label}</div>
      <div className="mt-1 text-[13px] font-bold tabular-nums" style={{ color: accent ?? "#f2f6ff" }}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[8.5px] tabular-nums tracking-wider text-white/35">{sub}</div>}
    </div>
  );
}

function Meter({ label, value, frac, color }: { label: string; value: string; frac: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    setW(0);
    const id = window.setTimeout(() => setW(Math.max(0.02, Math.min(1, frac))), 40);
    return () => window.clearTimeout(id);
  }, [frac]);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[8px] tracking-[0.22em] text-white/40">{label}</span>
        <span className="text-[10px] tabular-nums text-white/60">{value}</span>
      </div>
      <div className="mt-1 h-[3px] w-full overflow-hidden bg-white/8">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${w * 100}%`,
            background: `linear-gradient(90deg, ${color}55, ${color})`,
            boxShadow: `0 0 8px ${color}88`,
          }}
        />
      </div>
    </div>
  );
}

/* total mass + solid / liquid / gas budget with a stacked composition bar */
function MassBlock({ body }: { body: Body }) {
  const total = body.massKg ?? 0;
  const rows: { label: string; kg: number; color: string }[] = [
    { label: "SOLID / LAND", kg: body.solidMassKg ?? 0, color: "#c9a97a" },
    { label: "LIQUID · OCEANS, LAKES", kg: body.liquidMassKg ?? 0, color: "#5aa0ff" },
  ];
  const gasKg = body.gasMassKg ?? 0;
  if (total > 0 && gasKg / total >= 0.05) {
    rows.push({ label: "GASEOUS ENVELOPE", kg: gasKg, color: "#b8a0e8" });
  }
  /* composition bars sweep in when the block mounts */
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    setGrown(false);
    const id = window.setTimeout(() => setGrown(true), 80);
    return () => window.clearTimeout(id);
  }, [body.id]);
  return (
    <div className="border border-white/8 bg-white/[0.025] px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[8px] tracking-[0.22em] text-white/40">TOTAL MASS</span>
        <span className="text-[13px] font-bold tabular-nums" style={{ color: body.colorSoft }}>
          {fmtMassKg(total)}
        </span>
      </div>
      <div className="mt-1 text-[8.5px] tabular-nums tracking-wider text-white/35">
        {(total / M_EARTH_KG).toFixed(2)} M⊕
      </div>
      <div className="mt-2 flex h-1.5 w-full overflow-hidden bg-white/6">
        {rows.map((r) => (
          <span
            key={r.label}
            className="h-full transition-[width] duration-700 ease-out"
            style={{ width: grown && total ? `${(r.kg / total) * 100}%` : "0%", background: r.color, boxShadow: `0 0 6px ${r.color}88` }}
          />
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2 text-[9px] tabular-nums">
            <span className="flex items-center gap-1.5 tracking-[0.15em] text-white/45">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />
              {r.label}
            </span>
            <span className="text-white/65">
              {sci(r.kg)} kg · {total ? ((r.kg / total) * 100).toFixed(1) : "0.0"}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const AtmoIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M3 9.5h11a2.5 2.5 0 1 0-2.4-3.2" />
    <path d="M5 13.5h13a2.5 2.5 0 1 1-2.4 3.2" />
    <path d="M8 17.5h6" />
  </svg>
);

function AtmoSection({ body }: { body: Body }) {
  const atmo = body.atmosphere;
  if (!atmo) return null;
  return (
    <>
      <SectionHead icon={<AtmoIcon />} title="ATMOSPHERE" count={14} accent="#8fd0e8" />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat
          label="SURFACE PRESSURE"
          value={fmtPressure(atmo.pressureBar)}
          sub={
            atmo.cloudTop
              ? "CLOUD-TOP LEVEL · NO SURFACE"
              : atmo.collapsed
                ? "NIGHT-SIDE COLLAPSED"
                : `${Math.max(1, Math.round(atmo.pressureBar * 101.325)).toLocaleString("en-US")} kPa`
          }
          accent="#8fd0e8"
        />
        <Stat
          label="MEAN MOLAR MASS"
          value={`${atmo.molarMass.toFixed(2)} g/mol`}
          sub="DRY AIR = 28.97"
        />
        <Stat
          label="SEASONAL ΔP"
          value={atmo.seasonalPct != null ? `±${atmo.seasonalPct}%` : "NEGLIGIBLE"}
          sub={`OBLIQUITY ${(body.axialTiltDeg ?? 0).toFixed(1)}°`}
        />
        <Stat
          label="SPIN · ROTATION"
          value={body.locked ? "LOCKED" : `${(body.rotationHours ?? 0).toFixed(1)} h`}
          sub={atmo.circulation}
        />
      </div>

      {/* composition by volume — ten most abundant species */}
      <div className="mt-2 border border-white/8 bg-white/[0.025] px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[8px] tracking-[0.22em] text-white/40">
            COMPOSITION BY VOLUME · TOP 10
          </span>
          <span className="text-right text-[7.5px] tracking-[0.15em] text-white/35">
            {atmo.note}
          </span>
        </div>
        <div className="mt-2">
          {atmo.gases.map((gs) => {
            const def = GAS_DEFS[gs.id];
            if (!def) return null;
            return (
              <div key={gs.id} className="mt-1.5 flex items-center gap-2">
                <span
                  className="w-11 shrink-0 border px-1 py-0.5 text-center text-[9px] font-bold"
                  style={{ borderColor: `${def.color}55`, color: def.color }}
                >
                  {def.formula}
                </span>
                <span className="hidden w-24 shrink-0 truncate text-[8.5px] tracking-wider text-white/50 sm:block">
                  {def.name.toUpperCase()}
                </span>
                <div className="h-[3px] min-w-0 flex-1 overflow-hidden bg-white/6">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{
                      width: `${Math.max(1.2, Math.pow(gs.frac, 0.32) * 100)}%`,
                      background: `linear-gradient(90deg, ${def.color}44, ${def.color})`,
                      boxShadow: `0 0 6px ${def.color}66`,
                    }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-[9.5px] tabular-nums text-white/70">
                  {fmtGasPct(gs.frac)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[7.5px] leading-relaxed tracking-[0.18em] text-white/25">
          JEANS ESCAPE · MAGNUS H₂O SATURATION · COLD-TRAP CONDENSATION · DYNAMO SHIELDING FROM SPIN
        </p>
      </div>
    </>
  );
}

function TempRow({ body }: { body: Body }) {
  const cells = [
    { label: "MIN", v: body.surfTempMinC ?? 0, c: "#7fb2ff" },
    { label: "MEAN", v: body.surfTempMeanC ?? 0, c: body.colorSoft },
    { label: "MAX", v: body.surfTempMaxC ?? 0, c: "#ffab7a" },
  ];
  return (
    <div className="col-span-2 border border-white/8 bg-white/[0.025] px-3 py-2.5">
      <div className="text-[8px] tracking-[0.22em] text-white/40">SURFACE TEMPERATURE</div>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {cells.map((c) => (
          <div key={c.label}>
            <div className="text-[7.5px] tracking-[0.2em] text-white/35">{c.label}</div>
            <div className="mt-0.5 text-[13px] font-bold tabular-nums" style={{ color: c.c }}>
              {Math.round(c.v).toLocaleString("en-US")}°C
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InfoPanel({ body, onClose, simDaysRef, bottomOffset }: InfoPanelProps) {
  const [eph, setEph] = useState({ M: "0.0", nu: "0.0", rAU: "0.00", pct: "0.0", clock: fmtSim(0) });

  useEffect(() => {
    const id = window.setInterval(() => {
      const sim = simDaysRef.current ?? 0;
      if (body.isStar) {
        setEph((e) => ({ ...e, clock: fmtSim(sim) }));
        return;
      }
      const M = ((sim % body.periodDays) / body.periodDays) * 360;
      const E = solveKepler((M * Math.PI) / 180, body.eccentricity ?? 0);
      const rRel = 1 - (body.eccentricity ?? 0) * Math.cos(E);
      let nu = (nuFromE(E, body.eccentricity ?? 0) * 180) / Math.PI;
      if (nu < 0) nu += 360;
      setEph({
        M: M.toFixed(1),
        nu: nu.toFixed(1),
        rAU: (body.distanceAU * rRel).toFixed(3),
        pct: M.toFixed(1),
        clock: fmtSim(sim),
      });
    }, 120);
    return () => window.clearInterval(id);
  }, [body, simDaysRef]);

  const isStar = !!body.isStar;
  const sizeFrac = Math.pow(body.diameterKm / 139820, 0.5);
  /* effective habitable-zone edges — a zone can never begin inside the
     Roche limit, where no self-gravitating world could survive */
  const hzRaw = habitableZone(body.luminositySolar ?? 1);
  const hzInner = Math.max(hzRaw[0], (body.rocheAU ?? 0) * 1.02);
  const hzOuter = Math.max(hzRaw[1], hzInner + (body.rocheAU ?? 0) * 0.05 + 1e-4);
  const hzClipped = hzInner > hzRaw[0] + 1e-9;

  return (
    <aside
      className="panel-scroll absolute inset-x-0 z-30 max-h-[52dvh] overflow-y-scroll overscroll-y-contain border-t bg-[#070c18]/94 backdrop-blur-sm md:top-0 md:right-0 md:left-auto md:max-h-none md:w-[392px] md:border-l md:border-t-0"
      style={
        {
          animation: "sheetin .45s cubic-bezier(.2,.8,.25,1) both",
          bottom: bottomOffset,
          "--panel-accent": body.colorSoft,
        } as CSSProperties
      }
      aria-label={`Details for ${body.name}`}
    >
      {/* pinned edge fades — hint at scrollable depth above and below */}
      <div className="pointer-events-none sticky top-0 z-20 -mb-7 h-7 bg-gradient-to-b from-[#070c18] via-[#070c18]/80 to-transparent" />
      <div className="px-5 pb-20 pt-5 md:px-6 md:pb-24" style={{ animation: "rise .5s .08s cubic-bezier(.2,.8,.25,1) both" }}>
        {/* header */}
        <div className="flex items-start gap-4">
          <div
            className="relative h-12 w-12 shrink-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 32% 30%, ${body.colorSoft}, ${body.color} 52%, ${body.colorDark})`,
              boxShadow: `0 0 22px ${body.glow}`,
            }}
          >
            <span className="absolute -inset-1.5 rounded-full border border-dashed border-white/25" style={{ animation: "spin 12s linear infinite" }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] tracking-[0.3em] text-white/40">
              SCAN COMPLETE · {body.designation.toUpperCase()}
            </p>
            <h2 className="font-display mt-0.5 truncate text-[26px] font-black leading-none" style={{ color: body.colorSoft }}>
              {body.name.toUpperCase()}
            </h2>
            <p className="mt-1 text-[10px] tracking-[0.2em] text-white/55">{body.type.toUpperCase()}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="rounded border border-white/12 p-1.5 text-white/50 transition-colors duration-200 hover:border-white/40 hover:text-white"
          >
            <CloseIcon />
          </button>
        </div>

        {isStar ? (
          /* ================= STAR — single readout ================= */
          <>
            <div className="mt-5 border border-white/8 bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[8px] tracking-[0.25em] text-white/40">MISSION CLOCK</span>
                <span className="text-[11px] tabular-nums" style={{ color: body.colorSoft }}>
                  {eph.clock}
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Stat label="DIAMETER" value={`${body.diameterKm.toLocaleString("en-US")} km`} accent={body.colorSoft} />
              <Stat label="MASS" value={`${(body.massSolar ?? 1).toFixed(2)} M☉`} />
              <Stat label="LUMINOSITY" value={`${(body.luminositySolar ?? 1).toFixed(2)} L☉`} />
              <Stat label="SURFACE TEMP" value={body.tempLabel} />
              <Stat label="ROTATION" value={body.dayLength} />
              <Stat label="STELLAR RADIUS" value={`${(body.radiusSolar ?? 1).toFixed(2)} R☉`} />
              <Stat label="AGE" value={body.ageLabel ?? "—"} />
              <Stat
                label="ROCHE LIMIT"
                value={
                  body.rocheAU != null
                    ? `${body.rocheAU.toFixed(4)} AU · ${(body.rocheAU / ((body.radiusSolar ?? 1) * SUN_RADIUS_AU)).toFixed(1)} R★`
                    : "—"
                }
                accent="#ff9d8a"
              />
              <Stat
                label="HABITABLE ZONE · INNER EDGE"
                value={`${hzInner.toFixed(2)} AU`}
                sub={hzClipped ? "CLIPPED AT ROCHE LIMIT" : "RUNAWAY-GREENHOUSE LIMIT"}
                accent="#50dc8c"
              />
              <Stat
                label="HABITABLE ZONE · OUTER EDGE"
                value={`${hzOuter.toFixed(2)} AU`}
                sub="MAXIMUM-GREENHOUSE LIMIT"
                accent="#50dc8c"
              />
              <Stat label="WORLDS" value={String(body.worlds ?? 0)} accent={body.colorSoft} />
              <Stat label="CLASS" value={body.type.split(" ")[0]} />
            </div>
            <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
              <Meter label="STELLAR MASS · SUN = 1" value={`${(body.massSolar ?? 1).toFixed(2)}×`} frac={(body.massSolar ?? 1) / 3} color={body.color} />
              <Meter label="LUMINOSITY · LOG SCALE" value={`${(body.luminositySolar ?? 1).toFixed(2)} L☉`} frac={Math.log10(1 + (body.luminositySolar ?? 1)) / 2} color={body.color} />
              <Meter label="DIAMETER VS SUN" value={`${(body.diameterKm / 1392700).toFixed(2)}× Sun`} frac={sizeFrac} color={body.color} />
            </div>
          </>
        ) : (
          /* ================= PLANET — two sections ================= */
          <>
            {/* ---------- 1 · ORBITAL CHARACTERISTICS ---------- */}
            <SectionHead icon={<OrbitIcon />} title="ORBITAL CHARACTERISTICS" count={11} accent={body.color} />

            {/* live ephemeris */}
            <div className="mt-3 border border-white/8 bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[8px] tracking-[0.25em] text-white/40">LIVE EPHEMERIS · MEAN ANOMALY</span>
                <span className="text-[11px] tabular-nums" style={{ color: body.colorSoft }}>
                  {eph.M}° · {eph.clock}
                </span>
              </div>
              <div className="mt-1.5 h-[3px] overflow-hidden bg-white/8">
                <div
                  className="h-full"
                  style={{
                    width: `${eph.pct}%`,
                    background: body.color,
                    boxShadow: `0 0 8px ${body.glow}`,
                    transition: "width .12s linear",
                  }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[9px] tabular-nums text-white/45">
                <span>ν TRUE ANOM · {eph.nu}°</span>
                <span>r = {eph.rAU} AU</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label="SEMI-MAJOR AXIS · a" value={`${body.distanceAU.toFixed(3)} AU`} sub={body.distanceLabel} accent={body.colorSoft} />
              <Stat label="ECCENTRICITY · e" value={(body.eccentricity ?? 0).toFixed(4)} sub="0 = CIRCLE" />
              <Stat label="PERIAPSIS · q" value={`${(body.periapsisAU ?? 0).toFixed(3)} AU`} sub={auKm(body.periapsisAU ?? 0)} />
              <Stat label="APOAPSIS · Q" value={`${(body.apoapsisAU ?? 0).toFixed(3)} AU`} sub={auKm(body.apoapsisAU ?? 0)} />
              <Stat label="ORBITAL PERIOD" value={body.periodLabel} sub={`${Math.round(body.periodDays).toLocaleString("en-US")} d`} />
              <Stat label="INCLINATION · i" value={`${(body.inclinationDeg ?? 0).toFixed(2)}°`} sub="TO REF. PLANE" />
              <Stat label="ASC. NODE · Ω" value={`${(body.lonAscNodeDeg ?? 0).toFixed(1)}°`} sub="LONG. OF ASC. NODE" />
              <Stat label="ARG. PERIHELION · ω" value={`${(body.argPeriDeg ?? 0).toFixed(1)}°`} sub="FROM ASC. NODE" />
            </div>

            <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
              <Meter label="SEMI-MAJOR AXIS · √ SCALE" value={`${body.distanceAU.toFixed(2)} AU`} frac={Math.sqrt(body.distanceAU) / Math.sqrt(30)} color={body.color} />
              <Meter label="YEAR LENGTH" value={body.periodLabel} frac={Math.pow(body.periodDays / 60190, 0.35)} color={body.color} />
              <Meter
                label="TIDAL SAFETY · DISRUPTION = 1"
                value={`×${Math.round(body.rocheMargin ?? 0)} ROCHE`}
                frac={Math.min(1, Math.log10(Math.max(1.5, body.rocheMargin ?? 1)) / 2.6)}
                color="#ff8a7a"
              />
            </div>

            {/* ---------- 2 · PHYSICAL CHARACTERISTICS ---------- */}
            <SectionHead icon={<BodyIcon />} title="PHYSICAL CHARACTERISTICS" count={20} accent={body.colorSoft} />

            {/* mass anchors the section — full width, at the very top */}
            <div className="mt-3">
              <MassBlock body={body} />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <Stat label="MEAN RADIUS" value={fmtKm(body.meanRadiusKm ?? 0)} sub={`POLAR ${fmtKm(body.polarRadiusKm ?? 0)}`} accent={body.colorSoft} />
              <Stat label="EQUATORIAL RADIUS" value={fmtKm(body.eqRadiusKm ?? 0)} sub="AT EQUATOR" />
              <Stat label="FLATTENING" value={(body.flattening ?? 0).toFixed(5)} sub="f = (Re−Rp) / Re" />
              <Stat label="CIRCUMFERENCE" value={fmtKm(body.circumferenceKm ?? 0)} sub="EQUATORIAL" />
              <Stat label="SURFACE AREA" value={`${sci(body.surfaceAreaKm2 ?? 0)} km²`} sub={`${((body.surfaceAreaKm2 ?? 0) / 5.101e8).toFixed(2)}× EARTH`} />
              <Stat label="VOLUME" value={`${sci(body.volumeKm3 ?? 0)} km³`} sub={`${((body.volumeKm3 ?? 0) / V_EARTH_KM3).toFixed(2)} V⊕`} />
              <Stat label="MEAN DENSITY" value={`${(body.densityGcc ?? 0).toFixed(2)} g/cm³`} sub="WATER = 1.00" />
              <Stat label="SURFACE GRAVITY" value={`${(body.surfaceGravity ?? 0).toFixed(2)} m/s²`} sub={`${((body.surfaceGravity ?? 0) / 9.807).toFixed(2)} g⊕`} />
              <Stat label="MOMENT OF INERTIA" value={(body.moiFactor ?? 0).toFixed(4)} sub="C/MR² · SPHERE = 0.4" />
              <Stat
                label="SIDEREAL ROTATION"
                value={body.locked ? "Locked" : `${(body.rotationHours ?? 0).toFixed(1)} h`}
                sub={body.locked ? `SYNCHRONOUS · ${((body.rotationHours ?? 0) / 24).toFixed(1)} d` : "SIDEREAL DAY"}
              />
              <Stat
                label="EQUAT. ROT. VELOCITY"
                value={`${Math.round(((2 * Math.PI * (body.eqRadiusKm ?? 0)) / (body.rotationHours ?? 1))).toLocaleString("en-US")} km/h`}
                sub="AT EQUATOR"
              />
              <Stat label="AXIAL TILT" value={`${(body.axialTiltDeg ?? 0).toFixed(1)}°`} sub="OBLIQUITY" />
              <Stat label="ALBEDO · BOND" value={(body.albedo ?? 0).toFixed(2)} sub={`GEOMETRIC ${(body.geoAlbedo ?? 0).toFixed(2)}`} />
              <Stat label="BLACKBODY TEMP" value={`${body.blackbodyK ?? 0} K`} sub="EQUILIBRIUM" />

              <TempRow body={body} />

              <Stat label="ABSOLUTE MAGNITUDE" value={(body.absoluteMag ?? 0).toFixed(2)} sub="V-BAND · H" accent={body.colorSoft} />
              <Stat label="MOONS" value={body.moons} sub="CONFIRMED" />
            </div>

            <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
              <Meter label="DIAMETER VS LARGEST KNOWN" value={`${(body.diameterKm / 139820).toFixed(2)}× Jupiter`} frac={sizeFrac} color={body.color} />
              <Meter label="SURFACE GRAVITY · EARTH = 1" value={`${((body.surfaceGravity ?? 0) / 9.807).toFixed(2)} g`} frac={Math.min(1, (body.surfaceGravity ?? 0) / 9.807 / 3)} color={body.color} />
              <Meter label="MEAN DENSITY · WATER = 1" value={`${(body.densityGcc ?? 0).toFixed(2)} g/cm³`} frac={Math.min(1, (body.densityGcc ?? 0) / 6)} color={body.color} />
            </div>

            {/* ---------- 3 · ATMOSPHERE ---------- */}
            <AtmoSection body={body} />
          </>
        )}

        {/* field note */}
        <div className="mt-5 border-l-2 py-1 pl-3" style={{ borderColor: body.color }}>
          <p className="text-[9px] tracking-[0.25em] text-white/40">FIELD NOTE</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-white/75">{body.fact}</p>
        </div>

        <p className="mt-4 text-[8px] leading-relaxed tracking-[0.2em] text-white/25">
          KEPLER III · P² = a³/M★ · T★ FROM L★ &amp; ALBEDO · POSITIONS SOLVED VIA M→E→ν ·
          ALL PERIAPSES CLEAR THE ROCHE LIMIT d = 2.44·R★·(ρ★/ρp)^⅓ BY ≥3×
        </p>
      </div>
      <div className="pointer-events-none sticky bottom-0 z-20 -mt-7 h-7 bg-gradient-to-t from-[#070c18] via-[#070c18]/80 to-transparent" />
    </aside>
  );
}

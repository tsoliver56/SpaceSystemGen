import { useEffect, useState, type RefObject } from "react";
import { fmtSim, SUN_RADIUS_AU, type Body } from "../lib/generator";
import { DEG, keplerState } from "../lib/kepler";

interface InfoPanelProps {
  body: Body;
  onClose: () => void;
  simDaysRef: RefObject<number>;
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="border border-white/8 bg-white/[0.025] px-3 py-2.5 transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.05]">
      <div className="text-[8px] tracking-[0.22em] text-white/40">{label}</div>
      <div className="mt-1 text-[13px] font-bold tabular-nums" style={{ color: accent ?? "#f2f6ff" }}>
        {value}
      </div>
    </div>
  );
}

/** compact Keplerian-element cell: big symbol + value + caption */
function Elem({
  sym,
  value,
  label,
  accent,
}: {
  sym: string;
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <div className="border border-white/8 bg-white/[0.02] px-2.5 py-2 transition-colors duration-200 hover:border-white/25 hover:bg-white/[0.05]">
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-[13px] font-bold leading-none" style={{ color: accent }}>
          {sym}
        </span>
        <span className="text-[11px] font-bold tabular-nums text-white/90">{value}</span>
      </div>
      <div className="mt-1 text-[7.5px] tracking-[0.18em] text-white/38">{label}</div>
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

interface Live {
  m: string;
  nu: string;
  r: string;
  pct: string;
  clock: string;
}

export default function InfoPanel({ body, onClose, simDaysRef }: InfoPanelProps) {
  const [live, setLive] = useState<Live>({
    m: "0.0",
    nu: "0.0",
    r: "0.000",
    pct: "0.0",
    clock: fmtSim(0),
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      const sim = simDaysRef.current ?? 0;
      if (body.isStar) {
        setLive({ m: "0", nu: "0", r: "0", pct: "0", clock: fmtSim(sim) });
        return;
      }
      const mDeg =
        ((body.startAngle + (360 * sim) / body.periodDays) % 360 + 360) % 360;
      const st = keplerState(
        body.distanceAU,
        body.eccentricity ?? 0,
        mDeg * DEG
      );
      const nuDeg = ((st.nu / DEG) % 360 + 360) % 360;
      setLive({
        m: mDeg.toFixed(1),
        nu: nuDeg.toFixed(1),
        r: st.rAU.toFixed(3),
        pct: ((mDeg / 360) * 100).toFixed(1),
        clock: fmtSim(sim),
      });
    }, 120);
    return () => window.clearInterval(id);
  }, [body, simDaysRef]);

  const isStar = !!body.isStar;
  const sizeFrac = Math.pow(body.diameterKm / 139820, 0.5);
  const distFrac = isStar ? 1 : Math.sqrt(body.distanceAU) / Math.sqrt(30);
  const periodFrac = isStar ? 1 : Math.pow(body.periodDays / 60190, 0.35);

  return (
    <aside
      className="absolute inset-x-0 bottom-[60px] z-30 max-h-[52dvh] overflow-y-auto border-t bg-[#070c18]/94 backdrop-blur-sm md:inset-y-0 md:bottom-auto md:right-0 md:left-auto md:max-h-none md:w-[376px] md:border-l md:border-t-0"
      style={{ animation: "sheetin .45s cubic-bezier(.2,.8,.25,1) both" }}
      aria-label={`Details for ${body.name}`}
    >
      <div className="px-5 pb-7 pt-5 md:px-6" style={{ animation: "rise .5s .08s cubic-bezier(.2,.8,.25,1) both" }}>
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

        {/* live ephemeris */}
        <div className="mt-5 border border-white/8 bg-white/[0.02] px-3 py-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[8px] tracking-[0.25em] text-white/40">
              {isStar ? "MISSION CLOCK" : "LIVE EPHEMERIS"}
            </span>
            <span className="text-[10px] tabular-nums text-white/50">{live.clock}</span>
          </div>
          {!isStar && (
            <>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[7.5px] tracking-[0.18em] text-white/38">MEAN ANOM. M</div>
                  <div className="text-[13px] font-bold tabular-nums" style={{ color: body.colorSoft }}>
                    {live.m}°
                  </div>
                </div>
                <div>
                  <div className="text-[7.5px] tracking-[0.18em] text-white/38">TRUE ANOM. ν</div>
                  <div className="text-[13px] font-bold tabular-nums text-white/85">{live.nu}°</div>
                </div>
                <div>
                  <div className="text-[7.5px] tracking-[0.18em] text-white/38">DISTANCE r</div>
                  <div className="text-[13px] font-bold tabular-nums text-white/85">{live.r} AU</div>
                </div>
              </div>
              <div className="mt-2 h-[3px] overflow-hidden bg-white/8">
                <div
                  className="h-full"
                  style={{
                    width: `${live.pct}%`,
                    background: body.color,
                    boxShadow: `0 0 8px ${body.glow}`,
                    transition: "width .12s linear",
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* physical stats */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="DIAMETER" value={`${body.diameterKm.toLocaleString("en-US")} km`} accent={body.colorSoft} />
          {isStar ? (
            <>
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
                    ? `${body.rocheAU.toFixed(4)} AU · ${(
                        body.rocheAU /
                        ((body.radiusSolar ?? 1) * SUN_RADIUS_AU)
                      ).toFixed(1)} R★`
                    : "—"
                }
                accent="#ff9d8a"
              />
              <Stat label="WORLDS" value={String(body.worlds ?? 0)} accent={body.colorSoft} />
              <Stat label="CLASS" value={body.type.split(" ")[0]} />
            </>
          ) : (
            <>
              <Stat label="DAY LENGTH" value={body.dayLength} />
              <Stat label="MOONS" value={body.moons} />
              <Stat label="MEAN TEMP" value={body.tempLabel} />
              <Stat label="ORBIT VELOCITY" value={`${body.speedKmS.toFixed(1)} km/s`} />
              <Stat label="MEAN DENSITY" value={`${(body.densityGcc ?? 0).toFixed(1)} g/cm³`} />
              <Stat
                label="ROCHE MARGIN"
                value={`×${Math.round(body.rocheMargin ?? 0)} the limit`}
                accent="#9be8a8"
              />
              <Stat label="ORBIT NO." value={body.orderLabel ?? "—"} />
            </>
          )}
        </div>

        {/* keplerian elements */}
        {!isStar && (
          <div className="mt-4 border border-white/8 bg-white/[0.015] p-3">
            <p className="text-[8px] tracking-[0.28em] text-white/40">
              KEPLERIAN ELEMENTS · OSCULATING
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <Elem sym="a" value={`${body.distanceAU.toFixed(3)}`} label="SEMI-MAJ. AXIS AU" accent={body.color} />
              <Elem sym="e" value={`${(body.eccentricity ?? 0).toFixed(3)}`} label="ECCENTRICITY" accent={body.color} />
              <Elem sym="P" value={body.periodLabel} label="ORBITAL PERIOD" accent={body.color} />
              <Elem sym="q" value={`${(body.periapsisAU ?? 0).toFixed(3)}`} label="PERIAPSIS AU" accent="#ffd28a" />
              <Elem sym="Q" value={`${(body.apoapsisAU ?? 0).toFixed(3)}`} label="APOAPSIS AU" accent="#a8c6ff" />
              <Elem sym="i" value={`${(body.inclinationDeg ?? 0).toFixed(1)}°`} label="INCLINATION" accent={body.color} />
              <Elem sym="Ω" value={`${(body.lonAscNodeDeg ?? 0).toFixed(1)}°`} label="ASC. NODE LONG." accent={body.color} />
              <Elem sym="ω" value={`${(body.argPeriDeg ?? 0).toFixed(1)}°`} label="ARG. PERIHELION" accent={body.color} />
              <Elem sym="M₀" value={`${body.startAngle}°`} label="ANOMALY AT EPOCH" accent={body.color} />
            </div>
          </div>
        )}

        {/* comparison meters */}
        <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
          {isStar ? (
            <>
              <Meter label="STELLAR MASS · SUN = 1" value={`${(body.massSolar ?? 1).toFixed(2)}×`} frac={(body.massSolar ?? 1) / 3} color={body.color} />
              <Meter label="LUMINOSITY · LOG SCALE" value={`${(body.luminositySolar ?? 1).toFixed(2)} L☉`} frac={Math.log10(1 + (body.luminositySolar ?? 1)) / 2} color={body.color} />
              <Meter label="DIAMETER VS LARGEST KNOWN" value={`${(body.diameterKm / 1392700).toFixed(2)}× Sun`} frac={sizeFrac} color={body.color} />
            </>
          ) : (
            <>
              <Meter label="DIAMETER VS LARGEST KNOWN" value={`${(body.diameterKm / 139820).toFixed(2)}× Jupiter`} frac={sizeFrac} color={body.color} />
              <Meter label="SEMI-MAJOR AXIS · √ SCALE" value={`${body.distanceAU.toFixed(2)} AU`} frac={distFrac} color={body.color} />
              <Meter label="YEAR LENGTH · NEPTUNE = 1" value={body.periodLabel} frac={periodFrac} color={body.color} />
              <Meter
                label="ECCENTRICITY · e = 0.3 MAX"
                value={`e = ${(body.eccentricity ?? 0).toFixed(3)}`}
                frac={(body.eccentricity ?? 0) / 0.3}
                color="#ffd28a"
              />
              <Meter
                label="TIDAL SAFETY · DISRUPTION = 1"
                value={`×${Math.round(body.rocheMargin ?? 0)}`}
                frac={Math.min(1, Math.log10(Math.max(1.5, body.rocheMargin ?? 1)) / 2.6)}
                color="#ff8a7a"
              />
            </>
          )}
        </div>

        {/* field note */}
        <div className="mt-4 border-l-2 py-1 pl-3" style={{ borderColor: body.color }}>
          <p className="text-[9px] tracking-[0.25em] text-white/40">FIELD NOTE</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-white/75">{body.fact}</p>
        </div>

        <p className="mt-4 text-[8px] leading-relaxed tracking-[0.2em] text-white/25">
          MOTION SOLVES KEPLER'S EQUATION M = E − e·sinE · P² = a³/M★ · PERIAPSES
          CLEAR THE ROCHE LIMIT d = 2.44·R★·(ρ★/ρp)^⅓ BY ≥3×
        </p>
      </div>
    </aside>
  );
}

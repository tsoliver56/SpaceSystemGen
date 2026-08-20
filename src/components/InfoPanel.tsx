import { useEffect, useState, type MutableRefObject } from "react";
import { fmtKm, MAX_AU, type CelestialBody } from "../data/bodies";

interface InfoPanelProps {
  body: CelestialBody;
  onClose: () => void;
  simDaysRef: MutableRefObject<number>;
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-white/8 bg-white/[0.03] px-2.5 py-2">
    <p className="text-[8px] tracking-[0.22em] text-white/35">{label}</p>
    <p className="mt-0.5 text-[12px] font-bold leading-tight text-white/90">{value}</p>
  </div>
);

const Bar = ({
  label,
  display,
  pct,
  color,
  armed,
}: {
  label: string;
  display: string;
  pct: number;
  color: string;
  armed: boolean;
}) => (
  <div>
    <div className="flex items-baseline justify-between">
      <span className="text-[8px] tracking-[0.22em] text-white/40">{label}</span>
      <span className="text-[10px] tabular-nums text-white/70">{display}</span>
    </div>
    <div className="mt-1 h-1 w-full bg-white/8">
      <div
        className="h-full transition-[width] duration-700 ease-out"
        style={{
          width: armed ? `${Math.max(2, Math.min(100, pct))}%` : "0%",
          background: color,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
    </div>
  </div>
);

export default function InfoPanel({ body, onClose, simDaysRef }: InfoPanelProps) {
  const [, forceTick] = useState(0);
  const [armed, setArmed] = useState(false);

  // live readout while the simulation runs
  useEffect(() => {
    const id = window.setInterval(() => forceTick((x) => x + 1), 150);
    return () => window.clearInterval(id);
  }, []);

  // animate bars in on each new body
  useEffect(() => {
    setArmed(false);
    const t = window.setTimeout(() => setArmed(true), 80);
    return () => window.clearTimeout(t);
  }, [body.id]);

  const phasePeriod = body.isStar ? 25.4 : body.periodDays;
  const sim = simDaysRef.current;
  const dayInPhase = ((sim % phasePeriod) + phasePeriod) % phasePeriod;
  const phasePct = (dayInPhase / phasePeriod) * 100;

  const sizePct = Math.pow(body.diameterKm / 139820, 0.42) * 100;
  const distPct = body.isStar ? 0 : Math.pow(body.distanceAU / MAX_AU, 0.5) * 100;
  const velPct = (body.speedKmS / 47.4) * 100;

  return (
    <aside
      role="dialog"
      aria-label={`${body.name} details`}
      className="scroll-slim fixed inset-x-2 bottom-2 z-50 max-h-[52dvh] overflow-y-auto border border-white/12 bg-panel/97 shadow-[0_20px_60px_rgba(0,0,0,0.6)] md:absolute md:inset-x-auto md:bottom-[76px] md:right-3 md:top-[70px] md:z-40 md:max-h-none md:w-[330px]"
      style={{ animation: "sheetin .35s cubic-bezier(.2,.9,.3,1) both" }}
    >
      <div className="h-[3px] w-full" style={{ background: body.color }} />

      <div className="p-4">
        {/* header */}
        <div className="flex items-start gap-3.5">
          <div className="relative h-[68px] w-[68px] shrink-0">
            {body.rings && (
              <span
                className="absolute left-1/2 top-1/2 rounded-[50%]"
                style={{
                  width: 64,
                  height: 64,
                  border: "2px solid rgba(235,205,140,0.75)",
                  transform: "translate(-50%,-50%) rotate(-16deg) scaleY(0.32)",
                }}
              />
            )}
            <span
              className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
              style={{
                width: body.isStar ? 56 : 44,
                height: body.isStar ? 56 : 44,
                background: `radial-gradient(circle at 32% 30%, ${body.colorSoft} 0%, ${body.color} 48%, ${body.colorDark} 100%)`,
                boxShadow: `0 0 22px ${body.glow}`,
              }}
            >
              {body.bands && (
                <span
                  className="absolute inset-0 opacity-50"
                  style={{
                    background:
                      "repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0 3px, rgba(255,255,255,0.10) 3px 4px, transparent 4px 8px)",
                    animation: "bandflow 10s linear infinite",
                  }}
                />
              )}
            </span>
            {body.isStar && (
              <span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  width: 66,
                  height: 66,
                  background: "radial-gradient(circle, rgba(255,190,80,0.35), transparent 70%)",
                  animation: "blink 3s ease-in-out infinite",
                }}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[9px] tracking-[0.3em]" style={{ color: body.color }}>
              SCAN COMPLETE
            </p>
            <h2 className="font-display text-[24px] font-black uppercase leading-none tracking-[0.06em] text-white">
              {body.name}
            </h2>
            <p className="mt-1.5 inline-block border border-white/15 px-1.5 py-0.5 text-[9px] tracking-[0.2em] text-white/55">
              {body.type.toUpperCase()}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close details"
            className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/12 text-white/45 transition-colors duration-150 hover:border-white/40 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* live phase */}
        <div className="mt-4 border border-white/8 bg-white/[0.03] px-3 py-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[8px] tracking-[0.22em] text-white/40">
              {body.isStar ? "ROTATION PHASE · LIVE" : "ORBIT PHASE · LIVE"}
            </span>
            <span className="text-[10px] tabular-nums text-white/70">
              day {Math.floor(dayInPhase)} / {body.isStar ? "25.4" : Math.round(body.periodDays).toLocaleString("en-US")}
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full bg-white/8">
            <div
              className="h-full"
              style={{
                width: `${phasePct}%`,
                background: body.color,
                boxShadow: `0 0 8px ${body.color}`,
                transition: "width .15s linear",
              }}
            />
          </div>
        </div>

        {/* stats */}
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <Stat label="DIAMETER" value={fmtKm(body.diameterKm)} />
          <Stat label="DISTANCE FROM SUN" value={body.distanceLabel} />
          <Stat label="ORBITAL PERIOD" value={body.periodLabel} />
          <Stat label="DAY LENGTH" value={body.dayLength} />
          <Stat label="MOONS" value={body.moons} />
          <Stat label="TEMPERATURE" value={body.tempLabel} />
        </div>

        {/* comparison bars */}
        <div className="mt-4 space-y-2.5">
          <Bar label="SIZE · VS JUPITER" display={fmtKm(body.diameterKm)} pct={sizePct} color={body.color} armed={armed} />
          <Bar
            label="DISTANCE · VS NEPTUNE"
            display={body.isStar ? "0 AU" : `${body.distanceAU} AU`}
            pct={distPct}
            color="#6fb1ff"
            armed={armed}
          />
          <Bar
            label="ORBITAL VELOCITY · VS MERCURY"
            display={body.isStar ? "—" : `${body.speedKmS.toFixed(1)} km/s`}
            pct={velPct}
            color="#ffc45e"
            armed={armed}
          />
        </div>

        {/* field note */}
        <div className="mt-4 border-l-2 bg-white/[0.03] px-3 py-2.5" style={{ borderColor: body.color }}>
          <p className="text-[8px] tracking-[0.25em] text-white/40">FIELD NOTE</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-white/75">{body.fact}</p>
        </div>
      </div>
    </aside>
  );
}

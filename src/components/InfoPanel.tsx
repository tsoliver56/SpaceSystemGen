import { useEffect, useState, type RefObject } from "react";
import { fmtSim, type Body } from "../lib/generator";

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

export default function InfoPanel({ body, onClose, simDaysRef }: InfoPanelProps) {
  const [phase, setPhase] = useState<{ pct: string; clock: string }>({ pct: "0.0", clock: fmtSim(0) });

  useEffect(() => {
    const id = window.setInterval(() => {
      const sim = simDaysRef.current ?? 0;
      const pct = body.isStar ? 0 : ((sim % body.periodDays) / body.periodDays) * 100;
      setPhase({ pct: pct.toFixed(1), clock: fmtSim(sim) });
    }, 120);
    return () => window.clearInterval(id);
  }, [body, simDaysRef]);

  const isStar = !!body.isStar;
  const sizeFrac = Math.pow(body.diameterKm / 139820, 0.5);
  const distFrac = isStar ? 1 : Math.sqrt(body.distanceAU) / Math.sqrt(40);
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

        {/* live orbital phase */}
        <div className="mt-5 border border-white/8 bg-white/[0.02] px-3 py-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[8px] tracking-[0.25em] text-white/40">
              {isStar ? "MISSION CLOCK" : "ORBITAL PHASE"}
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: body.colorSoft }}>
              {isStar ? phase.clock : `${phase.pct}% · ${phase.clock}`}
            </span>
          </div>
          {!isStar && (
            <div className="mt-1.5 h-[3px] overflow-hidden bg-white/8">
              <div
                className="h-full"
                style={{
                  width: `${phase.pct}%`,
                  background: body.color,
                  boxShadow: `0 0 8px ${body.glow}`,
                  transition: "width .12s linear",
                }}
              />
            </div>
          )}
        </div>

        {/* stats */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="DIAMETER" value={`${body.diameterKm.toLocaleString("en-US")} km`} accent={body.colorSoft} />
          {isStar ? (
            <>
              <Stat label="MASS" value={`${(body.massSolar ?? 1).toFixed(2)} M☉`} />
              <Stat label="LUMINOSITY" value={`${(body.luminositySolar ?? 1).toFixed(2)} L☉`} />
              <Stat label="SURFACE TEMP" value={body.tempLabel} />
              <Stat label="ROTATION" value={body.dayLength} />
              <Stat label="AGE" value={body.ageLabel ?? "—"} />
              <Stat label="WORLDS" value={String(body.worlds ?? 0)} accent={body.colorSoft} />
              <Stat label="CLASS" value={body.type.split(" ")[0]} />
            </>
          ) : (
            <>
              <Stat label="DIST. FROM STAR" value={body.distanceLabel} accent={body.colorSoft} />
              <Stat label="ORBITAL PERIOD" value={body.periodLabel} />
              <Stat label="DAY LENGTH" value={body.dayLength} />
              <Stat label="MOONS" value={body.moons} />
              <Stat label="MEAN TEMP" value={body.tempLabel} />
              <Stat label="ORBIT VELOCITY" value={`${body.speedKmS.toFixed(1)} km/s`} />
              <Stat label="ORBIT NO." value={body.orderLabel ?? "—"} />
            </>
          )}
        </div>

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
              <Meter label="DISTANCE · √ SCALE" value={`${body.distanceAU.toFixed(2)} AU`} frac={distFrac} color={body.color} />
              <Meter label="YEAR LENGTH · NEPTUNE = 1" value={body.periodLabel} frac={periodFrac} color={body.color} />
            </>
          )}
        </div>

        {/* field note */}
        <div className="mt-4 border-l-2 py-1 pl-3" style={{ borderColor: body.color }}>
          <p className="text-[9px] tracking-[0.25em] text-white/40">FIELD NOTE</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-white/75">{body.fact}</p>
        </div>

        <p className="mt-4 text-[8px] tracking-[0.2em] text-white/25">
          PERIODS VIA KEPLER III · P² = a³/M★ · TEMPS FROM STELLAR LUMINOSITY
        </p>
      </div>
    </aside>
  );
}

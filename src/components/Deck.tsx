import {
  BASE_DAYS_PER_SEC,
  BODIES,
  SPEED_OPTIONS,
  type CelestialBody,
} from "../data/bodies";

interface DeckProps {
  playing: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  speed: number;
  onSpeed: (m: number) => void;
  zoom: number;
  onZoom: (z: number) => void;
  selected: CelestialBody | null;
  onSelect: (b: CelestialBody) => void;
  clock: string;
}

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d="M8 5.4v13.2c0 .8.9 1.3 1.6.9l10.2-6.6c.6-.4.6-1.4 0-1.8L9.6 4.5c-.7-.4-1.6.1-1.6.9z" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <rect x="6.5" y="5" width="3.6" height="14" rx="1" />
    <rect x="13.9" y="5" width="3.6" height="14" rx="1" />
  </svg>
);

const ResetIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

export default function Deck({
  playing,
  onTogglePlay,
  onReset,
  speed,
  onSpeed,
  zoom,
  onZoom,
  selected,
  onSelect,
  clock,
}: DeckProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#060a17]/92 backdrop-blur-[2px]">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 md:px-6">
        {/* transport */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onTogglePlay}
            aria-label={playing ? "Pause simulation" : "Play simulation"}
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-200 active:scale-90 ${
              playing
                ? "border-solar/60 bg-solar/15 text-solar shadow-[0_0_18px_rgba(255,196,94,0.25)] hover:bg-solar/25"
                : "border-terra/60 bg-terra/10 text-terra shadow-[0_0_18px_rgba(111,177,255,0.2)] hover:bg-terra/20"
            }`}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            onClick={onReset}
            aria-label="Reset simulation clock"
            title="Reset to T+0"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/50 transition-all duration-200 hover:rotate-[-40deg] hover:border-white/40 hover:text-white active:scale-90"
          >
            <ResetIcon />
          </button>
          <span className="hidden text-[11px] tabular-nums tracking-wider text-white/50 sm:block">
            {clock}
          </span>
        </div>

        {/* speed */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] tracking-[0.25em] text-white/35">RATE</span>
          <div className="flex overflow-hidden rounded border border-white/12">
            {SPEED_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => onSpeed(m)}
                className={`px-2.5 py-1 text-[11px] tabular-nums transition-colors duration-150 ${
                  speed === m
                    ? "bg-white/12 font-bold text-white"
                    : "text-white/40 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                {m}×
              </button>
            ))}
          </div>
          <span className="hidden text-[9px] tabular-nums tracking-widest text-white/30 lg:block">
            {(BASE_DAYS_PER_SEC * speed).toFixed(0)} d/s
          </span>
        </div>

        {/* zoom */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] tracking-[0.25em] text-white/35">ZOOM</span>
          <input
            type="range"
            min={60}
            max={150}
            value={Math.round(zoom * 100)}
            onChange={(e) => onZoom(Number(e.target.value) / 100)}
            className="zoomer w-24 md:w-28"
            aria-label="Zoom orbital view"
          />
          <span className="w-9 text-[10px] tabular-nums text-white/50">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        <p className="hidden text-[9px] tracking-[0.2em] text-white/25 xl:block">
          SIZES &amp; DISTANCES COMPRESSED · PERIODS TRUE RATIO
        </p>

        {/* body selector */}
        <div className="scroll-slim ml-auto flex max-w-full items-center gap-1 overflow-x-auto pb-0.5">
          {BODIES.map((b) => {
            const active = selected?.id === b.id;
            return (
              <button
                key={b.id}
                onClick={() => onSelect(b)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] tracking-[0.15em] transition-all duration-200 ${
                  active
                    ? "border-current bg-white/8 font-bold text-white"
                    : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/90"
                }`}
                style={active ? { borderColor: b.color, color: "#f2f6ff" } : undefined}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: b.color, boxShadow: `0 0 6px ${b.glow}` }}
                />
                {b.name.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

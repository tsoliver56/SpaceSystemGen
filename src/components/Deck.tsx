import { useEffect, useRef, type ReactNode } from "react";
import { SPEED_OPTIONS, type Body } from "../lib/generator";
import type { ViewMode } from "../lib/kepler";

const VIEWS: { id: ViewMode; label: string; icon: ReactNode; hint: string }[] = [
  {
    id: "top",
    label: "TOP",
    hint: "Straight down on the orbital plane",
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "quarter",
    label: "QUARTER",
    hint: "Tilted 45° — depth reads as perspective",
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <ellipse cx="12" cy="12" rx="9" ry="4.6" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "side",
    label: "SIDE",
    hint: "Edge-on — watch worlds transit the star",
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M3.5 12h17" strokeLinecap="round" />
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

interface DeckProps {
  playing: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  speed: number;
  onSpeed: (m: number) => void;
  zoom: number;
  onZoom: (z: number) => void;
  selected: Body | null;
  onSelect: (b: Body) => void;
  clock: string;
  seedLabel: string;
  onRegenerate: () => void;
  bodies: Body[];
  view: ViewMode;
  onView: (v: ViewMode) => void;
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

const DiceIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
    <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 3.5A1.5 1.5 0 1 0 8 9.5 1.5 1.5 0 0 0 8 6.5zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
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
  seedLabel,
  onRegenerate,
  bodies,
  view,
  onView,
}: DeckProps) {
  /* body carousel: the selected chip glides to the middle of the window */
  const listRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const smoothNext = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selected?.id ?? null;

  useEffect(() => {
    smoothNext.current = false; // system swap — recentre without animation
  }, [bodies]);

  /* the glide — fires whenever the selection changes, whatever the source:
     a chip tap, a planet or star click on the chart, the arrow keys, or the
     carousel paddles. The strip carries half-a-window of padding on each
     side, so even the first and last chips can travel to dead centre. */
  useEffect(() => {
    const el = listRef.current;
    const id = selected?.id;
    if (!el || !id) return;
    const chip = chipRefs.current[id];
    if (!chip) return;
    el.scrollTo({
      left: chip.offsetLeft + chip.offsetWidth / 2 - el.clientWidth / 2,
      behavior: smoothNext.current ? "smooth" : "auto",
    });
    smoothNext.current = true;
  }, [selected?.id, bodies]);

  /* resize-only recentre: kept in its own effect so it can never interrupt
     the glide, and it swallows the observer's initial delivery (which is an
     observe, not a resize) */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let armed = false;
    const ro = new ResizeObserver(() => {
      if (!armed) {
        armed = true;
        return;
      }
      const id = selectedIdRef.current;
      const chip = id ? chipRefs.current[id] : null;
      if (!chip) return;
      el.scrollTo({
        left: chip.offsetLeft + chip.offsetWidth / 2 - el.clientWidth / 2,
        behavior: "auto",
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [bodies]);

  const step = (dir: 1 | -1) => {
    if (!bodies.length) return;
    const idx = selected ? bodies.findIndex((b) => b.id === selected.id) : -1;
    onSelect(bodies[(idx + dir + bodies.length) % bodies.length]);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#060a17]/92 backdrop-blur-[2px]">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 md:px-6">
        {/* generate — first, so a fresh system is always one tap away */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onRegenerate}
            title="Generate a new random system (N)"
            className="group flex items-center gap-2 border border-solar/50 bg-solar/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-solar transition-all duration-200 hover:bg-solar/25 hover:shadow-[0_0_18px_rgba(255,196,94,0.3)] active:scale-95"
          >
            <span className="transition-transform duration-500 group-hover:rotate-180">
              <DiceIcon />
            </span>
            NEW SYSTEM
          </button>
          <span className="hidden text-[9px] tabular-nums tracking-widest text-white/30 md:block">
            {seedLabel}
          </span>
        </div>

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
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/50 transition-all duration-200 hover:-rotate-[40deg] hover:border-white/40 hover:text-white active:scale-90"
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
            {speed} d/s
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

        {/* camera view */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] tracking-[0.25em] text-white/35">VIEW</span>
          <div className="flex overflow-hidden rounded border border-white/12" role="group" aria-label="Camera view">
            {VIEWS.map((v) => {
              const active = view === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => onView(v.id)}
                  title={`${v.hint} (V to cycle)`}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.15em] transition-all duration-200 ${
                    active
                      ? "bg-terra/18 font-bold text-terra shadow-[inset_0_0_12px_rgba(111,177,255,0.15)]"
                      : "text-white/40 hover:bg-white/5 hover:text-white/80"
                  }`}
                >
                  {v.icon}
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* body selector */}
        {/* body carousel */}
        <div className="flex w-full items-center gap-2 md:ml-auto md:w-auto">
          <button
            onClick={() => step(-1)}
            aria-label="Previous body"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/12 text-white/45 transition-all duration-200 hover:border-white/35 hover:text-white active:scale-90"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14.5 6l-6 6 6 6" />
            </svg>
          </button>

          <div className="relative min-w-0 flex-1 basis-full md:basis-0 md:max-w-[40rem]">
            {/* edge fades signal more bodies off-window */}
            <span className="pointer-events-none absolute inset-y-0 left-0 z-10 w-9 bg-gradient-to-r from-[#060a17] to-transparent" />
            <span className="pointer-events-none absolute inset-y-0 right-0 z-10 w-9 bg-gradient-to-l from-[#060a17] to-transparent" />
            {/* centre marker the selected chip glides onto */}
            <span className="pointer-events-none absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-white/10" />
            <div
              ref={listRef}
              className="no-scrollbar relative flex items-center gap-1 overflow-x-auto py-1"
              style={{ paddingLeft: "50%", paddingRight: "50%" }}
            >
              {bodies.map((b) => {
                const active = selected?.id === b.id;
                return (
                  <button
                    key={b.id}
                    ref={(el) => {
                      chipRefs.current[b.id] = el;
                    }}
                    onClick={() => onSelect(b)}
                    aria-label={`Select ${b.name}`}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] tracking-[0.15em] transition-all duration-200 ${
                      active
                        ? "scale-105 bg-white/8 font-bold text-white"
                        : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/90"
                    }`}
                    style={
                      active
                        ? { borderColor: b.color, boxShadow: `0 0 12px ${b.glow}` }
                        : undefined
                    }
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

          <button
            onClick={() => step(1)}
            aria-label="Next body"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/12 text-white/45 transition-all duration-200 hover:border-white/35 hover:text-white active:scale-90"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9.5 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

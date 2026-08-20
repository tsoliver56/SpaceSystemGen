/* ------------------------------------------------------------------ */
/*  Procedural exoplanetary system generator                           */
/*  Physics: Kepler's third law (P² = a³/M), equilibrium temperature,  */
/*  mass–luminosity relation L ≈ M^3.5, orbital velocity v = √(GM/a).  */
/* ------------------------------------------------------------------ */

export interface Body {
  id: string;
  name: string;
  designation: string;
  kind: "star" | "planet";
  type: string;
  color: string;
  colorSoft: string;
  colorDark: string;
  glow: string;
  diameterKm: number;
  distanceAU: number;
  distanceLabel: string;
  periodDays: number;
  periodLabel: string;
  dayLength: string;
  moons: string;
  tempLabel: string;
  speedKmS: number;
  fact: string;
  sizePx: number;
  startAngle: number;
  bands?: boolean;
  rings?: boolean;
  isStar?: boolean;
  /* star extras */
  massSolar?: number;
  luminositySolar?: number;
  ageLabel?: string;
  worlds?: number;
  /* planet extras */
  orderLabel?: string;
}

export interface StarSystem {
  seed: number;
  seedLabel: string;
  catalog: string;
  star: Body;
  planets: Body[];
  bodies: Body[];
  belt: { innerIdx: number; outerIdx: number } | null;
  maxAU: number;
}

export const BASE_DAYS_PER_SEC = 12;
export const SPEED_OPTIONS = [0.5, 1, 2, 5, 10, 50];

export function orbitRadius(frac: number, sunR: number, maxR: number): number {
  const inner = sunR + maxR * 0.16;
  return inner + (maxR - inner) * Math.pow(Math.min(1, Math.max(0.02, frac)), 0.42);
}

export function fmtSim(days: number): string {
  const y = Math.floor(days / 365.25);
  const d = Math.floor(days - y * 365.25);
  return `T+${y}y ${String(d).padStart(3, "0")}d`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/* ---------------- seeded PRNG ---------------- */

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- naming ---------------- */

const PRE = ["Ve","Ka","Zor","Tha","Qui","Xel","Nym","Dra","Eri","Kal","Vor","Myr","Ash","Ilo","Ceth","Pyr","Gal","Or","Syn","Bael","Tyr","Ul","Noc","Sar"];
const MID = ["a","o","e","u","ar","el","ir","on","ys","eth","al","or","ey"];
const SUF = ["is","ar","un","eth","ara","ion","yx","os","ea","aris","une","ir","oth","anor","ys","ova","eri"];
const CATALOGS = ["KOI","HD","GJ","TOI","KIC","WASP","HIP","Gliese","LHS","Trappist"];

/* ---------------- palettes per world type ---------------- */

interface Palette {
  soft: string;
  base: string;
  dark: string;
  glow: string;
}

const PALETTES: Record<string, Palette[]> = {
  "Lava World": [
    { soft: "#ffd9a0", base: "#ff6a3d", dark: "#5e150b", glow: "rgba(255,110,60,0.5)" },
    { soft: "#ffc48a", base: "#e84f2a", dark: "#4a0f08", glow: "rgba(255,90,50,0.5)" },
  ],
  "Rocky World": [
    { soft: "#e6ddd1", base: "#b3a89b", dark: "#5f564c", glow: "rgba(190,178,160,0.35)" },
    { soft: "#d8cfc4", base: "#a58f7d", dark: "#54463a", glow: "rgba(180,160,140,0.35)" },
    { soft: "#cfc9c0", base: "#8f8578", dark: "#423c34", glow: "rgba(160,150,135,0.35)" },
  ],
  "Desert World": [
    { soft: "#f4d9a8", base: "#d9a05a", dark: "#7c5420", glow: "rgba(225,170,95,0.4)" },
    { soft: "#ecc49a", base: "#c98f4e", dark: "#6b4518", glow: "rgba(215,160,90,0.4)" },
  ],
  "Ocean World": [
    { soft: "#a5d4ff", base: "#3f87e0", dark: "#16356e", glow: "rgba(90,160,255,0.45)" },
    { soft: "#9ff0e0", base: "#2aa8a0", dark: "#0d4a46", glow: "rgba(70,200,190,0.45)" },
  ],
  "Super-Earth": [
    { soft: "#d4e8c0", base: "#7d9a68", dark: "#33502a", glow: "rgba(150,190,120,0.4)" },
    { soft: "#c8d8e8", base: "#6a84a0", dark: "#2a3c50", glow: "rgba(130,160,200,0.4)" },
  ],
  "Ice World": [
    { soft: "#f0fbff", base: "#a8d8e8", dark: "#4a7f96", glow: "rgba(170,220,240,0.45)" },
    { soft: "#eaf4ff", base: "#94b8dc", dark: "#3a5878", glow: "rgba(150,190,230,0.45)" },
  ],
  "Gas Giant": [
    { soft: "#f2d7ac", base: "#d8a06a", dark: "#855527", glow: "rgba(225,170,110,0.4)" },
    { soft: "#f0c0a0", base: "#c97a4e", dark: "#6e3418", glow: "rgba(210,130,85,0.4)" },
    { soft: "#f8e9c0", base: "#e3c584", dark: "#8f6f37", glow: "rgba(235,205,140,0.4)" },
    { soft: "#e4d8f0", base: "#a58fc0", dark: "#4e3a6e", glow: "rgba(175,150,210,0.4)" },
  ],
  "Ice Giant": [
    { soft: "#cdf2f3", base: "#7fd4d9", dark: "#2b767d", glow: "rgba(130,215,220,0.4)" },
    { soft: "#a4b8ff", base: "#4f6fe8", dark: "#1b2c80", glow: "rgba(100,130,255,0.45)" },
  ],
};

/* ---------------- field notes ---------------- */

const FACTS: Record<string, string[]> = {
  "Lava World": [
    "Tidally scoured and tidally stretched, {n} glows faintly on its night side — rivers of silicate lava trace the fracture lines where its crust is continually recycled.",
    "Spectroscopy of {n} hints at vaporized rock in its exosphere: it is slowly boiling away, trailing a comet-like tail of mineral gas.",
  ],
  "Rocky World": [
    "{n} is a battered terrestrial world — impact basins older than its star's middle age pockmark highlands of basalt and feldspar.",
    "With no atmosphere to speak of, {n}'s surface swings between extremes every rotation; regolith drifts like grey snow across its crater floors.",
  ],
  "Desert World": [
    "Planet-wide dune seas migrate across {n}, driven by thermal winds that never fully settle; storms can encircle the globe for months.",
    "{n} may have lost its oceans to a runaway greenhouse eons ago — its ochre haze is all that remains of an ancient hydrosphere.",
  ],
  "Ocean World": [
    "Radar mapping suggests {n} is a water world: a global ocean tens of kilometres deep, capped by water-vapour clouds, with no exposed land anywhere.",
    "On {n}, tidal heating keeps the deep ocean liquid and circulating — astrobiologists rank it among the most promising places to look for life.",
  ],
  "Super-Earth": [
    "Heavier than Earth yet still terrestrial, {n} likely hosts towering volcanoes and a magnetic field strong enough to paint aurorae visible from orbit.",
    "Gravity on {n} reaches twice Earth's; any mountains there are squat and broad, sculpted by a slow, dense atmosphere.",
  ],
  "Ice World": [
    "{n} is a frozen archive — nitrogen glaciers creep across its surface, and a subsurface ocean may slosh beneath kilometres of ice.",
    "Sunlight on {n} is a dim memory; its pale plains reflect what little arrives, making it one of the brightest objects in the system.",
  ],
  "Gas Giant": [
    "Banded jet streams on {n} shear at speeds that dwarf any terrestrial hurricane; the largest storm could swallow several Earths.",
    "{n} is mostly hydrogen and helium — deep inside, pressure turns that ocean into metallic hydrogen, driving a magnetic field of startling power.",
  ],
  "Ice Giant": [
    "{n} glows a cold blue from methane in its upper clouds; beneath them lies a slushy mantle of water, ammonia and methane ices.",
    "Seasons on {n} last decades — each pole tilts into long darkness, then into a slow, strange summer of glowing aurorae.",
  ],
};

/* ---------------- stellar classes ---------------- */

interface SpectralClass {
  code: string;
  name: string;
  w: number;
  mass: [number, number];
  tempK: [number, number];
  pal: Palette;
  fact: string;
}

const SPECTRA: SpectralClass[] = [
  {
    code: "M", name: "Red Dwarf", w: 0.32, mass: [0.2, 0.55], tempK: [2600, 3700],
    pal: { soft: "#ffd9c0", base: "#ff8a5c", dark: "#8a2f12", glow: "rgba(255,120,70,0.5)" },
    fact: "A thrifty red dwarf: {n} fuses hydrogen so slowly it will still be shining tens of billions of years from now — longer than the current age of the universe.",
  },
  {
    code: "K", name: "Orange Dwarf", w: 0.22, mass: [0.55, 0.85], tempK: [3700, 5000],
    pal: { soft: "#ffe6c0", base: "#ffb35c", dark: "#9c5518", glow: "rgba(255,170,90,0.5)" },
    fact: "K-stars are considered the 'sweet spot' of habitability — {n} is calm, long-lived, and gentle with the atmospheres of its inner worlds.",
  },
  {
    code: "G", name: "Yellow Dwarf", w: 0.18, mass: [0.85, 1.15], tempK: [5000, 6000],
    pal: { soft: "#fff6d8", base: "#ffd978", dark: "#b06a1e", glow: "rgba(255,200,100,0.5)" },
    fact: "A solar twin: {n} converts ~600 million tonnes of hydrogen to helium every second, bathing its system in steady yellow-white light.",
  },
  {
    code: "F", name: "Yellow-White Star", w: 0.12, mass: [1.15, 1.45], tempK: [6000, 7200],
    pal: { soft: "#fffbea", base: "#fff0b8", dark: "#c99a3e", glow: "rgba(255,230,160,0.5)" },
    fact: "Hotter and brighter than the Sun, {n} burns through its fuel in a few billion years — any life here evolved fast, or not at all.",
  },
  {
    code: "A", name: "White Star", w: 0.09, mass: [1.45, 2.0], tempK: [7200, 9500],
    pal: { soft: "#ffffff", base: "#e4eeff", dark: "#7a8fb8", glow: "rgba(210,228,255,0.55)" },
    fact: "{n} spins so fast its equator bulges visibly; its fierce ultraviolet output sculpts the magnetospheres of every world nearby.",
  },
  {
    code: "B", name: "Blue-White Star", w: 0.07, mass: [2.0, 2.6], tempK: [9500, 14000],
    pal: { soft: "#f2f7ff", base: "#a8c4ff", dark: "#3a56a8", glow: "rgba(150,180,255,0.6)" },
    fact: "A brilliant blue giant, {n} outshines the Sun a thousandfold — and will live fast, dying young as a supernova seed for the next stellar generation.",
  },
];

/* ---------------- main generator ---------------- */

export function generateSystem(seed: number): StarSystem {
  const rnd = mulberry32(seed >>> 0);
  const rand = (min: number, max: number) => rnd() * (max - min) + min;
  const int = (min: number, max: number) => Math.floor(rand(min, max + 1));
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const chance = (p: number) => rnd() < p;

  /* --- star --- */
  const totalW = SPECTRA.reduce((s, c) => s + c.w, 0);
  let roll = rnd() * totalW;
  let spec = SPECTRA[0];
  for (const c of SPECTRA) {
    roll -= c.w;
    if (roll <= 0) {
      spec = c;
      break;
    }
  }

  const massSolar = rand(spec.mass[0], spec.mass[1]);
  const luminositySolar = Math.pow(massSolar, 3.5);
  const tempK = int(spec.tempK[0], spec.tempK[1]);
  const catalog = `${pick(CATALOGS)}-${int(100, 9899)}`;
  const genName =
    pick(PRE) + (chance(0.6) ? pick(MID) : "") + pick(SUF);

  const star: Body = {
    id: "star",
    name: genName,
    designation: catalog,
    kind: "star",
    type: `${spec.code}-type ${spec.name}`,
    color: spec.pal.base,
    colorSoft: spec.pal.soft,
    colorDark: spec.pal.dark,
    glow: spec.pal.glow,
    diameterKm: Math.round(1392700 * Math.pow(massSolar, 0.85)),
    distanceAU: 0,
    distanceLabel: "System barycenter",
    periodDays: 0,
    periodLabel: "—",
    dayLength: `${rand(4, 40).toFixed(1)} h rotation`,
    moons: "—",
    tempLabel: `${tempK.toLocaleString("en-US")} K surface`,
    speedKmS: 0,
    fact: spec.fact.replace("{n}", genName),
    sizePx: 60,
    startAngle: 0,
    isStar: true,
    massSolar,
    luminositySolar,
    ageLabel: `≈${rand(0.2, 10.5).toFixed(1)} Gyr`,
  };

  /* --- planets --- */
  const n = int(3, 9);
  const snowLine = 2.7 * Math.sqrt(luminositySolar);
  const planets: Body[] = [];
  /* floor the innermost orbit so its period stays >= ~20 days (readable motion) */
  const aMin = Math.cbrt(0.003 * massSolar);
  let aNext = Math.max(rand(0.12, 0.38) * Math.sqrt(luminositySolar), aMin);

  /* lay out all semi-major axes first, then compress wide systems proportionally */
  const orbits: number[] = [];
  for (let i = 0; i < n; i++) {
    orbits.push(aNext);
    aNext *= rand(1.35, 1.9);
  }
  const rawMax = orbits[n - 1];
  const scale = rawMax > 90 ? 90 / rawMax : 1;

  for (let i = 0; i < n; i++) {
    const a = orbits[i] * scale;
    let type: string;
    if (a < snowLine * 0.55) {
      type = pick(["Lava World", "Lava World", "Rocky World", "Rocky World", "Rocky World", "Desert World", "Desert World"]);
    } else if (a < snowLine * 1.6) {
      type = pick(["Ocean World", "Ocean World", "Super-Earth", "Super-Earth", "Rocky World", "Desert World"]);
    } else {
      type = pick(["Gas Giant", "Gas Giant", "Ice Giant", "Ice Giant", "Ice World", "Ice World", "Ice World"]);
    }

    const giant = type === "Gas Giant" || type === "Ice Giant";
    let diameterKm: number;
    if (type === "Gas Giant") diameterKm = int(60000, 160000);
    else if (type === "Ice Giant") diameterKm = int(38000, 60000);
    else if (type === "Super-Earth") diameterKm = int(13000, 24000);
    else if (type === "Ocean World") diameterKm = int(8000, 18000);
    else diameterKm = int(4800, 13000);

    const letter = String.fromCharCode(98 + i);
    const name = `${genName} ${letter}`;
    const pal = pick(PALETTES[type]);

    const periodDays = 365.25 * Math.sqrt((a * a * a) / massSolar);
    const speedKmS = 29.78 * Math.sqrt(massSolar / a);

    let teq = (279 * Math.pow(luminositySolar, 0.25)) / Math.sqrt(a);
    if (["Ocean World", "Super-Earth", "Rocky World"].includes(type)) teq *= rand(1.0, 1.35);
    if (type === "Lava World") teq = Math.max(teq, rand(900, 1500));
    if (giant) teq *= 0.9;
    const tempC = Math.round(teq - 273);

    const kmM = a * 149.6;
    const distanceLabel = `${
      kmM < 1000 ? `${kmM.toFixed(1)}M km` : `${(kmM / 1000).toFixed(2)}B km`
    } · ${a.toFixed(2)} AU`;

    const periodLabel =
      periodDays < 1000
        ? `${periodDays.toFixed(periodDays < 100 ? 1 : 0)} days`
        : `${(periodDays / 365.25).toFixed(1)} years`;

    let moons: string;
    if (type === "Gas Giant") moons = String(int(8, 82));
    else if (type === "Ice Giant") moons = String(int(4, 30));
    else if (type === "Super-Earth") moons = String(int(0, 3));
    else moons = String(int(0, 2));

    const dayLength =
      chance(0.22) && !giant && a < snowLine
        ? "Tidally locked"
        : `${rand(7, 58).toFixed(1)} h`;

    planets.push({
      id: `p${i}`,
      name,
      designation: `${catalog} ${letter}`,
      kind: "planet",
      type,
      color: pal.base,
      colorSoft: pal.soft,
      colorDark: pal.dark,
      glow: pal.glow,
      diameterKm,
      distanceAU: Number(a.toFixed(2)),
      distanceLabel,
      periodDays,
      periodLabel,
      dayLength,
      moons,
      tempLabel: `${tempC.toLocaleString("en-US")}°C mean`,
      speedKmS,
      fact: pick(FACTS[type]).replace("{n}", name),
      sizePx: Math.max(9, Math.min(34, Math.round(Math.sqrt(diameterKm) / 8))),
      startAngle: int(0, 359),
      bands: giant || (type === "Ice World" && chance(0.4)),
      rings: (giant && chance(0.38)) || (type === "Ice World" && chance(0.1)),
      orderLabel: `${i + 1} of ${n}`,
    });
  }

  star.worlds = n;
  const maxAU = planets[planets.length - 1].distanceAU;

  const belt =
    n >= 4
      ? (() => {
          const innerIdx = int(0, Math.min(n - 2, 4));
          return { innerIdx, outerIdx: innerIdx + 1 };
        })()
      : null;

  return {
    seed,
    seedLabel: `0x${seed.toString(16).toUpperCase().padStart(6, "0")}`,
    catalog,
    star,
    planets,
    bodies: [star, ...planets],
    belt,
    maxAU,
  };
}

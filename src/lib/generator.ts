/* ------------------------------------------------------------------ */
/*  Procedural exoplanetary system generator                           */
/*  Physics: Kepler's third law (P² = a³/M), equilibrium temperature,  */
/*  mass–luminosity relation L ≈ M^3.5, orbital velocity v = √(GM/a),  */
/*  fluid Roche limit d = 2.44·R★·(ρ★/ρp)^⅓, and full Keplerian        */
/*  elements (a, e, i, Ω, ω, M) per world.                             */
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
  radiusSolar?: number;
  ageLabel?: string;
  worlds?: number;
  /* planet extras */
  orderLabel?: string;
  densityGcc?: number;
  /* shared — Roche limit (AU) and how many Roche radii the orbit sits at */
  rocheAU?: number;
  rocheMargin?: number;
  /* keplerian elements */
  eccentricity?: number; // e
  inclinationDeg?: number; // i — tilt vs. the system reference plane
  lonAscNodeDeg?: number; // Ω — longitude of ascending node
  argPeriDeg?: number; // ω — argument of perihelion
  periapsisAU?: number; // q = a(1−e)
  apoapsisAU?: number; // Q = a(1+e)
  /* physical characteristics */
  meanRadiusKm?: number;
  eqRadiusKm?: number;
  polarRadiusKm?: number;
  flattening?: number; // f = (Re−Rp)/Re
  circumferenceKm?: number;
  surfaceAreaKm2?: number;
  volumeKm3?: number;
  massKg?: number;
  solidMassKg?: number;
  liquidMassKg?: number;
  gasMassKg?: number;
  surfaceGravity?: number; // m/s²
  moiFactor?: number; // moment of inertia factor C/MR²
  rotationHours?: number; // sidereal
  locked?: boolean; // tidally locked to the star
  axialTiltDeg?: number; // obliquity
  albedo?: number; // Bond albedo
  geoAlbedo?: number; // geometric albedo (for magnitude)
  blackbodyK?: number; // equilibrium / blackbody temperature
  surfTempMinC?: number;
  surfTempMeanC?: number;
  surfTempMaxC?: number;
  absoluteMag?: number; // V-band planetary absolute magnitude H
}

export interface StarSystem {
  seed: number;
  seedLabel: string;
  catalog: string;
  star: Body;
  planets: Body[];
  bodies: Body[];
  /** debris belt, in AU — always strictly inside the widest cleared gap,
   *  so it never intersects any planet's orbit (incl. eccentric apsides) */
  belt: { innerAU: number; outerAU: number } | null;
  maxAU: number;
  /** system-wide fluid Roche limit (AU) — no orbit may cross inside it */
  rocheAU: number;
}

export const BASE_DAYS_PER_SEC = 12;
export const SPEED_OPTIONS = [0.5, 1, 2, 5, 10, 50];

/** 1 solar radius, in AU */
export const SUN_RADIUS_AU = 0.00465047;
/** fluid-body Roche coefficient (appropriate for rubble-pile & gaseous worlds) */
const ROCHE_K = 2.44;
/** fluffiest plausible planet bulk density (g/cm³) — used for the system-wide floor */
const MIN_PLANET_DENSITY = 0.8;
/** mean bulk densities (g/cm³) per world archetype */
const DENSITIES: Record<string, number> = {
  "Lava World": 5.2,
  "Rocky World": 4.1,
  "Desert World": 4.4,
  "Ocean World": 2.9,
  "Super-Earth": 5.6,
  "Ice World": 1.8,
  "Gas Giant": 1.1,
  "Ice Giant": 1.6,
};

/* ---------------- physical profiles per archetype ---------------- */
/* flat: oblateness range · moi: moment-of-inertia factor C/MR² ·
   alb: Bond albedo · ghg: greenhouse multiplier over blackbody temp ·
   spread: ± °C surface swing · solid/liquid/gas: mass fractions      */
interface PhysProfile {
  flat: [number, number];
  moi: [number, number];
  alb: [number, number];
  ghg: [number, number];
  spread: [number, number];
  solid: [number, number];
  liquid: [number, number];
  gas: [number, number];
}

const PHYS: Record<string, PhysProfile> = {
  "Lava World":  { flat: [0.0005, 0.003], moi: [0.31, 0.36], alb: [0.05, 0.15], ghg: [1.0, 1.15], spread: [90, 170], solid: [0.97, 1.0], liquid: [0.0, 0.01], gas: [0.0, 0.02] },
  "Rocky World": { flat: [0.001, 0.006],  moi: [0.30, 0.355], alb: [0.1, 0.3],  ghg: [1.0, 1.25], spread: [55, 130], solid: [0.95, 1.0], liquid: [0.0, 0.02], gas: [0.0, 0.03] },
  "Desert World":{ flat: [0.002, 0.007],  moi: [0.30, 0.35],  alb: [0.25, 0.4], ghg: [1.1, 1.5],  spread: [40, 110], solid: [0.9, 1.0],  liquid: [0.0, 0.02], gas: [0.0, 0.1] },
  "Ocean World": { flat: [0.002, 0.008],  moi: [0.31, 0.345], alb: [0.25, 0.45],ghg: [1.15, 1.5], spread: [10, 30],  solid: [0.55, 0.7], liquid: [0.3, 0.45], gas: [0.0, 0.02] },
  "Super-Earth": { flat: [0.001, 0.005],  moi: [0.29, 0.34],  alb: [0.2, 0.4],  ghg: [1.2, 1.6],  spread: [15, 45],  solid: [0.85, 0.97],liquid: [0.03, 0.15], gas: [0.0, 0.03] },
  "Ice World":   { flat: [0.001, 0.004],  moi: [0.32, 0.36],  alb: [0.5, 0.8],  ghg: [1.0, 1.1],  spread: [20, 60],  solid: [0.8, 0.95], liquid: [0.05, 0.2], gas: [0.0, 0.02] },
  "Gas Giant":   { flat: [0.05, 0.11],    moi: [0.24, 0.27],  alb: [0.3, 0.55], ghg: [0.85, 0.95],spread: [8, 25],   solid: [0.02, 0.12],liquid: [0.15, 0.4], gas: [0.5, 0.8] },
  "Ice Giant":   { flat: [0.02, 0.035],   moi: [0.27, 0.30],  alb: [0.3, 0.5],  ghg: [0.85, 0.95],spread: [8, 22],   solid: [0.05, 0.15],liquid: [0.5, 0.7],  gas: [0.15, 0.3] },
};

/* reference values */
const M_EARTH_KG = 5.972e24;
const R_EARTH_KM = 6371;
const V_EARTH_KM3 = 1.08321e12;

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
  const starRotH = rand(6, 420); // sidereal rotation, hours
  const radiusSolar = Math.pow(massSolar, 0.85); // main-sequence mass–radius relation
  const rhoStar = (1.408 * massSolar) / Math.pow(radiusSolar, 3); // mean density, g/cm³
  /* Fluid Roche limit d = 2.44 · R★ · (ρ★/ρp)^⅓ for the fluffiest plausible
     world — inside this radius tides shred planets faster than they accrete. */
  const rocheFluid =
    ROCHE_K * radiusSolar * SUN_RADIUS_AU * Math.cbrt(rhoStar / MIN_PLANET_DENSITY);
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
    diameterKm: Math.round(1392700 * radiusSolar),
    distanceAU: 0,
    distanceLabel: "System barycenter",
    periodDays: 0,
    periodLabel: "—",
    dayLength:
      starRotH >= 48
        ? `${(starRotH / 24).toFixed(1)} d rotation`
        : `${starRotH.toFixed(1)} h rotation`,
    moons: "—",
    tempLabel: `${tempK.toLocaleString("en-US")} K surface`,
    speedKmS: 0,
    fact: spec.fact.replace("{n}", genName),
    sizePx: 60,
    startAngle: 0,
    isStar: true,
    massSolar,
    luminositySolar,
    radiusSolar,
    rotationHours: starRotH,
    rocheAU: rocheFluid,
    ageLabel: `≈${rand(0.2, 10.5).toFixed(1)} Gyr`,
  };

  /* --- planets --- */
  const n = int(3, 9);
  const snowLine = 2.7 * Math.sqrt(luminositySolar);
  const planets: Body[] = [];
  /* floor the innermost orbit: readable motion AND ≥ 3× outside the Roche
     limit, where no self-gravitating world could survive the star's tides */
  const aMin = Math.cbrt(0.003 * massSolar);
  const aFloor = Math.max(aMin, 3 * rocheFluid);
  let aNext = Math.max(rand(0.12, 0.38) * Math.sqrt(luminositySolar), aFloor);

  /* lay out all semi-major axes first, then compress wide systems proportionally */
  const orbits: number[] = [];
  for (let i = 0; i < n; i++) {
    orbits.push(aNext);
    aNext *= rand(1.35, 1.9);
  }
  /* compact systems, like the real Kepler/TRAPPIST population: the outer
     edge sits ~3 snow lines out, capped so the chart stays legible */
  const outerCap = Math.min(26, Math.max(4, 3 * snowLine));
  const rawMax = orbits[n - 1];
  let scale = rawMax > outerCap ? outerCap / rawMax : 1;
  /* compression may never drag the inner world back inside the Roche-safe floor */
  scale = Math.max(scale, aFloor / orbits[0]);

  const aAll = orbits.map((o) => o * scale);

  /* eccentricities: biased low like real planets, clamped against the Roche
     limit, then mutually trimmed so neighbouring apsidal corridors never
     cross — peri(i+1) always exceeds apo(i) by a clear margin */
  const eccAll = aAll.map((a) => {
    let e = 0.02 + 0.28 * Math.pow(rnd(), 1.5);
    return Math.min(e, Math.max(0, 1 - (3 * rocheFluid) / a - 1e-4));
  });
  for (let i = 0; i < n - 1; i++) {
    const margin = 0.06 * aAll[i];
    const need = aAll[i] * (1 + eccAll[i]) + margin;
    if (aAll[i + 1] * (1 - eccAll[i + 1]) < need) {
      eccAll[i + 1] = 1 - need / aAll[i + 1];
      if (eccAll[i + 1] < 0) {
        eccAll[i + 1] = 0;
        eccAll[i] = Math.max(0, (aAll[i + 1] - margin) / aAll[i] - 1);
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const a = aAll[i];
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

    /* this world's own Roche limit from its bulk density, and how far
       outside it the orbit sits (must always exceed the 3× safety factor) */
    const densityGcc = DENSITIES[type];
    const rocheAU =
      ROCHE_K * radiusSolar * SUN_RADIUS_AU * Math.cbrt(rhoStar / densityGcc);
    const rocheMargin = a / rocheAU;

    /* Keplerian elements: e comes from the mutually-cleared table above
       (periapsis stays ≥ 3× the Roche limit; apsidal corridors never
       overlap); i, Ω and ω are free orientations. */
    const ecc = eccAll[i];
    const incl = 18 * Math.pow(rnd(), 2);
    const lonAsc = rnd() * 360;
    const argPeri = rnd() * 360;
    const peri = a * (1 - ecc);
    const apo = a * (1 + ecc);

    /* ---------- physical characteristics ---------- */
    const prof = PHYS[type];
    const eqR = diameterKm / 2;
    const locked = !giant && a < snowLine && chance(0.22);

    /* shape: rotation-driven oblateness, relaxed toward spherical when locked */
    let flattening = rand(prof.flat[0], prof.flat[1]);
    if (locked) flattening *= 0.25;
    const polarR = eqR * (1 - flattening);
    const meanR = eqR * (1 - flattening / 3);
    const circumferenceKm = 2 * Math.PI * eqR;
    const surfaceAreaKm2 = 4 * Math.PI * meanR * meanR;
    const volumeKm3 = (4 / 3) * Math.PI * meanR * meanR * meanR;

    /* mass budget: bulk density × volume, partitioned by archetype */
    const massKg = densityGcc * volumeKm3 * 1e12;
    const solidF = rand(prof.solid[0], prof.solid[1]);
    const liquidF = rand(prof.liquid[0], prof.liquid[1]);
    const gasF = Math.max(0, 1 - solidF - liquidF);
    const solidMassKg = massKg * solidF;
    const liquidMassKg = massKg * liquidF;
    const gasMassKg = massKg * gasF;

    const surfaceGravity =
      (9.807 * (massKg / M_EARTH_KG)) / Math.pow(meanR / R_EARTH_KM, 2);
    const moiFactor = rand(prof.moi[0], prof.moi[1]);

    /* spin: synchronous when locked, otherwise a free sidereal period */
    const rotationHours = locked ? periodDays * 24 : rand(7, 58);
    const axialTiltDeg = chance(0.07)
      ? rand(60, 118)
      : locked
        ? rand(0, 15)
        : rand(0.5, 35);
    const eqRotKmS = (2 * Math.PI * eqR) / (rotationHours * 3600);

    /* radiative balance: blackbody temp from stellar luminosity + Bond
       albedo, then a greenhouse lift (or compression) per archetype */
    const albedo = rand(prof.alb[0], prof.alb[1]);
    const geoAlbedo = Math.min(0.9, albedo * 1.4);
    const blackbodyK =
      (278.6 * Math.pow(luminositySolar, 0.25) * Math.pow(1 - albedo, 0.25)) /
      Math.sqrt(a);
    let surfMeanK = blackbodyK * rand(prof.ghg[0], prof.ghg[1]);
    if (type === "Lava World") surfMeanK = Math.max(surfMeanK, rand(900, 1500));
    const surfTempMeanC = surfMeanK - 273;
    const spread = rand(prof.spread[0], prof.spread[1]);
    const surfTempMinC = Math.max(-268, surfTempMeanC - spread);
    const surfTempMaxC = surfTempMeanC + spread * 1.2;
    const tempC = Math.round(surfTempMeanC);

    /* planetary absolute magnitude (V-band): standard small-body relation */
    const absoluteMag = 5 * Math.log10(1329 / (diameterKm * Math.sqrt(geoAlbedo)));

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

    const dayLength = locked
      ? "Tidally locked"
      : `${rotationHours.toFixed(1)} h`;

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
      densityGcc,
      rocheAU,
      rocheMargin,
      eccentricity: Number(ecc.toFixed(4)),
      inclinationDeg: Number(incl.toFixed(2)),
      lonAscNodeDeg: Number(lonAsc.toFixed(1)),
      argPeriDeg: Number(argPeri.toFixed(1)),
      periapsisAU: Number(peri.toFixed(4)),
      apoapsisAU: Number(apo.toFixed(4)),
      meanRadiusKm: meanR,
      eqRadiusKm: eqR,
      polarRadiusKm: polarR,
      flattening: Number(flattening.toFixed(5)),
      circumferenceKm,
      surfaceAreaKm2,
      volumeKm3,
      massKg,
      solidMassKg,
      liquidMassKg,
      gasMassKg,
      surfaceGravity,
      moiFactor: Number(moiFactor.toFixed(4)),
      rotationHours,
      locked,
      axialTiltDeg: Number(axialTiltDeg.toFixed(1)),
      albedo: Number(albedo.toFixed(3)),
      geoAlbedo: Number(geoAlbedo.toFixed(3)),
      blackbodyK: Math.round(blackbodyK),
      surfTempMinC: Math.round(surfTempMinC),
      surfTempMeanC: Math.round(surfTempMeanC),
      surfTempMaxC: Math.round(surfTempMaxC),
      absoluteMag: Number(absoluteMag.toFixed(2)),
    });
  }

  star.worlds = n;
  const maxAU = planets[planets.length - 1].distanceAU;

  /* debris belt: carved from the widest apsidal gap between neighbours and
     trimmed to its middle half — structurally incapable of intersecting any
     planet's orbit, however eccentric */
  let belt: { innerAU: number; outerAU: number } | null = null;
  if (n >= 4) {
    let best = -1;
    let bestGap = 0;
    for (let i = 0; i < n - 1; i++) {
      const gap =
        aAll[i + 1] * (1 - eccAll[i + 1]) - aAll[i] * (1 + eccAll[i]);
      if (gap > bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    if (best >= 0 && bestGap >= 0.6) {
      belt = {
        innerAU: Number(
          (aAll[best] * (1 + eccAll[best]) + bestGap * 0.25).toFixed(3)
        ),
        outerAU: Number(
          (aAll[best + 1] * (1 - eccAll[best + 1]) - bestGap * 0.25).toFixed(3)
        ),
      };
    }
  }

  return {
    seed,
    seedLabel: `0x${seed.toString(16).toUpperCase().padStart(6, "0")}`,
    catalog,
    star,
    planets,
    bodies: [star, ...planets],
    belt,
    maxAU,
    rocheAU: rocheFluid,
  };
}

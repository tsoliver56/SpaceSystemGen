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
  /* atmosphere */
  atmosphere?: Atmosphere;
  /* formation history */
  massEarth?: number;
  formedBy?: string; // "CORE ACCRETION" | "DISK INSTABILITY"
  chthonian?: boolean;
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
  /** formation history — the parent cloud and the protoplanetary disk */
  nebula?: { cloudMass: number; feh: number; spin: number };
  disk?: { massEarth: number; lifetimeMyr: number; mode: string };
}

/* the rate multiplier IS the rate: 1× = 1 simulated day per real second */
export const SPEED_OPTIONS = [0.5, 1, 2, 5, 10, 50];

/** the eight stages of system formation, in order (drives the loading UI) */
export const PIPELINE_PHASES = [
  "COLLAPSING PARENT NEBULA",
  "IGNITING STAR · FORMING DISK",
  "TIME CHECK · FORMATION MODE",
  "DISTRIBUTING EMBRYOS · ACCRETION",
  "CLASSIFYING BY FROST LINE",
  "MIGRATION · RESONANCE · STABILITY",
  "ATMOSPHERES · STELLAR STRIPPING",
  "N-BODY VALIDATION",
];

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
  "Chthonian World": 5.4, // bare iron–silicate core of a stripped giant
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
  "Chthonian World": { flat: [0.0005, 0.002], moi: [0.30, 0.34], alb: [0.04, 0.12], ghg: [1.0, 1.06], spread: [140, 300], solid: [0.995, 1.0], liquid: [0.0, 0.004], gas: [0.0, 0.008] },
};

/* reference values */
const M_EARTH_KG = 5.972e24;
const R_EARTH_KM = 6371;
const V_EARTH_KM3 = 1.08321e12;

/* ================= atmosphere model =================
   Retention via Jeans escape (v_esc vs thermal speed at the exospheric
   temperature). Composition from volcanic feedstock + photolysis +
   condensation / cold-trap rules; H₂O from Magnus saturation pressure.
   Spin drives dynamo shielding (wind erosion) and the circulation
   regime; obliquity sets the seasonal pressure swing.                */

export interface GasDef {
  formula: string;
  name: string;
  mm: number; // molar mass, g/mol
  color: string;
  condK?: number; // condensation/frost point, K
}

export const GAS_DEFS: Record<string, GasDef> = {
  H2:   { formula: "H₂",   name: "Hydrogen",           mm: 2.016,  color: "#ffb3c1" },
  He:   { formula: "He",   name: "Helium",             mm: 4.003,  color: "#ffc9e8" },
  HD:   { formula: "HD",   name: "Hydrogen deuteride", mm: 3.022,  color: "#ffc0c0" },
  Ne:   { formula: "Ne",   name: "Neon",               mm: 20.18,  color: "#ffa3a3" },
  N2:   { formula: "N₂",   name: "Nitrogen",           mm: 28.014, color: "#9fd0ff", condK: 63 },
  O2:   { formula: "O₂",   name: "Oxygen",             mm: 31.998, color: "#9be8a8", condK: 54 },
  Ar:   { formula: "Ar",   name: "Argon",              mm: 39.948, color: "#c9b8e8", condK: 84 },
  Kr:   { formula: "Kr",   name: "Krypton",            mm: 83.798, color: "#b8c8e8" },
  CO:   { formula: "CO",   name: "Carbon monoxide",    mm: 28.01,  color: "#d8dde3", condK: 68 },
  CO2:  { formula: "CO₂",  name: "Carbon dioxide",     mm: 44.01,  color: "#ffd9a0", condK: 195 },
  H2O:  { formula: "H₂O",  name: "Water vapor",        mm: 18.015, color: "#6fb1ff", condK: 240 },
  CH4:  { formula: "CH₄",  name: "Methane",            mm: 16.04,  color: "#7fe8d0", condK: 91 },
  NH3:  { formula: "NH₃",  name: "Ammonia",            mm: 17.031, color: "#b8e88a", condK: 195 },
  H2S:  { formula: "H₂S",  name: "Hydrogen sulfide",   mm: 34.08,  color: "#e8d07a", condK: 213 },
  SO2:  { formula: "SO₂",  name: "Sulfur dioxide",     mm: 64.06,  color: "#ffe08a", condK: 263 },
  O3:   { formula: "O₃",   name: "Ozone",              mm: 47.997, color: "#8ae8d8" },
  N2O:  { formula: "N₂O",  name: "Nitrous oxide",      mm: 44.013, color: "#a8e8b8" },
  C2H6: { formula: "C₂H₆", name: "Ethane",             mm: 30.07,  color: "#e8b87a", condK: 90 },
  HCN:  { formula: "HCN",  name: "Hydrogen cyanide",   mm: 27.026, color: "#d8b8e8", condK: 260 },
  PH3:  { formula: "PH₃",  name: "Phosphine",          mm: 33.998, color: "#d8e87a" },
  GeH4: { formula: "GeH₄", name: "Germane",            mm: 76.63,  color: "#c8c8f0" },
  Na:   { formula: "Na",   name: "Sodium vapor",       mm: 22.99,  color: "#ffe8a0" },
  K:    { formula: "K",    name: "Potassium vapor",    mm: 39.098, color: "#e8c8ff" },
  SiO:  { formula: "SiO",  name: "Silicon monoxide",   mm: 44.08,  color: "#e0d0b8" },
  Fe:   { formula: "Fe",   name: "Iron vapor",         mm: 55.845, color: "#f0b8a0" },
};

export interface GasShare {
  id: string;
  frac: number; // volume mixing ratio, 0..1
}

export interface Atmosphere {
  pressureBar: number;
  cloudTop: boolean; // giants — "surface" is the 1-bar cloud deck
  collapsed: boolean; // night-side cold trap on locked thin-air worlds
  molarMass: number; // g/mol
  circulation: string;
  seasonalPct: number | null; // ±% pressure swing from obliquity
  haze: string; // "r,g,b" tint
  hazeAmt: number; // 0..1 shell opacity
  bandAmt: number; // 0..0.6 cloud-band opacity
  termShade: number; // night-side terminator darkness
  note: string;
  gases: GasShare[]; // top 10 by volume
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export interface AtmoInput {
  type: string;
  surfTempMeanC: number;
  blackbodyK: number;
  surfaceGravity: number;
  massKg: number;
  meanRadiusKm: number;
  rotationHours: number;
  axialTiltDeg: number;
  locked: boolean;
}

export function buildAtmosphere(
  b: AtmoInput,
  ageGyr: number,
  rng: {
    rand: (min: number, max: number) => number;
    chance: (p: number) => boolean;
  }
): Atmosphere {
  const { rand, chance } = rng;
  const type = b.type;
  const giant = type === "Gas Giant" || type === "Ice Giant";
  const Ts = (b.surfTempMeanC ?? 0) + 273;
  const Tbb = b.blackbodyK ?? Ts;
  const g = b.surfaceGravity ?? 9.8;
  const rotH = b.rotationHours ?? 24;
  const tilt = b.axialTiltDeg ?? 10;
  const locked = !!b.locked;

  const vEsc = Math.sqrt(
    (2 * 6.674e-11 * (b.massKg ?? 1e24)) / ((b.meanRadiusKm ?? 6371) * 1000)
  );
  const texo = Math.max(Tbb * 2.2, 320); // exospheric temperature
  const retain = (mm: number) =>
    vEsc > 5.5 * Math.sqrt((3 * 1.381e-23 * texo) / (mm * 1.6605e-27));

  const mix: Record<string, number> = {};
  let pressureBar = 1;
  let cloudTop = false;
  let collapsed = false;

  if (giant) {
    cloudTop = true;
    pressureBar = rand(0.7, 2.4); // 1-bar cloud deck
    const hot = Tbb > 900; // hot giants: carbon lives as CO, not CH₄
    mix.H2 = rand(0.82, 0.9);
    mix.He = type === "Ice Giant" ? rand(0.12, 0.17) : rand(0.07, 0.15);
    mix.CH4 = hot ? rand(2e-4, 1e-3) : type === "Ice Giant" ? rand(0.018, 0.042) : rand(0.002, 0.008);
    mix.CO = hot ? rand(0.002, 0.012) : rand(2e-5, 8e-5);
    mix.NH3 = type === "Gas Giant" ? rand(2e-4, 3e-3) : rand(3e-5, 2e-4);
    mix.H2S = type === "Ice Giant" ? rand(2e-5, 4e-4) : rand(5e-6, 3e-5);
    mix.H2O = rand(1e-5, 4e-4);
    mix.HD = rand(2e-5, 4e-5);
    mix.Ne = rand(1e-5, 3e-5);
    mix.C2H6 = rand(2e-6, 9e-6);
    mix.PH3 = rand(3e-7, 2e-6);
    mix.GeH4 = rand(2e-7, 9e-7);
  } else if (type === "Lava World") {
    /* vaporized rock + volcanics; pressure climbs steeply with temperature */
    pressureBar = clamp(rand(1e-5, 2e-2) * Math.pow(Ts / 1100, 6), 1e-7, 0.3);
    mix.SO2 = 0.3; mix.O2 = 0.24; mix.CO2 = 0.14; mix.CO = 0.1;
    mix.Na = 0.09; mix.K = 0.05; mix.SiO = 0.05; mix.Fe = 0.015; mix.O3 = 1e-4;
  } else {
    /* rocky / desert / ocean / super-earth / ice */
    const cold = Ts < 200;
    const temperate = Ts >= 230 && Ts <= 340;
    const hotV = Ts > 450;
    const isOcean = type === "Ocean World";
    const isIce = type === "Ice World";

    mix.N2 = isIce ? rand(0.5, 0.97) : rand(0.15, 0.85);
    mix.CO2 = hotV ? rand(0.8, 0.96) : cold ? rand(0.005, 0.05) : rand(0.05, 0.85);
    if (isOcean && temperate) { mix.CO2 = rand(0.001, 0.04); mix.N2 = rand(0.62, 0.9); } // carbonate sink
    if (isOcean && hotV) { mix.H2O = rand(0.55, 0.95); mix.CO2 = rand(0.03, 0.2); mix.N2 = rand(0.02, 0.15); }
    if (isIce && Ts >= 90 && Ts <= 160) mix.CH4 = rand(0.01, 0.12); // Titan regime
    if (cold && Ts < 75) { mix.N2 *= 0.06; mix.CO = rand(0.3, 0.7); } // Pluto: CO outlasts N₂ frost
    if (hotV) mix.CO = rand(0.01, 0.12);

    /* ⁴⁰Ar from potassium decay — accumulates with system age */
    mix.Ar = rand(0.004, 0.02) * Math.min(2, ageGyr / 4.5);

    /* water vapor: Magnus saturation over open water */
    if (!mix.H2O && Ts > 250 && Ts <= 500) {
      const tC = Ts - 273;
      const pSat = (6.1094 * Math.exp((17.625 * tC) / (tC + 243.04))) / 1000;
      mix.H2O = Math.min(0.4, pSat);
    }

    /* oxygen: biology on temperate oceans, else CO₂ photolysis */
    if (isOcean && temperate && chance(0.32)) mix.O2 = rand(0.03, 0.24);
    else if (hotV) mix.O2 = rand(0.004, 0.06);

    /* volcanic traces */
    if (chance(0.55)) mix.SO2 = rand(0.001, hotV ? 0.04 : 0.012);
    if (chance(0.4)) mix.H2S = rand(5e-5, 0.004);
    if ((mix.O2 ?? 0) > 0.01) { mix.O3 = mix.O2 * rand(1e-6, 4e-6); mix.N2O = rand(1e-7, 5e-7); }
    mix.Ne = rand(1e-5, 3e-5);
    mix.Kr = rand(1e-7, 5e-7);
    if (retain(2.016)) mix.H2 = rand(1e-6, 5e-5);

    let p0: [number, number];
    if (type === "Rocky World") p0 = [0.02, 8];
    else if (type === "Desert World") p0 = [0.05, 4];
    else if (type === "Ocean World") p0 = [0.6, 25];
    else if (type === "Super-Earth") p0 = [2, 600];
    else p0 = [1e-5, 0.05]; // Ice World — volatiles freeze out
    pressureBar = rand(p0[0], p0[1]) * Math.pow(g / 9.807, 0.8);

    /* spin-driven dynamo shields against stellar wind stripping;
       slow and locked rotators lose their air over gigayears */
    const magF = locked || rotH > 90 ? rand(0.4, 0.7) : rotH < 25 ? 1 : 0.85;
    pressureBar *= magF * (1 + Math.max(0, 4 - ageGyr) * 0.08);

    /* cold trap: locked worlds with thin air freeze volatiles onto the
       night side — the atmosphere partially collapses */
    if (locked && pressureBar < 0.5 && Ts < 260) {
      collapsed = true;
      for (const k of Object.keys(mix)) {
        const def = GAS_DEFS[k];
        if (def?.condK && Ts < def.condK + 40) mix[k] *= 0.03;
      }
      pressureBar *= 0.12;
    }
  }

  /* Jeans escape strips light gases; cold surfaces condense volatiles */
  for (const k of Object.keys(mix)) {
    const def = GAS_DEFS[k];
    if (!def) continue;
    if (!retain(def.mm) && (def.mm < 10 || k === "H2O" || k === "NH3")) mix[k] *= 1e-4;
    if (!giant && def.condK && Ts < def.condK) mix[k] *= 0.004;
  }

  /* normalize → top 10, padded with trace species so the survey always
     resolves a full ten-constituent spectrum */
  let sum = 0;
  for (const k of Object.keys(mix)) sum += Math.max(0, mix[k]);
  if (sum <= 0) { mix.CO2 = 1; sum = 1; }
  const padPool = giant
    ? ["Ne", "HD", "C2H6", "PH3", "GeH4", "CO", "H2S", "NH3", "H2O", "Ar", "Kr", "HCN"]
    : ["Ne", "Kr", "Ar", "CO", "O3", "H2", "He", "CH4", "CO2", "N2", "N2O", "HCN"];
  let padI = 0;
  for (const k of padPool) {
    if (Object.keys(mix).length >= 10) break;
    if (!(k in mix)) mix[k] = sum * 1e-6 / ++padI;
  }
  const gases: GasShare[] = Object.entries(mix)
    .map(([id, frac]) => ({ id, frac: Math.max(0, frac) / sum }))
    .sort((x, y) => y.frac - x.frac)
    .slice(0, 10);

  const molarMass = gases.reduce((s, gs) => s + gs.frac * (GAS_DEFS[gs.id]?.mm ?? 28), 0);
  const f = (k: string) => (mix[k] ? mix[k] / sum : 0);

  let circulation: string;
  if (collapsed || pressureBar < 0.001) circulation = "SURFACE-BOUND · COLLAPSING";
  else if (locked) circulation = "DAY–NIGHT HADLEY CELL";
  else if (rotH < 16 && pressureBar > 0.3) circulation = "ZONAL JET STREAMS · BANDED";
  else if (rotH <= 60) circulation = "MID-LATITUDE STORM BELTS";
  else circulation = "SLOW MERIDIONAL CELLS";
  if (tilt > 35) circulation += " · EXTREME SEASONS";

  /* seasonal ΔP: obliquity drives cap sublimation of the leading
     condensable (CO₂ on Mars-analogs, N₂/CH₄ on Pluto-analogs) */
  const condFrac = gases.reduce(
    (m, gs) => (GAS_DEFS[gs.id]?.condK ? Math.max(m, gs.frac) : m),
    0
  );
  const seasonalPct =
    !giant && tilt > 8 && condFrac > 0.15 && Ts < 320
      ? Math.round(Math.min(80, (tilt / 45) * condFrac * 55))
      : null;

  /* haze tint follows the dominant scatterer */
  let haze = "165,200,255";
  if (f("H2O") > 0.35) haze = "238,244,255";
  else if (f("CO2") > 0.5) haze = "235,222,190";
  else if (f("SO2") > 0.04) haze = "246,216,130";
  else if (f("CH4") > 0.04 && Ts < 200) haze = "226,178,116"; // tholin photochemical smog
  else if (giant) haze = "190,205,235";
  let hazeAmt = giant
    ? 0.34
    : clamp((Math.log10(Math.max(1e-7, pressureBar)) + 3) / 6, 0, 1) * 0.55;
  if (collapsed) hazeAmt *= 0.5;

  /* circulation shows as cloud bands — thick air on fast rotators */
  const bandAmt = giant
    ? 0.5
    : locked
      ? 0
      : pressureBar > 1.5 && rotH < 50
        ? 0.3
        : pressureBar > 0.3 && rotH < 20
          ? 0.18
          : 0;

  const termShade = giant
    ? 0.3
    : pressureBar < 0.01
      ? 0.8
      : pressureBar < 0.3
        ? 0.62
        : pressureBar < 2
          ? 0.5
          : pressureBar < 10
            ? 0.4
            : 0.32;

  let note: string;
  if (collapsed) note = "NIGHT-SIDE COLD TRAP · VOLATILES FROZEN OUT";
  else if (giant) note = f("CH4") > 0.01 ? "CH₄ ABSORBS RED · BLUE-GREEN HUE" : "PRIMORDIAL H₂–He NEBULAR GAS";
  else if (f("H2O") > 0.35) note = "RUNAWAY GREENHOUSE · STEAM ATMOSPHERE";
  else if (f("O2") > 0.1) note = "OXYGEN-RICH · POSSIBLE BIOSIGNATURE";
  else if (f("CO2") > 0.6) note = "DENSE CO₂ · STRONG GREENHOUSE";
  else if (f("SO2") > 0.04) note = "VOLCANIC · SULFUR CYCLE";
  else if (f("CH4") > 0.04 && Ts < 200) note = "METHANE CYCLE · THOLIN HAZE";
  else if (pressureBar < 0.02) note = "TENUOUS · SURFACE-BOUND";
  else note = "N₂-DOMINANT · TEMPERATE REGIME";

  return {
    pressureBar,
    cloudTop,
    collapsed,
    molarMass,
    circulation,
    seasonalPct,
    haze,
    hazeAmt,
    bandAmt,
    termShade,
    note,
    gases,
  };
}

/** Conservative circumstellar habitable zone (Kopparapu-style limits,
 *  scaled by √L☉): runaway-greenhouse inner edge, maximum-greenhouse outer. */
export function habitableZone(lumSolar: number): [number, number] {
  const s = Math.sqrt(Math.max(1e-4, lumSolar));
  return [0.95 * s, 1.67 * s];
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
  "Chthonian World": [
    { soft: "#d6d9de", base: "#8d939e", dark: "#33373f", glow: "rgba(150,160,175,0.35)" },
    { soft: "#e0d8cc", base: "#9a8f7e", dark: "#3d352c", glow: "rgba(160,150,130,0.35)" },
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
  "Chthonian World": [
    "{n} is the exposed core of a giant planet — the star's ultraviolet storm boiled away its hydrogen envelope, leaving a scorched iron world that still orbits like a ghost of what it was.",
    "Once a puffed-up gas giant, {n} was stripped to its bare rocky heart by stellar X-rays; its density betrays a metallic core larger than Earth's entire planet.",
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
    code: "B", name: "Blue Giant", w: 0.05, mass: [2.0, 16.0], tempK: [10000, 28000],
    pal: { soft: "#f2f7ff", base: "#a8c4ff", dark: "#3a56a8", glow: "rgba(150,180,255,0.6)" },
    fact: "A brilliant blue giant, {n} outshines the Sun a thousandfold — and will live fast, dying young as a supernova seed for the next stellar generation.",
  },
  {
    code: "O", name: "Blue Supergiant", w: 0.02, mass: [16.0, 24.0], tempK: [28000, 42000],
    pal: { soft: "#eef2ff", base: "#8fa8ff", dark: "#2c3d94", glow: "rgba(130,160,255,0.65)" },
    fact: "A rare O-type monster: {n} pours out so much ultraviolet light that it photo-evaporates its own protoplanetary disk in under a million years.",
  },
];

/* ---------------- main generator ---------------- */

export function generateSystem(seed: number): StarSystem {
  const rnd = mulberry32(seed >>> 0);
  const rand = (min: number, max: number) => rnd() * (max - min) + min;
  const int = (min: number, max: number) => Math.floor(rand(min, max + 1));
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const chance = (p: number) => rnd() < p;

  /* ============ STEP 1 · PARENT NEBULA ============
     Everything begins in a cold molecular-cloud core: its mass sets how
     much star + disk can form, its metallicity sets how much rock/ice is
     available, its angular momentum sets how wide the disk will be. */
  const cloudMass = 2 + 130 * Math.pow(rnd(), 6.5); // M☉, IMF-like: small cores common
  const feh = rand(-1.6, 0.5); // [Fe/H] in dex
  const zRatio = Math.pow(10, feh); // metals relative to solar
  const spin = rand(0.75, 1.5); // angular-momentum factor → disk size

  /* ============ STEP 2 · STAR + PROTOPLANETARY DISK ============
     Star formation is inefficient — only ~25–45% of the core collapses
     into the star; the leftover feeds the disk. */
  const sfe = rand(0.25, 0.45);
  const massSolar = clamp(cloudMass * sfe, 0.2, 24);
  let spec = SPECTRA[SPECTRA.length - 1];
  for (const c of SPECTRA) {
    if (massSolar <= c.mass[1]) {
      spec = c;
      break;
    }
  }
  const luminositySolar = Math.pow(massSolar, 3.5);
  const leftover = cloudMass - massSolar; // M☉ that never made it into the star
  const diskMassEarth = leftover * rand(0.002, 0.015) * 333000; // → M⊕
  /* Disk lifetime shrinks with stellar mass: photo-evaporation by UV/X-rays.
     M-dwarfs keep their disks ~10 Myr, sun-like stars 3–5, O/B giants < 1. */
  const diskLifetimeMyr = clamp(9 * Math.pow(0.4 / massSolar, 1.1), 0.3, 12);
  const tMsGyr = 10 * Math.pow(massSolar, -2.5); // main-sequence lifespan
  const starRotH = rand(6, 420); // sidereal rotation, hours
  const ageGyr = rand(0.2, Math.min(10.5, Math.max(0.3, tMsGyr * 0.8)));
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
    ageLabel: `≈${ageGyr.toFixed(1)} Gyr`,
  };

  /* ============ STEP 3 · TIME CHECK & FORMATION MODE ============
     O/B blue giants photo-evaporate their disks in < 1 Myr — far too fast
     for dust to grind into rocky cores (core accretion needs ~1–10 Myr).
     Around them, only gravitational disk instability can build worlds, and
     only gas giants at wide separations. */
  const isOB = spec.code === "O" || spec.code === "B";
  const rockyAllowed = !isOB;
  const giantsAllowed = diskLifetimeMyr > 2.2;
  const iceGiantsAllowed = diskLifetimeMyr > 1.2;
  const mode = isOB ? "DISK INSTABILITY" : "CORE ACCRETION";

  /* ============ STEP 4 · EMBRYOS & ACCRETION (mass-budgeted) ============
     Disk solids condense into embryos; more metals → more rocky embryos.
     Every world's mass is drawn against a strict budget carved from the
     disk — you cannot get ten Jupiters from a disk that held two. */
  const snowLine = 2.7 * Math.sqrt(luminositySolar);
  const snowZone = Math.min(snowLine, 45); // classification reference
  const budgetEarth = diskMassEarth * rand(0.15, 0.5);

  const aMin = Math.cbrt(0.003 * massSolar);
  const aFloor = Math.max(aMin, 3 * rocheFluid); // Roche-safe inner edge

  let n = isOB ? int(1, 4) : int(3, 9);
  if (!isOB && zRatio < 0.3) n = Math.max(2, n - int(1, 3)); // metal-poor: fewer worlds
  const giantBias = clamp(zRatio, 0.15, 1.6) * (giantsAllowed ? 1 : 0);

  interface Proto {
    a: number;
    type: string;
    m: number; // M⊕
  }
  const protos: Proto[] = [];
  let spent = 0;

  let aNext = isOB
    ? rand(22, 55) * spin // instability operates far out, where the disk is cold
    : Math.max(rand(0.12, 0.38) * Math.sqrt(luminositySolar), aFloor);
  const spacing: [number, number] = isOB ? [1.6, 2.4] : [1.35, 1.9];

  for (let i = 0; i < n; i++) {
    /* ============ STEP 5 · CLASSIFICATION BY FROST LINE ============ */
    let type = "";
    let m = 0;
    if (isOB) {
      type = "Gas Giant"; // disk instability: only self-gravitating gas clumps
      m = rand(180, 1300);
    } else if (aNext < snowZone * 0.55) {
      if (zRatio < 0.35 && chance(0.45)) {
        m = 0; // metal-poor disks skip some rocky embryos
      } else {
        type = pick(["Lava World", "Lava World", "Rocky World", "Rocky World", "Rocky World", "Desert World", "Desert World"]);
        m = rand(0.05, 2.5);
      }
    } else if (aNext < snowZone * 1.6) {
      type = pick(
        zRatio > 0.6
          ? ["Ocean World", "Ocean World", "Super-Earth", "Super-Earth", "Rocky World", "Desert World"]
          : ["Super-Earth", "Rocky World", "Desert World", "Desert World"]
      );
      m = type === "Super-Earth" ? rand(2, 12) : rand(0.4, 6);
    } else {
      const rollG = rnd();
      if (giantsAllowed && rollG < 0.42 * giantBias) {
        type = "Gas Giant";
        m = rand(60, 900);
      } else if (iceGiantsAllowed && rollG < 0.75) {
        type = "Ice Giant";
        m = rand(9, 60);
      } else {
        type = pick(["Ice World", "Ice World", "Super-Earth"]);
        m = type === "Ice World" ? rand(0.02, 1.8) : rand(1.5, 9);
      }
    }

    /* strict budget adherence — trim or abandon the embryo */
    const remaining = budgetEarth - spent;
    if (m > 0 && type) {
      if (m > remaining) m = remaining * rand(0.5, 0.9);
      if (m < 0.02 || remaining <= 0) {
        m = 0;
      } else {
        spent += m;
        protos.push({ a: aNext, type, m });
      }
    }
    aNext *= rand(spacing[0], spacing[1]);
  }

  /* ============ STEP 6 · MIGRATION, RESONANCES & STABILITY ============ */
  /* Type-II giants drift inward through the gas disk; rocky worlds barely move */
  for (const p of protos) {
    if (p.type === "Gas Giant") p.a *= rand(0.5, 0.92);
    else if (p.type === "Ice Giant") p.a *= rand(0.7, 1.0);
    else p.a *= rand(0.85, 1.02);
    p.a = Math.max(p.a, aFloor); // never inside the Roche-safe edge
  }
  protos.sort((x, y) => x.a - y.a);

  /* mean-motion resonances: snap near-rational period ratios to exact locks */
  for (let i = 0; i < protos.length - 1; i++) {
    const r = protos[i + 1].a / protos[i].a;
    for (const c of [1.5, 1.667, 2.0, 2.5]) {
      if (Math.abs(r - c) / c < 0.05 && chance(0.55)) {
        protos[i + 1].a = protos[i].a * c;
        break;
      }
    }
  }

  /* eccentricities: biased low, clamped ≥ 3× the Roche limit, then mutually
     trimmed so neighbouring apsidal corridors never cross */
  const eccAll = protos.map((p) => {
    const e = 0.02 + 0.28 * Math.pow(rnd(), 1.5);
    return Math.min(e, Math.max(0, 1 - (3 * rocheFluid) / p.a - 1e-4));
  });
  for (let i = 0; i < protos.length - 1; i++) {
    const margin = 0.06 * protos[i].a;
    const need = protos[i].a * (1 + eccAll[i]) + margin;
    if (protos[i + 1].a * (1 - eccAll[i + 1]) < need) {
      eccAll[i + 1] = 1 - need / protos[i + 1].a;
      if (eccAll[i + 1] < 0) {
        eccAll[i + 1] = 0;
        eccAll[i] = Math.max(0, (protos[i + 1].a - margin) / protos[i].a - 1);
      }
    }
  }

  /* Hill-stability pass: neighbours closer than ~3.5 mutual Hill radii are
     unstable over 1 Gyr — the outer world is scattered and ejected */
  const stable: Proto[] = [];
  const stableEcc: number[] = [];
  protos.forEach((p, idx) => {
    const prev = stable[stable.length - 1];
    if (prev) {
      const rHill =
        prev.a *
        Math.cbrt((prev.m + p.m) / (3 * massSolar * 333000));
      if (p.a - prev.a < 3.5 * rHill) return; // ejected from the system
    }
    stable.push(p);
    stableEcc.push(eccAll[idx]);
  });
  while (stable.length === 0 && protos.length > 0) {
    /* pathological case: keep the single most massive embryo */
    const heaviest = protos.reduce((b, p) => (p.m > b.m ? p : b), protos[0]);
    stable.push(heaviest);
    stableEcc.push(0.02);
    break;
  }

  const aAll = stable.map((p) => p.a);
  const planets: Body[] = [];

  /* ============ STEP 7 · WORLDS TAKE SHAPE ============
     Each surviving embryo is fleshed out with full physics; atmospheres
     are added here and stellar stripping applied right after the loop. */
  for (let i = 0; i < stable.length; i++) {
    const a = stable[i].a;
    const type = stable[i].type;
    const protoMass = stable[i].m; // M⊕ drawn from the disk budget
    const giant = type === "Gas Giant" || type === "Ice Giant";
    /* diameter from mass × bulk density — mass-conserving with the budget */
    const vol0 = (protoMass * 5.972e12) / DENSITIES[type];
    let diameterKm = Math.round(2 * Math.cbrt((3 * vol0) / (4 * Math.PI)));
    diameterKm = clamp(diameterKm, 3200, 200000);

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
    const ecc = stableEcc[i];
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

    /* atmosphere: retention + chemistry + condensation model */
    const atmosphere = buildAtmosphere(
      {
        type,
        surfTempMeanC,
        blackbodyK,
        surfaceGravity,
        massKg,
        meanRadiusKm: meanR,
        rotationHours,
        axialTiltDeg,
        locked,
      },
      ageGyr,
      { rand, chance }
    );

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
      bands: giant || atmosphere.bandAmt > 0,
      rings: (giant && chance(0.38)) || (type === "Ice World" && chance(0.1)),
      orderLabel: `${i + 1} of ${stable.length}`,
      densityGcc,
      rocheAU,
      rocheMargin,
      massEarth: protoMass,
      formedBy: mode,
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
      atmosphere,
    });
  }

  /* ---- stellar stripping: XUV photo-evaporation of close-in air ----
     Young massive stars (and flaring M-dwarfs) batter inner worlds with
     X-ray/UV flux ∝ 1/a²; weak gravity can't hold on. Close-in giants can
     lose their entire envelope, becoming chthonian (exposed-core) worlds. */
  const activity = isOB
    ? rand(1.5, 3)
    : spec.code === "M" && chance(0.35)
      ? rand(1.2, 2)
      : rand(0.25, 0.6);
  for (const p of planets) {
    const g0 = Math.max(0.25, (p.surfaceGravity ?? 9.8) / 9.807);
    const E = (activity * 2.2) / (p.distanceAU * p.distanceAU * g0);
    if (E > 1.6 && p.atmosphere) {
      p.atmosphere.pressureBar *= 0.02;
      p.atmosphere.hazeAmt *= 0.4;
      p.atmosphere.note = "STRIPPED BY STELLAR XUV";
    }
    const wasGiant = p.type === "Gas Giant" || p.type === "Ice Giant";
    if (wasGiant && E > 3.0 && (p.massEarth ?? 0) < 500) {
      /* envelope lost — only the rocky core survives */
      const coreM = (p.massEarth ?? 20) * rand(0.06, 0.18);
      const coreVol = (coreM * 5.972e12) / 5.4;
      const coreR = Math.cbrt((3 * coreVol) / (4 * Math.PI));
      const massKg = coreM * M_EARTH_KG;
      const surfaceGravity = (9.807 * coreM) / Math.pow(coreR / R_EARTH_KM, 2);
      const atmosphere = buildAtmosphere(
        {
          type: "Chthonian World",
          surfTempMeanC: p.surfTempMeanC ?? 0,
          blackbodyK: p.blackbodyK ?? 300,
          surfaceGravity,
          massKg,
          meanRadiusKm: coreR,
          rotationHours: p.rotationHours ?? 24,
          axialTiltDeg: p.axialTiltDeg ?? 5,
          locked: p.locked ?? false,
        },
        ageGyr,
        { rand, chance }
      );
      const pal = pick(PALETTES["Chthonian World"]);
      Object.assign(p, {
        type: "Chthonian World",
        chthonian: true,
        color: pal.base,
        colorSoft: pal.soft,
        colorDark: pal.dark,
        glow: pal.glow,
        diameterKm: Math.round(coreR * 2),
        meanRadiusKm: coreR,
        eqRadiusKm: coreR,
        polarRadiusKm: coreR * 0.998,
        flattening: 0.002,
        circumferenceKm: 2 * Math.PI * coreR,
        surfaceAreaKm2: 4 * Math.PI * coreR * coreR,
        volumeKm3: coreVol,
        massKg,
        massEarth: coreM,
        solidMassKg: massKg,
        liquidMassKg: 0,
        gasMassKg: 0,
        densityGcc: 5.4,
        surfaceGravity,
        atmosphere,
        bands: false,
        rings: false,
        sizePx: Math.max(9, Math.min(34, Math.round(Math.sqrt(coreR * 2) / 8))),
        fact: pick(FACTS["Chthonian World"]).replace("{n}", p.name),
      });
    }
  }

  /* ============ STEP 8 · FINAL VALIDATION ============
     The summed planetary mass can never exceed the disk it formed from —
     if rounding ever pushed it over, the most massive giant is removed. */
  let totalE = planets.reduce((s, p) => s + (p.massEarth ?? 0), 0);
  while (totalE > diskMassEarth && planets.length > 1) {
    let gi = -1;
    let gm = 0;
    planets.forEach((p, i) => {
      const isG = p.type === "Gas Giant" || p.type === "Ice Giant";
      if (isG && (p.massEarth ?? 0) > gm) {
        gm = p.massEarth ?? 0;
        gi = i;
      }
    });
    if (gi < 0) break;
    planets.splice(gi, 1);
    totalE = planets.reduce((s, p) => s + (p.massEarth ?? 0), 0);
  }

  star.worlds = planets.length;
  star.fact += ` Born from a ${cloudMass.toFixed(0)} M☉ cloud at [Fe/H] ${
    feh >= 0 ? "+" : ""
  }${feh.toFixed(2)}, its ${Math.round(diskMassEarth).toLocaleString(
    "en-US"
  )} M⊕ disk survived ~${diskLifetimeMyr.toFixed(1)} Myr${
    mode === "DISK INSTABILITY"
      ? " — too briefly for dust to build rocky cores, so only giants could condense directly from the cold outer disk."
      : "."
  }`;

  const maxAU = planets.length
    ? planets[planets.length - 1].distanceAU
    : Math.max(1, aFloor * 4);

  /* debris belt: carved from the widest apsidal gap between neighbours and
     trimmed to its middle half — structurally incapable of intersecting any
     planet's orbit, however eccentric */
  let belt: { innerAU: number; outerAU: number } | null = null;
  if (planets.length >= 4 && !isOB) {
    let best = -1;
    let bestGap = 0;
    for (let i = 0; i < planets.length - 1; i++) {
      const gap =
        (planets[i + 1].periapsisAU ?? 0) - (planets[i].apoapsisAU ?? 0);
      if (gap > bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    if (best >= 0 && bestGap >= 0.6) {
      belt = {
        innerAU: Number(
          ((planets[best].apoapsisAU ?? 0) + bestGap * 0.25).toFixed(3)
        ),
        outerAU: Number(
          ((planets[best + 1].periapsisAU ?? 0) - bestGap * 0.25).toFixed(3)
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
    nebula: { cloudMass, feh, spin },
    disk: { massEarth: diskMassEarth, lifetimeMyr: diskLifetimeMyr, mode },
  };
}

/* Phased wrapper: runs the same pipeline but yields between stages so the
   UI can light up each formation step while the system condenses. */
export async function generateSystemPhased(
  seed: number,
  onPhase?: (i: number) => void
): Promise<StarSystem> {
  const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 3; i++) {
    onPhase?.(i);
    await pause(i === 0 ? 220 : 130);
  }
  const sys = generateSystem(seed); // the full eight-step pipeline
  for (let i = 3; i < PIPELINE_PHASES.length; i++) {
    onPhase?.(i);
    await pause(i === 3 ? 200 : 110);
  }
  return sys;
}

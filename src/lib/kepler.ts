/* ------------------------------------------------------------------ */
/*  Keplerian orbital mechanics for the orrery.                        */
/*  M → E (Kepler's equation, Newton iteration) → true anomaly ν →     */
/*  radius r = a(1 − e·cosE), then the (i, Ω, ω) rotation frames are   */
/*  applied and the result projected with a gentle camera tilt so      */
/*  inclination reads as depth.                                        */
/* ------------------------------------------------------------------ */

export const DEG = Math.PI / 180;
/** camera tilt off the perfect top-down view, in radians (~12°) */
export const VIEW_TILT = 0.21;

export interface OrbitFrame {
  iRad: number; // inclination
  omRad: number; // longitude of ascending node Ω
  wRad: number; // argument of perihelion ω
}

export interface Pt {
  x: number;
  y: number;
  depth: number; // + toward viewer
  nu: number;
  rAU: number;
}

/** Solve Kepler's equation M = E − e·sinE for the eccentric anomaly E. */
export function solveKepler(M: number, e: number): number {
  let E = M + e * Math.sin(M); // good starting guess
  for (let k = 0; k < 6; k++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

export function nuFromE(E: number, e: number): number {
  return (
    2 *
    Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    )
  );
}

export function eFromNu(nu: number, e: number): number {
  return (
    2 *
    Math.atan(
      Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2)
    )
  );
}

/** Pure kepler state at mean anomaly M — no projection, for readouts. */
export function keplerState(
  aAU: number,
  e: number,
  M: number
): { E: number; nu: number; rAU: number } {
  const E = solveKepler(M, e);
  return { E, nu: nuFromE(E, e), rAU: aAU * (1 - e * Math.cos(E)) };
}

/** Radial AU → px scale (gentle compression keeps inner orbits legible
 *  while preserving ellipse shapes). */
export function auToPx(
  au: number,
  sunVis: number,
  maxR: number,
  maxAU: number
): number {
  const frac = Math.min(1.05, Math.max(0, au / maxAU));
  return sunVis + (maxR - sunVis) * Math.pow(frac, 0.62);
}

/** Point on the orbit at eccentric anomaly E, fully projected to screen. */
export function orbitPointAtE(
  aAU: number,
  e: number,
  fr: OrbitFrame,
  E: number,
  toPx: (au: number) => number
): Pt {
  const nu = nuFromE(E, e);
  const rAU = aAU * (1 - e * Math.cos(E));
  const r = toPx(rAU);
  const u = fr.wRad + nu;
  const cosO = Math.cos(fr.omRad);
  const sinO = Math.sin(fr.omRad);
  const cosI = Math.cos(fr.iRad);
  const sinI = Math.sin(fr.iRad);
  const x = r * (cosO * Math.cos(u) - sinO * Math.sin(u) * cosI);
  const y3 = r * (sinO * Math.cos(u) + cosO * Math.sin(u) * cosI);
  const z3 = r * Math.sin(u) * sinI;
  const ct = Math.cos(VIEW_TILT);
  const st = Math.sin(VIEW_TILT);
  return { x, y: y3 * ct - z3 * st, depth: y3 * st + z3 * ct, nu, rAU };
}

/** Screen point of a planet at mean anomaly M. */
export function orbitPointFromM(
  aAU: number,
  e: number,
  fr: OrbitFrame,
  M: number,
  toPx: (au: number) => number
): Pt {
  return orbitPointAtE(aAU, e, fr, solveKepler(M, e), toPx);
}

/** SVG path of the full projected ellipse (sampled in E). */
export function orbitPathD(
  aAU: number,
  e: number,
  fr: OrbitFrame,
  toPx: (au: number) => number,
  cx: number,
  cy: number,
  samples = 148
): string {
  let d = "";
  for (let k = 0; k <= samples; k++) {
    const E = (k / samples) * Math.PI * 2;
    const p = orbitPointAtE(aAU, e, fr, E, toPx);
    d += `${k === 0 ? "M" : "L"}${(cx + p.x).toFixed(1)} ${(cy + p.y).toFixed(1)}`;
  }
  return d + "Z";
}

/** Ascending / descending node screen points (orbit ∩ reference plane). */
export function nodePoints(
  aAU: number,
  e: number,
  fr: OrbitFrame,
  toPx: (au: number) => number
): { asc: Pt; desc: Pt } {
  const p1 = orbitPointAtE(aAU, e, fr, eFromNu(-fr.wRad, e), toPx);
  const p2 = orbitPointAtE(aAU, e, fr, eFromNu(Math.PI - fr.wRad, e), toPx);
  // ascending = crossing toward the viewer: probe just past each crossing
  const d1 = orbitPointAtE(aAU, e, fr, eFromNu(-fr.wRad + 0.03, e), toPx).depth;
  const d2 = orbitPointAtE(aAU, e, fr, eFromNu(Math.PI - fr.wRad + 0.03, e), toPx).depth;
  return d1 > d2 ? { asc: p1, desc: p2 } : { asc: p2, desc: p1 };
}

export function frameOf(el: {
  inclinationDeg?: number;
  lonAscNodeDeg?: number;
  argPeriDeg?: number;
}): OrbitFrame {
  return {
    iRad: (el.inclinationDeg ?? 0) * DEG,
    omRad: (el.lonAscNodeDeg ?? 0) * DEG,
    wRad: (el.argPeriDeg ?? 0) * DEG,
  };
}

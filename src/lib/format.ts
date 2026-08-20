/* Number formatting with unicode superscripts — no <sup> soup. */

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";

export function sup(n: number | string): string {
  return String(n)
    .split("")
    .map((c) => (c === "-" ? "⁻" : SUP[Number(c)] ?? c))
    .join("");
}

/** "5.97×10²⁴" — always scientific notation */
export function sci(x: number, digits = 2): string {
  if (!isFinite(x) || x === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(x)));
  const m = x / Math.pow(10, e);
  return `${m.toFixed(digits)}×10${sup(e)}`;
}

/** kilometres — locale string when small, scientific when vast */
export function fmtKm(x: number): string {
  if (x >= 100000) return `${sci(x)} km`;
  return `${Math.round(x).toLocaleString("en-US")} km`;
}

export function fmtArea(x: number): string {
  return `${sci(x)} km²`;
}

export function fmtVolume(x: number): string {
  return `${sci(x)} km³`;
}

export function fmtMassKg(x: number): string {
  return `${sci(x)} kg`;
}

/** surface pressure across 12 orders of magnitude — µbar to kbar */
export function fmtPressure(bar: number): string {
  if (bar >= 1000) return `${(bar / 1000).toFixed(1)} kbar`;
  if (bar >= 1) return `${bar.toFixed(1)} bar`;
  if (bar >= 1e-3) return `${Math.round(bar * 1000)} mbar`;
  return `${(bar * 1e6).toFixed(1)} µbar`;
}

export function fmtGasPct(frac: number): string {
  const p = frac * 100;
  if (p >= 10) return `${p.toFixed(1)}%`;
  if (p >= 0.1) return `${p.toFixed(2)}%`;
  if (p >= 0.001) return `${p.toFixed(3)}%`;
  return "<0.001%";
}

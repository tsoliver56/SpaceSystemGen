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

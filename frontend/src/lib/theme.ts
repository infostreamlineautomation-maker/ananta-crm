/** Ananta CRM ships with a red brand palette baked into globals.css as
 * Tailwind v4 @theme tokens — but those compile to real runtime CSS custom
 * properties (that's the whole point of @theme in v4), so they can be
 * overridden after the fact. This derives the same shade ramp (50/100/400/
 * 500/600/700) from an organization's single `primary_color` and writes it
 * onto :root, so switching organizations re-themes the whole app instantly
 * without touching a single component. */

interface HSL {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): HSL {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      break;
    case g:
      h = ((b - r) / d + 2) * 60;
      break;
    default:
      h = ((r - g) / d + 4) * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: HSL): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Derives the 6-step shade ramp Tailwind utilities expect from one base
 * "500" color, by adjusting lightness (and gently taming saturation at the
 * extremes so very light tints don't look washed out or very dark shades
 * don't look muddy). */
function shadeRamp(baseHex: string): Record<"50" | "100" | "400" | "600" | "700", string> {
  const base = hexToHsl(baseHex);
  return {
    "50": hslToHex({ h: base.h, s: clamp(base.s * 0.55, 20, 70), l: clamp(base.l + 42, 90, 97) }),
    "100": hslToHex({ h: base.h, s: clamp(base.s * 0.6, 25, 75), l: clamp(base.l + 32, 82, 92) }),
    "400": hslToHex({ h: base.h, s: base.s, l: clamp(base.l + 12, 0, 92) }),
    "600": hslToHex({ h: base.h, s: base.s, l: clamp(base.l - 10, 8, 100) }),
    "700": hslToHex({ h: base.h, s: base.s, l: clamp(base.l - 18, 5, 100) }),
  };
}

const DEFAULT_PRIMARY = "#C31432";

export function applyOrgTheme(primaryColor: string | null | undefined) {
  if (typeof document === "undefined") return;
  const base = primaryColor && /^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : DEFAULT_PRIMARY;
  const ramp = shadeRamp(base);
  const root = document.documentElement.style;
  root.setProperty("--color-primary-50", ramp["50"]);
  root.setProperty("--color-primary-100", ramp["100"]);
  root.setProperty("--color-primary-400", ramp["400"]);
  root.setProperty("--color-primary-500", base);
  root.setProperty("--color-primary-600", ramp["600"]);
  root.setProperty("--color-primary-700", ramp["700"]);
}

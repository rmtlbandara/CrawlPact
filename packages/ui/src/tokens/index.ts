/**
 * JS-side mirror of the token values components occasionally need as data
 * rather than as a class name (e.g. a `matchMedia` breakpoint check). The
 * CSS in `tokens.css` remains the source of truth for anything renderable
 * via a Tailwind utility class — only add a value here if code genuinely
 * needs it as a JS value.
 */
export const BREAKPOINTS = {
  xs: 360,
  sm: 480,
  md: 640,
  lg: 768,
  xl: 1024,
  "2xl": 1280,
  "3xl": 1440,
} as const;

export const MOTION_DURATION_MS = {
  quick: 150,
  standard: 200,
} as const;

/**
 * ProofChain design tokens — the single source of truth for the visual system
 * described in `docs/WEB_DESIGN.md` §1.
 *
 * Colors are stored as space-separated RGB channel triplets so they can be
 * exposed as CSS variables and consumed by Tailwind via
 * `rgb(var(--token) / <alpha-value>)`. This preserves Tailwind opacity
 * modifiers (e.g. `bg-primary/15`) across both the dark (default) and light
 * themes.
 *
 * Never hardcode a hex value in a component — reference these tokens through
 * Tailwind utility classes (`bg-surface`, `text-primary`, `border-border`, …).
 */

/** A raw RGB channel triplet, e.g. `"59 130 246"`. */
export type Channel = string;

/** Semantic + structural palette. Values are RGB channels. */
export interface ThemePalette {
  readonly bg: Channel;
  readonly surface: Channel;
  readonly "surface-2": Channel;
  readonly border: Channel;
  readonly text: Channel;
  readonly muted: Channel;
  readonly faint: Channel;
  readonly primary: Channel;
  readonly "primary-hi": Channel;
  readonly "primary-fg": Channel;
  readonly "primary-soft": Channel;
  readonly success: Channel;
  readonly warn: Channel;
  readonly danger: Channel;
  readonly info: Channel;
}

/** Dark theme (default) — WD §1 base palette. */
export const darkPalette: ThemePalette = {
  bg: "11 14 20", // #0B0E14
  surface: "18 23 34", // #121722
  "surface-2": "26 33 48", // #1A2130
  border: "35 44 61", // #232C3D
  text: "230 237 243", // #E6EDF3
  muted: "154 167 184", // #9AA7B8
  faint: "92 107 128", // #5C6B80
  primary: "59 130 246", // #3B82F6
  "primary-hi": "96 165 250", // #60A5FA
  "primary-fg": "255 255 255",
  "primary-soft": "34 48 94", // deep brand tint
  success: "34 197 94", // #22C55E
  warn: "245 158 11", // #F59E0B
  danger: "239 68 68", // #EF4444
  info: "56 189 248", // #38BDF8
};

/** Light theme — mirrors the dark palette with inverted surfaces. */
export const lightPalette: ThemePalette = {
  bg: "246 248 251", // #F6F8FB
  surface: "255 255 255", // #FFFFFF
  "surface-2": "238 242 248", // #EEF2F8
  border: "213 220 231", // #D5DCE7
  text: "11 14 20", // #0B0E14
  muted: "85 98 122", // #55627A
  faint: "133 147 168", // #8593A8
  primary: "59 130 246", // #3B82F6
  "primary-hi": "37 99 235", // #2563EB (darker for contrast on light)
  "primary-fg": "255 255 255",
  "primary-soft": "220 232 255", // #DCE8FF
  success: "22 163 74", // #16A34A
  warn: "217 119 6", // #D97706
  danger: "220 38 38", // #DC2626
  info: "2 132 199", // #0284C7
};

/**
 * Domain accent channels for section theming (WD §1 / §5). Shared across both
 * themes so a section reads the same everywhere.
 */
export const domainAccents = {
  finance: "34 197 94", // #22C55E
  compliance: "245 158 11", // #F59E0B
  dpp: "139 92 246", // #8B5CF6
  logistics: "56 189 248", // #38BDF8
  sustainability: "16 185 129", // #10B981
  workforce: "236 72 153", // #EC4899
  governance: "167 139 250", // #A78BFA
  markets: "249 115 22", // #F97316
} as const;

export type DomainAccent = keyof typeof domainAccents;

/** Type scale (px) — WD §1. Paired with a comfortable line height. */
export const fontSize = {
  xs: ["12px", "16px"],
  sm: ["14px", "20px"],
  base: ["15px", "22px"],
  lg: ["18px", "26px"],
  xl: ["24px", "30px"],
  "2xl": ["30px", "36px"],
  "3xl": ["40px", "44px"],
} as const;

/** Corner radii — WD §1. */
export const radius = {
  sm: "6px",
  md: "10px",
  lg: "14px",
  pill: "9999px",
} as const;

/** Motion timings — WD §1 (120–200ms ease-out; respect reduced motion). */
export const motion = {
  fast: "120ms",
  base: "160ms",
  slow: "200ms",
  ease: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

/** Font stacks. Inter for UI, JetBrains Mono for hashes/amounts/addresses. */
export const fontFamily = {
  sans: '"Inter", var(--font-sans), ui-sans-serif, system-ui, sans-serif',
  mono: '"JetBrains Mono", var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

/**
 * Build the `--token: channels` declarations for a palette. Used by the CSS
 * generator below (and available to tests).
 */
export function paletteToCssVars(palette: ThemePalette): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(palette)) {
    vars[`--${key}`] = value;
  }
  for (const [key, value] of Object.entries(domainAccents)) {
    vars[`--accent-${key}`] = value;
  }
  return vars;
}

export const tokens = {
  darkPalette,
  lightPalette,
  domainAccents,
  fontSize,
  radius,
  motion,
  fontFamily,
} as const;

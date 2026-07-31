import type { Config } from "tailwindcss";
import { radius } from "./src/design/tokens";

/**
 * Tailwind theme extension — implements every token in WEB_DESIGN.md §1.
 *
 * Colors resolve to CSS variables (defined in globals.css) as
 * `rgb(var(--token) / <alpha-value>)`, so `bg-primary/15` and light/dark
 * theming both work. Legacy keys (`fg`, `brand`, …) are kept as aliases so the
 * existing pages continue to render without edits.
 */
const withAlpha = (token: string) => `rgb(var(--${token}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Structural
        bg: withAlpha("bg"),
        surface: {
          DEFAULT: withAlpha("surface"),
          2: withAlpha("surface-2"),
        },
        "surface-2": withAlpha("surface-2"),
        border: withAlpha("border"),
        // Text
        text: withAlpha("text"),
        fg: withAlpha("text"), // legacy alias
        muted: withAlpha("muted"),
        faint: withAlpha("faint"),
        // Brand / primary
        primary: {
          DEFAULT: withAlpha("primary"),
          hi: withAlpha("primary-hi"),
          fg: withAlpha("primary-fg"),
          soft: withAlpha("primary-soft"),
        },
        brand: {
          DEFAULT: withAlpha("primary"),
          fg: withAlpha("primary-fg"),
          soft: withAlpha("primary-soft"),
          hi: withAlpha("primary-hi"),
        },
        // Semantic
        success: withAlpha("success"),
        warn: withAlpha("warn"),
        danger: withAlpha("danger"),
        info: withAlpha("info"),
        // Domain accents (section theming)
        finance: withAlpha("accent-finance"),
        compliance: withAlpha("accent-compliance"),
        dpp: withAlpha("accent-dpp"),
        logistics: withAlpha("accent-logistics"),
        sustainability: withAlpha("accent-sustainability"),
        workforce: withAlpha("accent-workforce"),
        governance: withAlpha("accent-governance"),
        markets: withAlpha("accent-markets"),
        // Dynamic accent driven by a local CSS var (set per section)
        accent: "rgb(var(--accent, var(--primary)) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["15px", { lineHeight: "22px" }],
        lg: ["18px", { lineHeight: "26px" }],
        xl: ["24px", { lineHeight: "30px" }],
        "2xl": ["30px", { lineHeight: "36px" }],
        "3xl": ["40px", { lineHeight: "44px" }],
      },
      borderRadius: {
        sm: radius.sm,
        md: radius.md,
        lg: radius.lg,
        xl: "0.9rem",
        pill: radius.pill,
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.28)",
        DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.32)",
        md: "0 4px 12px -2px rgb(0 0 0 / 0.38)",
        lg: "0 12px 32px -6px rgb(0 0 0 / 0.5)",
        overlay: "0 16px 48px -8px rgb(0 0 0 / 0.55)",
      },
      transitionTimingFunction: {
        "ease-out-quint": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        DEFAULT: "160ms",
        slow: "200ms",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 160ms cubic-bezier(0.16,1,0.3,1)",
        "slide-up": "slide-up 180ms cubic-bezier(0.16,1,0.3,1)",
        "slide-in-right": "slide-in-right 200ms cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f17",
        surface: "#121826",
        "surface-2": "#1a2234",
        border: "#26304a",
        muted: "#8b95ab",
        fg: "#e7ecf5",
        brand: {
          DEFAULT: "#4f7cff",
          fg: "#ffffff",
          soft: "#22305e",
        },
        success: "#2fbf71",
        warn: "#f5a524",
        danger: "#f04d5f",
      },
      borderRadius: {
        xl: "0.9rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

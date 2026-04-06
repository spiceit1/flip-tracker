import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Linear-inspired dark palette
        bg: {
          primary: "#0f0f10",
          secondary: "#151517",
          tertiary: "#1c1c1f",
          elevated: "#232326",
          hover: "#2a2a2e",
        },
        border: {
          subtle: "#2a2a2e",
          default: "#333338",
          strong: "#48484f",
        },
        text: {
          primary: "#e8e8ea",
          secondary: "#9898a0",
          tertiary: "#6b6b75",
          muted: "#4a4a52",
        },
        accent: {
          purple: "#7c5cfc",
          purpleHover: "#6d4eee",
          blue: "#4d7cfe",
          green: "#26c97a",
          yellow: "#f0b429",
          red: "#f05b5b",
          orange: "#f07a35",
        },
        priority: {
          high: "#f05b5b",
          medium: "#f0b429",
          low: "#4d7cfe",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": "0.625rem",
        xs: "0.75rem",
        sm: "0.8125rem",
        base: "0.875rem",
        lg: "1rem",
        xl: "1.125rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
        modal: "0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
        glow: "0 0 20px rgba(124,92,252,0.15)",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
      },
    },
  },
  plugins: [],
};

export default config;

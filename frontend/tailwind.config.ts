import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta do prihora: rosa quente sobre neutros quentes.
        brand: {
          50: "#fff1f5",
          100: "#ffe4ec",
          200: "#fecdda",
          300: "#fda4bd",
          400: "#fb7199",
          500: "#f43f75",
          600: "#e11d5c",
          700: "#be124c",
          800: "#9f1247",
          900: "#881342",
          950: "#4c0420",
        },
        ink: {
          50: "#f7f7f6",
          100: "#e6e5e3",
          200: "#cdcbc7",
          300: "#aaa7a1",
          400: "#87837c",
          500: "#6c6862",
          600: "#56534e",
          700: "#464340",
          800: "#3b3936",
          900: "#34322f",
          950: "#1c1b19",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(28, 27, 25, 0.06), 0 8px 24px -12px rgba(28, 27, 25, 0.14)",
        lift: "0 2px 6px rgba(28, 27, 25, 0.08), 0 16px 40px -18px rgba(28, 27, 25, 0.28)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;

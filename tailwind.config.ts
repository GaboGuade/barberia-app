import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fbf7f1",
          100: "#f4ead7",
          200: "#e6d1a8",
          300: "#d4b074",
          400: "#c2934f",
          500: "#a8773a",
          600: "#8a5e2f",
          700: "#6c4724",
          800: "#4a301a",
          900: "#2a1c10",
        },
      },
      fontFamily: {
        display: ["Georgia", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;

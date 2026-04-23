import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#074D47",
          medium: "#22867C",
          light: "#89E4DA",
          dark: "#053830",
        },
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["IBM Plex Mono", "Courier New", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0px",
        none: "0px",
        sm: "0px",
        md: "0px",
        lg: "0px",
        xl: "0px",
        "2xl": "0px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};
export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        kirim: {
          DEFAULT: "#059669",
          light: "#d1fae5",
        },
        chiqim: {
          DEFAULT: "#e11d48",
          light: "#ffe4e6",
        },
      },
    },
  },
  plugins: [],
};

export default config;

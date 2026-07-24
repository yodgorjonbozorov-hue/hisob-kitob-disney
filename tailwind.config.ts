import type { Config } from "tailwindcss";

/**
 * Dizayn tokenlari — CSS o'zgaruvchilari orqali (globals.css :root / .dark).
 * Semantik ranglar: income = muvaffaqiyat (yashil), expense = xavf (qizil) — HAMMA JOYDA bir xil.
 * Sirt/matn/chegara tokenlari dark mode'da avtomatik almashadi.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Sirtlar va matn (dark mode CSS var orqali flip bo'ladi)
        app: "rgb(var(--bg-app) / <alpha-value>)",
        surface: "rgb(var(--bg-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--bg-surface-2) / <alpha-value>)",
        line: "rgb(var(--border) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--fg-muted) / <alpha-value>)",
        faint: "rgb(var(--fg-faint) / <alpha-value>)",
        // Semantik moliyaviy ranglar
        income: {
          DEFAULT: "rgb(var(--income) / <alpha-value>)",
          soft: "rgb(var(--income-soft) / <alpha-value>)",
          fg: "rgb(var(--income-fg) / <alpha-value>)",
        },
        expense: {
          DEFAULT: "rgb(var(--expense) / <alpha-value>)",
          soft: "rgb(var(--expense-soft) / <alpha-value>)",
          fg: "rgb(var(--expense-fg) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          fg: "rgb(var(--brand-fg) / <alpha-value>)",
        },
        // Eski nomlar (backward-compat) — income/expense bilan bir xil
        kirim: { DEFAULT: "#059669", light: "#d1fae5" },
        chiqim: { DEFAULT: "#e11d48", light: "#ffe4e6" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Type scale: 12/13/14/16/20/24/32
        "2xs": ["0.75rem", { lineHeight: "1rem" }], // 12
        xs: ["0.8125rem", { lineHeight: "1.125rem" }], // 13
        sm: ["0.875rem", { lineHeight: "1.25rem" }], // 14
        base: ["1rem", { lineHeight: "1.5rem" }], // 16
        lg: ["1.25rem", { lineHeight: "1.75rem" }], // 20
        xl: ["1.5rem", { lineHeight: "2rem" }], // 24
        "2xl": ["2rem", { lineHeight: "2.375rem" }], // 32
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1rem",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
      },
      keyframes: {
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
        "fade-in": "fade-in 0.15s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;

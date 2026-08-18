import type { Config } from "tailwindcss";

/**
 * Balansa dizayn tokenlari — CSS o'zgaruvchilari orqali (globals.css :root / .dark).
 * Semantik ranglar: income = kirim (yashil), expense = chiqim (qizil) — HAMMA JOYDA bir xil,
 * brend teal bilan almashtirilmaydi.
 * Sirt/matn/chegara tokenlari dark mode'da avtomatik almashadi.
 * `brand` — semantik (DEFAULT/ink/wash/fg dark mode'da flip bo'ladi) + 50…900 shkala.
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
        "line-strong": "rgb(var(--border-strong) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--fg-muted) / <alpha-value>)",
        faint: "rgb(var(--fg-faint) / <alpha-value>)",
        // Semantik moliyaviy ranglar: income (yashil) / expense (qizil) / debt (jigarrang)
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
        debt: {
          DEFAULT: "rgb(var(--debt) / <alpha-value>)",
          soft: "rgb(var(--debt-soft) / <alpha-value>)",
          fg: "rgb(var(--debt-fg) / <alpha-value>)",
        },
        warning: "rgb(var(--warning) / <alpha-value>)",
        info: "rgb(var(--info) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          ink: "rgb(var(--brand-ink) / <alpha-value>)",
          wash: "rgb(var(--brand-wash) / <alpha-value>)",
          fg: "rgb(var(--brand-fg) / <alpha-value>)",
          // Brend shkalasi — mavzudan qat'i nazar bir xil (logo, grafik, akssent)
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
        },
        // Grafik kategoriya palitrasi (brend teal'dan boshlanadi, doimiy biriktiriladi)
        chart: {
          1: "#0F766E",
          2: "#2F6F91",
          3: "#B06A4A",
          4: "#6E7F52",
          5: "#7A5C82",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Segoe UI", "system-ui", "sans-serif"],
        display: ["var(--font-manrope)", "Manrope", "var(--font-inter)", "sans-serif"],
        // Brend sarlavha shrifti (Poppins 600/700) — logo so'zligi va hero sarlavhalar.
        // Pul summalari `font-display` (Manrope, tabular) da qoladi.
        heading: ["var(--font-poppins)", "Poppins", "var(--font-inter)", "sans-serif"],
      },
      fontSize: {
        // Type scale (REDESIGN.md): 12/13/15/17/20/26/34/46/60
        "2xs": ["0.75rem", { lineHeight: "1rem" }], // 12
        xs: ["0.8125rem", { lineHeight: "1.125rem" }], // 13
        sm: ["0.9375rem", { lineHeight: "1.375rem" }], // 15 (body min)
        base: ["1.0625rem", { lineHeight: "1.5rem" }], // 17 (kassir min)
        lg: ["1.25rem", { lineHeight: "1.6rem" }], // 20
        xl: ["1.625rem", { lineHeight: "1.9rem", letterSpacing: "-0.02em" }], // 26
        "2xl": ["2.125rem", { lineHeight: "2.4rem", letterSpacing: "-0.02em" }], // 34
        "3xl": ["2.875rem", { lineHeight: "3.1rem", letterSpacing: "-0.02em" }], // 46
        "4xl": ["3.75rem", { lineHeight: "3.9rem", letterSpacing: "-0.02em" }], // 60
      },
      borderRadius: {
        lg: "0.625rem", // 10 — input/tugma
        xl: "0.875rem", // 14 — kartochka
        "2xl": "1.25rem", // 20 — sheet/modal
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(12 26 33 / 0.04)",
        raised: "0 8px 28px 0 rgb(12 26 33 / 0.12)",
        // Landing kartochkalari — mavzuga qarab almashadi (globals.css).
        lift: "var(--shadow-lift)",
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

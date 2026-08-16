/**
 * WCAG kontrast tekshiruvi — DESIGN-SYSTEM.md dagi jadval SHU SKRIPTDAN
 * chiqadi, qo'lda yozilmaydi. Token o'zgarsa qayta ishga tushiriladi:
 *   node design/render/kontrast.mjs
 */
const L = (hex) => {
  const c = hex.replace("#", "");
  const v = [0, 2, 4].map((i) => {
    const s = parseInt(c.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const nisbat = (a, b) => {
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const LIGHT = {
  "bg-base": "#eff3f7", "bg-elevated": "#ffffff", "bg-elevated-2": "#f7fafc",
  "label-1": "#0f172a", "label-2": "#475569", "label-3": "#64748b", "label-4": "#78899e",
  accent: "#0f766e", income: "#15803d", expense: "#dc2626", debt: "#b45309",
  "income-on": "#15803d", "expense-on": "#b91c1c", "debt-on": "#b45309",
  "income-soft": "#dcfce7", "expense-soft": "#fee2e2", "debt-soft": "#fef3c7",
  "accent-wash": "#ccfbf1", "accent-on": "#ffffff",
};
const DARK = {
  "bg-base": "#061413", "bg-elevated": "#0d211f", "bg-elevated-2": "#132d2b",
  "label-1": "#e2f0ee", "label-2": "#94aca8", "label-3": "#7b9a95", "label-4": "#5b756f",
  accent: "#2dd4bf", income: "#4ade80", expense: "#f87171", debt: "#fbbf24",
  "income-on": "#86efac", "expense-on": "#fca5a5", "debt-on": "#fde047",
  "income-soft": "#0c3620", "expense-soft": "#3c1616", "debt-soft": "#38280c",
  "accent-wash": "#134e4a", "accent-on": "#061412",
};

// [matn, fon, minimal talab, izoh]
const JUFTLAR = [
  ["label-1", "bg-base", 4.5, "asosiy matn sahifada"],
  ["label-1", "bg-elevated", 4.5, "asosiy matn kartada"],
  ["label-2", "bg-elevated", 4.5, "ikkilamchi matn"],
  ["label-3", "bg-elevated", 4.5, "uchlamchi matn"],
  ["label-4", "bg-elevated", 3.0, "placeholder (AA katta/dekorativ)"],
  ["accent", "bg-elevated", 4.5, "havola / brend matn"],
  ["accent-on", "accent", 4.5, "tugma matni"],
  ["income", "bg-elevated", 4.5, "kirim summasi"],
  ["expense", "bg-elevated", 4.5, "chiqim summasi"],
  ["debt", "bg-elevated", 4.5, "qarz summasi"],
  ["income-on", "income-soft", 4.5, "kirim chipi"],
  ["expense-on", "expense-soft", 4.5, "chiqim chipi"],
  ["debt-on", "debt-soft", 4.5, "qarz chipi"],
  ["accent", "accent-wash", 4.5, "brend chipi"],
];

for (const [nom, T] of [["LIGHT", LIGHT], ["DARK", DARK]]) {
  console.log(`\n### ${nom}`);
  console.log("| Matn | Fon | Nisbat | Talab | Holat | Izoh |");
  console.log("|---|---|---:|---:|:-:|---|");
  for (const [f, b, min, izoh] of JUFTLAR) {
    const r = nisbat(T[f], T[b]);
    const ok = r >= min;
    console.log(`| \`${f}\` | \`${b}\` | **${r.toFixed(2)}** | ${min} | ${ok ? "✅" : "❌"} | ${izoh} |`);
  }
}

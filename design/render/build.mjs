/**
 * EKRAN HTML'LARINI GENERATSIYA QILADI.
 *
 *   node design/render/build.mjs
 *
 * Manba: design/render/ekranlar/*.mjs — har fayl bir yoki bir nechta ekran
 * ta'rifini eksport qiladi. Natija: design/render/screens/BAL-NNN-*.html
 *
 * NEGA GENERATSIYA: 100+ ekranni qo'lda HTML yozish nomuvofiqlik keltiradi.
 * Komponent bitta joyda (lib.mjs) o'zgarsa — barcha ekran yangilanadi.
 */

import { readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BU = dirname(fileURLToPath(import.meta.url));
const MANBA = join(BU, "ekranlar");
const CHIQISH = join(BU, "screens");

if (!existsSync(MANBA)) {
  console.error("design/render/ekranlar/ papkasi yo'q");
  process.exit(1);
}

// Har build toza boshlanadi — o'chirilgan ekran qolib ketmasin.
rmSync(CHIQISH, { recursive: true, force: true });
mkdirSync(CHIQISH, { recursive: true });

const modullar = readdirSync(MANBA).filter((f) => f.endsWith(".mjs")).sort();
let jami = 0;

for (const m of modullar) {
  const mod = await import(pathToFileURL(join(MANBA, m)).href);
  const ekranlar = mod.EKRANLAR ?? [];
  for (const e of ekranlar) {
    if (!e.id || !e.fayl || !e.html) {
      throw new Error(`${m}: ekran ta'rifi to'liq emas (id/fayl/html kerak)`);
    }
    writeFileSync(join(CHIQISH, `${e.fayl}.html`), e.html);
    jami++;
  }
  console.log(`  ${m} → ${ekranlar.length} ta`);
}

console.log(`\n${jami} ta ekran HTML generatsiya qilindi.`);

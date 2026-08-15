/**
 * BARCHA TESTLARNI KETMA-KET ISHGA TUSHIRUVCHI.
 *
 * package.json dagi "test:" bilan boshlanadigan HAR bir skriptni topadi va
 * ketma-ket ishga tushiradi. Har birining natijasi (o'tdi/yiqildi/necha soniya)
 * yig'iladi va oxirida jadval ko'rinishida chiqariladi. Bittasi ham yiqilsa
 * chiqish kodi 1 bo'ladi.
 *
 * KETMA-KET, ataylab: har test fayli o'z SQLite bazasini (prisma/test-*.db)
 * o'chirib qaytadan yaratadi va migratsiyalarni qo'llaydi. Parallel ishga
 * tushirish disk va migratsiya jadvalida poyga hosil qiladi.
 *
 * CHETLATILGANLAR (CHETLATILGAN ro'yxati) — CI muhitida bajarib bo'lmaydi:
 *   test:smoke    — Playwright brauzeri va ishlab turgan Next serverini talab qiladi
 *   test:postgres — haqiqiy Postgres ulanishini (PG_TEST_URL) talab qiladi
 * Ular jadvalda alohida "CI'da ishlatilmadi" belgisi bilan ko'rsatiladi.
 *
 * Ishga tushirish:
 *   npm run test:hammasi              — barcha mos testlar
 *   npm run test:hammasi -- test:kassa test:agregat   — faqat ko'rsatilganlari
 *   npm run test:hammasi -- --tashla=test:dialect     — bittasini vaqtincha chetlab o'tish
 *
 * `--tashla` faqat MA'LUM yiqilgan test uchun: u CI'da alohida qadamda
 * `continue-on-error` bilan ishga tushadi, ya'ni yashirilmaydi.
 * Ro'yxat: docs/CI-YIQILGAN-TESTLAR.md
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// CI muhitida bajarib bo'lmaydigan testlar va sababi.
const CHETLATILGAN = {
  "test:smoke": "brauzer (Playwright) va ishlab turgan server kerak",
  "test:postgres": "haqiqiy Postgres ulanishi (PG_TEST_URL) kerak",
};

// Bitta test uchun eng ko'p kutish vaqti. Osilib qolgan test butun quvurni
// to'xtatib qo'ymasligi uchun.
const VAQT_CHEGARASI_MS = 10 * 60 * 1000;

const paket = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const barchaTestlar = Object.keys(paket.scripts)
  .filter((n) => n.startsWith("test:"))
  // "test:hammasi" ning o'zi ro'yxatga tushmaydi — cheksiz rekursiya bo'lardi.
  .filter((n) => n !== "test:hammasi")
  .sort();

// Argument berilgan bo'lsa faqat o'shalar ishga tushadi (lokal nosozlik qidirish uchun).
const tanlangan = process.argv.slice(2).filter((a) => !a.startsWith("-"));

// --tashla=test:x,test:y — ma'lum yiqilgan testni vaqtincha ro'yxatdan chiqarish.
const tashlangan = process.argv
  .slice(2)
  .filter((a) => a.startsWith("--tashla="))
  .flatMap((a) => a.slice("--tashla=".length).split(",").filter(Boolean));

const nomalum = [...tanlangan, ...tashlangan].filter((t) => !barchaTestlar.includes(t));
if (nomalum.length > 0) {
  console.error(`XATO: package.json da bunday skript yo'q: ${nomalum.join(", ")}`);
  process.exit(2);
}

const soralgan = tanlangan.length > 0 ? tanlangan : barchaTestlar;
const rejalashtirilgan = soralgan.filter((n) => !Object.hasOwn(CHETLATILGAN, n) && !tashlangan.includes(n));
const otkazilgan = soralgan.filter((n) => Object.hasOwn(CHETLATILGAN, n) || tashlangan.includes(n));

/** Test nima uchun ishga tushmagani. */
const otkazishSababi = (n) =>
  Object.hasOwn(CHETLATILGAN, n) ? CHETLATILGAN[n] : "vaqtincha chetlatildi (--tashla) — docs/CI-YIQILGAN-TESTLAR.md";

const npmBuyrugi = process.platform === "win32" ? "npm.cmd" : "npm";

/** Bitta test skriptini ishga tushiradi va natijasini qaytaradi. */
function testniIshgaTushir(nom) {
  const boshlandi = Date.now();
  const res = spawnSync(npmBuyrugi, ["run", "--silent", nom], {
    stdio: "inherit",
    env: process.env,
    timeout: VAQT_CHEGARASI_MS,
    shell: process.platform === "win32",
  });
  const soniya = (Date.now() - boshlandi) / 1000;

  let holat = "OTDI";
  let izoh = "";
  if (res.error && res.error.code === "ETIMEDOUT") {
    holat = "YIQILDI";
    izoh = `vaqt chegarasi (${VAQT_CHEGARASI_MS / 1000}s) oshdi`;
  } else if (res.error) {
    holat = "YIQILDI";
    izoh = String(res.error.message);
  } else if (res.signal) {
    holat = "YIQILDI";
    izoh = `signal bilan to'xtadi: ${res.signal}`;
  } else if (res.status !== 0) {
    holat = "YIQILDI";
    izoh = `chiqish kodi ${res.status}`;
  }

  return { nom, holat, soniya, izoh };
}

/** Ustunlari tekislangan matnli jadval chizadi. */
function jadval(sarlavhalar, qatorlar) {
  const hammasi = [sarlavhalar, ...qatorlar];
  const enlar = sarlavhalar.map((_, i) => Math.max(...hammasi.map((q) => String(q[i]).length)));
  const chiziq = (chap, orta, ong) => chap + enlar.map((e) => "─".repeat(e + 2)).join(orta) + ong;
  const qator = (q) => "│ " + q.map((k, i) => String(k).padEnd(enlar[i])).join(" │ ") + " │";

  const satrlar = [chiziq("┌", "┬", "┐"), qator(sarlavhalar), chiziq("├", "┼", "┤")];
  for (const q of qatorlar) satrlar.push(qator(q));
  satrlar.push(chiziq("└", "┴", "┘"));
  return satrlar.join("\n");
}

console.log(`\nTestlar ishga tushirilmoqda: ${rejalashtirilgan.length} ta`);
if (otkazilgan.length > 0) {
  console.log(`O'tkazib yuborilgan: ${otkazilgan.length} ta (CI'da ishlatilmadi)`);
}

const natijalar = [];
for (const [i, nom] of rejalashtirilgan.entries()) {
  console.log(`\n──── [${i + 1}/${rejalashtirilgan.length}] ${nom} ────`);
  natijalar.push(testniIshgaTushir(nom));
}

const yiqilganlar = natijalar.filter((n) => n.holat === "YIQILDI");
const jamiSoniya = natijalar.reduce((s, n) => s + n.soniya, 0);

console.log("\n\n══════════════ XULOSA ══════════════\n");
console.log(
  jadval(
    ["Test", "Holat", "Soniya", "Izoh"],
    natijalar.map((n) => [n.nom, n.holat === "OTDI" ? "o'tdi" : "YIQILDI", n.soniya.toFixed(1), n.izoh])
  )
);

if (otkazilgan.length > 0) {
  console.log("\nCI'da ishlatilmadi:\n");
  console.log(
    jadval(
      ["Test", "Holat", "Sabab"],
      otkazilgan.map((n) => [n, "CI'da ishlatilmadi", otkazishSababi(n)])
    )
  );
}

console.log(
  `\nJami: ${natijalar.length} ta ishga tushdi — ${natijalar.length - yiqilganlar.length} o'tdi, ` +
    `${yiqilganlar.length} yiqildi, ${otkazilgan.length} o'tkazib yuborildi. ` +
    `Umumiy vaqt: ${jamiSoniya.toFixed(1)}s\n`
);

if (yiqilganlar.length > 0) {
  console.log("Yiqilgan testlar:");
  for (const n of yiqilganlar) console.log(`  - ${n.nom} (${n.izoh})`);
  process.exit(1);
}

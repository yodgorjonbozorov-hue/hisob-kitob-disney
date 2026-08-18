/**
 * ZAXIRANI TEKSHIRISH — "olindi" bilan "ishlaydi" bir xil emas (audit: P0-3).
 *
 *   node scripts/zaxira-tekshir.mjs <fayl>
 *
 * MUAMMO. Migratsiyadan oldingi zaxira YAGONA orqaga qaytish yo'li. Lekin
 * shu paytgacha yagona tekshiruv "skript 0 kod bilan tugadimi" edi. Bo'sh,
 * yarim yozilgan yoki buzilgan surat ham xuddi shunday 0 qaytaradi —
 * muammo esa aynan tiklash kunida, ya'ni eng yomon paytda ma'lum bo'lardi.
 *
 * SHUNING UCHUN zaxira olingandan KEYIN, migratsiya boshlanishidan OLDIN
 * fayl O'QIB ko'riladi:
 *
 *   .dump / .dump.enc      — `pg_restore --list` bilan (bazaga TEGMAYDI,
 *                            faqat arxiv ichidagi ro'yxatni chiqaradi);
 *   .json / .json.gz / .enc — JSON ochilib, jadval va yozuvlar sanaladi.
 *
 * Shifrlangan fayl avval ochiladi — ya'ni tekshiruv KALITNI ham sinaydi.
 * Kalit noto'g'ri bo'lsa zaxira o'qib bo'lmaydigan bo'ladi va buni ham
 * bugun bilgan yaxshi.
 *
 * BAZAGA HECH NARSA YOZILMAYDI va DATABASE_URL umuman kerak emas.
 *
 * NECHTA JADVAL KUTILADI:
 *
 *   node scripts/zaxira-tekshir.mjs <fayl> --jadvallar <N>
 *
 * `N` — MANBA bazadagi jadvallar soni (uni chaqiruvchi biladi: CI'da
 * preflight, `apply-hammasi.mjs` da provayder qatlami). Suratdagi jadvallar
 * shundan KAM bo'lsa — zaxira to'liq emas va migratsiya boshlanmaydi.
 *
 * Nega shu ko'rinishda. Faqat "0 jadval bo'lsa xato" qoidasi ikki holatni
 * chalkashtirardi: HALI BO'SH baza (birinchi migratsiya — bu normal) va
 * BUZILGAN surat (bu falokat). Birinchisini xato deb hisoblash butun
 * birinchi deploy'ni to'xtatib qo'yardi — o'lchandi. Ikkinchisini
 * e'tiborsiz qoldirish esa zaxirasiz migratsiyaga olib borardi. Manba
 * soni berilganda ikkalasi ham to'g'ri hal bo'ladi.
 *
 * `--jadvallar` berilmasa eski (ehtiyotkor) qoida ishlaydi: bo'sh surat rad
 * etiladi. Bu holatda chaqiruvchi manba haqida hech narsa aytmagan.
 */
import "dotenv/config";
import { readFileSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { deshifrla, shifrlanganmi } from "../src/lib/backup/shifr-asos.cjs";

const GZIP_SARLAVHA = [0x1f, 0x8b];

function xato(sarlavha, izoh) {
  console.error(`::error::${sarlavha}`);
  console.error(`\n❌ ${sarlavha}\n\n${izoh}\n`);
  process.exit(1);
}

const yol = process.argv[2];
if (!yol) xato("Zaxira fayli ko'rsatilmadi.", "Foydalanish: node scripts/zaxira-tekshir.mjs <fayl>");

/** Manba bazadagi jadvallar soni (chaqiruvchi bergan bo'lsa). */
const KUTILGAN = (() => {
  const i = process.argv.indexOf("--jadvallar");
  if (i === -1) return null;
  // Bo'sh qiymat (`--jadvallar ""`) — CI'da o'zgaruvchi to'ldirilmagani.
  // `Number("")` nolga aylanadi, ya'ni "baza bo'sh" degan YOLG'ON xulosa
  // chiqardi va bo'sh surat qabul qilinardi. Shuning uchun ochiq tekshiruv.
  const xom = (process.argv[i + 1] ?? "").trim();
  if (!/^\d+$/.test(xom)) return null;
  return Number(xom);
})();

/**
 * Suratdagi jadvallar soni yetarlimi.
 *
 * @param {number} topilgan suratdagi jadvallar soni
 */
function jadvalSoniniTekshir(topilgan) {
  if (KUTILGAN === null) {
    if (topilgan === 0) {
      xato(
        "Zaxirada bitta ham jadval yo'q.",
        `Fayl: ${yol}\n\nManba bazadagi jadvallar soni berilmagan (\`--jadvallar\`), ` +
          "shuning uchun\nbo'sh surat buzilgan deb qaraladi — migratsiya boshlanmaydi."
      );
    }
    return;
  }

  if (topilgan < KUTILGAN) {
    xato(
      "Zaxira TO'LIQ EMAS.",
      `Fayl: ${yol}\n` +
        `Manba bazada ${KUTILGAN} ta jadval bor, suratda esa ${topilgan} ta.\n\n` +
        "Yetishmayotgan jadvallar tiklashda QAYTMAYDI — migratsiya boshlanmaydi."
    );
  }

  if (KUTILGAN === 0) {
    console.log("  Manba baza bo'sh — bo'sh surat kutilgan holat (birinchi migratsiya).");
  }
}

if (!existsSync(yol)) {
  xato(
    "Zaxira fayli topilmadi.",
    `Kutilgan: ${yol}\n\nZaxira qadami muvaffaqiyatli tugagandek ko'ringan, lekin fayl yo'q.`
  );
}

const olcham = statSync(yol).size;
if (olcham === 0) {
  xato("Zaxira fayli BO'SH (0 bayt).", `Fayl: ${yol}\n\nBunday zaxiradan tiklab bo'lmaydi.`);
}

let bayt = readFileSync(yol);
const shifrlangan = shifrlanganmi(bayt);
if (shifrlangan) {
  try {
    bayt = deshifrla(bayt);
  } catch (e) {
    xato(
      "Shifrlangan zaxira OCHILMADI.",
      `Fayl: ${yol}\nSabab: ${e.message}\n\n` +
        "BACKUP_ENCRYPTION_KEY zaxira olingandagidan boshqa bo'lishi mumkin.\n" +
        "Bu zaxira hozir ham, keyin ham tiklanmaydi."
    );
  }
}

console.log(`Zaxira: ${yol}`);
console.log(`  Hajmi: ${(olcham / 1024).toFixed(0)} KB${shifrlangan ? " (shifrlangan)" : ""}`);

/** `pg_dump --format=custom` arxivi shu sehrli satr bilan boshlanadi. */
const PG_SARLAVHA = "PGDMP";

if (bayt.subarray(0, PG_SARLAVHA.length).toString("latin1") === PG_SARLAVHA) {
  // Arxiv ichidagi ro'yxat — bazaga ulanmasdan o'qiladi.
  const res = spawnSync("pg_restore", ["--list"], {
    input: bayt,
    maxBuffer: 1024 * 1024 * 512,
    encoding: "utf8",
  });
  if (res.status !== 0) {
    xato(
      "pg_dump arxivi o'qilmadi.",
      `Fayl: ${yol}\npg_restore: ${String(res.stderr).slice(0, 400)}\n\n` +
        "Surat buzilgan — undan tiklab bo'lmaydi."
    );
  }

  const jadvallar = [...String(res.stdout).matchAll(/^\d+;.*\bTABLE DATA\b\s+\S+\s+(\S+)/gm)].map(
    (m) => m[1]
  );

  console.log(`  Format: pg_dump custom, ${jadvallar.length} ta jadval ma'lumoti`);
  jadvalSoniniTekshir(jadvallar.length);
  console.log("\n✅ Zaxira o'qildi va yaroqli — migratsiyaga o'tish mumkin.");
} else {
  if (bayt[0] === GZIP_SARLAVHA[0] && bayt[1] === GZIP_SARLAVHA[1]) bayt = gunzipSync(bayt);

  let surat;
  try {
    surat = JSON.parse(bayt.toString("utf8"));
  } catch (e) {
    xato("Zaxira JSON sifatida o'qilmadi.", `Fayl: ${yol}\nSabab: ${e.message}`);
  }

  // Ikki format bor: xom surat (`jadvallar`) va Prisma zaxirasi (`counts`).
  const jadvallar = surat.jadvallar
    ? Object.entries(surat.jadvallar).map(([n, v]) => [n, v.qatorlar?.length ?? 0])
    : Object.entries(surat.counts ?? {});

  const jami = jadvallar.reduce((s, [, n]) => s + Number(n), 0);
  console.log(`  Format: JSON, ${jadvallar.length} ta jadval, ${jami} yozuv`);
  jadvalSoniniTekshir(jadvallar.length);
  console.log("\n✅ Zaxira o'qildi va yaroqli — migratsiyaga o'tish mumkin.");
}

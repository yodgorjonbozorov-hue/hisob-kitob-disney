// CI test yugurtiruvchisi.
//
// Loyihada yagona "hammasi" test buyrug'i yo'q — har to'plam `package.json`
// dagi alohida `test:*` skripti. Ro'yxatni bu yerda QO'LDA saqlash xato
// manbai bo'lardi: yangi test qo'shilsa CI'da jimgina ishga tushmay qolardi.
// Shuning uchun ro'yxat `package.json` dan o'qiladi.
//
// Farqi `npm run test:x && npm run test:y ...` dan: birinchi qizil to'plam
// qolganlarini to'xtatmaydi. CI bitta yugurishda TO'LIQ manzarani beradi —
// qaysilar o'tdi, qaysilar yiqildi.
//
// Ishlatish:
//   node scripts/ci-testlar.mjs                 — barcha test:* skriptlari
//   node scripts/ci-testlar.mjs --tashla a,b    — 'test:a' va 'test:b' dan tashqari
//   node scripts/ci-testlar.mjs --faqat a,b     — faqat 'test:a' va 'test:b'
import { spawnSync } from "node:child_process";
import { readFileSync, appendFileSync } from "node:fs";

const argv = process.argv.slice(2);

/** `--kalit qiymat` yoki `--kalit=qiymat` ni vergul bo'yicha ro'yxatga aylantiradi. */
function royxat(kalit) {
  const i = argv.indexOf(`--${kalit}`);
  const xom = i !== -1 ? argv[i + 1] : argv.find((a) => a.startsWith(`--${kalit}=`))?.split("=")[1];
  return xom ? xom.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

const tashla = new Set(royxat("tashla"));
const faqat = new Set(royxat("faqat"));

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const nomlar = Object.keys(pkg.scripts)
  .filter((s) => s.startsWith("test:"))
  .map((s) => s.slice("test:".length))
  .filter((n) => (faqat.size ? faqat.has(n) : true))
  .filter((n) => !tashla.has(n));

if (nomlar.length === 0) {
  console.error("XATO: ishga tushiriladigan test topilmadi.");
  process.exit(1);
}

console.log(`${nomlar.length} ta test to'plami ishga tushiriladi.\n`);

const natijalar = [];

for (const nom of nomlar) {
  const boshi = Date.now();
  // GitHub log'ida har to'plam yig'iladigan blok bo'lib chiqadi.
  console.log(`::group::test:${nom}`);
  const res = spawnSync("npm", ["run", `test:${nom}`, "--silent"], {
    stdio: "inherit",
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  console.log("::endgroup::");

  const soniya = Math.round((Date.now() - boshi) / 1000);
  const otdi = res.status === 0;
  natijalar.push({ nom, otdi, soniya });

  if (otdi) {
    console.log(`✅ test:${nom} — ${soniya}s`);
  } else {
    // `::error::` GitHub'ning "Annotations" bo'limida ko'rinadi.
    console.log(`::error::test:${nom} YIQILDI (kod ${res.status}) — ${soniya}s`);
  }
}

const yiqilgan = natijalar.filter((r) => !r.otdi);
const otgan = natijalar.filter((r) => r.otdi);

console.log(`\n${"=".repeat(56)}`);
console.log(`O'TDI: ${otgan.length}/${natijalar.length}`);
if (yiqilgan.length) console.log(`YIQILDI: ${yiqilgan.map((r) => `test:${r.nom}`).join(", ")}`);

// GitHub Actions xulosasi (Summary sahifasi).
if (process.env.GITHUB_STEP_SUMMARY) {
  const satrlar = [
    `### Testlar: ${otgan.length}/${natijalar.length} o'tdi`,
    "",
    "| To'plam | Natija | Vaqt |",
    "| --- | --- | --- |",
    ...natijalar.map((r) => `| \`test:${r.nom}\` | ${r.otdi ? "✅" : "❌"} | ${r.soniya}s |`),
    "",
  ];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, satrlar.join("\n"));
}

process.exit(yiqilgan.length ? 1 : 0);

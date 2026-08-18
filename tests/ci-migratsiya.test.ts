/**
 * MIGRATSIYA CI ZANJIRI — REGRESSIYA TESTI (audit: P0-3).
 *
 * NIMA QO'RIQLANADI. P0-3 zaxira va migratsiyani Vercel BUILD'idan olib,
 * migratsiya CI'siga ko'chirdi (`.github/workflows/migratsiya.yml`). Sabab:
 * PostgreSQL zaxirasi `pg_dump` ga tayanadi, Vercel build image'ida esa u
 * YO'Q — natijada har deploy yo to'xtardi, yo `ZAXIRASIZ_DAVOM=ha` bilan
 * chetlab o'tilib ZAXIRASIZ migratsiya qilinardi.
 *
 * Bu ko'chishning qiymati butunlay TO'XTATUVCHI mantiqda: qaysi holatda
 * hech narsa qilinmasligi. Shuning uchun testlarning ko'pi "muvaffaqiyat"
 * emas, ANIQ MUVAFFAQIYATSIZLIK ni tekshiradi — chiqish kodi 1, sabab
 * matni, va eng muhimi: bazaga/faylga TEGILMAGANI.
 *
 * Ishga tushirish:
 *   npm run test:ci-migratsiya
 *   PG_TEST_URL="postgresql://postgres:postgres@127.0.0.1:5432/balansa_p03" \
 *     npm run test:ci-migratsiya      # + haqiqiy PostgreSQL 16 testlari
 *
 * `PG_TEST_URL` berilmasa bazaga tegadigan testlar o'tkazib yuboriladi.
 * ⚠️ Ko'rsatilgan baza TOZALANADI. PRODUCTION bazani BERMANG.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client as PgClient } from "pg";

let provider: typeof import("../src/lib/db/provider.cjs");
let shifr: typeof import("../src/lib/backup/shifr-asos.cjs");

/** `.github/workflows/migratsiya.yml` matni (test 20-23 uni tahlil qiladi). */
const YML_YOL = ".github/workflows/migratsiya.yml";

const PG = process.env.PG_TEST_URL;
const sabab = PG ? undefined : "PG_TEST_URL sozlanmagan — Postgres testlari o'tkazib yuborildi";

const ILDIZ = process.cwd();
const KALIT = randomBytes(32).toString("hex");

/** Sirlarni test log'iga chiqmaydigan, lekin "ko'zga tashlanadigan" qilib beramiz. */
const SIR_PAROL = "PAROL-CHIQMASIN-9F3A";
const SIR_URL = `postgresql://balansa:${SIR_PAROL}@db.example.com:5432/prod`;

let c: PgClient | undefined;
let vaqtinchalik: string[] = [];

/** Har test o'z papkasida ishlaydi — bir-birining fayllarini ko'rmasin. */
function papkaOch(nom: string): string {
  const p = mkdtempSync(join(tmpdir(), `${nom}-`));
  vaqtinchalik.push(p);
  return p;
}

/** Skriptni loyiha ildizidan ishga tushiradi (env to'liq boshqariladi). */
function ishga(skript: string, args: string[], env: Record<string, string | undefined>) {
  return spawnSync(process.execPath, [skript, ...args], {
    cwd: ILDIZ,
    env: { ...process.env, PG_TEST_URL: undefined, ...env },
    encoding: "utf8",
  });
}

/** Preflight uchun to'liq (ishlaydigan) env — testlar undan bittasini olib tashlaydi. */
function toliqEnv(url: string): Record<string, string | undefined> {
  return {
    DATABASE_URL: url,
    MIGRATSIYA_RUXSAT: "ha",
    BACKUP_ENCRYPTION_KEY: KALIT,
    GITHUB_OUTPUT: undefined,
  };
}

before(async () => {
  provider = await import("../src/lib/db/provider.cjs");
  shifr = await import("../src/lib/backup/shifr-asos.cjs");
  if (!PG) return;
  const { Client } = await import("pg");
  c = new Client({ connectionString: PG });
  await c.connect();
  // Toza boshlanish: bu baza faqat test uchun.
  await c.query("DROP SCHEMA IF EXISTS public CASCADE");
  await c.query("CREATE SCHEMA public");
});

after(async () => {
  if (c) await c.end();
  for (const p of vaqtinchalik) rmSync(p, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════
// 1. Ulanish satri log'ga CHIQMAYDI
// ═══════════════════════════════════════════════════════════════════════

test("1. yashirUrl parol va tokenni maskalaydi, host/baza nomini qoldiradi", () => {
  const { yashirUrl } = provider;
  const pg = yashirUrl(SIR_URL);
  assert.ok(!pg.includes(SIR_PAROL), "parol chiqib qolmasligi kerak");
  assert.match(pg, /^postgresql:\/\/\*\*\*@db\.example\.com:5432\/prod$/);

  const turso = yashirUrl("libsql://balansa-prod.turso.io?authToken=eyJ.MAXFIY.sig");
  assert.ok(!turso.includes("MAXFIY"));
  assert.match(turso, /authToken=\*\*\*/);
  assert.match(turso, /balansa-prod\.turso\.io/, "nosozlikni tushunish uchun host qolsin");

  // Lokal bazada maskalanadigan narsa yo'q — o'zgarmay qolsin.
  assert.equal(yashirUrl("file:./prisma/dev.db"), "file:./prisma/dev.db");
  assert.equal(yashirUrl(""), "(sozlanmagan)");
  assert.equal(yashirUrl(undefined), "(sozlanmagan)");
});

test("2. preflight XATO matnlarida DATABASE_URL siri chiqmaydi", () => {
  // Sxema tanilmaydigan holat: URL xato matnida ko'rsatiladi — maskalangan holda.
  const res = ishga("scripts/migratsiya-preflight.mjs", [], {
    ...toliqEnv(`bekor://balansa:${SIR_PAROL}@host/db`),
  });

  assert.equal(res.status, 1);
  const hammasi = res.stdout + res.stderr;
  assert.ok(!hammasi.includes(SIR_PAROL), "parol preflight log'iga chiqmasligi kerak");
  assert.match(res.stderr, /tanib bo'lmaydigan sxema/);
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Preflight TO'XTATADI (bazaga tegmasdan)
// ═══════════════════════════════════════════════════════════════════════

test("3. preflight: DATABASE_URL yo'q bo'lsa to'xtaydi", () => {
  const res = ishga("scripts/migratsiya-preflight.mjs", [], {
    ...toliqEnv(""),
    DATABASE_URL: "",
  });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /DATABASE_URL sozlanmagan/);
  assert.match(res.stderr, /::error::/, "CI log'ida ko'rinishi uchun ::error:: bo'lishi kerak");
});

test("4. preflight: MIGRATSIYA_RUXSAT=ha bo'lmasa to'xtaydi (bazaga ULANMAYDI)", () => {
  // Ataylab ULANIB BO'LMAYDIGAN manzil beriladi: agar skript bayroqni
  // tekshirmasdan ulanishga o'tsa, xato "ulanib bo'lmadi" bo'lardi.
  const res = ishga("scripts/migratsiya-preflight.mjs", [], {
    ...toliqEnv("postgresql://x:y@127.0.0.1:1/yoq"),
    MIGRATSIYA_RUXSAT: undefined,
  });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /MIGRATSIYA_RUXSAT=ha berilmagan/);
  assert.ok(!/ulanib bo'lmadi/i.test(res.stderr), "ulanishga umuman o'tmasligi kerak");
});

test("5. preflight: BACKUP_ENCRYPTION_KEY yo'q bo'lsa to'xtaydi (fail-closed)", () => {
  const res = ishga("scripts/migratsiya-preflight.mjs", [], {
    ...toliqEnv("postgresql://x:y@127.0.0.1:1/yoq"),
    BACKUP_ENCRYPTION_KEY: undefined,
  });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /BACKUP_ENCRYPTION_KEY sozlanmagan/);
  // Eng muhimi: shu paytgacha zaxira OLINMAGAN, ya'ni ochiq fayl yo'q.
  assert.match(res.stderr, /Zaxira OLINMADI/);
});

test("6. preflight: pg_dump yo'q bo'lsa to'xtaydi (zaxirasiz migratsiya bo'lmaydi)", () => {
  // `pg_dump` ni PATH'dan yo'qotamiz — Vercel build muhitidagi holat.
  const bosh = papkaOch("bosh-path");
  const res = ishga("scripts/migratsiya-preflight.mjs", [], {
    ...toliqEnv("postgresql://x:y@127.0.0.1:1/yoq"),
    PATH: `${bosh}:${join(ILDIZ, "node_modules/.bin")}`,
  });

  assert.equal(res.status, 1);
  assert.match(res.stderr, /pg_dump topilmadi/);
  assert.match(res.stderr, /ZAXIRASIZ migratsiya\n?\s*qilinmaydi/);
  assert.match(res.stderr, /Baza O'ZGARTIRILMADI/);
});

test("7. preflight: SQLite yo'lida pg_dump talab qilinmaydi", () => {
  const bosh = papkaOch("bosh-path-sqlite");
  const res = ishga("scripts/migratsiya-preflight.mjs", [], {
    ...toliqEnv("file:./prisma/dev.db"),
    PATH: `${bosh}:${join(ILDIZ, "node_modules/.bin")}`,
  });

  assert.equal(res.status, 0, "SQLite yo'li Postgres vositalariga bog'liq emas");
  assert.match(res.stdout, /provayder=sqlite/);
  assert.match(res.stdout, /pg_dump. talab qilinmaydi/);
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Zaxira TEKSHIRUVI — "olindi" bilan "ishlaydi" bir xil emas
// ═══════════════════════════════════════════════════════════════════════

test("8. zaxira-tekshir: yo'q, bo'sh va buzilgan fayllarni RAD etadi", () => {
  const p = papkaOch("zaxira-tekshir");

  const yoq = ishga("scripts/zaxira-tekshir.mjs", [join(p, "yoq.json")], {});
  assert.equal(yoq.status, 1);
  assert.match(yoq.stderr, /topilmadi/);

  const bosh = join(p, "bosh.json");
  writeFileSync(bosh, "");
  const bo = ishga("scripts/zaxira-tekshir.mjs", [bosh], {});
  assert.equal(bo.status, 1);
  assert.match(bo.stderr, /BO'SH \(0 bayt\)/);

  const buzuq = join(p, "buzuq.json");
  writeFileSync(buzuq, "{ bu json emas");
  const bu = ishga("scripts/zaxira-tekshir.mjs", [buzuq], {});
  assert.equal(bu.status, 1);
  assert.match(bu.stderr, /JSON sifatida o'qilmadi/);

  // Sintaktik to'g'ri, lekin ichida jadval yo'q — tiklab bo'lmaydi.
  const bosh2 = join(p, "jadvalsiz.json");
  writeFileSync(bosh2, JSON.stringify({ olingan: "2026-08-18", jadvallar: {} }));
  const j = ishga("scripts/zaxira-tekshir.mjs", [bosh2], {});
  assert.equal(j.status, 1);
  assert.match(j.stderr, /bitta ham jadval yo'q/);
});

test("9. zaxira-tekshir: yaroqli xom suratni qabul qiladi va yozuvlarni sanaydi", () => {
  const p = papkaOch("zaxira-yaroqli");
  const fayl = join(p, "surat.json");
  writeFileSync(
    fayl,
    JSON.stringify({
      olingan: "2026-08-18",
      jadvallar: { Business: { qatorlar: [{ id: "b1" }] }, User: { qatorlar: [{ id: "u1" }] } },
    })
  );

  const res = ishga("scripts/zaxira-tekshir.mjs", [fayl], {});
  assert.equal(res.status, 0);
  assert.match(res.stdout, /2 ta jadval, 2 yozuv/);
  assert.match(res.stdout, /yaroqli/);
});

test("10. zaxira-tekshir: NOTO'G'RI kalitli shifrlangan zaxirani RAD etadi", () => {
  // Kalit almashib ketgan holat: zaxira bor, lekin OCHILMAYDI. Buni
  // tiklash kunida emas, BUGUN bilish kerak.
  const p = papkaOch("zaxira-kalit");
  const fayl = join(p, "surat.json.enc");
  const boshqaKalit = randomBytes(32).toString("hex");

  const oldin = process.env.BACKUP_ENCRYPTION_KEY;
  process.env.BACKUP_ENCRYPTION_KEY = boshqaKalit;
  writeFileSync(fayl, shifr.shifrla(Buffer.from(JSON.stringify({ jadvallar: {} }), "utf8")));
  process.env.BACKUP_ENCRYPTION_KEY = oldin;

  const res = ishga("scripts/zaxira-tekshir.mjs", [fayl], { BACKUP_ENCRYPTION_KEY: KALIT });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /OCHILMADI/);
  assert.match(res.stderr, /boshqa bo'lishi mumkin/);
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Artefakt SHIFRLANADI — GitHub artefakti ochiq ZIP
// ═══════════════════════════════════════════════════════════════════════

test("11. zaxira-shifrla: kalitsiz TO'XTAYDI va faylni o'zgartirmaydi (fail-closed)", () => {
  const p = papkaOch("shifr-kalitsiz");
  const fayl = join(p, "surat.json");
  const asl = JSON.stringify({ jadvallar: { Business: { qatorlar: [] } } });
  writeFileSync(fayl, asl);

  const res = ishga("scripts/zaxira-shifrla.mjs", [p], { BACKUP_ENCRYPTION_KEY: undefined });

  assert.equal(res.status, 1);
  assert.match(res.stderr, /BACKUP_ENCRYPTION_KEY sozlanmagan/);
  assert.equal(readFileSync(fayl, "utf8"), asl, "fayl o'zgarmasligi kerak");
  assert.ok(!existsSync(`${fayl}.enc`), "yarim shifrlangan nusxa qolmasligi kerak");
});

test("12. zaxira-shifrla: shifrlaydi, OCHIQ nusxani qoldirmaydi, idempotent", () => {
  const p = papkaOch("shifr-ishlaydi");
  const fayl = join(p, "surat.json");
  const asl = JSON.stringify({ jadvallar: { Business: { qatorlar: [{ id: "b1" }] } } });
  writeFileSync(fayl, asl);

  const res = ishga("scripts/zaxira-shifrla.mjs", [p], { BACKUP_ENCRYPTION_KEY: KALIT });
  assert.equal(res.status, 0);

  assert.ok(existsSync(`${fayl}.enc`), "shifrlangan nusxa yaratilishi kerak");
  assert.ok(!existsSync(fayl), "OCHIQ nusxa o'chirilishi kerak — artefaktga aynan u tushardi");

  const shifrlangan = readFileSync(`${fayl}.enc`);
  assert.ok(shifr.shifrlanganmi(shifrlangan), "AES-256-GCM sarlavhasi bo'lishi kerak");
  assert.ok(!shifrlangan.toString("latin1").includes("Business"), "ochiq matn qolmasin");

  /** Kalitni vaqtincha qo'yib ochadi (test jarayonining env'i o'zgarmasin). */
  const ochib = (y: string) => {
    const eski = process.env.BACKUP_ENCRYPTION_KEY;
    process.env.BACKUP_ENCRYPTION_KEY = KALIT;
    try {
      return shifr.deshifrla(readFileSync(y)).toString("utf8");
    } finally {
      process.env.BACKUP_ENCRYPTION_KEY = eski;
    }
  };

  // Round-trip: aynan o'sha zaxira qaytadi.
  assert.equal(ochib(`${fayl}.enc`), asl);

  // Qayta chaqirish xavfsiz — ikki marta shifrlanmaydi.
  const qayta = ishga("scripts/zaxira-shifrla.mjs", [p], { BACKUP_ENCRYPTION_KEY: KALIT });
  assert.equal(qayta.status, 0);
  assert.match(qayta.stdout, /allaqachon shifrlangan/);
  assert.equal(ochib(`${fayl}.enc`), asl, "qayta chaqiruvdan keyin ham ochilishi kerak");
});

// ═══════════════════════════════════════════════════════════════════════
// 5. `apply-hammasi` — provayderga mos va bayroqsiz yozmaydi
// ═══════════════════════════════════════════════════════════════════════

test("13. apply-hammasi: Postgres'da MIGRATSIYA_RUXSAT'siz TO'XTAYDI", () => {
  const res = ishga("scripts/apply-hammasi.mjs", [], {
    DATABASE_URL: SIR_URL,
    MIGRATSIYA_RUXSAT: undefined,
    BACKUP_ENCRYPTION_KEY: KALIT,
  });

  assert.equal(res.status, 1);
  assert.match(res.stdout + res.stderr, /MIGRATSIYA_RUXSAT=ha talab qilinadi/);
  assert.match(res.stdout + res.stderr, /Baza O'ZGARTIRILMADI/);
  assert.ok(!(res.stdout + res.stderr).includes(SIR_PAROL), "parol log'ga chiqmasligi kerak");
});

test("14. apply-hammasi: Postgres'da pg_dump yo'q bo'lsa bazaga TEGMASDAN to'xtaydi", () => {
  const bosh = papkaOch("apply-bosh-path");
  const res = ishga("scripts/apply-hammasi.mjs", [], {
    DATABASE_URL: SIR_URL,
    MIGRATSIYA_RUXSAT: "ha",
    BACKUP_ENCRYPTION_KEY: KALIT,
    PATH: `${bosh}:${join(ILDIZ, "node_modules/.bin")}`,
  });

  assert.equal(res.status, 1);
  assert.match(res.stdout + res.stderr, /pg_dump topilmadi/);
  // Ulanish OCHILMAGAN bo'lishi kerak: tekshiruv ulanishdan OLDIN turadi.
  assert.ok(
    !/Hozirgi holat/.test(res.stdout),
    "baza holati o'qilmasligi kerak — hali hech narsa boshlanmagan"
  );
});

test("15. apply-hammasi: SQLite yo'li o'zgarmadi (to'liq oqim, regressiya)", () => {
  const p = papkaOch("apply-sqlite");
  const db = `file:${join(p, "sqlite-oqim.db")}`;

  // Bazani qurib olamiz — apply-hammasi mavjud baza ustida ishlaydi.
  assert.equal(ishga("scripts/db-migrate.mjs", [], { DATABASE_URL: db }).status, 0);

  const res = ishga("scripts/apply-hammasi.mjs", [], {
    DATABASE_URL: db,
    MIGRATSIYA_RUXSAT: undefined, // SQLite yo'liga bayroq KERAK EMAS
    BACKUP_ENCRYPTION_KEY: KALIT,
  });

  assert.equal(res.status, 0, `SQLite oqimi o'tishi kerak:\n${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /Baza yaxlitligi: ok/, "SQLite PRAGMA tekshiruvi saqlanishi kerak");
  assert.match(res.stdout, /Tashqi kalitlar: 0 ta buzilish/);
  assert.match(res.stdout, /HAMMASI MUVAFFAQIYATLI/);
  // Yangi qadam: zaxira olinibgina qolmay, O'QIB ham ko'riladi.
  assert.match(res.stdout, /Surat olindi va tekshirildi/);
});

test("16. apply-hammasi: tayyor surat (--surat) tekshiriladi, ishonchga olinmaydi", () => {
  const p = papkaOch("apply-surat");
  const db = `file:${join(p, "surat-oqim.db")}`;
  assert.equal(ishga("scripts/db-migrate.mjs", [], { DATABASE_URL: db }).status, 0);

  const yolg = join(p, "yolgon-surat.json");
  writeFileSync(yolg, "{ buzuq");

  const res = ishga("scripts/apply-hammasi.mjs", ["--surat", yolg], {
    DATABASE_URL: db,
    BACKUP_ENCRYPTION_KEY: KALIT,
  });

  assert.equal(res.status, 1, "yaroqsiz surat bilan davom etmasligi kerak");
  assert.match(res.stdout + res.stderr, /Zaxira tekshiruvi muvaffaqiyatsiz/);
  assert.ok(!/Kassa migratsiyasi tugadi/.test(res.stdout), "keyingi qadamlar bajarilmasin");
});

// ═══════════════════════════════════════════════════════════════════════
// 6. BUILD zanjiri `pg_dump` talab QILMAYDI (P0-3 ning asosiy maqsadi)
// ═══════════════════════════════════════════════════════════════════════

test("17. build: Postgres + pg_dump YO'Q bo'lsa ham zaxira qadami yiqilmaydi", () => {
  const bosh = papkaOch("build-bosh-path");
  const res = ishga("scripts/deploy-zaxira.mjs", [], {
    DATABASE_URL: SIR_URL,
    MIGRATSIYA_RUXSAT: undefined, // Vercel build — bayroq yo'q
    BACKUP_ENCRYPTION_KEY: KALIT,
    PATH: `${bosh}:${join(ILDIZ, "node_modules/.bin")}`,
  });

  assert.equal(res.status, 0, `build zaxira qadami o'tishi kerak:\n${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /zaxira CI'da olinadi/);
  assert.ok(!(res.stdout + res.stderr).includes(SIR_PAROL));
});

test("18. build: Postgres migratsiyasi build ichida JIMGINA bajarilmaydi", () => {
  const kod = readFileSync("scripts/db-migrate.mjs", "utf8");
  assert.match(kod, /migratsiyaRuxsati\(\)/, "build/CI ajratmasi bo'lishi kerak");
  assert.match(kod, /kutayotganlarniTekshir/, "build'da faqat O'QISH tekshiruvi bo'lsin");
});

test("19. build zanjirida ZAXIRASIZ_DAVOM ishlatilmaydi (CI'da ham)", () => {
  // Izohlar olib tashlanadi: workflow'ning boshida bu bayroq NEGA
  // ishlatilmasligi tushuntirilgan — izohdagi eslatma "ishlatilyapti"
  // degani emas.
  const kod = readFileSync(YML_YOL, "utf8")
    .split("\n")
    .filter((s) => !/^\s*#/.test(s))
    .join("\n");

  assert.ok(
    !/ZAXIRASIZ_DAVOM/.test(kod),
    "zaxirasiz migratsiya — qaytish yo'lisiz migratsiya"
  );
});

// ═══════════════════════════════════════════════════════════════════════
// 7. Workflow fayli — tartib, sirlar, artefakt
// ═══════════════════════════════════════════════════════════════════════

/**
 * Workflow qadamlarining nomlarini tartib bilan beradi.
 *
 * YAML kutubxonasi ATAYLAB ishlatilmadi: loyihada bunday bog'liqlik yo'q va
 * faqat test uchun qo'shish — CI'ni yana bitta paketga bog'lash. Bizga
 * kerak bo'lgani qadam NOMLARI va ularning TARTIBI, buni `- name:`
 * satrlaridan aniq olish mumkin.
 */
function ymlQadamlar(): string[] {
  return [...readFileSync(YML_YOL, "utf8").matchAll(/^\s*-\s*name:\s*(.+)$/gm)].map((m) =>
    m[1].trim()
  );
}

test("20. migratsiya.yml: qadamlar tartibi — zaxira MIGRATSIYADAN OLDIN", () => {
  const qadamlar = ymlQadamlar();
  const joy = (qism: string) => qadamlar.findIndex((n) => n.includes(qism));

  const tartib = {
    preflight: joy("Preflight"),
    zaxira: joy("Zaxira (xom surat)"),
    tekshiruv: joy("Zaxira tekshiruvi"),
    migratsiya: joy("Migratsiya + kassa"),
    shifrlash: joy("Zaxirani shifrlash"),
    yuklash: joy("Zaxirani saqlash"),
  };

  for (const [nom, i] of Object.entries(tartib)) {
    assert.ok(i >= 0, `${nom} qadami topilmadi`);
  }

  assert.ok(tartib.preflight < tartib.zaxira, "preflight zaxiradan oldin");
  assert.ok(tartib.zaxira < tartib.tekshiruv, "zaxira tekshiruvdan oldin");
  assert.ok(
    tartib.tekshiruv < tartib.migratsiya,
    "tekshirilmagan zaxira bilan migratsiya boshlanmasin"
  );
  assert.ok(tartib.migratsiya < tartib.shifrlash, "shifrlash migratsiyadan keyin");
  assert.ok(tartib.shifrlash < tartib.yuklash, "artefakt shifrlangandan KEYIN yuklansin");
});

test("21. migratsiya.yml: MIGRATSIYA_RUXSAT=ha faqat shu workflow'da beriladi", () => {
  assert.match(
    readFileSync(YML_YOL, "utf8"),
    /^\s{4}env:\n\s{6}MIGRATSIYA_RUXSAT:\s*ha$/m,
    "bayroq job darajasida berilishi kerak"
  );

  // Boshqa workflow'lar bazaga yozadigan bayroqni bermasin.
  for (const fayl of ["ci.yml", "kochirish.yml", "toliq-launch.yml", "twa-build.yml"]) {
    const matn = readFileSync(join(".github/workflows", fayl), "utf8");
    assert.ok(
      !/MIGRATSIYA_RUXSAT\s*:\s*["']?ha/.test(matn),
      `${fayl} bazaga yozish bayrog'ini bermasligi kerak`
    );
  }
});

test("22. migratsiya.yml: artefaktga FAQAT shifrlangan fayl yuklanadi", () => {
  const yml = readFileSync(YML_YOL, "utf8");
  assert.match(yml, /uses:\s*actions\/upload-artifact/, "artefakt qadami bo'lishi kerak");

  const yollar = [...yml.matchAll(/^\s*path:\s*(.+)$/gm)].map((m) => m[1].trim());
  assert.ok(yollar.length > 0, "artefakt yo'li topilmadi");
  for (const y of yollar) {
    assert.match(y, /\*\.enc$/, `butun papka emas, faqat .enc yuklansin (topildi: ${y})`);
  }
});

test("23. migratsiya.yml: sirlar `run:` blokiga qo'yilmaydi va log'ga chiqmaydi", () => {
  const yml = readFileSync(YML_YOL, "utf8");

  // Sirlar faqat `env:` orqali uzatilsin — `run:` ichidagi `${{ secrets.X }}`
  // buyruq satriga kiradi va `set -x` / xato matnida ko'rinib qolishi mumkin.
  const runBloklar = [...yml.matchAll(/^(\s*)run:\s*\|?\n((?:\1\s+.*\n|\s*\n)*)/gm)].map(
    (m) => m[2]
  );
  assert.ok(runBloklar.length > 0, "run bloklari topilmadi — regex eskirgan bo'lishi mumkin");

  for (const blok of runBloklar) {
    assert.ok(!/secrets\./.test(blok), `sekret buyruq satriga qo'yilgan:\n${blok}`);
    assert.ok(!/echo[^\n]*DATABASE_URL/.test(blok), `DATABASE_URL log'ga chiqmoqda:\n${blok}`);
  }

  // Artefakt nomi ham sirdan yasalmasin.
  assert.ok(!/name:\s*.*secrets\./.test(yml), "artefakt/qadam nomida sekret bo'lmasin");
});

// ═══════════════════════════════════════════════════════════════════════
// 8. HAQIQIY PostgreSQL 16 (PG_TEST_URL berilganda)
// ═══════════════════════════════════════════════════════════════════════

test("24. PG16: preflight haqiqiy bazada o'tadi va sonlarni chiqaradi", { skip: sabab }, () => {
  const p = papkaOch("pg-preflight");
  const chiqish = join(p, "output.txt");
  writeFileSync(chiqish, "");

  const res = ishga("scripts/migratsiya-preflight.mjs", [], {
    ...toliqEnv(PG!),
    GITHUB_OUTPUT: chiqish,
  });

  assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /Provayder: postgresql/);
  assert.match(res.stdout, /pg_dump mavjud/);
  assert.match(res.stdout, /pg_restore mavjud/);

  // CI keyingi qadamlari shu natijalarga tayanadi.
  const natija = readFileSync(chiqish, "utf8");
  assert.match(natija, /^provayder=postgresql$/m);
  assert.match(natija, /^kutayotgan=\d+$/m);
  assert.match(natija, /^jadvallar=\d+$/m);

  // Sir hech qayerda yo'q.
  assert.ok(!natija.includes("postgres:postgres"), "GITHUB_OUTPUT ga sir yozilmasin");
});

test(
  "25. PG16: bo'sh bazada BARCHA migratsiyalar kutayotgan deb sanaladi",
  { skip: sabab },
  async () => {
    const pgSurat = await import("../scripts/lib/pg-surat.cjs");
    await c!.query("DROP SCHEMA IF EXISTS public CASCADE");
    await c!.query("CREATE SCHEMA public");

    const kutayotgan = await pgSurat.kutayotganMigratsiyalar(c!);
    const diskda = pgSurat.migratsiyaRoyxati();

    // `_prisma_migrations` umuman yo'q — noaniqlikda "zaxira kerak emas"
    // deb qaror qilinmasligi kerak.
    assert.equal(kutayotgan.length, diskda.length);
    assert.ok(diskda.length > 0, "diskda migratsiya bo'lishi kerak");
  }
);

test(
  "26. PG16: pg_dump surati olinadi, tekshiruvdan o'tadi va shifrlab-ochilganda buzilmaydi",
  { skip: sabab },
  async () => {
    const pgSurat = await import("../scripts/lib/pg-surat.cjs");
    const p = papkaOch("pg-surat");

    // Haqiqiy ma'lumot — bo'sh baza zaxirasi hech narsani isbotlamaydi.
    await c!.query("DROP SCHEMA IF EXISTS public CASCADE");
    await c!.query("CREATE SCHEMA public");
    await c!.query(`CREATE TABLE "Business" (id text PRIMARY KEY, nomi text NOT NULL)`);
    await c!.query(`INSERT INTO "Business" VALUES ('b1', 'Sinov biznes'), ('b2', 'Ikkinchi')`);

    const { bayt, jadvallar } = await pgSurat.suratOl(PG!);
    assert.ok(bayt.byteLength > 0);
    assert.equal(jadvallar, 1);

    const fayl = join(p, "pg-surat.dump");
    writeFileSync(fayl, bayt);

    // 1) Ochiq surat tekshiruvdan o'tadi.
    const ochiq = ishga("scripts/zaxira-tekshir.mjs", [fayl], {});
    assert.equal(ochiq.status, 0, `${ochiq.stdout}\n${ochiq.stderr}`);
    assert.match(ochiq.stdout, /pg_dump custom, 1 ta jadval/);

    // 2) Shifrlanadi — artefaktga aynan shu ketadi.
    const shifr = ishga("scripts/zaxira-shifrla.mjs", [p], { BACKUP_ENCRYPTION_KEY: KALIT });
    assert.equal(shifr.status, 0);
    assert.ok(!existsSync(fayl), "ochiq dump qolmasin");

    // 3) Shifrlangani ham tekshiruvdan o'tadi (ya'ni tiklanadi).
    const enc = ishga("scripts/zaxira-tekshir.mjs", [`${fayl}.enc`], {
      BACKUP_ENCRYPTION_KEY: KALIT,
    });
    assert.equal(enc.status, 0, `${enc.stdout}\n${enc.stderr}`);
    assert.match(enc.stdout, /shifrlangan/);
    assert.match(enc.stdout, /pg_dump custom, 1 ta jadval/);
  }
);

test(
  "27. PG16: apply-hammasi provayder qatlami haqiqiy bazada ishlaydi",
  { skip: sabab },
  async () => {
    // Bu yerda TO'LIQ oqim kutilmaydi: repo hali SQLite holatida, ya'ni
    // generatsiya qilingan Prisma klienti Postgres'ni bilmaydi (provayder
    // almashtirish — alohida ish). Tekshirilayotgani — ilgari umuman
    // ishlamagan qism: `sqlite_master`/`PRAGMA` o'rniga Postgres so'rovlari
    // bilan holat O'QILADIMI.
    await c!.query("DROP SCHEMA IF EXISTS public CASCADE");
    await c!.query("CREATE SCHEMA public");
    await c!.query(`CREATE TABLE "Business" (id text PRIMARY KEY)`);
    await c!.query(`CREATE TABLE "Transaction" (id text PRIMARY KEY, summa integer NOT NULL)`);
    await c!.query(`INSERT INTO "Business" VALUES ('b1')`);
    await c!.query(`INSERT INTO "Transaction" VALUES ('t1', 5000), ('t2', 7000)`);

    const res = ishga("scripts/apply-hammasi.mjs", [], {
      DATABASE_URL: PG!,
      MIGRATSIYA_RUXSAT: "ha",
      BACKUP_ENCRYPTION_KEY: KALIT,
    });

    // Postgres jadvallari `information_schema` orqali topildi va sanaldi.
    assert.match(res.stdout, /Provayder|pg_dump mavjud/);
    assert.match(res.stdout, /Business=1/);
    assert.match(res.stdout, /Transaction=2/);
    assert.match(res.stdout, /Tranzaksiyalar jami: 12[\s ]?000 so'm/);
    // SQLite'ga xos so'rovlar Postgres yo'lida umuman ishlatilmasin.
    assert.ok(!/sqlite_master/.test(res.stderr), "SQLite so'rovi Postgres yo'liga tushmasin");
    assert.ok(!/PRAGMA/.test(res.stderr), "PRAGMA Postgres'da ishlamaydi");
  }
);

// ═══════════════════════════════════════════════════════════════════════
// 9. Bo'sh baza — birinchi migratsiya to'xtatilmasin
// ═══════════════════════════════════════════════════════════════════════

test("28. zaxira-tekshir: bo'sh manba bazada bo'sh surat QABUL qilinadi", () => {
  // Birinchi deploy: bazada hali bitta ham jadval yo'q, ya'ni suratda ham
  // yo'q. Buni "buzilgan zaxira" deb hisoblash butun birinchi migratsiyani
  // to'xtatib qo'yardi — E2E o'tkazuvda aynan shu holat yuz berdi.
  const p = papkaOch("bosh-manba");
  const fayl = join(p, "bosh-manba.json");
  writeFileSync(fayl, JSON.stringify({ olingan: "2026-08-18", jadvallar: {} }));

  const bilan = ishga("scripts/zaxira-tekshir.mjs", [fayl, "--jadvallar", "0"], {});
  assert.equal(bilan.status, 0, `${bilan.stdout}\n${bilan.stderr}`);
  assert.match(bilan.stdout, /Manba baza bo'sh/);

  // Manba soni AYTILMAGAN bo'lsa — eski ehtiyotkor qoida saqlanadi.
  const siz = ishga("scripts/zaxira-tekshir.mjs", [fayl], {});
  assert.equal(siz.status, 1, "manba noma'lum bo'lsa bo'sh surat qabul qilinmasin");

  // Bo'sh qiymat (CI o'zgaruvchisi to'ldirilmagan) "0" deb o'qilmasin —
  // aks holda buzilgan surat "bo'sh baza" deb o'tkazib yuborilardi.
  const bosh = ishga("scripts/zaxira-tekshir.mjs", [fayl, "--jadvallar", ""], {});
  assert.equal(bosh.status, 1, "bo'sh `--jadvallar` nolga aylanmasligi kerak");
});

test("29. zaxira-tekshir: surat manbadan KAM bo'lsa RAD etiladi", () => {
  // Yarim olingan zaxira eng xavfli holat: fayl bor, o'qiladi, lekin
  // jadvallarning bir qismi yo'q — buni tiklash kunida bilish kech.
  const p = papkaOch("kam-jadval");
  const fayl = join(p, "kam.json");
  writeFileSync(
    fayl,
    JSON.stringify({ jadvallar: { Business: { qatorlar: [{ id: "b1" }] } } })
  );

  const res = ishga("scripts/zaxira-tekshir.mjs", [fayl, "--jadvallar", "46"], {});
  assert.equal(res.status, 1);
  assert.match(res.stderr, /TO'LIQ EMAS/);
  assert.match(res.stderr, /46 ta jadval bor, suratda esa 1 ta/);
});

test(
  "30. PG16: CI ketma-ketligi bo'sh bazada boshdan oxirigacha o'tadi va idempotent",
  { skip: sabab },
  async () => {
    // Bu — `migratsiya.yml` ning 3->5->6->7 qadamlari, aynan o'sha tartibda.
    // Repo sxemasi SQLite holatida qolgani uchun Postgres varianti
    // vaqtinchalik papkada quriladi (repoga tegilmaydi).
    const loyiha = papkaOch("ci-ketma-ketlik");
    mkdirSync(join(loyiha, "prisma"), { recursive: true });
    writeFileSync(
      join(loyiha, "prisma/schema.prisma"),
      readFileSync(join(ILDIZ, "prisma/schema.prisma"), "utf8").replace(
        'provider = "sqlite"',
        'provider = "postgresql"'
      )
    );
    cpSync(join(ILDIZ, "prisma/migrations-postgres"), join(loyiha, "prisma/migrations"), {
      recursive: true,
    });
    cpSync(join(ILDIZ, "package.json"), join(loyiha, "package.json"));
    symlinkSync(join(ILDIZ, "node_modules"), join(loyiha, "node_modules"));

    await c!.query("DROP SCHEMA IF EXISTS public CASCADE");
    await c!.query("CREATE SCHEMA public");

    const chiqish = join(loyiha, "github-output.txt");
    writeFileSync(chiqish, "");
    const env = {
      ...toliqEnv(PG!),
      GITHUB_OUTPUT: chiqish,
    };
    /** Qadamni CI kabi, loyiha papkasidan turib bajaradi. */
    const qadam = (skript: string, args: string[] = []) =>
      spawnSync(process.execPath, [join(ILDIZ, skript), ...args], {
        cwd: loyiha,
        env: { ...process.env, PG_TEST_URL: undefined, ...env },
        encoding: "utf8",
      });

    // 3. Preflight — bo'sh baza, hammasi kutayotgan.
    const pre = qadam("scripts/migratsiya-preflight.mjs");
    assert.equal(pre.status, 0, `${pre.stdout}\n${pre.stderr}`);
    const natija = readFileSync(chiqish, "utf8");
    const jadvallar = /^jadvallar=(\d+)$/m.exec(natija)?.[1];
    assert.equal(jadvallar, "0", "bo'sh bazada 0 jadval kutiladi");
    assert.match(natija, /^kutayotgan=[1-9]\d*$/m, "kutayotgan migratsiya bo'lishi kerak");

    // 5. Zaxira.
    const yol = "prisma/backups/ci-sinov.dump";
    const zax = qadam("scripts/xom-zaxira.mjs", [yol]);
    assert.equal(zax.status, 0, `${zax.stdout}\n${zax.stderr}`);
    assert.ok(existsSync(join(loyiha, yol)), "zaxira fayli yaratilishi kerak");

    // 6. Zaxira tekshiruvi — bo'sh manba, ya'ni bo'sh surat kutilgan.
    const tek = qadam("scripts/zaxira-tekshir.mjs", [yol, "--jadvallar", jadvallar!]);
    assert.equal(tek.status, 0, `${tek.stdout}\n${tek.stderr}`);

    // 7. Migratsiya.
    const mig = qadam("scripts/db-migrate.mjs");
    assert.equal(mig.status, 0, `${mig.stdout}\n${mig.stderr}`);

    const jadval = await c!.query<{ n: string }>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema='public'"
    );
    assert.ok(Number(jadval.rows[0].n) > 40, "sxema qurilishi kerak");

    // IDEMPOTENTLIK: qayta ishga tushirish takroriy migratsiya yozmasin.
    const qayta = qadam("scripts/db-migrate.mjs");
    assert.equal(qayta.status, 0, `${qayta.stdout}\n${qayta.stderr}`);
    const hisobot = await c!.query<{ n: string }>(
      `SELECT COUNT(*) n FROM "_prisma_migrations" WHERE rolled_back_at IS NULL`
    );
    assert.equal(Number(hisobot.rows[0].n), 1, "hisobotga takroriy yozuv tushmasligi kerak");
  }
);

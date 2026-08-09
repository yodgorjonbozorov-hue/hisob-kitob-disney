/**
 * ZAXIRA SHIFRLASH (audit C-4) — `src/lib/backup/shifr.ts` va
 * `scripts/lib/shifr.mjs`.
 *
 * Format ikki faylda takrorlanadi (build skriptlari Prisma'siz muhitda,
 * ilova esa ts-node/CJS muhitida ishlaydi). Shu test ikkalasining O'ZARO
 * mosligini qo'riqlaydi: TS shifrlagan faylni MJS ochadi va aksincha.
 * Format o'zgarib bittasi yangilansa — test qizil bo'ladi.
 *
 * Ishga tushirish: npm run test:shifr
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { shifrla, shifrOch, shifrlanganmi, zaxiraFayliniOch } from "@/lib/backup/shifr";

const PAROL = "juda-maxfiy-parol-123";
const NAMUNA = JSON.stringify({ versiya: 1, jadvallar: { User: { qatorlar: [["U1", "hash"]] } } });

const VAQTINCHA = [
  "prisma/test-shifr-mjs.bin",
  "prisma/test-shifr-ts.bin",
  "prisma/test-shifr-ts.json",
  "prisma/test-shifr-cli-bor.json",
];

after(() => {
  for (const f of VAQTINCHA) rmSync(f, { force: true });
});

// ---------- TS moduli o'zi ----------

test("shifrla → shifrOch aynan asl baytlarni qaytaradi", () => {
  const asl = Buffer.from(NAMUNA);
  const shifr = shifrla(asl, PAROL);
  assert.ok(!shifr.includes(Buffer.from('"User"')), "shifrmatnda ochiq matn bo'lmasligi kerak");
  assert.deepEqual(shifrOch(shifr, PAROL), asl);
});

test("har shifrlash har xil natija beradi (salt/iv takrorlanmaydi)", () => {
  const asl = Buffer.from(NAMUNA);
  assert.notDeepEqual(shifrla(asl, PAROL), shifrla(asl, PAROL));
});

test("noto'g'ri parol aniq xato bilan rad etiladi", () => {
  const shifr = shifrla(Buffer.from(NAMUNA), PAROL);
  assert.throws(() => shifrOch(shifr, "boshqa-parol"), /noto'g'ri yoki fayl buzilgan/);
});

test("buzilgan fayl jimgina buzuq JSON qaytarmaydi — xato beradi", () => {
  const shifr = shifrla(Buffer.from(NAMUNA), PAROL);
  // GCM autentifikatsiyasi shifrmatn o'rtasidagi bitta baytni ham ushlaydi.
  shifr[60] = shifr[60] ^ 0xff;
  assert.throws(() => shifrOch(shifr, PAROL), /noto'g'ri yoki fayl buzilgan/);
});

test("shifrlanganmi: shifr faylni taniydi, gzip/json'ni shifr demaydi", () => {
  assert.equal(shifrlanganmi(shifrla(Buffer.from(NAMUNA), PAROL)), true);
  assert.equal(shifrlanganmi(gzipSync(Buffer.from(NAMUNA))), false);
  assert.equal(shifrlanganmi(Buffer.from(NAMUNA)), false);
});

// ---------- Tiklash yo'lidagi universal ochish ----------

test("zaxiraFayliniOch: shifr+gzip, faqat gzip va ochiq JSON — uchalasi o'tadi", () => {
  const asl = Buffer.from(NAMUNA);
  const gz = gzipSync(asl);
  assert.deepEqual(zaxiraFayliniOch(shifrla(gz, PAROL), PAROL), asl);
  assert.deepEqual(zaxiraFayliniOch(gz, PAROL), asl);
  assert.deepEqual(zaxiraFayliniOch(asl, PAROL), asl, "eski ochiq fayllar orqaga mos");
});

test("shifrlangan fayl parolsiz ochilmaydi — sabab aniq aytiladi", () => {
  const shifr = shifrla(Buffer.from(NAMUNA), PAROL);
  assert.throws(() => zaxiraFayliniOch(shifr, undefined), /ZAXIRA_PAROL sozlanmagan/);
});

// ---------- TS ↔ MJS o'zaro moslik (format qo'riqchisi) ----------

test("MJS shifrlagan faylni TS ochadi", () => {
  const res = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { shifrla } from "./scripts/lib/shifr.mjs";
       import { writeFileSync } from "node:fs";
       writeFileSync("prisma/test-shifr-mjs.bin", shifrla(Buffer.from(${JSON.stringify(NAMUNA)}), ${JSON.stringify(PAROL)}));`,
    ],
    { encoding: "utf8" }
  );
  assert.equal(res.status, 0, res.stderr);
  const shifr = readFileSync("prisma/test-shifr-mjs.bin");
  assert.deepEqual(shifrOch(shifr, PAROL), Buffer.from(NAMUNA));
});

test("TS shifrlagan faylni MJS (zaxira:och CLI) ochadi", () => {
  writeFileSync("prisma/test-shifr-ts.bin", shifrla(gzipSync(Buffer.from(NAMUNA)), PAROL));

  const res = spawnSync(
    process.execPath,
    ["scripts/zaxira-och.mjs", "prisma/test-shifr-ts.bin", "prisma/test-shifr-ts.json"],
    { encoding: "utf8", env: { ...process.env, ZAXIRA_PAROL: PAROL } }
  );
  assert.equal(res.status, 0, res.stderr);
  assert.equal(readFileSync("prisma/test-shifr-ts.json", "utf8"), NAMUNA);
});

test("zaxira:och noto'g'ri parolda yiqiladi va mavjud faylni bosib yozmaydi", () => {
  const xato = spawnSync(
    process.execPath,
    ["scripts/zaxira-och.mjs", "prisma/test-shifr-ts.bin", "prisma/test-shifr-xato.json"],
    { encoding: "utf8", env: { ...process.env, ZAXIRA_PAROL: "boshqa" } }
  );
  assert.notEqual(xato.status, 0);
  assert.match(xato.stderr, /noto'g'ri yoki fayl buzilgan/);
  assert.equal(existsSync("prisma/test-shifr-xato.json"), false, "buzuq chiqish yozilmasligi kerak");

  writeFileSync("prisma/test-shifr-cli-bor.json", "bor");
  const bosish = spawnSync(
    process.execPath,
    ["scripts/zaxira-och.mjs", "prisma/test-shifr-ts.bin", "prisma/test-shifr-cli-bor.json"],
    { encoding: "utf8", env: { ...process.env, ZAXIRA_PAROL: PAROL } }
  );
  assert.notEqual(bosish.status, 0);
  assert.match(bosish.stderr, /ustiga yozilmaydi/);
  assert.equal(readFileSync("prisma/test-shifr-cli-bor.json", "utf8"), "bor");
});

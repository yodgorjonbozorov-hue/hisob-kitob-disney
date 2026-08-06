/**
 * AI OCR — CHEK RASMIDAN CHIQIM TAKLIFI (Faza 6.5).
 *
 * Bu yerdagi eng nozik joy — model javobini o'qish. Model matn oldiga
 * tushuntirish yoki ```json belgilarini qo'shib yuborishi mumkin, va eng
 * xavflisi: summani noto'g'ri o'qib, ishonch bilan raqam qaytarishi.
 * Shuning uchun `chekNatijasiniAjrat` ATAYLAB qat'iy: shubhali natija
 * `null` ga aylanadi va foydalanuvchi qo'lda kiritadi. Noto'g'ri raqamni
 * jimgina yozib qo'yishdan ko'ra "o'qiy olmadim" deyish xavfsizroq.
 *
 * Tarmoqqa chiqmaydi: `chekniOqi` ga soxta `fetch` beriladi.
 *
 * Ishga tushirish: npm run test:chek-ocr
 */
process.env.DATABASE_URL = "file:./prisma/test-chek-ocr.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

let ajrat: any;
let chekniOqi: any;
let AiSozlanmaganError: any;
let eskiKalit: string | undefined;

/** Model javobini taqlid qiluvchi soxta `fetch`. */
function soxtaFetch(matn: string, ok = true, status = 200) {
  return async () =>
    ({
      ok,
      status,
      json: async () => ({ content: [{ type: "text", text: matn }] }),
      text: async () => matn,
    }) as unknown as Response;
}

before(async () => {
  ({ chekNatijasiniAjrat: ajrat, chekniOqi } = await import("@/lib/ai/chekOcr"));
  ({ AiSozlanmaganError } = await import("@/lib/ai/claude"));
  eskiKalit = process.env.ANTHROPIC_API_KEY;
});

after(() => {
  if (eskiKalit === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = eskiKalit;
});

// ---------- Javobni ajratish ----------

test("toza JSON o'qiladi", () => {
  const n = ajrat(
    '{"summa": 125000, "sana": "2026-07-14", "savdoNomi": "Korzinka", "kategoriya": "Oziq-ovqat", "ishonch": "yuqori"}'
  );
  assert.equal(n.summa, 125_000);
  assert.equal(n.sana, "2026-07-14");
  assert.equal(n.savdoNomi, "Korzinka");
  assert.equal(n.kategoriya, "Oziq-ovqat");
  assert.equal(n.ishonch, "yuqori");
});

test("markdown blok va oldingi matn ichidan JSON topiladi", () => {
  const n = ajrat(
    'Mana chek natijasi:\n```json\n{"summa": 45000, "sana": null, "ishonch": "orta"}\n```\nUmid qilamanki foydali.'
  );
  assert.equal(n.summa, 45_000);
  assert.equal(n.sana, null);
  assert.equal(n.ishonch, "orta");
});

test("summasiz yoki nol summali javob RAD etiladi", () => {
  assert.equal(ajrat('{"summa": 0, "ishonch": "past"}'), null, "0 — o'qilmagan chek");
  assert.equal(ajrat('{"summa": -500, "ishonch": "yuqori"}'), null, "manfiy summa bo'lmaydi");
  assert.equal(ajrat('{"sana": "2026-07-14"}'), null, "summa yo'q");
  assert.equal(ajrat('{"summa": "ko\'p", "ishonch": "yuqori"}'), null, "raqam emas");
});

test("umuman JSON bo'lmagan javob RAD etiladi", () => {
  assert.equal(ajrat("Kechirasiz, rasmda chek ko'rinmadi."), null);
  assert.equal(ajrat(""), null);
  assert.equal(ajrat("{buzilgan json"), null);
});

test("kasrli summa butun songa yaxlitlanadi (pul har doim Int)", () => {
  assert.equal(ajrat('{"summa": 125000.75, "ishonch": "yuqori"}').summa, 125_001);
  assert.equal(ajrat('{"summa": 99999.4, "ishonch": "yuqori"}').summa, 99_999);
});

test("noto'g'ri formatdagi sana null ga aylanadi", () => {
  assert.equal(ajrat('{"summa": 1000, "sana": "14.07.2026", "ishonch": "yuqori"}').sana, null);
  assert.equal(ajrat('{"summa": 1000, "sana": 20260714, "ishonch": "yuqori"}').sana, null);
});

test("noma'lum ishonch qiymati 'past' ga tushiriladi", () => {
  assert.equal(ajrat('{"summa": 1000, "ishonch": "juda-yuqori"}').ishonch, "past");
  assert.equal(ajrat('{"summa": 1000}').ishonch, "past", "berilmasa ham past");
});

test("bo'sh matnli maydonlar null bo'ladi va uzunligi cheklanadi", () => {
  const n = ajrat('{"summa": 1000, "savdoNomi": "   ", "kategoriya": "", "ishonch": "orta"}');
  assert.equal(n.savdoNomi, null);
  assert.equal(n.kategoriya, null);

  const uzun = ajrat(`{"summa": 1000, "savdoNomi": "${"a".repeat(300)}", "ishonch": "orta"}`);
  assert.equal(uzun.savdoNomi.length, 100);
});

// ---------- chekniOqi ----------

test("API kaliti yo'q bo'lsa aniq xato beriladi", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await assert.rejects(
    () => chekniOqi({ base64: "AAA", mediaType: "image/jpeg", kategoriyalar: [] }),
    (e: any) => e instanceof AiSozlanmaganError
  );
});

test("qo'llab-quvvatlanmaydigan format rad etiladi", async () => {
  process.env.ANTHROPIC_API_KEY = "test-kalit";
  await assert.rejects(
    () => chekniOqi({ base64: "AAA", mediaType: "application/pdf", kategoriyalar: [] }),
    /qo'llab-quvvatlanmaydi/
  );
});

test("model javobi natijaga aylanadi", async () => {
  process.env.ANTHROPIC_API_KEY = "test-kalit";
  const n = await chekniOqi({
    base64: "AAA",
    mediaType: "image/jpeg",
    kategoriyalar: ["Oziq-ovqat", "Transport"],
    fetchImpl: soxtaFetch('{"summa": 87000, "sana": "2026-07-20", "kategoriya": "Transport", "ishonch": "yuqori"}'),
  });
  assert.equal(n.summa, 87_000);
  assert.equal(n.kategoriya, "Transport");
});

test("ishonchsiz javob null qaytaradi — chiqim yozilmaydi", async () => {
  process.env.ANTHROPIC_API_KEY = "test-kalit";
  const n = await chekniOqi({
    base64: "AAA",
    mediaType: "image/jpeg",
    kategoriyalar: [],
    fetchImpl: soxtaFetch('{"summa": 0, "ishonch": "past"}'),
  });
  assert.equal(n, null);
});

test("API xatosi yashirilmaydi", async () => {
  process.env.ANTHROPIC_API_KEY = "test-kalit";
  await assert.rejects(
    () =>
      chekniOqi({
        base64: "AAA",
        mediaType: "image/jpeg",
        kategoriyalar: [],
        fetchImpl: soxtaFetch("rate limit", false, 429),
      }),
    /429/
  );
});

test("kategoriyalar ro'yxati so'rovga qo'shiladi", async () => {
  process.env.ANTHROPIC_API_KEY = "test-kalit";
  let yuborilgan: any = null;
  const fetchImpl = (async (_url: string, init: any) => {
    yuborilgan = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: '{"summa": 1, "ishonch": "orta"}' }] }),
      text: async () => "",
    } as unknown as Response;
  }) as unknown as typeof fetch;

  await chekniOqi({
    base64: "AAA",
    mediaType: "image/png",
    kategoriyalar: ["Ijara", "Kommunal"],
    fetchImpl,
  });

  const kontent = yuborilgan.messages[0].content;
  assert.equal(kontent[0].source.media_type, "image/png");
  assert.match(kontent[1].text, /Ijara, Kommunal/);
});

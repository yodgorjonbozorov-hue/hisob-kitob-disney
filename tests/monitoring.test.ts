/**
 * MONITORING (TASK 3.3) — Sentry'ga SDK'siz xato yuborish.
 *
 * Invariantlar: DSN bo'lmasa hech narsa yuborilmaydi; yuborish hech qachon
 * xato tashlamaydi (asosiy oqim buzilmasligi kafolati); endpoint va
 * payload to'g'ri quriladi.
 *
 * Ishga tushirish: npm run test:monitoring
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { monitoringYoqilgan, xatoniYubor } from "@/lib/monitoring/xabar";

const asilFetch = globalThis.fetch;
let eskiDsn: string | undefined;

beforeEach(() => {
  eskiDsn = process.env.SENTRY_DSN;
});

afterEach(() => {
  globalThis.fetch = asilFetch;
  if (eskiDsn === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = eskiDsn;
});

test("DSN sozlanmagan bo'lsa hech narsa yuborilmaydi", async () => {
  delete process.env.SENTRY_DSN;
  assert.equal(monitoringYoqilgan(), false);

  let chaqirildi = false;
  globalThis.fetch = (async () => {
    chaqirildi = true;
    return new Response("{}");
  }) as typeof fetch;

  await xatoniYubor(new Error("test"), "test");
  assert.equal(chaqirildi, false);
});

test("xato to'g'ri endpoint'ga, joy tegi va stack bilan yuboriladi", async () => {
  process.env.SENTRY_DSN = "https://ochiq-kalit@sentry.example.com/42";
  assert.equal(monitoringYoqilgan(), true);

  let url = "";
  let body: any = null;
  let auth = "";
  globalThis.fetch = (async (u: any, init: any) => {
    url = String(u);
    body = JSON.parse(init.body);
    auth = init.headers["X-Sentry-Auth"];
    return new Response("{}");
  }) as typeof fetch;

  await xatoniYubor(new Error("Sinov xatosi"), "kunlikSinxron", { businessId: "B1" });

  assert.equal(url, "https://sentry.example.com/api/42/store/");
  assert.match(auth, /sentry_key=ochiq-kalit/);
  assert.equal(body.tags.joy, "kunlikSinxron");
  assert.equal(body.exception.values[0].value, "Sinov xatosi");
  assert.equal(body.extra.businessId, "B1");
  assert.ok(body.extra.stack, "stack izi extra'da bo'lishi kerak");
});

test("yuborish yiqilsa ham xato tashlanmaydi (asosiy oqim buzilmaydi)", async () => {
  process.env.SENTRY_DSN = "https://kalit@sentry.example.com/42";
  globalThis.fetch = (async () => {
    throw new Error("tarmoq yo'q");
  }) as typeof fetch;

  // Xato tashlamasligi kerak.
  await xatoniYubor(new Error("test"), "test");

  // Buzuq DSN ham jimgina o'tadi.
  process.env.SENTRY_DSN = "notogri-dsn";
  await xatoniYubor("string xato", "test");
});

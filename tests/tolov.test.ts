/**
 * ONLAYN TO'LOV TESTLARI (Payme Merchant API + Click SHOP API).
 * Imzo/avtorizatsiya, summa tekshiruvi, tranzaksiya hayot sikli, idempotentlik
 * va obunaning haqiqatan uzayishi.
 * Ishga tushirish: npm run test:tolov
 */
process.env.DATABASE_URL = "file:./prisma/test-tolov.db";
process.env.PAYME_MERCHANT_ID = "test-merchant";
process.env.PAYME_KEY = "test-payme-key";
process.env.CLICK_SERVICE_ID = "12345";
process.env.CLICK_MERCHANT_ID = "54321";
process.env.CLICK_SECRET_KEY = "test-click-secret";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createHash } from "node:crypto";

let rawPrisma: any;
let createTenantWithOwner: any;
let payme: any;
let click: any;
let provider: any;

let tenant: any;

/** Payme Basic auth sarlavhasi. */
function auth(key = "test-payme-key"): string {
  return `Basic ${Buffer.from(`Paycom:${key}`, "utf8").toString("base64")}`;
}

/** Yangi PENDING to'lov (provider bo'yicha). */
async function yangiTolov(providerCode: "PAYME" | "CLICK", amount = 199_000) {
  return rawPrisma.payment.create({
    data: { tenantId: tenant.tenant.id, amount, provider: providerCode, status: "PENDING", plan: "STANDARD" },
  });
}

function clickImzo(req: Record<string, unknown>, complete: boolean): string {
  const qismlar = [
    req.click_trans_id,
    req.service_id,
    "test-click-secret",
    req.merchant_trans_id,
    ...(complete ? [req.merchant_prepare_id] : []),
    req.amount,
    req.action,
    req.sign_time,
  ];
  return createHash("md5").update(qismlar.join(""), "utf8").digest("hex");
}

before(async () => {
  rmSync("prisma/test-tolov.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  payme = await import("@/lib/billing/payme");
  click = await import("@/lib/billing/click");
  provider = await import("@/lib/billing/provider");

  tenant = await createTenantWithOwner({
    kompaniyaNomi: "To'lov Sinov",
    ism: "Egasi",
    login: "+998955555701",
    parol: "parol12345",
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Umumiy ----------

test("env sozlangan bo'lsa Payme va Click to'lov usullari ro'yxatda", () => {
  const kodlar = provider.mavjudProviderlar().map((p: any) => p.code);
  assert.deepEqual(kodlar.sort(), ["CLICK", "MANUAL", "PAYME"]);
});

test("Payme checkout URL: merchant, hisob va tiyindagi summa", () => {
  const url = payme.paymeCheckoutUrl({
    merchantId: "m1",
    paymentId: "p1",
    summaSom: 199_000,
    returnUrl: "https://balansa.uz/billing",
  });
  const decoded = Buffer.from(url.replace("https://checkout.paycom.uz/", ""), "base64").toString("utf8");
  assert.equal(decoded, "m=m1;ac.payment_id=p1;a=19900000;c=https://balansa.uz/billing");
});

test("Click checkout URL parametrlari", () => {
  const url = click.clickCheckoutUrl({
    serviceId: "12345",
    merchantId: "54321",
    paymentId: "p1",
    summaSom: 199_000,
    returnUrl: "https://balansa.uz/billing",
  });
  assert.match(url, /^https:\/\/my\.click\.uz\/services\/pay\?/);
  const q = new URL(url).searchParams;
  assert.equal(q.get("service_id"), "12345");
  assert.equal(q.get("amount"), "199000");
  assert.equal(q.get("transaction_param"), "p1");
});

// ---------- Payme ----------

test("Payme: noto'g'ri parol bilan har qanday metod rad etiladi", async () => {
  const r = await payme.handlePaymeRequest(
    { id: 1, method: "CheckPerformTransaction", params: {} },
    auth("boshqa-kalit")
  );
  assert.equal(r.error.code, payme.PAYME_ERROR.AVTORIZATSIYA);
});

test("Payme: CheckPerformTransaction — mavjud to'lov va to'g'ri summa", async () => {
  const p = await yangiTolov("PAYME");
  const ok = await payme.handlePaymeRequest(
    { id: 1, method: "CheckPerformTransaction", params: { amount: 19_900_000, account: { payment_id: p.id } } },
    auth()
  );
  assert.deepEqual(ok.result, { allow: true });

  const notoriSumma = await payme.handlePaymeRequest(
    { id: 2, method: "CheckPerformTransaction", params: { amount: 100, account: { payment_id: p.id } } },
    auth()
  );
  assert.equal(notoriSumma.error.code, payme.PAYME_ERROR.NOTORI_SUMMA);

  const yoq = await payme.handlePaymeRequest(
    { id: 3, method: "CheckPerformTransaction", params: { amount: 19_900_000, account: { payment_id: "yoq" } } },
    auth()
  );
  assert.equal(yoq.error.code, payme.PAYME_ERROR.HISOB_TOPILMADI);
});

test("Payme: to'liq sikl — Create → Perform → obuna uzayadi", async () => {
  const p = await yangiTolov("PAYME");
  const account = { payment_id: p.id };
  const trId = "payme-tx-1";

  const create = await payme.handlePaymeRequest(
    { id: 1, method: "CreateTransaction", params: { id: trId, time: Date.now(), amount: 19_900_000, account } },
    auth()
  );
  assert.equal(create.result.state, payme.PAYME_STATE.YARATILDI);
  assert.equal(create.result.transaction, p.id);

  // Takroriy CreateTransaction — o'sha javob (idempotent).
  const takror = await payme.handlePaymeRequest(
    { id: 2, method: "CreateTransaction", params: { id: trId, time: Date.now(), amount: 19_900_000, account } },
    auth()
  );
  assert.equal(takror.result.create_time, create.result.create_time);

  const perform = await payme.handlePaymeRequest(
    { id: 3, method: "PerformTransaction", params: { id: trId } },
    auth()
  );
  assert.equal(perform.result.state, payme.PAYME_STATE.BAJARILDI);

  const yangilangan = await rawPrisma.tenant.findUnique({ where: { id: tenant.tenant.id } });
  assert.equal(yangilangan.status, "ACTIVE", "to'lovdan keyin obuna faollashishi kerak");
  assert.ok(yangilangan.currentPeriodEnd > new Date(), "muddat kelajakka uzayishi kerak");

  const tolov = await rawPrisma.payment.findUnique({ where: { id: p.id } });
  assert.equal(tolov.status, "CONFIRMED");

  // Takroriy Perform — ikkinchi marta obuna uzaytirilmaydi.
  const oldingiMuddat = yangilangan.currentPeriodEnd;
  const takrorPerform = await payme.handlePaymeRequest(
    { id: 4, method: "PerformTransaction", params: { id: trId } },
    auth()
  );
  assert.equal(takrorPerform.result.state, payme.PAYME_STATE.BAJARILDI);
  const keyin = await rawPrisma.tenant.findUnique({ where: { id: tenant.tenant.id } });
  assert.equal(keyin.currentPeriodEnd.getTime(), oldingiMuddat.getTime(), "muddat ikki marta uzaymasligi kerak");
});

test("Payme: band to'lov bo'yicha ikkinchi tranzaksiya ochilmaydi", async () => {
  const p = await yangiTolov("PAYME");
  const account = { payment_id: p.id };
  await payme.handlePaymeRequest(
    { id: 1, method: "CreateTransaction", params: { id: "tx-a", time: Date.now(), amount: 19_900_000, account } },
    auth()
  );
  const ikkinchi = await payme.handlePaymeRequest(
    { id: 2, method: "CreateTransaction", params: { id: "tx-b", time: Date.now(), amount: 19_900_000, account } },
    auth()
  );
  assert.equal(ikkinchi.error.code, payme.PAYME_ERROR.BAJARIB_BOLMAYDI);
});

test("Payme: CancelTransaction va CheckTransaction holatlari", async () => {
  const p = await yangiTolov("PAYME");
  const account = { payment_id: p.id };
  const trId = "payme-tx-cancel";
  await payme.handlePaymeRequest(
    { id: 1, method: "CreateTransaction", params: { id: trId, time: Date.now(), amount: 19_900_000, account } },
    auth()
  );

  const cancel = await payme.handlePaymeRequest(
    { id: 2, method: "CancelTransaction", params: { id: trId, reason: 5 } },
    auth()
  );
  assert.equal(cancel.result.state, payme.PAYME_STATE.BEKOR_YARATILGACH);

  const check = await payme.handlePaymeRequest({ id: 3, method: "CheckTransaction", params: { id: trId } }, auth());
  assert.equal(check.result.state, payme.PAYME_STATE.BEKOR_YARATILGACH);
  assert.equal(check.result.reason, 5);
  assert.ok(check.result.cancel_time > 0);

  // Bekor qilingandan keyin Perform ishlamaydi.
  const perform = await payme.handlePaymeRequest(
    { id: 4, method: "PerformTransaction", params: { id: trId } },
    auth()
  );
  assert.equal(perform.error.code, payme.PAYME_ERROR.BAJARIB_BOLMAYDI);

  const tolov = await rawPrisma.payment.findUnique({ where: { id: p.id } });
  assert.equal(tolov.status, "REJECTED");
});

test("Payme: noma'lum metod va topilmagan tranzaksiya", async () => {
  const metod = await payme.handlePaymeRequest({ id: 1, method: "Nimadir", params: {} }, auth());
  assert.equal(metod.error.code, payme.PAYME_ERROR.METOD_TOPILMADI);

  const yoq = await payme.handlePaymeRequest(
    { id: 2, method: "CheckTransaction", params: { id: "bunday-yoq" } },
    auth()
  );
  assert.equal(yoq.error.code, payme.PAYME_ERROR.TRANZAKSIYA_TOPILMADI);
});

// ---------- Click ----------

test("Click: imzo noto'g'ri bo'lsa rad etiladi", async () => {
  const p = await yangiTolov("CLICK");
  const req = {
    click_trans_id: "111",
    service_id: "12345",
    merchant_trans_id: p.id,
    amount: "199000.00",
    action: "0",
    sign_time: "2026-08-04 10:00:00",
    sign_string: "yolgon-imzo",
  };
  const r = await click.handleClickPrepare(req);
  assert.equal(r.error, click.CLICK_ERROR.IMZO_XATO);
});

test("Click: Prepare → Complete, obuna uzayadi", async () => {
  const p = await yangiTolov("CLICK");
  const prepare: any = {
    click_trans_id: "222",
    service_id: "12345",
    merchant_trans_id: p.id,
    amount: "199000.00",
    action: "0",
    sign_time: "2026-08-04 10:00:00",
  };
  prepare.sign_string = clickImzo(prepare, false);

  const pRes = await click.handleClickPrepare(prepare);
  assert.equal(pRes.error, click.CLICK_ERROR.OK);
  assert.equal(pRes.merchant_prepare_id, p.id);

  const oldin = await rawPrisma.tenant.findUnique({ where: { id: tenant.tenant.id } });

  const complete: any = {
    click_trans_id: "222",
    service_id: "12345",
    merchant_trans_id: p.id,
    merchant_prepare_id: p.id,
    amount: "199000.00",
    action: "1",
    sign_time: "2026-08-04 10:01:00",
  };
  complete.sign_string = clickImzo(complete, true);

  const cRes = await click.handleClickComplete(complete);
  assert.equal(cRes.error, click.CLICK_ERROR.OK);
  assert.equal(cRes.merchant_confirm_id, p.id);

  const tolov = await rawPrisma.payment.findUnique({ where: { id: p.id } });
  assert.equal(tolov.status, "CONFIRMED");

  const keyin = await rawPrisma.tenant.findUnique({ where: { id: tenant.tenant.id } });
  assert.ok(keyin.currentPeriodEnd > oldin.currentPeriodEnd, "muddat uzayishi kerak");

  // Takroriy Complete — obuna ikkinchi marta uzaymaydi.
  const takror = await click.handleClickComplete(complete);
  assert.equal(takror.error, click.CLICK_ERROR.ALLAQACHON_TOLANGAN);
  const oxiri = await rawPrisma.tenant.findUnique({ where: { id: tenant.tenant.id } });
  assert.equal(oxiri.currentPeriodEnd.getTime(), keyin.currentPeriodEnd.getTime());
});

test("Click: summa mos kelmasa rad etiladi", async () => {
  const p = await yangiTolov("CLICK");
  const req: any = {
    click_trans_id: "333",
    service_id: "12345",
    merchant_trans_id: p.id,
    amount: "1000.00",
    action: "0",
    sign_time: "2026-08-04 10:00:00",
  };
  req.sign_string = clickImzo(req, false);
  const r = await click.handleClickPrepare(req);
  assert.equal(r.error, click.CLICK_ERROR.SUMMA_XATO);
});

test("Click: Complete xato kodi bilan kelsa to'lov bekor qilinadi", async () => {
  const p = await yangiTolov("CLICK");
  const prepare: any = {
    click_trans_id: "444",
    service_id: "12345",
    merchant_trans_id: p.id,
    amount: "199000",
    action: "0",
    sign_time: "2026-08-04 10:00:00",
  };
  prepare.sign_string = clickImzo(prepare, false);
  await click.handleClickPrepare(prepare);

  const complete: any = {
    click_trans_id: "444",
    service_id: "12345",
    merchant_trans_id: p.id,
    merchant_prepare_id: p.id,
    amount: "199000",
    action: "1",
    sign_time: "2026-08-04 10:01:00",
    error: "-9",
  };
  complete.sign_string = clickImzo(complete, true);

  const r = await click.handleClickComplete(complete);
  assert.equal(r.error, click.CLICK_ERROR.BEKOR_QILINGAN);
  const tolov = await rawPrisma.payment.findUnique({ where: { id: p.id } });
  assert.equal(tolov.status, "REJECTED");
});

test("Click: Prepare o'tmagan to'lovni Complete qilib bo'lmaydi", async () => {
  const p = await yangiTolov("CLICK");
  const complete: any = {
    click_trans_id: "555",
    service_id: "12345",
    merchant_trans_id: p.id,
    merchant_prepare_id: p.id,
    amount: "199000",
    action: "1",
    sign_time: "2026-08-04 10:01:00",
  };
  complete.sign_string = clickImzo(complete, true);
  const r = await click.handleClickComplete(complete);
  assert.equal(r.error, click.CLICK_ERROR.TRANZAKSIYA_TOPILMADI);
});

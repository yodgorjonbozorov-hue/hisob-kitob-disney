/**
 * CRM BUYURTMALAR SAHIFASINING YUQORI PANELI — XODIM KASSASI VA CHIQIM.
 *
 * Qamrov:
 *   - zakaz YUTILDI bo'lganda kirim ZAKAZ MAS'ULINING kassasiga tushishi
 *     (tugmani direktor bosgan bo'lsa ham);
 *   - xodim kassasi paneli: kirim / chiqim / kassada raqamlari;
 *   - tez chiqim paneli: bugungi jami va oxirgi yozuvlar, ko'rinuvchanlik
 *     chegarasi (xodim faqat o'zinikini ko'radi);
 *   - kassa topshirish: kassa 0 ga tushishi, tarixning saqlanishi va
 *     oldingi topshirishlarning yo'qolmasligi;
 *   - HUQUQ: "kassa ko'rinmasin" (`kassa.jami` yo'q) xodimning O'Z kassasini
 *     yashirmaydi va "Kassa topshirish"ni o'chirmaydi.
 *
 * Ishga tushirish: npm run test:crm-xodim-kassa
 */
process.env.DATABASE_URL = "file:./prisma/test-crm-xodim-kassa.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let crm: any;
let crmKirim: any;
let yakunlash: any;
let panel: any;
let kassaTransfer: any;
let tekshir: any;
let transactionService: any;
let todayTashkentDateOnlyString: any;

let t: any;
let fayruza: any;
let katBantik: any;
let katChiqim: any;
let wonStage: any;
/** Fayruzaning shaxsiy kassasi. */
let fKassa: any;
/** Direktorning shaxsiy kassasi — topshirish nishoni. */
let dKassa: any;
let bugun: string;

const A = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(t.tenant.id, fn);

/** Fayruzaning zakazi (mas'ul — Fayruza), darhol yutilgan holatda emas. */
async function zakaz(nomi: string, summa: number) {
  return A(() =>
    crm.createDeal({
      businessId: t.business.id,
      nomi,
      summa,
      tolangan: summa,
      tolovTuri: "naqd",
      categoryId: katBantik.id,
      sana: bugun,
      // Zakazni Fayruza o'z hisobidan kiritadi — mas'ul ham u bo'ladi.
      userId: fayruza.id,
    })
  );
}

before(async () => {
  rmSync("prisma/test-crm-xodim-kassa.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  crm = await import("@/lib/crm/service");
  crmKirim = await import("@/lib/crm/kirim");
  yakunlash = await import("@/lib/crm/yakunlash");
  panel = await import("@/lib/crm/yuqoriPanel");
  kassaTransfer = await import("@/lib/services/kassaTransfer");
  tekshir = await import("@/lib/permissions/tekshir");
  transactionService = await import("@/lib/services/transactionService");
  ({ todayTashkentDateOnlyString } = await import("@/lib/date"));

  bugun = todayTashkentDateOnlyString();

  t = await createTenantWithOwner({
    kompaniyaNomi: "Disney Navoiy",
    ism: "Direktor",
    login: "+998946888801",
    parol: "parol12345",
  });
  await rawPrisma.tenant.update({ where: { id: t.tenant.id }, data: { plan: "PRO" } });
  await rawPrisma.tenantModule.create({
    data: { tenantId: t.tenant.id, code: "CRM", isActive: true },
  });

  // SHAXSIY KASSA REJIMI — naqd pul yozuvchining o'z kassasiga tushadi.
  await rawPrisma.business.update({
    where: { id: t.business.id },
    data: { shaxsiyKassa: true },
  });

  fayruza = await rawPrisma.user.create({
    data: {
      ism: "Fayruza",
      login: "xk_fayruza",
      parolHash: "x",
      rol: "SELLER",
      tenantId: t.tenant.id,
      businessId: t.business.id,
    },
  });

  fKassa = await rawPrisma.account.create({
    data: { businessId: t.business.id, nomi: "Fayruza (shaxsiy)", turi: "naqd", userId: fayruza.id },
  });
  dKassa = await rawPrisma.account.create({
    data: { businessId: t.business.id, nomi: "Direktor (shaxsiy)", turi: "naqd", userId: t.user.id },
  });

  katBantik = await rawPrisma.category.create({
    data: { businessId: t.business.id, nomi: "Bantik", turi: "kirim" },
  });
  katChiqim = await rawPrisma.category.create({
    data: { businessId: t.business.id, nomi: "Benzin", turi: "chiqim" },
  });

  await A(() => crm.ensureStages(t.business.id));
  const stages = await A(() => prisma.stage.findMany({ where: { businessId: t.business.id } }));
  wonStage = stages.find((s: any) => s.turi === "WON");
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- KIRIM: zakaz mas'ulining kassasiga ----------

test("yakunlash: kirim ZAKAZ MAS'ULINING kassasiga tushadi (tugmani direktor bossa ham)", async () => {
  const d = await zakaz("Bantik to'plami", 600_000);
  // Tugmani DIREKTOR bosadi — pul baribir Fayruzaning kassasiga tushishi kerak.
  await A(() =>
    yakunlash.zakazniYakunlash({ businessId: t.business.id, dealId: d.id, userId: t.user.id })
  );
  const yangilangan = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  const txn = await A(() =>
    prisma.transaction.findFirst({ where: { id: yangilangan.transactionId } })
  );
  assert.equal(txn.summa, 600_000);
  assert.equal(txn.accountId, fKassa.id, "kirim Fayruzaning kassasiga tushdi");
  assert.equal(txn.sotuvchiId, fayruza.id, "sotuvchi attributsiyasi o'zgarmadi");
});

test("kirimgaKochirish: kirim ham mas'ulning kassasiga tushadi", async () => {
  const d = await zakaz("Sharlar", 250_000);
  const txn = await A(() =>
    crmKirim.kirimgaKochirish({ businessId: t.business.id, dealId: d.id, userId: t.user.id })
  );
  assert.equal(txn.accountId, fKassa.id);
});

// ---------- XODIM KASSASI PANELI ----------

test("xodimKassaHolati: kirim va kassadagi pul ledgerdan keladi", async () => {
  const k = await A(() => panel.xodimKassaHolati(t.business.id, fayruza.id, "Fayruza"));
  assert.ok(k, "shaxsiy kassa topildi");
  assert.equal(k.ism, "Fayruza");
  assert.equal(k.kirim, 850_000, "600 000 + 250 000");
  assert.equal(k.chiqim, 0);
  assert.equal(k.kassada, 850_000);
  assert.equal(k.ochiqTopshirish, null);
  // Nishonlar — boshqa faol kassalar, SUMMASIZ (kassa maxfiyligi).
  assert.ok(k.nishonlar.some((n: any) => n.id === dKassa.id));
  assert.ok(!k.nishonlar.some((n: any) => n.id === fKassa.id), "o'z kassasi nishon emas");
  assert.ok(
    k.nishonlar.every((n: any) => !("qoldiq" in n)),
    "nishonlarda qoldiq yo'q"
  );
});

test("xodimKassaHolati: shaxsiy kassasi yo'q foydalanuvchida null", async () => {
  const begona = await rawPrisma.user.create({
    data: {
      ism: "Kassasiz",
      login: "xk_kassasiz",
      parolHash: "x",
      rol: "SELLER",
      tenantId: t.tenant.id,
      businessId: t.business.id,
    },
  });
  const k = await A(() => panel.xodimKassaHolati(t.business.id, begona.id, "Kassasiz"));
  assert.equal(k, null);
});

// ---------- CHIQIM PANELI ----------

test("chiqim: kassadan ayriladi va panelda darhol ko'rinadi", async () => {
  await A(() =>
    transactionService.createTransaction(fayruza.id, t.business.id, {
      turi: "chiqim",
      categoryId: katChiqim.id,
      summa: 100_000,
      sana: bugun,
      tolovTuri: "naqd",
      izoh: "Benzin",
      accountId: fKassa.id,
    })
  );

  const c = await A(() => panel.chiqimHolati(t.business.id, fayruza.id, bugun));
  assert.equal(c.bugun, 100_000);
  assert.equal(c.oxirgilar.length, 1);
  assert.equal(c.oxirgilar[0].nomi, "Benzin");
  assert.equal(c.oxirgilar[0].summa, 100_000);

  const k = await A(() => panel.xodimKassaHolati(t.business.id, fayruza.id, "Fayruza"));
  assert.equal(k.chiqim, 100_000);
  assert.equal(k.kassada, 750_000, "850 000 − 100 000");
});

test("chiqim paneli: xodim boshqa xodimning chiqimini ko'rmaydi", async () => {
  await A(() =>
    transactionService.createTransaction(t.user.id, t.business.id, {
      turi: "chiqim",
      categoryId: katChiqim.id,
      summa: 40_000,
      sana: bugun,
      tolovTuri: "naqd",
      izoh: "Direktor xarajati",
      accountId: dKassa.id,
    })
  );

  const xodim = await A(() => panel.chiqimHolati(t.business.id, fayruza.id, bugun));
  assert.equal(xodim.bugun, 100_000, "xodim faqat o'z chiqimini ko'radi");

  // Direktorda chegara yo'q (`transactionScopeUserId` → null) — hammasi ko'rinadi.
  const direktor = await A(() => panel.chiqimHolati(t.business.id, null, bugun));
  assert.equal(direktor.bugun, 140_000);
});

// ---------- KASSA TOPSHIRISH ----------

test("kassa topshirish: pul QABULGACHA kassada qoladi, keyin 0 ga tushadi", async () => {
  const oldin = await A(() => panel.xodimKassaHolati(t.business.id, fayruza.id, "Fayruza"));
  assert.equal(oldin.kassada, 750_000);

  const transfer = await A(() =>
    kassaTransfer.kassaTransferYarat(
      t.business.id,
      { userId: fayruza.id, ism: "Fayruza", rol: "SELLER" },
      { toAccountId: dKassa.id, summa: 750_000, turi: "smena", izoh: "Kechki smena" }
    )
  );
  assert.equal(transfer.holat, "kutilmoqda", "direktor tasdiqlashini kutadi");

  const keyin = await A(() => panel.xodimKassaHolati(t.business.id, fayruza.id, "Fayruza"));
  // TOPSHIRISH ≠ QABUL QILISH: pul hali xodimning qo'lida va uni direktor
  // sanab olmagan, shuning uchun "Kassada" raqami O'ZGARMAYDI. Nolga
  // tushadigan raqam — `mavjud`: yangi topshirish uchun band bo'lmagan qism.
  assert.equal(keyin.kassada, 750_000, "qabul qilinmaguncha pul kassada turaveradi");
  assert.equal(keyin.mavjud, 0, "lekin qayta topshirish uchun bo'sh pul yo'q");
  assert.equal(keyin.kirim, 0, "yangi smena 0 dan boshlanadi");
  assert.equal(keyin.chiqim, 0);
  assert.equal(keyin.ochiqTopshirish.summa, 750_000);

  // Direktor qabul qiladi — pul haqiqatda ko'chadi, tarix qatori qoladi.
  await A(() =>
    kassaTransfer.kassaTransferQaror(
      t.business.id,
      { userId: t.user.id, ism: "Direktor", rol: "OWNER" },
      transfer.id,
      { amal: "qabul" }
    )
  );
  const yakuniy = await A(() => panel.xodimKassaHolati(t.business.id, fayruza.id, "Fayruza"));
  assert.equal(yakuniy.kassada, 0, "qabuldan KEYIN kassa yopiladi");
  assert.equal(yakuniy.mavjud, 0);
  assert.equal(yakuniy.ochiqTopshirish, null);

  const tarix = await A(() =>
    prisma.accountTransfer.findMany({ where: { fromAccountId: fKassa.id, turi: "smena" } })
  );
  assert.equal(tarix.length, 1, "topshirish tarixi saqlandi");
  assert.equal(tarix[0].holat, "bajarildi");
});

test("keyingi smena: yangi kirim eski topshirishni yo'qotmaydi", async () => {
  const d = await zakaz("Ikkinchi smena zakazi", 300_000);
  await A(() =>
    yakunlash.zakazniYakunlash({ businessId: t.business.id, dealId: d.id, userId: fayruza.id })
  );

  const k = await A(() => panel.xodimKassaHolati(t.business.id, fayruza.id, "Fayruza"));
  assert.equal(k.kirim, 300_000, "yangi smena faqat yangi kirimni ko'rsatadi");
  assert.equal(k.kassada, 300_000);

  const tarix = await A(() =>
    prisma.accountTransfer.findMany({ where: { fromAccountId: fKassa.id, turi: "smena" } })
  );
  assert.equal(tarix.length, 1, "oldingi topshirilgan summa yo'qolmadi");
  assert.equal(tarix[0].summa, 750_000);
});

// ---------- HUQUQ: "kassa ko'rinmasin" o'z kassasini yashirmaydi ----------

test("huquq: sotuvchida 'kassa.jami' ham, 'pul.berish' ham yo'q", async () => {
  const huquqlar = tekshir.effektivHuquqlar({ rol: "SELLER" });
  assert.equal(huquqlar.has("kassa.jami"), false);
  assert.equal(huquqlar.has("pul.berish"), false);
});

test("huquq: o'z kassasini topshirish 'pul.berish'siz ham o'tadi", async () => {
  // Manba kassa berilmagan — server o'zi xodimning shaxsiy kassasini oladi.
  assert.equal(
    await A(() =>
      kassaTransfer.ozKassaTopshirishimi(t.business.id, fayruza.id, {
        toAccountId: dKassa.id,
        summa: 100,
        turi: "smena",
      })
    ),
    true
  );
  // O'z kassasi ochiq ko'rsatilgan — bu ham topshirish.
  assert.equal(
    await A(() =>
      kassaTransfer.ozKassaTopshirishimi(t.business.id, fayruza.id, {
        fromAccountId: fKassa.id,
        toAccountId: dKassa.id,
        summa: 100,
        turi: "smena",
      })
    ),
    true
  );
});

test("huquq: birovning kassasi va oddiy o'tkazma bu yo'ldan o'tmaydi", async () => {
  // Direktorning kassasidan topshirish — Fayruza uchun emas.
  assert.equal(
    await A(() =>
      kassaTransfer.ozKassaTopshirishimi(t.business.id, fayruza.id, {
        fromAccountId: dKassa.id,
        toAccountId: fKassa.id,
        summa: 100,
        turi: "smena",
      })
    ),
    false
  );
  // Oddiy o'tkazma (topshirish emas) — "pul.berish" talab qilinaveradi.
  assert.equal(
    await A(() =>
      kassaTransfer.ozKassaTopshirishimi(t.business.id, fayruza.id, {
        toAccountId: dKassa.id,
        summa: 100,
        turi: "transfer",
      })
    ),
    false
  );
});

test("xizmat qatlami: birovning shaxsiy kassasidan pul chiqarib bo'lmaydi", async () => {
  await assert.rejects(
    A(() =>
      kassaTransfer.kassaTransferYarat(
        t.business.id,
        { userId: fayruza.id, ism: "Fayruza", rol: "SELLER" },
        { fromAccountId: dKassa.id, toAccountId: fKassa.id, summa: 1_000, turi: "smena" }
      )
    ),
    /boshqa foydalanuvchiga tegishli/i
  );
});

import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { dateOnlyStringToUTCDate, utcDateToDateOnlyString } from "@/lib/date";
import {
  DEMO_BUSINESS_ID,
  DEMO_BUSINESS_NOMI,
  DEMO_LOGIN,
  DEMO_TENANT_ID,
  DEMO_TENANT_NOMI,
  DEMO_TENANT_SLUG,
  DEMO_USER_ID,
} from "@/lib/auth/demo";
import {
  CHIQIM_KATEGORIYALAR,
  KIRIM_KATEGORIYALAR,
  MAHSULOTLAR,
  MIJOZLAR,
  XODIMLAR,
  ZAKAZLAR,
  ZAKAZ_BOSQICHLARI,
  demoJamlar,
  demoReja,
} from "./reja";

/**
 * DEMO DATASETNI BAZAGA EKISH.
 *
 * Prisma klienti ARGUMENT sifatida beriladi: shu tufayli bu modul `rawPrisma`
 * ni import qilmaydi (CLAUDE.md dagi tenant izolyatsiyasi qoidasi buzilmaydi)
 * va testda ham, `scripts/demo-seed.ts` da ham bir xil ishlaydi.
 *
 * IDEMPOTENT: qayta ishga tushirilsa demo biznesning barcha ish ma'lumotlari
 * o'chirilib, reja bo'yicha qaytadan quriladi. Tenant/foydalanuvchi/biznes
 * yozuvlari esa BARQAROR ID bilan saqlanadi — demo havolasi o'zgarmaydi.
 *
 * DIQQAT: bu skript FAQAT demo tenantga tegadi. Boshqa hech bir tenantning
 * yozuvi o'qilmaydi ham, o'zgartirilmaydi ham.
 */

/** Demo kassalari — nomi kod sifatida ishlatiladi. */
const KASSALAR = [
  { kalit: "naqd" as const, nomi: "Asosiy kassa", turi: "naqd", tartib: 0 },
  { kalit: "plastik" as const, nomi: "Click terminal", turi: "plastik", tartib: 1 },
];

export interface DemoEkishNatija {
  tenantId: string;
  businessId: string;
  userId: string;
  sotuvlar: number;
  tranzaksiyalar: number;
  qarzlar: number;
  mahsulotlar: number;
  mijozlar: number;
  xodimlar: number;
  zakazlar: number;
  jamlar: ReturnType<typeof demoJamlar>;
}

/** Bugundan `kunOldin` kun oldingi sana (UTC yarim tun) — barcha yozuvlar shu shaklda. */
function sana(kunOldin: number, bugun: Date): Date {
  const d = new Date(bugun.getTime() - kunOldin * 24 * 60 * 60 * 1000);
  return dateOnlyStringToUTCDate(utcDateToDateOnlyString(d));
}

/** Demo biznesning BARCHA ish ma'lumotlarini o'chiradi (FK tartibida). */
async function eskiMalumotniOchir(db: PrismaClient, businessId: string): Promise<void> {
  const where = { businessId };
  // Tartib MUHIM: bola-jadval avval (FK Restrict).
  await db.debtPayment.deleteMany({ where });
  await db.debt.deleteMany({ where });
  await db.sale.deleteMany({ where });
  await db.stockEntry.deleteMany({ where });
  await db.stockAdjustment.deleteMany({ where });
  await db.accountTransfer.deleteMany({ where });
  await db.activity.deleteMany({ where });
  await db.deal.deleteMany({ where });
  await db.stage.deleteMany({ where });
  await db.transaction.deleteMany({ where });
  await db.employee.deleteMany({ where });
  await db.contact.deleteMany({ where });
  await db.product.deleteMany({ where });
  await db.category.deleteMany({ where });
  await db.account.deleteMany({ where });
  // AuditLog ATAYLAB o'chirilmaydi — u append-only (rawPrisma darajasida
  // taqiqlangan). Demo ekish audit yozuvi qoldirmaydi, shuning uchun bu
  // jurnal baribir bo'sh turadi.
}

/** Tenant + OWNER + biznes — barqaror ID bilan, mavjud bo'lsa yangilanadi. */
async function skeletniTayyorla(db: PrismaClient): Promise<void> {
  // XAVFSIZLIK QULFI: agar shu ID band bo'lsa-yu, u DEMO bo'lmasa — skript
  // TO'XTAYDI. Aks holda ID tasodifan mos kelgan HAQIQIY mijozning ish
  // ma'lumotlari o'chib ketardi (quyida `eskiMalumotniOchir` ishlaydi).
  const mavjud = await db.tenant.findUnique({
    where: { id: DEMO_TENANT_ID },
    select: { demo: true, name: true },
  });
  if (mavjud && !mavjud.demo) {
    throw new Error(
      `'${DEMO_TENANT_ID}' IDsi demo bo'lmagan kompaniyaga ('${mavjud.name}') tegishli — ` +
        "demo ekish TO'XTATILDI."
    );
  }

  await db.tenant.upsert({
    where: { id: DEMO_TENANT_ID },
    update: { demo: true, bepul: true, status: "ACTIVE", plan: "PRO", name: DEMO_TENANT_NOMI },
    create: {
      id: DEMO_TENANT_ID,
      name: DEMO_TENANT_NOMI,
      slug: DEMO_TENANT_SLUG,
      // ACTIVE + bepul: demo'da obuna bannerlari va muddat sanoqlari
      // ko'rinmaydi — mehmon to'lov haqidagi xabarlarni emas, mahsulotni
      // ko'rishi kerak. Yozish qulfi statusdan MUSTAQIL ishlaydi.
      status: "ACTIVE",
      bepul: true,
      demo: true,
      plan: "PRO",
    },
  });

  await db.business.upsert({
    where: { id: DEMO_BUSINESS_ID },
    update: { nomi: DEMO_BUSINESS_NOMI, isActive: true, omborli: true },
    create: {
      id: DEMO_BUSINESS_ID,
      nomi: DEMO_BUSINESS_NOMI,
      tenantId: DEMO_TENANT_ID,
      turi: "umumiy",
      omborli: true,
      yonalish: "wholesale",
    },
  });

  // Parol TASODIFIY va hech qayerda saqlanmaydi: demo hisobiga faqat
  // `/api/demo/kirish` orqali kiriladi, `/login` orqali — hech qachon.
  const parolHash = await hashPassword(
    `demo-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  );
  await db.user.upsert({
    where: { id: DEMO_USER_ID },
    update: { isActive: true, parolHash, tenantId: DEMO_TENANT_ID, businessId: DEMO_BUSINESS_ID },
    create: {
      id: DEMO_USER_ID,
      ism: "Demo direktor",
      login: DEMO_LOGIN,
      parolHash,
      rol: "OWNER",
      tenantId: DEMO_TENANT_ID,
      businessId: DEMO_BUSINESS_ID,
      mustChangePassword: false,
    },
  });

  // Demo'da menyu to'liq ko'rinsin — PRO tarifidagi modullar yoqiladi.
  for (const code of ["OMBOR", "KUNLIK", "MIJOZLAR", "CRM", "HR", "VAZIFALAR"]) {
    await db.tenantModule.upsert({
      where: { tenantId_code: { tenantId: DEMO_TENANT_ID, code } },
      update: { isActive: true },
      create: { tenantId: DEMO_TENANT_ID, code, isActive: true },
    });
  }
}

export async function demoDatasetYarat(
  db: PrismaClient,
  bugun: Date = new Date()
): Promise<DemoEkishNatija> {
  await skeletniTayyorla(db);
  await eskiMalumotniOchir(db, DEMO_BUSINESS_ID);

  const reja = demoReja();
  const jamlar = demoJamlar(reja);
  const businessId = DEMO_BUSINESS_ID;
  const userId = DEMO_USER_ID;

  // ---- Kassalar ----
  const kassaId: Record<string, string> = {};
  for (const k of KASSALAR) {
    const acc = await db.account.create({
      data: { businessId, nomi: k.nomi, turi: k.turi, tartib: k.tartib },
    });
    kassaId[k.kalit] = acc.id;
  }

  // ---- Kategoriyalar ----
  const katId: Record<string, string> = {};
  for (const [i, nomi] of KIRIM_KATEGORIYALAR.entries()) {
    const c = await db.category.create({ data: { businessId, nomi, turi: "kirim", tartib: i } });
    katId[`kirim:${nomi}`] = c.id;
  }
  for (const [i, nomi] of CHIQIM_KATEGORIYALAR.entries()) {
    const c = await db.category.create({ data: { businessId, nomi, turi: "chiqim", tartib: i } });
    katId[`chiqim:${nomi}`] = c.id;
  }

  // ---- Mahsulotlar ----
  const mahsulotId: Record<string, string> = {};
  for (const m of MAHSULOTLAR) {
    const p = await db.product.create({
      data: {
        businessId,
        nomi: m.nomi,
        birlik: m.birlik,
        kelganNarx: m.kelganNarx,
        sotuvNarx: m.sotuvNarx,
        // Qoldiq REJADAN olinadi va quyida "kirim − sotilgan" bilan
        // solishtirib tekshiriladi (nomuvofiqlik bo'lsa ekish TO'XTAYDI).
        miqdor: m.qoldiq,
        minQoldiq: m.minQoldiq,
      },
    });
    mahsulotId[m.kod] = p.id;
  }

  // ---- Mijozlar ----
  const mijozId: Record<string, string> = {};
  for (const c of MIJOZLAR) {
    const rec = await db.contact.create({
      data: { businessId, ism: c.ism, tel: c.tel, manzil: c.manzil, createdBy: userId },
    });
    mijozId[c.kod] = rec.id;
  }

  // ---- Xodimlar ----
  for (const x of XODIMLAR) {
    await db.employee.create({
      data: {
        businessId,
        ism: x.ism,
        lavozim: x.lavozim,
        stavka: x.stavka,
        stavkaTuri: "oylik",
        ishBoshlagan: sana(300, bugun),
      },
    });
  }

  // ---- Omborga kirim ----
  // Chiqim tranzaksiyasi ATAYLAB yozilmaydi: `createStockEntry` ham
  // shunday ishlaydi (lib/services/inventory.ts) — omborga tovar kelishi
  // o'z-o'zidan pul harakati emas. Ta'minotchiga to'lov alohida chiqim
  // sifatida yoziladi (reja.chiqimlar → "Tovar xaridi").
  let tranzaksiyaSoni = 0;
  for (const m of MAHSULOTLAR) {
    for (const [i, p] of reja.omborKirimlari[m.kod].entries()) {
      await db.stockEntry.create({
        data: {
          businessId,
          productId: mahsulotId[m.kod],
          miqdor: p.miqdor,
          birlikNarx: m.kelganNarx,
          userId,
          izoh: i === 0 ? "Boshlang'ich qoldiq" : "Ta'minotchidan qabul qilindi",
          createdAt: sana(p.kunOldin, bugun),
        },
      });
    }
  }

  // ---- Sotuvlar (naqd → kirim, qarz → qarzdorlik) ----
  const sotuvId: string[] = [];
  const qarzId: Record<number, string> = {};
  for (const [i, s] of reja.sotuvlar.entries()) {
    const m = MAHSULOTLAR.find((x) => x.kod === s.mahsulotKod)!;
    const mijoz = MIJOZLAR.find((x) => x.kod === s.mijozKod)!;
    const jamiSumma = m.sotuvNarx * s.miqdor;
    const sotuvSana = sana(s.kunOldin, bugun);

    const sale = await db.sale.create({
      data: {
        businessId,
        productId: mahsulotId[m.kod],
        miqdor: s.miqdor,
        birlikNarx: m.sotuvNarx,
        tannarx: m.kelganNarx,
        jamiSumma,
        tolovTuri: s.tolovTuri,
        contactId: mijozId[mijoz.kod],
        mijozNomi: mijoz.ism,
        mijozTel: mijoz.tel,
        userId,
        sana: sotuvSana,
        createdAt: sotuvSana,
      },
    });
    sotuvId.push(sale.id);

    if (s.tolovTuri === "naqd") {
      const txn = await db.transaction.create({
        data: {
          businessId,
          turi: "kirim",
          categoryId: katId["kirim:Sotuv"],
          accountId: kassaId[s.kassa],
          tolovTuri: s.kassa === "naqd" ? "naqd" : "click",
          summa: jamiSumma,
          sana: sotuvSana,
          izoh: `${m.nomi} × ${s.miqdor}`,
          userId,
        },
      });
      tranzaksiyaSoni++;
      await db.sale.update({ where: { id: sale.id }, data: { transactionId: txn.id } });
    } else {
      const debt = await db.debt.create({
        data: {
          businessId,
          turi: "olinadigan",
          saleId: sale.id,
          productId: mahsulotId[m.kod],
          contactId: mijozId[mijoz.kod],
          mijozNomi: mijoz.ism,
          mijozTel: mijoz.tel,
          jamiSumma,
          status: "OPEN",
          sana: sotuvSana,
          // Kelishilgan muddat — qarzdorlik ekranida "muddati o'tgan"
          // holatlar ham ko'rinsin.
          muddat: sana(s.kunOldin - 14, bugun),
          userId,
        },
      });
      qarzId[i] = debt.id;
    }
  }

  // ---- Qarz to'lovlari (kirim tranzaksiyasi to'lov sanasi bilan) ----
  const tolanganJami: Record<string, number> = {};
  for (const t of reja.qarzTolovlari) {
    const debtId = qarzId[t.sotuvIndex];
    if (!debtId) continue;
    const tolovSana = sana(t.kunOldin, bugun);
    const txn = await db.transaction.create({
      data: {
        businessId,
        turi: "kirim",
        categoryId: katId["kirim:Qarz to'lovi"],
        accountId: kassaId.naqd,
        tolovTuri: "naqd",
        summa: t.summa,
        sana: tolovSana,
        izoh: "Qarz to'lovi qabul qilindi",
        userId,
      },
    });
    tranzaksiyaSoni++;
    await db.debtPayment.create({
      data: {
        debtId,
        businessId,
        summa: t.summa,
        sana: tolovSana,
        tolovTuri: "naqd",
        accountId: kassaId.naqd,
        userId,
        transactionId: txn.id,
        createdAt: tolovSana,
      },
    });
    tolanganJami[debtId] = (tolanganJami[debtId] ?? 0) + t.summa;
  }

  // Qarz holati to'lovlardan KEYIN yangilanadi — `tolangan`, `status` va
  // `isYopilgan` har doim bir-biriga mos bo'lishi shart (schema izohi).
  for (const [debtId, tolangan] of Object.entries(tolanganJami)) {
    const debt = await db.debt.findUnique({ where: { id: debtId }, select: { jamiSumma: true } });
    if (!debt) continue;
    const yopiq = tolangan >= debt.jamiSumma;
    await db.debt.update({
      where: { id: debtId },
      data: {
        tolangan,
        status: yopiq ? "PAID" : "PARTIALLY_PAID",
        isYopilgan: yopiq,
      },
    });
  }

  // ---- Doimiy xarajatlar ----
  for (const c of reja.chiqimlar) {
    await db.transaction.create({
      data: {
        businessId,
        turi: "chiqim",
        categoryId: katId[`chiqim:${c.kategoriya}`],
        accountId: kassaId[c.kassa],
        tolovTuri: c.kassa === "naqd" ? "naqd" : "click",
        summa: c.summa,
        sana: sana(c.kunOldin, bugun),
        izoh: c.izoh,
        userId,
      },
    });
    tranzaksiyaSoni++;
  }

  // ---- Terminaldan kassaga o'tkazma ----
  for (const o of reja.otkazmalar) {
    await db.accountTransfer.create({
      data: {
        businessId,
        fromAccountId: kassaId.plastik,
        toAccountId: kassaId.naqd,
        summa: o.summa,
        sana: sana(o.kunOldin, bugun),
        izoh: "Terminaldan naqd kassaga yechildi",
        userId,
      },
    });
  }

  // ---- CRM: bosqichlar va zakazlar ----
  const bosqichId: Record<string, string> = {};
  for (const [i, b] of ZAKAZ_BOSQICHLARI.entries()) {
    const st = await db.stage.create({
      data: { businessId, nomi: b.nomi, tartib: i, turi: b.turi },
    });
    bosqichId[b.nomi] = st.id;
  }
  for (const z of ZAKAZLAR) {
    await db.deal.create({
      data: {
        businessId,
        contactId: mijozId[z.mijozKod],
        nomi: z.nomi,
        summa: z.summa,
        stageId: bosqichId[z.bosqich],
        masulId: userId,
        createdBy: userId,
        sana: sana(z.kunOldin, bugun),
        createdAt: sana(z.kunOldin, bugun),
      },
    });
  }

  // ---- Yakuniy nazorat: ombor qoldig'i haqiqatan ham mos keladimi ----
  for (const m of MAHSULOTLAR) {
    const kirgan = reja.omborKirimlari[m.kod].reduce((s, p) => s + p.miqdor, 0);
    const sotilgan = reja.sotuvlar
      .filter((s) => s.mahsulotKod === m.kod)
      .reduce((s, x) => s + x.miqdor, 0);
    if (kirgan - sotilgan !== m.qoldiq) {
      throw new Error(
        `Demo ma'lumoti nomuvofiq: ${m.nomi} — kirgan ${kirgan} − sotilgan ${sotilgan} ≠ qoldiq ${m.qoldiq}`
      );
    }
  }

  return {
    tenantId: DEMO_TENANT_ID,
    businessId,
    userId,
    sotuvlar: sotuvId.length,
    tranzaksiyalar: tranzaksiyaSoni,
    qarzlar: Object.keys(qarzId).length,
    mahsulotlar: MAHSULOTLAR.length,
    mijozlar: MIJOZLAR.length,
    xodimlar: XODIMLAR.length,
    zakazlar: ZAKAZLAR.length,
    jamlar,
  };
}

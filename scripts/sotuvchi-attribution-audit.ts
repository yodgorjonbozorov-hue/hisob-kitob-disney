/**
 * SOTUVCHI ATTRIBUTION AUDITI — FAQAT O'QISH (SELECT).
 *
 * Savol: avtomatik migratsiya yaratgan `DealEmployee` sotuvchi yozuvlarini
 * QO'LDA yozilganidan xavfsiz ajratib bo'ladimi? Bu rollback rejasining
 * asosi — ajratib bo'lmasa, ommaviy qaytarish xavfli.
 *
 * BELGILAR (birgalikda ishlatiladi, hech biri yolg'iz yetarli emas):
 *   · `createdAt` — migratsiya bir necha soniyalik oynada yozgan, qo'lda
 *     kiritish esa tarqoq bo'ladi;
 *   · barcha yozuvlar BIR xodimga va sotuvchi lavozimiga tegishli;
 *   · zakaz lentasida (`Activity`) mos "Sotuvchi o'zgardi" yozuvi YO'Q —
 *     migratsiya lenta yozmagan, qo'lda o'zgartirish esa yozadi.
 *
 * Shuningdek: `Deal.masulId` tegilmaganini va moliya biriktiruvi
 * (`Transaction.sotuvchiId`) o'zgarmaganini tasdiqlaydi — qaytarish
 * qanchalik to'liq bo'lishini shu belgilaydi.
 *
 * OMMAVIY LOG: ism niqoblanadi, pul summasi chiqmaydi.
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";

const BUSINESS_ID = process.env.BUSINESS_ID ?? "";
const OMMAVIY = Boolean(process.env.CI);
const niqob = (s: string) => (OMMAVIY ? `${s.slice(0, 2)}…(${s.length})` : s);

async function main() {
  if (!BUSINESS_ID) throw new Error("BUSINESS_ID kerak");
  console.log("REJIM: FAQAT O'QISH (SELECT) — bazaga YOZILMAYDI");

  const sotuvKat = await rawPrisma.employeeCategory.findMany({
    where: { businessId: BUSINESS_ID, turi: "sotuvchi" },
    select: { id: true, nomi: true },
  });
  const katIdlar = sotuvKat.map((k) => k.id);
  console.log(`Sotuvchi lavozimlari: ${sotuvKat.map((k) => `${k.nomi}(${k.id})`).join(", ") || "yo'q"}`);

  const yozuvlar = await rawPrisma.dealEmployee.findMany({
    where: { businessId: BUSINESS_ID, categoryId: { in: katIdlar } },
    select: {
      id: true, dealId: true, employeeId: true, createdAt: true, baho: true,
      employee: { select: { ism: true } },
      deal: { select: { masulId: true, holat: true, transactionId: true, sana: true, createdAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nSOTUVCHI BIRIKTIRUVLARI: ${yozuvlar.length} ta`);
  if (yozuvlar.length === 0) return;

  // 1-BELGI: yaratilish oynasi.
  const vaqtlar = yozuvlar.map((y) => y.createdAt.getTime());
  const boshi = new Date(Math.min(...vaqtlar));
  const oxiri = new Date(Math.max(...vaqtlar));
  const oynaSek = Math.round((oxiri.getTime() - boshi.getTime()) / 1000);
  console.log(`\n1-BELGI — yaratilish oynasi:`);
  console.log(`  birinchi: ${boshi.toISOString()}`);
  console.log(`  oxirgi:   ${oxiri.toISOString()}`);
  console.log(`  oyna:     ${oynaSek} soniya`);
  console.log(`  xulosa:   ${oynaSek <= 120 ? "BIR PARTIYA — mashina yozgan" : "TARQOQ — qo'l aralashgan bo'lishi mumkin"}`);

  // 2-BELGI: bir xodimmi.
  const xodimlar = new Map<string, number>();
  for (const y of yozuvlar) xodimlar.set(y.employeeId, (xodimlar.get(y.employeeId) ?? 0) + 1);
  console.log(`\n2-BELGI — xodimlar taqsimoti:`);
  for (const [id, n] of xodimlar) {
    const ism = yozuvlar.find((y) => y.employeeId === id)!.employee.ism;
    console.log(`  ${id} ${niqob(ism)} — ${n} ta`);
  }
  console.log(`  xulosa: ${xodimlar.size === 1 ? "BITTA xodim — migratsiya naqshiga mos" : "BIR NECHTA xodim — qo'lda kiritilgani bor"}`);

  // 3-BELGI: lentada "Sotuvchi o'zgardi" bormi.
  const lenta = await rawPrisma.activity.findMany({
    where: { businessId: BUSINESS_ID, dealId: { in: yozuvlar.map((y) => y.dealId) }, matn: { contains: "Sotuvchi o'zgardi" } },
    select: { dealId: true },
  });
  const qolYozgan = new Set(lenta.map((a) => a.dealId));
  console.log(`\n3-BELGI — lentada "Sotuvchi o'zgardi" yozuvi bor zakazlar: ${qolYozgan.size} ta`);
  console.log(`  xulosa: ${qolYozgan.size === 0 ? "hech biri QO'LDA o'zgartirilmagan" : "ba'zilari qo'lda tegilgan — ular ajratiladi"}`);

  // XAVFSIZ AJRATISH.
  const xavfsiz = yozuvlar.filter(
    (y) => !qolYozgan.has(y.dealId) && y.baho === null && y.createdAt >= boshi && y.createdAt <= oxiri
  );
  console.log(`\nXAVFSIZ AJRATILADIGAN (mashina yozgan, qo'l tegmagan, baholanmagan): ${xavfsiz.length} / ${yozuvlar.length}`);
  console.log(`  Baholangan (tegilmaydi): ${yozuvlar.filter((y) => y.baho !== null).length} ta`);

  // QAYTARISH TO'LIQMI: Deal.masulId saqlanibdimi.
  const masulBor = yozuvlar.filter((y) => y.deal.masulId).length;
  console.log(`\nQAYTARISH IMKONI:`);
  console.log(`  Deal.masulId saqlangan: ${masulBor} / ${yozuvlar.length} — o'chirilsa avvalgi holat TIKLANADI`);
  const masulTaqsim = new Map<string, number>();
  for (const y of yozuvlar) masulTaqsim.set(y.deal.masulId, (masulTaqsim.get(y.deal.masulId) ?? 0) + 1);
  for (const [uid, n] of masulTaqsim) console.log(`    masulId ${uid} — ${n} ta zakaz`);

  // MOLIYAGA TEGILGANMI.
  const trIdlar = yozuvlar.map((y) => y.deal.transactionId).filter((x): x is string => Boolean(x));
  console.log(`\nMOLIYA BOG'LANISHI:`);
  console.log(`  Kirim yozilgan zakazlar: ${trIdlar.length} / ${yozuvlar.length}`);
  if (trIdlar.length > 0) {
    const trlar = await rawPrisma.transaction.findMany({
      where: { businessId: BUSINESS_ID, id: { in: trIdlar } },
      select: { id: true, sotuvchiId: true, userId: true },
    });
    const taqsim = new Map<string, number>();
    for (const t of trlar) taqsim.set(t.sotuvchiId ?? `(yo'q) userId=${t.userId}`, (taqsim.get(t.sotuvchiId ?? `(yo'q) userId=${t.userId}`) ?? 0) + 1);
    for (const [k, n] of taqsim) console.log(`    Transaction.sotuvchiId ${k} — ${n} ta`);
    console.log(`  DIQQAT: bu ustun KPI sotuv bonusining manbai (User.id bo'yicha).`);
  }

  // ZAKAZ HOLATLARI — qayta tasniflashda nima o'zgaradi.
  const holatlar = new Map<string, number>();
  for (const y of yozuvlar) holatlar.set(y.deal.holat, (holatlar.get(y.deal.holat) ?? 0) + 1);
  console.log(`\nZAKAZ HOLATLARI (KPI ta'siri):`);
  for (const [h, n] of holatlar) console.log(`  ${h}: ${n} ta`);

  console.log(`\nHOLAT: OK — faqat o'qildi, hech narsa o'zgartirilmadi.`);
}

main()
  .then(() => rawPrisma.$disconnect())
  .catch(async (e) => {
    console.error("XATO:", e);
    await rawPrisma.$disconnect();
    process.exit(1);
  });

/**
 * E2E: Bizneslar sahifasi uchun qo'shimcha yozuvlar.
 *
 * Ro'yxatni HAQIQIY hajmda sinash uchun: 20+ biznes, ular orasida uzun nomli
 * va nofaol biznes. Faqat sinov bazasida ishlaydi (prisma/e2e.db).
 */
import { rawPrisma } from "@/lib/db/rawPrisma";
import { DEFAULT_KASSA_NOMI } from "@/lib/services/accounts";

async function main() {
  const tenant = await rawPrisma.tenant.findFirst({ select: { id: true } });
  if (!tenant) throw new Error("Tenant topilmadi — avval e2e-tayyorla.mjs ishga tushiring");

  const nomlar = [
    ...Array.from({ length: 22 }, (_, i) => `Filial ${i + 1}`),
    "Juda uzun nomli biznes — Toshkent shahar Yunusobod tumani savdo majmuasi",
  ];

  for (const [i, nomi] of nomlar.entries()) {
    const bor = await rawPrisma.business.findFirst({ where: { tenantId: tenant.id, nomi } });
    if (bor) continue;
    const biz = await rawPrisma.business.create({
      // Har uchinchisi nofaol — "Nofaol" filtri sinovdan o'tsin.
      data: { nomi, tenantId: tenant.id, isActive: i % 3 !== 0 },
    });
    await rawPrisma.account.create({
      data: { businessId: biz.id, nomi: DEFAULT_KASSA_NOMI, turi: "naqd", tartib: 0 },
    });
  }
  await rawPrisma.$disconnect();
  console.log(`Bizneslar ekildi: ${nomlar.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * MASHINA YOZGAN SOTUVCHI ATTRIBUTIONINI "TASDIQLANMAGAN" QILISH.
 *
 * NEGA. Avtomatik migratsiya eski zakazlarni `Deal.masulId` bo'yicha
 * sotuvchiga biriktirgan edi. Disney Navoiyda sotuv bo'limi BITTA umumiy
 * kompyuterdan ishlagani ma'lum bo'lgach, bu biriktiruvlar TAXMIN ekani
 * aniqlandi: kirgan hisob zakazni kim sotganini bildirmaydi.
 *
 * NIMA QILADI. Shu biriktiruvlarni `tasdiqlangan = false` qiladi.
 *   · O'CHIRMAYDI — tarix va taklif saqlanadi, formada ko'rinib turadi;
 *   · KPI va oylikdan chiqaradi (ikkalasi ham `tasdiqlangan` ni filtrlaydi);
 *   · odam zakazni ochib saqlasa qator TASDIQLANADI va qaytib kiradi.
 *
 * NIMA QILMAYDI. `Deal`, `Transaction`, `Debt`, `Sale`, kassa — hech biriga
 * TEGMAYDI. `Deal.masulId` ham o'z joyida qoladi.
 *
 * XAVFSIZ AJRATISH (auditdan): faqat shu shartlarning HAMMASI bajarilsa:
 *   · sotuvchi turidagi lavozim biriktiruvi;
 *   · `baho` yozilmagan (baholangan ishga tegilmaydi);
 *   · zakaz lentasida "Sotuvchi o'zgardi" yozuvi YO'Q (qo'l tegmagan);
 *   · hozir `tasdiqlangan = true`.
 * Qolganlari hisobotda "tegilmadi" deb chiqadi.
 *
 * Standart rejim QURUQ. Yozish: --qollash
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";

const QOLLASH = process.argv.includes("--qollash");
const BUSINESS_ID = process.env.BUSINESS_ID ?? "";
const OMMAVIY = Boolean(process.env.CI);
const niqob = (s: string) => (OMMAVIY ? `${s.slice(0, 2)}…(${s.length})` : s);

async function main() {
  if (!BUSINESS_ID) throw new Error("BUSINESS_ID kerak");
  console.log(QOLLASH ? "REJIM: QO'LLASH (bazaga yoziladi)" : "REJIM: QURUQ — bazaga YOZILMAYDI");

  const katIdlar = (
    await rawPrisma.employeeCategory.findMany({
      where: { businessId: BUSINESS_ID, turi: "sotuvchi" },
      select: { id: true },
    })
  ).map((k) => k.id);
  if (katIdlar.length === 0) throw new Error("Sotuvchi lavozimi yo'q");

  const yozuvlar = await rawPrisma.dealEmployee.findMany({
    where: { businessId: BUSINESS_ID, categoryId: { in: katIdlar } },
    select: {
      id: true, dealId: true, employeeId: true, baho: true, tasdiqlangan: true,
      employee: { select: { ism: true } },
    },
  });
  console.log(`Sotuvchi biriktiruvlari: ${yozuvlar.length} ta`);

  const qolTekkan = new Set(
    (
      await rawPrisma.activity.findMany({
        where: {
          businessId: BUSINESS_ID,
          dealId: { in: yozuvlar.map((y) => y.dealId) },
          matn: { contains: "Sotuvchi o'zgardi" },
        },
        select: { dealId: true },
      })
    ).map((a) => a.dealId)
  );

  const nishon = yozuvlar.filter(
    (y) => y.tasdiqlangan && y.baho === null && !qolTekkan.has(y.dealId)
  );
  const tegilmaydi = yozuvlar.filter((y) => !nishon.includes(y));

  const boyicha = new Map<string, number>();
  for (const y of nishon) boyicha.set(y.employeeId, (boyicha.get(y.employeeId) ?? 0) + 1);

  console.log("");
  console.log(`${QOLLASH ? "TASDIQSIZ QILINDI" : "TASDIQSIZ QILINADI"}: ${nishon.length} ta`);
  for (const [id, n] of boyicha) {
    const ism = nishon.find((y) => y.employeeId === id)!.employee.ism;
    console.log(`  ${id} ${niqob(ism)} — ${n} ta`);
  }
  console.log(`TEGILMAYDI: ${tegilmaydi.length} ta (baholangan, qo'l tekkan yoki allaqachon tasdiqsiz)`);

  if (QOLLASH && nishon.length > 0) {
    const n = await rawPrisma.dealEmployee.updateMany({
      where: { businessId: BUSINESS_ID, id: { in: nishon.map((y) => y.id) } },
      data: { tasdiqlangan: false, tasdiqlaganUserId: null },
    });
    console.log(`\nYOZILDI: ${n.count} qator yangilandi.`);
    const qoldi = await rawPrisma.dealEmployee.count({
      where: { businessId: BUSINESS_ID, categoryId: { in: katIdlar }, tasdiqlangan: true },
    });
    console.log(`Tekshiruv — hali tasdiqlangan sotuvchi biriktiruvi: ${qoldi} ta`);
  }
  if (!QOLLASH) console.log("\nQURUQ rejim — hech narsa yozilmadi. Qo'llash: --qollash");
  console.log("Moliyaga TEGILMADI: Deal/Transaction/Debt/Sale/kassa o'qilmadi ham.");
}

main()
  .then(() => rawPrisma.$disconnect())
  .catch(async (e) => {
    console.error("XATO:", e);
    await rawPrisma.$disconnect();
    process.exit(1);
  });

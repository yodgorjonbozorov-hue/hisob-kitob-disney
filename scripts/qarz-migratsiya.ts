/**
 * QARZ MIGRATSIYASI — eski "Kirim → Qarz" yozuvlarini `Debt` ga ko'chiradi.
 *
 * MUAMMO. Ilgari Yozuvlar sahifasida "Kirim + to'lov turi Qarz" tanlansa,
 * oddiy `Transaction` yozilardi va HECH QANDAY qarz yozuvi yaratilmasdi.
 * Natijada:
 *   - summa sof balansga qo'shilib ketardi (endi `lib/qarzFiltr.ts` to'sadi);
 *   - qarz Qarzlar ro'yxatida ko'rinmasdi va uni yopib bo'lmasdi.
 *
 * NIMA QILADI. Har `turi="kirim"`, `tolovTuri="qarz"` tranzaksiya uchun
 * `Debt` yozuvi ochadi:
 *   - `manbaTransactionId` — asl tranzaksiya IDsi (bog'lanish va idempotentlik);
 *   - `sana`     — tranzaksiyaning o'z sanasi (qarz berilgan kun);
 *   - `mijozNomi`— izohdan, izoh bo'sh bo'lsa "Noma'lum mijoz".
 *
 * NIMA QILMAYDI. Asl tranzaksiyaga TEGMAYDI: ID, summa, sana, izoh —
 * hammasi joyida qoladi. Yozuvlar ro'yxatida u avvalgidek ko'rinadi,
 * shunchaki endi kirim jamlariga kirmaydi. O'chirilgan (soft-delete)
 * yozuvlar ham ko'chirilmaydi.
 *
 * IDEMPOTENT: `Debt.manbaTransactionId` UNIQUE, shuning uchun qayta-qayta
 * ishga tushirilsa ham dublikat yaratilmaydi.
 *
 * Ishga tushirish: npm run qarz:migratsiya
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { qarzHolatHisobla } from "@/lib/validation/qarz";

const NOMALUM = "Noma'lum mijoz";

/** Izohdan mijoz ismini chiqarish. Izoh bo'sh yoki juda uzun bo'lsa — standart. */
function mijozNomidanIzoh(izoh: string | null): string {
  const t = izoh?.trim();
  if (!t) return NOMALUM;
  return t.length > 100 ? t.slice(0, 100) : t;
}

async function main() {
  // Build vaqtida (env'siz lokal build) jimgina o'tkazib yuboriladi —
  // `db-migrate.mjs` bilan bir xil xatti-harakat.
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL yo'q — qarz migratsiyasi o'tkazib yuborildi.");
    return;
  }

  const yozuvlar = await rawPrisma.transaction.findMany({
    where: { turi: "kirim", tolovTuri: "qarz", deletedAt: null },
    select: {
      id: true,
      businessId: true,
      summa: true,
      sana: true,
      izoh: true,
      userId: true,
      categoryId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (yozuvlar.length === 0) {
    console.log("Ko'chiriladigan eski qarz yozuvi yo'q.");
    return;
  }

  // Allaqachon ko'chirilganlar — bitta so'rovda (har yozuv uchun alohida
  // tekshirish minglab yozuvda sekin bo'lardi).
  const mavjud = await rawPrisma.debt.findMany({
    where: { manbaTransactionId: { in: yozuvlar.map((y) => y.id) } },
    select: { manbaTransactionId: true },
  });
  const kochirilgan = new Set(mavjud.map((m) => m.manbaTransactionId));

  let yaratildi = 0;
  for (const y of yozuvlar) {
    if (kochirilgan.has(y.id)) continue;
    const status = qarzHolatHisobla(y.summa, 0);
    await rawPrisma.debt.create({
      data: {
        businessId: y.businessId,
        turi: "olinadigan",
        mijozNomi: mijozNomidanIzoh(y.izoh),
        jamiSumma: y.summa,
        tolangan: 0,
        status,
        isYopilgan: false,
        sana: y.sana,
        categoryId: y.categoryId,
        manbaTransactionId: y.id,
        izoh: y.izoh,
        userId: y.userId,
      },
    });
    yaratildi++;
  }

  console.log(
    `Eski qarz yozuvlari: ${yozuvlar.length} ta · yangi qarz ochildi: ${yaratildi} ta · ` +
      `avvaldan ko'chirilgan: ${yozuvlar.length - yaratildi} ta`
  );
  if (yaratildi > 0) {
    console.log(
      `DIQQAT: ko'chirilgan qarzlarda mijoz ismi izohdan olindi. Qarzlar ` +
        `sahifasida ularni tekshirib, ism va telefonni to'ldirib chiqing.`
    );
  }
}

main()
  .catch((e) => {
    console.error("Qarz migratsiyasi xatosi:", e);
    process.exit(1);
  })
  .finally(() => rawPrisma.$disconnect());

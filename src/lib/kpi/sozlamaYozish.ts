import { runBusinessTx } from "@/lib/db/businessTx";
import { kpiSozlamasi, type KpiSozlamaDTO } from "./sozlama";
import type { SozlamaInput } from "@/lib/validation/kpi";

/**
 * KPI SOZLAMALARINI SAQLASH.
 *
 * Intervallar va ball qoidalari TO'LIQ ALMASHTIRILADI (o'chirib qayta
 * yoziladi), chunki ular ro'yxat sifatida tahrirlanadi: qatorni o'chirish,
 * qo'shish va tartibini o'zgartirish bitta amalda keladi. Qisman yangilash
 * yarim eski, yarim yangi jadval qoldirib ketishi mumkin edi — bu esa
 * oylikni jimgina noto'g'ri hisoblardi.
 *
 * Amal ATOMIK: o'chirish bajarilib, yozish bajarilmasa biznes bonussiz
 * qolardi. Tranzaksiya ichida xom `tx` — HAR so'rovga `businessId` sharti
 * QO'LDA yozilgan (lib/db/businessTx.ts).
 *
 * YOPILGAN OYLARGA TA'SIR QILMAYDI: ular snapshotdan o'qiladi, ya'ni
 * foizni bugun o'zgartirish o'tgan oyning oyligini qayta yozmaydi.
 */
export async function sozlamaSaqla(
  businessId: string,
  data: SozlamaInput
): Promise<KpiSozlamaDTO> {
  // Yozuvlar mavjudligiga kafolat (birinchi murojaatda standart to'plam).
  await kpiSozlamasi(businessId);

  await runBusinessTx(businessId, async (tx) => {
    await tx.kpiSetting.updateMany({
      where: { businessId },
      data: {
        mavsumOylar: data.mavsumOylar.join(","),
        mavsumPlan: data.mavsumPlan,
        mavsumsizPlan: data.mavsumsizPlan,
        planBonus: data.planBonus,
        boshlangichBall: data.boshlangichBall,
        kunlikLimit: data.kunlikLimit,
      },
    });

    await tx.kpiSalesBracket.deleteMany({ where: { businessId } });
    for (const [i, b] of data.intervallar.entries()) {
      await tx.kpiSalesBracket.create({
        data: { businessId, dan: b.dan, gacha: b.gacha, foiz: b.foiz, tartib: i },
      });
    }

    await tx.kpiScoreRule.deleteMany({ where: { businessId } });
    for (const [i, q] of data.ballQoidalari.entries()) {
      await tx.kpiScoreRule.create({
        data: { businessId, minBall: q.minBall, maxBall: q.maxBall, foiz: q.foiz, tartib: i },
      });
    }
  });

  return kpiSozlamasi(businessId);
}

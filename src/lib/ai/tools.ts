import { prisma } from "@/lib/prisma";
import { getMonthSummary, getCategoryBreakdown, getTrend } from "@/lib/queries/dashboard";
import { getOutstandingDebtTotal, listDebts } from "@/lib/queries/inventory";
import { currentMonthString } from "@/lib/date";

/**
 * AI TOOL QATLAMI (BOS-4).
 *
 * XAVFSIZLIK PRINSIPI: AI'ga xom baza BERILMAYDI. U faqat shu yerdagi
 * funksiyalarni chaqira oladi — hammasi tenant kontekstida (withTenant ichida)
 * ishlaydi, ya'ni AI ham xuddi route'lar kabi izolyatsiya ichida.
 * Modul yoqilmagan bo'lsa tegishli tool natija o'rniga xabar qaytaradi.
 */

export interface ToolKontekst {
  businessId: string;
  yoqilganModullar: Set<string>;
}

/** Anthropic API formatidagi tool ta'riflari. */
export const AI_TOOLLAR = [
  {
    name: "oylik_xulosa",
    description: "Berilgan oy uchun jami kirim, chiqim va sof foyda. Oy formati YYYY-MM, berilmasa joriy oy.",
    input_schema: {
      type: "object" as const,
      properties: { oy: { type: "string", description: "YYYY-MM" } },
    },
  },
  {
    name: "kategoriya_taqsimoti",
    description: "Oy bo'yicha kirim yoki chiqimning kategoriyalar kesimidagi taqsimoti.",
    input_schema: {
      type: "object" as const,
      properties: {
        oy: { type: "string", description: "YYYY-MM" },
        turi: { type: "string", enum: ["kirim", "chiqim"] },
      },
      required: ["turi"],
    },
  },
  {
    name: "oylik_trend",
    description: "So'nggi bir necha oy bo'yicha kirim/chiqim/sof foyda dinamikasi.",
    input_schema: {
      type: "object" as const,
      properties: { oylar_soni: { type: "number", description: "1-12, default 6" } },
    },
  },
  {
    name: "qarzdorlik",
    description: "Ochiq qarzdorlik: jami summa va eng katta qarzdorlar (OMBOR moduli).",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "crm_holati",
    description: "CRM: bosqichlar bo'yicha bitimlar soni va summasi (CRM moduli).",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "vazifalar_holati",
    description: "Vazifalar: ochiq/jarayonda/bajarilgan va muddati o'tganlar soni (VAZIFALAR moduli).",
    input_schema: { type: "object" as const, properties: {} },
  },
];

/** Tool'ni bajaradi — natija JSON string (AI'ga tool_result sifatida qaytadi). */
export async function runTool(name: string, input: Record<string, unknown>, ctx: ToolKontekst): Promise<string> {
  const oy = typeof input.oy === "string" && /^\d{4}-\d{2}$/.test(input.oy) ? input.oy : currentMonthString();

  switch (name) {
    case "oylik_xulosa": {
      const s = await getMonthSummary(ctx.businessId, oy);
      return JSON.stringify({ oy, ...s });
    }
    case "kategoriya_taqsimoti": {
      const turi = input.turi === "chiqim" ? "chiqim" : "kirim";
      const rows = await getCategoryBreakdown(ctx.businessId, oy, turi);
      return JSON.stringify({ oy, turi, kategoriyalar: rows });
    }
    case "oylik_trend": {
      const oylar = Math.min(12, Math.max(1, Number(input.oylar_soni) || 6));
      const trend = await getTrend(ctx.businessId, oylar, currentMonthString());
      return JSON.stringify(trend);
    }
    case "qarzdorlik": {
      if (!ctx.yoqilganModullar.has("OMBOR")) return JSON.stringify({ xabar: "OMBOR moduli yoqilmagan" });
      const [jami, royxat] = await Promise.all([
        getOutstandingDebtTotal(ctx.businessId),
        listDebts(ctx.businessId),
      ]);
      const ochiq = royxat.filter((d) => !d.isYopilgan).slice(0, 5);
      return JSON.stringify({
        jamiQarzdorlik: jami,
        engKattaQarzdorlar: ochiq.map((d) => ({ mijoz: d.mijozNomi, qolgan: d.jamiSumma - d.tolangan })),
      });
    }
    case "crm_holati": {
      if (!ctx.yoqilganModullar.has("CRM")) return JSON.stringify({ xabar: "CRM moduli yoqilmagan" });
      const stages = await prisma.stage.findMany({
        where: { businessId: ctx.businessId },
        orderBy: { tartib: "asc" },
        include: { deals: { where: { deletedAt: null }, select: { summa: true } } },
      });
      return JSON.stringify(
        stages.map((s) => ({
          bosqich: s.nomi,
          turi: s.turi,
          soni: s.deals.length,
          summa: s.deals.reduce((a, d) => a + d.summa, 0),
        }))
      );
    }
    case "vazifalar_holati": {
      if (!ctx.yoqilganModullar.has("VAZIFALAR")) return JSON.stringify({ xabar: "VAZIFALAR moduli yoqilmagan" });
      const tasks = await prisma.task.findMany({
        where: { businessId: ctx.businessId, deletedAt: null },
        select: { holat: true, muddat: true },
      });
      const bugun = new Date();
      return JSON.stringify({
        ochiq: tasks.filter((t) => t.holat === "OCHIQ").length,
        jarayonda: tasks.filter((t) => t.holat === "JARAYONDA").length,
        bajarilgan: tasks.filter((t) => t.holat === "BAJARILDI").length,
        muddatiOtgan: tasks.filter((t) => t.holat !== "BAJARILDI" && t.muddat && t.muddat < bugun).length,
      });
    }
    default:
      return JSON.stringify({ xato: `Noma'lum tool: ${name}` });
  }
}

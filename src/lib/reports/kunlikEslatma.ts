import { rawPrisma } from "@/lib/db/rawPrisma";
import { runWithTenant } from "@/lib/db/tenantContext";
import { prisma } from "@/lib/prisma";
import { isModuleOnForTenant } from "@/lib/modules/guard";
import { MANAGER_ROLLAR } from "@/lib/auth/roles";
import { formatSomLabel } from "@/lib/format";
import { dateOnlyStringToUTCDate, todayTashkentDateOnlyString, utcDateToDateOnlyString } from "@/lib/date";
import { BRAND } from "@/lib/brand";

/**
 * KUNLIK TASDIQLASH ESLATMASI (cron, har ertalab).
 *
 * Direktor kun yakunini tasdiqlashni unutishi mumkin — talab bo'yicha unga
 * bildirishnoma boradi va u ERTASI KUNI ham tasdiqlay oladi. Har tasdiqlanmagan
 * o'tgan kun uchun Telegramga xabar + bir bosishda tasdiqlash tugmasi
 * (callback `kht:ok:<reportId>`, bot/kunlikFlow.ts) yuboriladi.
 *
 * Qoidalar:
 *  - faqat KUNLIK moduli yoqilgan tenantlar;
 *  - faqat o'tgan (bugungi emas) OCHIQ kunlar, oxirgi 7 kun ichida;
 *  - bo'sh (0 so'mlik) kunlar uchun eslatma yuborilmaydi — shovqin bo'lmasin;
 *  - qabul qiluvchi: tayinlangan direktor (Telegram ulangan bo'lsa);
 *    direktor yo'q yoki Telegramsiz bo'lsa — boshqaruvchilar (zaxira yo'l);
 *  - kuniga bir marta (AppSetting dedupe, dailyDigest uslubi).
 */

export interface EslatmaBotApi {
  // Method sintaksisi ataylab: grammy `Api.sendMessage` (aniq `Other<...>`
  // parametri bilan) shu interfeysga mos kelishi uchun (bivariant tekshiruv).
  sendMessage(chatId: string, text: string, boshqalar?: unknown): Promise<unknown>;
}

/** Oxirgi necha kun ichidagi tasdiqlanmagan kunlar eslatiladi. */
const ESLATMA_OYNASI_KUN = 7;

export async function sendKunlikEslatma(botApi: EslatmaBotApi): Promise<number> {
  const bugun = todayTashkentDateOnlyString();
  const key = `kunlikEslatma:${bugun}`;
  const already = await rawPrisma.appSetting.findUnique({ where: { key } });
  if (already) return 0;

  const bugunSana = dateOnlyStringToUTCDate(bugun);
  const oynaBoshi = new Date(bugunSana.getTime() - ESLATMA_OYNASI_KUN * 24 * 60 * 60 * 1000);

  const tenants = await rawPrisma.tenant.findMany({ select: { id: true, name: true, status: true } });
  let sent = 0;

  for (const tenant of tenants) {
    if (tenant.status === "BLOCKED") continue;
    try {
      if (!(await isModuleOnForTenant(tenant.id, "KUNLIK"))) continue;

      sent += await runWithTenant(tenant.id, async () => {
        // OPEN ham, SUBMITTED (xodim topshirgan, direktor hali tasdiqlamagan)
        // ham eslatiladi — ikkalasi ham direktor qarorini kutmoqda.
        const reports = await prisma.dailyReport.findMany({
          where: {
            holat: { not: "CONFIRMED" },
            jamiSumma: { gt: 0 },
            sana: { lt: bugunSana, gte: oynaBoshi },
            business: { isActive: true },
          },
          include: { business: { select: { id: true, nomi: true } } },
          orderBy: { sana: "asc" },
        });
        if (reports.length === 0) return 0;

        // Har biznes uchun qabul qiluvchilar bir marta aniqlanadi.
        const qabulKesh = new Map<string, { chatId: string; ism: string }[]>();
        async function qabulQiluvchilar(businessId: string) {
          const bor = qabulKesh.get(businessId);
          if (bor) return bor;
          const royxat: { chatId: string; ism: string }[] = [];
          const sozlama = await prisma.dailyReportSetting.findFirst({
            where: { businessId },
            select: { direktorId: true },
          });
          if (sozlama?.direktorId) {
            const direktor = await prisma.user.findFirst({
              where: { id: sozlama.direktorId, isActive: true, telegramChatId: { not: null } },
              select: { telegramChatId: true, ism: true },
            });
            if (direktor?.telegramChatId) {
              royxat.push({ chatId: direktor.telegramChatId, ism: direktor.ism });
            }
          }
          if (royxat.length === 0) {
            // Zaxira yo'l: direktor yo'q/Telegramsiz — boshqaruvchilar xabardor bo'lsin.
            const managers = await prisma.user.findMany({
              where: { rol: { in: MANAGER_ROLLAR }, isActive: true, telegramChatId: { not: null } },
              select: { telegramChatId: true, ism: true },
            });
            for (const m of managers) {
              if (m.telegramChatId) royxat.push({ chatId: m.telegramChatId, ism: m.ism });
            }
          }
          qabulKesh.set(businessId, royxat);
          return royxat;
        }

        let yuborildi = 0;
        for (const r of reports) {
          const kimlarga = await qabulQiluvchilar(r.businessId);
          if (kimlarga.length === 0) continue;

          const sanaStr = utcDateToDateOnlyString(r.sana);
          const sanaUz = sanaStr.split("-").reverse().join(".");
          const topshiruv =
            r.holat === "SUBMITTED" && r.sanalganNaqd !== null
              ? `📤 Topshirdi: ${r.submittedByIsm ?? "—"}\n` +
                `💵 Naqd (sanaldi): ${formatSomLabel(r.sanalganNaqd)}\n` +
                (r.sanalganNaqd - r.naqdSumma === 0
                  ? "✅ Farq yo'q\n"
                  : r.sanalganNaqd - r.naqdSumma < 0
                    ? `⚠️ KAM: ${formatSomLabel(r.naqdSumma - r.sanalganNaqd)} yetishmayapti!\n`
                    : `⚠️ Ortiqcha: ${formatSomLabel(r.sanalganNaqd - r.naqdSumma)}\n`)
              : "";
          const text =
            `🟡 ${BRAND.nomi} · Kunlik yakun tasdiqlanmagan\n\n` +
            `${r.business.nomi} — ${sanaUz}\n` +
            `💵 Naqd: ${formatSomLabel(r.naqdSumma)}\n` +
            `💳 Click: ${formatSomLabel(r.clickSumma)}\n` +
            `📋 Qarz: ${formatSomLabel(r.qarzSumma)}\n` +
            `💰 Jami: ${formatSomLabel(r.jamiSumma)}\n` +
            topshiruv +
            `\nTasdiqlash uchun tugmani bosing yoki saytda "Kunlik hisobot" bo'limini oching.`;
          const tugma = {
            reply_markup: {
              inline_keyboard: [[{ text: "✅ Kun yakunini tasdiqlash", callback_data: `kht:ok:${r.id}` }]],
            },
          };

          for (const kishi of kimlarga) {
            try {
              await botApi.sendMessage(kishi.chatId, text, tugma);
              yuborildi++;
            } catch (error) {
              console.error(`Kunlik eslatma (${kishi.ism}) xatosi:`, error);
            }
          }
        }
        return yuborildi;
      });
    } catch (error) {
      console.error(`Kunlik eslatma xatosi (tenant: ${tenant.name}):`, error);
    }
  }

  await rawPrisma.appSetting.upsert({ where: { key }, update: { value: "sent" }, create: { key, value: "sent" } });
  return sent;
}

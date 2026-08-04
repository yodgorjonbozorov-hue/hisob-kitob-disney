import type { Bot } from "grammy";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { MANAGER_ROLLAR } from "@/lib/auth/roles";
import { computeAccess } from "./access";
import { planByCode } from "./plans";
import { BRAND } from "@/lib/brand";
import { formatMoney } from "@/lib/format";

/**
 * OBUNA ESLATMALARI.
 *
 * Avval faqat "3 kun qoldi" xabari bir marta yuborilardi — mijoz muddat
 * tugagach eslatmasiz qolardi va to'lov uchun O'ZI qo'ng'iroq qilishi kerak
 * edi. Endi to'rtta nuqtada eslatiladi va xabarda to'g'ridan-to'g'ri to'lov
 * havolasi bo'ladi (Payme/Click ulangan bo'lsa mijoz o'zi to'laydi).
 *
 * Har nuqta har muddat uchun FAQAT BIR MARTA yuboriladi (AppSetting kaliti).
 */

export type EslatmaNuqta = "3kun" | "1kun" | "tugadi" | "kechikdi";

/**
 * Qolgan kunlardan eslatma nuqtasini aniqlaydi. Oraliqlar ataylab keng —
 * cron bir kun ishlamay qolsa ham nuqta o'tkazib yuborilmaydi.
 * Sof funksiya — test qilinadi.
 */
export function eslatmaNuqtasi(kunQoldi: number | null): EslatmaNuqta | null {
  if (kunQoldi === null) return null;
  if (kunQoldi >= 2 && kunQoldi <= 3) return "3kun";
  if (kunQoldi === 1) return "1kun";
  if (kunQoldi <= 0 && kunQoldi >= -1) return "tugadi";
  if (kunQoldi <= -2 && kunQoldi >= -7) return "kechikdi";
  return null;
}

interface XabarKonteksti {
  tenantNomi: string;
  trial: boolean;
  kunQoldi: number;
  narx: number | null;
  havola: string;
}

/** Nuqtaga mos xabar matni. */
export function eslatmaMatni(nuqta: EslatmaNuqta, ctx: XabarKonteksti): string {
  const nima = ctx.trial ? "Bepul sinov muddati" : "Obuna muddati";
  const narxQatori = ctx.narx ? `Tarif: ${formatMoney(ctx.narx)} / oy.` : null;
  const tolov = `To'lash: ${ctx.havola}`;

  const sarlavha: Record<EslatmaNuqta, string> = {
    "3kun": `⏳ ${ctx.tenantNomi}: ${nima} ${ctx.kunQoldi} kundan keyin tugaydi.`,
    "1kun": `⚠️ ${ctx.tenantNomi}: ${nima} ERTAGA tugaydi.`,
    tugadi: ctx.trial
      ? `🔒 ${ctx.tenantNomi}: bepul sinov muddati tugadi.`
      : `🔒 ${ctx.tenantNomi}: obuna muddati tugadi.`,
    kechikdi: `💤 ${ctx.tenantNomi}: ${nima.toLowerCase()} tugaganiga ${Math.abs(ctx.kunQoldi)} kun bo'ldi.`,
  };

  const izoh: Record<EslatmaNuqta, string> = {
    "3kun": "Uzilishsiz davom etish uchun oldindan to'lang.",
    "1kun": "Bugun to'lasangiz ish uzilmaydi.",
    tugadi: ctx.trial
      ? "Ma'lumotlaringiz saqlanib turibdi — obuna bo'lsangiz darhol davom etasiz."
      : "Ma'lumotlaringiz saqlanadi; hozircha faqat o'qish va eksport ochiq.",
    kechikdi: "Ma'lumotlaringiz hali ham saqlanmoqda. To'lovdan keyin hammasi joyida davom etadi.",
  };

  return [sarlavha[nuqta], izoh[nuqta], narxQatori, "", tolov].filter(Boolean).join("\n");
}

export interface EslatmaNatija {
  /** Yuborilgan xabarlar soni. */
  yuborilgan: number;
  /** Eslatma kerak, lekin Telegram ulanmagan tenantlar (ularga qo'ng'iroq qilish kerak). */
  telegramsiz: string[];
}

/**
 * Muddati yaqinlashgan/tugagan tenantlarning direktorlariga Telegram eslatma
 * yuboradi. Cron'dan kuniga bir marta chaqiriladi.
 */
export async function sendExpiryWarnings(bot: Bot, now: Date = new Date()): Promise<EslatmaNatija> {
  const tenants = await rawPrisma.tenant.findMany();
  const natija: EslatmaNatija = { yuborilgan: 0, telegramsiz: [] };
  const base = process.env.NEXT_PUBLIC_APP_URL ?? BRAND.url;

  for (const tenant of tenants) {
    try {
      if (tenant.status === "BLOCKED") continue;

      const access = computeAccess(tenant, now);
      const nuqta = eslatmaNuqtasi(access.kunQoldi);
      if (!nuqta) continue;

      const deadline = tenant.status === "TRIAL" ? tenant.trialEndsAt : tenant.currentPeriodEnd;
      if (!deadline) continue;

      // Shu muddatning shu nuqtasi uchun allaqachon yuborilganmi?
      const key = `billingWarn:${tenant.id}:${deadline.toISOString().slice(0, 10)}:${nuqta}`;
      const already = await rawPrisma.appSetting.findUnique({ where: { key } });
      if (already) continue;

      const managers = await rawPrisma.user.findMany({
        where: {
          tenantId: tenant.id,
          rol: { in: MANAGER_ROLLAR },
          isActive: true,
          telegramChatId: { not: null },
        },
        select: { telegramChatId: true, ism: true },
      });

      if (managers.length === 0) {
        // Xabar yetkazib bo'lmaydi — superadmin ro'yxatiga tushadi (qo'ng'iroq qilinadi).
        natija.telegramsiz.push(tenant.name);
        continue;
      }

      const text = eslatmaMatni(nuqta, {
        tenantNomi: tenant.name,
        trial: tenant.status === "TRIAL",
        kunQoldi: access.kunQoldi ?? 0,
        narx: planByCode(tenant.plan)?.oylikNarx ?? null,
        havola: `${base}/billing`,
      });

      let yetkazildi = false;
      for (const m of managers) {
        if (!m.telegramChatId) continue;
        try {
          await bot.api.sendMessage(m.telegramChatId, text);
          natija.yuborilgan++;
          yetkazildi = true;
        } catch (error) {
          console.error(`Eslatmani ${m.ism}ga yuborishda xatolik:`, error);
        }
      }

      // Faqat haqiqatan yetkazilgan bo'lsa belgilaymiz — aks holda ertaga qayta uriniladi.
      if (yetkazildi) {
        await rawPrisma.appSetting.upsert({
          where: { key },
          update: { value: "sent" },
          create: { key, value: "sent" },
        });
      }
    } catch (error) {
      console.error(`Eslatma xatosi (tenant: ${tenant.name}):`, error);
    }
  }

  return natija;
}

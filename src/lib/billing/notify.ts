import type { Bot } from "grammy";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { MANAGER_ROLLAR } from "@/lib/auth/roles";
import { computeAccess } from "./access";
import { planByCode } from "./plans";
import { KUN_MS } from "./constants";

/** Tarif narxi haqidagi qator — narx yagona manbadan (plans.ts) olinadi. */
function narxSatri(plan: string): string {
  const p = planByCode(plan);
  if (!p) return "To'lov: ilovadagi \"Obuna\" bo'limi orqali.";
  return `${p.nomi} tarifi: ${p.oylikNarx.toLocaleString("ru-RU")} so'm / oy.\nTo'lov: ilovadagi "Obuna" bo'limi orqali.`;
}

/**
 * Tenant direktorlariga Telegram orqali obuna eslatmalari:
 *  1) muddat tugashiga oz qolganda (TRIAL_OGOHLANTIRISH_KUNLARI — access.ogohlantirish);
 *  2) muddat tugagan kunning o'zida bir marta.
 *
 * Har xabar har muddat uchun bir martadan yuboriladi (AppSetting'da belgilanadi).
 * Cron'dan chaqiriladi. Bloklash xatti-harakati bu yerda o'zgarmaydi — kirishni
 * computeAccess/guard'lar hal qiladi.
 */
export async function sendExpiryWarnings(bot: Bot): Promise<number> {
  const tenants = await rawPrisma.tenant.findMany();
  const now = Date.now();
  let sent = 0;

  for (const tenant of tenants) {
    try {
      const access = computeAccess(tenant);
      const deadline = tenant.status === "TRIAL" ? tenant.trialEndsAt : tenant.currentPeriodEnd;
      if (!deadline) continue;

      const otganMs = now - deadline.getTime();
      let text: string | null = null;
      let kalitPrefiks: string | null = null;

      if (access.ogohlantirish) {
        text = `⚠️ ${tenant.name}: ${access.ogohlantirish}\n\n${narxSatri(tenant.plan)}`;
        kalitPrefiks = "billingWarn";
      } else if (tenant.status !== "BLOCKED" && otganMs >= 0 && otganMs <= KUN_MS) {
        // Muddat bugun tugadi — bir marta xabar (ancha oldin tugaganlarga qayta yuborilmaydi).
        const sabab =
          tenant.status === "TRIAL"
            ? "Bepul sinov muddati bugun tugadi."
            : "Obuna muddati bugun tugadi.";
        text = `⛔️ ${tenant.name}: ${sabab}\n\n${narxSatri(tenant.plan)}`;
        kalitPrefiks = "billingEnd";
      }

      if (!text || !kalitPrefiks) continue;

      // Shu muddat uchun allaqachon yuborilganmi?
      const key = `${kalitPrefiks}:${tenant.id}:${deadline.toISOString().slice(0, 10)}`;
      const already = await rawPrisma.appSetting.findUnique({ where: { key } });
      if (already) continue;

      const managers = await rawPrisma.user.findMany({
        where: { tenantId: tenant.id, rol: { in: MANAGER_ROLLAR }, isActive: true, telegramChatId: { not: null } },
        select: { telegramChatId: true, ism: true },
      });
      if (managers.length === 0) continue;

      for (const m of managers) {
        if (!m.telegramChatId) continue;
        try {
          await bot.api.sendMessage(m.telegramChatId, text);
          sent++;
        } catch (error) {
          console.error(`Ogohlantirishni ${m.ism}ga yuborishda xatolik:`, error);
        }
      }

      await rawPrisma.appSetting.upsert({ where: { key }, update: { value: "sent" }, create: { key, value: "sent" } });
    } catch (error) {
      console.error(`Ogohlantirish xatosi (tenant: ${tenant.name}):`, error);
    }
  }

  return sent;
}

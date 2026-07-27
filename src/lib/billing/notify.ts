import type { Bot } from "grammy";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { MANAGER_ROLLAR } from "@/lib/auth/roles";
import { computeAccess } from "./access";

/**
 * Muddati tugashiga 3 kun (yoki undan kam) qolgan tenantlarning direktorlariga
 * Telegram orqali ogohlantirish yuboradi. Har muddat uchun bir marta
 * (AppSetting'da belgilanadi). Cron'dan chaqiriladi.
 */
export async function sendExpiryWarnings(bot: Bot): Promise<number> {
  const tenants = await rawPrisma.tenant.findMany();
  let sent = 0;

  for (const tenant of tenants) {
    try {
      const access = computeAccess(tenant);
      if (!access.ogohlantirish) continue;

      const deadline = tenant.status === "TRIAL" ? tenant.trialEndsAt : tenant.currentPeriodEnd;
      if (!deadline) continue;

      // Shu muddat uchun allaqachon yuborilganmi?
      const key = `billingWarn:${tenant.id}:${deadline.toISOString().slice(0, 10)}`;
      const already = await rawPrisma.appSetting.findUnique({ where: { key } });
      if (already) continue;

      const managers = await rawPrisma.user.findMany({
        where: { tenantId: tenant.id, rol: { in: MANAGER_ROLLAR }, isActive: true, telegramChatId: { not: null } },
        select: { telegramChatId: true, ism: true },
      });
      if (managers.length === 0) continue;

      const text = `⚠️ ${tenant.name}: ${access.ogohlantirish}\n\nTo'lov: ilovadagi "Obuna" bo'limi orqali.`;
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

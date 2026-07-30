import { prisma } from "@/lib/prisma";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { runWithTenant } from "@/lib/db/tenantContext";
import { MANAGER_ROLLAR } from "@/lib/auth/roles";
import { formatSomLabel } from "@/lib/format";
import { BRAND } from "@/lib/brand";

/**
 * KUNLIK XULOSA (BOS-5): har ertalab (kunlik cron) kechagi kirim/chiqim/sof
 * foyda har tenant direktorlariga Telegram orqali boradi. Bo'sh kun — yuborilmaydi.
 * Kuniga bir marta (AppSetting dedupe), tenantlar aro xatolar izolyatsiyalangan.
 */
export async function sendDailyDigest(botApi: {
  sendMessage: (chatId: string, text: string) => Promise<unknown>;
}): Promise<number> {
  const bugun = new Date().toISOString().slice(0, 10);
  const key = `dailyDigest:${bugun}`;
  const already = await rawPrisma.appSetting.findUnique({ where: { key } });
  if (already) return 0;

  // Kecha (UTC kun chegaralari — tranzaksiya sanalari UTC saqlanadi).
  const kechaBosh = new Date(new Date(bugun + "T00:00:00Z").getTime() - 24 * 60 * 60 * 1000);
  const kechaOxir = new Date(bugun + "T00:00:00Z");
  const kechaMatn = kechaBosh.toISOString().slice(0, 10).split("-").reverse().join(".");

  const tenants = await rawPrisma.tenant.findMany({ select: { id: true, name: true, status: true } });
  let sent = 0;

  for (const tenant of tenants) {
    if (tenant.status === "BLOCKED") continue;
    try {
      sent += await runWithTenant(tenant.id, async () => {
        const managers = await prisma.user.findMany({
          where: { rol: { in: MANAGER_ROLLAR }, isActive: true, telegramChatId: { not: null } },
          select: { telegramChatId: true, ism: true },
        });
        if (managers.length === 0) return 0;

        const businesses = await prisma.business.findMany({ where: { isActive: true }, orderBy: { nomi: "asc" } });
        const qatorlar: string[] = [];
        for (const b of businesses) {
          const agg = await prisma.transaction.groupBy({
            by: ["turi"],
            where: { businessId: b.id, deletedAt: null, sana: { gte: kechaBosh, lt: kechaOxir } },
            _sum: { summa: true },
          });
          const kirim = agg.find((a) => a.turi === "kirim")?._sum.summa ?? 0;
          const chiqim = agg.find((a) => a.turi === "chiqim")?._sum.summa ?? 0;
          if (kirim === 0 && chiqim === 0) continue;
          qatorlar.push(
            `${b.nomi}: +${formatSomLabel(kirim)} / -${formatSomLabel(chiqim)} · sof ${formatSomLabel(kirim - chiqim)}`
          );
        }
        if (qatorlar.length === 0) return 0;

        const text =
          `🌅 ${BRAND.nomi} · Kunlik xulosa — ${kechaMatn}\n\n${qatorlar.join("\n")}`;
        let yuborildi = 0;
        for (const m of managers) {
          if (!m.telegramChatId) continue;
          try {
            await botApi.sendMessage(m.telegramChatId, text);
            yuborildi++;
          } catch (error) {
            console.error(`Kunlik xulosa (${m.ism}) xatosi:`, error);
          }
        }
        return yuborildi;
      });
    } catch (error) {
      console.error(`Kunlik xulosa xatosi (tenant: ${tenant.name}):`, error);
    }
  }

  await rawPrisma.appSetting.upsert({ where: { key }, update: { value: "sent" }, create: { key, value: "sent" } });
  return sent;
}

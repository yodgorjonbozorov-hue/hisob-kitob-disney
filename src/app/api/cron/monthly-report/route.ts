import { cronGuard } from "@/lib/cron/guard";
import { zaxiraIshi, billingIshi, hisobotIshi, vazifaIshi } from "@/lib/cron/ishlar";

/**
 * ESKI YAGONA CRON — MOSLIK UCHUN SAQLANGAN.
 *
 * Barcha ishlar endi to'rt alohida route'ga bo'lingan (`/api/cron/backup`,
 * `/billing`, `/reports`, `/tasks`) va `vercel.json` o'shalarni chaqiradi.
 *
 * Bu route o'chirilmadi: kimdir tashqi rejalashtiruvchidan (yoki qo'lda)
 * shu manzilni chaqirayotgan bo'lishi mumkin. U avvalgidek to'rtala ishni
 * ketma-ket bajaradi — ya'ni 60 soniya limiti xavfi ham avvalgidek qoladi.
 * Shuning uchun yangi manzillarga o'tish tavsiya etiladi.
 */
export const maxDuration = 60;

export async function GET(req: Request) {
  const rad = cronGuard(req);
  if (rad) return rad;

  console.warn(
    "/api/cron/monthly-report eskirgan — vercel.json dagi 4 ta alohida cron'ga o'ting."
  );

  const faqatZaxira = new URL(req.url).searchParams.get("only") === "backup";
  const zaxira = await zaxiraIshi({ faqatZaxira });
  if (faqatZaxira) {
    return new Response(`OK (faqat zaxira: ${zaxira.zaxira})`, { status: 200 });
  }

  const billing = await billingIshi();
  const hisobot = await hisobotIshi();
  const vazifa = await vazifaIshi();

  return new Response(
    `OK (zaxira: ${zaxira.zaxira}, expired: ${billing.expired}, ` +
      `recurring: ${vazifa.recurring}, eslatma: ${billing.eslatma}, ` +
      `telegramsiz: ${billing.telegramsiz}, tasks: ${vazifa.eslatma}, ` +
      `digest: ${hisobot.digest}, suhbat: ${zaxira.suhbat}, rl: ${zaxira.rateLimit})`,
    { status: 200 }
  );
}

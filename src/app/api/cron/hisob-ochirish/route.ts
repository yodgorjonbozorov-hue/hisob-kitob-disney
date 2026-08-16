import { cronGuard } from "@/lib/cron/guard";
import { ochirishgaTayyor, tenantniButunlayOchir } from "@/lib/db/hisobOchirish";

/**
 * HISOBNI O'CHIRISH — kuniga 07:00 da: 30 kunlik muddati tugagan
 * kompaniyalarni butunlay o'chiradi (App Store 5.1.1(v)).
 *
 * Zaxiradan (03:00) KEYIN turadi — o'chirilgan kompaniya o'sha kunning
 * zaxirasida hali mavjud bo'ladi. Bu ataylab: xato so'rov bo'lsa oxirgi
 * zaxiradan tiklash imkoniyati qoladi.
 *
 * Har tenant ALOHIDA tranzaksiyada o'chiriladi: bittasida xato bo'lsa
 * qolganlari o'chirilaveradi, yarim o'chirilgan kompaniya esa qolmaydi.
 */
export const maxDuration = 60;

export async function GET(req: Request) {
  const rad = cronGuard(req);
  if (rad) return rad;

  const tayyor = await ochirishgaTayyor();
  let ochirilgan = 0;
  const xatolar: string[] = [];

  for (const tenantId of tayyor) {
    try {
      await tenantniButunlayOchir(tenantId);
      ochirilgan++;
    } catch (e) {
      xatolar.push(`${tenantId}: ${e instanceof Error ? e.message : "nomalum xato"}`);
    }
  }

  const xabar = `OK (tayyor: ${tayyor.length}, o'chirildi: ${ochirilgan}${
    xatolar.length > 0 ? `, xato: ${xatolar.join(" | ")}` : ""
  })`;
  // Xato bo'lsa 500 — Vercel cron jurnalida qizil ko'rinadi va e'tiborga tushadi.
  return new Response(xabar, { status: xatolar.length > 0 ? 500 : 200 });
}

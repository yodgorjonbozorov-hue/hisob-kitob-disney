import { NextResponse } from "next/server";
import { qollanganMigratsiyaSoni } from "@/lib/db/migratsiyaSoni";

export const dynamic = "force-dynamic";

/**
 * OMMAVIY SOG'LIQ ENDPOINTI — "qaysi build jonli va baza u bilan mosmi?"
 *
 * Nega kerak: production deploy tugaganini va migratsiyalar qo'llanganini
 * tashqaridan tekshirishning yo'li yo'q edi. `/app/*` yo'llari middleware
 * orqali login'ga yo'naltiriladi — mavjud bo'lmagan sahifa ham login
 * qaytaradi, ya'ni "yangi build chiqdimi?" degan savolga javob bermaydi.
 * Migratsiya qo'llanmagan bo'lsa esa ilova jimgina buziladi (Prisma yo'q
 * ustunni so'raydi), shuning uchun bu savol deploy'dan keyin darhol kerak.
 *
 * MA'LUMOT OSHKOR QILINMAYDI. Qaytadigan narsa:
 *   · commit SHA va muhit nomi (repozitoriya ommaviy, SHA allaqachon ochiq);
 *   · qo'llangan/kutayotgan MIGRATSIYA SONI — nomlar ham repozitoriyada bor.
 * Tenant, mijoz, foydalanuvchi va pul ma'lumotlari BU YERGA CHIQMAYDI.
 *
 * Baza so'rovi ataylab bittayu bitta va yengil (`COUNT(*)`); xato bo'lsa
 * javob 200 qoladi va `baza: "aniqlanmadi"` bo'ladi — bu endpoint monitoring
 * uchun, ilovaning ishlashiga ta'sir qilmaydi.
 */

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  // Migratsiya soni `lib/db/` dagi yordamchidan keladi — xom so'rov faqat
  // o'sha yerda bo'ladi (CLAUDE.md: rawPrisma qoidasi).
  const qollangan = await qollanganMigratsiyaSoni();

  return NextResponse.json(
    {
      ok: true,
      // Qisqa SHA — jonli build qaysi commit'dan qurilgani.
      commit: sha ? sha.slice(0, 7) : null,
      // "production" | "preview" | "development" (Vercel beradi).
      muhit: process.env.VERCEL_ENV ?? "local",
      // Baza kod bilan mosmi: qo'llangan migratsiyalar SONI.
      baza: qollangan === null ? "aniqlanmadi" : "ulandi",
      migratsiya: qollangan,
      vaqt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

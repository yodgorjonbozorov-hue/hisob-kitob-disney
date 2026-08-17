import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * OMMAVIY SOG'LIQ ENDPOINTI — "qaysi build jonli?" degan savolga javob.
 *
 * Nega kerak: production deploy tugaganini tashqaridan tekshirishning yo'li
 * yo'q edi. `/app/*` yo'llari middleware orqali login'ga yo'naltiriladi —
 * mavjud bo'lmagan sahifa ham login qaytaradi, ya'ni "yangi build chiqdimi?"
 * degan savolga javob bermaydi. Deploy'ni tasdiqlash uchun esa aniq javob
 * kerak, aks holda migratsiya qo'llanganini ham bilib bo'lmaydi.
 *
 * Bu endpoint ATAYLAB:
 *   · bazaga umuman TEGMAYDI (hech qanday so'rov yo'q);
 *   · sessiya/tenant talab qilmaydi (deploy'dan keyin darhol o'qiladi);
 *   · faqat commit SHA va muhit nomini beradi — hech qanday sir, mijoz
 *     ma'lumoti yoki moliyaviy raqam qaytarmaydi. Commit SHA repozitoriyada
 *     allaqachon ochiq.
 */
export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  return NextResponse.json(
    {
      ok: true,
      // Qisqa SHA — jonli build qaysi commit'dan qurilgani.
      commit: sha ? sha.slice(0, 7) : null,
      // "production" | "preview" | "development" (Vercel beradi).
      muhit: process.env.VERCEL_ENV ?? "local",
      vaqt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager, BadRequestError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { faylYukla, saqlagichBor, SaqlagichSozlanmaganError } from "@/lib/storage/driver";

/** Mahsulot rasmi uchun ruxsat etilgan turlar (ijro etiladigan fayllar yo'q). */
const RASM_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

/** Kartochkadagi rasm uchun 5 MB dan katta fayl ma'nosiz (telefon trafigi). */
const MAX_RASM_BAYT = 5 * 1024 * 1024;

/**
 * MAHSULOT RASMINI YUKLASH.
 *
 * Mavjud saqlagich QAYTA ISHLATILADI (`lib/storage/driver.ts` — hujjatlar
 * moduli ham shundan foydalanadi): sozlangan bo'lsa Vercel Blob'ga yuklanadi
 * va ochiq o'qish manzili qaytadi.
 *
 * SAQLAGICH YO'Q BO'LSA — jimgina "ishladi" deb ko'rsatilmaydi va rasm
 * `data:` URL sifatida bazaga TIQILMAYDI. Ikkalasi ham yomon: birinchisida
 * rasm yo'qoladi, ikkinchisida har kartochka bilan yuzlab kilobayt baza
 * satri brauzerga ketadi. O'rniga aniq xato qaytadi va UI tashqi havola
 * kiritish yo'lini taklif qiladi.
 *
 * GET — UI shu javob bo'yicha "fayl yuklash" yoki "havola" rejimini tanlaydi.
 */
export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    requireManager(user.rol);
    return NextResponse.json({ yuklashMumkin: saqlagichBor(), maxBayt: MAX_RASM_BAYT });
  },
  { module: "OMBOR" }
);

export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      throw new BadRequestError("Rasm fayl sifatida yuborilishi kerak");
    }

    const form = await request.formData();
    const fayl = form.get("rasm");
    if (!(fayl instanceof File)) throw new BadRequestError("Rasm tanlanmagan");
    if (!(RASM_MIME as readonly string[]).includes(fayl.type)) {
      throw new BadRequestError("Faqat JPG, PNG yoki WEBP rasm yuborish mumkin");
    }
    if (fayl.size > MAX_RASM_BAYT) {
      throw new BadRequestError("Rasm 5 MB dan katta bo'lmasligi kerak");
    }

    try {
      const natija = await faylYukla({
        // Biznes prefiksi — bir xil nomli fayllar aralashib ketmasin
        // (saqlagich o'zi ham tasodifiy qo'shimcha qo'shadi).
        nomi: `mahsulot-${businessId}-${fayl.name}`,
        mimeType: fayl.type,
        mazmun: Buffer.from(await fayl.arrayBuffer()),
      });
      return NextResponse.json(natija, { status: 201 });
    } catch (e) {
      if (e instanceof SaqlagichSozlanmaganError) {
        return NextResponse.json(
          {
            error:
              "Rasm saqlagich hali sozlanmagan — rasm havolasini (https://...) kiritishingiz mumkin",
          },
          { status: 501 }
        );
      }
      throw e;
    }
  },
  { module: "OMBOR" }
);

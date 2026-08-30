import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager, BadRequestError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { faylYukla, saqlagichBor, SaqlagichSozlanmaganError } from "@/lib/storage/driver";

/** Xodim profil rasmi uchun ruxsat etilgan turlar (ijro etiladigan fayllar yo'q). */
const RASM_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

/** Avatar uchun 5 MB dan katta fayl ma'nosiz (telefon trafigi). */
const MAX_RASM_BAYT = 5 * 1024 * 1024;

/**
 * XODIM PROFIL RASMINI YUKLASH — mahsulot rasmi oqimi bilan AYNAN bir xil
 * (`api/ombor/rasm`): mavjud saqlagich (`lib/storage/driver.ts`) qayta
 * ishlatiladi. Saqlagich sozlanmagan bo'lsa 501 qaytadi va UI havola
 * kiritish yo'lini taklif qiladi — rasm `data:` URL sifatida bazaga
 * TIQILMAYDI (har kartochka bilan yuzlab kilobayt brauzerga ketardi).
 *
 * GET — UI shu javob bo'yicha "fayl yuklash" yoki "havola" rejimini tanlaydi.
 */
export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    requireManager(user.rol);
    return NextResponse.json({ yuklashMumkin: saqlagichBor(), maxBayt: MAX_RASM_BAYT });
  },
  { module: "HR" }
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
        nomi: `xodim-${businessId}-${fayl.name}`,
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
  { module: "HR" }
);

import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import {
  mahsulotlarniOqi,
  mahsulotlarniYoz,
  MAKS_MAHSULOT,
} from "@/lib/services/mahsulotImport";
import { dashboardYangilandi } from "@/lib/cache";
import { xlsxdanCsv, XlsxXato } from "@/lib/excel/xlsxOqi";

/** Yuklanadigan faylning chegarasi — 500 qatorli katalog bundan ancha kichik. */
const MAKS_FAYL = 10 * 1024 * 1024;

const schema = z.object({
  csv: z.string().min(1, "Fayl bo'sh").max(2_000_000, "Fayl juda katta"),
  /** true bo'lsa faqat tekshiradi va oldindan ko'rish qaytaradi (yozmaydi). */
  tekshirish: z.boolean().optional(),
  /**
   * "qoshish" — faqat yangi tovar qo'shiladi, mavjudlariga tegilmaydi;
   * "yangilash" — mavjud tovarning fayldagi maydonlari yangilanadi.
   */
  rejim: z.enum(["qoshish", "yangilash"]).default("qoshish"),
});

/**
 * KATALOG IMPORTI — faqat direktor/admin.
 *
 * Ikki bosqichli: avval `tekshirish: true` bilan yuboriladi va foydalanuvchi
 * nima yoziladiganini ko'radi, keyin tasdiqlaydi. Katalog importi qaytarib
 * bo'lmaydigan amal — ko'r-ko'rona bajarilmasin.
 */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
  await requireOmborli(businessId);

  // Ikki kirish yo'li: tayyor CSV matn (JSON) yoki yuklangan fayl (CSV/XLSX).
  // Excel fayl serverda CSV ga aylantiriladi — tahlil qiluvchi kod bitta.
  let kirish: { csv: string; tekshirish?: boolean; rejim?: string };
  if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await request.formData();
    const fayl = form.get("fayl");
    if (!(fayl instanceof File)) {
      return NextResponse.json({ error: "Fayl yuklanmadi" }, { status: 400 });
    }
    if (fayl.size > MAKS_FAYL) {
      return NextResponse.json({ error: "Fayl juda katta (10 MB dan oshmasin)" }, { status: 400 });
    }
    const xlsx = /\.xlsx$/i.test(fayl.name);
    // Buzilgan yoki haddan katta Excel 500 emas, tushunarli 400 bilan qaytadi.
    let csv: string;
    try {
      csv = xlsx ? await xlsxdanCsv(await fayl.arrayBuffer()) : await fayl.text();
    } catch (e) {
      const xabar =
        e instanceof XlsxXato ? e.message : "Faylni o'qib bo'lmadi — buzilgan bo'lishi mumkin";
      return NextResponse.json({ error: xabar }, { status: 400 });
    }
    kirish = {
      csv,
      tekshirish: form.get("tekshirish") === "true",
      rejim: (form.get("rejim") as string) || undefined,
    };
  } else {
    kirish = await request.json();
  }

  const parsed = schema.safeParse(kirish);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
      { status: 400 }
    );
  }

  const { ustunlar, qatorlar, xatolar } = mahsulotlarniOqi(parsed.data.csv);

  if (parsed.data.tekshirish) {
    return NextResponse.json({
      jami: qatorlar.length,
      ustunlar,
      xatolar,
      namuna: qatorlar.slice(0, 10),
      maxQator: MAKS_MAHSULOT,
      // Kassada sotish uchun narx ham, qoldiq ham kerak. Fayl ularsiz kelsa
      // foydalanuvchi buni IMPORTDAN OLDIN bilsin.
      narxsiz: qatorlar.filter((q) => !q.sotuvNarx).length,
      qoldiqsiz: qatorlar.filter((q) => !q.miqdor).length,
      rasmli: qatorlar.filter((q) => q.rasmUrl).length,
    });
  }

  if (qatorlar.length === 0) {
    return NextResponse.json(
      { error: "Import qilinadigan to'g'ri qator topilmadi", xatolar },
      { status: 400 }
    );
  }

  const natija = await mahsulotlarniYoz({
    businessId,
    userId: user.userId,
    qatorlar,
    ustunlar,
    rejim: parsed.data.rejim,
  });

  dashboardYangilandi(businessId);
  return NextResponse.json(
    { ...natija, xatolar: [...xatolar, ...natija.xatolar] },
    { status: 201 }
  );
}, { module: "OMBOR" });

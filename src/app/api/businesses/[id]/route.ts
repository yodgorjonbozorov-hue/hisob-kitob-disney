import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, BadRequestError } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { updateBusinessSchema } from "@/lib/validation/business";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";
import { dashboardYangilandi } from "@/lib/cache";
import { logAudit } from "@/lib/services/audit";
import { biznesOchir } from "@/lib/services/biznesOchirish";

export const PATCH = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  requireManager(user.rol);

  const body = await request.json();
  const parsed = updateBusinessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // Joriy holat — bayroqlar bir-biriga zid bo'lib qolmasligi SERVERDA
  // tekshiriladi. Ilgari bu qoida faqat UI'da edi: qo'lda yuborilgan
  // `{ magazin: true }` omborsiz bizneste kassani yoqib qo'yardi va menyu
  // jimgina bo'sh chiqardi.
  // `shaxsiyKassa` ham shu yerdan olinadi — auditdagi "oldin" qiymati uchun
  // alohida so'rov kerak emas.
  const joriy = await prisma.business.findUnique({
    where: { id: params.id },
    select: { omborli: true, magazin: true, shaxsiyKassa: true },
  });
  if (!joriy) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const data: Record<string, unknown> = { ...parsed.data };

  // Avto rejimi ombor tizimisiz ishlamaydi — birga yoqiladi (so'rovdagi qiymatdan ustun).
  // Umumiy rejimga qaytganda `omborli` o'z-o'zidan o'chmaydi: tovar savdosi
  // rejimdan mustaqil, uni faqat direktor qo'lda o'chiradi.
  if (parsed.data.turi === "avto") data.omborli = true;

  const omborKeyin = (data.omborli as boolean | undefined) ?? joriy.omborli;
  // Ombor o'chirilsa kassa ham ma'nosini yo'qotadi (mahsulot va qoldiq
  // ombordan keladi) — birga o'chadi. Ma'lumot O'CHMAYDI, faqat bo'lim yopiladi.
  if (!omborKeyin) data.magazin = false;
  if (data.magazin === true && !omborKeyin) {
    throw new BadRequestError("Kassa ombor ustida ishlaydi — avval shu bizneste omborni yoqing");
  }

  const business = await prisma.business.update({ where: { id: params.id }, data });

  // KASSA SOZLAMASI auditga tushadi: shaxsiy kassa rejimi naqd pul QAYSI
  // kassaga tushishini o'zgartiradi, ya'ni bu moliyaviy oqim sozlamasi.
  // Boshqa biznes maydonlari bu yerda ataylab yozilmaydi — ular kassa
  // nazoratiga daxlsiz.
  if (parsed.data.shaxsiyKassa !== undefined) {
    await logAudit({
      businessId: business.id,
      action: "update",
      entity: "business",
      entityId: business.id,
      before: { shaxsiyKassa: joriy.shaxsiyKassa },
      after: { shaxsiyKassa: business.shaxsiyKassa },
    });
  }

  // Shaxsiy kassa rejimi YOQILGANDA har faol xodimga kassa ochiladi. Aks holda
  // rejim yoqilgan bo'lsa-yu kassalar yo'q bo'lsa, naqd pul avvalgidek umumiy
  // kassaga tushib ketardi va rejim jimgina ishlamay turardi.
  if (parsed.data.shaxsiyKassa === true) {
    await shaxsiyKassalarniOch(business.id);
    // Yangi kassalar ochildi — "Kassadagi pul" kartasidagi faol kassa soni
    // o'zgardi.
    dashboardYangilandi(business.id);
  }

  return NextResponse.json(business);
});

/**
 * Biznesning har faol xodimiga shaxsiy kassa ochadi (mavjudiga tegmaydi).
 * Nom to'qnashsa raqam qo'shiladi — Account [businessId, nomi] unique.
 */
async function shaxsiyKassalarniOch(businessId: string): Promise<void> {
  const [xodimlar, kassalar] = await Promise.all([
    prisma.user.findMany({
      // Ko'p-bizneslik: shu biznesga biriktirilganlar + biriktirilmaganlar.
      where: { isActive: true, ...biznesXodimlariWhere(businessId) },
      select: { id: true, ism: true },
    }),
    prisma.account.findMany({ where: { businessId }, select: { nomi: true, userId: true } }),
  ]);
  const kassaBor = new Set(kassalar.map((k) => k.userId).filter(Boolean));
  const bandNomlar = new Set(kassalar.map((k) => k.nomi));

  for (const x of xodimlar) {
    if (kassaBor.has(x.id)) continue;
    let nomi = `${x.ism} kassasi`;
    for (let i = 2; bandNomlar.has(nomi) && i <= 20; i++) nomi = `${x.ism} kassasi ${i}`;
    bandNomlar.add(nomi);
    await prisma.account.create({
      data: { businessId, nomi, turi: "naqd", userId: x.id, tartib: 10 },
    });
  }
}

/**
 * Biznesni butunlay o'chirish. Qoidalar (OWNER, nom tasdig'i, bo'sh biznes)
 * xizmat qatlamida — lib/services/biznesOchirish.ts.
 */
export const DELETE = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  const natija = await biznesOchir(params.id, { rol: user.rol }, {
    tasdiqNomi: await tasdiqNominiOqi(request),
  });
  return NextResponse.json(natija);
});

/** DELETE tanasidan `tasdiqNomi` ni o'qiydi (tana bo'lmasa yoki buzuq bo'lsa — null). */
async function tasdiqNominiOqi(request: Request): Promise<string | null> {
  try {
    const body = await request.json();
    const v = (body as { tasdiqNomi?: unknown })?.tasdiqNomi;
    return typeof v === "string" ? v.trim() : null;
  } catch {
    return null;
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { updateBusinessSchema } from "@/lib/validation/business";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";
import { logAudit } from "@/lib/services/audit";

export const PATCH = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  requireManager(user.rol);

  const body = await request.json();
  const parsed = updateBusinessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // Avto rejimi ombor tizimisiz ishlamaydi — birga yoqiladi (so'rovdagi qiymatdan ustun).
  // Umumiy rejimga qaytganda `omborli` o'z-o'zidan o'chmaydi: tovar savdosi
  // rejimdan mustaqil, uni faqat direktor qo'lda o'chiradi.
  const avtoMajburiy = parsed.data.turi === "avto" ? { omborli: true } : {};
  const eski =
    parsed.data.shaxsiyKassa === undefined
      ? null
      : await prisma.business.findUnique({
          where: { id: params.id },
          select: { shaxsiyKassa: true },
        });
  const business = await prisma.business.update({
    where: { id: params.id },
    data: { ...parsed.data, ...avtoMajburiy },
  });

  // KASSA SOZLAMASI auditga tushadi: shaxsiy kassa rejimi naqd pul QAYSI
  // kassaga tushishini o'zgartiradi, ya'ni bu moliyaviy oqim sozlamasi.
  // Boshqa biznes maydonlari bu yerda ataylab yozilmaydi — ular kassa
  // nazoratiga daxlsiz.
  if (parsed.data.shaxsiyKassa !== undefined && eski) {
    await logAudit({
      businessId: business.id,
      action: "update",
      entity: "business",
      entityId: business.id,
      before: { shaxsiyKassa: eski.shaxsiyKassa },
      after: { shaxsiyKassa: business.shaxsiyKassa },
    });
  }

  // Shaxsiy kassa rejimi YOQILGANDA har faol xodimga kassa ochiladi. Aks holda
  // rejim yoqilgan bo'lsa-yu kassalar yo'q bo'lsa, naqd pul avvalgidek umumiy
  // kassaga tushib ketardi va rejim jimgina ishlamay turardi.
  if (parsed.data.shaxsiyKassa === true) {
    await shaxsiyKassalarniOch(business.id);
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
 * Biznesni butunlay o'chirish — faqat direktor va faqat BO'SH biznes (yozuv/mahsulot/
 * sotuv/qarz/biriktirilgan foydalanuvchi yo'q). Ma'lumot bor bo'lsa — rad etiladi
 * (data yo'qolmasin); direktor uni "nofaollashtirsin" yoki ma'lumotni ko'chirsin.
 */
export const DELETE = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  requireManager(user.rol);
  const id = params.id;

  const biz = await prisma.business.findUnique({ where: { id }, select: { id: true, nomi: true } });
  if (!biz) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const [txCount, prodCount, saleCount, debtCount, userCount] = await Promise.all([
    prisma.transaction.count({ where: { businessId: id } }),
    prisma.product.count({ where: { businessId: id } }),
    prisma.sale.count({ where: { businessId: id } }),
    prisma.debt.count({ where: { businessId: id } }),
    prisma.user.count({ where: { businessId: id } }),
  ]);

  if (txCount + prodCount + saleCount + debtCount + userCount > 0) {
    const parts: string[] = [];
    if (txCount) parts.push(`${txCount} yozuv`);
    if (prodCount) parts.push(`${prodCount} mahsulot`);
    if (saleCount) parts.push(`${saleCount} sotuv`);
    if (debtCount) parts.push(`${debtCount} qarz`);
    if (userCount) parts.push(`${userCount} foydalanuvchi`);
    return NextResponse.json(
      {
        error: `Bu bizneste ma'lumot bor (${parts.join(", ")}). O'chirib bo'lmaydi — avval ularni ko'chiring/o'chiring, yoki biznesni "Nofaollashtiring".`,
      },
      { status: 409 }
    );
  }

  // Bo'sh biznes — config yozuvlarini (kategoriya, budjet, takroriy) tozalab, biznesni o'chiramiz.
  try {
    await prisma.budget.deleteMany({ where: { businessId: id } });
    await prisma.recurringTransaction.deleteMany({ where: { businessId: id } });
    await prisma.category.deleteMany({ where: { businessId: id } });
    await prisma.business.delete({ where: { id } });
  } catch (e) {
    console.error("Business delete xatosi:", e);
    return NextResponse.json(
      {
        error:
          "Biznesni o'chirib bo'lmadi (u boshqa yozuvlarga bog'langan bo'lishi mumkin). Uni \"Nofaollashtiring\".",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
});

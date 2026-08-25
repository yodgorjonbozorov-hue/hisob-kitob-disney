import { prisma } from "@/lib/prisma";
import { BadRequestError, ConflictError, ForbiddenError } from "@/lib/auth/guard";

/**
 * BIZNESNI BUTUNLAY O'CHIRISH.
 *
 * Uch qavat himoya (frontend tasdig'i himoya hisoblanmaydi):
 *   1. faqat DIREKTOR (OWNER) — tozalash bilan bir xil daraja, chunki ikkalasi
 *      ham qaytarib bo'lmaydigan amal;
 *   2. biznes nomi AYNAN yozilishi shart;
 *   3. faqat BO'SH biznes o'chadi — yozuv, mahsulot, sotuv, qarz yoki
 *      biriktirilgan foydalanuvchi bo'lsa rad etiladi (ma'lumot yo'qolmasin).
 *
 * Tenant izolyatsiyasi: barcha so'rovlar tenant-scoped `@/lib/prisma` orqali,
 * shuning uchun begona tenant biznesining id'si berilsa "topilmadi" qaytadi.
 */
export interface OchirishAktor {
  rol: string;
}

export async function biznesOchir(
  id: string,
  aktor: OchirishAktor,
  opts: { tasdiqNomi: string | null }
): Promise<{ ok: true }> {
  if (aktor.rol !== "OWNER") {
    throw new ForbiddenError("Biznesni o'chirishni faqat direktor bajara oladi");
  }

  const biz = await prisma.business.findUnique({ where: { id }, select: { id: true, nomi: true } });
  if (!biz) throw new BadRequestError("Biznes topilmadi");

  if (!opts.tasdiqNomi || opts.tasdiqNomi.trim() !== biz.nomi.trim()) {
    throw new BadRequestError("Biznes nomi mos kelmadi — o'chirish bekor qilindi");
  }

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
    throw new ConflictError(
      `Bu bizneste ma'lumot bor (${parts.join(", ")}). O'chirib bo'lmaydi — avval ularni ` +
        `ko'chiring/o'chiring, yoki biznesni "Nofaollashtiring".`
    );
  }

  // Bo'sh biznes — sozlama yozuvlarini (kassa, kategoriya, budjet, takroriy)
  // tozalab, biznesni o'chiramiz.
  try {
    await prisma.account.deleteMany({ where: { businessId: id } });
    await prisma.budget.deleteMany({ where: { businessId: id } });
    await prisma.recurringTransaction.deleteMany({ where: { businessId: id } });
    await prisma.category.deleteMany({ where: { businessId: id } });
    await prisma.business.delete({ where: { id } });
  } catch (e) {
    console.error("Business delete xatosi:", e);
    throw new ConflictError(
      'Biznesni o\'chirib bo\'lmadi (u boshqa yozuvlarga bog\'langan bo\'lishi mumkin). Uni "Nofaollashtiring".'
    );
  }

  return { ok: true };
}

import { prisma } from "@/lib/prisma";
import { getAccountBalances } from "@/lib/queries/accounts";

/**
 * FOYDALANUVCHI KESIMIDAGI MOLIYA — Foydalanuvchilar sahifasi ustunlari uchun.
 *
 * Uchala raqam ham JORIY BIZNES bo'yicha (kassa, qarz va yozuvlar biznesga
 * bog'langan). Balans hech qachon alohida saqlanmaydi — `getAccountBalances`
 * uni ledger'dan (Transaction + AccountTransfer) hisoblaydi, bu yerda esa
 * faqat kassa egasi bo'yicha yig'iladi.
 *
 * Barcha so'rovlar to'plam bo'yicha (N+1 yo'q): foydalanuvchilar soni qancha
 * bo'lsa ham so'rovlar soni o'zgarmaydi.
 */
export interface UserMoliya {
  /** Shaxsiy kassalari qoldig'i (ledger'dan). */
  balans: number;
  /** Ta'minotchi sifatida ochiq qarz — biznes shu odamga qancha qarzdor. */
  qarz: number;
  /** Pul harakatlari soni: tranzaksiyalar + o'tkazmalar (kirgan/chiqqan). */
  amallar: number;
}

const BOSH: UserMoliya = { balans: 0, qarz: 0, amallar: 0 };

export async function getUserMoliya(businessId: string): Promise<Map<string, UserMoliya>> {
  const [balanslar, txGuruh, transferlar, qarzOrderlar] = await Promise.all([
    getAccountBalances(businessId),
    prisma.transaction.groupBy({
      by: ["userId"],
      where: { businessId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.accountTransfer.findMany({
      where: { businessId },
      select: { fromUserId: true, toUserId: true },
    }),
    // Qarz `supplierId` bilan emas, buyurtma orqali bog'lanadi:
    // PurchaseOrder.debtId → PurchaseOrder.supplier.userId.
    prisma.purchaseOrder.findMany({
      where: { businessId, debtId: { not: null }, supplier: { userId: { not: null } } },
      select: { debtId: true, supplier: { select: { userId: true } } },
    }),
  ]);

  const natija = new Map<string, UserMoliya>();
  const olish = (userId: string): UserMoliya => {
    let m = natija.get(userId);
    if (!m) {
      m = { ...BOSH };
      natija.set(userId, m);
    }
    return m;
  };

  // 1. Balans — shaxsiy kassalar bo'yicha (userId null bo'lsa umumiy biznes kassasi).
  for (const k of balanslar) {
    if (!k.userId) continue;
    olish(k.userId).balans += k.qoldiq;
  }

  // 2. Amallar — tranzaksiyalar.
  for (const g of txGuruh) {
    if (!g.userId) continue;
    olish(g.userId).amallar += g._count._all;
  }

  // 3. Amallar — o'tkazmalar (har ikki tomon uchun ham bitta harakat).
  for (const tr of transferlar) {
    if (tr.fromUserId) olish(tr.fromUserId).amallar += 1;
    if (tr.toUserId && tr.toUserId !== tr.fromUserId) olish(tr.toUserId).amallar += 1;
  }

  // 4. Qarz — ochiq "beriladigan" qoldiq, ta'minotchi useri kesimida.
  const debtIds = qarzOrderlar.map((o) => o.debtId!).filter(Boolean);
  if (debtIds.length > 0) {
    const qarzlar = await prisma.debt.findMany({
      where: { businessId, id: { in: debtIds }, isYopilgan: false },
      select: { id: true, jamiSumma: true, tolangan: true },
    });
    const qoldiqlar = new Map(qarzlar.map((d) => [d.id, d.jamiSumma - d.tolangan]));
    for (const o of qarzOrderlar) {
      const qoldiq = qoldiqlar.get(o.debtId!);
      if (!qoldiq || !o.supplier.userId) continue;
      olish(o.supplier.userId).qarz += qoldiq;
    }
  }

  return natija;
}

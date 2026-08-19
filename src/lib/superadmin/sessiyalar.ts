import { rawPrisma } from "@/lib/db/rawPrisma";
import { BadRequestError } from "@/lib/auth/guard";

/**
 * SESSIYA BOSHQARUVI (talab 25).
 *
 * MUAMMO: iron-session STATELESS — sessiya shifrlangan cookie ichida yashaydi,
 * serverda hech qanday yozuv yo'q. Ya'ni "sessiyani bekor qilish" texnik
 * jihatdan imkonsiz edi: bloklangan xodim ham, o'g'irlangan cookie ham
 * 7 kun ishlayverardi.
 *
 * YECHIM: `User.sessionEpoch` — sessiya AVLODI. Cookie ichida login paytidagi
 * avlod raqami yotadi; guard har so'rovda uni bazadagi qiymat bilan
 * solishtiradi. Raqamni bittaga oshirish = shu foydalanuvchining barcha
 * qurilmalaridagi barcha cookie'lari bir zumda kuchsizlanadi.
 *
 * Cheklov ochiq aytiladi: alohida qurilmani tanlab chiqarish MUMKIN EMAS —
 * server sessiyalar ro'yxatini saqlamaydi. Bekor qilish HAR DOIM "hamma
 * qurilmada" bo'ladi. Qurilmalar ro'yxati kerak bo'lsa, sessiya jadvali
 * qo'shilishi kerak (alohida qaror).
 */

export interface SessiyaBekorNatija {
  userId: string;
  login: string;
  ism: string;
  yangiEpoch: number;
}

/** Bitta foydalanuvchining barcha sessiyalarini bekor qiladi. */
export async function sessiyalarniBekorQil(userId: string): Promise<SessiyaBekorNatija> {
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: { id: true, login: true, ism: true, sessionEpoch: true },
  });
  if (!user) throw new BadRequestError("Foydalanuvchi topilmadi");

  const yangilangan = await rawPrisma.user.update({
    where: { id: userId },
    data: { sessionEpoch: { increment: 1 } },
    select: { sessionEpoch: true },
  });

  return {
    userId: user.id,
    login: user.login,
    ism: user.ism,
    yangiEpoch: yangilangan.sessionEpoch,
  };
}

/** Kompaniyaning BARCHA foydalanuvchilari sessiyalarini bekor qiladi. */
export async function tenantSessiyalariniBekorQil(tenantId: string): Promise<number> {
  const natija = await rawPrisma.user.updateMany({
    where: { tenantId },
    data: { sessionEpoch: { increment: 1 } },
  });
  return natija.count;
}

/**
 * "Faol sessiya" taxminiy ko'rsatkichi: oxirgi 7 kun (cookie umri) ichida
 * kirgan foydalanuvchilar. Bu HAQIQIY sessiya ro'yxati EMAS va panelda
 * shunday belgilanadi — soxta aniqlik ko'rsatilmaydi.
 */
export async function taxminiyFaolSessiyalar(now: Date = new Date()): Promise<number> {
  const chegara = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return rawPrisma.user.count({ where: { isActive: true, lastLoginAt: { gte: chegara } } });
}

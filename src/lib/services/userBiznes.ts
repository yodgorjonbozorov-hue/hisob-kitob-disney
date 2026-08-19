import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "@/lib/auth/guard";

/**
 * XODIM ↔ BIZNES BIRIKTIRUVI (ko'p-bizneslik).
 *
 * Bir jamoa bir nechta biznesni yuritishi mumkin (masalan gullar va sovg'a
 * qutilari — sotuvchilar bir xil, bizneslar esa hisob-kitob chalkashmasligi
 * uchun alohida). Shu bois xodim BIR NECHTA biznesga biriktiriladi.
 *
 * Qoidalar (yagona joyda, ikkala route ham shundan foydalanadi):
 *   · KASSIR   — kamida bitta biznes MAJBURIY (yozuvi qayerga tushishi aniq
 *                bo'lishi kerak);
 *   · SOTUVCHI — ixtiyoriy: bo'sh qoldirilsa barcha bizneslarni ko'radi;
 *   · DIREKTOR/ADMINISTRATOR — biriktirilmaydi (doim barcha bizneslar).
 */

/** Rol biznesga biriktiriladigan turdami (direktor/administrator — yo'q). */
function biriktiriladiganRol(rol: string): boolean {
  return rol === "CASHIER" || rol === "SELLER";
}

/**
 * So'rovdan kelgan biznes ro'yxatini normallashtiradi va tekshiradi.
 *
 * `businessIds` — yangi (ko'p-biznes) maydon; `businessId` — eski bitta
 * bizneslik maydon (mavjud integratsiyalar va bot uchun saqlanadi).
 * Ikkalasi ham berilmasa `mavjud` (bazadagi holat) o'zgarishsiz qoladi.
 */
export async function biznesIdlariniHalQil(params: {
  rol: string;
  businessIds?: string[] | null;
  businessId?: string | null;
  /** Bazadagi joriy biriktiruvlar (PATCH uchun; yaratishda bo'sh). */
  mavjud: string[];
}): Promise<string[]> {
  const { rol, businessIds, businessId, mavjud } = params;

  // Direktor/administrator hech qachon biriktirilmaydi — barcha bizneslar.
  if (!biriktiriladiganRol(rol)) return [];

  let idlar: string[];
  if (businessIds !== undefined && businessIds !== null) {
    idlar = businessIds;
  } else if (businessId !== undefined) {
    idlar = businessId ? [businessId] : [];
  } else {
    idlar = mavjud;
  }

  // Takrorlanganlarni olib tashlaymiz (UI ikki marta yuborishi mumkin).
  idlar = [...new Set(idlar.filter(Boolean))];

  if (rol === "CASHIER" && idlar.length === 0) {
    throw new BadRequestError("Kassir uchun kamida bitta biznes tanlanishi shart");
  }

  if (idlar.length > 0) {
    // Tenant-scoped client: boshqa tenant biznesi bu yerda umuman ko'rinmaydi.
    const topilgan = await prisma.business.findMany({
      where: { id: { in: idlar } },
      select: { id: true },
    });
    if (topilgan.length !== idlar.length) {
      throw new BadRequestError("Biznes topilmadi");
    }
  }

  return idlar;
}

/**
 * Biriktiruvlarni bazada YANGILAYDI (eskilarini o'chirib, yangilarini yozadi)
 * va `User.businessId` qulaylik nusxasini sinxron saqlaydi.
 *
 * `User.businessId` = AYNAN BITTA biznes bo'lsa o'sha id, aks holda NULL.
 * Bu ustunga tayanadigan eski kod (bot oqimlari, sessiya) shu bois xato
 * ruxsat bermaydi: u faqat "bitta biznesga qotirilganmi" degan savolga javob
 * beradi, ruxsat ro'yxatining o'zi esa `UserBusiness` da.
 *
 * Tranzaksiya ishlatilmaydi: bu MOLIYAVIY amal emas, pul yoki qoldiqqa
 * tegmaydi. Oraliq holatda (o'chirildi, hali yozilmadi) xodim eng yomoni
 * bir necha millisekund "cheklovsiz" ko'rinadi — shu bois avval YOZILADI,
 * keyin ortiqchasi o'chiriladi.
 */
export async function biriktiruvlarniYangila(userId: string, idlar: string[]): Promise<void> {
  const mavjud = await prisma.userBusiness.findMany({
    where: { userId },
    select: { id: true, businessId: true },
  });
  const mavjudIdlar = new Set(mavjud.map((m) => m.businessId));

  const qoshiladi = idlar.filter((id) => !mavjudIdlar.has(id));
  if (qoshiladi.length > 0) {
    await prisma.userBusiness.createMany({
      data: qoshiladi.map((businessId) => ({ userId, businessId })),
    });
  }

  const ochiriladi = mavjud.filter((m) => !idlar.includes(m.businessId)).map((m) => m.id);
  if (ochiriladi.length > 0) {
    await prisma.userBusiness.deleteMany({ where: { id: { in: ochiriladi } } });
  }
}

/** `User.businessId` (birlamchi biznes) qiymati — bitta bo'lsa o'sha, aks holda null. */
export function birlamchiBiznes(idlar: string[]): string | null {
  return idlar.length === 1 ? idlar[0] : null;
}

/**
 * "Shu bizneste ishlaydigan xodimlar" filtri (Prisma `where` bo'lagi).
 *
 * Uchta holat qamraladi:
 *   · shu biznesga biriktirilgan (`UserBusiness` qatori bor);
 *   · eski usulda biriktirilgan (`User.businessId` = shu biznes);
 *   · umuman biriktirilmagan (direktor/administrator) — barcha bizneslarda.
 *
 * DIQQAT: `businessId: null` ni YOLG'IZ o'zi "biriktirilmagan" deb o'qish
 * XATO — ko'p biznesga biriktirilgan xodimda ham u NULL bo'ladi. Shuning
 * uchun "biriktirilmagan" sharti qator YO'QLIGI bilan birga tekshiriladi.
 */
export function biznesXodimlariWhere(businessId: string): Prisma.UserWhereInput {
  return {
    OR: [
      { businessId },
      { bizneslar: { some: { businessId } } },
      { AND: [{ businessId: null }, { bizneslar: { none: {} } }] },
    ],
  };
}

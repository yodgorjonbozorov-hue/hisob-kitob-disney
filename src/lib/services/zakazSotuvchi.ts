import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import { logAudit } from "@/lib/services/audit";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";

/**
 * ZAKAZ SOTUVCHISI — "buyurtmani KIM oldi" degan savolning yagona javobi.
 *
 * UCH TUSHUNCHA ARALASHTIRILMAYDI (38-talab):
 *   createdBy  — CRM'ga ma'lumotni kim kiritdi (`Activity.userId`, audit);
 *   SOTUVCHI   — mijoz bilan gaplashib zakazni kim oldi (shu modul);
 *   mas'ul/ijrochi — zakazni bajaradigan xodim (boshqa kategoriyalardagi
 *                    `DealEmployee` biriktiruvlari).
 *
 * SAQLASH JOYI — YANGI JADVAL YO'Q. Sotuvchi mavjud `DealEmployee`
 * biriktiruvi sifatida, `EmployeeCategory.turi = "sotuvchi"` kategoriyasida
 * yoziladi. Shu tufayli mavjud kategoriya analitikasi, a'zolik tekshiruvi va
 * tarix (nofaol xodim ham ko'rinadi) o'z-o'zidan ishlaydi.
 *
 * MULTI-TENANCY: mijoz yuborgan `sotuvchiId` ga hech qachon ishonilmaydi —
 * har chaqiruvda xodim SHU biznesniki va SHU biznesning faol sotuvchi
 * kategoriyasi a'zosi ekani tekshiriladi (29/35-talab).
 */

/** Sotuvchi turidagi kategoriya — KPI uslubi nomga emas, shu turga bog'lanadi. */
export const SOTUVCHI_TURI = "sotuvchi";

export interface SotuvchiDTO {
  /** Employee.id — zakazga aynan shu biriktiriladi. */
  id: string;
  ism: string;
  rasmUrl: string | null;
  isActive: boolean;
  /** Tizim hisobi (User.id) — avto-tanlash va mas'ul sinxroni uchun. */
  userId: string | null;
}

/** Biznesning FAOL sotuvchi kategoriyalari (odatda bitta — "Sotuvchi"). */
export async function sotuvchiKategoriyaIdlari(businessId: string): Promise<string[]> {
  const rows = await prisma.employeeCategory.findMany({
    where: { businessId, turi: SOTUVCHI_TURI, aktiv: true },
    orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Yangi zakaz formasi uchun sotuvchilar ro'yxati (2-talab): faqat SHU
 * biznesning, FAOL va sotuvchi kategoriyasiga tayinlangan xodimlari.
 * Direktor/dekorator/haydovchi — kategoriyada bo'lmasa ro'yxatga tushmaydi.
 * Nofaol xodim ham chiqmaydi (30-talab), lekin tarixi saqlanadi.
 */
export async function sotuvchilarRoyxati(businessId: string): Promise<SotuvchiDTO[]> {
  const idlar = await sotuvchiKategoriyaIdlari(businessId);
  if (idlar.length === 0) return [];

  const azolar = await prisma.employeeCategoryMember.findMany({
    where: {
      businessId,
      categoryId: { in: idlar },
      employee: { deletedAt: null, isActive: true },
    },
    select: {
      employee: { select: { id: true, ism: true, rasmUrl: true, isActive: true, userId: true } },
    },
  });

  // Bir xodim bir necha sotuvchi kategoriyasida bo'lsa — ro'yxatda bir marta.
  const noyob = new Map<string, SotuvchiDTO>();
  for (const a of azolar) noyob.set(a.employee.id, a.employee);
  return [...noyob.values()].sort((a, b) => a.ism.localeCompare(b.ism));
}

export interface TekshirilganSotuvchi extends SotuvchiDTO {
  /** Qaysi sotuvchi kategoriyasiga biriktiriladi. */
  categoryId: string;
}

/**
 * SERVER TEKSHIRUVI (35-talab): xodim mavjudmi, shu biznesnikimi, faolmi va
 * sotuvchi kategoriyasining a'zosimi. Frontend filtri xavfsizlik o'rnini
 * bosmaydi — barcha yozish yo'llari shu funksiyadan o'tadi.
 */
export async function sotuvchiTekshir(
  businessId: string,
  employeeId: string
): Promise<TekshirilganSotuvchi> {
  const idlar = await sotuvchiKategoriyaIdlari(businessId);
  if (idlar.length === 0) {
    throw new BadRequestError("Bu bizneste sotuvchi kategoriyasi sozlanmagan");
  }

  const azolik = await prisma.employeeCategoryMember.findFirst({
    where: {
      businessId,
      employeeId,
      categoryId: { in: idlar },
      employee: { deletedAt: null },
    },
    select: {
      categoryId: true,
      employee: { select: { id: true, ism: true, rasmUrl: true, isActive: true, userId: true } },
    },
  });
  if (!azolik) throw new ForbiddenError("Tanlangan xodim bu biznesning sotuvchisi emas");
  if (!azolik.employee.isActive) throw new BadRequestError("Bu xodim nofaol — sotuvchi qilib tanlab bo'lmaydi");

  return { ...azolik.employee, categoryId: azolik.categoryId };
}

/**
 * AVTO-TANLASH (4-talab): tizimga kirgan foydalanuvchining xodim profili
 * sotuvchi kategoriyasida bo'lsa — o'zi qaytadi. Sotuvchi o'z zakazini
 * kiritayotganda o'zini har safar qidirmasin.
 */
export async function avtoSotuvchi(businessId: string, userId: string): Promise<SotuvchiDTO | null> {
  const idlar = await sotuvchiKategoriyaIdlari(businessId);
  if (idlar.length === 0) return null;

  const azolik = await prisma.employeeCategoryMember.findFirst({
    where: {
      businessId,
      categoryId: { in: idlar },
      employee: { userId, deletedAt: null, isActive: true },
    },
    select: { employee: { select: { id: true, ism: true, rasmUrl: true, isActive: true, userId: true } } },
  });
  return azolik?.employee ?? null;
}

/**
 * SOTUVCHI MAJBURIYMI (6-talab). Biznes sozlamasi (`HrSetting`) yoqilgan VA
 * biznesda tanlash mumkin bo'lgan sotuvchi bo'lsa — majburiy. Ikkinchi shart
 * ataylab: sozlama yoqilgan-u sotuvchi tayinlanmagan bo'lsa zakaz umuman
 * ochilmasdi.
 */
export async function sotuvchiMajburiymi(businessId: string): Promise<boolean> {
  const sozlama = await prisma.hrSetting.findFirst({
    where: { businessId },
    select: { crmSotuvchiMajburiy: true },
  });
  if (!sozlama?.crmSotuvchiMajburiy) return false;
  const royxat = await sotuvchilarRoyxati(businessId);
  return royxat.length > 0;
}

export interface ZakazSotuvchisi {
  employeeId: string;
  categoryId: string;
  ism: string;
  rasmUrl: string | null;
  isActive: boolean;
}

/** Zakazlarning joriy sotuvchisi (kalit: Deal.id) — bitta so'rovda, N+1 yo'q. */
export async function zakazSotuvchilari(
  businessId: string,
  dealIdlar: string[]
): Promise<Map<string, ZakazSotuvchisi>> {
  const natija = new Map<string, ZakazSotuvchisi>();
  if (dealIdlar.length === 0) return natija;

  const rows = await prisma.dealEmployee.findMany({
    where: {
      businessId,
      dealId: { in: dealIdlar },
      // Kategoriya keyin NOAKTIV qilinsa ham tarixiy sotuvchi ko'rinadi
      // (30-talab) — shuning uchun `aktiv` sharti ATAYLAB yo'q.
      category: { turi: SOTUVCHI_TURI },
    },
    select: {
      dealId: true,
      categoryId: true,
      employee: { select: { id: true, ism: true, rasmUrl: true, isActive: true } },
    },
  });

  for (const r of rows) {
    if (natija.has(r.dealId)) continue; // bir zakazda bitta sotuvchi ko'rsatiladi
    natija.set(r.dealId, {
      employeeId: r.employee.id,
      categoryId: r.categoryId,
      ism: r.employee.ism,
      rasmUrl: r.employee.rasmUrl,
      isActive: r.employee.isActive,
    });
  }
  return natija;
}

/** Bitta zakazning sotuvchisi (tafsilot oynasi uchun). */
export async function zakazSotuvchisi(
  businessId: string,
  dealId: string
): Promise<ZakazSotuvchisi | null> {
  const xarita = await zakazSotuvchilari(businessId, [dealId]);
  return xarita.get(dealId) ?? null;
}

/**
 * SOTUVCHINI ALMASHTIRISH (10/27-talab) — huquq route qatlamida tekshiriladi.
 *
 * ATOMIK (`runBusinessTx`): eski biriktiruv o'chiriladi, yangisi yoziladi,
 * `Deal.masulId` va (kirim yozilgan bo'lsa) `Transaction.sotuvchiId` ayni
 * sotuvchiga sinxronlanadi — CRM statistikasi va xodim savdo statistikasi
 * BIR xil javob bersin. Tranzaksiya ichida xom `tx` ishlatilgani uchun har
 * so'rovga `businessId` sharti QO'LDA yozilgan (CLAUDE.md qoidasi).
 *
 * Kirim yozilgach ham almashtirishga RUXSAT bor: noto'g'ri kiritilgan
 * sotuvchini tuzatish bonus hisobiga to'g'ridan-to'g'ri ta'sir qiladi,
 * shuning uchun amal audit jurnaliga va zakaz lentasiga yoziladi.
 */
export async function sotuvchiniOzgartirish(params: {
  businessId: string;
  dealId: string;
  /** Yangi sotuvchi (Employee.id). */
  employeeId: string;
  /** Amalni bajargan foydalanuvchi (createdBy EMAS — "kim o'zgartirdi"). */
  userId: string;
}): Promise<ZakazSotuvchisi> {
  const { businessId, dealId, employeeId, userId } = params;

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, businessId, deletedAt: null },
    select: { id: true, contactId: true, transactionId: true },
  });
  if (!deal) throw new ForbiddenError("Buyurtma topilmadi");

  const yangi = await sotuvchiTekshir(businessId, employeeId);
  const eski = await zakazSotuvchisi(businessId, dealId);
  if (eski?.employeeId === yangi.id) return eski;

  // Sotuvchining tizim hisobi shu bizneste ishlayotgan bo'lsa — mas'ul ham
  // o'shanga o'tadi (mavjud `sotuvchiUserIdTop` qoidasi bilan bir xil).
  const sotuvchiUser = yangi.userId
    ? await prisma.user.findFirst({
        where: { id: yangi.userId, isActive: true, ...biznesXodimlariWhere(businessId) },
        select: { id: true },
      })
    : null;

  await runBusinessTx(businessId, async (tx) => {
    await tx.dealEmployee.deleteMany({
      where: { businessId, dealId, category: { turi: SOTUVCHI_TURI } },
    });
    await tx.dealEmployee.create({
      data: { businessId, dealId, categoryId: yangi.categoryId, employeeId: yangi.id },
    });
    if (sotuvchiUser) {
      await tx.deal.updateMany({ where: { id: dealId, businessId }, data: { masulId: sotuvchiUser.id } });
      if (deal.transactionId) {
        // Pul yozuvi o'zgarmaydi — faqat "savdo kimniki" biriktiruvi.
        await tx.transaction.updateMany({
          where: { id: deal.transactionId, businessId, turi: "kirim" },
          data: { sotuvchiId: sotuvchiUser.id },
        });
      }
    }
    await tx.activity.create({
      data: {
        businessId,
        dealId,
        contactId: deal.contactId,
        turi: "tizim",
        matn: `Sotuvchi o'zgardi: ${eski?.ism ?? "tanlanmagan"} → ${yangi.ism}`,
        userId,
      },
    });
  });

  await logAudit({
    businessId,
    action: "update",
    entity: "deal",
    entityId: dealId,
    before: { sotuvchi: eski?.ism ?? null, sotuvchiEmployeeId: eski?.employeeId ?? null },
    after: { sotuvchi: yangi.ism, sotuvchiEmployeeId: yangi.id },
  });

  return {
    employeeId: yangi.id,
    categoryId: yangi.categoryId,
    ism: yangi.ism,
    rasmUrl: yangi.rasmUrl,
    isActive: yangi.isActive,
  };
}

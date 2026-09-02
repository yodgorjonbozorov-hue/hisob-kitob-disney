import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import type { ZakazXodimInput } from "@/lib/validation/xodimKategoriya";

/**
 * ZAKAZ JAMOASI — buyurtmada qaysi xodim qaysi lavozimda qatnashadi
 * (`DealEmployee`). Sotuvchi ham shu jadvalda (turi = "sotuvchi"), lekin u
 * `lib/services/zakazSotuvchi.ts` orqali alohida boshqariladi.
 *
 * BIR ZAKAZ = BIR ZAKAZ: bu jadval faqat QATNASHUV yozuvi. Zakaz soni
 * `Deal` dan, pul `Deal.transactionId` dan o'qiladi — 5 xodim qatnashgan
 * zakaz kompaniya hisobotida 1 ta bo'lib qoladi, xodim analitikasida esa
 * har biriga 1 tadan qatnashuv tushadi.
 *
 * DUBLIKAT YO'Q: baza darajasida UNIQUE(dealId, categoryId, employeeId);
 * saqlash esa FARQ (diff) asosida — o'zgarmagan biriktiruv o'chirib qayta
 * yozilmaydi (bahosi ham saqlanib qoladi), yangi qo'shiladi, olib
 * tashlangani o'chadi. Hammasi bitta tranzaksiyada.
 *
 * MULTI-TENANCY: xodim va lavozim SHU biznesniki ekani har chaqiruvda
 * tekshiriladi — mijoz yuborgan id'larga ishonilmaydi.
 */

export interface ZakazXodimDTO {
  id: string;
  categoryId: string;
  kategoriyaNomi: string;
  kategoriyaTuri: string;
  employeeId: string;
  ism: string;
  rasmUrl: string | null;
  isActive: boolean;
  /** Sifat nazorati bahosi (1..10), null — baholanmagan. */
  baho: number | null;
}

/** Zakazning joriy biriktiruvlari (tafsilot oynasi uchun), lavozim tartibida. */
export async function zakazXodimlari(businessId: string, dealId: string): Promise<ZakazXodimDTO[]> {
  const rows = await prisma.dealEmployee.findMany({
    where: { businessId, dealId },
    include: {
      category: { select: { nomi: true, turi: true, tartib: true } },
      employee: { select: { ism: true, rasmUrl: true, isActive: true } },
    },
  });
  return rows
    .sort((a, b) => a.category.tartib - b.category.tartib || a.employee.ism.localeCompare(b.employee.ism))
    .map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      kategoriyaNomi: r.category.nomi,
      kategoriyaTuri: r.category.turi,
      employeeId: r.employeeId,
      ism: r.employee.ism,
      rasmUrl: r.employee.rasmUrl,
      isActive: r.employee.isActive,
      baho: r.baho,
    }));
}

/**
 * Biriktiruv ro'yxatini tekshiradi (buyurtma yaratilishidan OLDIN ham
 * chaqiriladi — xato bo'lsa buyurtma umuman yaratilmasin):
 *  - lavozim shu biznesniki va FAOL; ijrochi lavozim zakazga biriktiriladigan;
 *  - xodim shu biznesniki, o'chirilmagan va o'sha lavozim A'ZOSI;
 *  - `kopXodim` bo'lmagan lavozimga bir zakazda BITTA xodim.
 * Dublikat juftliklar chiqarilgan ro'yxat qaytadi.
 */
export async function zakazXodimlariniTekshir(
  businessId: string,
  items: ZakazXodimInput[]
): Promise<ZakazXodimInput[]> {
  const noyob = new Map<string, ZakazXodimInput>();
  for (const it of items) noyob.set(`${it.categoryId}:${it.employeeId}`, it);
  const royxat = [...noyob.values()];
  if (royxat.length === 0) return royxat;

  const categoryIdlar = [...new Set(royxat.map((r) => r.categoryId))];
  const kategoriyalar = await prisma.employeeCategory.findMany({
    where: { businessId, id: { in: categoryIdlar }, aktiv: true },
    select: { id: true, nomi: true, turi: true, kopXodim: true, zakazgaBiriktiriladi: true },
  });
  const katXarita = new Map(kategoriyalar.map((k) => [k.id, k]));
  for (const id of categoryIdlar) {
    const k = katXarita.get(id);
    if (!k) throw new ForbiddenError("Lavozim topilmadi yoki nofaol");
    // Sotuvchi alohida yo'ldan (zakazSotuvchi) keladi — bayroq unga tegmaydi.
    if (k.turi !== "sotuvchi" && !k.zakazgaBiriktiriladi) {
      throw new BadRequestError(`"${k.nomi}" lavozimi zakazga biriktirilmaydi`);
    }
    const soni = royxat.filter((r) => r.categoryId === id).length;
    if (soni > 1 && !k.kopXodim) {
      throw new BadRequestError(`"${k.nomi}" lavozimiga bir zakazda faqat bitta xodim biriktiriladi`);
    }
  }

  const azoliklar = await prisma.employeeCategoryMember.findMany({
    where: {
      businessId,
      categoryId: { in: categoryIdlar },
      employeeId: { in: royxat.map((r) => r.employeeId) },
      employee: { deletedAt: null },
    },
    select: { categoryId: true, employeeId: true },
  });
  const bor = new Set(azoliklar.map((a) => `${a.categoryId}:${a.employeeId}`));
  for (const r of royxat) {
    if (!bor.has(`${r.categoryId}:${r.employeeId}`)) {
      throw new ForbiddenError("Xodim tanlangan lavozimning a'zosi emas");
    }
  }
  return royxat;
}

/**
 * ZAKAZ JAMOASINI SAQLASH — FARQ ASOSIDA, ATOMIK.
 *
 * Qoidalar:
 *  - kirim yozilgan (transactionId bor) buyurtmada QULFLANADI — yakunlangan
 *    zakaz statistikasi keyin o'zgarib qolmasin;
 *  - hech narsa o'zgarmagan bo'lsa (tahrir oynasida shunchaki "Saqlash")
 *    bazaga BIRORTA yozuv ham tegmaydi — hech kimga ikkinchi +1 tushmaydi;
 *  - xodim almashsa: eskisi o'chadi, yangisi qo'shiladi — eskisining joriy
 *    statistikasida bu zakaz qolmaydi (o'zgarish zakaz lentasiga yoziladi).
 *
 * `runBusinessTx` ichida xom `tx` — har so'rovda `businessId` QO'LDA.
 */
export async function zakazXodimlariniSaqlash(
  businessId: string,
  dealId: string,
  items: ZakazXodimInput[],
  /** Berilsa o'zgarish zakaz lentasiga (Activity) yoziladi. */
  userId?: string
): Promise<ZakazXodimDTO[]> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, businessId, deletedAt: null },
    select: { id: true, contactId: true, transactionId: true },
  });
  if (!deal) throw new ForbiddenError("Buyurtma topilmadi");
  if (deal.transactionId) {
    throw new BadRequestError("Kirim yozilgan buyurtmaning jamoasi o'zgartirilmaydi");
  }

  const royxat = await zakazXodimlariniTekshir(businessId, items);

  const hozirgi = await prisma.dealEmployee.findMany({
    where: { businessId, dealId },
    select: {
      id: true,
      categoryId: true,
      employeeId: true,
      employee: { select: { ism: true } },
      category: { select: { turi: true } },
    },
  });
  const kalit = (r: { categoryId: string; employeeId: string }) => `${r.categoryId}:${r.employeeId}`;
  const yangiKalitlar = new Set(royxat.map(kalit));
  const eskiKalitlar = new Set(hozirgi.map(kalit));

  // SOTUVCHI QATORI HIMOYASI: jamoa tahriri faqat IJROCHILARNI yuboradi
  // (sotuvchi alohida maydondan boshqariladi). Kiruvchi ro'yxatda sotuvchi
  // bo'lmasa mavjud sotuvchi biriktiruvi TEGILMAYDI — aks holda jamoa
  // tahriri sotuvchini jimgina o'chirib, sotuv statistikasini buzardi.
  const kiruvchiSotuvchi = royxat.length
    ? (await prisma.employeeCategory.count({
        where: { businessId, id: { in: royxat.map((r) => r.categoryId) }, turi: "sotuvchi" },
      })) > 0
    : false;

  const ochiriladigan = hozirgi.filter(
    (r) => !yangiKalitlar.has(kalit(r)) && (kiruvchiSotuvchi || r.category.turi !== "sotuvchi")
  );
  const qoshiladigan = royxat.filter((r) => !eskiKalitlar.has(kalit(r)));

  // Hech narsa o'zgarmagan — bazaga tegilmaydi (42-stsenariy: dublikat yo'q).
  if (ochiriladigan.length === 0 && qoshiladigan.length === 0) {
    return zakazXodimlari(businessId, dealId);
  }

  const yangiIsmlar = qoshiladigan.length
    ? await prisma.employee.findMany({
        where: { businessId, id: { in: qoshiladigan.map((r) => r.employeeId) } },
        select: { id: true, ism: true },
      })
    : [];
  const ismXarita = new Map(yangiIsmlar.map((x) => [x.id, x.ism]));

  await runBusinessTx(businessId, async (tx) => {
    if (ochiriladigan.length) {
      await tx.dealEmployee.deleteMany({
        where: { businessId, dealId, id: { in: ochiriladigan.map((r) => r.id) } },
      });
    }
    for (const r of qoshiladigan) {
      await tx.dealEmployee.create({
        data: { businessId, dealId, categoryId: r.categoryId, employeeId: r.employeeId },
      });
    }
    if (userId) {
      const qismlar: string[] = [];
      if (ochiriladigan.length) qismlar.push(`chiqdi: ${ochiriladigan.map((r) => r.employee.ism).join(", ")}`);
      if (qoshiladigan.length) {
        qismlar.push(`qo'shildi: ${qoshiladigan.map((r) => ismXarita.get(r.employeeId) ?? "?").join(", ")}`);
      }
      await tx.activity.create({
        data: {
          businessId,
          dealId,
          contactId: deal.contactId,
          turi: "tizim",
          matn: `Zakaz jamoasi o'zgardi — ${qismlar.join("; ")}`,
          userId,
        },
      });
    }
  });

  return zakazXodimlari(businessId, dealId);
}

/**
 * SOTUVCHI → MAS'UL sinxroni: biriktiruvlar ichida "sotuvchi" turidagi
 * lavozimga tayinlangan, tizim hisobi bog'langan xodim bo'lsa — o'sha
 * foydalanuvchi qaytadi. Deal.masulId shu qiymatga o'rnatiladi, shunda
 * CRM→Kirim ko'chirilganda `Transaction.sotuvchiId` (mavjud xodim
 * statistikasi) ham AYNI sotuvchiga yoziladi — ikki tizim bir haqiqat.
 */
export async function sotuvchiUserIdTop(
  businessId: string,
  items: ZakazXodimInput[]
): Promise<string | null> {
  if (items.length === 0) return null;
  const sotuvKategoriyalar = await prisma.employeeCategory.findMany({
    where: { businessId, id: { in: items.map((i) => i.categoryId) }, turi: "sotuvchi" },
    select: { id: true },
  });
  const sotuvIdlar = new Set(sotuvKategoriyalar.map((k) => k.id));
  const sotuvchiItem = items.find((i) => sotuvIdlar.has(i.categoryId));
  if (!sotuvchiItem) return null;

  const xodim = await prisma.employee.findFirst({
    where: { id: sotuvchiItem.employeeId, businessId, deletedAt: null },
    select: { userId: true },
  });
  return xodim?.userId ?? null;
}

/**
 * MAVJUD ZAKAZ JAMOASINI O'ZGARTIRISH HUQUQI (37-talab): `crm.jamoa` bor —
 * ha; yo'q bo'lsa faqat zakaz o'zining mas'uli bo'lsa va zakaz hali
 * yakunlanmagan bo'lsa. Aks holda oddiy xodim boshqalarning biriktiruvini
 * o'zgartirib statistikani buzardi.
 */
export async function jamoaOzgartiraOladimi(params: {
  businessId: string;
  dealId: string;
  userId: string;
  huquqBor: boolean;
}): Promise<boolean> {
  if (params.huquqBor) return true;
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    select: { masulId: true, holat: true },
  });
  return Boolean(deal && deal.masulId === params.userId && deal.holat !== "YUTILDI");
}

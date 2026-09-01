import { prisma } from "@/lib/prisma";
import { ConflictError } from "@/lib/auth/guard";
import { DEFAULT_KASSA_NOMI } from "@/lib/services/accounts";
import { faoliyatByCode, faoliyatModullari } from "@/lib/biznesFaoliyati";
import { planByCode } from "@/lib/billing/plans";
import { modulByCode } from "@/lib/modules/registry";

/**
 * YANGI BIZNES YARATISH — sozlash oqimining (setup wizard) yagona manbai.
 *
 * Route emas, xizmat qatlamida: shu tufayli qoidalar (takroriy nom, majburiy
 * kassa, faoliyatdan kelib chiqadigan modullar) HTTP'siz sinovdan o'tadi
 * (tests/bizneslar.test.ts).
 *
 * YARIM BIZNES QOLMAYDI: kassa ochilmasa biznes ortga qaytariladi. Bu ikkisi
 * bitta `$transaction` da emas — `runBusinessTx` mavjud biznes id'sini talab
 * qiladi, biznes esa hali yo'q. Shu bois kompensatsiya (rollback) qo'lda.
 */
export interface BiznesKirim {
  nomi: string;
  faoliyat?: string | null;
  turi?: "umumiy" | "avto" | "optom";
  omborli?: boolean;
  magazin?: boolean;
  shaxsiyKassa?: boolean;
  kassaNomi?: string;
}

export interface YaratilganBiznes {
  id: string;
  nomi: string;
  isActive: boolean;
  turi: string;
  omborli: boolean;
  magazin: boolean;
  shaxsiyKassa: boolean;
  createdAt: Date;
}

export async function biznesYarat(
  kirim: BiznesKirim,
  opts: { tenantId: string; plan: string }
): Promise<YaratilganBiznes> {
  const { faoliyat: faoliyatKodi, kassaNomi, ...maydonlar } = kirim;
  const nomi = maydonlar.nomi.trim();
  const faoliyat = faoliyatByCode(faoliyatKodi);

  // TAKRORIY YUBORISH HIMOYASI. Wizard'da "Yaratish" ikki marta bosilishi yoki
  // tarmoq so'rovni qayta yuborishi mumkin — o'shanda ikkinchi urinish yangi
  // biznes OCHMAYDI. Nom tenant ichida takrorlanmaydi (so'rov tenant-scoped).
  const band = await prisma.business.findFirst({ where: { nomi }, select: { id: true } });
  if (band) {
    throw new ConflictError(`"${nomi}" nomli biznes allaqachon mavjud`);
  }

  // Faoliyat — BOSHLANG'ICH qiymat; ANIQ berilgan bayroq undan ustun turadi
  // (wizard'ning 2-qadamida foydalanuvchi modullarni o'zgartiradi).
  const faoliyatdan = faoliyat
    ? { turi: faoliyat.turi, omborli: faoliyat.omborli, magazin: faoliyat.magazin }
    : {};
  const belgilangan = { ...faoliyatdan, ...maydonlar, nomi };
  // Avto rejimi ombor tizimisiz ishlamaydi; kassa esa ombor ustidagi qatlam.
  const omborli = belgilangan.turi === "avto" || belgilangan.magazin === true
    ? true
    : (belgilangan.omborli ?? false);

  const business = await prisma.business.create({
    data: { ...belgilangan, omborli, tenantId: opts.tenantId },
  });

  try {
    // Har biznesda kamida bitta kassa BO'LISHI SHART, aks holda yozuv qayerga
    // tushishini ko'rsatib bo'lmaydi (signup'dagi bilan bir xil qoida).
    await prisma.account.create({
      data: {
        businessId: business.id,
        nomi: (kassaNomi ?? "").trim() || DEFAULT_KASSA_NOMI,
        turi: "naqd",
        tartib: 0,
      },
    });
  } catch (e) {
    console.error("Biznes kassasi yaratilmadi, biznes ortga qaytarildi:", e);
    await prisma.business.delete({ where: { id: business.id } }).catch(() => {});
    throw e;
  }

  // Tanlangan faoliyat uchun kerakli MODULLAR yoqiladi (tarifda bo'lsa).
  // Eng oxirida: bu qadam uzilsa ham biznes va kassa BUTUN qoladi, modullarni
  // esa Sozlamalar → Modullar dan qo'lda yoqish mumkin.
  if (faoliyat) {
    await modullarniYoq(opts.plan, faoliyatModullari(faoliyat));
  }

  return business;
}

/**
 * Berilgan modul kodlarini tenant uchun yoqadi (tarifda bo'lsa).
 *
 * Idempotent va faqat qo'shuvchi: allaqachon yoqilgan modul tegilmaydi,
 * yoqilmagan modul esa hech qachon O'CHIRILMAYDI. Tarifda yo'q modul
 * jimgina o'tkaziladi — tarif chegarasi shu yerda ham hurmat qilinadi.
 */
async function modullarniYoq(planKodi: string, kodlar: string[]): Promise<void> {
  const plan = planByCode(planKodi);
  for (const code of kodlar) {
    const modul = modulByCode(code);
    if (!modul || modul.core) continue;
    if (!plan?.modullar.includes(code)) continue;
    const bor = await prisma.tenantModule.findFirst({ where: { code }, select: { id: true, isActive: true } });
    if (bor) {
      if (!bor.isActive) {
        await prisma.tenantModule.update({ where: { id: bor.id }, data: { isActive: true } });
      }
    } else {
      await prisma.tenantModule.create({ data: { code, isActive: true } as never });
    }
  }
}

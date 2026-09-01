import { ForbiddenError, BadRequestError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { qidiruvRejimi } from "@/lib/db/dialect";
import { telNormalize } from "@/lib/validation/qarz";

/**
 * MIJOZNI ANIQLASH — qarzning YAGONA egasini topadigan bitta joy.
 *
 * NEGA KERAK: qarz uch xil yo'ldan yoziladi — Qarzlar sahifasi
 * (`services/qarz.ts`), magazin kassasi (`services/pos.ts`) va Sotuv oynasi
 * (`services/inventory.ts`). Ilgari faqat birinchisi kartochka yaratardi,
 * qolgan ikkitasi `contactId` ni bo'sh qoldirardi. Natijada bir mijoz
 * qarzga besh marta olsa, qarzdorlar ro'yxati ularni faqat ISM MATNI bo'yicha
 * jamlashga majbur bo'lardi — "Ali", "Ali " va "Ali Valiyev" uch xil qarzdor
 * bo'lib ko'rinardi. Endi uchala yo'l ham shu funksiyadan o'tadi va qarz
 * har doim bitta kartochkaga bog'lanadi.
 *
 * Qaytadigan `contactId` — `Debt.contactId` ga yoziladigan qiymat;
 * `qarzdorKalit()` (lib/queries/qarz.ts) aynan shuni birlashtirish kaliti
 * sifatida ishlatadi.
 */

export interface MijozAniqlaParams {
  businessId: string;
  userId: string;
  /** Operator ro'yxatdan tanlagan kartochka — eng ishonchli yo'l. */
  contactId?: string | null;
  mijozNomi?: string | null;
  mijozTel?: string | null;
  /**
   * Kartochka YARATILSINMI. MIJOZLAR moduli o'chirilgan bizneslarda
   * `false` — o'chirilgan modul uchun ma'lumot to'planmasin. Bunday holda
   * qarz kartochkasiz yoziladi va ism bo'yicha jamlanadi (eski xatti-harakat).
   */
  mijozSaqla?: boolean;
}

export interface MijozAniqlaNatija {
  contactId: string | null;
  ism: string;
  tel: string | null;
}

/** Ism solishtirish uchun yagona ko'rinish: chetdagi bo'shliqsiz, kichik harf. */
function ismKalit(ism: string): string {
  return ism.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Telefonni ikki qiymatga ajratadi: SOLISHTIRISH uchun normal ko'rinish va
 * SAQLASH uchun matn.
 *
 * Qarzlar sahifasidagi forma raqamni zod bilan normallashtirib yuboradi
 * (`telMaydoni`), kassa esa xom matn yuborishi mumkin. Normallashmagan
 * raqam (masalan shahar raqami) bo'yicha kartochka QIDIRILMAYDI — lekin
 * operator kiritgan matn baribir saqlanadi, aks holda ma'lumot yo'qolardi.
 */
function telAjrat(xom: string | null | undefined): { mos: string | null; saqlash: string | null } {
  const normal = telNormalize(xom);
  if (normal) return { mos: normal, saqlash: normal };
  const matn = xom?.trim();
  return { mos: null, saqlash: matn || null };
}

/**
 * Mijozni aniqlaydi. Tartib ATAYLAB shunday — yuqoridagi qadam aniqroq:
 *
 *   1. `contactId` berilgan  → o'sha kartochka (biznesga tegishliligi tekshiriladi).
 *   2. Telefon aniq mos keldi → o'sha kartochka. Telefon — eng ishonchli belgi.
 *   3. Ism bo'yicha nomzodlar → AYNAN BITTA mos kelsa o'sha; hech biri
 *      mos kelmasa yangi kartochka.
 *   4. Bir xil ismli BIR NECHTA nomzod → hech biri tanlanmaydi (`null`).
 *
 * 4-qadam ataylab "taxmin qilmaydi": ikkita haqiqiy "Ali Valiyev" bo'lsa,
 * qarzni noto'g'ri kishining kartochkasiga yozib qo'yish — ro'yxatda ikki
 * qator ko'rinishidan ancha qimmat xato. Bunday holda operator qidiruv
 * ro'yxatidan (telefoni va joriy qarzi ko'rinib turadi) o'zi tanlaydi.
 */
export async function mijozniAniqlaTx(
  tx: BusinessTx,
  params: MijozAniqlaParams
): Promise<MijozAniqlaNatija> {
  const { mos: telMos, saqlash: tel } = telAjrat(params.mijozTel);

  // ---- 1. Operator kartochkani o'zi tanlagan ----
  if (params.contactId) {
    const contact = await tx.contact.findFirst({
      where: { id: params.contactId, businessId: params.businessId, deletedAt: null },
      select: { id: true, ism: true, tel: true },
    });
    if (!contact) throw new ForbiddenError("Mijoz topilmadi");
    // Formada telefon bor, kartochkada yo'q — kartochka to'ldiriladi.
    if (tel && !contact.tel) {
      await tx.contact.updateMany({
        where: { id: contact.id, businessId: params.businessId },
        data: { tel },
      });
    }
    return { contactId: contact.id, ism: contact.ism, tel: contact.tel ?? tel };
  }

  const ism = params.mijozNomi?.trim();
  if (!ism) throw new BadRequestError("Mijoz ismi kiritilishi shart");

  // Modul o'chirilgan — kartochkasiz yoziladi (ism bo'yicha jamlanadi).
  if (!params.mijozSaqla) return { contactId: null, ism, tel };

  // ---- 2. Telefon bo'yicha aniq moslik ----
  if (telMos) {
    const mos = await tx.contact.findFirst({
      where: { businessId: params.businessId, tel: telMos, deletedAt: null },
      select: { id: true, ism: true, tel: true },
      orderBy: { createdAt: "asc" },
    });
    if (mos) return { contactId: mos.id, ism: mos.ism, tel: mos.tel };
  }

  // ---- 3. Ism bo'yicha nomzodlar ----
  // `contains` + registr rejimi ikki dialektda ham ishlaydi; aniq tenglik
  // quyida JS'da tekshiriladi (getQarzdorTafsilot bilan bir xil uslub).
  const kalit = ismKalit(ism);
  const oxshashlar = await tx.contact.findMany({
    where: {
      businessId: params.businessId,
      deletedAt: null,
      ism: { contains: ism, ...qidiruvRejimi() },
    },
    select: { id: true, ism: true, tel: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  // Telefon berilgan bo'lsa, BOSHQA telefonli bir xil ismli kartochka —
  // boshqa odam; u nomzod emas. Telefonsiz kartochka esa aynan shu mijozning
  // to'ldirilmagan kartochkasi bo'lishi mumkin.
  const nomzodlar = oxshashlar.filter(
    (c) => ismKalit(c.ism) === kalit && (!telMos || !c.tel || c.tel === telMos)
  );

  if (nomzodlar.length === 1) {
    const mos = nomzodlar[0];
    if (tel && !mos.tel) {
      await tx.contact.updateMany({
        where: { id: mos.id, businessId: params.businessId },
        data: { tel },
      });
      return { contactId: mos.id, ism: mos.ism, tel };
    }
    return { contactId: mos.id, ism: mos.ism, tel: mos.tel ?? tel };
  }

  // ---- 4. Ikkilanish: bir xil ismli bir nechta mijoz ----
  if (nomzodlar.length > 1) return { contactId: null, ism, tel };

  // ---- Yangi kartochka ----
  const yangi = await tx.contact.create({
    data: {
      businessId: params.businessId,
      ism,
      tel: tel ?? undefined,
      createdBy: params.userId,
    },
    select: { id: true },
  });
  return { contactId: yangi.id, ism, tel };
}

/**
 * "+ YANGI MIJOZ" — qarz oynasidan kartochka ochish.
 *
 * `mijozniAniqlaTx` ustidan yupqa qobiq: shu ism/telefon bilan kartochka
 * allaqachon bo'lsa YANGISI YARATILMAYDI, mavjudi qaytariladi. Ya'ni kassir
 * qidirishni o'tkazib yuborib to'g'ridan-to'g'ri "yangi mijoz" bossa ham
 * dublikat paydo bo'lmaydi.
 *
 * Ikkilanish holatida (bir xil ismli bir nechta kartochka, telefon esa
 * berilmagan) `mijozniAniqlaTx` `null` qaytaradi — u yerda taxmin qilish
 * xavfli. Bu yerda esa operator ATAYLAB yangi mijoz yaratmoqda, shuning
 * uchun yangi kartochka ochiladi.
 */
export async function qarzMijozYarat(params: {
  businessId: string;
  userId: string;
  ism: string;
  tel: string | null;
  /** Optom kartochka maydonlari (ixtiyoriy). */
  manzil?: string | null;
  masulShaxs?: string | null;
  izoh?: string | null;
}): Promise<{
  contactId: string;
  ism: string;
  tel: string | null;
  ochiqQarz: number;
  /**
   * MAVJUD kartochka qaytarildimi (yangisi yaratilmadi).
   *
   * Dublikat oldini olish JIM bo'lmasligi kerak (18-talab): operator
   * "yangi mijoz" tugmasini bosgan bo'lsa, uning o'rniga eski kartochka
   * ishlatilganini BILISHI shart — aks holda u yozgan telefon boshqa
   * odamning kartochkasiga tushib ketganini sezmaydi.
   */
  mavjud: boolean;
}> {
  return runBusinessTx(params.businessId, async (tx) => {
    const mijoz = await mijozniAniqlaTx(tx, {
      businessId: params.businessId,
      userId: params.userId,
      mijozNomi: params.ism,
      mijozTel: params.tel,
      mijozSaqla: true,
    });

    let contactId = mijoz.contactId;
    const mavjud = contactId !== null;
    if (!contactId) {
      const yangi = await tx.contact.create({
        data: {
          businessId: params.businessId,
          ism: mijoz.ism,
          tel: mijoz.tel ?? undefined,
          manzil: params.manzil?.trim() || undefined,
          masulShaxs: params.masulShaxs?.trim() || undefined,
          izoh: params.izoh?.trim() || undefined,
          createdBy: params.userId,
        },
        select: { id: true },
      });
      contactId = yangi.id;
    } else {
      // Mavjud kartochka topildi — maydonlar BO'SH bo'lsagina to'ldiriladi,
      // aks holda operatorning eski yozuvlari ustidan yozilardi.
      if (params.izoh?.trim()) {
        await tx.contact.updateMany({
          where: { id: contactId, businessId: params.businessId, izoh: null },
          data: { izoh: params.izoh.trim() },
        });
      }
      if (params.manzil?.trim()) {
        await tx.contact.updateMany({
          where: { id: contactId, businessId: params.businessId, manzil: null },
          data: { manzil: params.manzil.trim() },
        });
      }
      if (params.masulShaxs?.trim()) {
        await tx.contact.updateMany({
          where: { id: contactId, businessId: params.businessId, masulShaxs: null },
          data: { masulShaxs: params.masulShaxs.trim() },
        });
      }
    }

    // Joriy ochiq qarz — kartochka tanlangach oynada darhol ko'rsatiladi.
    // Server tomonda hisoblanadi (frontenddagi summaga ishonilmaydi).
    const jam = await tx.debt.aggregate({
      where: {
        businessId: params.businessId,
        contactId,
        turi: "olinadigan",
        isYopilgan: false,
      },
      _sum: { jamiSumma: true, tolangan: true },
    });
    const ochiqQarz = (jam._sum.jamiSumma ?? 0) - (jam._sum.tolangan ?? 0);

    return {
      contactId,
      ism: mijoz.ism,
      tel: mijoz.tel,
      ochiqQarz: ochiqQarz > 0 ? ochiqQarz : 0,
      mavjud,
    };
  });
}

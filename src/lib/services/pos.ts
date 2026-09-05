import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { createTransactionTx } from "@/lib/services/transactionService";
import { ensureCategoryTx } from "@/lib/services/inventory";
import { qarzLimitTekshirTx } from "@/lib/services/mijoz";
import { mijozniAniqlaTx } from "@/lib/services/mijozAniqla";
import { logAudit } from "@/lib/services/audit";
import { buyurtmaXabarnomasiniUrin } from "@/lib/services/mijozXabarnoma";
import { todayDateOnlyString, dateOnlyStringToUTCDate } from "@/lib/date";
import { biznesQatorQulfiSql } from "@/lib/db/dialect";

/**
 * MAGAZIN (POS) XIZMAT QATLAMI — kassadagi savat sotuvi.
 *
 * ARXITEKTURA QARORI (muhim): savatdagi HAR SATR mavjud `Sale` yozuviga
 * aylanadi, ustidan esa bitta `PosChek` turadi.
 *
 * Nega yangi "PosSale" jadvali YARATILMADI: `Sale` allaqachon marja
 * (tannarx snapshot), ombor kamayishi, mijoz kartochkasi va oylik hisobot
 * bilan bog'langan. Parallel jadval qo'shilsa, o'sha hisobotlarning har biri
 * "ikki manbadan o'qish" ga aylanardi va POS savdosi hisobotlarda ko'rinmay
 * qolish xavfi tug'ilardi.
 *
 * PUL esa CHEK darajasida: xaridor 10 ta tovarni bitta to'lovda oladi, demak
 * kassaga BITTA kirim tranzaksiya tushishi kerak (10 ta emas). Shuning uchun
 * POS satrlarida `Sale.transactionId` ATAYLAB bo'sh qoladi — pul yozuvi
 * `PosChek.transactionId` da.
 *
 * Bularning hech biri mavjud bir mahsulotli sotuvga (`createSale`) tegmaydi:
 * u `chekId = null` bilan avvalgidek ishlaydi.
 */

/** Sotuv daromadi tushadigan kategoriya — `lib/services/inventory.ts` bilan bir xil nom. */
const SOTUV_KATEGORIYA = "Sotuv";

/** POS to'lov usullari. `Transaction.tolovTuri` dan farq qiladi — pastdagi izohga qarang. */
export const POS_TOLOV_TURLARI = ["naqd", "karta", "click", "qarz"] as const;
export type PosTolovTuri = (typeof POS_TOLOV_TURLARI)[number];

/**
 * POS to'lov usulini `Transaction.tolovTuri` ga o'giradi.
 *
 * Tizimda tranzaksiya darajasida faqat uch qiymat bor: "naqd" | "click" |
 * "qarz" (lib/validation/transaction.ts). Terminal orqali olingan pul —
 * naqdsiz, ya'ni kassa qoldig'ida "click" tarafida (aynan shu qoida
 * `lib/services/qarz.ts` da ham qo'llanadi). Kassir ko'radigan aniqroq nom
 * ("karta") esa `PosChek.tolovTuri` da saqlanadi.
 */
function tranzaksiyaTolovTuri(t: PosTolovTuri): "naqd" | "click" | "qarz" {
  if (t === "naqd") return "naqd";
  if (t === "qarz") return "qarz";
  return "click";
}

export interface PosSavatSatri {
  productId: string;
  miqdor: number;
  /**
   * Kelishilgan birlik narxi. Berilmasa katalogdagi `sotuvNarx` olinadi.
   *
   * DIQQAT: bu narx katalogga QAYTA YOZILMAYDI. Ilgari (H-1) chegirma bilan
   * sotilgan bitta dona butun katalog narxini o'zgartirib yuborardi.
   */
  narx?: number | null;
}

export interface PosSotuvParams {
  businessId: string;
  satrlar: PosSavatSatri[];
  tolovTuri: PosTolovTuri;
  /** Pul tushadigan kassa (Naqd / Click / Terminal). Berilmasa standart kassa. */
  accountId?: string | null;
  contactId?: string | null;
  mijozNomi?: string | null;
  mijozTel?: string | null;
  /** Mijoz kartochkasi yaratilsinmi (MIJOZLAR moduli yoqiq bo'lgandagina). */
  mijozSaqla?: boolean;
  /** "YYYY-MM-DD". Berilmasa bugun. */
  sana?: string | null;
  userId: string;
}

/**
 * Bir productId savatda bir necha marta bo'lsa bitta satrga birlashtiradi.
 *
 * Kassada bu ODATIY holat: bir xil tovar ikki marta skanerlanadi. Birlashmasa
 * qoldiq ikki alohida shartli kamaytirish bilan tekshirilardi va "1 dona bor,
 * 2 marta skanerlandi" holatida ikkinchisi 400 xato berardi — kassir uchun
 * tushunarsiz. Endi jami miqdor bir marta tekshiriladi.
 */
function satrlarniBirlashtir(satrlar: PosSavatSatri[]): PosSavatSatri[] {
  const map = new Map<string, PosSavatSatri>();
  for (const s of satrlar) {
    const bor = map.get(s.productId);
    if (bor) {
      bor.miqdor += s.miqdor;
      // Oxirgi kiritilgan narx ustun turadi (kassir narxni tuzatgan bo'lishi mumkin).
      if (s.narx != null) bor.narx = s.narx;
    } else {
      map.set(s.productId, { productId: s.productId, miqdor: s.miqdor, narx: s.narx ?? null });
    }
  }
  return [...map.values()];
}

/**
 * Biznes ichidagi keyingi chek raqami (tranzaksiya ichida chaqiriladi).
 *
 * TO'QNASHUV NIMA UCHUN MUMKIN: SQLite/Turso yozuv tranzaksiyalarini
 * ketma-ketlashtiradi, ya'ni u yerda bu o'qish xavfsiz. PostgreSQL esa
 * READ COMMITTED bilan ishlaydi — ikki kassir bir vaqtda sotsa IKKALASI
 * ham `max = 5` ni o'qib, ikkalasi ham 6-raqamni yozmoqchi bo'ladi.
 *
 * Bu yerda RAQAMNI TO'G'RILASHGA urinilmaydi. Haqiqat manbai — bazadagi
 * `@@unique([businessId, raqam])` cheklovi: ikkinchi yozuv MAJBURAN
 * yiqiladi (P2002) va butun tranzaksiya orqaga qaytadi. Yiqilgan urinish
 * esa `posSotuv` da qaytadan boshlanadi (`chekRaqamiBilanQaytaUrin`).
 *
 * Ya'ni dublikat chek raqami bazaga JISMONAN sig'maydi — bu ilova
 * mantig'iga emas, cheklovga tayanadi.
 */
async function keyingiChekRaqami(tx: BusinessTx, businessId: string): Promise<number> {
  const oxirgi = await tx.posChek.aggregate({
    where: { businessId },
    _max: { raqam: true },
  });
  return (oxirgi._max.raqam ?? 0) + 1;
}

/** Chek raqami poygasida qancha marta qayta urinamiz. */
const QAYTA_URINISH = 5;

/**
 * Xato QAYTA URINISHGA arziydimi.
 *
 * Uch holat qamrab olinadi va ularning HAMMASIDA tranzaksiya to'liq orqaga
 * qaytgan bo'ladi (ya'ni qoldiq kamaymagan, chek yozilmagan) — shu bois
 * qaytadan urinish xavfsiz, ikki marta sotib yuborish mumkin emas:
 *
 *   P2002  — chek raqami band bo'lib qoldi (yuqoridagi poyga);
 *   P2034  — Prisma'ning o'z kodi: "write conflict yoki deadlock, qayta
 *            urinib ko'ring" (Postgres xatolarini Prisma shunga o'raydi);
 *   40001  — serialization_failure (xom Postgres kodi, o'ralmagan holat);
 *   40P01  — deadlock_detected (ikki tranzaksiya bir-birining qatorini kutdi).
 *
 * P2002 ATAYLAB tor: faqat `raqam` ustuni bo'yicha. Masalan shtrix-kod
 * to'qnashuvi ham P2002 beradi, lekin u FOYDALANUVCHI XATOSI — uni qayta
 * urinib "tuzatib" bo'lmaydi va xabar kassirga yetib borishi kerak.
 */
function qaytaUrinsaBoladimi(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const xato = e as { code?: unknown; meta?: { target?: unknown } };

  if (xato.code === "P2002") {
    const nishon = xato.meta?.target;
    const matn = Array.isArray(nishon) ? nishon.join(",") : String(nishon ?? "");
    return matn.toLowerCase().includes("raqam");
  }
  return xato.code === "P2034" || xato.code === "40001" || xato.code === "40P01";
}

/**
 * Chek raqami poygasi (yoki deadlock) bo'lsa butun tranzaksiyani qaytadan
 * boshlaydi.
 *
 * Qayta urinish TRANZAKSIYA ICHIDA emas, TASHQARISIDA bo'lishi shart:
 * PostgreSQL'da tranzaksiya ichidagi xatodan keyin seans "aborted" holatga
 * o'tadi va undan keyingi har qanday so'rov 25P02 bilan yiqiladi. Ya'ni
 * ichkarida tutib qolib davom etish mumkin emas.
 */
async function chekRaqamiBilanQaytaUrin<T>(fn: () => Promise<T>): Promise<T> {
  let oxirgi: unknown;
  for (let urinish = 0; urinish < QAYTA_URINISH; urinish++) {
    try {
      return await fn();
    } catch (e) {
      if (!qaytaUrinsaBoladimi(e)) throw e;
      oxirgi = e;
      // Qisqa, o'sib boruvchi kutish: ikki kassir bir vaqtda "yana" bosganda
      // ular darhol yana to'qnashmasin.
      await new Promise((r) => setTimeout(r, 10 * (urinish + 1)));
    }
  }
  // Bu yerga yetish — kutilmagan darajadagi bosim. Kassirga tushunarli
  // xabar beramiz, texnik P2002 ni emas.
  throw new BadRequestError(
    `Kassada bir vaqtda juda ko'p sotuv bo'lyapti — qaytadan urinib ko'ring (${String(
      (oxirgi as { code?: string })?.code ?? "?"
    )})`
  );
}

export interface PosChekNatija {
  id: string;
  raqam: number;
  jamiSumma: number;
  tolovTuri: string;
  satrlar: Array<{ nomi: string; miqdor: number; birlikNarx: number; jamiSumma: number }>;
}

/**
 * SAVAT SOTUVI — BITTA ATOMIK AMALDA:
 *   1. har satr uchun ombor qoldig'i shartli kamaytiriladi (overselling yo'q);
 *   2. `PosChek` yaratiladi (biznes ichida ketma-ket raqam bilan);
 *   3. har satr uchun `Sale` yozuvi (tannarx snapshot bilan — marja hisobi);
 *   4. naqd/karta/click → BITTA kirim tranzaksiya; qarz → BITTA qarzdorlik.
 *
 * Yarim bajarilgan holat bo'lishi mumkin emas: `runBusinessTx` uzilishda
 * hammasini orqaga qaytaradi.
 */
export async function posSotuv(params: PosSotuvParams): Promise<PosChekNatija> {
  const satrlar = satrlarniBirlashtir(params.satrlar);
  if (satrlar.length === 0) {
    throw new BadRequestError("Savat bo'sh");
  }
  for (const s of satrlar) {
    if (!Number.isInteger(s.miqdor) || s.miqdor <= 0) {
      throw new BadRequestError("Miqdor musbat butun son bo'lishi kerak");
    }
  }
  if (params.tolovTuri === "qarz" && !params.mijozNomi?.trim()) {
    throw new BadRequestError("Qarzga sotishda mijoz nomi kiritilishi shart");
  }

  const sana = params.sana ?? todayDateOnlyString();
  const sanaDate = dateOnlyStringToUTCDate(sana);

  // BUTUN TRANZAKSIYA qayta urinish ostida: chek raqami poygasi yoki
  // deadlock bo'lsa hammasi orqaga qaytadi va noldan boshlanadi.
  const natija = await chekRaqamiBilanQaytaUrin(() =>
    runBusinessTx(params.businessId, async (tx) => {
      // ---- 0. RAQAM NAVBATI ----
      // Biznes qatoriga qulf: shu biznesdagi POS sotuvlari to'qnashmaydi,
      // NAVBATGA turadi va har biri o'z chek raqamini oladi. Qulf eng boshda
      // olinadi — qulflar tartibi barcha POS tranzaksiyalarida bir xil bo'lsin
      // (deadlock xavfi tug'ilmasin). PostgreSQL'da ishlaydi; SQLite'da
      // `null` qaytadi va hech narsa o'zgarmaydi (u yozuvlarni baribir
      // ketma-ketlashtiradi).
      const qulf = biznesQatorQulfiSql(params.businessId);
      if (qulf) await tx.$queryRaw(qulf);

      // Tranzaksiya ichida xom `tx` ishlatiladi — HAR so'rovda `businessId`
      // sharti QO'LDA yoziladi (CLAUDE.md dagi kelishuv).
      const products = await tx.product.findMany({
        where: {
          id: { in: satrlar.map((s) => s.productId) },
          businessId: params.businessId,
          isActive: true,
        },
        select: { id: true, nomi: true, sotuvNarx: true, kelganNarx: true, birlik: true },
      });
      const pMap = new Map(products.map((p) => [p.id, p]));

      // Narxlar avval hisoblanadi: qarz limiti omborga TEGMASDAN oldin
      // tekshirilishi kerak.
      const hisob = satrlar.map((s) => {
        const p = pMap.get(s.productId);
        if (!p) throw new ForbiddenError("Mahsulot topilmadi");
        const kelishilgan = s.narx != null && s.narx > 0 ? Math.round(s.narx) : null;
        const birlikNarx = kelishilgan ?? p.sotuvNarx;
        if (birlikNarx <= 0) {
          throw new BadRequestError(`"${p.nomi}" uchun sotuv narxi kiritilmagan`);
        }
        return {
          product: p,
          miqdor: s.miqdor,
          birlikNarx,
          tannarx: p.kelganNarx,
          jamiSumma: birlikNarx * s.miqdor,
        };
      });

      const jamiSumma = hisob.reduce((a, h) => a + h.jamiSumma, 0);

      // QATOR QULFLARI BIR XIL TARTIBDA OLINADI — deadlock'ning oldini oladi.
      //
      // Ikki kassir bir vaqtda sotayotgan bo'lsin: A savati [non, sut], B
      // savati [sut, non]. Har `updateMany` o'sha qatorga qulf qo'yadi. Tartib
      // har xil bo'lsa A "sut"ni, B "non"ni kutib qoladi — PostgreSQL kutish
      // halqasini sezib ulardan birini 40P01 (deadlock) bilan uzadi.
      //
      // productId bo'yicha saralash bilan HAR tranzaksiya qulflarni bir xil
      // ketma-ketlikda oladi, ya'ni halqa umuman tuzilmaydi. SQLite'da bu
      // zararsiz: u yozuvlarni baribir ketma-ketlashtiradi.
      hisob.sort((a, b) => (a.product.id < b.product.id ? -1 : a.product.id > b.product.id ? 1 : 0));

      // MIJOZ — qarzga sotuvda kartochka MAJBURAN aniqlanadi (yoki yaratiladi).
      // Ilgari bu yerda faqat `params.contactId` ishlatilardi va kassir ismni
      // qo'lda yozganda qarz kartochkasiz qolardi — bir mijozning har bir
      // qarzi alohida qarzdor bo'lib ko'rinardi (lib/services/mijozAniqla.ts).
      // Naqd/karta/click sotuvda kartochka YARATILMAYDI: har o'tkinchi xaridor
      // uchun kartochka ochish mijozlar ro'yxatini axlatga to'ldirardi.
      const mijoz =
        params.tolovTuri === "qarz"
          ? await mijozniAniqlaTx(tx, {
              businessId: params.businessId,
              userId: params.userId,
              contactId: params.contactId,
              mijozNomi: params.mijozNomi,
              mijozTel: params.mijozTel,
              mijozSaqla: params.mijozSaqla,
            })
          : {
              contactId: params.contactId ?? null,
              ism: params.mijozNomi?.trim() || null,
              tel: params.mijozTel?.trim() || null,
            };

      if (params.tolovTuri === "qarz" && mijoz.contactId) {
        await qarzLimitTekshirTx(tx, params.businessId, mijoz.contactId, jamiSumma);
      }

      // ---- Ombor: shartli atomik kamaytirish (parallel kassalar himoyasi) ----
      // `updateMany` filtriga `miqdor >= n` sharti kiradi, ya'ni yetarli qoldiq
      // bo'lmasa `count = 0` qaytadi va bironta qator o'zgarmaydi. Ikki kassir
      // bir vaqtda oxirgi donani sotsa faqat bittasi o'tadi.
      for (const h of hisob) {
        const upd = await tx.product.updateMany({
          where: { id: h.product.id, businessId: params.businessId, miqdor: { gte: h.miqdor } },
          data: { miqdor: { decrement: h.miqdor } },
        });
        if (upd.count === 0) {
          throw new BadRequestError(`"${h.product.nomi}" omborda yetarli emas`);
        }
      }

      const raqam = await keyingiChekRaqami(tx, params.businessId);
      const chek = await tx.posChek.create({
        data: {
          businessId: params.businessId,
          raqam,
          jamiSumma,
          tolovTuri: params.tolovTuri,
          contactId: mijoz.contactId ?? undefined,
          mijozNomi: mijoz.ism ?? undefined,
          mijozTel: mijoz.tel ?? undefined,
          userId: params.userId,
          sana: sanaDate,
        },
        select: { id: true, raqam: true },
      });

      for (const h of hisob) {
        await tx.sale.create({
          data: {
            businessId: params.businessId,
            productId: h.product.id,
            miqdor: h.miqdor,
            birlikNarx: h.birlikNarx,
            tannarx: h.tannarx,
            jamiSumma: h.jamiSumma,
            // Satr darajasidagi to'lov turi chek bilan bir xil bo'lishi uchun
            // "qarz" dan boshqasi "naqd" deb yoziladi: `Sale.tolovTuri`
            // tarixan ikki qiymatli ("naqd" | "qarz") va uni kengaytirish
            // eski sotuv hisobotlarini o'zgartirib yuborardi.
            tolovTuri: params.tolovTuri === "qarz" ? "qarz" : "naqd",
            // SNAPSHOT: katalogdagi nom yoki birlik keyin o'zgarsa ham
            // mijozga yuborilgan chek o'zgarmaydi (lib/telegram/buyurtma.ts).
            mahsulotNomi: h.product.nomi,
            birlik: h.product.birlik,
            contactId: mijoz.contactId ?? undefined,
            mijozNomi: mijoz.ism ?? undefined,
            mijozTel: mijoz.tel ?? undefined,
            sana: sanaDate,
            userId: params.userId,
            chekId: chek.id,
            // `transactionId` ATAYLAB bo'sh — pul yozuvi chekda (yuqoridagi izoh).
          },
        });
      }

      // ---- To'lov ----
      if (params.tolovTuri === "qarz") {
        const debt = await tx.debt.create({
          data: {
            businessId: params.businessId,
            turi: "olinadigan",
            contactId: mijoz.contactId ?? undefined,
            mijozNomi: mijoz.ism!,
            mijozTel: mijoz.tel ?? undefined,
            jamiSumma,
            status: "OPEN",
            sana: sanaDate,
            izoh: `${chek.raqam}-chek`,
            userId: params.userId,
          },
          select: { id: true },
        });
        await tx.posChek.update({ where: { id: chek.id }, data: { debtId: debt.id } });
      } else {
        const categoryId = await ensureCategoryTx(tx, params.businessId, SOTUV_KATEGORIYA);
        const txn = await createTransactionTx(tx, params.userId, params.businessId, {
          turi: "kirim",
          categoryId,
          accountId: params.accountId ?? undefined,
          tolovTuri: tranzaksiyaTolovTuri(params.tolovTuri),
          summa: jamiSumma,
          sana,
          izoh: `${chek.raqam}-chek · ${hisob.length} ta tovar`,
        });
        await tx.posChek.update({
          where: { id: chek.id },
          data: { transactionId: txn.id, accountId: txn.accountId ?? undefined },
        });
      }

      return {
        id: chek.id,
        raqam: chek.raqam,
        jamiSumma,
        tolovTuri: params.tolovTuri,
        satrlar: hisob.map((h) => ({
          nomi: h.product.nomi,
          miqdor: h.miqdor,
          birlikNarx: h.birlikNarx,
          jamiSumma: h.jamiSumma,
        })),
      };
    })
  );

  // `runBusinessTx` xom `tx` bilan ishlaydi — extension'dagi avtomatik audit
  // u yerda ishlamaydi, shuning uchun biznes hodisasi qo'lda yoziladi.
  await logAudit({
    businessId: params.businessId,
    action: "create",
    entity: "posChek",
    entityId: natija.id,
    after: {
      raqam: natija.raqam,
      jamiSumma: natija.jamiSumma,
      tolovTuri: natija.tolovTuri,
      satrSoni: natija.satrlar.length,
    },
  });

  // MIJOZGA TELEGRAM XABARI — tranzaksiyadan TASHQARIDA va tashlamaydigan
  // o'rovchi bilan: Telegram ishlamasa ham chek saqlanib qolgan bo'ladi
  // (spec 14). Chek yozuvining O'ZI "tovar mijozga berildi" hodisasi —
  // aynan shu tranzaksiyada ombor kamaydi va pul/qarz yozildi.
  await buyurtmaXabarnomasiniUrin({
    businessId: params.businessId,
    chekId: natija.id,
    turi: "SALE_CREATED",
  });
  return natija;
}

/**
 * CHEKNI QAYTARISH (bekor qilish) — BITTA ATOMIK AMALDA:
 *   1. chek va uning barcha satrlari yumshoq o'chiriladi (tarix qoladi);
 *   2. har satr bo'yicha ombor qoldig'i QAYTARILADI;
 *   3. naqd/karta/click bo'lsa kirim tranzaksiya yumshoq o'chiriladi
 *      (kassadagi pul qaytadi);
 *   4. qarzga sotilgan bo'lsa qarz o'chiriladi — TO'LOVI BO'LMASA.
 *
 * Nega butun chek: kassada yarim chekni qaytarish pul va qoldiqni bir-biriga
 * mos kelmaydigan holatga olib keladi (chek summasi bir xil qoladi-yu, tovar
 * kamayadi). Bitta tovarni qaytarish kerak bo'lsa — chek qaytariladi va
 * qolgani qayta urib beriladi. Bu kassa dasturlarining odatiy qoidasi.
 */
export async function posChekBekor(params: {
  businessId: string;
  chekId: string;
  sabab: string;
  userId: string;
}) {
  const sabab = params.sabab.trim();
  if (!sabab) throw new BadRequestError("Qaytarish sababi yozilishi shart");

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const chek = await tx.posChek.findFirst({
      where: { id: params.chekId, businessId: params.businessId },
    });
    if (!chek) throw new ForbiddenError("Chek topilmadi");
    if (chek.deletedAt) throw new BadRequestError("Bu chek allaqachon qaytarilgan");

    if (chek.debtId) {
      const debt = await tx.debt.findFirst({
        where: { id: chek.debtId, businessId: params.businessId },
      });
      if (debt) {
        if (debt.tolangan > 0) {
          throw new BadRequestError(
            "Bu chek bo'yicha qarz to'lovi qilingan — avval to'lovlarni bekor qiling"
          );
        }
        await tx.debt.delete({ where: { id: debt.id } });
        await tx.posChek.update({ where: { id: chek.id }, data: { debtId: null } });
      }
    }

    if (chek.transactionId) {
      await tx.transaction.updateMany({
        where: { id: chek.transactionId, businessId: params.businessId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    }

    const satrlar = await tx.sale.findMany({
      where: { chekId: chek.id, businessId: params.businessId, deletedAt: null },
      select: { id: true, productId: true, miqdor: true },
    });
    for (const s of satrlar) {
      await tx.product.updateMany({
        where: { id: s.productId, businessId: params.businessId },
        data: { miqdor: { increment: s.miqdor } },
      });
    }
    await tx.sale.updateMany({
      where: { chekId: chek.id, businessId: params.businessId, deletedAt: null },
      data: { deletedAt: new Date(), cancelledBy: params.userId, cancelReason: sabab },
    });

    await tx.posChek.update({
      where: { id: chek.id },
      data: { deletedAt: new Date(), cancelledBy: params.userId, cancelReason: sabab },
    });

    return { raqam: chek.raqam, jamiSumma: chek.jamiSumma, satrSoni: satrlar.length };
  });

  await logAudit({
    businessId: params.businessId,
    action: "delete",
    entity: "posChek",
    entityId: params.chekId,
    before: natija,
    after: { sabab },
  });

  // Mijoz "❌ Xarid bekor qilindi" xabarini oladi. Qarz shu paytga kelib
  // allaqachon qaytarilgan — xabardagi "joriy qarz" reversal'dan KEYINGI
  // haqiqiy qoldiq bo'ladi (spec 10).
  await buyurtmaXabarnomasiniUrin({
    businessId: params.businessId,
    chekId: params.chekId,
    turi: "SALE_CANCELLED",
  });
  return { ok: true, ...natija };
}

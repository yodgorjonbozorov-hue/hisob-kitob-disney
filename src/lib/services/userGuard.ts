import { prisma } from "@/lib/prisma";
import { BadRequestError } from "@/lib/auth/guard";
import { isManager } from "@/lib/auth/roles";

/**
 * XODIMNI BOSHQARISHDA QULFLANIB QOLISHDAN HIMOYA.
 *
 * Ikkita alohida xavf bor va ular BOSHQA-BOSHQA:
 *
 *  1. O'ZINI O'ZI QULFLASH — direktor o'z hisobini nofaollashtiradi yoki
 *     o'zini kassirga tushiradi. Bir bosishda o'z paneliga kira olmay qoladi
 *     va uni qaytaradigan odam ham yo'q (u o'zi edi). Bu xato tuzatilmaydi:
 *     tiklash uchun boshqa boshqaruvchi kerak, u esa endi yo'q.
 *
 *  2. OXIRGI BOSHQARUVCHI — direktor BOShQA direktorni o'chiradi/nofaollashtiradi
 *     va kompaniyada bitta ham faol boshqaruvchi qolmaydi. Bu holat o'zini
 *     qulflashdan ham yomon: butun kompaniya boshqaruvsiz qoladi.
 *
 * Ikkalasi ham SERVERDA to'xtatiladi — UI tugmani yashirishi mumkin, lekin
 * yashirilgan tugma himoya emas.
 */

/** Boshqaruv rollari — bittasi ham qolmasa kompaniya boshqaruvsiz qoladi. */
const BOSHQARUV_ROLLAR = ["OWNER", "ADMIN"];

/** Guard uchun kerakli minimal holat (nishondagi xodimning BAZADAGI holati). */
export interface XodimHolati {
  id: string;
  rol: string;
  isActive: boolean;
}

/** So'rov nimani o'zgartirmoqchi. `undefined` — bu maydonga tegilmayapti. */
export interface OzgarishNiyati {
  /** Yangi TIZIM roli (maxsus rol tanlansa — uning `bazaRol` i). */
  yangiRol?: string;
  yangiFaol?: boolean;
  /** O'chirish amali — rol/holat o'zgarmasa ham boshqaruvchi yo'qoladi. */
  ochirish?: boolean;
}

/** Bu o'zgarish nishondan boshqaruv huquqini OLIB TASHLAYDIMI. */
function boshqaruvYoqoladi(niyat: OzgarishNiyati): boolean {
  if (niyat.ochirish) return true;
  if (niyat.yangiFaol === false) return true;
  return niyat.yangiRol !== undefined && !isManager(niyat.yangiRol);
}

/**
 * O'ZINI O'ZI QULFLASHDAN HIMOYA.
 *
 * Faqat nishon = amalni bajarayotgan odamning o'zi bo'lganda ishlaydi.
 * Ismini o'zgartirish, login/parol yangilash — bemalol; taqiqlanadigani
 * o'zini nofaollashtirish va o'zidan boshqaruv rolini olib tashlash.
 */
export function ozingniQulflama(aktorId: string, nishon: XodimHolati, niyat: OzgarishNiyati): void {
  if (aktorId !== nishon.id) return;
  if (niyat.ochirish) {
    throw new BadRequestError("O'zingizni o'chira olmaysiz");
  }
  if (niyat.yangiFaol === false) {
    throw new BadRequestError("O'zingizni nofaollashtira olmaysiz — tizimga kira olmay qolasiz");
  }
  if (niyat.yangiRol !== undefined && !isManager(niyat.yangiRol)) {
    throw new BadRequestError(
      "O'zingizdan boshqaruv huquqini olib tashlay olmaysiz — buni boshqa direktor bajarsin"
    );
  }
}

/**
 * OXIRGI BOSHQARUVCHI HIMOYASI.
 *
 * Nishon hozir FAOL boshqaruvchi bo'lsa va o'zgarish undan boshqaruvni olib
 * tashlasa — kompaniyada boshqa faol boshqaruvchi borligi tekshiriladi.
 *
 * So'rov tenant-scoped client bilan bajariladi, ya'ni hisob AYNAN shu
 * kompaniya ichida yuritiladi (lib/db/tenantDb.ts `count` ga `tenantId`
 * qo'shadi) — boshqa mijozning direktori bu yerda hisobga olinmaydi.
 */
export async function oxirgiBoshqaruvchiTekshir(
  nishon: XodimHolati,
  niyat: OzgarishNiyati
): Promise<void> {
  if (!isManager(nishon.rol) || !nishon.isActive) return;
  if (!boshqaruvYoqoladi(niyat)) return;

  const qolgan = await prisma.user.count({
    where: { isActive: true, rol: { in: BOSHQARUV_ROLLAR }, id: { not: nishon.id } },
  });
  if (qolgan === 0) {
    throw new BadRequestError(
      "Bu kompaniyadagi yagona direktor — uni o'chirib yoki nofaollashtirib bo'lmaydi. " +
        "Avval boshqa xodimga direktor rolini bering."
    );
  }
}

/** Ikkala himoyani ketma-ket qo'llaydi (route'lar shuni chaqiradi). */
export async function xodimHimoyasi(
  aktorId: string,
  nishon: XodimHolati,
  niyat: OzgarishNiyati
): Promise<void> {
  ozingniQulflama(aktorId, nishon, niyat);
  await oxirgiBoshqaruvchiTekshir(nishon, niyat);
}

import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { isManager, normalizeRol } from "@/lib/auth/roles";
import { logAudit } from "@/lib/services/audit";

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

/**
 * KOMPANIYA EGASI. `ADMIN` unga TENG EMAS.
 *
 * Ilgari ikkalasi ham shunchaki "boshqaruvchi" edi va bu eskalatsiya yo'lini
 * ochib qo'yardi: administrator o'ziga OWNER berib, egani nofaollashtirib,
 * uning parolini almashtirib kompaniyani egallay olardi. Endi OWNER darajasi
 * alohida qo'riqlanadi (`egalikniQoriqla`).
 */
export const EGA_ROL = "OWNER";

/**
 * Bazadagi EGA qiymatlari. `"admin"` — migratsiyagacha yozilgan eski qiymat;
 * `normalizeRol` uni OWNER deb o'qiydi, shuning uchun sanoqda ham hisobga
 * olinadi (aks holda eski hisobli kompaniyada "oxirgi ega" noto'g'ri
 * hisoblanardi).
 */
const EGA_ROLLAR = ["OWNER", "admin"];

/** Rol kompaniya egasinikimi (eski qiymatlar ham to'g'ri o'qiladi). */
export function egami(rol: string | null | undefined): boolean {
  return !!rol && normalizeRol(rol) === EGA_ROL;
}

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

/** So'rovni bajarayotgan odam. */
export interface Aktor {
  userId: string;
  rol: string;
}

/** Egalik darajasiga tegadigan o'zgarish. */
export interface EgalikNiyati {
  /** Yangi TIZIM roli (maxsus rol tanlansa — uning `bazaRol` i). Tegilmasa undefined. */
  yangiRol?: string;
  /** Nishon xodimning BAZADAGI holati; `null`/berilmagan — yangi xodim yaratilmoqda. */
  nishon?: XodimHolati | null;
}

/**
 * EGALIK DARAJASI HIMOYASI — huquq oshirishning (privilege escalation) oldini oladi.
 *
 * Uchta qoida, uchalasi ham SERVERDA (UI tugmani yashirishi mumkin, lekin
 * yashirilgan tugma himoya emas):
 *
 *  1. OWNER rolini FAQAT OWNER bera oladi — administrator o'ziga yoki boshqaga
 *     ega darajasini yoza olmaydi (maxsus rolning `bazaRol` i orqali ham:
 *     route effektiv rolni shu yerga uzatadi).
 *  2. OWNER hisobiga FAQAT OWNER tegadi — parol, login, rol, faol/nofaol,
 *     biznesga biriktirish va o'chirish, hammasi. Aks holda administrator
 *     eganing parolini almashtirib uning nomidan kirardi.
 *  3. Hech kim O'Z rolini o'zi o'zgartira olmaydi — eskalatsiyaning eng qisqa
 *     yo'li shu edi. Rolni boshqa (yuqori darajali) odam beradi.
 *
 * SUPERADMIN bu qoidalarga tushmaydi: u tenant ichidagi route'larga umuman
 * kirmaydi (`withSuperadmin` alohida panel — lib/auth/superadmin.ts).
 */
export function egalikniQoriqla(aktor: Aktor, niyat: EgalikNiyati): void {
  const aktorEga = egami(aktor.rol);
  const nishon = niyat.nishon ?? null;
  const yangiRol = niyat.yangiRol === undefined ? undefined : normalizeRol(niyat.yangiRol);

  if (yangiRol === EGA_ROL && !aktorEga) {
    throw new ForbiddenError("Direktor (OWNER) rolini faqat direktorning o'zi bera oladi");
  }

  if (nishon && egami(nishon.rol) && !aktorEga) {
    throw new ForbiddenError("Direktor hisobini faqat boshqa direktor o'zgartira oladi");
  }

  if (
    nishon &&
    nishon.id === aktor.userId &&
    yangiRol !== undefined &&
    yangiRol !== normalizeRol(nishon.rol)
  ) {
    throw new ForbiddenError(
      "O'z rolingizni o'zingiz o'zgartira olmaysiz — buni boshqa direktor bajarsin"
    );
  }
}

/**
 * `egalikniQoriqla` + RAD ETILGAN URINISHNI AUDITGA YOZISH.
 *
 * Muvaffaqiyatli o'zgarishni extension o'zi yozadi (lib/db/tenantDb.ts), lekin
 * TO'XTATILGAN urinish hech qayerda iz qoldirmasdi — aynan u esa hujum belgisi.
 * Route'lar shu o'ramni chaqiradi.
 */
export async function egalikTekshir(
  aktor: Aktor,
  niyat: EgalikNiyati,
  entityId: string
): Promise<void> {
  try {
    egalikniQoriqla(aktor, niyat);
  } catch (xato) {
    if (xato instanceof ForbiddenError) {
      await logAudit({
        action: "update",
        entity: "user",
        entityId,
        after: {
          radEtildi: "EGALIK_ESKALATSIYASI",
          sabab: xato.message,
          aktorId: aktor.userId,
          aktorRol: aktor.rol,
          soralganRol: niyat.yangiRol ?? null,
          nishonRol: niyat.nishon?.rol ?? null,
        },
      });
    }
    throw xato;
  }
}

/** Bu o'zgarish nishondan EGALIKNI olib tashlaydimi (ADMIN'ga tushirish ham shunday). */
function egalikYoqoladi(niyat: OzgarishNiyati): boolean {
  if (niyat.ochirish) return true;
  if (niyat.yangiFaol === false) return true;
  return niyat.yangiRol !== undefined && !egami(niyat.yangiRol);
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

  // EGA ALOHIDA SANALADI: kompaniyada kamida bitta FAOL direktor (OWNER)
  // qolishi shart. Administratorlar bu hisobga KIRMAYDI — aks holda yagona
  // egani ADMIN darajasiga tushirib (yoki nofaollashtirib) kompaniyani
  // egasiz qoldirish mumkin edi, chunki eski tekshiruv "boshqaruvchi qoldimi"
  // degan savolga administrator bilan ham "ha" deb javob berardi.
  if (egami(nishon.rol) && egalikYoqoladi(niyat)) {
    const qolganEga = await prisma.user.count({
      where: { isActive: true, rol: { in: EGA_ROLLAR }, id: { not: nishon.id } },
    });
    if (qolganEga === 0) {
      throw new BadRequestError(
        "Bu kompaniyadagi yagona direktor — uni o'chirib, nofaollashtirib yoki " +
          "administratorga tushirib bo'lmaydi. Avval boshqa xodimga direktor rolini bering."
      );
    }
  }

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

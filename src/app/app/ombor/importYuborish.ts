/**
 * KATALOG IMPORTI — tarmoq qatlami.
 *
 * Modal (ImportModal) faqat ko'rinishga javob beradi; fayl yuborish, muddat
 * nazorati va xato matnlari shu yerda. Muddat (timeout) muhim: ilgari server
 * javob bermay qolsa foydalanuvchi "yuklanmoqda"da abadiy qolib ketardi.
 */

export interface XatoQator {
  qator: number;
  xato: string;
  matn: string;
}

export interface NamunaQator {
  qator: number;
  nomi: string;
  sku: string | null;
  barcode: string | null;
  kategoriya: string | null;
  sotuvNarx?: number | null;
  miqdor?: number | null;
}

export interface Tekshiruv {
  jami: number;
  ustunlar: string[];
  xatolar: XatoQator[];
  namuna: NamunaQator[];
  maxQator: number;
  narxsiz: number;
  qoldiqsiz: number;
  /** Rasm havolasi bor qatorlar soni. */
  rasmli: number;
}

export interface Natija {
  qoshildi: number;
  yangilandi: number;
  otkazildi: number;
  qoldiqTogrilandi: number;
  xatolar: XatoQator[];
}

/**
 * Bir so'rovga beriladigan maksimal vaqt. Sog'lom katalog (500 qatorgacha)
 * bir necha soniyada tekshiriladi; bir daqiqadan oshgani — server qotib
 * qolgani, kutishda ma'no yo'q.
 */
const MUDDAT = 60_000;

/**
 * Fayl hajmi chegarasi — server bilan bir xil (10 MB).
 *
 * Tekshiruv aynan KLIENTDA ham turadi, chunki katta fayl (masalan 180 MB)
 * avval to'liq tarmoqqa yuklanib bo'lishi kerak edi — sekin internetda bu
 * o'zi o'nlab daqiqa "yuklanmoqda" degani. Endi javob bir zumda chiqadi.
 */
export const MAKS_FAYL_HAJM = 10 * 1024 * 1024;

export type YuborishJavobi<T> = { ok: true; data: T } | { ok: false; xabar: string };

/** Fayl yuborish yo'li — kichik CSV/XLSX fayllar serverda tahlil qilinadi. */
export async function importYubor<T>(
  fayl: File,
  rejim: "qoshish" | "yangilash",
  tekshirish: boolean
): Promise<YuborishJavobi<T>> {
  if (fayl.size > MAKS_FAYL_HAJM) {
    const mb = Math.round(fayl.size / (1024 * 1024));
    return {
      ok: false,
      xabar:
        `Fayl ${mb} MB — 10 MB chegarasidan katta, yuborilmadi. ` +
        "Katalog uchun rasm va formatlar kerak emas: faylni Excel'da " +
        "\"CSV UTF-8\" sifatida saqlang (hajmi keskin kichrayadi) yoki faqat " +
        "kerakli ustunlarni 500 qatordan bo'lib yuklang.",
    };
  }

  const form = new FormData();
  form.append("fayl", fayl);
  form.append("rejim", rejim);
  if (tekshirish) form.append("tekshirish", "true");
  return soraldi<T>(form);
}

/**
 * Tayyor CSV matn yo'li — katta Excel brauzerda o'qilganda ishlatiladi:
 * serverga fayl emas, undan ajratilgan yengil matn boradi.
 */
export async function csvImportYubor<T>(
  csv: string,
  rejim: "qoshish" | "yangilash",
  tekshirish: boolean
): Promise<YuborishJavobi<T>> {
  return soraldi<T>(JSON.stringify({ csv, rejim, tekshirish: tekshirish || undefined }), {
    "content-type": "application/json",
  });
}

async function soraldi<T>(body: BodyInit, headers?: HeadersInit): Promise<YuborishJavobi<T>> {
  const boshqaruv = new AbortController();
  const taymer = setTimeout(() => boshqaruv.abort(), MUDDAT);
  try {
    const res = await fetch("/api/products/import", {
      method: "POST",
      body,
      headers,
      signal: boshqaruv.signal,
    });
    // Proksi/server JSON bo'lmagan javob qaytarishi mumkin — u ham xato emas,
    // faqat xabari umumiyroq bo'ladi.
    let data: Record<string, unknown> = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok) {
      const xabar =
        typeof data.error === "string" && data.error
          ? data.error
          : `Server xatosi (${res.status}) — birozdan keyin qayta urinib ko'ring`;
      return { ok: false, xabar };
    }
    return { ok: true, data: data as T };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return {
        ok: false,
        xabar:
          "Fayl bir daqiqada qayta ishlanmadi — fayl juda katta bo'lishi mumkin. " +
          "Bir martada 500 tagacha tovar yuklanadi; faylni bo'lib yuklab ko'ring.",
      };
    }
    return { ok: false, xabar: "Serverga ulanib bo'lmadi — internet aloqasini tekshiring" };
  } finally {
    clearTimeout(taymer);
  }
}

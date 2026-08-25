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

export type YuborishJavobi<T> = { ok: true; data: T } | { ok: false; xabar: string };

export async function importYubor<T>(
  fayl: File,
  rejim: "qoshish" | "yangilash",
  tekshirish: boolean
): Promise<YuborishJavobi<T>> {
  const form = new FormData();
  form.append("fayl", fayl);
  form.append("rejim", rejim);
  if (tekshirish) form.append("tekshirish", "true");

  const boshqaruv = new AbortController();
  const taymer = setTimeout(() => boshqaruv.abort(), MUDDAT);
  try {
    const res = await fetch("/api/products/import", {
      method: "POST",
      body: form,
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

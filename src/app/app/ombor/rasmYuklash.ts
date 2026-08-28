import type { TopilganRasm } from "./xlsxBrauzer";
import { rasmniSiqish } from "./rasmSiqish";

/**
 * EXCELDAN AJRATILGAN RASMLARNI SAQLAGICHGA YUKLASH.
 *
 * Har rasm avval brauzerda kichraytiriladi (`rasmSiqish.ts`) va JPEG bo'lib
 * mavjud `/api/ombor/rasm` endpointiga ketadi — mahsulot kartasidagi rasm
 * yuklash bilan AYNAN bir yo'l.
 */

/** Bir vaqtda nechta rasm yuklanadi — server va tarmoqni bo'g'maslik uchun. */
const PARALLEL = 3;

export interface RasmYuklashNatijasi {
  /** Varaq qatori -> saqlagichdagi ochiq manzil. */
  urllar: Map<number, string>;
  /** Yuklanmay qolgan rasmlar soni (import baribir davom etadi). */
  yuklanmadi: number;
  /** Saqlagich umuman sozlanmagan — bitta ham rasm ketmaydi. */
  saqlagichYoq: boolean;
}

/** Saqlagich sozlanganini importdan OLDIN bilish uchun. */
export async function saqlagichHolati(): Promise<boolean> {
  try {
    const res = await fetch("/api/ombor/rasm");
    if (!res.ok) return false;
    const data = (await res.json()) as { yuklashMumkin?: boolean };
    return data.yuklashMumkin === true;
  } catch {
    return false;
  }
}

export async function rasmlarniYukla(
  rasmlar: TopilganRasm[],
  onProgress: (tayyor: number, jami: number) => void
): Promise<RasmYuklashNatijasi> {
  const natija: RasmYuklashNatijasi = { urllar: new Map(), yuklanmadi: 0, saqlagichYoq: false };
  let tayyor = 0;

  async function bittasi(r: TopilganRasm) {
    try {
      const siqilgan = await rasmniSiqish(r.blob);
      const form = new FormData();
      form.append("rasm", new File([siqilgan], `import-${r.qator}.jpg`, { type: "image/jpeg" }));
      const res = await fetch("/api/ombor/rasm", { method: "POST", body: form });
      if (res.status === 501) {
        natija.saqlagichYoq = true;
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (res.ok && data.url) natija.urllar.set(r.qator, data.url);
      else natija.yuklanmadi++;
    } catch {
      natija.yuklanmadi++;
    } finally {
      tayyor++;
      onProgress(tayyor, rasmlar.length);
    }
  }

  // Oddiy parallel nazorat: navbatdagi rasm bo'sh o'ringa kiradi.
  const navbat = [...rasmlar];
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, navbat.length) }, async () => {
      for (let r = navbat.shift(); r && !natija.saqlagichYoq; r = navbat.shift()) {
        await bittasi(r);
      }
    })
  );
  return natija;
}

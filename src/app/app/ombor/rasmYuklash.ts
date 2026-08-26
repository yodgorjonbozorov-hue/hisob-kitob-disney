import type { TopilganRasm } from "./xlsxBrauzer";

/**
 * EXCELDAN AJRATILGAN RASMLARNI SAQLAGICHGA YUKLASH.
 *
 * Har rasm avval brauzerda kichraytiriladi (kartochkada 900 px dan katta
 * rasm ma'nosiz, asl fayllar esa megabaytlab bo'ladi) va JPEG bo'lib
 * mavjud `/api/ombor/rasm` endpointiga ketadi — mahsulot kartasidagi rasm
 * yuklash bilan AYNAN bir yo'l.
 */

const MAKS_TOMONI = 900;
const JPEG_SIFAT = 0.82;
/** Bir vaqtda nechta rasm yuklanadi — server va tarmoqni bo'g'maslik uchun. */
const PARALLEL = 3;

export async function rasmniSiqish(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const masshtab = Math.min(1, MAKS_TOMONI / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * masshtab));
    const h = Math.max(1, Math.round(bitmap.height * masshtab));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas ochilmadi");
    // JPEG shaffoflikni qora qiladi — oq fon chiziladi.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Rasmni siqib bo'lmadi"))),
        "image/jpeg",
        JPEG_SIFAT
      )
    );
  } finally {
    bitmap.close();
  }
}

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

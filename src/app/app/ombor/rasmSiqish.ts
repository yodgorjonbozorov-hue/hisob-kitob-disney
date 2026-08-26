/**
 * RASMNI BRAUZERDA SIQISH — yuklashdan oldin.
 *
 * Telefon surati 3-8 MB keladi (iPhone'da HEIC bo'lishi ham mumkin).
 * Kartochkada 900 px dan katta rasm ma'nosiz, 5 MB server chegarasi esa
 * katta suratni rad etadi. Shu bois har rasm shu yerda 900 px JPEG ga
 * keltiriladi (~50-150 KB): yuklash sekin internetda ham bir zumda,
 * format muammosi ham yo'q — brauzer ochgan har qanday rasm JPEG bo'lib
 * chiqadi.
 *
 * Ikki joyda ishlatiladi: tovar kartasidagi rasm tanlash (RasmTanlash) va
 * Exceldan ommaviy rasm importi (rasmYuklash).
 */

const MAKS_TOMONI = 900;
const JPEG_SIFAT = 0.82;

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

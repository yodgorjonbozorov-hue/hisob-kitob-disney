/**
 * SOTUV RO'YXATIDAGI MAHSULOT TARTIBI.
 *
 * QOIDA: qoldig'i KO'P mahsulot tepada, kam qolgani pastroq, tugagani esa
 * eng oxirida. Sabab oddiy: kassir kun davomida eng ko'p turgan tovarni
 * sotadi, tugagani esa tanlab bo'lmaydigan qator — u ro'yxat boshida
 * turib har safar ko'zni chalg'itardi.
 *
 * Sof funksiya va ALOHIDA fayl: ayni qoida server so'rovida (`orderBy`)
 * ham, brauzerdagi qidiruv natijasida ham amal qilishi kerak. Ikki joyda
 * ikki xil tartib bo'lsa qidirgandan keyin ro'yxat "sakrab" ketardi.
 *
 * Client va server ikkalasida ishlatiladi — server-only import qo'shilmasin.
 */

export interface TartibMahsulot {
  /** Ombordagi qoldiq. Manfiy qiymat 0 kabi — "tugagan" deb qaraladi. */
  qoldiq: number;
  nomi: string;
}

/** Qoldiq tugaganmi (sotuvga qo'shib bo'lmaydi). */
export function tugaganmi(qoldiq: number): boolean {
  return qoldiq <= 0;
}

/**
 * Taqqoslash funksiyasi: qoldiq KAMAYISH tartibida, teng bo'lsa nom
 * bo'yicha (tartib BARQAROR bo'lsin — har renderda joy almashmasin).
 *
 * Tugaganlar (qoldiq <= 0) o'zaro ham nom bo'yicha tartiblanadi va
 * hammasidan keyin turadi, chunki ularning qoldig'i eng kichik.
 */
export function mahsulotTaqqosla(a: TartibMahsulot, b: TartibMahsulot): number {
  const qa = Math.max(0, a.qoldiq);
  const qb = Math.max(0, b.qoldiq);
  if (qa !== qb) return qb - qa;
  return a.nomi.localeCompare(b.nomi, "uz");
}

/** Ro'yxatni qoldiq bo'yicha tartiblaydi (asl massiv o'zgarmaydi). */
export function mahsulotlarniTartibla<T extends TartibMahsulot>(royxat: T[]): T[] {
  return [...royxat].sort(mahsulotTaqqosla);
}

/**
 * Forma maydonlari uslubi — barmoq bilan to'ldiriladigan formalar uchun
 * (kirish, ro'yxatdan o'tish, tez qo'shish).
 *
 * `text-base` (17px) ATAYLAB: iOS Safari 16px dan kichik maydonga fokus
 * tushganda sahifani avtomatik kattalashtirib yuboradi — o'shanda ilova
 * "veb-sahifa"day his qilinadi. `min-h-[44px]` — tugmalar bilan bir xil
 * bosish zonasi.
 */
export const INPUT_CLASS =
  "w-full rounded-lg border border-line bg-surface text-fg px-3 py-2.5 text-base min-h-[44px] " +
  "placeholder:text-faint transition focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand";

export const LABEL_CLASS = "block text-sm font-medium text-fg mb-1.5";

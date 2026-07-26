/**
 * Markazlashgan lug'at (REDESIGN.md 5.2). Butun loyihada (UI + Telegram + PDF)
 * bir xil so'z ishlatiladi. "Tranzaksiya" emas → "Yozuv". Amal oqim bo'ylab
 * o'zgarmaydi: Saqlash → Saqlandi.
 */
export const copy = {
  // Asosiy tushunchalar
  yozuv: "Yozuv",
  yozuvlar: "Yozuvlar",
  pulKirdi: "Pul kirdi",
  pulChiqdi: "Pul chiqdi",
  kirdi: "Kirdi",
  chiqdi: "Chiqdi",
  qoldi: "Qoldi",
  sofFoyda: "Sof foyda",
  qarzdorlik: "Qarzdorlik",

  // Amallar
  saqlash: "Saqlash",
  saqlandi: "Saqlandi",
  bekor: "Bekor qilish",
  bekorQilindi: "Bekor qilindi",
  ochir: "Ha, o'chir",
  ochirildi: "O'chirildi",
  qaytarish: "Qaytarish",
  saralash: "Saralash",
  qidirish: "Qidirish",
  qoshish: "Qo'shish",
  yangiYozuv: "Yangi yozuv",

  // Sana
  bugun: "Bugun",
  kecha: "Kecha",
  buHafta: "Bu hafta",
  buOy: "Bu oy",
  davrTanlash: "Davr tanlash",

  // Bo'sh / xato holatlar
  boshEmpty: "Bu oyda hali yozuv yo'q",
  birinchiYozuv: "Birinchi yozuvni qo'shing",
  xatoSarlavha: "Nimadir noto'g'ri ketdi",
  qaytaUrinish: "Qayta urinish",

  // Rollar
  direktor: "Direktor",
  kassir: "Kassir",
  sotuvchi: "Sotuvchi",
} as const;

export type CopyKey = keyof typeof copy;

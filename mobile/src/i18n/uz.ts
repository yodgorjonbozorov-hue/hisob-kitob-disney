// O'zbek (lotin) — asosiy til. Keyin ru/en qo'shish uchun shu kalitlar takrorlanadi.
export const uz = {
  umumiy: {
    saqlash: 'Saqlash',
    bekor: 'Bekor qilish',
    yangi: 'Yangi',
    qidirish: 'Qidirish',
    yopish: 'Yopish',
    qaytaUrinish: 'Qayta urinish',
    yuklanmoqda: 'Yuklanmoqda...',
    xato: 'Xatolik yuz berdi',
    tarmoqXato: "Internet aloqasi yo'q. Ulanishni tekshiring.",
    serverXato: 'Server xatosi. Birozdan keyin qayta urining.',
    ruxsatYoq: "Bu amal uchun ruxsatingiz yo'q",
    sessiyaTugadi: 'Sessiya tugadi — qaytadan kiring',
    bosh: "Hozircha ma'lumot yo'q",
    hammasi: 'Hammasi',
    davomEtish: 'Davom etish',
    tozalash: 'Tozalash',
    qollash: "Qo'llash",
    tayyor: 'Tayyor',
  },
  sana: {
    bugun: 'Bugun',
    kecha: 'Kecha',
    buHafta: 'Bu hafta',
    buOy: 'Bu oy',
    davr: 'Davr',
    dan: 'dan',
    gacha: 'gacha',
  },
  auth: {
    kirish: 'Kirish',
    login: 'Login yoki telefon',
    parol: 'Parol',
    chiqish: 'Chiqish',
    xushKelibsiz: 'Biznesingiz balansda',
    parolKorsat: "Parolni ko'rsatish",
    parolYashir: 'Parolni yashirish',
    majburiyParol: 'Parolni almashtirish talab qilinadi. Iltimos, veb-sayt orqali yangi parol o\'rnating.',
  },
  tab: {
    asosiy: 'Asosiy',
    kirimChiqim: 'Kirim/Chiqim',
    crm: 'CRM',
    menyu: 'Menyu',
  },
  moliya: {
    kirim: 'Kirim',
    chiqim: 'Chiqim',
    sof: 'Sof',
    kassa: 'Kassa',
    qarzdorlik: 'Qarzdorlik',
    ombor: 'Ombor',
    summa: 'Summa',
    izoh: 'Izoh',
    kategoriya: 'Kategoriya',
    tolovTuri: "To'lov turi",
    naqd: 'Naqd',
    click: 'Click',
    qarz: 'Qarz',
    plastik: 'Karta / hisob',
    som: "so'm",
  },
  qoshish: {
    sarlavha: 'Yangi amal',
    kirimQoshish: "Kirim qo'shish",
    chiqimQoshish: "Chiqim qo'shish",
    crmBuyurtma: 'CRM buyurtma',
    qarzBerish: 'Qarz berish',
    omborAmal: 'Ombor amali',
    posSotuv: 'Sotuv (POS)',
  },
} as const;

export type Lugat = typeof uz;

// Hozircha faqat o'zbekcha; t() markaziy nuqta — ru/en qo'shilganda shu yer o'zgaradi.
export function t(): Lugat {
  return uz;
}

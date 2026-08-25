import { sohaOchiq, type AiRuxsat } from "./ruxsat";

/**
 * TAYYOR SAVOLLAR VA KEYINGI QADAM CHIPLARI — AI'SIZ.
 *
 * Chiplarni model yozmaydi: bu qo'shimcha token, qo'shimcha kutish va
 * qo'shimcha "o'ylab topish" xavfi bo'lardi. Ular ruxsat va oxirgi
 * chaqirilgan tool'lardan DETERMINISTIK chiqadi.
 */

/** Bosh ekrandagi tayyor savollar — faqat mavjud modullar bo'yicha. */
export function boshSavollar(ruxsat: AiRuxsat): string[] {
  const savollar: string[] = [];
  if (sohaOchiq(ruxsat, "moliya")) {
    savollar.push("Bugun nima bo'ldi?");
    savollar.push("Bu oy qanday o'tyapti?");
  }
  if (sohaOchiq(ruxsat, "hisobot")) {
    savollar.push("Eng katta chiqimlar qaysi?");
    savollar.push("O'tgan oy bilan solishtir");
    savollar.push("Nega foyda o'zgardi?");
  }
  if (sohaOchiq(ruxsat, "qarz")) savollar.push("Kim eng ko'p qarzdor?");
  if (sohaOchiq(ruxsat, "kassa")) savollar.push("Kassalarda qancha pul bor?");
  if (sohaOchiq(ruxsat, "crm")) savollar.push("Bugun nechta buyurtma tushdi?");
  if (sohaOchiq(ruxsat, "ombor")) savollar.push("Qaysi mahsulot eng ko'p sotildi?");
  if (sohaOchiq(ruxsat, "vazifalar")) savollar.push("Muddati o'tgan vazifalar bormi?");
  if (sohaOchiq(ruxsat, "mijozlar")) savollar.push("Eng ko'p xarid qilgan mijozlar");
  return savollar.slice(0, 8);
}

/** Har tool'dan keyin mantiqiy davomi bo'ladigan savollar. */
const DAVOMI: Record<string, string[]> = {
  moliya_yakuni: ["O'tgan oy bilan solishtir", "Eng katta chiqimlar qaysi?", "Nega shunday bo'ldi?"],
  kategoriya_kesimi: ["Bu kategoriyada eng katta yozuvlar", "O'tgan davr bilan solishtir", "Kirim kesimini ko'rsat"],
  sabab_tahlili: ["Eng katta chiqimlar qaysi?", "Oxirgi 6 oy dinamikasi", "Kirim nega o'zgardi?"],
  katta_yozuvlar: ["Kategoriyalar kesimini ko'rsat", "O'tgan oy bilan solishtir"],
  oylik_trend: ["Bu oy qanday o'tyapti?", "Nega foyda o'zgardi?"],
  qarz_holati: ["Muddati o'tgan qarzlar qaysi?", "Umumiy qarz qancha?"],
  kassa_holati: ["Bugungi kirim qancha?", "Bu oy qanday o'tyapti?"],
  crm_holati: ["Nechta buyurtma yutildi?", "Qaysi xizmat ko'p pul olib keldi?"],
  vazifa_holati: ["Bugungi vazifalar qaysi?"],
  ombor_holati: ["Qaysi kategoriya ko'p sotildi?", "Ombor qiymati qancha?"],
  mijoz_holati: ["Kim eng ko'p qarzdor?"],
  bugungi_holat: ["Bu oy qanday o'tyapti?", "Eng katta chiqimlar qaysi?", "Qarzdorlik holati"],
};

/**
 * Javobdan keyingi 2-3 ta chip: oxirgi ishlatilgan tool'lardan boshlanadi,
 * ruxsatsiz sohalar bilan bog'liqlari tushib qoladi.
 */
export function keyingiTakliflar(ishlatilgan: string[], ruxsat: AiRuxsat): string[] {
  const natija: string[] = [];
  for (const tool of ishlatilgan) {
    for (const s of DAVOMI[tool] ?? []) {
      if (!natija.includes(s)) natija.push(s);
    }
  }
  const ochiq = new Set(boshSavollar(ruxsat));
  // Ruxsat filtri: taklif faqat ochiq soha savollari yoki umumiy moliya savoli bo'lsin.
  const moliyaOchiq = sohaOchiq(ruxsat, "moliya");
  const hisobotOchiq = sohaOchiq(ruxsat, "hisobot");
  const filtrlangan = natija.filter((s) => {
    if (ochiq.has(s)) return true;
    if (/qarz/i.test(s)) return sohaOchiq(ruxsat, "qarz");
    if (/kassa/i.test(s)) return sohaOchiq(ruxsat, "kassa");
    if (/buyurtma|xizmat/i.test(s)) return sohaOchiq(ruxsat, "crm");
    if (/ombor|sotil/i.test(s)) return sohaOchiq(ruxsat, "ombor");
    if (/vazifa/i.test(s)) return sohaOchiq(ruxsat, "vazifalar");
    if (/kategoriya|solishtir|dinamika|foyda|chiqim|kirim/i.test(s)) return hisobotOchiq;
    return moliyaOchiq;
  });

  if (filtrlangan.length === 0) return boshSavollar(ruxsat).slice(0, 3);
  return filtrlangan.slice(0, 3);
}

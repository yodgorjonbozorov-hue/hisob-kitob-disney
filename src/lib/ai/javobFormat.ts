/**
 * AI JAVOBINI KO'RSATISH BLOKLARIGA AJRATISH.
 *
 * Model oddiy matn yozadi — bu yerda u telefonda ham oson skanerlanadigan
 * bloklarga bo'linadi: "Kirim: 138,3 mln so'm" qatori metrik sifatida
 * (yorliq chapda, summa o'ngda, tabular raqam bilan) chiziladi.
 *
 * Sof funksiya: server ham, mijoz ham ishlatadi va test bilan qoplangan.
 */

export type JavobBlok =
  | { tur: "sarlavha"; matn: string }
  | { tur: "metrik"; yorliq: string; qiymat: string }
  | { tur: "punkt"; matn: string }
  | { tur: "matn"; matn: string };

/** "Kirim: 138,3 mln so'm" — yorliq qisqa, qiymat raqam bilan boshlanadi. */
const METRIK = /^([^:•]{2,32}):\s*([−\-+]?\d.*)$/;
/** "Avgust holati:" kabi ikki nuqta bilan tugaydigan qisqa qator. */
const SARLAVHA = /^(.{2,48}):$/;

export function javobBloklari(matn: string): JavobBlok[] {
  const bloklar: JavobBlok[] = [];
  for (const xom of matn.split("\n")) {
    const qator = xom.trim();
    if (!qator) continue;

    if (qator.startsWith("•") || qator.startsWith("-") || qator.startsWith("*")) {
      const ichi = qator.slice(1).trim();
      if (ichi) bloklar.push({ tur: "punkt", matn: ichi });
      continue;
    }

    const metrik = qator.match(METRIK);
    if (metrik) {
      bloklar.push({ tur: "metrik", yorliq: metrik[1].trim(), qiymat: metrik[2].trim() });
      continue;
    }

    const sarlavha = qator.match(SARLAVHA);
    if (sarlavha) {
      bloklar.push({ tur: "sarlavha", matn: sarlavha[1].trim() });
      continue;
    }

    bloklar.push({ tur: "matn", matn: qator });
  }
  return bloklar;
}

/**
 * HAVOLA XAVFSIZLIGI: faqat ilova ichidagi `/app/...` yo'llar ochiladi.
 *
 * Havolalarni server quradi (`lib/ai/analitika.ts`), lekin tekshiruv mijozda
 * ham takrorlanadi: model matnidan yoki eski suhbat yozuvidan tashqi manzil
 * kelib qolsa, u tugmaga aylanmaydi.
 */
export function havolaXavfsizmi(href: string): boolean {
  return /^\/app\/[a-zA-Z0-9\-_/]*(\?[a-zA-Z0-9\-_=&%.:,+]*)?$/.test(href);
}

import { Prisma } from "@prisma/client";

/**
 * BAZA DIALEKTI — SQLite va PostgreSQL orasidagi farqlarning YAGONA joyi.
 *
 * Loyiha SQLite/Turso'da boshlangan va PostgreSQL'ga ko'chmoqda. Farqlar
 * ilgari to'rt joyga sochilgan edi va provayder almashganda ularning
 * birortasini unutish jimgina noto'g'ri natija berardi (masalan `strftime`
 * Postgres'da umuman yo'q — so'rov yiqilardi, lekin `COLLATE NOCASE`
 * sintaksis xatosi bermay, shunchaki registrga sezgir bo'lib qolardi).
 *
 * Endi farqlar shu faylda. Provayder `DATABASE_URL` sxemasidan aniqlanadi,
 * chunki Prisma'ning o'z provayderi build paytida qotib qoladi va runtime'da
 * o'qib bo'lmaydi.
 */

/** `postgresql://` yoki `postgres://` — Postgres; qolgani (file:, libsql:) SQLite. */
export function isPostgres(url = process.env.DATABASE_URL): boolean {
  return /^postgres(ql)?:\/\//i.test(url ?? "");
}

/**
 * `contains` qidiruvi uchun registr rejimi.
 *
 * SQLite'da Prisma `mode: "insensitive"` ni QO'LLAB-QUVVATLAMAYDI — berilsa
 * so'rov xato beradi. Shu bois SQLite'da bo'sh obyekt qaytadi va qidiruv
 * avvalgidek registrga sezgir qoladi; Postgres'da esa registrga befarq
 * bo'ladi (funksional yaxshilanish).
 *
 * Ishlatish: `{ nomi: { contains: q, ...qidiruvRejimi() } }`
 */
export function qidiruvRejimi(): { mode?: "insensitive" } {
  return isPostgres() ? { mode: "insensitive" } : {};
}

/**
 * DateTime ustunidan "YYYY-MM" yoki "YYYY-MM-DD" kalitini oladi.
 *
 * SQLite: libsql adapteri DateTime'ni ISO MATN sifatida saqlaydi
 * ("2026-07-10T00:00:00+00:00"), lekin eski yozuvlar (yoki Prisma'ning o'z
 * SQLite konnektori) millisekund INTEGER bo'lishi mumkin — ikkala holat ham
 * qo'llab-quvvatlanadi.
 *
 * PostgreSQL: ustun haqiqiy `timestamp`, ikkilanish yo'q — bitta `to_char`.
 */
export function sanaKalitSql(column: string, uzunlik: 7 | 10): Prisma.Sql {
  const col = Prisma.raw(column);

  if (isPostgres()) {
    const fmt = uzunlik === 7 ? "YYYY-MM" : "YYYY-MM-DD";
    return Prisma.sql`to_char(${col}, ${fmt})`;
  }

  const fmt = uzunlik === 7 ? "%Y-%m" : "%Y-%m-%d";
  return Prisma.sql`CASE WHEN typeof(${col}) = 'text'
      THEN substr(${col}, 1, ${uzunlik})
      ELSE strftime(${fmt}, ${col} / 1000, 'unixepoch') END`;
}

/**
 * Registrga BEFARQ tenglik sharti (login qidiruvi uchun).
 *
 * SQLite: `COLLATE NOCASE` — faqat ASCII uchun ishlaydi, lekin loginlar
 * telefon raqami yoki lotin harflar bo'lgani uchun yetarli.
 * PostgreSQL: `LOWER()` — migratsiyada shu ifoda uchun funksional indeks bor,
 * shuning uchun `WHERE LOWER(...)` indeksdan foydalanadi.
 */
export function registrsizTeng(column: string, qiymat: string): Prisma.Sql {
  const col = Prisma.raw(column);
  return isPostgres()
    ? Prisma.sql`LOWER(${col}) = LOWER(${qiymat})`
    : Prisma.sql`${col} = ${qiymat} COLLATE NOCASE`;
}

/**
 * BIZNES QATORINI QULFLASH — ketma-ket raqam ajratish uchun.
 *
 * Muammo: POS cheki raqami `max(raqam) + 1` bilan olinadi. PostgreSQL
 * READ COMMITTED bilan ishlagani uchun bir vaqtda kelgan N ta sotuv
 * BIR XIL `max` ni o'qiydi va faqat bittasi yoziladi; qolgani unique
 * cheklovga urilib qayta urinishga tushadi. 20 kassirda bu "podaning
 * bir joyga yugurishi" ga aylanadi: har qayta urinishda yana bittasi
 * o'tadi, qolgani yana yiqiladi (haqiqiy o'lchov: 20 tadan 10 tasi
 * 5 urinishdan keyin ham yiqilgan).
 *
 * Yechim: raqam olishdan OLDIN biznes qatoriga qulf qo'yiladi. Shunda
 * tranzaksiyalar TO'QNASHMAYDI, NAVBATGA turadi — har biri o'z raqamini
 * oladi va qayta urinish umuman kerak bo'lmaydi.
 *
 * SQLite/Turso'da `FOR UPDATE` yo'q va KERAK EMAS: u yozuv tranzaksiyalarini
 * baribir ketma-ketlashtiradi. Shu bois `null` qaytadi va chaqiruvchi
 * qulfsiz davom etadi (mavjud xatti-harakat o'zgarmaydi).
 *
 * Qulf tranzaksiya oxirigacha ushlanadi — chaqiruvchi uni tranzaksiyaning
 * BOSHIDA olishi kerak, aks holda qulflar tartibi buzilib deadlock xavfi
 * paydo bo'ladi.
 */
export function biznesQatorQulfiSql(businessId: string): Prisma.Sql | null {
  if (!isPostgres()) return null;
  return Prisma.sql`SELECT "id" FROM "Business" WHERE "id" = ${businessId} FOR UPDATE`;
}

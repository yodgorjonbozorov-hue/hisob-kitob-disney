/**
 * DEPLOY OLDIDAN ZAXIRA — build zanjirining birinchi halqasi.
 *
 * MUAMMO: `npm run build` ichida `db-migrate.mjs` turadi, ya'ni har deploy
 * bazaga migratsiya qo'llashi mumkin. Lekin deploy ZAXIRA OLMAYDI — migratsiya
 * ma'lumotni buzsa, orqaga qaytish yo'li yo'q. GitHub Actions'dagi
 * `migratsiya.yml` bu muammoni hal qiladi, biroq u alohida sozlangan sekretlar
 * talab qiladi va qo'lda ishga tushiriladi.
 *
 * YECHIM: aynan shu tekshiruvni deploy'ning o'ziga kiritish. Ilova baza bilan
 * ishlaydi, demak build muhitida ulanish allaqachon bor — qo'shimcha sozlash
 * kerak emas.
 *
 * MANTIQ:
 *   1. `DATABASE_URL` yo'q         -> o'tadi (env'siz lokal build).
 *   2. Baza butunlay bo'sh         -> o'tadi (yangi muhitni ko'tarish).
 *   3. Kutayotgan migratsiya yo'q  -> hech narsa qilinmaydi (oddiy deploy tez).
 *   4. Hisobot bazaga mos emas     -> TO'XTAYDI (yarim qo'llanishning oldi olinadi).
 *   5. Kutayotgan migratsiya bor   -> xom surat olinadi va Telegram zaxira
 *      kanaliga yuboriladi. Yuborilmasa — build TO'XTAYDI.
 *
 * Ya'ni: zaxirasiz migratsiya qo'llanmaydi. Bu ataylab qattiq qoida —
 * "zaxira olinmadi, lekin davom etaveraman" degan yo'l aynan ma'lumot
 * yo'qoladigan yo'l.
 *
 * Ataylab chetlab o'tish: ZAXIRASIZ_DAVOM=ha (faqat bilib turib).
 */
import "dotenv/config";
import { gzipSync } from "node:zlib";
import {
  klient,
  suratOl,
  jamiYozuv,
  kutayotganMigratsiyalar,
  ilovaJadvallari,
  hisobotSoni,
} from "./lib/xom-surat.mjs";
import { hujjatYubor } from "./lib/telegram.mjs";
import { KALIT_ENV, kalitBormi } from "../src/lib/backup/shifr-asos.cjs";

/** Build'ni to'xtatadi. `qoshimcha` — oxirida ko'rsatiladigan qo'shimcha satr. */
function yiqit(sarlavha, satrlar, qoshimcha) {
  console.error(`\n❌ ${sarlavha}\n`);
  for (const s of satrlar) console.error(`   ${s}`);
  console.error("\n   Baza O'ZGARTIRILMADI — migratsiya umuman ishga tushmadi.");
  if (qoshimcha) console.error(`   ${qoshimcha}`);
  console.error("");
  process.exit(1);
}

/**
 * Zaxira ta'minlanmadi. Standart holatda build shu yerda to'xtaydi.
 *
 * Chetlab o'tish TEKSHIRUVI shu yagona joyda — sababi qanday bo'lishidan
 * qat'i nazar (kanal yo'q, yuborish yiqildi, bazaga ulanib bo'lmadi) qaror
 * bitta: zaxirasiz migratsiya qilinmaydi.
 */
function toxta(sarlavha, satrlar) {
  if (process.env.ZAXIRASIZ_DAVOM === "ha") {
    console.warn(`\n⚠️  ${sarlavha}: ${satrlar[0]}`);
    console.warn("   ZAXIRASIZ_DAVOM=ha — zaxirasiz davom etilmoqda.\n");
    process.exit(0);
  }

  yiqit(sarlavha, satrlar, "Bilib turib zaxirasiz davom etish uchun: ZAXIRASIZ_DAVOM=ha");
}

async function main() {
  // Env'siz lokal build (masalan `npm run build` toza mashinada) — migratsiya
  // ham o'tkazib yuboriladi, demak himoya qiladigan narsa yo'q.
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL yo'q — deploy zaxirasi o'tkazib yuborildi.");
    return;
  }

  const c = klient();

  // Butunlay bo'sh baza — yangi muhitni birinchi marta ko'tarish. Himoya
  // qiladigan ma'lumot yo'q, demak zaxira ham talab qilinmaydi (aks holda
  // yangi muhit Telegram sozlanmaguncha umuman ko'tarilmasdi).
  const jadvallar = await ilovaJadvallari(c);
  if (jadvallar.length === 0) {
    console.log("Baza bo'sh — zaxira qiladigan narsa yo'q.");
    return;
  }

  const kutayotgan = await kutayotganMigratsiyalar(c);

  if (kutayotgan.length === 0) {
    console.log("Kutayotgan migratsiya yo'q — zaxira shart emas.");
    return;
  }

  // Jadvallar bor, lekin hisobot bo'sh: baza boshqa yo'l bilan qurilgan
  // (`prisma migrate deploy`, `db push`, qo'lda SQL). `db-migrate.mjs` bunday
  // holatda hammasini boshidan qo'llashga urinadi va "table already exists"
  // bilan O'RTADA yiqiladi — natijada yarim qo'llangan baza qoladi.
  // Shuning uchun bu yerda, hech narsa qilinmasdan oldin to'xtaymiz.
  //
  // Bu YAGONA to'xtash — u ZAXIRASIZ_DAVOM bilan chetlab o'tilmaydi: bu yerda
  // masala zaxirada emas, migratsiyaning o'zi buzuq holatda ishga tushishida.
  if ((await hisobotSoni(c)) === 0) {
    yiqit("Migratsiya hisoboti baza holatiga mos kelmaydi", [
      `Bazada ${jadvallar.length} ta jadval bor, lekin hisobot bo'sh.`,
      "Shu holatda migratsiya o'rtada yiqilib, yarim qo'llangan baza qoladi.",
      "",
      "Yechim — qaysi migratsiyalar allaqachon qo'llanganini belgilash:",
      "  npm run migratsiya:belgila -- --royxat",
      "  npm run migratsiya:belgila -- <oxirgi-qo'llangan> --tasdiq",
    ]);
  }

  console.log(`\n${kutayotgan.length} ta migratsiya kutmoqda:`);
  for (const d of kutayotgan) console.log(`   · ${d}`);
  console.log("\nMigratsiyadan OLDIN zaxira olinmoqda...");

  const surat = await suratOl(c);
  const yozuvlar = jamiYozuv(surat);
  const bayt = gzipSync(Buffer.from(JSON.stringify(surat)));

  console.log(
    `   ${Object.keys(surat.jadvallar).length} jadval, ${yozuvlar} yozuv, ` +
      `${(bayt.byteLength / 1024).toFixed(0)} KB`
  );

  const chatId = process.env.BACKUP_CHAT_ID;
  // `||`, `??` emas: hosting panellarida o'zgaruvchi ko'pincha BO'SH QATOR
  // bo'lib qoladi, `??` esa faqat undefined'da keyingisiga o'tadi — natijada
  // asosiy bot tokeni turgan bo'lsa ham build bekorga yiqilardi.
  const token = process.env.BACKUP_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

  // Surat build konteynerida qoladi, konteyner esa deploy tugashi bilan
  // yo'qoladi. Shuning uchun "olindi" degani yetarli emas — u serverdan
  // TASHQARIGA chiqishi shart.
  if (!chatId || !token) {
    toxta("Zaxirani saqlaydigan joy yo'q", [
      "Surat olindi, lekin uni yuboradigan kanal sozlanmagan.",
      "Kerak: BACKUP_CHAT_ID va BACKUP_BOT_TOKEN (yoki TELEGRAM_BOT_TOKEN).",
    ]);
  }

  // Surat butun bazani o'z ichiga oladi (parol hashlari ham) — kanalga OCHIQ
  // chiqmasligi kerak (audit: Critical #2). Yuborishning o'zi ham shifrsiz
  // ishlamaydi (`lib/telegram.mjs`); bu yerdagi tekshiruv sababni aniq aytish
  // uchun. Kalitsiz zaxira yo'q, zaxirasiz esa migratsiya yo'q.
  if (!kalitBormi()) {
    toxta("Zaxirani shifrlab bo'lmaydi", [
      `${KALIT_ENV} sozlanmagan yoki yaroqsiz (32 bayt kerak: hex yoki base64).`,
      "Shifrlanmagan zaxira Telegramga YUBORILMAYDI — butun baza ochiq ketardi.",
      "",
      "Kalit yaratish:",
      `  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
      "Keyin uni hosting env'iga qo'ying va ZAXIRADAN ALOHIDA saqlang.",
    ]);
  }

  const sana = surat.olingan.slice(0, 10);
  const izoh = [
    "🛟 Balansa — migratsiya oldidan zaxira",
    `Sana: ${sana}`,
    `Jami yozuv: ${yozuvlar}`,
    `Kutayotgan migratsiya: ${kutayotgan.length} ta`,
    kutayotgan.map((d) => `· ${d}`).join("\n"),
    "",
    `🔐 AES-256-GCM · kalit: ${KALIT_ENV} env sekreti`,
    "Tiklash: npm run zaxira:xom -- --tikla <fayl.json.gz.enc>",
    "(shifr va gzip o'zi ochiladi; kalitsiz fayl ochilmaydi)",
  ].join("\n");

  try {
    await hujjatYubor({
      token,
      chatId,
      bayt,
      nom: `balansa-migratsiya-oldidan-${sana}.json.gz`,
      izoh,
    });
  } catch (e) {
    toxta("Zaxira yuborilmadi", [
      e.message,
      "",
      "Kanal sozlamalarini tekshiring: bot kanalga admin qilinganmi,",
      "BACKUP_CHAT_ID to'g'rimi.",
    ]);
  }

  console.log("\n✅ Zaxira Telegram kanaliga yuborildi. Migratsiya davom etadi.\n");
}

main().catch((e) => toxta("Zaxira olinmadi", [e.message]));

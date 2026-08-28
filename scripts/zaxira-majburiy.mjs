/**
 * MAJBURIY ZAXIRA — shartsiz surat olib Telegram kanaliga yuboradi.
 *
 * NEGA `deploy-zaxira.mjs` YETMAYDI: u zaxirani faqat KUTAYOTGAN MIGRATSIYA
 * bo'lsa oladi ("kutayotgan migratsiya yo'q — zaxira shart emas"). Bu deploy
 * uchun to'g'ri: sxema o'zgarmasa yo'qotadigan narsa yo'q.
 *
 * Lekin MA'LUMOTNI o'zgartiradigan, migratsiya BO'LMAGAN amallar ham bor —
 * masalan `scripts/qarz-mijoz-bogla.ts` eski qarzlarni mijoz kartochkasiga
 * bog'laydi. Bunday amaldan oldin ham orqaga qaytish nuqtasi bo'lishi shart,
 * shuning uchun bu yerda zaxira SHARTSIZ olinadi.
 *
 * KAFOLAT: surat kanalga YETIB BORMASA `exit 1`. Runner konteyneri ish
 * tugashi bilan yo'qoladi, ya'ni "surat olindi" degani yetarli emas — u
 * tashqariga chiqishi kerak. Artefakt ATAYLAB ishlatilmaydi: repozitoriya
 * ommaviy va artefakt havolasi bo'lgan har kim to'liq bazani yuklab olardi.
 *
 * Ishga tushirish: node scripts/zaxira-majburiy.mjs "<izoh>"
 */
import "dotenv/config";
import { gzipSync } from "node:zlib";
import { klient, suratOl, jamiYozuv } from "./lib/xom-surat.mjs";
import { hujjatYubor, apiManzili } from "./lib/telegram.mjs";

function yiqit(sarlavha, satrlar) {
  console.error(`\n❌ ${sarlavha}`);
  for (const s of satrlar) console.error(`   ${s}`);
  console.error("\n   Baza O'ZGARTIRILMADI.");
  process.exit(1);
}

async function main() {
  const izoh = process.argv[2] ?? "qo'lda olingan zaxira";

  if (!process.env.DATABASE_URL) {
    yiqit("DATABASE_URL sozlanmagan", ["Zaxirasiz davom etilmaydi."]);
  }

  // TRIM SHART: sekret panellariga nusxa ko'chirilganda oxiriga bo'sh joy
  // yoki yangi qator ilashib qoladi. Telegram esa "-100123 " ni boshqa chat
  // deb biladi va "chat not found" qaytaradi — sababi topilishi qiyin xato.
  const chatId = process.env.BACKUP_CHAT_ID?.trim();
  // `||`, `??` emas: panellarda o'zgaruvchi ko'pincha BO'SH QATOR bo'lib
  // qoladi (deploy-zaxira.mjs dagi bilan bir xil sabab).
  const token = (process.env.BACKUP_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN)?.trim();
  if (!chatId || !token) {
    yiqit("Zaxirani saqlaydigan joy yo'q", [
      "Kerak: BACKUP_CHAT_ID va BACKUP_BOT_TOKEN (yoki TELEGRAM_BOT_TOKEN).",
    ]);
  }

  // TOKEN YAROQLIMI — suratni bekorga olmaslik uchun oldindan tekshiriladi.
  // `getMe` hech qanday yon ta'sir bermaydi. Bot NOMI ATAYLAB chiqarilmaydi:
  // repozitoriya ommaviy.
  try {
    const me = await fetch(`${apiManzili()}/bot${token}/getMe`);
    if (!me.ok) {
      yiqit("Telegram bot tokeni yaroqsiz", [
        `getMe javobi: HTTP ${me.status}`,
        "BACKUP_BOT_TOKEN noto'g'ri yoki bekor qilingan.",
      ]);
    }
    console.log("Bot tokeni: yaroqli");
  } catch (e) {
    yiqit("Telegramga ulanib bo'lmadi", [String(e?.message ?? e)]);
  }

  console.log("Surat olinmoqda...");
  const surat = await suratOl(klient());
  const yozuvlar = jamiYozuv(surat);
  const bayt = gzipSync(Buffer.from(JSON.stringify(surat)));
  const jadvallar = Object.keys(surat.jadvallar).length;

  console.log(
    `   ${jadvallar} jadval, ${yozuvlar} yozuv, ${(bayt.byteLength / 1024).toFixed(0)} KB`
  );

  // Sana faylda bo'lsin — kanalda qaysi surat qachonligi ko'rinib tursin.
  const belgi = new Date().toISOString().replace(/[:.]/g, "-");
  try {
    await hujjatYubor({
      token,
      chatId,
      bayt,
      nom: `zaxira-${belgi}.json.gz`,
      izoh: `Majburiy zaxira · ${izoh} · ${jadvallar} jadval, ${yozuvlar} yozuv`,
    });
  } catch (e) {
    const matn = String(e?.message ?? e);
    const satrlar = [matn, "Surat runner konteynerida qoladi va ish tugashi bilan yo'qoladi."];
    // Eng ko'p uchraydigan sabab — bot kanalga qo'shilmagan yoki chat ID
    // boshqa botniki. Token yaroqli ekani yuqorida tekshirilgan.
    if (/chat not found/i.test(matn)) {
      satrlar.push(
        "",
        "SABAB: token yaroqli, lekin bu BOT o'sha KANALNI ko'rmayapti.",
        "Tekshiring:",
        "  1. BACKUP_BOT_TOKEN dagi bot zaxira kanaliga ADMIN qilib qo'shilganmi;",
        "  2. BACKUP_CHAT_ID aynan o'sha kanalniki va -100 bilan boshlanadimi;",
        "  3. Vercel'dagi ishlaydigan bot bilan bir xil botmi.",
        "DIQQAT: BotFather'da /revoke QILMANG — u Vercel'dagi tokenni ham",
        "bekor qiladi va kunlik production zaxirasi ishlamay qoladi."
      );
    }
    yiqit("Zaxira kanalga yuborilmadi", satrlar);
  }

  console.log("\n✅ Zaxira Telegram kanalida — davom etish xavfsiz.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

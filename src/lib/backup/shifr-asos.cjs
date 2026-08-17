/**
 * ZAXIRA SHIFRLASHNING ASOSI — AES-256-GCM (yagona manba).
 *
 * NEGA .cjs VA NEGA SHU YERDA. Zaxira ikki xil muhitdan yuboriladi:
 *   - ilova ichidan (`src/lib/backup/send.ts`, TypeScript, Next bundli);
 *   - build/skript muhitidan (`scripts/deploy-zaxira.mjs`, oddiy `node`,
 *     TypeScript umuman yo'q — u `.ts` faylni import qila olmaydi).
 *
 * Shifrlash mantig'i ikki joyda takrorlansa, formatlar bir kun ajralib
 * ketishi va kanaldagi fayl ochilmay qolishi mumkin. Shuning uchun mantiq
 * SHU BITTA faylda turadi: `crypto.ts` uni tipli qobiq bilan o'raydi,
 * `.mjs` skriptlar esa to'g'ridan-to'g'ri import qiladi.
 *
 * Kengaytma ataylab `.cjs`: loyihada `"type": "module"`, ya'ni `.js`/`.mjs`
 * fayllar ESM bo'ladi va ularni testlardagi ts-node (CommonJS) `require`
 * qila olmaydi. CommonJS moduli esa HAR IKKALA tomondan ham o'qiladi —
 * `.mjs` skriptlar uni `import` bilan, ts-node esa `require` bilan oladi.
 * (`tests/xom-zaxira-shifr.test.ts` ikkala yo'lning bir-birining faylini
 * ocha olishini majburlaydi.)
 *
 * Kalit: `BACKUP_ENCRYPTION_KEY` env sekreti (32 bayt, hex yoki base64).
 *   Yaratish: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * Kalit zaxiradan ALOHIDA saqlanadi — yo'qolsa fayllarni hech kim ocholmaydi.
 *
 * Fayl formati (bayt tartibida):
 *   [0..4]   sarlavha "BLNS1"  — fayl shifrlanganini kalitsiz ham aniqlash uchun
 *   [5..16]  IV (12 bayt)      — har shifrlashda YANGI tasodifiy qiymat
 *   [17..32] GCM tegi (16 bayt) — butunlik: o'zgartirilgan fayl ochilmaydi
 *   [33..]   shifrlangan ma'lumot
 */
const { createCipheriv, createDecipheriv, randomBytes } = require("node:crypto");

/** Kalit olinadigan env o'zgaruvchisi. */
const KALIT_ENV = "BACKUP_ENCRYPTION_KEY";

const ALGORITM = "aes-256-gcm";
const KALIT_BAYT = 32; // AES-256
const IV_BAYT = 12; // GCM uchun tavsiya etilgan uzunlik
const TEG_BAYT = 16;

/** Shifrlangan zaxira fayli shu bayt ketma-ketligi bilan boshlanadi. */
const SARLAVHA = Buffer.from("BLNS1", "ascii");

/** Kalit sozlanmagan yoki yaroqsiz. Zaxira YUBORILMAYDI (fail-closed). */
class ShifrKalitXato extends Error {
  constructor(message) {
    super(message);
    this.name = "ShifrKalitXato";
  }
}

const KALIT_YORIQNOMA =
  `${KALIT_ENV} env sekreti sozlanmagan yoki yaroqsiz. ` +
  "32 baytli kalit kerak (64 belgili hex yoki base64). Yaratish: " +
  `node -e "console.log(require('crypto').randomBytes(${KALIT_BAYT}).toString('hex'))"`;

/**
 * Env'dagi kalitni 32 baytga aylantiradi.
 * @throws {ShifrKalitXato} sozlanmagan yoki uzunligi noto'g'ri bo'lsa.
 */
function kalitOl() {
  const xom = process.env[KALIT_ENV]?.trim();
  if (!xom) throw new ShifrKalitXato(KALIT_YORIQNOMA);

  // Hex (64 belgi) yoki base64 — ikkalasi ham qulay, natija 32 bayt bo'lishi shart.
  const buf = /^[0-9a-fA-F]{64}$/.test(xom) ? Buffer.from(xom, "hex") : Buffer.from(xom, "base64");

  if (buf.length !== KALIT_BAYT) {
    throw new ShifrKalitXato(
      `${KALIT_ENV} uzunligi ${buf.length} bayt — ${KALIT_BAYT} bayt bo'lishi shart. ${KALIT_YORIQNOMA}`
    );
  }
  return buf;
}

/** Kalit sozlangan va yaroqlimi (yuborishdan OLDIN tekshirish uchun). */
function kalitBormi() {
  try {
    kalitOl();
    return true;
  } catch {
    return false;
  }
}

/** Ma'lumot shifrlanganmi (sarlavha bo'yicha). Kalitsiz ham ishlaydi. */
function shifrlanganmi(buf) {
  return buf.length >= SARLAVHA.length && buf.subarray(0, SARLAVHA.length).equals(SARLAVHA);
}

/**
 * AES-256-GCM bilan shifrlaydi.
 * @throws {ShifrKalitXato} kalit yo'q bo'lsa. Ochiq ma'lumot QAYTARILMAYDI.
 */
function shifrla(ochiq) {
  const kalit = kalitOl();
  // IV har safar yangi: bir kalit bilan IV takrorlanishi GCM'da halokatli.
  const iv = randomBytes(IV_BAYT);
  const cipher = createCipheriv(ALGORITM, kalit, iv);
  const shifr = Buffer.concat([cipher.update(ochiq), cipher.final()]);
  return Buffer.concat([SARLAVHA, iv, cipher.getAuthTag(), shifr]);
}

/**
 * AES-256-GCM bilan deshifrlaydi.
 * @throws {ShifrKalitXato} kalit yo'q; Error — format buzilgan yoki kalit boshqa.
 */
function deshifrla(shifrlangan) {
  if (!shifrlanganmi(shifrlangan)) {
    throw new Error("Zaxira fayli shifrlangan formatda emas (sarlavha topilmadi).");
  }
  const engKam = SARLAVHA.length + IV_BAYT + TEG_BAYT;
  if (shifrlangan.length < engKam) {
    throw new Error("Shifrlangan zaxira buzilgan: fayl juda qisqa.");
  }

  const kalit = kalitOl();
  const iv = shifrlangan.subarray(SARLAVHA.length, SARLAVHA.length + IV_BAYT);
  const teg = shifrlangan.subarray(SARLAVHA.length + IV_BAYT, engKam);
  const tana = shifrlangan.subarray(engKam);

  const decipher = createDecipheriv(ALGORITM, kalit, iv);
  decipher.setAuthTag(teg);
  try {
    return Buffer.concat([decipher.update(tana), decipher.final()]);
  } catch {
    // GCM tegi mos kelmadi — noto'g'ri kalit yoki fayl o'zgartirilgan.
    throw new Error(
      "Zaxirani ochib bo'lmadi: kalit noto'g'ri yoki fayl o'zgartirilgan " +
        "(GCM butunlik tekshiruvi o'tmadi)."
    );
  }
}

// CommonJS eksportlari. ATAYLAB bittalab yoziladi: Node'ning ESM tomoni
// (`.mjs` skriptlar) nomli eksportlarni shu ko'rinishda ishonchli aniqlaydi.
exports.KALIT_ENV = KALIT_ENV;
exports.SARLAVHA = SARLAVHA;
exports.KALIT_YORIQNOMA = KALIT_YORIQNOMA;
exports.ShifrKalitXato = ShifrKalitXato;
exports.kalitOl = kalitOl;
exports.kalitBormi = kalitBormi;
exports.shifrlanganmi = shifrlanganmi;
exports.shifrla = shifrla;
exports.deshifrla = deshifrla;

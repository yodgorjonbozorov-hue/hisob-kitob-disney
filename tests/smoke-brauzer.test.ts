/**
 * SMOKE (BRAUZER) — sahifalar haqiqatan ochiladimi.
 *
 * Loyihadagi qolgan 37 to'plam mantiqni tekshiradi va ularning HAMMASI kod
 * darajasida ishlaydi. "Foydalanuvchi kirib, chiqim qo'shib, hisobotni
 * ochsa ishlaydimi" degan savol shu paytgacha umuman sinalmagan edi.
 * Server komponentining yiqilishi, yo'q sahifa, yoqilgan bo'lsa ham
 * ochilmaydigan modul — bularning birortasi unit testda ko'rinmaydi.
 *
 * Ishga tushirish:
 *   npm run build          (bir marta, .next kerak)
 *   npm run test:smoke
 *
 * `.next` yo'q bo'lsa testlar o'tkazib yuboriladi — build qilinmagan
 * mashinada to'plam qizil bo'lib qolmasligi uchun.
 *
 * NEGA `node:test` (Playwright runner emas): loyihada `@playwright/test`
 * yo'q, faqat `playwright` kutubxonasi bor. Yangi runner va uning
 * konfiguratsiyasini olib kirish o'rniga mavjud uslub saqlandi — barcha
 * boshqa testlar ham `node:test` da.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { connect } from "node:net";
import type { Browser, Page } from "playwright";

const PORT = 3100;
const ASOS = `http://127.0.0.1:${PORT}`;
const LOGIN = "admin";
const PAROL = "admin123";

/**
 * Muhitda oldindan o'rnatilgan Chromium. `playwright` paketi o'zining
 * revizyasini kutadi (bu mashinada boshqasi turibdi), shuning uchun yo'l
 * ochiq beriladi — brauzer yuklab olinmaydi.
 */
// Yo'l topilmasa (masalan Windows) — Playwright o'zi o'rnatgan Chromium ishlatiladi.
const TAYYOR_CHROMIUM = "/opt/pw-browsers/chromium";
const BRAUZER_YOLI = existsSync(TAYYOR_CHROMIUM) ? TAYYOR_CHROMIUM : undefined;

const qurilgan = existsSync(".next/BUILD_ID");
const sabab = qurilgan ? undefined : "`.next` yo'q — avval `npm run build` qiling";

let server: ChildProcess | undefined;
let browser: Browser | undefined;

/** Portda kimdir tinglayaptimi (ulanib ko'rish orqali — ruxsat talab qilmaydi). */
function portBandmi(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const soket = connect({ port, host: "127.0.0.1" });
    const tugat = (natija: boolean) => {
      soket.destroy();
      resolve(natija);
    };
    soket.once("connect", () => tugat(true));
    soket.once("error", () => tugat(false));
    soket.setTimeout(1000, () => tugat(false));
  });
}

/** Port bo'shaguncha kutadi (server o'chishi bir necha yuz ms oladi). */
async function portBoshaguncha(port: number, soniya: number) {
  const chegara = Date.now() + soniya * 1000;
  while (Date.now() < chegara) {
    if (!(await portBandmi(port))) return;
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function kut(url: string, soniya: number) {
  const chegara = Date.now() + soniya * 1000;
  while (Date.now() < chegara) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // server hali ko'tarilmadi
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server ${soniya} soniyada ko'tarilmadi: ${url}`);
}

before(async () => {
  if (!qurilgan) return;

  // Har yurishda toza baza: testlar oldingi yurishdan qolgan yozuvga
  // tayanib qolmasligi kerak.
  const tayyorla = spawnSync(process.execPath, ["scripts/e2e-tayyorla.mjs"], {
    encoding: "utf8",
  });
  assert.equal(tayyorla.status, 0, `baza tayyorlanmadi:\n${tayyorla.stdout}\n${tayyorla.stderr}`);

  // Port band bo'lsa JIM QOLMAYMIZ. Aks holda `next start` bog'lana olmay
  // o'ladi, testlar esa BOSHQA (eski) serverga urib, tushunarsiz xatolar
  // beradi — eski server xotirasidagi bo'lak nomlari diskdagi yangi
  // build bilan mos kelmaydi va sahifa "Tizim yangilandi" ga tushadi.
  assert.equal(await portBandmi(PORT), false, `${PORT}-port band — avvalgi yurishdan qolgan server o'chirilmagan`);

  // `detached: true` — bolalar bilan BITTA jarayon guruhi. `npx` faqat
  // o'ram: unga SIGTERM yuborilsa `next-server` bolasi tirik qoladi va
  // portni ushlab turadi (aynan shu narsa testni beqaror qilgan edi).
  // Guruhga yuborilgan signal esa butun daraxtni o'chiradi.
  // Windows'da `npx` bajariladigan fayl emas (`npx.cmd`) — shell orqali topiladi.
  server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    shell: process.platform === "win32",
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      DATABASE_URL: "file:./prisma/e2e.db",
      DATABASE_AUTH_TOKEN: "",
      SESSION_SECRET: "e2e_sinov_maxfiy_kaliti_kamida_32_belgi_uzunlikda",
      TELEGRAM_BOT_TOKEN: "0:e2e_sinov",
      NEXT_PUBLIC_APP_URL: ASOS,
    },
    stdio: "ignore",
  });

  // Xavfsizlik to'ri: `after()` bajarilmay qolsa ham (uzilgan yurish, SIGINT)
  // server ortdan o'chadi — aks holda u portni ushlab, KEYINGI yurishni
  // buzadi. `once` — takror ro'yxatga olinmasin.
  process.once("exit", ochir);
  process.once("SIGINT", () => {
    ochir();
    process.exit(130);
  });

  await kut(`${ASOS}/login`, 90);

  const { chromium } = await import("playwright");
  browser = await chromium.launch({
    executablePath: BRAUZER_YOLI,
    args: ["--no-sandbox"],
  });
});

/**
 * Serverni BUTUN JARAYON DARAXTI bilan o'chiradi.
 *
 * `spawn("npx", ...)` ikki jarayon yaratadi: `npx` o'rami va uning bolasi
 * `next-server`. O'ramga SIGTERM yuborilsa bola TIRIK QOLADI va portni
 * ushlab turadi. Keyingi yurishda `next start` bog'lana olmaydi, testlar esa
 * ESKI serverga uradi — build yangilangan bo'lsa uning xotirasidagi bo'lak
 * nomlari diskda yo'q va sahifalar "Tizim yangilandi" ga tushadi. Aynan shu
 * narsa smoke to'plamini "gohida qizil" qilib qo'ygan edi.
 */
function ochir() {
  if (!server?.pid) return;
  if (process.platform === "win32") {
    // shell:true bilan spawn qilinganda kill() faqat qobiq (shell)ni o'ldiradi.
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
    return;
  }
  try {
    // Manfiy PID = butun jarayon guruhi (`detached: true` shuning uchun).
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

after(async () => {
  if (browser) await browser.close();
  if (!server?.pid) return;
  ochir();
  // Port haqiqatan bo'shaganiga ishonch hosil qilamiz — keyingi yurish
  // band portga urilib qolmasin.
  await portBoshaguncha(PORT, 10);
});

/** Yangi, sessiyasiz sahifa. */
async function yangiSahifa(): Promise<Page> {
  const kontekst = await browser!.newContext({ baseURL: ASOS, locale: "uz-UZ" });
  return kontekst.newPage();
}

/**
 * `app/error.tsx` dagi TIKLANISH ekrani sarlavhasi — JS bo'lagi yuklanmaganda
 * chiqadi (`ChunkLoadError`).
 *
 * Yon menyuda ~30 havola bor va Next.js ularni fonda oldindan yuklaydi; test
 * darhol keyingi sahifaga o'tsa, brauzer o'sha so'rovlarni bekor qiladi
 * (`net::ERR_ABORTED`). Odatda bu zararsiz, lekin bekor qilingani
 * `chunks/app/app/<modul>/error-*.js` bo'lsa React bo'lakni topa olmaydi.
 *
 * Chin foydalanuvchida `error.tsx` sahifani bir marta o'zi yangilaydi va
 * hammasi joyiga tushadi. Test yangilanishni kutmaydi, shuning uchun shu
 * ekranni tanib sahifani qayta ochamiz — ikkinchi urinishda bo'lak keshda.
 *
 * Uch urinishda ham ketmasa — bu chin muammo (masalan diskda yo'q bo'lak) va
 * test yiqiladi.
 */
const TIKLANISH = "Tizim yangilandi";

/** Xato ekranlari sarlavhalari — `xatosiz()` shularning birortasini kechirmaydi. */
const XATO_EKRANLARI = [
  "Application error", // Next.js o'zining ingliz ekrani
  "Kutilmagan xatolik", // app/error.tsx
  "Tizimda vaqtincha nosozlik", // app/global-error.tsx
  "Nimadir noto'g'ri ketdi", // lib/copy.ts xatoSarlavha
];

/**
 * Sahifani ochadi, chizilguncha kutadi va javobni qaytaradi.
 *
 * Ikki xil beqarorlikni yopadi, ikkalasi ham prefetch bekor qilinishidan:
 *  1. `page.goto` ning o'zi `net::ERR_ABORTED` bilan yiqilishi;
 *  2. sahifa o'rniga TIKLANISH ekranining chizilishi (yuqoridagi izoh).
 */
async function och(page: Page, yol: string) {
  let oxirgi: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const javob = await page.goto(`${ASOS}${yol}`, { waitUntil: "domcontentloaded" });
      if (await tiklanishEkranimi(page)) {
        oxirgi = new Error(`${yol}: "${TIKLANISH}" ekrani uch urinishda ham ketmadi`);
        await page.waitForTimeout(500);
        continue;
      }
      return javob;
    } catch (e) {
      oxirgi = e;
      await page.waitForTimeout(700);
    }
  }
  throw oxirgi;
}

/**
 * Sahifa chizildimi va u TIKLANISH ekranimi.
 *
 * `h1` ni kutamiz — ilovadagi HAR bir sahifada (kirish sahifasida ham) u bor,
 * ya'ni bu "sahifa chizildi" belgisi. `h1` umuman kelmasa `false` qaytadi:
 * bu boshqa muammo va uni chaqiruvchi testning o'z tekshiruvi ushlaydi.
 */
async function tiklanishEkranimi(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector("h1", { timeout: 15_000 });
  } catch {
    return false;
  }
  return (await page.locator("h1").first().innerText()).trim() === TIKLANISH;
}

/** Sahifada xato ekrani yo'qligini tekshiradi. */
async function xatosiz(page: Page) {
  const matn = (await page.locator("body").innerText()).slice(0, 4000);
  for (const ekran of XATO_EKRANLARI) {
    assert.ok(!matn.includes(ekran), `sahifa xato holatiga tushdi: "${ekran}"`);
  }
}

async function kir(page: Page) {
  await och(page, "/login");
  await page.getByLabel("Login").fill(LOGIN);
  await page.getByLabel("Parol").fill(PAROL);
  await page.getByRole("button", { name: "Kirish" }).click();
  // 60s: sekin mashinalarda (Windows, antivirus ostida) login ba'zan 20s dan oshadi.
  await page.waitForURL("**/app**", { timeout: 60_000 });
  // Sahifa chizilib bo'lguncha kutamiz — aks holda keyingi navigatsiya
  // yarim yuklangan sahifani uzib qo'yadi.
  await page.waitForSelector("h1", { timeout: 60_000 });
  // Kirishdan keyingi birinchi chizish eng ko'p prefetch keltiradi, ya'ni
  // TIKLANISH ekrani aynan shu yerda ehtimolli — `och` bilan qayta ochamiz.
  if (await tiklanishEkranimi(page)) await och(page, "/app");
}

// ---------- Kirish ----------

test("noto'g'ri parol rad etiladi va sessiya berilmaydi", { skip: sabab }, async () => {
  const page = await yangiSahifa();
  await page.goto(`${ASOS}/login`);
  await page.getByLabel("Login").fill(LOGIN);
  await page.getByLabel("Parol").fill("butunlay-notogri-parol");
  await page.getByRole("button", { name: "Kirish" }).click();

  await page.waitForTimeout(1500);
  assert.match(page.url(), /\/login/, "login sahifasida qolishi kerak");

  const cookies = await page.context().cookies();
  assert.equal(
    cookies.find((c) => c.name === "balansa_session"),
    undefined,
    "muvaffaqiyatsiz kirishda sessiya cookie'si berilmasligi kerak"
  );
  await page.context().close();
});

test("to'g'ri parol bilan kiriladi", { skip: sabab }, async () => {
  const page = await yangiSahifa();
  await kir(page);
  await page.waitForSelector("h1");
  assert.equal(await page.locator("h1").first().innerText(), "Boshqaruv paneli");
  await xatosiz(page);
  await page.context().close();
});

test("kirmasdan ichki sahifa ochilmaydi", { skip: sabab }, async () => {
  const page = await yangiSahifa();
  await och(page, "/app/tranzaksiyalar");
  assert.match(page.url(), /\/login/, "sessiyasiz foydalanuvchi login'ga yo'naltirilishi kerak");
  await page.context().close();
});

// ---------- Modul sahifalari ----------

test("registry'dagi HAR bir nav havolasi ochiladi", { skip: sabab }, async () => {
  // Havolalar ro'yxati QO'LDA yozilmaydi — `MODULLAR` registry'sidan olinadi.
  // Sababi: sidebar, BottomNav va CommandPalette ham o'sha manbadan
  // generatsiya qilinadi, ya'ni bu yerdagi har bir yo'l foydalanuvchi
  // haqiqatan bosadigan havola. Yangi modul qo'shilsa test o'zi qamrab
  // oladi — ro'yxatni yangilash esdan chiqmaydi.
  const { MODULLAR } = (await import("../src/lib/modules/registry")) as typeof import("../src/lib/modules/registry");
  const yollar = [...new Set(MODULLAR.flatMap((m) => m.nav.map((n) => n.href)))].sort();
  assert.ok(yollar.length >= 20, `registry'da atigi ${yollar.length} havola — kutilmagan`);

  const page = await yangiSahifa();
  await kir(page);

  const xatolar: string[] = [];
  for (const yol of yollar) {
    try {
      const javob = await och(page, yol);
      const holat = javob?.status() ?? 0;
      if (holat >= 400) {
        xatolar.push(`${yol}: HTTP ${holat}`);
        continue;
      }
      await xatosiz(page);
    } catch (e) {
      xatolar.push(`${yol}: ${(e as Error).message.split("\n")[0]}`);
    }
  }

  await page.context().close();
  assert.deepEqual(
    xatolar,
    [],
    `${xatolar.length}/${yollar.length} havola ochilmadi:\n  ${xatolar.join("\n  ")}`
  );
});

test("yangi modul sahifalari to'g'ri sarlavha bilan ochiladi", { skip: sabab }, async () => {
  // Bular endigina ishga tushgan modullar — sahifalari shu paytgacha
  // brauzerda umuman ochilmagan edi. Sarlavha tekshiruvi "sahifa ochildi,
  // lekin bo'sh" holatini ushlaydi.
  const SAHIFALAR: Array<[string, string]> = [
    ["/app", "Boshqaruv paneli"],
    ["/app/tranzaksiyalar", "Kirim / Chiqim"],
    ["/app/hisobot", "Hisobotlar"],
    ["/app/xarid", "Xarid"],
    ["/app/tasdiqlash", "Tasdiqlash"],
    ["/app/mijozlar", "Mijozlar"],
    ["/app/hr", "Xodimlar"],
    ["/app/hujjatlar", "Shartnomalar"],
  ];

  const page = await yangiSahifa();
  await kir(page);

  const xatolar: string[] = [];
  for (const [yol, sarlavha] of SAHIFALAR) {
    try {
      await och(page, yol);
      await page.waitForSelector("h1", { timeout: 10_000 });
      const bor = (await page.locator("h1").first().innerText()).trim();
      if (bor !== sarlavha) xatolar.push(`${yol}: "${bor}" (kutilgan "${sarlavha}")`);
    } catch (e) {
      xatolar.push(`${yol}: ${(e as Error).message.split("\n")[0]}`);
    }
  }

  await page.context().close();
  assert.deepEqual(xatolar, [], `sarlavhalar mos kelmadi:\n  ${xatolar.join("\n  ")}`);
});

// ---------- Yozish oqimi ----------

test("kirim qo'shiladi va ro'yxatda ko'rinadi", { skip: sabab }, async () => {
  const page = await yangiSahifa();
  await kir(page);
  await och(page, "/app/tranzaksiyalar");

  const izoh = `E2E sinov ${Math.floor(Date.now() / 1000)}`;

  await page.getByRole("button", { name: "Kirim", exact: true }).click();

  // Kategoriyalar serverdan keladi — birinchi haqiqiy variantni olamiz.
  const kategoriya = page.locator("form select").first();
  const qiymat = await kategoriya.locator("option:not([value=''])").first().getAttribute("value");
  assert.ok(qiymat, "kategoriya ro'yxati bo'sh — seed ishlamagan");
  await kategoriya.selectOption(qiymat);

  await page.locator("form input[placeholder='0']").first().fill("125000");
  await page.locator("form input[type='text']").last().fill(izoh);

  // Tugmani bosish bilan BIRGA server javobini kutamiz. Avval faqat yozuv
  // ro'yxatda paydo bo'lishi kutilardi — so'rov yiqilsa yoki formada xato
  // chiqsa test "20s da ko'rinmadi" deb yiqilardi va SABABI ko'rinmasdi.
  const [javob] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/transactions") && r.request().method() === "POST",
      { timeout: 30_000 }
    ),
    page.getByRole("button", { name: "Qo'shish" }).click(),
  ]);
  assert.ok(
    javob.ok(),
    `kirim saqlanmadi: HTTP ${javob.status()} — ${(await javob.text()).slice(0, 300)}`
  );

  await page.waitForSelector(`text=${izoh}`, { timeout: 30_000 });
  await xatosiz(page);
  await page.context().close();
});

// ---------- Dashboard keshi (haqiqiy Next runtime) ----------

/*
 * NEGA AYNAN BRAUZERDA.
 *
 * `unstable_cache` faqat Next server ichida ishlaydi — node:test muhitida
 * `keshlangan()` fallback bilan to'g'ridan-to'g'ri chaqiruvga tushadi
 * (lib/cache.ts). Ya'ni "kesh bekor qilinmayapti" xatosini FAQAT shu yerda,
 * haqiqiy `next start` ostida ushlash mumkin.
 *
 * Sinov mantiqi: dashboard raqamini o'qiymiz -> API orqali ma'lumot
 * o'zgartiramiz -> sahifani QAYTA ochamiz. Kesh 60 soniya yashaydi, test esa
 * bir necha soniyada tugaydi; demak raqam o'zgargan bo'lsa — uni faqat
 * `dashboardYangilandi()` yangilagan bo'ladi, TTL emas.
 */

/**
 * Sahifa ichidan API so'rovi (sessiya cookie'si bilan).
 * `tana` berilsa POST, aks holda GET.
 */
async function sorov(
  page: Page,
  yol: string,
  tana?: unknown
): Promise<{ ok: boolean; status: number; matn: string }> {
  return page.evaluate(
    async ([u, b]) => {
      const res = await fetch(u as string, {
        method: b === null ? "GET" : "POST",
        headers: b === null ? {} : { "Content-Type": "application/json" },
        body: b === null ? undefined : JSON.stringify(b),
      });
      return { ok: res.ok, status: res.status, matn: await res.text() };
    },
    [yol, tana === undefined ? null : tana] as [string, unknown]
  );
}

/** "N ta faol kassa" qatoridan sonni oladi (Kassadagi pul kartasi). */
async function faolKassaSoni(page: Page): Promise<number> {
  const matn = await page.locator("text=/\\d+ ta faol kassa/").first().innerText();
  const son = Number(matn.match(/(\d+)\s+ta faol kassa/)?.[1]);
  assert.ok(Number.isFinite(son), `"faol kassa" qatori topilmadi: "${matn}"`);
  return son;
}

test("kassa ochilganda dashboard keshi darhol bekor qilinadi", { skip: sabab }, async () => {
  const page = await yangiSahifa();
  await kir(page);
  await och(page, "/app");

  const oldin = await faolKassaSoni(page);

  // So'rov SAHIFA ICHIDAN yuboriladi — brauzer sessiya cookie'sini o'zi
  // qo'shadi (Playwright'ning `page.request` i alohida cookie jar ishlatadi
  // va 401 qaytarardi).
  const javob = await sorov(page, "/api/accounts", {
    nomi: `E2E kassa ${Date.now()}`,
    turi: "naqd",
  });
  assert.ok(javob.ok, `kassa ochilmadi: HTTP ${javob.status} — ${javob.matn.slice(0, 200)}`);

  await och(page, "/app");
  const keyin = await faolKassaSoni(page);
  assert.equal(
    keyin,
    oldin + 1,
    "kassa ochilgandan keyin dashboard eski (keshlangan) sonni ko'rsatdi"
  );
  await xatosiz(page);
  await page.context().close();
});

test("CRM buyurtmasi 'Bugungi holat' blokini darhol yangilaydi", { skip: sabab }, async () => {
  const page = await yangiSahifa();
  await kir(page);
  await och(page, "/app");

  /** "Yangi buyurtmalar" katagi ostidagi "N ta" qatori. */
  const buyurtmaSoni = async (): Promise<number> => {
    const katak = page.locator("a", { has: page.locator("text=Yangi buyurtmalar") }).first();
    const matn = await katak.innerText();
    const son = Number(matn.match(/(\d+)\s*ta/)?.[1]);
    assert.ok(Number.isFinite(son), `"Yangi buyurtmalar" katagi o'qilmadi: "${matn}"`);
    return son;
  };

  const oldin = await buyurtmaSoni();

  // Buyurtma KIRIM kategoriyasini talab qiladi.
  const katJavob = await sorov(page, "/api/categories?turi=kirim");
  assert.ok(katJavob.ok, `kategoriyalar olinmadi: HTTP ${katJavob.status}`);
  const kategoriyalar = JSON.parse(katJavob.matn) as Array<{ id: string }>;
  assert.ok(kategoriyalar.length > 0, "kirim kategoriyasi yo'q — seed ishlamagan");

  const bugun = new Date().toISOString().slice(0, 10);
  const javob = await sorov(page, "/api/crm/deals", {
    nomi: `E2E buyurtma ${Date.now()}`,
    categoryId: kategoriyalar[0].id,
    summa: 250000,
    sana: bugun,
  });
  assert.ok(javob.ok, `buyurtma yaratilmadi: HTTP ${javob.status} — ${javob.matn.slice(0, 200)}`);

  await och(page, "/app");
  assert.equal(
    await buyurtmaSoni(),
    oldin + 1,
    "buyurtmadan keyin 'Bugungi holat' eski (keshlangan) sonni ko'rsatdi"
  );
  await xatosiz(page);
  await page.context().close();
});

// ---------- Sozlamalar ----------

test("modullar sozlamalarda ko'rinadi", { skip: sabab }, async () => {
  // Agar yangi modul shu ro'yxatda bo'lmasa, mijoz uni yoqa olmaydi va
  // butun modul ko'rinmay qoladi — kod to'g'ri bo'lsa ham.
  const page = await yangiSahifa();
  await kir(page);
  const javob = await och(page, "/app/sozlamalar/modullar");
  assert.ok((javob?.status() ?? 0) < 400, `modullar sahifasi ochilmadi: HTTP ${javob?.status()}`);

  const matn = await page.locator("body").innerText();
  for (const nomi of ["Xarid", "Tasdiqlash", "Mijozlar", "Hujjatlar"]) {
    assert.ok(matn.includes(nomi), `"${nomi}" moduli sozlamalarda ko'rinmadi`);
  }
  await xatosiz(page);
  await page.context().close();
});

test("PUL KARTALARINI KO'Z tugmasi yashiradi va tanlov saqlanadi", { skip: sabab }, async () => {
  /*
   * Direktor bosh sahifani xodimlar oldida ochadi — oylik aylanma va sof
   * foyda yonidagi odamga ko'rinmasligi kerak.
   *
   * Eng muhim shart: tanlov COOKIE'da saqlanadi va SERVERDA o'qiladi.
   * Agar u faqat brauzerda saqlansa, sahifa avval haqiqiy summa bilan
   * chizilib keyin yashirilardi — summa har yuklanishda bir lahza
   * ko'rinib ketardi va yashirishning ma'nosi qolmasdi. Shu bois test
   * qayta yuklangandan keyin DARHOL (JS kutmasdan) yashirin ekanini
   * tekshiradi.
   */
  const page = await yangiSahifa();
  await kir(page);

  const koz = (nomi: string) =>
    page.getByRole("button", { name: new RegExp(`^${nomi}: summani`) });

  // Uchala kartada ham ko'z tugmasi bor.
  for (const nomi of ["Jami kirim", "Jami chiqim", "Sof foyda"]) {
    assert.equal(await koz(nomi).count(), 1, `"${nomi}" kartasida ko'z tugmasi yo'q`);
  }

  assert.ok(
    !(await page.locator("main").innerText()).includes("•••"),
    "boshida hech narsa yashirilmagan bo'lishi kerak"
  );

  await koz("Jami kirim").click();
  await koz("Sof foyda").click();
  await page.waitForTimeout(300);

  const yashirilgan = await page.locator("main").innerText();
  assert.ok(yashirilgan.includes("•••"), "bosilgandan keyin summa yashirilishi kerak");

  // Cookie yozildimi — keyingi ochilishda server shu asosda chizadi.
  const cookies = await page.context().cookies();
  const c = cookies.find((x) => x.name === "pul_yashirin");
  assert.ok(c, "tanlov cookie'ga yozilmadi");
  assert.match(c!.value, /kirim/);
  assert.match(c!.value, /foyda/);

  // `domcontentloaded` — JS ishga tushishini KUTMAYMIZ: serverdan kelgan
  // HTML'ning o'zida summa bo'lmasligi kerak.
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.ok(
    (await page.locator("main").innerText()).includes("•••"),
    "qayta yuklashda summa bir lahzaga ham ko'rinmasligi kerak"
  );

  // Qaytarib ochish ham ishlaydi.
  await page.waitForSelector("h1", { timeout: 30_000 });
  await koz("Jami kirim").click();
  await koz("Sof foyda").click();
  await page.waitForTimeout(300);
  assert.ok(
    !(await page.locator("main").innerText()).includes("•••"),
    "ko'z qayta bosilganda summa ko'rinishi kerak"
  );

  await xatosiz(page);
  await page.context().close();
});

/**
 * BALANSA iOS — RENDER QUVURI
 *
 * HTML + CSS (iPhone o'lchamida) → headless Chromium → PNG
 *
 *   node design/render/shot.mjs --all
 *   node design/render/shot.mjs --id BAL-003
 *   node design/render/shot.mjs --mode dark
 *   node design/render/shot.mjs --id BAL-003 --material solid
 *   node design/render/shot.mjs --all --index          # kontakt varaq ham
 *
 * O'LCHAM: 393x852 CSS px, deviceScaleFactor 3 → 1179x2556 PNG.
 *
 * REJIM (--mode):
 *   light (standart) | dark | both
 *   `both` — har ekran ikki marta, dark fayli `-dark.png` bilan tugaydi.
 *
 * MATERIAL (--material):
 *   glass (standart, iOS 26 Liquid Glass) | solid (iOS 18-25 muqobili)
 *   `solid` fayllari `-solid.png` bilan tugaydi.
 *
 * Brauzer: muhitda oldindan o'rnatilgan Chromium ishlatiladi —
 * yuklab olinmaydi (`/opt/pw-browsers/chromium`).
 */

import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BU = dirname(fileURLToPath(import.meta.url));
const EKRAN_HTML = join(BU, "screens");
const CHIQISH = join(BU, "../screens");

/** Qurilma o'lchami — tokens.css dagi --device-* bilan BIR XIL bo'lishi shart. */
const EN = 393;
const BOY = 852;
const MASSHTAB = 3;

/** Muhitda tayyor Chromium; topilmasa Playwright o'zinikini oladi. */
const TAYYOR = "/opt/pw-browsers/chromium";
const BRAUZER_YOLI = existsSync(TAYYOR) ? TAYYOR : undefined;

function arg(nom, standart = null) {
  const i = process.argv.indexOf(`--${nom}`);
  if (i < 0) return standart;
  const keyingi = process.argv[i + 1];
  return keyingi && !keyingi.startsWith("--") ? keyingi : true;
}

const HAMMASI = arg("all") === true;
const ID = arg("id");
const REJIM = arg("mode", "light");
const MATERIAL = arg("material", "glass");
const INDEKS = arg("index") === true;

/** `screens/` dagi HTML fayllar (BAL-NNN-nom.html). */
function ekranlarniTop() {
  if (!existsSync(EKRAN_HTML)) return [];
  return readdirSync(EKRAN_HTML)
    .filter((f) => f.endsWith(".html"))
    .sort();
}

function tanlanganlar() {
  const hammasi = ekranlarniTop();
  if (ID && ID !== true) {
    const mos = hammasi.filter((f) => f.startsWith(String(ID)));
    if (mos.length === 0) {
      throw new Error(`"${ID}" bilan boshlanadigan ekran topilmadi. Mavjud: ${hammasi.join(", ") || "yo'q"}`);
    }
    return mos;
  }
  if (!HAMMASI && !ID) {
    throw new Error("--all yoki --id kerak. Masalan: node design/render/shot.mjs --all");
  }
  return hammasi;
}

/** Chiqish fayl nomi: BAL-003-home[-dark][-solid].png */
function chiqishNomi(htmlFayl, mode, material) {
  const asos = basename(htmlFayl, ".html");
  const qoshimcha = [mode === "dark" ? "dark" : null, material === "solid" ? "solid" : null]
    .filter(Boolean)
    .join("-");
  return qoshimcha ? `${asos}-${qoshimcha}.png` : `${asos}.png`;
}

async function main() {
  const fayllar = tanlanganlar();
  const rejimlar = REJIM === "both" ? ["light", "dark"] : [REJIM];

  mkdirSync(CHIQISH, { recursive: true });

  const brauzer = await chromium.launch({
    executablePath: BRAUZER_YOLI,
    args: ["--no-sandbox", "--font-render-hinting=none"],
  });

  const olingan = [];

  for (const rejim of rejimlar) {
    const kontekst = await brauzer.newContext({
      viewport: { width: EN, height: BOY },
      deviceScaleFactor: MASSHTAB,
      isMobile: true,
      hasTouch: true,
      locale: "uz-UZ",
      colorScheme: rejim === "dark" ? "dark" : "light",
      // Animatsiyalar suratni beqaror qiladi — o'chiriladi.
      reducedMotion: "reduce",
    });
    const page = await kontekst.newPage();

    for (const fayl of fayllar) {
      const yol = join(EKRAN_HTML, fayl);
      await page.goto(pathToFileURL(yol).href, { waitUntil: "load" });

      // Rejim va material HTML ichida emas, RENDER paytida beriladi —
      // shuning uchun bitta HTML to'rtala variantni bera oladi.
      await page.evaluate(
        ([m, mat]) => {
          document.documentElement.dataset.mode = m;
          document.documentElement.dataset.material = mat;
        },
        [rejim, MATERIAL],
      );

      // FAIL-CLOSED tekshiruv. Viewport tegi yo'q bo'lsa render JIMGINA
      // buziladi (sahifa 980px da hisoblanib kichrayadi) — PNG chiqadi,
      // lekin noto'g'ri. Shuning uchun ochiq xato beriladi.
      const viewportBor = await page.evaluate(
        () => !!document.querySelector('meta[name="viewport"]'),
      );
      if (!viewportBor) {
        throw new Error(
          `${fayl}: <meta name="viewport"> yo'q. Busiz ekran kichrayib renderlanadi.\n` +
            '  Qo\'shing: <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
        );
      }

      // Shriftlar chizilishini kutamiz — aks holda matn "sakrab" chiqadi.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(120);

      // Aniq qirqim: `clip`siz Chromium ba'zan 1px kam beradi (852*3=2556
       // o'rniga 2555) — sub-piksel yaxlitlash. Bu esa PNG'larni
       // bir-biriga mos kelmaydigan qiladi.
      const nom = chiqishNomi(fayl, rejim, MATERIAL);
      await page.screenshot({
        path: join(CHIQISH, nom),
        clip: { x: 0, y: 0, width: EN, height: BOY },
      });
      olingan.push(nom);
      console.log(`  ${nom}`);
    }

    await kontekst.close();
  }

  await brauzer.close();

  if (INDEKS) {
    kontaktVaraq();
    jonliIndeks();
  }

  console.log(`\n${olingan.length} ta PNG → design/screens/ (${EN * MASSHTAB}x${BOY * MASSHTAB})`);
}

/** Barcha renderlarni bitta grid sahifada ko'rsatadigan kontakt varaq. */
function kontaktVaraq() {
  const pnglar = readdirSync(CHIQISH)
    .filter((f) => f.endsWith(".png"))
    .sort();

  // Ekran ID bo'yicha guruhlaymiz: light va dark yonma-yon tursin.
  const guruh = new Map();
  for (const p of pnglar) {
    const kalit = basename(p, ".png").replace(/-(dark|solid|dark-solid)$/, "");
    if (!guruh.has(kalit)) guruh.set(kalit, []);
    guruh.get(kalit).push(p);
  }

  const kartalar = [...guruh.entries()]
    .map(([kalit, fayllar]) => {
      const rasmlar = fayllar
        .map((f) => `<figure><img src="./${f}" alt="${f}" loading="lazy"><figcaption>${f.replace(kalit, "").replace(/^-|\.png$/g, "") || "light"}</figcaption></figure>`)
        .join("");
      return `<section class="kart"><h2>${kalit}</h2><div class="juft">${rasmlar}</div></section>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Balansa iOS — kontakt varaq</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:32px; background:#0b1220; color:#e2e8f0;
         font-family: "Inter Var", system-ui, sans-serif; }
  h1 { font-size:24px; margin:0 0 4px; }
  .izoh { color:#94a3b8; font-size:14px; margin:0 0 32px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
          gap:32px; }
  .kart h2 { font-size:13px; font-weight:600; color:#94a3b8; margin:0 0 10px;
             font-family:ui-monospace,monospace; }
  .juft { display:flex; gap:12px; }
  figure { margin:0; flex:1; min-width:0; }
  img { width:100%; display:block; border-radius:14px;
        border:1px solid rgba(226,232,240,.14); background:#000; }
  figcaption { margin-top:6px; font-size:11px; color:#64748b; text-align:center; }
</style></head>
<body>
  <h1>Balansa iOS — dizayn renderlari</h1>
  <p class="izoh">${guruh.size} ta ekran · ${pnglar.length} ta render · 1179×2556 (@3x)</p>
  <div class="grid">
${kartalar}
  </div>
</body></html>`;

  writeFileSync(join(CHIQISH, "index.html"), html);
  console.log("  index.html (kontakt varaq)");
}

/**
 * `render/index.html` — JONLI indeks: har ekran iframe'da haqiqiy HTML
 * sifatida ochiladi. CSS'ni tahrirlab brauzerni yangilash kifoya, qayta
 * render qilish shart emas — dizayn ustida ishlash tezlashadi.
 */
function jonliIndeks() {
  const fayllar = ekranlarniTop();
  const kartalar = fayllar
    .map((f) => {
      const nom = basename(f, ".html");
      return `  <section class="kart">
    <h2>${nom}</h2>
    <div class="juft">
      <div><iframe src="./screens/${f}" data-mode="light"></iframe><p>light</p></div>
      <div><iframe src="./screens/${f}" data-mode="dark"></iframe><p>dark</p></div>
    </div>
  </section>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Balansa iOS — jonli indeks</title>
<style>
  body { margin:0; padding:32px; background:#0b1220; color:#e2e8f0;
         font-family: system-ui, sans-serif; }
  h1 { font-size:24px; margin:0 0 4px; }
  .izoh { color:#94a3b8; font-size:14px; margin:0 0 28px; }
  .grid { display:flex; flex-wrap:wrap; gap:36px; }
  .kart h2 { font-size:12px; font-weight:600; color:#94a3b8; margin:0 0 8px;
             font-family:ui-monospace,monospace; }
  .juft { display:flex; gap:14px; }
  iframe { width:393px; height:852px; border:0; border-radius:18px;
           background:#000; box-shadow:0 8px 32px rgba(0,0,0,.5); display:block; }
  .juft p { margin:6px 0 0; font-size:11px; color:#64748b; text-align:center; }
</style></head>
<body>
  <h1>Balansa iOS — jonli indeks</h1>
  <p class="izoh">${fayllar.length} ta ekran · HTML to'g'ridan-to'g'ri ochiladi (render kutilmaydi)</p>
  <div class="grid">
${kartalar}
  </div>
<script>
  // Har iframe yuklangach unga rejimni beramiz — bitta HTML ikki ko'rinishda.
  for (const f of document.querySelectorAll("iframe")) {
    f.addEventListener("load", () => {
      const d = f.contentDocument;
      if (!d) return;
      d.documentElement.dataset.mode = f.dataset.mode;
      d.documentElement.dataset.material = "glass";
    });
  }
</script>
</body></html>`;

  writeFileSync(join(BU, "index.html"), html);
  console.log("  render/index.html (jonli indeks)");
}

main().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});

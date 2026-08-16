/**
 * App Store ikonkasi va splash rasmlarini brend SVG'sidan yasaydi.
 *
 * Ishga tushirish:  npm run ikonka   (ios-ilova ichida)
 *
 * NEGA SKRIPT: ikonka `public/logo-icon.svg` bilan bir manbadan chiqishi kerak —
 * brend o'zgarsa ikonka qo'lda qayta chizilmasin. Natija PNG'lar repoga
 * qo'shiladi, ya'ni build paytida bu skript ishlatilmaydi.
 *
 * MUHIM (Apple qoidasi): App Store ikonkasida ALFA KANAL bo'lmasligi kerak —
 * shaffoflik bo'lsa yuklashda ITMS-90717 xatosi keladi. Shu sabab har bir
 * ikonka `.flatten()` bilan to'liq shaffofsiz (RGB) qilib yoziladi.
 * Burchaklarni iOS o'zi yumaloqlaydi — biz yumaloqlamaymiz.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const bu = dirname(fileURLToPath(import.meta.url));
const ildiz = join(bu, "..");

/** Brend ranglari — docs/BRAND.md bilan bir xil. */
const BREND = "#0F766E";
const MINT = "#5EEAD4";

/**
 * Tarozi belgisi (public/logo-icon.svg dagi shakl), oq rangda.
 * `olcham` — chiqadigan kvadrat tomoni, `nisbat` — belgining kvadratdagi ulushi.
 */
function belgiSvg(olcham, nisbat, fon) {
  const masshtab = nisbat;
  const surish = (512 * (1 - masshtab)) / 2;
  return `<svg width="${olcham}" height="${olcham}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="${fon}"/>
  <g transform="translate(${surish} ${surish}) scale(${masshtab})">
    <rect x="234" y="196" width="44" height="216" rx="8" fill="#FFFFFF"/>
    <rect x="88" y="164" width="336" height="56" rx="28" fill="#FFFFFF"/>
    <rect x="96" y="88" width="320" height="56" rx="28" fill="${MINT}"/>
    <path d="M76 244h140c0 38.66-31.34 70-70 70s-70-31.34-70-70z" fill="#FFFFFF"/>
    <path d="M296 244h140c0 38.66-31.34 70-70 70s-70-31.34-70-70z" fill="#FFFFFF"/>
  </g>
</svg>`;
}

/** SVG matnini shaffofsiz PNG qilib yozadi. */
async function pngYoz(svg, olcham, manzil) {
  await mkdir(dirname(manzil), { recursive: true });
  const bayt = await sharp(Buffer.from(svg))
    .resize(olcham, olcham)
    // Alfa kanalni olib tashlaydi (App Store talabi).
    .flatten({ background: BREND })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(manzil, bayt);

  const meta = await sharp(bayt).metadata();
  if (meta.hasAlpha) throw new Error(`${manzil}: alfa kanal qoldi`);
  console.log(`  ${manzil.replace(ildiz + "/", "")} — ${meta.width}x${meta.height}, ${meta.channels} kanal`);
}

const IKONKA = join(ildiz, "ios/App/App/Assets.xcassets/AppIcon.appiconset");
const SPLASH = join(ildiz, "ios/App/App/Assets.xcassets/Splash.imageset");

console.log("App Store ikonkasi (1024x1024, alfasiz):");
// 0.62 — belgining kvadratdagi ulushi. iOS ikonka maskasi burchaklarni kesadi,
// shuning uchun belgi atrofida yetarli bo'sh joy qoldiriladi.
await pngYoz(belgiSvg(1024, 0.62, BREND), 1024, join(IKONKA, "AppIcon-512@2x.png"));

console.log("Splash (2732x2732):");
// Splash markazidagi belgi kichikroq — u har xil ekranda kesiladi (aspect fill).
const splashSvg = belgiSvg(2732, 0.3, BREND);
for (const nom of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  await pngYoz(splashSvg, 2732, join(SPLASH, nom));
}

console.log("\nTayyor. `npx cap sync ios` shart emas — fayllar joyida yangilandi.");

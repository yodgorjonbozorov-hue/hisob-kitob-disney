# iOS ilovasini App Store'ga chiqarish

Balansa iOS ilovasi — `ios-ilova/` papkasida. Bu Capacitor o'rami: ekranlar
`balansa.uz/app` dan keladi, qobiq esa native (Face ID qulfi, ulashish,
haptika, oflayn ekrani).

---

## Avval bilib qo'yiladigan uchta narsa

1. **Apple Developer Program obunasi shart** — yiliga $99.
   `developer.apple.com/programs`. Tasdiqlash odatda 24–48 soat, ba'zan
   bir hafta. **Bugun chiqarmoqchi bo'lsangiz va hisob hali yo'q bo'lsa —
   ulgurmaysiz.** Hisob bor bo'lsa, quyidagi qadamlar 1–2 soat.
2. **Mac kerak emas.** Qurilish GitHub'ning macOS runner'ida bo'ladi
   (`.github/workflows/ios-build.yml`). Sertifikat ham o'sha yerda
   avtomatik yaratiladi — kalit repoga tushmaydi.
3. **Tekshiruv (App Review) darhol emas** — odatda 24–48 soat. Ya'ni
   "bugun publish" amalda: bugun **yuborish**, ertaga–indinga **efirga
   chiqish**. TestFlight'ga esa bugun chiqadi (ichki testerlar uchun
   tekshiruv kutilmaydi).

---

## Qadamlar

### 1. Apple Developer hisobi va Team ID

`developer.apple.com/account` → **Membership** → **Team ID** (10 belgi) —
yozib oling.

### 2. App Store Connect API kaliti

`appstoreconnect.apple.com` → **Users and Access** → **Integrations** →
**App Store Connect API** → **+**

- Name: `Balansa CI`
- Access: **App Manager** (pastroq rol sertifikat yarata olmaydi — build yiqiladi)

Yaratilgach:
- **Key ID** (masalan `ABC123XYZ`) — yozib oling;
- **Issuer ID** (UUID) — sahifaning tepasida;
- **`.p8` faylni yuklab oling** — **faqat bir marta beriladi**, yo'qotsangiz
  yangisini yaratasiz.

### 3. GitHub Secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New
repository secret**. To'rtta:

| Nomi | Qiymati |
|---|---|
| `APPLE_TEAM_ID` | 1-qadamdagi Team ID |
| `APPSTORE_KEY_ID` | 2-qadamdagi Key ID |
| `APPSTORE_ISSUER_ID` | 2-qadamdagi Issuer ID |
| `APPSTORE_PRIVATE_KEY` | `.p8` faylning TO'LIQ matni |

> `.p8` ni ochib, `-----BEGIN PRIVATE KEY-----` dan `-----END PRIVATE KEY-----`
> gacha hammasini nusxalang — qatorlar bilan birga.

### 4. App Store Connect'da ilova yozuvi

`appstoreconnect.apple.com` → **Apps** → **+** → **New App**

| Maydon | Qiymat |
|---|---|
| Platform | iOS |
| Name | `Balansa` |
| Primary Language | English (U.S.) |
| Bundle ID | `uz.balansa.app` |
| SKU | `balansa-ios-1` |

> **Bundle ID ro'yxatda yo'q bo'lsa:** `developer.apple.com/account` →
> **Identifiers** → **+** → App IDs → App → Description: `Balansa`,
> Bundle ID: Explicit → `uz.balansa.app`. Hech qanday qo'shimcha
> imkoniyat (capability) belgilamang — ilova ularni ishlatmaydi.

**Demo hisob ham shu qadamda tayyorlanadi.** Tekshiruvchi ilovaga kira
olishi shart. Ma'lumoti bor haqiqiy hisob bering (bo'sh hisob — "ilova
ishlamayapti" degan rad javobiga olib keladi). Obunasi FAOL bo'lsin, aks
holda tekshiruvchi to'lov ekraniga tushib qoladi.

### 5. Qurilish va yuklash

Repo → **Actions** → **iOS qurilishi** → **Run workflow** → `yuklash: true`.

15–25 daqiqada build App Store Connect'ga tushadi. So'ng u yerda
**"Processing"** holatida 10–30 daqiqa turadi.

Xato bo'lsa — `docs` oxiridagi "Tez-tez uchraydigan xatolar" bo'limiga qarang.

### 6. Skrinshotlar

Majburiy o'lcham: **6.9" (1320 × 2868)**, kamida 3 ta.

```bash
node ios-ilova/scripts/skrinshot.mjs \
  --url https://balansa.uz --login <demo-login> --parol <demo-parol>
```

Natija: `ios-ilova/app-store/skrinshot/*.png`

> **MUHIM:** skriptni **ma'lumoti bor** hisob bilan ishga tushiring.
> Argumentsiz ishlatilsa lokal bo'sh baza olinadi va barcha raqamlar nol
> chiqadi — bunday suratlar App Store uchun yaramaydi.
>
> Skript native ilovaniki bilan bir xil User-Agent qo'yadi, ya'ni suratda
> ham to'lov bloklari berkitilgan bo'ladi — ilovadagi ekran bilan aynan
> bir xil.

### 7. Sahifani to'ldirish va yuborish

`ios-ilova/app-store/metadata.md` — barcha matnlar tayyor, nusxa ko'chiring:
tavsif, kalit so'zlar, App Privacy javoblari va **App Review Notes**
(tekshiruvchiga izoh — o'zbek tilidagi ekranlar inglizcha izohlangan).

So'ng: **Add for Review** → **Submit**.

---

## Nega bu ilova "shunchaki sayt o'rami" emas (4.2 qoidasi)

Apple faqat veb-saytni o'rab qo'ygan ilovalarni rad etadi. Balansada
quyidagilar **native**:

| Imkoniyat | Qayerda |
|---|---|
| Face ID / Touch ID bilan ilova qulfi | Sozlamalar → Ilova qulfi |
| Hisobotlarni native "Ulashish" oynasi orqali saqlash | Hisobot eksporti |
| Haptik javob (moliyaviy tasdiqlar) | Yozuv saqlanganda |
| Ulanish uzilganda native oflayn ekrani | `www/oflayn.html` |
| Status bar / splash mavzuga moslashadi | `NativeSetup.tsx` |

Bu ro'yxat App Review Notes'ga ham kiritilgan.

---

## Ikki qoida — ATAYLAB shunday qilingan

### 3.1.1 — ilova ichida to'lov yo'q

Apple raqamli obunani ilovadan **tashqarida** sotishga yo'naltirishni
taqiqlaydi. Shuning uchun iOS ilovasida:

- `/billing` sahifasida tarif kartochkalari va Payme/Click tugmalari
  **ko'rsatilmaydi** — faqat obuna holati;
- yon menyudan "Obuna va to'lov" havolasi **olib tashlanadi**;
- PRO reklama bloklaridagi "tarifni yangilang" havolasi **berkitiladi**.

Aniqlash: WKWebView User-Agent'iga `BalansaIOS` qo'shiladi
(`capacitor.config.js`), server shuni o'qiydi (`lib/native/server.ts`).
**Veb va Android hech qanday o'zgarmaydi.**

> **Buning natijasi:** sinov muddati tugagan direktor iOS ilovasidan
> to'lov qila olmaydi — u veb-saytga kirishi kerak. Bu Apple qoidasining
> narxi. Muqobil yo'l — Apple IAP (In-App Purchase) qo'shish, komissiyasi
> 15–30%. Hozircha ataylab qo'shilmadi.

### 5.1.1(v) — ilova ichida hisobni o'chirish

Ro'yxatdan o'tish bor ekan, o'chirish ham ilova ichidan bo'lishi shart.
**Sozlamalar → Hisobni o'chirish**:

1. Faqat kompaniya egasi (OWNER);
2. tasdiq uchun kompaniya nomi qo'lda yoziladi;
3. so'rovdan keyin kirish darhol yopiladi;
4. 30 kun ichida bekor qilish mumkin (`/hisob-ochirilmoqda`);
5. muddat o'tgach `/api/cron/hisob-ochirish` kompaniyani **butunlay**
   o'chiradi.

O'chirish tartibi zaxira ro'yxatining teskarisi (`lib/db/hisobOchirish.ts`)
— ya'ni FK bog'liqliklari buzilmaydi. Yangi model qo'shilib ro'yxatga
tushmasa o'chirish **to'xtaydi** (fail-closed), `tests/hisob-ochirish.test.ts`
buni majburlaydi.

---

## Kundalik ish

Veb ilovaga o'zgartirish kiritilsa **iOS build qayta qurilmaydi** — ekranlar
serverdan keladi, deploy qilishning o'zi yetarli.

Qayta qurish faqat quyidagilarda kerak:

- `ios-ilova/` ichidagi biror narsa o'zgarsa (config, ikonka, plagin);
- Apple yangi SDK talab qilsa (yiliga bir marta);
- ilova versiyasini oshirmoqchi bo'lsangiz.

Versiya: `ios-ilova/ios/App/App.xcodeproj/project.pbxproj` dagi
`MARKETING_VERSION`. Build raqami avtomatik (`github.run_number`).

Lokal o'zgartirishdan keyin:

```bash
cd ios-ilova && npm ci && npx cap sync ios
```

Ikonkani brend SVG'sidan qayta yasash:

```bash
cd ios-ilova && npm run ikonka
```

---

## Tez-tez uchraydigan xatolar

| Xato | Sabab va yechim |
|---|---|
| `No signing certificate "iOS Distribution" found` | API kaliti roli **App Manager** emas. 2-qadamda kalitni qayta yarating. |
| `No profiles for 'uz.balansa.app' were found` | Bundle ID `developer.apple.com` → Identifiers'da yaratilmagan (4-qadam izohi). |
| `The bundle version must be higher than the previously uploaded version` | Bir xil `run_number` bilan ikki marta yuklangan. Workflow'ni qayta ishga tushiring — raqam o'zi oshadi. |
| `Invalid Image - contains an alpha channel` | Ikonka shaffoflik bilan. `npm run ikonka` alfasiz yozadi — qayta yasang. |
| `Missing Purpose String` | `Info.plist` da `NSFaceIDUsageDescription` yo'q. Mavjud — o'chirmang. |
| ITMS-91053 (privacy manifest) | `PrivacyInfo.xcprivacy` Xcode loyihasiga ulanmagan. `project.pbxproj` da Resources bosqichida turishi kerak. |
| Guideline 4.2 (rad javobi) | App Review Notes'dagi native imkoniyatlar ro'yxatini javobda takrorlang va Face ID qulfi qayerdaligini ko'rsating. |
| Guideline 5.1.1(v) (rad javobi) | Javobda aniq yo'lni yozing: Settings → "Hisobni o'chirish". |

---

## Fayllar

| Fayl | Nima |
|---|---|
| `ios-ilova/capacitor.config.js` | Ilova qaysi manzilni ochadi, splash, User-Agent |
| `ios-ilova/ios/App/App/Info.plist` | Face ID matni, orientatsiya, shifrlash e'loni |
| `ios-ilova/ios/App/App/PrivacyInfo.xcprivacy` | Maxfiylik manifesti (Apple talabi) |
| `ios-ilova/app-store/metadata.md` | Do'kon sahifasi matnlari |
| `ios-ilova/scripts/ikonka-yasa.mjs` | Ikonka va splash generatori |
| `ios-ilova/scripts/skrinshot.mjs` | Skrinshot generatori |
| `.github/workflows/ios-build.yml` | Qurilish va yuklash |
| `src/lib/native/kopruk.ts` | Veb ↔ native ko'prigi (paketsiz) |
| `src/lib/db/hisobOchirish.ts` | Hisobni o'chirish mantiqi |

# iOS IMPLEMENTATION PLAN — Balansa

> **DIQQAT:** bu reja. **SwiftUI kodi bu sessiyada yozilmagan va
> yozilmaydi** — implementatsiya alohida sessiyada, ruxsat berilgandan
> keyin boshlanadi.

---

## 1. TEXNOLOGIYA TAVSIYASI

| Qatlam | Tavsiya | Nega |
|---|---|---|
| **UI** | **SwiftUI** (iOS 18+ baza) | Dynamic Type, VoiceOver, dark mode **bepul** keladi. UIKit'da har biri qo'lda. iOS 26 Liquid Glass ham SwiftUI'da `.glassEffect()` bilan |
| **Arxitektura** | **MVVM + `@Observable`** | TCA kuchli, lekin bu jamoa uchun **og'ir**: o'rganish vaqti va boilerplate. Balansa oqimlari sodda (ro'yxat → forma → saqlash). `@Observable` (iOS 17+) MVVM'ni juda yengil qiladi |
| **Tarmoq** | `URLSession` + `async/await` + yupqa `APIClient` | Alamofire kerak emas. Token yangilash va idempotentlik uchun bitta `interceptor` yetarli |
| **Kesh / offline** | **SwiftData** | Core Data'ning zamonaviy yuzi, `@Model` bilan. Offline navbat va kesh uchun bitta joy. (Muqobil: GRDB — kuchliroq, lekin qo'shimcha bog'liqlik) |
| **Grafiklar** | **Swift Charts** | Native, Dynamic Type va VoiceOver bilan ishlaydi (`.accessibilityChartDescriptor`) |
| **Ikonalar** | **SF Symbols** | Dizaynda o'z SVG'larimiz bor, lekin native'da SF Symbols afzal: shrift bilan avtomatik moslashadi, ranglanadi, animatsiyalanadi |
| **Keychain** | `Security` framework to'g'ridan-to'g'ri | Kutubxona kerak emas — bitta fayl |
| **Push** | `UserNotifications` + APNs HTTP/2 | Firebase **kerak emas** — qo'shimcha SDK, maxfiylik yorlig'i murakkablashadi |
| **Testlar** | XCTest + **swift-snapshot-testing** | Snapshot testlari dizayn regressiyasini ushlaydi |

**Uchinchi tomon bog'liqliklari: 1 ta** (`swift-snapshot-testing`, faqat test).
Bu ataylab — har SDK App Store maxfiylik manifestiga qo'shimcha talab qo'yadi.

### Papka tuzilishi (taklif)

```
BalansaApp/
├── App/                 BalansaApp.swift, AppState, Router
├── Design/              Tokens (rang/shrift/masofa), Komponentlar/
├── Core/
│   ├── Network/         APIClient, Endpoints, TokenStore
│   ├── Storage/         SwiftData modellari, OfflineQueue
│   └── Auth/            Keychain, BiometricLock
├── Features/
│   ├── Auth/            BAL-000–008
│   ├── Dashboard/       BAL-020–025
│   ├── Transactions/    BAL-040–049
│   ├── Cash/            BAL-050–058
│   ├── Daily/           BAL-059–062
│   ├── Sales/           BAL-070–086
│   ├── Inventory/       BAL-100–116
│   ├── Purchase/        BAL-130–138
│   ├── Debts/           BAL-150–158
│   ├── Customers/       BAL-160–173
│   ├── Reports/         BAL-200–205
│   ├── Approvals/       BAL-242–244
│   ├── AI/              BAL-260–262
│   └── Settings/        BAL-280–292
└── Shared/              Formatlash (pul, sana), Haptika, Xatolar
```

**Design/Tokens** — `design/render/tokens.css` dan **qo'lda ko'chiriladi**
(bir marta). Keyin token o'zgarsa ikkala joyda yangilanadi. Avtomatik
generatsiya (Style Dictionary) — keyingi bosqich.

---

## 2. BOSQICHLAR

### MVP — "peshtaxtada ishlaydigan ilova"

**Maqsad:** kassir va direktor kunlik ishini telefonda bajara olsin.
**Faqat backend READY bo'lgan ekranlar.**

| Modul | Ekranlar | Backend |
|---|---|---|
| Auth | BAL-000, 001, 006, 007, 008 | **D-1 kerak** (JWT) |
| Dashboard | BAL-020, 021, 024, 025 | READY (+ B-4 afzal) |
| Yozuvlar | BAL-040–049, 067 | READY (+ B-2 offline uchun) |
| Kassa | BAL-050–055 | READY |
| Smena | BAL-056–058 | READY |
| Kunlik | BAL-059–062 | READY |
| Sotuv (bitta mahsulot) | BAL-070–078, 085, 086 | READY |
| Ombor | BAL-100–108 | READY |
| Qarz | BAL-150–155, 158 | READY (aging — B-3) |
| Profil / xavfsizlik | BAL-280–283, 289–292 | READY (+ D-2) |
| Global | BAL-300–307 | READY (+ C-11 offline) |

**Ekran soni: ~58** · **Backend bog'liqligi: D-1, D-5, B-2, B-3, B-4**
**Muddat: ~6–8 hafta** (1 iOS dasturchi + backend 3 hafta parallel)

> **MVP'ga KIRMAYDI:** savat, kasr miqdor, shtrix-kod, omborlar,
> filiallar, push, CRM, HR, hujjatlar, xarid, AI. Bularsiz ilova
> **to'liq ishlaydi** — chunki ular PRO tarif yoki MISSING backend.

### V1 — "to'liq ilova"

| Qo'shiladi | Ekranlar | Backend |
|---|---|---|
| **Push** | BAL-240, 241, 245 | **C-10** |
| **Offline navbat** | BAL-302, 303 | **C-11 / B-2** |
| Tasdiqlash | BAL-242–244 | READY |
| Xarid | BAL-130–138 | READY |
| Mijozlar / CRM | BAL-160–173 | READY |
| Hisobotlar (qayta loyihalangan) | BAL-200–205 | B-5, B-6 |
| Xodimlar / vazifalar / hujjatlar | BAL-180–192 | READY (+ B-7) |
| AI | BAL-260–262 | READY |
| **Shtrix-kod** | BAL-084 | **C-3** (kichik) |

**Ekran soni: +35 (jami ~93)** · **Muddat: +6–8 hafta**

### V2 — "kengaytirilgan"

| Qo'shiladi | Backend | Hajm |
|---|---|---|
| **Savat + chegirma** | C-1, C-7 | L |
| **Kasr miqdor** | C-2 | L |
| **Aralash to'lov** | C-6 | M |
| **Filiallar** | C-5 | M |
| **Omborlar** | C-4 | XL |
| Narx darajalari | C-9 | M |
| Qisman qaytarish | C-8 | M |

**Ekran soni: +11 (jami 104)** · **Muddat: +8–12 hafta**

---

## 3. KRITIK YO'L (nima nimani bloklaydi)

```
D-1 (JWT)  ──►  MVP butunlay bloklangan
   │            (ilova login qila olmaydi)
   ▼
D-5 (bootstrap) ──► MVP tez ishga tushishi
   │
B-2 (idempotentlik) ──► offline navbat (V1)
   │
C-10 (push) ──► kunlik yakun oqimi to'liq bo'lishi
   │
C-1 (SaleItem) ──► C-7 chegirma, C-6 aralash to'lov
   │
C-2 (kasr miqdor) ──► mustaqil
C-4 (omborlar) ──► eng katta, oxirida
```

**Birinchi qilinadigan ish: D-1 (JWT + refresh).** Busiz native ilova
umuman ishlamaydi.

---

## 4. RISKLAR VA YUMSHATISH

| # | Risk | Ehtimol | Ta'sir | Yumshatish |
|---|---|:-:|:-:|---|
| R1 | **JWT migratsiyasi mavjud web sessiyani buzadi** | O'rta | Yuqori | Yangi endpointlar (`/api/mobile/auth/*`), eski cookie yo'li **tegilmaydi**. Guard ikkalasini qabul qiladi |
| R2 | **Offline navbat dublikat yozuv yaratadi** | Yuqori | **Kritik** (pul!) | Idempotentlik kaliti **majburiy**. Naqsh allaqachon bor (`DebtPayment`). Test: bir xil kalitni 100 marta yuborish |
| R3 | Ombor qoldig'i offline'da noto'g'ri ko'rinadi | Yuqori | O'rta | Sotuv offline **bloklangan**. Qoldiq "taxminiy" belgisi bilan |
| R4 | **App Store 4.2 rad javobi** | Past | Yuqori | Native ilovada bu **muammo emas** (o'ram emas). Face ID, push, offline, kamera — hammasi native |
| R5 | **App Store 3.1.1** (obuna) | O'rta | Yuqori | Native'da ham to'lov ekrani **ko'rsatilmaydi** — faqat holat. Web'da to'lanadi. Naqsh allaqachon ishlab turibdi |
| R6 | SwiftData beqarorligi | O'rta | O'rta | Faqat kesh va navbat uchun. Haqiqat manbai — server. Muammo bo'lsa GRDB'ga o'tish arzon |
| R7 | Dynamic Type XXXL layout buzilishi | O'rta | O'rta | Snapshot testlari **XXXL bilan** yuriladi (dizaynda topilgan 2 ta xato shu tarzda topildi) |
| R8 | Uzbek matn uzunligi tugmalarni buzadi | Yuqori | Past | Har tugma matni XXXL da 2 qatorga sig'ishi test qilinadi |
| R9 | APNs `.p8` kaliti chalkashadi | O'rta | O'rta | App Store Connect API kaliti bilan **boshqa** kalit. Alohida secret nomi |
| R10 | Tenant izolyatsiyasi mobil endpointlarda buziladi | Past | **Kritik** | Yangi endpointlar ham `withTenant()` bilan o'raladi (`CLAUDE.md` invarianti). `tests/isolation.test.ts` yangi route'larni qamrasin |

---

## 5. TEST STRATEGIYASI

| Tur | Nima | Qanday |
|---|---|---|
| **Snapshot** | Har ekran 4 variantda: light/dark × large/XXXL | `swift-snapshot-testing`. Referens — `design/screens/*.png` |
| **Accessibility audit** | VoiceOver labellari, tegish maydoni ≥44pt, kontrast | XCTest `.accessibilityAudit()` (Xcode 15+) — avtomatik |
| **Unit** | Pul formatlash, sana, offline navbat mantiqi, token yangilash | XCTest |
| **Integratsiya** | Idempotentlik: bir xil kalit 100 marta → 1 ta yozuv | Mock server |
| **Oqim (UI)** | FAZA 3 dagi 12 oqim, **tegish soni o'lchanadi** | XCUITest |
| **Offline** | Tarmoq uzish → yozish → tiklash → sync | Network Link Conditioner |

**Kritik test:** *"Bir xil yozuvni 100 marta yuborsak, bazada 1 ta bo'ladimi?"*
Bu pul bilan ishlaydigan ilovada eng muhim test.

---

## 6. APP STORE TALABLARI

### Maxfiylik yorlig'i (App Privacy)

`ios-ilova/ios/App/App/PrivacyInfo.xcprivacy` bilan **bir xil** bo'lishi shart:

| Ma'lumot | Yig'iladi | Bog'langan | Kuzatuv | Maqsad |
|---|:-:|:-:|:-:|---|
| Name | ✅ | ✅ | ❌ | App Functionality |
| Phone Number | ✅ | ✅ | ❌ | App Functionality |
| Other Financial Info | ✅ | ✅ | ❌ | App Functionality |
| Other User Content | ✅ | ✅ | ❌ | App Functionality |

**Kuzatuv (tracking): YO'Q.** Uchinchi tomon analitikasi yo'q.

### Ruxsat matnlari (Info.plist)

| Kalit | Matn |
|---|---|
| `NSFaceIDUsageDescription` | "Balansa moliyaviy ma'lumotlaringizni himoyalash uchun ilovani ochishda Face ID so'raydi." |
| `NSCameraUsageDescription` | "Mahsulot shtrix-kodini skanerlash va chek fotosini saqlash uchun kamera kerak." |
| `NSPhotoLibraryUsageDescription` | "Hujjat va cheklarni ilovaga qo'shish uchun rasmlarga ruxsat kerak." |

> Kamera/rasm ruxsatlari **faqat** C-3 (shtrix-kod) va B-7 (fayl ilova)
> amalga oshirilgandan keyin qo'shiladi. **Ishlatilmaydigan ruxsat
> so'ralmaydi** — Apple buni tekshiradi.

### Required Reason API'lari

`PrivacyInfo.xcprivacy` da e'lon qilinadi (Capacitor o'ramidagi bilan bir xil):

| API | Sabab | Nega |
|---|---|---|
| `UserDefaults` | CA92.1 | Ilova sozlamalari |
| File timestamp | C617.1 | Eksport fayllari |
| Disk space | E174.1 | Fayl saqlashdan oldin tekshirish |

### Sinov hisobi (App Review)

- Ma'lumoti bor **haqiqiy demo hisob** (bo'sh hisob → "ilova ishlamayapti" rad javobi)
- Obunasi **FAOL** (aks holda tekshiruvchi to'lov ekraniga tushadi)
- Review Notes'da o'zbekcha ekranlar inglizcha izohlanadi
  (naqsh tayyor: `ios-ilova/app-store/metadata.md`)

### Guideline 5.1.1(v) — hisobni o'chirish

**Allaqachon bor:** BAL-290/291, `POST /api/me/hisob-ochirish`,
`src/lib/db/hisobOchirish.ts`. Native ilovada shu API ishlatiladi.

---

## 7. CAPACITOR O'RAMI BILAN MUNOSABAT

Hozir App Store'ga **Capacitor o'rami** (`ios-ilova/`, `uz.balansa.app`)
chiqarilmoqda — bu **v1.0**.

Native ilova **o'sha bundle ID bilan v2.0** bo'lib chiqadi:

| Bosqich | Nima |
|---|---|
| Bugun | Capacitor o'rami v1.0 → App Store |
| MVP tayyor | Native v2.0 → **o'sha App Store yozuvi**, foydalanuvchi oddiy update oladi |
| Nima saqlanadi | App Store reytingi, sharhlar, o'rnatishlar soni |

**Muhim:** o'ram ichidagi 3.1.1 va 5.1.1(v) yechimlari
(`src/lib/native/server.ts`, `lib/db/hisobOchirish.ts`) **native ilovada
ham kerak** — ular server tomonda, shuning uchun qayta yozilmaydi.

---

## 8. BIRINCHI HAFTA — aniq qadamlar

| Kun | Backend | iOS |
|---|---|---|
| 1–2 | D-1: `RefreshToken` modeli + `/api/mobile/auth/login`, `/refresh` | Loyiha skeleti, Design/Tokens ko'chirish |
| 3 | D-5: `/api/mobile/bootstrap` | `APIClient` + `TokenStore` (Keychain) |
| 4–5 | B-2: `Idempotency-Key` (transactions, kunlik) | BAL-001 Kirish + BAL-000 Splash |
| 5 | — | BAL-020 Asosiy (bootstrap bilan) |

**Birinchi hafta oxirida:** ilova ochiladi, login qiladi, dashboard ko'rsatadi.

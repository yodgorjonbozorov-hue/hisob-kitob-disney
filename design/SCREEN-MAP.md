# SCREEN MAP — Balansa iOS informatsion arxitekturasi

**Asos:** `FEATURE-INVENTORY.md` (backend auditi) · `src/lib/permissions/katalog.ts`
(huquqlar) · `src/lib/modules/registry.ts` (modullar).

**Qoida:** web'dagi 35 sahifa NUSXALANMAYDI. Har oqim uchun savol:
*"buni telefonda, bir qo'l bilan, peshtaxtada turib, 30 soniyada qanday
bajarish mumkin?"*

---

## 0. ENG MUHIM QAROR: bu bitta ilova emas, UCHTA

Audit ko'rsatdi (`katalog.ts:56-74`):

| Rol | Huquqlar | Amalda nima qiladi |
|---|---:|---|
| SELLER | **3/18** | Yozuv kiritadi, pul qabul qiladi. **Sotuv huquqi ham yo'q.** |
| CASHIER | **11/18** | Sotadi, ombor kirimi, qarz oladi/yopadi, kassa topshiradi |
| OWNER / ADMIN | **18/18** | Hammasi + hisobot, xodim, tarif, sozlama |

Bu farq shu qadar kattaki, bitta tab bar uchalasiga xizmat qila olmaydi.
Shuning uchun **tab bar rolga qarab quriladi** — ilova bir xil, skeleti
har rolga moslashadi. Sotuvchi hech qachon ko'rmaydigan bo'limni menyuda
ko'rmasligi kerak (u "menga ruxsat yo'q" xabarini ko'rgandan ko'ra).

---

## A. TAB BAR

Maksimal 5 element. O'rtadagi **FAB** (+) — tab emas, amal.

### A.1 OWNER / ADMIN — "Biznes qanday ketyapti?"

| # | Tab | Nega aynan shu | Kuniga |
|---|---|---|---|
| 1 | **Asosiy** | Direktor ilovani "bugun qancha?" deb ochadi. Boshqa hech narsa bu qadar tez-tez kerak emas. | 5–15 |
| 2 | **Yozuvlar** | Har kirim/chiqimni ko'rish va tuzatish — kunlik nazorat quroli. | 3–8 |
| — | **( + )** | Tez kirim / chiqim / sotuv — kontekstga qarab. | 2–10 |
| 3 | **Qarzlar** | O'zbek biznesida qarz — 1-raqamli og'riq. Pul ko'chada qolmasin. | 2–5 |
| 4 | **Yana** | Ombor, Xarid, Hisobot, CRM, Xodimlar, Sozlamalar. | 1–3 |

> **Nega "Hisobot" tab emas:** oylik hisobot oyiga 1–2 marta ochiladi.
> Kuniga 5 marta ochiladigan Qarzlar undan muhimroq. Hisobot — "Yana" da
> va Asosiy ekrandagi "Batafsil" havolasida.

### A.2 CASHIER — "Sotaman va kassani topshiraman"

| # | Tab | Nega | Kuniga |
|---|---|---|---|
| 1 | **Sotuv** | Kassirning butun ish kuni shu ekranda. Ilova shu yerdan ochilsin. | 20–100 |
| 2 | **Yozuvlar** | Kiritganini tekshirish, xatoni tuzatish. | 5–15 |
| — | **( + )** | Tez kirim / chiqim. | 5–20 |
| 3 | **Qarzlar** | Nasiya berish va undirish — kassirning kundalik ishi. | 3–10 |
| 4 | **Kassam** | Smena yopish, kassa topshirish, shaxsiy kassa qoldig'i. | 1–3 |

### A.3 SELLER — "Yozib qo'yaman"

Faqat 3 ta huquq bor. Tab bar 3 element + FAB:

| # | Tab | Nega | Kuniga |
|---|---|---|---|
| 1 | **Yozuvlar** | Yagona asosiy ish. Ilova shu yerdan ochiladi. | 10–30 |
| — | **( + )** | Kirim / chiqim qo'shish — ilovaning MAQSADI. | 10–30 |
| 2 | **Kunlik** | Kun tushumini kiritish va topshirish (KUNLIK moduli yoqilgan bo'lsa). | 1–2 |
| 3 | **Profil** | Sozlamalar, qulf, chiqish. | <1 |

> KUNLIK moduli o'chirilgan tenantda SELLER'da 2 tab qoladi
> (Yozuvlar · Profil) — bu normal, sun'iy to'ldirilmaydi.

### A.4 FAB xatti-harakati (kontekstga bog'liq)

FAB bosilganda **action sheet** ochiladi, mazmuni rol + modulga qarab:

```
OWNER/ADMIN, OMBOR yoqilgan:   Pul kirdi · Pul chiqdi · Sotuv · Qarz berish
CASHIER, OMBOR yoqilgan:       Sotuv · Pul kirdi · Pul chiqdi · Qarz berish
SELLER:                        Pul kirdi · Pul chiqdi        (sheet YO'Q —
                               2 ta amal bo'lsa to'g'ridan-to'g'ri segmented
                               control bilan bitta ekran ochiladi)
```

**Uzoq bosish (long press)** — eng ko'p ishlatiladigan amalni to'g'ridan-to'g'ri
ochadi (kassirda Sotuv, sotuvchida Pul kirdi). Bitta tegishni tejaydi.

---

## B. EKRAN IERARXIYASI

```
Root
├── Auth stack (sessiyasiz)
│   ├── BAL-000 Splash
│   ├── BAL-001 Kirish
│   ├── BAL-002 Ro'yxatdan o'tish
│   └── BAL-006 Parol almashtirish (majburiy)
│
├── Qulf overlay (fullScreenCover) — BAL-283
│
└── TabView (rolga qarab)
    ├── Tab 1 → NavigationStack
    ├── Tab 2 → NavigationStack
    ├── FAB   → sheet (.medium / .large)
    ├── Tab 3 → NavigationStack
    └── Tab 4 → NavigationStack
```

**Taqdim etish qoidasi (qat'iy):**

| Turi | Qachon | Misol |
|---|---|---|
| **push** | Ierarxiyada pastga tushish, orqaga qaytish mantiqiy | Yozuv tafsiloti, mijoz kartochkasi |
| **sheet (.medium)** | Bitta qisqa qaror yoki 1–3 maydonli forma | To'lov turi tanlash, miqdor kiritish |
| **sheet (.large)** | Ko'p maydonli forma, ro'yxatdan tanlash | Yangi yozuv, mahsulot tanlash |
| **fullScreenCover** | Kontekstdan butunlay chiqish, chalg'imaslik shart | Qulf, POS savati, smena yopish |
| **alert** | Qaytarib bo'lmaydigan tasdiq | Sotuvni bekor qilish, hisobni o'chirish |
| **action sheet** | 2–5 variantdan tanlash | FAB menyusi, qator amallari |

---

## C. EKRAN ID REYESTRI

**Jami: 104 ekran.** Fayl nomi: `BAL-NNN-qisqa-nom.png`,
dark: `-dark`, holatlar: `-empty` / `-loading` / `-error`.

`B` ustuni — backend holati (`FEATURE-INVENTORY.md` dan):
**R**=READY · **P**=PARTIAL · **M**=MISSING.

### 000–019 · Auth va Onboarding

| ID | Ekran | B | Kim |
|---|---|:-:|---|
| BAL-000 | Splash / sessiya tiklash | R | hamma |
| BAL-001 | Kirish (login + parol) | P | hamma |
| BAL-002 | Ro'yxatdan o'tish — kompaniya | R | yangi |
| BAL-003 | Ro'yxatdan o'tish — egasi va parol | R | yangi |
| BAL-004 | Onboarding — biznes turi (oddiy/avto, omborli?) | R | OWNER |
| BAL-005 | Onboarding — birinchi kassa va kategoriyalar | R | OWNER |
| BAL-006 | Parolni majburiy almashtirish | R | hamma |
| BAL-007 | Biznes tanlash (bir nechta bo'lsa) | R | hamma |
| BAL-008 | Kirish xatosi / bloklangan hisob | R | hamma |

### 020–039 · Home Dashboard

| ID | Ekran | B | Kim |
|---|---|:-:|---|
| BAL-020 | Asosiy — direktor (KPI, trend, so'nggi yozuvlar) | R | OWNER/ADMIN |
| BAL-021 | Asosiy — oy tanlash (sheet) | R | OWNER/ADMIN |
| BAL-022 | Asosiy — kategoriya taqsimoti (donut, batafsil) | R | OWNER/ADMIN |
| BAL-023 | Asosiy — 6 oylik dinamika (batafsil) | R | OWNER/ADMIN |
| BAL-024 | Asosiy — bo'sh holat (yangi biznes) | R | OWNER/ADMIN |
| BAL-025 | Biznes almashtirgich (sheet) | R | hamma |

### 040–069 · Moliya

| ID | Ekran | B | Kim |
|---|---|:-:|---|
| BAL-040 | Yozuvlar ro'yxati (kun bo'yicha guruhlangan) | R | hamma |
| BAL-041 | Yozuvlar — filtr va saralash (sheet) | R | hamma |
| BAL-042 | Yozuv tafsiloti | R | hamma |
| BAL-043 | Yangi yozuv — summa (raqam klaviaturasi) | R | `tranzaksiya.yaratish` |
| BAL-044 | Yangi yozuv — kategoriya tanlash | R | ⇡ |
| BAL-045 | Yangi yozuv — kassa va to'lov turi | R | ⇡ |
| BAL-046 | Yozuvni tahrirlash | R | ⇡ |
| BAL-047 | Yozuvni o'chirish (tasdiq) | R | manager |
| BAL-048 | O'chirilganlar / tiklash | R | manager |
| BAL-049 | Ommaviy tanlash va ko'chirish | R | manager |
| BAL-050 | Kassalar ro'yxati (qoldiqlar) | R | `kassa.korish` |
| BAL-051 | Kassa tafsiloti va harakatlar | R | ⇡ |
| BAL-052 | Kassalar aro o'tkazma | R | `pul.berish` |
| BAL-053 | Mening kassam (shaxsiy qoldiq) | R | CASHIER+ |
| BAL-054 | Kassa topshirish (kassir → direktor) | R | CASHIER |
| BAL-055 | Kassa topshirig'ini qabul qilish | R | manager |
| BAL-056 | Smena yopish — naqd sanash | R | CASHIER+ |
| BAL-057 | Smena yopish — farq natijasi | R | ⇡ |
| BAL-058 | Smena tarixi | R | manager |
| BAL-059 | Kunlik — tushum kiritish | R | kassir/sotuvchi |
| BAL-060 | Kunlik — kunni topshirish | R | kassir |
| BAL-061 | Kunlik — direktor tasdig'i | R | direktor |
| BAL-062 | Kunlik — tarix | R | manager |
| BAL-063 | Budjet — ro'yxat va progress | R | manager |
| BAL-064 | Budjet — belgilash/tahrir | R | manager |
| BAL-065 | Takroriy yozuvlar | R | manager |
| BAL-066 | Kategoriyalar boshqaruvi | R | manager |
| BAL-067 | Yozuvlar — bo'sh holat | R | hamma |

### 070–099 · Sotuv / POS

| ID | Ekran | B | Kim |
|---|---|:-:|---|
| BAL-070 | Sotuv — mahsulot qidirish va tanlash | R | `sotuv.yaratish` |
| BAL-071 | Sotuv — miqdor va narx | P | ⇡ |
| BAL-072 | Sotuv — to'lov turi (naqd / qarz) | R | ⇡ |
| BAL-073 | Sotuv — qarz uchun mijoz tanlash | R | ⇡ |
| BAL-074 | Sotuv — yakunlandi (chek) | P | ⇡ |
| BAL-075 | Sotuvlar ro'yxati (kun bo'yicha) | R | ⇡ |
| BAL-076 | Sotuv tafsiloti | R | ⇡ |
| BAL-077 | Sotuvni bekor qilish (tasdiq) | R | manager |
| BAL-078 | Chekni ulashish (native share) | P | ⇡ |
| **BAL-080** | **Savat — ko'p mahsulotli sotuv** | **M** | ⇡ |
| **BAL-081** | **Savat — qator tahrirlash (kasr miqdor)** | **M** | ⇡ |
| **BAL-082** | **Savat — chegirma** | **M** | ⇡ |
| **BAL-083** | **Aralash to'lov (naqd + karta + qarz)** | **M** | ⇡ |
| **BAL-084** | **Shtrix-kod skaner (kamera)** | **M** | ⇡ |
| BAL-085 | Sotuv — ombor yetarli emas (xato) | R | ⇡ |
| BAL-086 | Sotuv — qarz limiti oshdi (xato) | R | ⇡ |

### 100–129 · Ombor va mahsulot

| ID | Ekran | B | Kim |
|---|---|:-:|---|
| BAL-100 | Ombor — mahsulotlar ro'yxati | R | `mahsulot.korish` |
| BAL-101 | Ombor — qidiruv va filtr | R | ⇡ |
| BAL-102 | Mahsulot tafsiloti (qoldiq, narx, harakat) | R | ⇡ |
| BAL-103 | Mahsulot qo'shish / tahrirlash | R | `mahsulot.qoshish` |
| BAL-104 | Ombor kirimi (miqdor + tannarx) | R | `ombor.kirim` |
| BAL-105 | Qoldiq to'g'rilash — inventarizatsiya | R | `ombor.tuzatish` |
| BAL-106 | Qoldiq to'g'rilash — hisobdan chiqarish | R | ⇡ |
| BAL-107 | Kam qolgan mahsulotlar (minQoldiq) | R | ⇡ |
| BAL-108 | Ombor — bo'sh holat | R | ⇡ |
| BAL-109 | Avtopark (avto rejimi) | R | AVTO |
| BAL-110 | Mashina tafsiloti va xarajatlari | R | AVTO |
| BAL-111 | Mashinaga xarajat qo'shish | R | AVTO |
| **BAL-115** | **Omborlar ro'yxati (multi-warehouse)** | **M** | manager |
| **BAL-116** | **Omborlar aro ko'chirish** | **M** | manager |

### 130–149 · Xarid va ta'minotchi

| ID | Ekran | B | Kim |
|---|---|:-:|---|
| BAL-130 | Xarid buyurtmalari ro'yxati | R | `xarid.korish` |
| BAL-131 | Buyurtma tafsiloti | R | ⇡ |
| BAL-132 | Yangi buyurtma — ta'minotchi | R | ⇡ |
| BAL-133 | Yangi buyurtma — satrlar | R | ⇡ |
| BAL-134 | Qabul qilish — miqdor tasdig'i | R | `xarid.qabul` |
| BAL-135 | Qabul qilish — to'lov (qisman ham) | R | ⇡ |
| BAL-136 | Ta'minotchilar ro'yxati | R | ⇡ |
| BAL-137 | Ta'minotchi kartochkasi | R | ⇡ |
| BAL-138 | Xarid — bo'sh holat | R | ⇡ |

### 150–179 · Mijozlar, CRM, qarz

| ID | Ekran | B | Kim |
|---|---|:-:|---|
| BAL-150 | Qarzlar — dashboard (jami, ochiq, kechikkan) | R | `qarz.korish` |
| BAL-151 | Qarzlar ro'yxati | R | ⇡ |
| BAL-152 | Qarz tafsiloti va to'lov tarixi | R | ⇡ |
| BAL-153 | Qarz to'lovini qabul qilish | R | `qarz.tolash` |
| BAL-154 | Qarz berish (sotuvsiz) | R | ⇡ |
| BAL-155 | Qarzni bekor qilish | R | manager |
| **BAL-156** | **Aging — 4 pog'onali ro'yxat** | **P** | ⇡ |
| BAL-157 | Undirish rejimi (qo'ng'iroq, SMS) | P | ⇡ |
| BAL-158 | Qarzlar — bo'sh holat | R | ⇡ |
| BAL-160 | Mijozlar ro'yxati | R | MIJOZLAR |
| BAL-161 | Mijoz kartochkasi (qarz, tarix, limit) | R | ⇡ |
| BAL-162 | Mijoz qo'shish / tahrirlash | R | ⇡ |
| BAL-170 | CRM — kanban (bitimlar) | R | CRM |
| BAL-171 | Bitim tafsiloti | R | ⇡ |
| BAL-172 | Bitim yaratish | R | ⇡ |
| BAL-173 | Faoliyat qo'shish (qo'ng'iroq, uchrashuv) | R | ⇡ |

### 180–199 · Xodimlar, vazifalar, hujjatlar

| ID | Ekran | B | Kim |
|---|---|:-:|---|
| BAL-180 | Xodimlar ro'yxati | R | HR |
| BAL-181 | Xodim kartochkasi | R | ⇡ |
| BAL-182 | Davomat belgilash | R | ⇡ |
| BAL-183 | Oylik hisoblash | R | ⇡ |
| BAL-184 | Avans berish | R | ⇡ |
| BAL-185 | Vazifalar ro'yxati | R | VAZIFALAR |
| BAL-186 | Vazifa tafsiloti / yaratish | R | ⇡ |
| BAL-190 | Shartnomalar ro'yxati | R | HUJJATLAR |
| BAL-191 | Shartnoma tafsiloti | R | ⇡ |
| BAL-192 | Fayl ilova qilish (kamera / fayl) | P | ⇡ |

### 200–219 · Hisobotlar

| ID | Ekran | B | Kim |
|---|---|:-:|---|
| BAL-200 | Hisobotlar markazi | R | `hisobot.korish` |
| BAL-201 | Oylik hisobot | R | ⇡ |
| BAL-202 | Hisobot — kategoriya kesimi | R | ⇡ |
| BAL-203 | Hisobot — qarz harakati | R | ⇡ |
| BAL-204 | Eksport (PDF / Excel) va ulashish | P | ⇡ |
| BAL-205 | Foydalanuvchilar kesimi (kim qancha kiritdi) | R | manager |

### 220–239 · Filiallar va omborlar boshqaruvi

| ID | Ekran | B | Kim |
|---|---|:-:|---|
| BAL-220 | Bizneslar ro'yxati (multi-business) | R | OWNER |
| BAL-221 | Biznes sozlamalari | R | OWNER |
| **BAL-225** | **Filiallar ro'yxati** | **M** | OWNER |
| **BAL-226** | **Filial kesimidagi hisobot** | **M** | OWNER |

### 240–259 · Bildirishnomalar va tasdiqlash

| ID | Ekran | B | Kim |
|---|---|:-:|---|
| BAL-240 | Bildirishnomalar ro'yxati | R | hamma |
| BAL-241 | Bildirishnoma sozlamalari | P | hamma |
| BAL-242 | Tasdiqlash — kutilayotgan so'rovlar | R | TASDIQLASH |
| BAL-243 | So'rov tafsiloti — tasdiq / rad | R | ⇡ |
| BAL-244 | Tasdiq qoidalari | R | manager |
| **BAL-245** | **Push ruxsati so'rash (priming)** | **M** | hamma |

### 260–279 · AI yordamchi

| ID | Ekran | B | Kim |
|---|---|:-:|---|
| BAL-260 | AI — suhbat (bo'sh, takliflar bilan) | R | AI |
| BAL-261 | AI — javob (raqam + grafik) | R | ⇡ |
| BAL-262 | AI — chuqurlashtirish | R | ⇡ |

### 280–299 · Profil, sozlamalar, xavfsizlik

| ID | Ekran | B | Kim |
|---|---|:-:|---|
| BAL-280 | Profil | R | hamma |
| BAL-281 | Sozlamalar | R | hamma |
| BAL-282 | Xavfsizlik (parol, qulf) | R | hamma |
| BAL-283 | Face ID qulf ekrani | P | hamma |
| BAL-284 | Foydalanuvchilar boshqaruvi | R | `foydalanuvchi.boshqarish` |
| BAL-285 | Foydalanuvchi qo'shish / huquqlar | R | ⇡ |
| BAL-286 | Rollar va huquqlar (PRO) | R | `rol.boshqarish` |
| BAL-287 | Modullar | R | OWNER |
| BAL-288 | Obuna holati (iOS — to'lovsiz) | R | manager |
| BAL-289 | Telegram ulash | R | hamma |
| BAL-290 | Hisobni o'chirish | R | OWNER |
| BAL-291 | Hisob o'chirilmoqda (30 kun) | R | OWNER |
| BAL-292 | Maxfiylik va shartlar | R | hamma |

### 300–319 · Global holatlar

| ID | Ekran | B | Kim |
|---|---|:-:|---|
| BAL-300 | Global qidiruv | R | hamma |
| BAL-301 | Qidiruv — natija yo'q | R | hamma |
| BAL-302 | Offline banner + navbat | P | hamma |
| BAL-303 | Sinxronlanmoqda | P | hamma |
| BAL-304 | Tarmoq xatosi | R | hamma |
| BAL-305 | Server xatosi (500) | R | hamma |
| BAL-306 | Huquq yo'q (403) | R | hamma |
| BAL-307 | Obuna tugagan (READONLY) | R | hamma |
| BAL-308 | Ilovani yangilash kerak | M | hamma |
| BAL-900 | **Komponent kutubxonasi** (spec varaq) | — | — |

---

## D. QAMROV JADVALI — 34 soha

Brief'dagi har soha qaysi ekranlarga tushgani. **Bittasi ham qolmadi.**

| # | Soha | Ekran ID'lari |
|---|---|---|
| 1 | auth | BAL-001, 006, 008 |
| 2 | onboarding | BAL-000, 002–005, 007 |
| 3 | home dashboard | BAL-020–025 |
| 4 | kirim | BAL-043–045, FAB |
| 5 | chiqim | BAL-043–045, FAB |
| 6 | kassa | BAL-050–053 |
| 7 | smena | BAL-056–058 |
| 8 | kunlik hisobot | BAL-059–062 |
| 9 | operatsiyalar | BAL-040–042, 046–049, 067 |
| 10 | sotuv / POS | BAL-070–078, 085, 086 |
| 11 | multi-product cart | **BAL-080–082 (MISSING)** |
| 12 | to'lov | BAL-072, **083 (MISSING)** |
| 13 | chek | BAL-074, 078 |
| 14 | ombor | BAL-100–108 |
| 15 | mahsulot | BAL-102, 103 |
| 16 | kasr miqdor | **BAL-081 (MISSING)** |
| 17 | xarid | BAL-130–135, 138 |
| 18 | ta'minotchi | BAL-136, 137 |
| 19 | mijozlar / CRM | BAL-160–162, 170–173 |
| 20 | qarz | BAL-150–155, 158 |
| 21 | qarz aging | **BAL-156 (PARTIAL)**, 157 |
| 22 | xodimlar | BAL-180–184 |
| 23 | vazifalar | BAL-185, 186 |
| 24 | hujjatlar | BAL-190–192 |
| 25 | hisobotlar | BAL-200–205 |
| 26 | filiallar | **BAL-225, 226 (MISSING)** |
| 27 | omborlar | **BAL-115, 116 (MISSING)** |
| 28 | bildirishnomalar | BAL-240, 241, **245 (MISSING)** |
| 29 | approval | BAL-242–244 |
| 30 | AI assistant | BAL-260–262 |
| 31 | profile | BAL-280 |
| 32 | settings | BAL-281, 287, 289, 292 |
| 33 | subscription / billing | BAL-288 |
| 34 | search | BAL-300, 301 |
| + | security | BAL-282, 283, 290, 291 |
| + | offline mode | BAL-302–304 |

---

## E. WEB → iOS FARQI (nega ekran soni mos kelmaydi)

| Web sahifa | iOS'da nima bo'ldi | Sabab |
|---|---|---|
| `/app/tranzaksiyalar` (bitta katta jadval + filtr paneli) | 4 ekran (ro'yxat, filtr sheet, tafsilot, tahrir) | Telefonda jadval o'qilmaydi. Ro'yxat + kun guruhlari + swipe amallar. |
| `/app/sotuv` (forma) | 5 qadamli oqim (BAL-070–074) | Peshtaxtada bitta uzun forma to'ldirib bo'lmaydi. Har qadam bitta savol. |
| `/app/hisobot` (uzun sahifa) | Markaz + 4 ichki (BAL-200–204) | Skroll o'rniga tanlash. |
| `/app/admin/*` (6 sahifa) | "Yana" ichida 4 ekran | Kuniga bir marta ham ochilmaydi — tab bar joyini egallamasin. |
| `/billing` (tarif kartochkalari + to'lov) | BAL-288 — faqat holat | App Store 3.1.1 (allaqachon kodda: `lib/native/server.ts`). |
| `/superadmin` (11 route) | **YO'Q** | Platforma egasining ishi. Telefonda emas. |
| — | **BAL-302, 303 (offline)** | Web'da yo'q. Mobil uchun majburiy: peshtaxtada internet uziladi. |
| — | **BAL-283 (Face ID qulf)** | Web'da yo'q. Moliyaviy ilova uchun kutiladi. |
| — | **BAL-245 (push priming)** | Web'da yo'q. |

**Natija:** web 35 sahifa → iOS **104 ekran**. Ko'proq, lekin **har biri
kichikroq**: web'da bitta sahifa 5 ta ishni qiladi, iOS'da har ekran bitta
savolga javob beradi.

---

## F. ISHONCHSIZ JOYLAR (UNKNOWN)

1. **Filial** — `Transaction.filial` erkin matn. Men uni BAL-225/226 da
   entity sifatida loyihaladim (MISSING). Agar mijozlar uni ishlatmasa —
   bu ikki ekran olib tashlanadi.
2. **AVTO tarifi** — alohida tab bar EMAS, `Business.turi` ga qarab
   Ombor tabi "Avtopark" ga aylanadi (web'dagi `AVTO_YORLIQLAR` naqshi,
   `registry.ts:238`). Alohida oqim kerak bo'lsa — aytasiz.
3. **Superadmin** — kiritilmadi.

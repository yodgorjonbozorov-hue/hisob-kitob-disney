# BALANSA mobil ilova (iOS + Android)

Bitta React Native (Expo) kod bazasi — mavjud BALANSA backend'iga ulanadi.
Backend yagona haqiqat manbai: hisob-kitob, RBAC, tenant izolyatsiyasi hammasi serverda.

## Arxitektura

- **Expo SDK 57 / React Native 0.86 / TypeScript** — expo-router (fayl-asosli navigatsiya)
- **TanStack Query** — API holati, kesh, qayta urinish, pull-to-refresh
- **SecureStore** — sessiya tokeni (shifrlangan), parol hech qachon saqlanmaydi
- **Bearer auth** — `POST /api/auth/login` (`x-balansa-client: mobile` header bilan)
  javobda `token` qaytaradi; bu iron-session cookie bilan bir xil muhrlangan qiymat.
  Har so'rov `Authorization: Bearer <token>` va `X-Active-Business: <id>` bilan boradi.
- **RBAC** — `GET /api/me` dan rol/modullar/biznes bayroqlar olinadi; UI shunga qarab
  quriladi, lekin haqiqiy himoya har doim serverda (401/402/403 kodlari qayta ishlanadi).

## Papka tuzilishi

```
mobile/src/
  api/         — typed API qatlami (client, endpointlar, javob modellari)
  auth/        — sessiya (SecureStore), AuthContext, RBAC yordamchilari
  components/  — dizayn tizimi (Screen, Card, MoneyText, BottomSheet, ...)
  features/    — ekranga xos mantiq (kirimChiqim filtrlari...)
  hooks/       — useTransactionsAll, useDebounced
  i18n/        — o'zbek (lotin) lug'ati, keyin ru/en qo'shiladi
  theme/       — ranglar/tokenlar (dark-first, BRAND.md palitrasiga mos)
  utils/       — pul formatlash (Int so'm), sana ("YYYY-MM-DD")
  app/         — expo-router ekranlari (login, (tabs), kategoriya, pos, ...)
```

## Muhit sozlamalari

Faqat ochiq qiymat ishlatiladi (sirlar bundle'ga kirmaydi):

| O'zgaruvchi | Ma'nosi | Standart |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Backend manzili | `https://balansa.uz` |

Lokal dev uchun: `EXPO_PUBLIC_API_URL=http://<kompyuter-IP>:3000 npx expo start`

## Ishga tushirish

```bash
cd mobile
npm install
npx expo start          # QR orqali Expo Go / dev client
npm run ios             # iOS simulyator
npm run android         # Android emulyator
```

## Tekshirish

```bash
npm run typecheck       # tsc --noEmit
npm run lint            # expo lint (eslint)
npm test                # jest — pul format, guruhlash, RBAC, API klient
```

## Build (EAS)

```bash
npm i -g eas-cli && eas login
# app.json ichida extra.eas.projectId ni haqiqiy ID bilan almashtiring
eas build --profile development --platform ios      # dev client
eas build --profile preview --platform android      # ichki test APK
eas build --profile production --platform ios       # TestFlight/App Store
eas build --profile production --platform android   # Play Console (AAB)
```

Do'konga yuborish qo'lda: `eas submit -p ios` / `eas submit -p android`
(avtomatik yuborilmaydi).

## Backend talablari

Mobil ilova quyidagi (shu branch'da qo'shilgan) backend imkoniyatlariga tayanadi:

- `POST /api/auth/login` — `x-balansa-client: mobile` bo'lsa `token` qaytaradi
- `GET /api/me` — profil + bizneslar + modullar + huquqlar
- `Authorization: Bearer` — `src/lib/auth/session.ts` qabul qiladi
- `X-Active-Business` header — `src/lib/business.ts` cookie o'rnida o'qiydi
- `GET /api/ombor/kpi`, `GET /api/debts/qarzdorlar` — mobil o'qish endpointlari

Bularsiz (eski serverda) login "Server mobil kirishni qo'llab-quvvatlamaydi" xatosini beradi.

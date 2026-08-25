-- ---------------------------------------------------------------------------
-- KUNLIK HISOBOT — KUN YAKUNINI HAQIQIY KASSA LEDGERIGA BOG'LASH.
--
-- MUAMMO (audit):
--   1. `DailyReport.sanalganNaqd` TIZIM hisobi bilan `naqdSumma` (kunning
--      NAQD KIRIMI) ga qarab solishtirilardi. Naqd CHIQIM va kun boshidagi
--      qoldiq umuman hisobga olinmasdi: 10 mln naqd kirim + 3 mln naqd
--      chiqim bo'lgan kunda kassada 7 mln bo'ladi, tizim esa 10 mln kutib
--      "3 mln KAMOMAD" deb yolg'on ogohlantirish berardi.
--   2. Kun "tasdiqlangan" bo'lsa ham PUL HECH QAYERGA KO'CHMASDI: kassirning
--      kassa qoldig'i (Account ledgeri) avvalgidek qolardi. "Kassir kassasi
--      0 bo'lsin" talabi bajarilmasdi.
--
-- YECHIM: kun yakuni endi mavjud `AccountTransfer` ledgeriga BOG'LANADI
-- (yangi pul jadvali YO'Q — ikkinchi haqiqat manbai yaratilmaydi):
--   - `kutilganNaqd`  — topshirish paytida MUZLATILGAN tizim hisobi
--                       (kassirning shaxsiy kassasi qoldig'i);
--   - `kassaFarq`     — topshirilgan − kutilgan (manfiy = KAMOMAD);
--   - `transferId`    — o'sha topshiriqning `AccountTransfer` IDsi.
--                       Kun tasdiqlanganda AYNAN shu o'tkazma qabul
--                       qilinadi, ya'ni pul kassirdan direktorga ko'chadi.
--                       NULL — pul harakati bo'lmagan kun (naqd 0, yoki
--                       shaxsiy kassa rejimi yoqilmagan biznes);
--   - `izoh`          — kassirning topshirish izohi;
--   - `qarorIzoh`     — direktorning qaror izohi (ayniqsa rad etishda).
--
-- FK ATAYLAB YO'Q (`Deal.transactionId` dan farqli): o'tkazma storno bilan
-- bekor qilinsa ham kun yozuvi qaysi o'tkazmaga tegishli bo'lganini
-- ko'rsatib tursin. Bog'lanish xizmat qatlamida tekshiriladi.
--
-- Barcha ustunlar NULLABLE va jadval QAYTA QURILMAYDI — eski kunlar
-- avvalgidek o'qiladi, ma'lumot yo'qolmaydi.
-- ---------------------------------------------------------------------------

ALTER TABLE "DailyReport" ADD COLUMN "kutilganNaqd" INTEGER;
ALTER TABLE "DailyReport" ADD COLUMN "kassaFarq" INTEGER;
ALTER TABLE "DailyReport" ADD COLUMN "transferId" TEXT;
ALTER TABLE "DailyReport" ADD COLUMN "izoh" TEXT;
ALTER TABLE "DailyReport" ADD COLUMN "qarorIzoh" TEXT;

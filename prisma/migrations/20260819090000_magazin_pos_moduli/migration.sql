-- MAGAZIN (POS / QR / Barcode) MODULI.
--
-- XAVFSIZLIK KAFOLATI: bu migratsiya faqat USTUN QO'SHADI va YANGI JADVAL
-- yaratadi. Bironta jadval qayta qurilmaydi, bironta qator o'chirilmaydi va
-- bironta mavjud qiymat o'zgartirilmaydi. Ya'ni:
--   * kirim/chiqim jamilari, kassa qoldig'i, qarzlar va oylik hisobot
--     raqamlari zarracha o'zgarmaydi;
--   * mavjud bizneslar uchun `Business.magazin` = false bo'lib qoladi —
--     ularda MAGAZIN moduli umuman mavjud emasdek ko'rinadi;
--   * mavjud sotuvlarda `Sale.chekId` NULL bo'lib qoladi — ular avvalgidek
--     bitta mahsulotli sotuv sifatida ishlaydi.
--
-- Modul YOQILGANLIGI bu yerda EMAS, `TenantModule` jadvalida yuritiladi va
-- migratsiya u yerga bironta qator YOZMAYDI — demak hech bir mavjud tenantda
-- MAGAZIN o'z-o'zidan yoqilib qolmaydi.

-- AlterTable: biznes darajasidagi bayroq ("Business.omborli" bilan bir xil qoida).
ALTER TABLE "Business" ADD COLUMN "magazin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: mahsulot kategoriyasi (POS'da tovarni guruhlash uchun).
-- Moliyaviy "Category" jadvaliga ATAYLAB tegilmaydi — u hisobot manbai.
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "ProductCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_businessId_nomi_key" ON "ProductCategory"("businessId", "nomi");
CREATE INDEX "ProductCategory_businessId_isActive_tartib_idx" ON "ProductCategory"("businessId", "isActive", "tartib");

-- CreateTable: POS cheki (kassada bitta to'lovda sotilgan savat).
CREATE TABLE "PosChek" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "raqam" INTEGER NOT NULL,
    "jamiSumma" INTEGER NOT NULL,
    "tolovTuri" TEXT NOT NULL,
    "accountId" TEXT,
    "transactionId" TEXT,
    "debtId" TEXT,
    "contactId" TEXT,
    "mijozNomi" TEXT,
    "mijozTel" TEXT,
    "userId" TEXT NOT NULL,
    "sana" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    CONSTRAINT "PosChek_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PosChek_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
-- Chek raqami biznes ichida takrorlanmaydi — kassir "125-chek" deb ataydi.
CREATE UNIQUE INDEX "PosChek_businessId_raqam_key" ON "PosChek"("businessId", "raqam");
CREATE UNIQUE INDEX "PosChek_debtId_key" ON "PosChek"("debtId");
-- "Bugungi cheklar" — kassaning eng ko'p o'qiladigan ro'yxati.
CREATE INDEX "PosChek_businessId_deletedAt_sana_idx" ON "PosChek"("businessId", "deletedAt", "sana");
CREATE INDEX "PosChek_businessId_createdAt_idx" ON "PosChek"("businessId", "createdAt");
CREATE INDEX "PosChek_contactId_idx" ON "PosChek"("contactId");

-- AlterTable: mahsulotga shtrix-kod, Balansa QR, rasm va tovar kategoriyasi.
-- Barchasi NULL bo'lib qo'shiladi — mavjud mahsulotlar o'zgarmaydi.
ALTER TABLE "Product" ADD COLUMN "barcode" TEXT;
ALTER TABLE "Product" ADD COLUMN "qrKod" TEXT;
ALTER TABLE "Product" ADD COLUMN "rasmUrl" TEXT;
-- FK inline qo'shiladi: SQLite `ADD COLUMN`ga REFERENCES qo'shishga ruxsat
-- beradi (default NULL bo'lsa). Shu bois jadvalni QAYTA QURISH shart emas —
-- `mijozlar_moduli` migratsiyasidagi kabi `CREATE new_X + INSERT SELECT + DROP`
-- yo'li ma'lumot yo'qotish xavfini olib keladi, bu yerda undan qochamiz.
ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT REFERENCES "ProductCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
-- DIQQAT: unique BIZNES ICHIDA. Global unique ATAYLAB emas — bir xil
-- Coca-Cola'ni yuzlab do'kon sotadi, global cheklov ikkinchi mijozga
-- mahsulot qo'shishga yo'l bermasdi. SQLite'da NULL qiymatlar unique
-- indeksda bir-biriga teng emas, shuning uchun kodsiz mahsulotlar cheklanmaydi.
CREATE UNIQUE INDEX "Product_businessId_barcode_key" ON "Product"("businessId", "barcode");
CREATE UNIQUE INDEX "Product_businessId_qrKod_key" ON "Product"("businessId", "qrKod");
CREATE INDEX "Product_businessId_categoryId_idx" ON "Product"("businessId", "categoryId");

-- AlterTable: sotuv satrini chekka bog'lash.
-- Eski sotuvlarda NULL — ular avvalgidek mustaqil bir mahsulotli sotuv.
ALTER TABLE "Sale" ADD COLUMN "chekId" TEXT REFERENCES "PosChek" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Sale_chekId_idx" ON "Sale"("chekId");

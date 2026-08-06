-- SKU, O'LCHOV BIRLIGI VA OMBOR TO'G'RILASH (Faza 4.3).
--
-- Product'ga: sku (artikul), birlik (dona/kg/litr...), minQoldiq.
-- Ilgari "kam qoldi" ogohlantirishi butun tizim uchun bitta sobit chegara
-- (5 dona) edi — tuxum sotuvchiga ham, avtomobil sotuvchiga ham bir xil.
-- Endi har mahsulotning o'z chegarasi bor (0 = ogohlantirish yo'q).
--
-- StockAdjustment: inventarizatsiya va hisobdan chiqarish. Ilgari qoldiqni
-- to'g'rilashning yagona yo'li mahsulotni qo'lda tahrirlash edi — kim, qachon
-- va NEGA o'zgartirgani hech qayerda qolmasdi.


-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "eskiMiqdor" INTEGER NOT NULL,
    "yangiMiqdor" INTEGER NOT NULL,
    "farq" INTEGER NOT NULL,
    "sabab" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockAdjustment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockAdjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "kelganNarx" INTEGER NOT NULL DEFAULT 0,
    "sotuvNarx" INTEGER NOT NULL DEFAULT 0,
    "miqdor" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "izoh" TEXT,
    "sku" TEXT,
    "birlik" TEXT NOT NULL DEFAULT 'dona',
    "minQoldiq" INTEGER NOT NULL DEFAULT 0,
    "avtoYil" INTEGER,
    "avtoRaqam" TEXT,
    "avtoRang" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("avtoRang", "avtoRaqam", "avtoYil", "businessId", "createdAt", "id", "isActive", "izoh", "kelganNarx", "miqdor", "nomi", "sotuvNarx") SELECT "avtoRang", "avtoRaqam", "avtoYil", "businessId", "createdAt", "id", "isActive", "izoh", "kelganNarx", "miqdor", "nomi", "sotuvNarx" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_businessId_idx" ON "Product"("businessId");
CREATE INDEX "Product_businessId_sku_idx" ON "Product"("businessId", "sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StockAdjustment_businessId_createdAt_idx" ON "StockAdjustment"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "StockAdjustment_productId_idx" ON "StockAdjustment"("productId");


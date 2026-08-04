-- XARID MODULI (Faza 6.1).
--
-- Auditda ta'kidlanganidek, xarid tomoni BUTUNLAY yo'q edi: ta'minotchilar
-- reyestri, xarid buyurtmasi, qabul qilish hujjati va ta'minotchi bilan
-- hisob-kitob — hech biri. Tovar omborga "o'z-o'zidan" tushardi.
--
--   Supplier          — kimdan tovar olamiz (mijozdan alohida: qarzdorlik
--                       yo'nalishi teskari — biz UNGA qarzdormiz);
--   PurchaseOrder     — qoralama -> tasdiqlangan -> qabul_qilingan;
--   PurchaseOrderItem — qaysi mahsulotdan qancha va qanday narxda.
--
-- Ombor va pul harakati FAQAT qabul qilinganda yoziladi — reja bilan
-- haqiqat aralashmasligi kerak.


-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "tel" TEXT,
    "manzil" TEXT,
    "izoh" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "holat" TEXT NOT NULL DEFAULT 'qoralama',
    "sana" DATETIME NOT NULL,
    "qabulSana" DATETIME,
    "tolovTuri" TEXT NOT NULL DEFAULT 'naqd',
    "jamiSumma" INTEGER NOT NULL DEFAULT 0,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "debtId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "miqdor" INTEGER NOT NULL,
    "birlikNarx" INTEGER NOT NULL,
    "jamiSumma" INTEGER NOT NULL,
    CONSTRAINT "PurchaseOrderItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Supplier_businessId_isActive_idx" ON "Supplier"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "Supplier_businessId_nomi_idx" ON "Supplier"("businessId", "nomi");

-- CreateIndex
CREATE INDEX "PurchaseOrder_businessId_holat_sana_idx" ON "PurchaseOrder"("businessId", "holat", "sana");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_orderId_idx" ON "PurchaseOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_businessId_idx" ON "PurchaseOrderItem"("businessId");


-- PRO YANGILANISH: maxsus rollar, shaxsiy kassalar, foydalanuvchidan
-- foydalanuvchiga pul o'tkazish, ta'minotchi-user bog'lanishi va xaridda
-- qisman to'lov. BARCHA o'zgarishlar ADDITIVE — mavjud ma'lumotga tegilmaydi
-- (xavf: past). Eski yozuvlar uchun yangi ustunlar null/default qiymat oladi.

-- CreateTable: maxsus rol (tenant o'zi yaratadi, huquqlar JSON massiv).
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "izoh" TEXT,
    "huquqlar" TEXT NOT NULL DEFAULT '[]',
    "bazaRol" TEXT NOT NULL DEFAULT 'SELLER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_nomi_key" ON "Role"("tenantId", "nomi");
CREATE INDEX "Role_tenantId_isActive_idx" ON "Role"("tenantId", "isActive");

-- User: maxsus rol va alohida huquq override'lari.
ALTER TABLE "User" ADD COLUMN "roleId" TEXT REFERENCES "Role" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD COLUMN "huquqPlus" TEXT;
ALTER TABLE "User" ADD COLUMN "huquqMinus" TEXT;
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- Account: shaxsiy kassa egasi (null — umumiy biznes kassasi, avvalgi xatti-harakat).
ALTER TABLE "Account" ADD COLUMN "userId" TEXT REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AccountTransfer: user-to-user transfer metama'lumotlari.
-- Ism ustunlari — snapshot (ShiftClose uslubi): user o'chirilsa ham tarix qoladi.
ALTER TABLE "AccountTransfer" ADD COLUMN "valyuta" TEXT NOT NULL DEFAULT 'UZS';
ALTER TABLE "AccountTransfer" ADD COLUMN "fromUserId" TEXT;
ALTER TABLE "AccountTransfer" ADD COLUMN "fromUserIsm" TEXT;
ALTER TABLE "AccountTransfer" ADD COLUMN "toUserId" TEXT;
ALTER TABLE "AccountTransfer" ADD COLUMN "toUserIsm" TEXT;
ALTER TABLE "AccountTransfer" ADD COLUMN "holat" TEXT NOT NULL DEFAULT 'bajarildi';
ALTER TABLE "AccountTransfer" ADD COLUMN "relatedType" TEXT;
ALTER TABLE "AccountTransfer" ADD COLUMN "relatedId" TEXT;
CREATE INDEX "AccountTransfer_businessId_fromUserId_idx" ON "AccountTransfer"("businessId", "fromUserId");
CREATE INDEX "AccountTransfer_businessId_toUserId_idx" ON "AccountTransfer"("businessId", "toUserId");

-- Supplier: tizim foydalanuvchisiga bog'lash (FK ataylab yo'q — reyestr
-- user o'chirilganda buzilmasin; tekshiruv xizmat qatlamida).
ALTER TABLE "Supplier" ADD COLUMN "userId" TEXT;

-- PurchaseOrder: qabul paytidagi qisman to'lov va kassa transferi.
ALTER TABLE "PurchaseOrder" ADD COLUMN "tolanganSumma" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrder" ADD COLUMN "transferId" TEXT;

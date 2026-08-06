-- SOTUV SANASI VA BEKOR QILISH (Faza 4.2, B-4/B-5).
--
-- B-5: `Sale` da faqat `createdAt` bor edi — kechagi sotuvni bugun kiritsangiz
-- u KECHAGI hisobotga tushmasdi. Endi alohida `sana` maydoni bor.
--
-- B-4: sotuvni bekor qilish yo'li UMUMAN yo'q edi. Kassir xato sotuv kiritsa
-- omborda tovar kam, kassada pul ko'p bo'lib qolardi va tuzatib bo'lmasdi —
-- kassa dasturi uchun qabul qilib bo'lmaydigan holat. Endi `deletedAt`,
-- `cancelledBy`, `cancelReason` bor.
--
-- Eski yozuvlar: `sana` `createdAt` dan to'ldiriladi, ya'ni hisobotlar
-- avvalgidek qoladi.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "miqdor" INTEGER NOT NULL,
    "birlikNarx" INTEGER NOT NULL,
    "tannarx" INTEGER NOT NULL,
    "jamiSumma" INTEGER NOT NULL,
    "tolovTuri" TEXT NOT NULL,
    "mijozNomi" TEXT,
    "mijozTel" TEXT,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "sana" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- `sana` YANGI va NOT NULL: eski sotuvlar uchun u `createdAt` dan olinadi va
-- UTC yarim tuniga keltiriladi (loyihadagi sana konvensiyasi: lib/date.ts).
-- typeof tekshiruvi — DateTime matn (libsql) yoki ms INTEGER bo'lishi mumkin.
INSERT INTO "new_Sale" ("birlikNarx", "businessId", "createdAt", "sana", "id", "jamiSumma", "mijozNomi", "mijozTel", "miqdor", "productId", "tannarx", "tolovTuri", "transactionId", "userId")
SELECT "birlikNarx", "businessId", "createdAt",
       CASE WHEN typeof("createdAt") = 'text'
            THEN substr("createdAt", 1, 10) || 'T00:00:00+00:00'
            ELSE "createdAt" END,
       "id", "jamiSumma", "mijozNomi", "mijozTel", "miqdor", "productId", "tannarx", "tolovTuri", "transactionId", "userId"
FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE INDEX "Sale_businessId_sana_idx" ON "Sale"("businessId", "sana");
CREATE INDEX "Sale_businessId_deletedAt_sana_idx" ON "Sale"("businessId", "deletedAt", "sana");
CREATE INDEX "Sale_productId_idx" ON "Sale"("productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- MOBIL SESSIYA TOKENI — native ilova (iOS) uchun.
--
-- FAQAT yangi jadval qo'shiladi. Mavjud jadvallarga, ma'lumotga va veb
-- sessiyasiga (iron-session cookie) UMUMAN tegilmaydi — veb avvalgidek
-- ishlashda davom etadi.
--
-- Token XOM holda saqlanmaydi: faqat SHA-256 xeshi (`tokenHash`), u ham
-- unique. Baza o'g'irlansa tokenlarni ishlatib bo'lmaydi.
--
-- `userId` ga CASCADE: foydalanuvchi o'chirilsa (yoki kompaniya butunlay
-- o'chirilsa — lib/db/hisobOchirish.ts) tokenlar o'zi ketadi, yetim
-- qator qolmaydi.

-- CreateTable
CREATE TABLE "MobileToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceNom" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "ishlatilganAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MobileToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileToken_tokenHash_key" ON "MobileToken"("tokenHash");
CREATE INDEX "MobileToken_userId_turi_idx" ON "MobileToken"("userId", "turi");
CREATE INDEX "MobileToken_userId_deviceId_idx" ON "MobileToken"("userId", "deviceId");
CREATE INDEX "MobileToken_expiresAt_idx" ON "MobileToken"("expiresAt");

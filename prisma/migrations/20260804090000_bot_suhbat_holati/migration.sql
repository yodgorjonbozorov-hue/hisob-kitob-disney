-- Telegram botdagi ko'p qadamli suhbat holati (C-3).
-- Production'da bot serverless webhook orqali ishlaydi: har so'rov boshqa
-- instansiyaga tushishi mumkin, shuning uchun holat xotirada emas, bazada.
-- Bu VAQTINCHALIK jadval — zaxiraga kirmaydi, 24 soatdan keyin cron tozalaydi.

-- CreateTable
CREATE TABLE "BotConversation" (
    "chatId" TEXT NOT NULL PRIMARY KEY,
    "flow" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "BotConversation_updatedAt_idx" ON "BotConversation"("updatedAt");

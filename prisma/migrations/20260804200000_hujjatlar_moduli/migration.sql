-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "raqam" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "turi" TEXT NOT NULL DEFAULT 'mijoz',
    "contactId" TEXT,
    "supplierId" TEXT,
    "kontragent" TEXT,
    "summa" INTEGER NOT NULL DEFAULT 0,
    "boshlanish" DATETIME NOT NULL,
    "tugash" DATETIME,
    "eslatmaKun" INTEGER NOT NULL DEFAULT 30,
    "holat" TEXT NOT NULL DEFAULT 'faol',
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Contract_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contract_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "saqlagich" TEXT NOT NULL DEFAULT 'havola',
    "mimeType" TEXT,
    "hajm" INTEGER,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Attachment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Contract_businessId_holat_tugash_idx" ON "Contract"("businessId", "holat", "tugash");

-- CreateIndex
CREATE INDEX "Contract_contactId_idx" ON "Contract"("contactId");

-- CreateIndex
CREATE INDEX "Contract_supplierId_idx" ON "Contract"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_businessId_raqam_key" ON "Contract"("businessId", "raqam");

-- CreateIndex
CREATE INDEX "Attachment_businessId_entity_entityId_idx" ON "Attachment"("businessId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "Attachment_businessId_createdAt_idx" ON "Attachment"("businessId", "createdAt");


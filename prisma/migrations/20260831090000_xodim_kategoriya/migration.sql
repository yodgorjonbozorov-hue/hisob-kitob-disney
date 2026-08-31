-- XODIM KATEGORIYALARI VA ZAKAZ-XODIM BIRIKTIRUVI (CRM samaradorlik).
-- FAQAT QO'SHUVCHI migratsiya: mavjud jadvallar qayta qurilmaydi, eski
-- yozuvlar tegilmaydi. Biriktiruvsiz eski buyurtmalar to'liq amalda qoladi.

-- Xodim kategoriyasi (yo'nalish): Sotuvchi, Diktor, Shofer, ... — biznes
-- o'zi sozlaydi. `turi`: "sotuvchi" (savdo KPI) | "ijrochi" (bajarilgan ish).
-- O'chirish yo'q — faqat `aktiv=false` (tarix saqlansin).
CREATE TABLE "EmployeeCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "turi" TEXT NOT NULL DEFAULT 'ijrochi',
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeeCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmployeeCategory_businessId_nomi_key" ON "EmployeeCategory" ("businessId", "nomi");

CREATE INDEX "EmployeeCategory_businessId_aktiv_tartib_idx" ON "EmployeeCategory" ("businessId", "aktiv", "tartib");

-- Kategoriya a'zoligi — bir xodim bir nechta kategoriyada bo'la oladi.
CREATE TABLE "EmployeeCategoryMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeCategoryMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeCategoryMember_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EmployeeCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeCategoryMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmployeeCategoryMember_categoryId_employeeId_key" ON "EmployeeCategoryMember" ("categoryId", "employeeId");

CREATE INDEX "EmployeeCategoryMember_businessId_employeeId_idx" ON "EmployeeCategoryMember" ("businessId", "employeeId");

CREATE INDEX "EmployeeCategoryMember_employeeId_idx" ON "EmployeeCategoryMember" ("employeeId");

-- Zakazdagi xodim — MOLIYAVIY YOZUV EMAS: pul faqat Deal.transactionId
-- (CRM→Kirim) orqali. Kategoriya/xodimga RESTRICT — tarixiy biriktiruv
-- tasodifan yo'qolmasin (ikkalasi amalda soft o'chiriladi).
CREATE TABLE "DealEmployee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DealEmployee_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DealEmployee_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DealEmployee_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EmployeeCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DealEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DealEmployee_dealId_categoryId_employeeId_key" ON "DealEmployee" ("dealId", "categoryId", "employeeId");

-- Kategoriya analitikasi (davr kesimida xodim reytingi) — asosiy o'qish.
CREATE INDEX "DealEmployee_businessId_categoryId_employeeId_idx" ON "DealEmployee" ("businessId", "categoryId", "employeeId");

CREATE INDEX "DealEmployee_businessId_employeeId_idx" ON "DealEmployee" ("businessId", "employeeId");

CREATE INDEX "DealEmployee_dealId_idx" ON "DealEmployee" ("dealId");

CREATE INDEX "DealEmployee_categoryId_idx" ON "DealEmployee" ("categoryId");

CREATE INDEX "DealEmployee_employeeId_idx" ON "DealEmployee" ("employeeId");

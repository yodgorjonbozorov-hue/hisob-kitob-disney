-- XODIMLAR KENGAYTMASI: profil rasmi, oylik plan va xodim vazifalari.
-- FAQAT QO'SHUVCHI migratsiya: jadval qayta qurilmaydi, mavjud yozuvlar tegilmaydi.

-- Xodim profil rasmi (blob URL yoki tashqi havola). Null — bosh harfli avatar.
ALTER TABLE "Employee" ADD COLUMN "rasmUrl" TEXT;

-- Vazifani xodim kartochkasiga bog'lash (HR moduli). Null — oddiy CRM vazifasi.
ALTER TABLE "Task" ADD COLUMN "employeeId" TEXT REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Muhimlik: "past" | "orta" | "yuqori".
ALTER TABLE "Task" ADD COLUMN "muhimlik" TEXT NOT NULL DEFAULT 'orta';

-- Boshlanish sanasi (UTC-yarim tun). Null — darhol.
ALTER TABLE "Task" ADD COLUMN "boshlanish" DATETIME;

-- Xodim vazifalari kesimi (kartochka/plan hisobi).
CREATE INDEX "Task_businessId_employeeId_holat_idx" ON "Task" ("businessId", "employeeId", "holat");

-- `ON DELETE SET NULL` tekshiruvi uchun (xodim o'chirilganda SQLite bola
-- jadvalni skanerlaydi).
CREATE INDEX "Task_employeeId_idx" ON "Task" ("employeeId");

-- XODIM OYLIK PLANI — bir xodim + bir oy = bitta yozuv. Natija (actual)
-- ATAYLAB saqlanmaydi: u har o'qishda manbadan hisoblanadi.
CREATE TABLE "EmployeePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oy" TEXT NOT NULL,
    "planTuri" TEXT NOT NULL DEFAULT 'zakaz',
    "maqsad" INTEGER NOT NULL,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeePlan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeePlan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmployeePlan_employeeId_oy_key" ON "EmployeePlan" ("employeeId", "oy");

CREATE INDEX "EmployeePlan_businessId_oy_idx" ON "EmployeePlan" ("businessId", "oy");

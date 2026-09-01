-- XODIMLAR KPI / BALL / OYLIK moduli.
--
-- FAQAT QO'SHUVCHI migratsiya: birorta mavjud jadval qayta qurilmaydi,
-- birorta ustun o'zgartirilmaydi yoki o'chirilmaydi. Eski ma'lumot
-- tegilmaydi — modul yoqilmaguncha tizim avvalgidek ishlaydi.

-- KPI sozlamalari — bir biznesga bitta yozuv.
CREATE TABLE "KpiSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "mavsumOylar" TEXT NOT NULL DEFAULT '3,5,6,7,8,9,10,11,12',
    "mavsumPlan" INTEGER NOT NULL DEFAULT 100000000,
    "mavsumsizPlan" INTEGER NOT NULL DEFAULT 80000000,
    "planBonus" INTEGER NOT NULL DEFAULT 1000000,
    "boshlangichBall" INTEGER NOT NULL DEFAULT 100,
    "kunlikLimit" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KpiSetting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "KpiSetting_businessId_key" ON "KpiSetting" ("businessId");

-- Progressiv sotuv bonusi intervallari. `foiz` — yuzdan bir aniqlikda
-- butun son (2% → 200): loyihada float taqiqlangan.
CREATE TABLE "KpiSalesBracket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "dan" INTEGER NOT NULL,
    "gacha" INTEGER,
    "foiz" INTEGER NOT NULL,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KpiSalesBracket_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "KpiSalesBracket_businessId_tartib_idx" ON "KpiSalesBracket" ("businessId", "tartib");

-- Ball → vazifa haqi foizi jadvali (chegaralar inclusive).
CREATE TABLE "KpiScoreRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "minBall" INTEGER NOT NULL,
    "maxBall" INTEGER NOT NULL,
    "foiz" INTEGER NOT NULL,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KpiScoreRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "KpiScoreRule_businessId_tartib_idx" ON "KpiScoreRule" ("businessId", "tartib");

-- KPI vazifasi — har oy takrorlanadigan, oylik haqi bor majburiyat.
-- O'chirish YUMSHOQ: ball tarixi va yopilgan oylik havolasiz qolmasin.
CREATE TABLE "KpiTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "izoh" TEXT,
    "oylikHaq" INTEGER NOT NULL DEFAULT 0,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "KpiTask_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "KpiTask_businessId_aktiv_tartib_idx" ON "KpiTask" ("businessId", "aktiv", "tartib");

-- Vazifa biriktiruvi. `aktiv=false` — olib tashlangan, lekin yozuv qoladi.
CREATE TABLE "KpiTaskAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KpiTaskAssignment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KpiTaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KpiTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KpiTaskAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "KpiTaskAssignment_taskId_employeeId_key" ON "KpiTaskAssignment" ("taskId", "employeeId");

CREATE INDEX "KpiTaskAssignment_businessId_employeeId_aktiv_idx" ON "KpiTaskAssignment" ("businessId", "employeeId", "aktiv");

CREATE INDEX "KpiTaskAssignment_employeeId_idx" ON "KpiTaskAssignment" ("employeeId");

CREATE INDEX "KpiTaskAssignment_taskId_idx" ON "KpiTaskAssignment" ("taskId");

-- Tayyor jarima sababi. `taskId` null — global sabab.
-- `kritik=true` — ishonch buzilishi, kunlik limitga kirmaydi.
CREATE TABLE "KpiPenaltyPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "taskId" TEXT,
    "sabab" TEXT NOT NULL,
    "ball" INTEGER NOT NULL,
    "kritik" BOOLEAN NOT NULL DEFAULT false,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KpiPenaltyPreset_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KpiPenaltyPreset_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KpiTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "KpiPenaltyPreset_businessId_aktiv_tartib_idx" ON "KpiPenaltyPreset" ("businessId", "aktiv", "tartib");

CREATE INDEX "KpiPenaltyPreset_taskId_idx" ON "KpiPenaltyPreset" ("taskId");

-- Ball tranzaksiyasi — audit jurnali VA ballning yagona manbai.
-- Tahrirlanmaydi/o'chirilmaydi: tuzatish faqat "qaytarish" yozuvi bilan.
CREATE TABLE "KpiPointLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "oy" TEXT NOT NULL,
    "sana" DATETIME NOT NULL,
    "ball" INTEGER NOT NULL,
    "ballOldin" INTEGER NOT NULL,
    "ballKeyin" INTEGER NOT NULL,
    "sabab" TEXT NOT NULL,
    "izoh" TEXT,
    "turi" TEXT NOT NULL DEFAULT 'jarima',
    "kritik" BOOLEAN NOT NULL DEFAULT false,
    "presetId" TEXT,
    "bekorQilinganId" TEXT,
    "userId" TEXT NOT NULL,
    "userIsm" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KpiPointLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KpiPointLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KpiPointLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KpiTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Bir yozuv IKKI marta qaytarilmaydi — kafolat baza darajasida.
CREATE UNIQUE INDEX "KpiPointLog_bekorQilinganId_key" ON "KpiPointLog" ("bekorQilinganId");

CREATE INDEX "KpiPointLog_businessId_employeeId_oy_idx" ON "KpiPointLog" ("businessId", "employeeId", "oy");

CREATE INDEX "KpiPointLog_businessId_oy_idx" ON "KpiPointLog" ("businessId", "oy");

-- Kunlik limit tekshiruvi: (xodim, vazifa, sana).
CREATE INDEX "KpiPointLog_employeeId_taskId_sana_idx" ON "KpiPointLog" ("employeeId", "taskId", "sana");

CREATE INDEX "KpiPointLog_taskId_idx" ON "KpiPointLog" ("taskId");

-- Xodimning oylik sotuv plani — standartdan farq qilsa yoziladi.
CREATE TABLE "KpiSalesTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oy" TEXT NOT NULL,
    "maqsad" INTEGER NOT NULL,
    "planBonus" INTEGER,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KpiSalesTarget_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KpiSalesTarget_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "KpiSalesTarget_employeeId_oy_key" ON "KpiSalesTarget" ("employeeId", "oy");

CREATE INDEX "KpiSalesTarget_businessId_oy_idx" ON "KpiSalesTarget" ("businessId", "oy");

-- Oy yopilgandagi oylik snapshot'i. Yozuv yo'q — oy ochiq (real vaqt hisobi).
CREATE TABLE "KpiPayroll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oy" TEXT NOT NULL,
    "sotuv" INTEGER NOT NULL DEFAULT 0,
    "plan" INTEGER NOT NULL DEFAULT 0,
    "vazifaHaqi" INTEGER NOT NULL DEFAULT 0,
    "sotuvBonusi" INTEGER NOT NULL DEFAULT 0,
    "planBonusi" INTEGER NOT NULL DEFAULT 0,
    "tuzatish" INTEGER NOT NULL DEFAULT 0,
    "jami" INTEGER NOT NULL DEFAULT 0,
    "holat" TEXT NOT NULL DEFAULT 'HISOBLANDI',
    "hisoblanganAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tasdiqlaganId" TEXT,
    "tasdiqlanganAt" DATETIME,
    "tolaganId" TEXT,
    "tolanganAt" DATETIME,
    "tolanganSumma" INTEGER,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KpiPayroll_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KpiPayroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Bir xodim, bir oy — BITTA snapshot (ikki marta yopib bo'lmaydi).
CREATE UNIQUE INDEX "KpiPayroll_employeeId_oy_key" ON "KpiPayroll" ("employeeId", "oy");

CREATE INDEX "KpiPayroll_businessId_oy_holat_idx" ON "KpiPayroll" ("businessId", "oy", "holat");

-- Snapshot qatori: vazifa nomi va narxi ham KO'CHIRILADI (keyin o'zgarsa
-- yopilgan oy hisoboti o'zgarmasin).
CREATE TABLE "KpiPayrollItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "taskId" TEXT,
    "taskNomi" TEXT NOT NULL,
    "oylikHaq" INTEGER NOT NULL,
    "ball" INTEGER NOT NULL,
    "foiz" INTEGER NOT NULL,
    "hisoblangan" INTEGER NOT NULL,
    CONSTRAINT "KpiPayrollItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KpiPayrollItem_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "KpiPayroll" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KpiPayrollItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KpiTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "KpiPayrollItem_payrollId_idx" ON "KpiPayrollItem" ("payrollId");

CREATE INDEX "KpiPayrollItem_taskId_idx" ON "KpiPayrollItem" ("taskId");

-- Yopilgan oylikka tuzatish — snapshot raqami o'zgarmaydi, tuzatish
-- ALOHIDA qator bo'lib qo'shiladi (kim, qachon, nega ko'rinadi).
CREATE TABLE "KpiPayrollAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "sabab" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userIsm" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KpiPayrollAdjustment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KpiPayrollAdjustment_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "KpiPayroll" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "KpiPayrollAdjustment_payrollId_idx" ON "KpiPayrollAdjustment" ("payrollId");

CREATE INDEX "KpiPayrollAdjustment_businessId_createdAt_idx" ON "KpiPayrollAdjustment" ("businessId", "createdAt");

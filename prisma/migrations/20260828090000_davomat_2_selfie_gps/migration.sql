-- ---------------------------------------------------------------------------
-- DAVOMAT 2.0 — Xodimlar moduli: selfie + GPS davomat, ish jadvali, ish joyi,
-- jarima qoidalari, jarima/bonus va oylik integratsiyasi.
--
-- FAQAT QO'SHUVCHI o'zgarish: 9 ta yangi jadval (CREATE TABLE) va mavjud
-- Attendance/Employee/Payroll jadvallariga NULL yoki konstanta-default
-- ustunlar (ALTER TABLE ADD COLUMN). Hech bir jadval qayta qurilmaydi,
-- hech qanday ma'lumot o'chirilmaydi — mavjud HR-lite oqimi avvalgidek
-- ishlayveradi (yangi ustunlar eski yozuvlarda default qiymatda qoladi).
-- ---------------------------------------------------------------------------

-- ISH JOYI — GPS radius tekshiruvi nuqtasi (ofis, do'kon, filial).
CREATE TABLE "WorkLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "radiusM" INTEGER NOT NULL DEFAULT 100,
    "standart" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "WorkLocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkLocation_businessId_isActive_idx" ON "WorkLocation"("businessId", "isActive");

-- ISH JADVALI — haftalik shablon (kunlari WorkScheduleDay da).
CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "imtiyozDaqiqa" INTEGER NOT NULL DEFAULT 5,
    "standart" BOOLEAN NOT NULL DEFAULT false,
    "kuchgaKirgan" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "WorkSchedule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkSchedule_businessId_isActive_idx" ON "WorkSchedule"("businessId", "isActive");

-- JADVAL KUNI — haftaning bir kuni (0=Yakshanba ... 6=Shanba, JS getUTCDay).
CREATE TABLE "WorkScheduleDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "hafta" INTEGER NOT NULL,
    "ishKuni" BOOLEAN NOT NULL DEFAULT true,
    "boshlanish" TEXT,
    "tugash" TEXT,
    CONSTRAINT "WorkScheduleDay_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkScheduleDay_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkScheduleDay_scheduleId_hafta_key" ON "WorkScheduleDay"("scheduleId", "hafta");
CREATE INDEX "WorkScheduleDay_businessId_idx" ON "WorkScheduleDay"("businessId");

-- DAVOMAT SELFIESI — maxfiy; faqat avtorizatsiyalangan API orqali beriladi.
CREATE TABLE "AttendanceSelfie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "saqlagich" TEXT NOT NULL,
    "url" TEXT,
    "mazmun" TEXT,
    "mimeType" TEXT NOT NULL,
    "hajm" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceSelfie_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceSelfie_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AttendanceSelfie_businessId_employeeId_createdAt_idx" ON "AttendanceSelfie"("businessId", "employeeId", "createdAt");

-- DAVOMAT TEKSHIRUVI — har kelish/ketish hodisasining o'zgarmas dalili.
CREATE TABLE "AttendanceCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "vaqt" DATETIME NOT NULL,
    "manba" TEXT NOT NULL DEFAULT 'selfie_gps',
    "lat" REAL,
    "lng" REAL,
    "aniqlikM" INTEGER,
    "masofaM" INTEGER,
    "ruxsatRadiusM" INTEGER,
    "workLocationId" TEXT,
    "selfieId" TEXT,
    "userId" TEXT,
    "sabab" TEXT,
    "oldingiVaqt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceCheck_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceCheck_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceCheck_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceCheck_workLocationId_fkey" FOREIGN KEY ("workLocationId") REFERENCES "WorkLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AttendanceCheck_selfieId_fkey" FOREIGN KEY ("selfieId") REFERENCES "AttendanceSelfie" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AttendanceCheck_selfieId_key" ON "AttendanceCheck"("selfieId");
CREATE INDEX "AttendanceCheck_businessId_vaqt_idx" ON "AttendanceCheck"("businessId", "vaqt");
CREATE INDEX "AttendanceCheck_attendanceId_idx" ON "AttendanceCheck"("attendanceId");
CREATE INDEX "AttendanceCheck_employeeId_vaqt_idx" ON "AttendanceCheck"("employeeId", "vaqt");
CREATE INDEX "AttendanceCheck_workLocationId_idx" ON "AttendanceCheck"("workLocationId");

-- JARIMA QOIDASI — biznes o'zi sozlaydi (hardcode yo'q).
CREATE TABLE "PenaltyRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "turi" TEXT NOT NULL DEFAULT 'kechikish',
    "minDaqiqa" INTEGER NOT NULL DEFAULT 0,
    "maxDaqiqa" INTEGER,
    "summa" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "PenaltyRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PenaltyRule_businessId_isActive_idx" ON "PenaltyRule"("businessId", "isActive");

-- XODIM JARIMASI — oylikka faqat "tasdiqlandi" holati kiradi.
CREATE TABLE "EmployeePenalty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "ruleId" TEXT,
    "sana" DATETIME NOT NULL,
    "summa" INTEGER NOT NULL,
    "aslSumma" INTEGER NOT NULL,
    "sabab" TEXT NOT NULL,
    "manba" TEXT NOT NULL DEFAULT 'avto',
    "holat" TEXT NOT NULL DEFAULT 'kutilmoqda',
    "tasdiqlaganId" TEXT,
    "tasdiqlanganAt" DATETIME,
    "radEtganId" TEXT,
    "radEtilganAt" DATETIME,
    "izoh" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeePenalty_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmployeePenalty_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmployeePenalty_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmployeePenalty_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PenaltyRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "EmployeePenalty_businessId_holat_sana_idx" ON "EmployeePenalty"("businessId", "holat", "sana");
CREATE INDEX "EmployeePenalty_employeeId_sana_idx" ON "EmployeePenalty"("employeeId", "sana");
CREATE INDEX "EmployeePenalty_attendanceId_idx" ON "EmployeePenalty"("attendanceId");
CREATE INDEX "EmployeePenalty_ruleId_idx" ON "EmployeePenalty"("ruleId");
-- BAZA DARAJASIDAGI himoya: bitta davomat yozuviga bittadan ortiq AVTOMATIK
-- jarima yozilmaydi (ikki parallel so'rov ham, cron takrori ham chetlab
-- o'tolmaydi). Qo'lda jarimalar cheklanmaydi. Prisma sxemasida qisman
-- (partial) indeks ifodalanmaydi, shuning uchun u shu yerda yoziladi.
CREATE UNIQUE INDEX "EmployeePenalty_avto_attendance_key" ON "EmployeePenalty"("attendanceId") WHERE "manba" = 'avto' AND "attendanceId" IS NOT NULL;

-- XODIM BONUSI.
CREATE TABLE "EmployeeBonus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sana" DATETIME NOT NULL,
    "summa" INTEGER NOT NULL,
    "sabab" TEXT NOT NULL,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeBonus_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmployeeBonus_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "EmployeeBonus_businessId_sana_idx" ON "EmployeeBonus"("businessId", "sana");
CREATE INDEX "EmployeeBonus_employeeId_sana_idx" ON "EmployeeBonus"("employeeId", "sana");

-- HR SOZLAMALARI — bir biznesga bitta yozuv.
CREATE TABLE "HrSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "xodimOylikKoradi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HrSetting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HrSetting_businessId_key" ON "HrSetting"("businessId");

-- Attendance: kelish/ketish vaqtlari, kechikish hisobi va jadval snapshot'i.
-- Barcha ustunlar NULL yoki konstanta-default — jadval qayta qurilmaydi.
ALTER TABLE "Attendance" ADD COLUMN "kelganVaqt" DATETIME;
ALTER TABLE "Attendance" ADD COLUMN "ketganVaqt" DATETIME;
ALTER TABLE "Attendance" ADD COLUMN "kechikishDaqiqa" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Attendance" ADD COLUMN "jarimaDaqiqa" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Attendance" ADD COLUMN "ertaKetishDaqiqa" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Attendance" ADD COLUMN "ortiqchaDaqiqa" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Attendance" ADD COLUMN "ishlanganDaqiqa" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Attendance" ADD COLUMN "rejaBoshlanish" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "rejaTugash" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "rejaImtiyoz" INTEGER;
ALTER TABLE "Attendance" ADD COLUMN "manba" TEXT;

-- Employee: jadval/ish joyi biriktiruvi va davomat siyosati.
ALTER TABLE "Employee" ADD COLUMN "workScheduleId" TEXT REFERENCES "WorkSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD COLUMN "workLocationId" TEXT REFERENCES "WorkLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD COLUMN "selfieTalab" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Employee" ADD COLUMN "gpsTalab" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Employee" ADD COLUMN "radiusTalab" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "Employee_workScheduleId_idx" ON "Employee"("workScheduleId");
CREATE INDEX "Employee_workLocationId_idx" ON "Employee"("workLocationId");

-- Payroll: bonus/jarima yig'indilari (snapshot; formulaga qo'shiladi).
ALTER TABLE "Payroll" ADD COLUMN "bonuslar" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payroll" ADD COLUMN "jarimalar" INTEGER NOT NULL DEFAULT 0;

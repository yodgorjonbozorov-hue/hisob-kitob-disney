-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "ism" TEXT NOT NULL,
    "lavozim" TEXT,
    "tel" TEXT,
    "stavka" INTEGER NOT NULL DEFAULT 0,
    "stavkaTuri" TEXT NOT NULL DEFAULT 'oylik',
    "ishBoshlagan" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "izoh" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Employee_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sana" DATETIME NOT NULL,
    "holat" TEXT NOT NULL DEFAULT 'keldi',
    "izoh" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attendance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollAdvance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oy" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "sana" DATETIME NOT NULL,
    "izoh" TEXT,
    "transactionId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollAdvance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PayrollAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PayrollAdvance_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oy" TEXT NOT NULL,
    "yarimKunlar" INTEGER NOT NULL DEFAULT 0,
    "hisoblangan" INTEGER NOT NULL DEFAULT 0,
    "qoshimcha" INTEGER NOT NULL DEFAULT 0,
    "ushlab" INTEGER NOT NULL DEFAULT 0,
    "avans" INTEGER NOT NULL DEFAULT 0,
    "tolanadigan" INTEGER NOT NULL DEFAULT 0,
    "holat" TEXT NOT NULL DEFAULT 'qoralama',
    "tolanganSana" DATETIME,
    "transactionId" TEXT,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payroll_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payroll_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Employee_businessId_isActive_deletedAt_idx" ON "Employee"("businessId", "isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "Employee_userId_idx" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Attendance_businessId_sana_idx" ON "Attendance"("businessId", "sana");

-- CreateIndex
CREATE INDEX "Attendance_employeeId_sana_idx" ON "Attendance"("employeeId", "sana");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_employeeId_sana_key" ON "Attendance"("employeeId", "sana");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollAdvance_transactionId_key" ON "PayrollAdvance"("transactionId");

-- CreateIndex
CREATE INDEX "PayrollAdvance_businessId_oy_idx" ON "PayrollAdvance"("businessId", "oy");

-- CreateIndex
CREATE INDEX "PayrollAdvance_employeeId_oy_idx" ON "PayrollAdvance"("employeeId", "oy");

-- CreateIndex
CREATE INDEX "PayrollAdvance_transactionId_idx" ON "PayrollAdvance"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_transactionId_key" ON "Payroll"("transactionId");

-- CreateIndex
CREATE INDEX "Payroll_businessId_oy_holat_idx" ON "Payroll"("businessId", "oy", "holat");

-- CreateIndex
CREATE INDEX "Payroll_transactionId_idx" ON "Payroll"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_employeeId_oy_key" ON "Payroll"("employeeId", "oy");


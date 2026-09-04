-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "plan" TEXT NOT NULL DEFAULT 'STANDARD',
    "bepul" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "izoh" TEXT,
    "huquqlar" TEXT NOT NULL DEFAULT '[]',
    "bazaRol" TEXT NOT NULL DEFAULT 'SELLER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantModule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sozlamalar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "plan" TEXT,
    "izoh" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerState" INTEGER,
    "providerCreatedAt" TIMESTAMP(3),
    "cancelTime" TIMESTAMP(3),
    "cancelReason" INTEGER,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "omborli" BOOLEAN NOT NULL DEFAULT false,
    "turi" TEXT NOT NULL DEFAULT 'umumiy',
    "yonalish" TEXT,
    "shaxsiyKassa" BOOLEAN NOT NULL DEFAULT false,
    "magazin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "ism" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "parolHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "superadminRol" TEXT,
    "sessionEpoch" INTEGER NOT NULL DEFAULT 0,
    "tenantId" TEXT,
    "businessId" TEXT,
    "telegramChatId" TEXT,
    "linkCode" TEXT,
    "linkCodeExpiresAt" TIMESTAMP(3),
    "roleId" TEXT,
    "huquqPlus" TEXT,
    "huquqMinus" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBusiness" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBusiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AiSuhbat" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sarlavha" TEXT NOT NULL,
    "xabarlar" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSuhbat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotConversation" (
    "chatId" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConversation_pkey" PRIMARY KEY ("chatId")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "turi" TEXT NOT NULL DEFAULT 'naqd',
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTransfer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "valyuta" TEXT NOT NULL DEFAULT 'UZS',
    "sana" TIMESTAMP(3) NOT NULL,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "fromUserIsm" TEXT,
    "toUserId" TEXT,
    "toUserIsm" TEXT,
    "turi" TEXT NOT NULL DEFAULT 'transfer',
    "holat" TEXT NOT NULL DEFAULT 'bajarildi',
    "legacyCashHandoverId" TEXT,
    "tasdiqlaganId" TEXT,
    "tasdiqlaganIsm" TEXT,
    "tasdiqlanganAt" TIMESTAMP(3),
    "radAt" TIMESTAMP(3),
    "qarorIzoh" TEXT,
    "hisoblangan" INTEGER,
    "farq" INTEGER,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "kgAsosli" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessId" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "accountId" TEXT,
    "tolovTuri" TEXT,
    "summa" INTEGER NOT NULL,
    "miqdorGr" INTEGER,
    "kgNarxi" INTEGER,
    "sana" TIMESTAMP(3) NOT NULL,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "sotuvchiId" TEXT,
    "filial" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "businessId" TEXT,
    "userId" TEXT,
    "userIsm" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "sabab" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftClose" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userIsm" TEXT,
    "sana" TIMESTAMP(3) NOT NULL,
    "kutilganNaqd" INTEGER NOT NULL,
    "sanalganNaqd" INTEGER NOT NULL,
    "farq" INTEGER NOT NULL,
    "izoh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringTransaction" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "izoh" TEXT,
    "kun" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastGenerated" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "oy" TEXT NOT NULL,
    "limitSumma" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "kelganNarx" INTEGER NOT NULL DEFAULT 0,
    "sotuvNarx" INTEGER NOT NULL DEFAULT 0,
    "miqdor" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "izoh" TEXT,
    "sku" TEXT,
    "birlik" TEXT NOT NULL DEFAULT 'dona',
    "minQoldiq" INTEGER NOT NULL DEFAULT 0,
    "barcode" TEXT,
    "qrKod" TEXT,
    "rasmUrl" TEXT,
    "categoryId" TEXT,
    "avtoYil" INTEGER,
    "avtoRaqam" TEXT,
    "avtoRang" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "eskiMiqdor" INTEGER NOT NULL,
    "yangiMiqdor" INTEGER NOT NULL,
    "farq" INTEGER NOT NULL,
    "sabab" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductExpense" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "debtId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockEntry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "miqdor" INTEGER NOT NULL,
    "birlikNarx" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "izoh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "miqdor" INTEGER NOT NULL,
    "birlikNarx" INTEGER NOT NULL,
    "tannarx" INTEGER NOT NULL,
    "jamiSumma" INTEGER NOT NULL,
    "tolovTuri" TEXT NOT NULL,
    "contactId" TEXT,
    "mijozNomi" TEXT,
    "mijozTel" TEXT,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "sana" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    "chekId" TEXT,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "turi" TEXT NOT NULL DEFAULT 'olinadigan',
    "saleId" TEXT,
    "productId" TEXT,
    "contactId" TEXT,
    "mijozNomi" TEXT NOT NULL,
    "mijozTel" TEXT,
    "jamiSumma" INTEGER NOT NULL,
    "tolangan" INTEGER NOT NULL DEFAULT 0,
    "isYopilgan" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "sana" TIMESTAMP(3),
    "categoryId" TEXT,
    "masulId" TEXT,
    "masulIsm" TEXT,
    "manbaTransactionId" TEXT,
    "muddat" TIMESTAMP(3),
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "userId" TEXT,
    "tel" TEXT,
    "manzil" TEXT,
    "izoh" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "holat" TEXT NOT NULL DEFAULT 'qoralama',
    "sana" TIMESTAMP(3) NOT NULL,
    "qabulSana" TIMESTAMP(3),
    "tolovTuri" TEXT NOT NULL DEFAULT 'naqd',
    "jamiSumma" INTEGER NOT NULL DEFAULT 0,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "debtId" TEXT,
    "tolanganSumma" INTEGER NOT NULL DEFAULT 0,
    "transferId" TEXT,
    "idempotencyKey" TEXT,
    "bekorSana" TIMESTAMP(3),
    "bekorSabab" TEXT,
    "bekorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "miqdor" INTEGER NOT NULL,
    "birlikNarx" INTEGER NOT NULL,
    "jamiSumma" INTEGER NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ism" TEXT NOT NULL,
    "tel" TEXT,
    "telegram" TEXT,
    "manzil" TEXT,
    "masulShaxs" TEXT,
    "izoh" TEXT,
    "createdBy" TEXT NOT NULL,
    "qarzLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "turi" TEXT NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "contactId" TEXT,
    "nomi" TEXT NOT NULL,
    "summa" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT,
    "stageId" TEXT NOT NULL,
    "masulId" TEXT NOT NULL,
    "createdBy" TEXT,
    "manba" TEXT,
    "sana" TIMESTAMP(3),
    "muddat" TIMESTAMP(3),
    "yopilganAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "holat" TEXT NOT NULL DEFAULT 'KUTILMOQDA',
    "tolangan" INTEGER NOT NULL DEFAULT 0,
    "tolovTuri" TEXT,
    "debtId" TEXT,
    "izoh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "izoh" TEXT,
    "holat" TEXT NOT NULL DEFAULT 'OCHIQ',
    "masulId" TEXT NOT NULL,
    "employeeId" TEXT,
    "muhimlik" TEXT NOT NULL DEFAULT 'orta',
    "boshlanish" TIMESTAMP(3),
    "muddat" TIMESTAMP(3),
    "dealId" TEXT,
    "createdBy" TEXT NOT NULL,
    "bajarildiAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "contactId" TEXT,
    "dealId" TEXT,
    "turi" TEXT NOT NULL,
    "matn" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtPayment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "sana" TIMESTAMP(3),
    "tolovTuri" TEXT,
    "accountId" TEXT,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT,
    "chegara" INTEGER NOT NULL,
    "tasdiqlovchiRol" TEXT NOT NULL DEFAULT 'OWNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "izoh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ruleId" TEXT,
    "categoryId" TEXT NOT NULL,
    "accountId" TEXT,
    "summa" INTEGER NOT NULL,
    "sana" TIMESTAMP(3) NOT NULL,
    "izoh" TEXT,
    "filial" TEXT,
    "holat" TEXT NOT NULL DEFAULT 'kutilmoqda',
    "userId" TEXT NOT NULL,
    "tasdiqlovchiId" TEXT,
    "qarorSana" TIMESTAMP(3),
    "radSabab" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "ism" TEXT NOT NULL,
    "lavozim" TEXT,
    "tel" TEXT,
    "rasmUrl" TEXT,
    "stavka" INTEGER NOT NULL DEFAULT 0,
    "stavkaTuri" TEXT NOT NULL DEFAULT 'oylik',
    "ishBoshlagan" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "izoh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "workScheduleId" TEXT,
    "workLocationId" TEXT,
    "selfieTalab" BOOLEAN NOT NULL DEFAULT true,
    "gpsTalab" BOOLEAN NOT NULL DEFAULT true,
    "radiusTalab" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sana" TIMESTAMP(3) NOT NULL,
    "holat" TEXT NOT NULL DEFAULT 'keldi',
    "izoh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kelganVaqt" TIMESTAMP(3),
    "ketganVaqt" TIMESTAMP(3),
    "kechikishDaqiqa" INTEGER NOT NULL DEFAULT 0,
    "jarimaDaqiqa" INTEGER NOT NULL DEFAULT 0,
    "ertaKetishDaqiqa" INTEGER NOT NULL DEFAULT 0,
    "ortiqchaDaqiqa" INTEGER NOT NULL DEFAULT 0,
    "ishlanganDaqiqa" INTEGER NOT NULL DEFAULT 0,
    "rejaBoshlanish" TEXT,
    "rejaTugash" TEXT,
    "rejaImtiyoz" INTEGER,
    "manba" TEXT,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdvance" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oy" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "sana" TIMESTAMP(3) NOT NULL,
    "izoh" TEXT,
    "transactionId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oy" TEXT NOT NULL,
    "yarimKunlar" INTEGER NOT NULL DEFAULT 0,
    "hisoblangan" INTEGER NOT NULL DEFAULT 0,
    "qoshimcha" INTEGER NOT NULL DEFAULT 0,
    "ushlab" INTEGER NOT NULL DEFAULT 0,
    "bonuslar" INTEGER NOT NULL DEFAULT 0,
    "jarimalar" INTEGER NOT NULL DEFAULT 0,
    "avans" INTEGER NOT NULL DEFAULT 0,
    "tolanadigan" INTEGER NOT NULL DEFAULT 0,
    "holat" TEXT NOT NULL DEFAULT 'qoralama',
    "tolanganSana" TIMESTAMP(3),
    "transactionId" TEXT,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLocation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radiusM" INTEGER NOT NULL DEFAULT 100,
    "standart" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WorkLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "imtiyozDaqiqa" INTEGER NOT NULL DEFAULT 5,
    "standart" BOOLEAN NOT NULL DEFAULT false,
    "kuchgaKirgan" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkScheduleDay" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "hafta" INTEGER NOT NULL,
    "ishKuni" BOOLEAN NOT NULL DEFAULT true,
    "boshlanish" TEXT,
    "tugash" TEXT,

    CONSTRAINT "WorkScheduleDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCheck" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "vaqt" TIMESTAMP(3) NOT NULL,
    "manba" TEXT NOT NULL DEFAULT 'selfie_gps',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "aniqlikM" INTEGER,
    "masofaM" INTEGER,
    "ruxsatRadiusM" INTEGER,
    "workLocationId" TEXT,
    "selfieId" TEXT,
    "userId" TEXT,
    "sabab" TEXT,
    "oldingiVaqt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSelfie" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "saqlagich" TEXT NOT NULL,
    "url" TEXT,
    "mazmun" TEXT,
    "mimeType" TEXT NOT NULL,
    "hajm" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceSelfie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenaltyRule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "turi" TEXT NOT NULL DEFAULT 'kechikish',
    "minDaqiqa" INTEGER NOT NULL DEFAULT 0,
    "maxDaqiqa" INTEGER,
    "summa" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PenaltyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePenalty" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "ruleId" TEXT,
    "sana" TIMESTAMP(3) NOT NULL,
    "summa" INTEGER NOT NULL,
    "aslSumma" INTEGER NOT NULL,
    "sabab" TEXT NOT NULL,
    "manba" TEXT NOT NULL DEFAULT 'avto',
    "holat" TEXT NOT NULL DEFAULT 'kutilmoqda',
    "tasdiqlaganId" TEXT,
    "tasdiqlanganAt" TIMESTAMP(3),
    "radEtganId" TEXT,
    "radEtilganAt" TIMESTAMP(3),
    "izoh" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeePenalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeBonus" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sana" TIMESTAMP(3) NOT NULL,
    "summa" INTEGER NOT NULL,
    "sabab" TEXT NOT NULL,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePlan" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oy" TEXT NOT NULL,
    "planTuri" TEXT NOT NULL DEFAULT 'zakaz',
    "maqsad" INTEGER NOT NULL,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCategory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "turi" TEXT NOT NULL DEFAULT 'ijrochi',
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "zakazgaBiriktiriladi" BOOLEAN NOT NULL DEFAULT true,
    "kopXodim" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCategoryMember" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeCategoryMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealEmployee" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "baho" INTEGER,
    "bahoIzoh" TEXT,
    "bahoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealFeedback" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "servisBahosi" INTEGER,
    "etiroz" TEXT,
    "yaxshilash" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrSetting" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "xodimOylikKoradi" BOOLEAN NOT NULL DEFAULT false,
    "crmSotuvchiMajburiy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sana" TIMESTAMP(3) NOT NULL,
    "holat" TEXT NOT NULL DEFAULT 'OPEN',
    "naqdSumma" INTEGER NOT NULL DEFAULT 0,
    "clickSumma" INTEGER NOT NULL DEFAULT 0,
    "qarzSumma" INTEGER NOT NULL DEFAULT 0,
    "jamiSumma" INTEGER NOT NULL DEFAULT 0,
    "submittedBy" TEXT,
    "submittedByIsm" TEXT,
    "submittedAt" TIMESTAMP(3),
    "sanalganNaqd" INTEGER,
    "kutilganNaqd" INTEGER,
    "kassaFarq" INTEGER,
    "transferId" TEXT,
    "izoh" TEXT,
    "qarorIzoh" TEXT,
    "confirmedBy" TEXT,
    "confirmedByIsm" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTransaction" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "tolovTuri" TEXT NOT NULL,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "userIsm" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DailyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportSetting" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "direktorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReportSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Smena" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sana" TIMESTAMP(3) NOT NULL,
    "raqam" INTEGER NOT NULL,
    "boshlanishAt" TIMESTAMP(3) NOT NULL,
    "tugashAt" TIMESTAMP(3) NOT NULL,
    "yopganUserId" TEXT NOT NULL,
    "yopganIsm" TEXT,
    "naqd" INTEGER NOT NULL DEFAULT 0,
    "click" INTEGER NOT NULL DEFAULT 0,
    "qarz" INTEGER NOT NULL DEFAULT 0,
    "naqdChiqim" INTEGER NOT NULL DEFAULT 0,
    "boshlangichQoldiq" INTEGER NOT NULL DEFAULT 0,
    "kutilganNaqd" INTEGER NOT NULL DEFAULT 0,
    "sanalganNaqd" INTEGER NOT NULL DEFAULT 0,
    "farq" INTEGER NOT NULL DEFAULT 0,
    "qoldirilganNaqd" INTEGER NOT NULL DEFAULT 0,
    "izoh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Smena_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "raqam" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "turi" TEXT NOT NULL DEFAULT 'mijoz',
    "contactId" TEXT,
    "supplierId" TEXT,
    "kontragent" TEXT,
    "summa" INTEGER NOT NULL DEFAULT 0,
    "boshlanish" TIMESTAMP(3) NOT NULL,
    "tugash" TIMESTAMP(3),
    "eslatmaKun" INTEGER NOT NULL DEFAULT 30,
    "holat" TEXT NOT NULL DEFAULT 'faol',
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "saqlagich" TEXT NOT NULL DEFAULT 'havola',
    "mimeType" TEXT,
    "hajm" INTEGER,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashHandover" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "turi" TEXT NOT NULL DEFAULT 'topshirish',
    "kassirId" TEXT NOT NULL,
    "kassirIsm" TEXT,
    "qabulId" TEXT,
    "qabulIsm" TEXT,
    "hisoblangan" INTEGER NOT NULL,
    "topshirilgan" INTEGER NOT NULL,
    "farq" INTEGER NOT NULL DEFAULT 0,
    "holat" TEXT NOT NULL DEFAULT 'kutilmoqda',
    "farqYopildi" BOOLEAN NOT NULL DEFAULT false,
    "izoh" TEXT,
    "qarorIzoh" TEXT,
    "topshirilganAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qabulAt" TIMESTAMP(3),
    "radAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosChek" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "raqam" INTEGER NOT NULL,
    "jamiSumma" INTEGER NOT NULL,
    "tolovTuri" TEXT NOT NULL,
    "accountId" TEXT,
    "transactionId" TEXT,
    "debtId" TEXT,
    "contactId" TEXT,
    "mijozNomi" TEXT,
    "mijozTel" TEXT,
    "userId" TEXT NOT NULL,
    "sana" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,

    CONSTRAINT "PosChek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "kalit" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "tavsif" TEXT,
    "doira" TEXT NOT NULL DEFAULT 'GLOBAL',
    "yoqilgan" BOOLEAN NOT NULL DEFAULT false,
    "tenantIdlar" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "masulId" TEXT,
    "mavzu" TEXT NOT NULL,
    "tavsif" TEXT NOT NULL,
    "holat" TEXT NOT NULL DEFAULT 'OCHIQ',
    "muhimlik" TEXT NOT NULL DEFAULT 'ORTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "yopilganAt" TIMESTAMP(3),

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "muallifId" TEXT,
    "muallifIsm" TEXT NOT NULL,
    "matn" TEXT NOT NULL,
    "ichki" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiSetting" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "mavsumOylar" TEXT NOT NULL DEFAULT '3,5,6,7,8,9,10,11,12',
    "mavsumPlan" INTEGER NOT NULL DEFAULT 100000000,
    "mavsumsizPlan" INTEGER NOT NULL DEFAULT 80000000,
    "planBonus" INTEGER NOT NULL DEFAULT 1000000,
    "boshlangichBall" INTEGER NOT NULL DEFAULT 100,
    "kunlikLimit" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiSalesBracket" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "dan" INTEGER NOT NULL,
    "gacha" INTEGER,
    "foiz" INTEGER NOT NULL,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiSalesBracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiScoreRule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "minBall" INTEGER NOT NULL,
    "maxBall" INTEGER NOT NULL,
    "foiz" INTEGER NOT NULL,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiScoreRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiTask" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "izoh" TEXT,
    "oylikHaq" INTEGER NOT NULL DEFAULT 0,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "KpiTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiTaskAssignment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiTaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiPenaltyPreset" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "taskId" TEXT,
    "sabab" TEXT NOT NULL,
    "ball" INTEGER NOT NULL,
    "kritik" BOOLEAN NOT NULL DEFAULT false,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiPenaltyPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiPointLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "oy" TEXT NOT NULL,
    "sana" TIMESTAMP(3) NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiPointLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiSalesTarget" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oy" TEXT NOT NULL,
    "maqsad" INTEGER NOT NULL,
    "planBonus" INTEGER,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiSalesTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiPayroll" (
    "id" TEXT NOT NULL,
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
    "hisoblanganAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tasdiqlaganId" TEXT,
    "tasdiqlanganAt" TIMESTAMP(3),
    "tolaganId" TEXT,
    "tolanganAt" TIMESTAMP(3),
    "tolanganSumma" INTEGER,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiPayroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiPayrollItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "taskId" TEXT,
    "taskNomi" TEXT NOT NULL,
    "oylikHaq" INTEGER NOT NULL,
    "ball" INTEGER NOT NULL,
    "foiz" INTEGER NOT NULL,
    "hisoblangan" INTEGER NOT NULL,

    CONSTRAINT "KpiPayrollItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiPayrollAdjustment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "sabab" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userIsm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiPayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE INDEX "Tenant_createdAt_idx" ON "Tenant"("createdAt");

-- CreateIndex
CREATE INDEX "Role_tenantId_isActive_idx" ON "Role"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_nomi_key" ON "Role"("tenantId", "nomi");

-- CreateIndex
CREATE INDEX "TenantModule_tenantId_idx" ON "TenantModule"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantModule_tenantId_code_key" ON "TenantModule"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_periodEnd_idx" ON "Subscription"("periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_externalId_key" ON "Payment"("externalId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Business_tenantId_idx" ON "Business"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");

-- CreateIndex
CREATE INDEX "User_businessId_idx" ON "User"("businessId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_rol_idx" ON "User"("rol");

-- CreateIndex
CREATE INDEX "UserBusiness_userId_idx" ON "UserBusiness"("userId");

-- CreateIndex
CREATE INDEX "UserBusiness_businessId_idx" ON "UserBusiness"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBusiness_userId_businessId_key" ON "UserBusiness"("userId", "businessId");

-- CreateIndex
CREATE INDEX "AiSuhbat_businessId_userId_updatedAt_idx" ON "AiSuhbat"("businessId", "userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AiSuhbat_tenantId_updatedAt_idx" ON "AiSuhbat"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "BotConversation_updatedAt_idx" ON "BotConversation"("updatedAt");

-- CreateIndex
CREATE INDEX "Account_businessId_isActive_tartib_idx" ON "Account"("businessId", "isActive", "tartib");

-- CreateIndex
CREATE UNIQUE INDEX "Account_businessId_nomi_key" ON "Account"("businessId", "nomi");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransfer_legacyCashHandoverId_key" ON "AccountTransfer"("legacyCashHandoverId");

-- CreateIndex
CREATE INDEX "AccountTransfer_businessId_sana_idx" ON "AccountTransfer"("businessId", "sana");

-- CreateIndex
CREATE INDEX "AccountTransfer_businessId_fromUserId_idx" ON "AccountTransfer"("businessId", "fromUserId");

-- CreateIndex
CREATE INDEX "AccountTransfer_businessId_toUserId_idx" ON "AccountTransfer"("businessId", "toUserId");

-- CreateIndex
CREATE INDEX "AccountTransfer_businessId_holat_createdAt_idx" ON "AccountTransfer"("businessId", "holat", "createdAt");

-- CreateIndex
CREATE INDEX "Category_turi_isActive_idx" ON "Category"("turi", "isActive");

-- CreateIndex
CREATE INDEX "Category_businessId_idx" ON "Category"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_nomi_turi_businessId_key" ON "Category"("nomi", "turi", "businessId");

-- CreateIndex
CREATE INDEX "Transaction_businessId_deletedAt_sana_idx" ON "Transaction"("businessId", "deletedAt", "sana");

-- CreateIndex
CREATE INDEX "Transaction_businessId_turi_deletedAt_sana_idx" ON "Transaction"("businessId", "turi", "deletedAt", "sana");

-- CreateIndex
CREATE INDEX "Transaction_businessId_categoryId_sana_idx" ON "Transaction"("businessId", "categoryId", "sana");

-- CreateIndex
CREATE INDEX "Transaction_businessId_userId_sana_idx" ON "Transaction"("businessId", "userId", "sana");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_businessId_accountId_sana_idx" ON "Transaction"("businessId", "accountId", "sana");

-- CreateIndex
CREATE INDEX "Transaction_businessId_sotuvchiId_sana_idx" ON "Transaction"("businessId", "sotuvchiId", "sana");

-- CreateIndex
CREATE INDEX "Transaction_sotuvchiId_idx" ON "Transaction"("sotuvchiId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "ShiftClose_businessId_sana_idx" ON "ShiftClose"("businessId", "sana");

-- CreateIndex
CREATE INDEX "RecurringTransaction_businessId_idx" ON "RecurringTransaction"("businessId");

-- CreateIndex
CREATE INDEX "Budget_businessId_oy_idx" ON "Budget"("businessId", "oy");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_categoryId_oy_key" ON "Budget"("categoryId", "oy");

-- CreateIndex
CREATE INDEX "Product_businessId_idx" ON "Product"("businessId");

-- CreateIndex
CREATE INDEX "Product_businessId_sku_idx" ON "Product"("businessId", "sku");

-- CreateIndex
CREATE INDEX "Product_businessId_categoryId_idx" ON "Product"("businessId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_barcode_key" ON "Product"("businessId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_qrKod_key" ON "Product"("businessId", "qrKod");

-- CreateIndex
CREATE INDEX "StockAdjustment_businessId_createdAt_idx" ON "StockAdjustment"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "StockAdjustment_productId_idx" ON "StockAdjustment"("productId");

-- CreateIndex
CREATE INDEX "ProductExpense_businessId_idx" ON "ProductExpense"("businessId");

-- CreateIndex
CREATE INDEX "ProductExpense_productId_idx" ON "ProductExpense"("productId");

-- CreateIndex
CREATE INDEX "StockEntry_businessId_idx" ON "StockEntry"("businessId");

-- CreateIndex
CREATE INDEX "StockEntry_productId_idx" ON "StockEntry"("productId");

-- CreateIndex
CREATE INDEX "Sale_businessId_sana_idx" ON "Sale"("businessId", "sana");

-- CreateIndex
CREATE INDEX "Sale_chekId_idx" ON "Sale"("chekId");

-- CreateIndex
CREATE INDEX "Sale_businessId_deletedAt_sana_idx" ON "Sale"("businessId", "deletedAt", "sana");

-- CreateIndex
CREATE INDEX "Sale_productId_idx" ON "Sale"("productId");

-- CreateIndex
CREATE INDEX "Sale_contactId_idx" ON "Sale"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Debt_saleId_key" ON "Debt"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "Debt_manbaTransactionId_key" ON "Debt"("manbaTransactionId");

-- CreateIndex
CREATE INDEX "Debt_businessId_isYopilgan_turi_idx" ON "Debt"("businessId", "isYopilgan", "turi");

-- CreateIndex
CREATE INDEX "Debt_businessId_turi_idx" ON "Debt"("businessId", "turi");

-- CreateIndex
CREATE INDEX "Debt_businessId_contactId_isYopilgan_idx" ON "Debt"("businessId", "contactId", "isYopilgan");

-- CreateIndex
CREATE INDEX "Debt_businessId_status_turi_idx" ON "Debt"("businessId", "status", "turi");

-- CreateIndex
CREATE INDEX "Debt_businessId_sana_idx" ON "Debt"("businessId", "sana");

-- CreateIndex
CREATE INDEX "Debt_productId_idx" ON "Debt"("productId");

-- CreateIndex
CREATE INDEX "Debt_contactId_idx" ON "Debt"("contactId");

-- CreateIndex
CREATE INDEX "Debt_categoryId_idx" ON "Debt"("categoryId");

-- CreateIndex
CREATE INDEX "Supplier_businessId_isActive_idx" ON "Supplier"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "Supplier_businessId_nomi_idx" ON "Supplier"("businessId", "nomi");

-- CreateIndex
CREATE INDEX "PurchaseOrder_businessId_holat_sana_idx" ON "PurchaseOrder"("businessId", "holat", "sana");

-- CreateIndex
CREATE INDEX "PurchaseOrder_businessId_qabulSana_idx" ON "PurchaseOrder"("businessId", "qabulSana");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_businessId_idempotencyKey_key" ON "PurchaseOrder"("businessId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_orderId_idx" ON "PurchaseOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_businessId_idx" ON "PurchaseOrderItem"("businessId");

-- CreateIndex
CREATE INDEX "Contact_businessId_idx" ON "Contact"("businessId");

-- CreateIndex
CREATE INDEX "Contact_businessId_tel_idx" ON "Contact"("businessId", "tel");

-- CreateIndex
CREATE INDEX "Stage_businessId_tartib_idx" ON "Stage"("businessId", "tartib");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_transactionId_key" ON "Deal"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_debtId_key" ON "Deal"("debtId");

-- CreateIndex
CREATE INDEX "Deal_businessId_stageId_idx" ON "Deal"("businessId", "stageId");

-- CreateIndex
CREATE INDEX "Deal_businessId_masulId_idx" ON "Deal"("businessId", "masulId");

-- CreateIndex
CREATE INDEX "Deal_businessId_sana_idx" ON "Deal"("businessId", "sana");

-- CreateIndex
CREATE INDEX "Deal_businessId_holat_sana_idx" ON "Deal"("businessId", "holat", "sana");

-- CreateIndex
CREATE INDEX "Deal_businessId_updatedAt_idx" ON "Deal"("businessId", "updatedAt");

-- CreateIndex
CREATE INDEX "Deal_categoryId_idx" ON "Deal"("categoryId");

-- CreateIndex
CREATE INDEX "Task_businessId_holat_idx" ON "Task"("businessId", "holat");

-- CreateIndex
CREATE INDEX "Task_businessId_masulId_idx" ON "Task"("businessId", "masulId");

-- CreateIndex
CREATE INDEX "Task_businessId_muddat_idx" ON "Task"("businessId", "muddat");

-- CreateIndex
CREATE INDEX "Task_businessId_employeeId_holat_idx" ON "Task"("businessId", "employeeId", "holat");

-- CreateIndex
CREATE INDEX "Task_employeeId_idx" ON "Task"("employeeId");

-- CreateIndex
CREATE INDEX "Activity_businessId_dealId_idx" ON "Activity"("businessId", "dealId");

-- CreateIndex
CREATE INDEX "Activity_businessId_contactId_idx" ON "Activity"("businessId", "contactId");

-- CreateIndex
CREATE INDEX "DebtPayment_debtId_idx" ON "DebtPayment"("debtId");

-- CreateIndex
CREATE INDEX "DebtPayment_businessId_idx" ON "DebtPayment"("businessId");

-- CreateIndex
CREATE INDEX "DebtPayment_businessId_sana_idx" ON "DebtPayment"("businessId", "sana");

-- CreateIndex
CREATE UNIQUE INDEX "DebtPayment_debtId_idempotencyKey_key" ON "DebtPayment"("debtId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ApprovalRule_businessId_isActive_deletedAt_idx" ON "ApprovalRule"("businessId", "isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "ApprovalRule_categoryId_idx" ON "ApprovalRule"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_transactionId_key" ON "ApprovalRequest"("transactionId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_businessId_holat_createdAt_idx" ON "ApprovalRequest"("businessId", "holat", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_businessId_userId_idx" ON "ApprovalRequest"("businessId", "userId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_categoryId_idx" ON "ApprovalRequest"("categoryId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_accountId_idx" ON "ApprovalRequest"("accountId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_userId_idx" ON "ApprovalRequest"("userId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_tasdiqlovchiId_idx" ON "ApprovalRequest"("tasdiqlovchiId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_ruleId_idx" ON "ApprovalRequest"("ruleId");

-- CreateIndex
CREATE INDEX "Employee_businessId_isActive_deletedAt_idx" ON "Employee"("businessId", "isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "Employee_userId_idx" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_workScheduleId_idx" ON "Employee"("workScheduleId");

-- CreateIndex
CREATE INDEX "Employee_workLocationId_idx" ON "Employee"("workLocationId");

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

-- CreateIndex
CREATE INDEX "WorkLocation_businessId_isActive_idx" ON "WorkLocation"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "WorkSchedule_businessId_isActive_idx" ON "WorkSchedule"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "WorkScheduleDay_businessId_idx" ON "WorkScheduleDay"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkScheduleDay_scheduleId_hafta_key" ON "WorkScheduleDay"("scheduleId", "hafta");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceCheck_selfieId_key" ON "AttendanceCheck"("selfieId");

-- CreateIndex
CREATE INDEX "AttendanceCheck_businessId_vaqt_idx" ON "AttendanceCheck"("businessId", "vaqt");

-- CreateIndex
CREATE INDEX "AttendanceCheck_attendanceId_idx" ON "AttendanceCheck"("attendanceId");

-- CreateIndex
CREATE INDEX "AttendanceCheck_employeeId_vaqt_idx" ON "AttendanceCheck"("employeeId", "vaqt");

-- CreateIndex
CREATE INDEX "AttendanceCheck_workLocationId_idx" ON "AttendanceCheck"("workLocationId");

-- CreateIndex
CREATE INDEX "AttendanceSelfie_businessId_employeeId_createdAt_idx" ON "AttendanceSelfie"("businessId", "employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "PenaltyRule_businessId_isActive_idx" ON "PenaltyRule"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "EmployeePenalty_businessId_holat_sana_idx" ON "EmployeePenalty"("businessId", "holat", "sana");

-- CreateIndex
CREATE INDEX "EmployeePenalty_employeeId_sana_idx" ON "EmployeePenalty"("employeeId", "sana");

-- CreateIndex
CREATE INDEX "EmployeePenalty_attendanceId_idx" ON "EmployeePenalty"("attendanceId");

-- CreateIndex
CREATE INDEX "EmployeePenalty_ruleId_idx" ON "EmployeePenalty"("ruleId");

-- CreateIndex
CREATE INDEX "EmployeeBonus_businessId_sana_idx" ON "EmployeeBonus"("businessId", "sana");

-- CreateIndex
CREATE INDEX "EmployeeBonus_employeeId_sana_idx" ON "EmployeeBonus"("employeeId", "sana");

-- CreateIndex
CREATE INDEX "EmployeePlan_businessId_oy_idx" ON "EmployeePlan"("businessId", "oy");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePlan_employeeId_oy_key" ON "EmployeePlan"("employeeId", "oy");

-- CreateIndex
CREATE INDEX "EmployeeCategory_businessId_aktiv_tartib_idx" ON "EmployeeCategory"("businessId", "aktiv", "tartib");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeCategory_businessId_nomi_key" ON "EmployeeCategory"("businessId", "nomi");

-- CreateIndex
CREATE INDEX "EmployeeCategoryMember_businessId_employeeId_idx" ON "EmployeeCategoryMember"("businessId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeeCategoryMember_employeeId_idx" ON "EmployeeCategoryMember"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeCategoryMember_categoryId_employeeId_key" ON "EmployeeCategoryMember"("categoryId", "employeeId");

-- CreateIndex
CREATE INDEX "DealEmployee_businessId_categoryId_employeeId_idx" ON "DealEmployee"("businessId", "categoryId", "employeeId");

-- CreateIndex
CREATE INDEX "DealEmployee_businessId_employeeId_idx" ON "DealEmployee"("businessId", "employeeId");

-- CreateIndex
CREATE INDEX "DealEmployee_dealId_idx" ON "DealEmployee"("dealId");

-- CreateIndex
CREATE INDEX "DealEmployee_categoryId_idx" ON "DealEmployee"("categoryId");

-- CreateIndex
CREATE INDEX "DealEmployee_employeeId_idx" ON "DealEmployee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "DealEmployee_dealId_categoryId_employeeId_key" ON "DealEmployee"("dealId", "categoryId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "DealFeedback_dealId_key" ON "DealFeedback"("dealId");

-- CreateIndex
CREATE INDEX "DealFeedback_businessId_createdAt_idx" ON "DealFeedback"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrSetting_businessId_key" ON "HrSetting"("businessId");

-- CreateIndex
CREATE INDEX "DailyReport_businessId_holat_sana_idx" ON "DailyReport"("businessId", "holat", "sana");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_businessId_sana_key" ON "DailyReport"("businessId", "sana");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTransaction_transactionId_key" ON "DailyTransaction"("transactionId");

-- CreateIndex
CREATE INDEX "DailyTransaction_reportId_deletedAt_idx" ON "DailyTransaction"("reportId", "deletedAt");

-- CreateIndex
CREATE INDEX "DailyTransaction_businessId_deletedAt_createdAt_idx" ON "DailyTransaction"("businessId", "deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReportSetting_businessId_key" ON "DailyReportSetting"("businessId");

-- CreateIndex
CREATE INDEX "Smena_businessId_sana_idx" ON "Smena"("businessId", "sana");

-- CreateIndex
CREATE INDEX "Smena_businessId_tugashAt_idx" ON "Smena"("businessId", "tugashAt");

-- CreateIndex
CREATE UNIQUE INDEX "Smena_businessId_sana_raqam_key" ON "Smena"("businessId", "sana", "raqam");

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

-- CreateIndex
CREATE INDEX "CashHandover_businessId_holat_topshirilganAt_idx" ON "CashHandover"("businessId", "holat", "topshirilganAt");

-- CreateIndex
CREATE INDEX "CashHandover_businessId_kassirId_topshirilganAt_idx" ON "CashHandover"("businessId", "kassirId", "topshirilganAt");

-- CreateIndex
CREATE INDEX "ProductCategory_businessId_isActive_tartib_idx" ON "ProductCategory"("businessId", "isActive", "tartib");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_businessId_nomi_key" ON "ProductCategory"("businessId", "nomi");

-- CreateIndex
CREATE UNIQUE INDEX "PosChek_debtId_key" ON "PosChek"("debtId");

-- CreateIndex
CREATE INDEX "PosChek_businessId_deletedAt_sana_idx" ON "PosChek"("businessId", "deletedAt", "sana");

-- CreateIndex
CREATE INDEX "PosChek_businessId_createdAt_idx" ON "PosChek"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "PosChek_contactId_idx" ON "PosChek"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "PosChek_businessId_raqam_key" ON "PosChek"("businessId", "raqam");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_kalit_key" ON "FeatureFlag"("kalit");

-- CreateIndex
CREATE INDEX "FeatureFlag_yoqilgan_idx" ON "FeatureFlag"("yoqilgan");

-- CreateIndex
CREATE INDEX "SupportTicket_tenantId_idx" ON "SupportTicket"("tenantId");

-- CreateIndex
CREATE INDEX "SupportTicket_holat_createdAt_idx" ON "SupportTicket"("holat", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_masulId_idx" ON "SupportTicket"("masulId");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KpiSetting_businessId_key" ON "KpiSetting"("businessId");

-- CreateIndex
CREATE INDEX "KpiSalesBracket_businessId_tartib_idx" ON "KpiSalesBracket"("businessId", "tartib");

-- CreateIndex
CREATE INDEX "KpiScoreRule_businessId_tartib_idx" ON "KpiScoreRule"("businessId", "tartib");

-- CreateIndex
CREATE INDEX "KpiTask_businessId_aktiv_tartib_idx" ON "KpiTask"("businessId", "aktiv", "tartib");

-- CreateIndex
CREATE INDEX "KpiTaskAssignment_businessId_employeeId_aktiv_idx" ON "KpiTaskAssignment"("businessId", "employeeId", "aktiv");

-- CreateIndex
CREATE INDEX "KpiTaskAssignment_employeeId_idx" ON "KpiTaskAssignment"("employeeId");

-- CreateIndex
CREATE INDEX "KpiTaskAssignment_taskId_idx" ON "KpiTaskAssignment"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "KpiTaskAssignment_taskId_employeeId_key" ON "KpiTaskAssignment"("taskId", "employeeId");

-- CreateIndex
CREATE INDEX "KpiPenaltyPreset_businessId_aktiv_tartib_idx" ON "KpiPenaltyPreset"("businessId", "aktiv", "tartib");

-- CreateIndex
CREATE INDEX "KpiPenaltyPreset_taskId_idx" ON "KpiPenaltyPreset"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "KpiPointLog_bekorQilinganId_key" ON "KpiPointLog"("bekorQilinganId");

-- CreateIndex
CREATE INDEX "KpiPointLog_businessId_employeeId_oy_idx" ON "KpiPointLog"("businessId", "employeeId", "oy");

-- CreateIndex
CREATE INDEX "KpiPointLog_businessId_oy_idx" ON "KpiPointLog"("businessId", "oy");

-- CreateIndex
CREATE INDEX "KpiPointLog_employeeId_taskId_sana_idx" ON "KpiPointLog"("employeeId", "taskId", "sana");

-- CreateIndex
CREATE INDEX "KpiPointLog_taskId_idx" ON "KpiPointLog"("taskId");

-- CreateIndex
CREATE INDEX "KpiSalesTarget_businessId_oy_idx" ON "KpiSalesTarget"("businessId", "oy");

-- CreateIndex
CREATE UNIQUE INDEX "KpiSalesTarget_employeeId_oy_key" ON "KpiSalesTarget"("employeeId", "oy");

-- CreateIndex
CREATE INDEX "KpiPayroll_businessId_oy_holat_idx" ON "KpiPayroll"("businessId", "oy", "holat");

-- CreateIndex
CREATE UNIQUE INDEX "KpiPayroll_employeeId_oy_key" ON "KpiPayroll"("employeeId", "oy");

-- CreateIndex
CREATE INDEX "KpiPayrollItem_payrollId_idx" ON "KpiPayrollItem"("payrollId");

-- CreateIndex
CREATE INDEX "KpiPayrollItem_taskId_idx" ON "KpiPayrollItem"("taskId");

-- CreateIndex
CREATE INDEX "KpiPayrollAdjustment_payrollId_idx" ON "KpiPayrollAdjustment"("payrollId");

-- CreateIndex
CREATE INDEX "KpiPayrollAdjustment_businessId_createdAt_idx" ON "KpiPayrollAdjustment"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantModule" ADD CONSTRAINT "TenantModule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBusiness" ADD CONSTRAINT "UserBusiness_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBusiness" ADD CONSTRAINT "UserBusiness_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sotuvchiId_fkey" FOREIGN KEY ("sotuvchiId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftClose" ADD CONSTRAINT "ShiftClose_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductExpense" ADD CONSTRAINT "ProductExpense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductExpense" ADD CONSTRAINT "ProductExpense_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_chekId_fkey" FOREIGN KEY ("chekId") REFERENCES "PosChek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ApprovalRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_tasdiqlovchiId_fkey" FOREIGN KEY ("tasdiqlovchiId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "WorkSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_workLocationId_fkey" FOREIGN KEY ("workLocationId") REFERENCES "WorkLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdvance" ADD CONSTRAINT "PayrollAdvance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdvance" ADD CONSTRAINT "PayrollAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdvance" ADD CONSTRAINT "PayrollAdvance_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLocation" ADD CONSTRAINT "WorkLocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleDay" ADD CONSTRAINT "WorkScheduleDay_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleDay" ADD CONSTRAINT "WorkScheduleDay_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCheck" ADD CONSTRAINT "AttendanceCheck_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCheck" ADD CONSTRAINT "AttendanceCheck_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCheck" ADD CONSTRAINT "AttendanceCheck_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCheck" ADD CONSTRAINT "AttendanceCheck_workLocationId_fkey" FOREIGN KEY ("workLocationId") REFERENCES "WorkLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCheck" ADD CONSTRAINT "AttendanceCheck_selfieId_fkey" FOREIGN KEY ("selfieId") REFERENCES "AttendanceSelfie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSelfie" ADD CONSTRAINT "AttendanceSelfie_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSelfie" ADD CONSTRAINT "AttendanceSelfie_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyRule" ADD CONSTRAINT "PenaltyRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePenalty" ADD CONSTRAINT "EmployeePenalty_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePenalty" ADD CONSTRAINT "EmployeePenalty_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePenalty" ADD CONSTRAINT "EmployeePenalty_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePenalty" ADD CONSTRAINT "EmployeePenalty_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PenaltyRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBonus" ADD CONSTRAINT "EmployeeBonus_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBonus" ADD CONSTRAINT "EmployeeBonus_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePlan" ADD CONSTRAINT "EmployeePlan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePlan" ADD CONSTRAINT "EmployeePlan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCategory" ADD CONSTRAINT "EmployeeCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCategoryMember" ADD CONSTRAINT "EmployeeCategoryMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCategoryMember" ADD CONSTRAINT "EmployeeCategoryMember_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EmployeeCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCategoryMember" ADD CONSTRAINT "EmployeeCategoryMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEmployee" ADD CONSTRAINT "DealEmployee_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEmployee" ADD CONSTRAINT "DealEmployee_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEmployee" ADD CONSTRAINT "DealEmployee_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EmployeeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEmployee" ADD CONSTRAINT "DealEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFeedback" ADD CONSTRAINT "DealFeedback_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFeedback" ADD CONSTRAINT "DealFeedback_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrSetting" ADD CONSTRAINT "HrSetting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTransaction" ADD CONSTRAINT "DailyTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTransaction" ADD CONSTRAINT "DailyTransaction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DailyReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportSetting" ADD CONSTRAINT "DailyReportSetting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Smena" ADD CONSTRAINT "Smena_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashHandover" ADD CONSTRAINT "CashHandover_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosChek" ADD CONSTRAINT "PosChek_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosChek" ADD CONSTRAINT "PosChek_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_masulId_fkey" FOREIGN KEY ("masulId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_muallifId_fkey" FOREIGN KEY ("muallifId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiSetting" ADD CONSTRAINT "KpiSetting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiSalesBracket" ADD CONSTRAINT "KpiSalesBracket_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiScoreRule" ADD CONSTRAINT "KpiScoreRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiTask" ADD CONSTRAINT "KpiTask_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiTaskAssignment" ADD CONSTRAINT "KpiTaskAssignment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiTaskAssignment" ADD CONSTRAINT "KpiTaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KpiTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiTaskAssignment" ADD CONSTRAINT "KpiTaskAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiPenaltyPreset" ADD CONSTRAINT "KpiPenaltyPreset_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiPenaltyPreset" ADD CONSTRAINT "KpiPenaltyPreset_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KpiTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiPointLog" ADD CONSTRAINT "KpiPointLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiPointLog" ADD CONSTRAINT "KpiPointLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiPointLog" ADD CONSTRAINT "KpiPointLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KpiTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiSalesTarget" ADD CONSTRAINT "KpiSalesTarget_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiSalesTarget" ADD CONSTRAINT "KpiSalesTarget_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiPayroll" ADD CONSTRAINT "KpiPayroll_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiPayroll" ADD CONSTRAINT "KpiPayroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiPayrollItem" ADD CONSTRAINT "KpiPayrollItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiPayrollItem" ADD CONSTRAINT "KpiPayrollItem_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "KpiPayroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiPayrollItem" ADD CONSTRAINT "KpiPayrollItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "KpiTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiPayrollAdjustment" ADD CONSTRAINT "KpiPayrollAdjustment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiPayrollAdjustment" ADD CONSTRAINT "KpiPayrollAdjustment_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "KpiPayroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- QO'LDA QO'SHILGAN: registrsiz login qidiruvi uchun funksional indeks.
-- (scripts/pg-migratsiya.mjs har generatsiyada qo'shib qo'yadi.)
-- ---------------------------------------------------------------------------
CREATE INDEX "User_login_lower_idx" ON "User" (LOWER("login"));

-- ---------------------------------------------------------------------------
-- QO'LDA QO'SHILGAN: kategoriya nomining registrga BEFARQ yagonaligi.
-- Sxemadagi @@unique([nomi, turi, businessId]) registrga sezgir, ya'ni
-- "Bantik" va "bantik" ikki alohida kategoriya bo'lib qolardi. Ifodali
-- indeksni Prisma sxemasi ifodalay olmaydi — SQLite yo'li migratsiya
-- 20260825130000_kategoriya_registrsiz_unique da, Postgres yo'li shu yerda.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "Category_businessId_turi_nomi_registrsiz_key"
  ON "Category" ("businessId", "turi", LOWER(TRIM("nomi")));

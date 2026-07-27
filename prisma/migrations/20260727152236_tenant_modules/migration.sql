-- CreateTable
CREATE TABLE "TenantModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sozlamalar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantModule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TenantModule_tenantId_idx" ON "TenantModule"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantModule_tenantId_code_key" ON "TenantModule"("tenantId", "code");

-- Backfill: omborli biznesi bor tenantlarga OMBOR moduli yoqilgan holda yoziladi.
-- (MOLIYA core modul — yozuvsiz ham har doim yoqilgan.) Idempotent: INSERT OR IGNORE.
INSERT OR IGNORE INTO "TenantModule" ("id", "tenantId", "code", "isActive")
SELECT 'tm_ombor_' || "tenantId", "tenantId", 'OMBOR', 1
FROM "Business"
WHERE "omborli" = 1
GROUP BY "tenantId";

-- M-6: AuditLog cheksiz o'sardi. 12 oydan eski yozuvlar cron tomonidan shu
-- arxiv jadvalga KO'CHIRILADI (o'chirilmaydi — moliyaviy audit tarixi).
CREATE TABLE "AuditLogArxiv" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "businessId" TEXT,
    "userId" TEXT,
    "userIsm" TEXT,
    "impersonatedBy" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL,
    "arxivlanganAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AuditLogArxiv_tenantId_createdAt_idx" ON "AuditLogArxiv"("tenantId", "createdAt");

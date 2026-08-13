-- H-3: impersonatsiya paytida superadmin qilgan amallar mijoz direktori
-- nomidan yozilardi va farqlab bo'lmasdi. Endi haqiqiy aktor alohida ustunda.
ALTER TABLE "AuditLog" ADD COLUMN "impersonatedBy" TEXT;

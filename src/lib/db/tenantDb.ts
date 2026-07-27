import { rawPrisma } from "./rawPrisma";
import { ForbiddenError } from "@/lib/auth/guard";

/**
 * Tenant-himoyalangan Prisma client (Prisma client extension).
 *
 * Qoidalar:
 *  - Business / User (to'g'ridan-to'g'ri tenantId ustuni bor): barcha o'qish/yozishga
 *    `tenantId` avtomatik qo'shiladi; create'da tenantId majburan yoziladi.
 *  - Biznesga bog'liq modellar (Category, Transaction, Product, Sale, Debt, ...):
 *    o'qishlarga `business: { tenantId }` filtri qo'shiladi; create'da businessId
 *    shu tenantga tegishliligi tekshiriladi.
 *  - Unique amallar (findUnique/update/delete/upsert) faqat `id` orqali — avval yozuv
 *    shu tenantniki ekani tekshiriladi, aks holda ForbiddenError (IDOR himoya).
 *  - Tenant modeli: faqat o'z tenantini o'qish mumkin; yaratish/o'chirish bloklangan
 *    (signup/superadmin rawPrisma bilan ishlaydi).
 */

const TENANT_DIRECT = new Set(["Business", "User", "Subscription", "Payment", "TenantModule"]);
const BUSINESS_SCOPED = new Set([
  "Category",
  "Transaction",
  "Product",
  "Budget",
  "ShiftClose",
  "RecurringTransaction",
  "Sale",
  "Debt",
  "StockEntry",
  "DebtPayment",
]);
// AuditLog: businessId nullable — biznesga bog'langan yozuvlar tenant bo'yicha filtrlanadi.
const AUDIT_MODEL = "AuditLog";

const FILTER_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);
const UNIQUE_OPS = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]);
const CREATE_OPS = new Set(["create", "createMany"]);

function delegateOf(model: string): any {
  const key = model.charAt(0).toLowerCase() + model.slice(1);
  return (rawPrisma as any)[key];
}

async function assertBusinessInTenant(businessId: string, tenantId: string): Promise<void> {
  const biz = await rawPrisma.business.findFirst({
    where: { id: businessId, tenantId },
    select: { id: true },
  });
  if (!biz) {
    throw new ForbiddenError("Biznes sizning kompaniyangizga tegishli emas");
  }
}

function buildTenantClient(tenantId: string) {
  return rawPrisma.$extends({
    name: `tenant:${tenantId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const isDirect = TENANT_DIRECT.has(model);
          const isScoped = BUSINESS_SCOPED.has(model) || model === AUDIT_MODEL;

          // Tenant modeli — faqat o'z tenantini O'QISH mumkin. Status/muddat kabi
          // maydonlarni o'zgartirish faqat tizim darajasida (rawPrisma, SUPERADMIN).
          if (model === "Tenant") {
            if (operation === "findUnique" || operation === "findUniqueOrThrow" || operation === "findFirst" || operation === "findMany") {
              const a: any = args ?? {};
              a.where = a.where ? { AND: [a.where, { id: tenantId }] } : { id: tenantId };
              return query(a);
            }
            throw new ForbiddenError("Tenant amali tenant rejimida taqiqlangan");
          }

          // Tenant bilan bog'liq bo'lmagan modellar (masalan AppSetting) — o'zgarishsiz.
          if (!isDirect && !isScoped) {
            return query(args);
          }

          const scope = isDirect ? { tenantId } : { business: { tenantId } };
          const a: any = args ?? {};

          if (FILTER_OPS.has(operation)) {
            a.where = a.where ? { AND: [a.where, scope] } : scope;
            return query(a);
          }

          if (UNIQUE_OPS.has(operation)) {
            const id = a.where?.id;
            if (typeof id !== "string") {
              throw new Error(
                `${model}.${operation}: tenant rejimida unique amallar faqat 'id' orqali bajariladi`
              );
            }
            // Yozuv shu tenantga tegishli ekanini oldindan tekshirish (IDOR himoya).
            const found = await delegateOf(model).findFirst({
              where: { AND: [{ id }, scope] },
              select: { id: true },
            });
            if (!found) {
              if (operation === "findUnique") return null;
              throw new ForbiddenError("Yozuv topilmadi yoki boshqa kompaniyaga tegishli");
            }
            // update ma'lumotida businessId almashtirilayotgan bo'lsa — u ham shu tenantniki bo'lsin.
            const dataBusinessId = a.data?.businessId;
            if (typeof dataBusinessId === "string") {
              await assertBusinessInTenant(dataBusinessId, tenantId);
            }
            return query(a);
          }

          if (CREATE_OPS.has(operation)) {
            if (isDirect) {
              // Business/User: tenantId majburan joriy tenant qilib yoziladi.
              if (operation === "create") {
                a.data = { ...a.data, tenantId };
                if (typeof a.data.businessId === "string") {
                  await assertBusinessInTenant(a.data.businessId, tenantId);
                }
              } else {
                const rows = Array.isArray(a.data) ? a.data : [a.data];
                a.data = rows.map((d: any) => ({ ...d, tenantId }));
              }
              return query(a);
            }
            // Biznesga bog'liq modellar: businessId majburiy va shu tenantniki bo'lishi shart.
            const rows = operation === "create" ? [a.data] : Array.isArray(a.data) ? a.data : [a.data];
            for (const d of rows) {
              const businessId = d?.businessId;
              if (model === AUDIT_MODEL && businessId == null) continue;
              if (typeof businessId !== "string") {
                throw new Error(`${model}.${operation}: tenant rejimida businessId majburiy`);
              }
              await assertBusinessInTenant(businessId, tenantId);
            }
            return query(a);
          }

          // Noma'lum amal — xavfsizlik uchun bloklanadi.
          throw new Error(`${model}.${operation}: tenant rejimida qo'llab-quvvatlanmaydi`);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof buildTenantClient>;

// Har tenant uchun extension bir marta quriladi (kesh).
const cache = new Map<string, TenantDb>();

export function tenantClient(tenantId: string): TenantDb {
  let client = cache.get(tenantId);
  if (!client) {
    client = buildTenantClient(tenantId);
    cache.set(tenantId, client);
  }
  return client;
}

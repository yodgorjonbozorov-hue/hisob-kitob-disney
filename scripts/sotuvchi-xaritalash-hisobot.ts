/**
 * SOTUVCHI XARITALASH HISOBOTI — FAQAT O'QISH (SELECT), hech narsa yozilmaydi.
 *
 * Maqsad: bitta biznesda (standart — `disney-navoiy` tenant'i) "Sotuvchi"
 * lavozimi bor-yo'qligini, sotuvchi sifatida ishlayotgan odamlarni va eski
 * zakazlarning `Deal.masulId` taqsimotini ko'rsatish — mas'ul→sotuvchi
 * migratsiyasini qo'lda tasdiqlash uchun.
 *
 * HECH QANDAY TAXMINIY BIRIKTIRUV YO'Q: hisobot faqat mavjud bog'lanishlarni
 * (`Employee.userId`) "ANIQ", ism o'xshashligini esa "TAXMINIY — qo'lda
 * tasdiq" deb belgilaydi. Bazaga yozilmaydi.
 *
 * OMMAVIY LOG: `CI` da (GitHub Actions — repo ommaviy) ism/login niqoblanadi
 * (birinchi 2 harf + uzunlik), id'lar qisqartiriladi. Pul chiqmaydi.
 *
 *   TENANT_SLUG=disney-navoiy node -r ts-node/register scripts/sotuvchi-xaritalash-hisobot.ts
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";

const SLUG = process.env.TENANT_SLUG ?? "disney-navoiy";
const OMMAVIY = Boolean(process.env.CI);

const qisqa = (id: string) => id.slice(0, 8);
const niqob = (s: string | null | undefined) => {
  if (!s) return "—";
  if (!OMMAVIY) return s;
  return `${s.slice(0, 2)}…(${s.length})`;
};
/** Ism o'xshashligi — faqat ma'lumot uchun (avtomatik biriktirilmaydi). */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9а-яё']/g, " ").trim();
const oxshash = (a: string, b: string) => {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = na.split(/\s+/), tb = nb.split(/\s+/);
  return ta.some((t) => t.length >= 3 && tb.includes(t));
};

async function main() {
  console.log(`REJIM: FAQAT O'QISH · tenant slug: ${SLUG}`);

  const tenant = await rawPrisma.tenant.findFirst({
    where: { slug: SLUG },
    select: { id: true, plan: true, businesses: { select: { id: true, nomi: true } } },
  });
  if (!tenant) {
    console.log("Tenant topilmadi.");
    return;
  }
  console.log(`Tenant: ${qisqa(tenant.id)} · plan ${tenant.plan} · bizneslar: ${tenant.businesses.length}`);

  const tenantUserlar = await rawPrisma.user.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, ism: true, login: true, rol: true, isActive: true, businessId: true, bizneslar: { select: { businessId: true } } },
  });

  for (const b of tenant.businesses) {
    console.log("");
    console.log(`=== BIZNES ${qisqa(b.id)} (${OMMAVIY ? niqob(b.nomi) : b.nomi}) ===`);

    // 1. Lavozimlar
    const lavozimlar = await rawPrisma.employeeCategory.findMany({
      where: { businessId: b.id },
      orderBy: { tartib: "asc" },
      select: { id: true, nomi: true, turi: true, aktiv: true, kopXodim: true, zakazgaBiriktiriladi: true, _count: { select: { azolar: true } } },
    });
    console.log(`LAVOZIMLAR: ${lavozimlar.length} ta`);
    for (const l of lavozimlar) {
      console.log(`  · ${l.nomi} [turi=${l.turi}, aktiv=${l.aktiv}, kopXodim=${l.kopXodim}, zakazga=${l.zakazgaBiriktiriladi}, a'zolar=${l._count.azolar}]`);
    }
    const sotuvchiLavozim = lavozimlar.filter((l) => l.turi === "sotuvchi");
    console.log(`SOTUVCHI LAVOZIMI: ${sotuvchiLavozim.length ? "BOR — " + sotuvchiLavozim.map((l) => l.nomi).join(", ") : "YO'Q"}`);
    const hr = await rawPrisma.hrSetting.findFirst({ where: { businessId: b.id }, select: { crmSotuvchiMajburiy: true } });
    console.log(`HrSetting.crmSotuvchiMajburiy: ${hr ? hr.crmSotuvchiMajburiy : "sozlama yozuvi yo'q (default false)"}`);

    // 2. Xodimlar
    const xodimlar = await rawPrisma.employee.findMany({
      where: { businessId: b.id },
      select: { id: true, ism: true, lavozim: true, isActive: true, deletedAt: true, userId: true, kategoriyalar: { select: { category: { select: { nomi: true } } } } },
      orderBy: { ism: "asc" },
    });
    console.log(`XODIMLAR: ${xodimlar.length} ta (faol ${xodimlar.filter((x) => x.isActive && !x.deletedAt).length}, o'chirilgan ${xodimlar.filter((x) => x.deletedAt).length})`);
    for (const x of xodimlar) {
      console.log(
        `  · emp ${qisqa(x.id)} ${niqob(x.ism)} · lavozim matni "${x.lavozim ?? "—"}" · faol=${x.isActive}${x.deletedAt ? " O'CHIRILGAN" : ""} · user=${x.userId ? qisqa(x.userId) : "BOG'LANMAGAN"} · lavozimlar: ${x.kategoriyalar.map((k) => k.category.nomi).join(", ") || "—"}`
      );
    }

    // 3. Foydalanuvchilar — shu biznesda ishlaydiganlar (biznesXodimlariWhere qoidasi).
    const userlar = tenantUserlar.filter(
      (u) => u.rol === "OWNER" || u.rol === "ADMIN" || u.businessId === b.id || u.bizneslar.some((ub) => ub.businessId === b.id) || (!u.businessId && u.bizneslar.length === 0)
    );
    const masulJam = await rawPrisma.deal.groupBy({ by: ["masulId"], where: { businessId: b.id, deletedAt: null }, _count: { _all: true } });
    const masulXarita = new Map(masulJam.map((m) => [m.masulId, m._count._all]));
    const yaratganJam = await rawPrisma.activity.groupBy({
      by: ["userId"],
      where: { businessId: b.id, turi: "tizim", matn: "Buyurtma yaratildi" },
      _count: { _all: true },
    });
    const yaratganXarita = new Map(yaratganJam.map((m) => [m.userId, m._count._all]));
    const sotuvJam = await rawPrisma.transaction.groupBy({
      by: ["sotuvchiId"],
      where: { businessId: b.id, turi: "kirim", deletedAt: null, sotuvchiId: { not: null } },
      _count: { _all: true },
    });
    const sotuvXarita = new Map(sotuvJam.map((m) => [m.sotuvchiId!, m._count._all]));
    const xodimUser = new Map(xodimlar.filter((x) => x.userId && !x.deletedAt).map((x) => [x.userId!, x]));

    console.log(`FOYDALANUVCHILAR (shu biznesda): ${userlar.length} ta`);
    for (const u of userlar) {
      const emp = xodimUser.get(u.id);
      const ismOxshash = emp ? [] : xodimlar.filter((x) => !x.deletedAt && oxshash(x.ism, u.ism));
      const xarita = emp
        ? `ANIQ: emp ${qisqa(emp.id)} (Employee.userId)`
        : ismOxshash.length
          ? `TAXMINIY (ism o'xshash, qo'lda tasdiq): ${ismOxshash.map((x) => `emp ${qisqa(x.id)} ${niqob(x.ism)}`).join(" | ")}`
          : "xodim kartochkasi yo'q";
      console.log(
        `  · user ${qisqa(u.id)} ${niqob(u.ism)} login=${niqob(u.login)} rol=${u.rol} faol=${u.isActive} · mas'ul zakazlar=${masulXarita.get(u.id) ?? 0} · yaratgan=${yaratganXarita.get(u.id) ?? 0} · kirim sotuvchi=${sotuvXarita.get(u.id) ?? 0} · ${xarita}`
      );
    }

    // 4. Eski zakazlar
    const jami = await rawPrisma.deal.count({ where: { businessId: b.id } });
    const ochirilgan = await rawPrisma.deal.count({ where: { businessId: b.id, deletedAt: { not: null } } });
    const holatJam = await rawPrisma.deal.groupBy({ by: ["holat"], where: { businessId: b.id, deletedAt: null }, _count: { _all: true } });
    const sana = await rawPrisma.deal.aggregate({ where: { businessId: b.id, deletedAt: null }, _min: { createdAt: true }, _max: { createdAt: true } });
    const biriktiruvli = await rawPrisma.deal.count({ where: { businessId: b.id, deletedAt: null, xodimlar: { some: {} } } });
    const kirimli = await rawPrisma.deal.count({ where: { businessId: b.id, deletedAt: null, transactionId: { not: null } } });
    console.log(`ZAKAZLAR: jami ${jami} · o'chirilgan ${ochirilgan} · biriktiruvli ${biriktiruvli} · kirim yozilgan ${kirimli}`);
    console.log(`  holatlar: ${holatJam.map((h) => `${h.holat}=${h._count._all}`).join(", ") || "—"}`);
    console.log(`  yaratilgan oraliq: ${sana._min.createdAt?.toISOString().slice(0, 10) ?? "—"} … ${sana._max.createdAt?.toISOString().slice(0, 10) ?? "—"}`);
    const userIsm = new Map(tenantUserlar.map((u) => [u.id, u]));
    console.log("  mas'ul bo'yicha:");
    for (const m of masulJam) {
      const u = userIsm.get(m.masulId);
      console.log(`    · user ${qisqa(m.masulId)} ${u ? `${niqob(u.ism)} rol=${u.rol}` : "TENANTDA YO'Q"}: ${m._count._all} zakaz`);
    }
  }
  console.log("");
  console.log("HOLAT: OK — faqat o'qildi, hech narsa yozilmadi.");
}

main()
  .then(() => rawPrisma.$disconnect())
  .catch(async (e) => {
    console.error("XATO:", e);
    await rawPrisma.$disconnect();
    process.exit(1);
  });

/**
 * SOTUVCHI XARITALASH HISOBOTI — FAQAT O'QISH (SELECT), hech narsa yozilmaydi.
 *
 * Maqsad: mas'ul→sotuvchi migratsiyasidan OLDIN "qaysi foydalanuvchi qaysi
 * xodim kartochkasi" savoliga DALILGA asoslangan javob berish. Skript hech
 * qachon avtomatik biriktirmaydi — u faqat ishonch darajasini hisoblaydi,
 * qaror odamda qoladi.
 *
 * ISHONCH DARAJALARI (identifikatorlarga qarab, ISM O'XSHASHLIGI O'ZI YETARLI EMAS):
 *   EXACT     — `Employee.userId` bog'langan (baza darajasidagi haqiqat), YOKI
 *               ism TO'LIQ teng + telefon teng (ikki mustaqil identifikator);
 *   LIKELY    — ism TO'LIQ teng, nomzod YAGONA, lekin ikkinchi identifikator
 *               (telefon) yo'q — tasdiqlash kerak;
 *   AMBIGUOUS — bir nechta nomzod bor YOKI ism faqat QISMAN mos (bitta token);
 *   NONE      — mos xodim topilmadi.
 *
 * OMMAVIY LOG (repo ommaviy): ism/login/telefon QIYMATLARI chiqarilmaydi —
 * niqoblanadi (bosh 2 harf + uzunlik), telefon esa faqat "teng/har xil/yo'q"
 * ko'rinishida. Qaror uchun kerak bo'lgan narsa — MUNOSABAT (qanday moslik
 * bor), qiymatning o'zi emas. Pul summalari umuman chiqmaydi.
 *
 *   TENANT_SLUG=disney-navoiy node -r ts-node/register scripts/sotuvchi-xaritalash-hisobot.ts
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";

const SLUG = process.env.TENANT_SLUG ?? "disney-navoiy";
const OMMAVIY = Boolean(process.env.CI);

type Ishonch = "EXACT" | "LIKELY" | "AMBIGUOUS" | "NONE";

/**
 * ID'lar TO'LIQ chiqadi: ular opaque cuid — shaxsiy ma'lumot emas, lekin
 * qaror qabul qilish uchun aniq kerak (8 belgili prefiks to'qnashadi).
 */
const qisqa = (id: string) => id;
const niqob = (s: string | null | undefined) => {
  if (!s) return "—";
  if (!OMMAVIY) return s;
  return `${s.slice(0, 2)}…(${s.length})`;
};

/** Ismni solishtirish uchun normallashtirish (registr, ortiqcha belgilar). */
function ismTokenlari(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-zа-яё0-9' ]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/**
 * Telefonni solishtirish uchun: faqat raqamlar, oxirgi 9 ta (O'zbekiston
 * raqamlari +998 prefiksi bilan ham, prefiksiz ham yoziladi).
 */
function telKaliti(s: string | null | undefined): string | null {
  if (!s) return null;
  const raqamlar = s.replace(/\D/g, "");
  return raqamlar.length >= 7 ? raqamlar.slice(-9) : null;
}

interface XodimQator {
  id: string;
  ism: string;
  lavozim: string | null;
  tel: string | null;
  userId: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  lavozimlar: string[];
}

interface Nomzod {
  xodim: XodimQator;
  toliqIsm: boolean;
  mosToken: number;
  jamiToken: number;
  telHolati: "teng" | "harXil" | "yoq";
}

/** Bitta foydalanuvchi uchun nomzodlarni topadi va ishonchni hisoblaydi. */
function xaritala(
  user: { id: string; ism: string; login: string },
  xodimlar: XodimQator[]
): { ishonch: Ishonch; nomzodlar: Nomzod[]; dalil: string } {
  // 1. Baza darajasidagi bog'lanish — eng kuchli dalil.
  const bogliq = xodimlar.find((x) => x.userId === user.id && !x.deletedAt);
  if (bogliq) {
    return {
      ishonch: "EXACT",
      nomzodlar: [{ xodim: bogliq, toliqIsm: true, mosToken: 0, jamiToken: 0, telHolati: "yoq" }],
      dalil: "Employee.userId bog'langan (baza)",
    };
  }

  const userTokenlar = ismTokenlari(user.ism);
  const userTel = telKaliti(user.login);

  const nomzodlar: Nomzod[] = [];
  for (const x of xodimlar) {
    if (x.deletedAt) continue;
    // Boshqa foydalanuvchiga allaqachon bog'langan xodim nomzod bo'lmaydi.
    if (x.userId && x.userId !== user.id) continue;
    const xTokenlar = ismTokenlari(x.ism);
    const mos = userTokenlar.filter((t) => xTokenlar.includes(t)).length;
    const xTel = telKaliti(x.tel);
    const telHolati: Nomzod["telHolati"] = !userTel || !xTel ? "yoq" : userTel === xTel ? "teng" : "harXil";
    // Telefon aniq HAR XIL bo'lsa — bu boshqa odam, nomzod emas.
    if (telHolati === "harXil") continue;
    if (mos === 0 && telHolati !== "teng") continue;
    const toliqIsm =
      mos > 0 && mos === userTokenlar.length && mos === xTokenlar.length;
    nomzodlar.push({ xodim: x, toliqIsm, mosToken: mos, jamiToken: Math.max(userTokenlar.length, xTokenlar.length), telHolati });
  }

  if (nomzodlar.length === 0) return { ishonch: "NONE", nomzodlar, dalil: "mos xodim yo'q" };

  // Telefon tengligi — ikkinchi mustaqil identifikator.
  const telTeng = nomzodlar.filter((n) => n.telHolati === "teng");
  if (telTeng.length === 1 && telTeng[0].toliqIsm) {
    return { ishonch: "EXACT", nomzodlar: telTeng, dalil: "ism to'liq teng + telefon teng" };
  }
  if (telTeng.length === 1) {
    return { ishonch: "LIKELY", nomzodlar: telTeng, dalil: `telefon teng, ism qisman (${telTeng[0].mosToken}/${telTeng[0].jamiToken} token)` };
  }
  if (telTeng.length > 1) {
    return { ishonch: "AMBIGUOUS", nomzodlar: telTeng, dalil: `${telTeng.length} nomzodda telefon teng` };
  }

  const toliq = nomzodlar.filter((n) => n.toliqIsm);
  if (toliq.length === 1) {
    return {
      ishonch: "LIKELY",
      nomzodlar: toliq,
      dalil: "ism to'liq teng, yagona nomzod; telefon yo'q (ikkinchi identifikator yetishmaydi)",
    };
  }
  if (toliq.length > 1) {
    return { ishonch: "AMBIGUOUS", nomzodlar: toliq, dalil: `ism to'liq teng, ${toliq.length} nomzod` };
  }
  const eng = nomzodlar[0];
  return {
    ishonch: "AMBIGUOUS",
    nomzodlar,
    dalil:
      nomzodlar.length > 1
        ? `${nomzodlar.length} nomzod, faqat qisman ism mosligi`
        : `faqat qisman ism mosligi (${eng.mosToken}/${eng.jamiToken} token), telefon yo'q`,
  };
}

/** Matnni ustun kengligiga moslaydi. */
const ust = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));

async function main() {
  console.log(`REJIM: FAQAT O'QISH (SELECT) · tenant slug: ${SLUG}`);
  console.log("Bu skript BAZAGA YOZMAYDI va avtomatik biriktirmaydi.\n");

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
    select: {
      id: true,
      ism: true,
      login: true,
      rol: true,
      isActive: true,
      businessId: true,
      bizneslar: { select: { businessId: true } },
    },
  });

  let jamiMigratsiya = 0;
  let jamiQolda = 0;

  for (const b of tenant.businesses) {
    const jamiZakaz = await rawPrisma.deal.count({ where: { businessId: b.id, deletedAt: null } });
    const xodimSoni = await rawPrisma.employee.count({ where: { businessId: b.id, deletedAt: null } });
    if (jamiZakaz === 0 && xodimSoni === 0) {
      console.log(`\n=== BIZNES ${qisqa(b.id)} — zakaz ham, xodim ham yo'q, o'tkazib yuborildi`);
      continue;
    }

    console.log(`\n${"=".repeat(100)}`);
    console.log(`BIZNES ${qisqa(b.id)} (${niqob(b.nomi)}) · businessId to'liq: ${b.id}`);

    // --- Lavozimlar
    const lavozimlar = await rawPrisma.employeeCategory.findMany({
      where: { businessId: b.id },
      orderBy: { tartib: "asc" },
      select: { id: true, nomi: true, turi: true, aktiv: true, _count: { select: { azolar: true } } },
    });
    const sotuvchiLavozim = lavozimlar.filter((l) => l.turi === "sotuvchi");
    console.log(
      `LAVOZIMLAR: ${lavozimlar.length} ta` +
        (lavozimlar.length ? ` — ${lavozimlar.map((l) => `${l.nomi}[${l.turi},a'zo ${l._count.azolar}]`).join(", ")}` : "")
    );
    console.log(`SOTUVCHI LAVOZIMI: ${sotuvchiLavozim.length ? "BOR — " + sotuvchiLavozim.map((l) => l.nomi).join(", ") : "YO'Q"}`);

    // --- Xodimlar (a'zoliklari bilan)
    const xodimXom = await rawPrisma.employee.findMany({
      where: { businessId: b.id },
      select: {
        id: true, ism: true, lavozim: true, tel: true, userId: true, isActive: true, deletedAt: true,
        kategoriyalar: { select: { category: { select: { nomi: true } } } },
      },
      orderBy: { ism: "asc" },
    });
    const xodimlar: XodimQator[] = xodimXom.map((x) => ({
      id: x.id, ism: x.ism, lavozim: x.lavozim, tel: x.tel, userId: x.userId,
      isActive: x.isActive, deletedAt: x.deletedAt,
      lavozimlar: x.kategoriyalar.map((k) => k.category.nomi),
    }));
    console.log(`XODIMLAR: ${xodimlar.length} ta (faol ${xodimlar.filter((x) => x.isActive && !x.deletedAt).length})`);
    for (const x of xodimlar) {
      console.log(
        `  · emp ${qisqa(x.id)} ${ust(niqob(x.ism), 12)} lavozim matni "${x.lavozim ?? "—"}" · tel ${x.tel ? "BOR" : "yo'q"} · ` +
          `user ${x.userId ? qisqa(x.userId) : "BOG'LANMAGAN"} · a'zoliklar: ${x.lavozimlar.join(", ") || "—"}` +
          `${x.deletedAt ? " · O'CHIRILGAN" : x.isActive ? "" : " · NOFAOL"}`
      );
    }

    // --- Eski zakazlar: mas'ul kesimida
    const masulJam = await rawPrisma.deal.groupBy({
      by: ["masulId"],
      where: { businessId: b.id, deletedAt: null },
      _count: { _all: true },
    });
    const sotuvIdlar = sotuvchiLavozim.map((l) => l.id);
    const biriktiruvli = sotuvIdlar.length
      ? await rawPrisma.deal.count({
          where: { businessId: b.id, deletedAt: null, xodimlar: { some: { categoryId: { in: sotuvIdlar } } } },
        })
      : 0;
    console.log(`ESKI ZAKAZLAR: ${jamiZakaz} ta (sotuvchi biriktiruvi bor: ${biriktiruvli}) · mas'ullar: ${masulJam.length} ta`);

    // --- Xaritalash jadvali
    const userXarita = new Map(tenantUserlar.map((u) => [u.id, u]));
    console.log("");
    console.log(
      `| ${ust("MAS'UL (Deal.masulId)", 25)} | ${ust("USER", 20)} | ${ust("EMPLOYEE", 25)} | ${ust("ZAKAZ", 5)} | ${ust("CONFIDENCE", 10)} | ${ust("DALIL", 44)} | ACTION`
    );
    console.log(`|${"-".repeat(27)}|${"-".repeat(22)}|${"-".repeat(27)}|${"-".repeat(7)}|${"-".repeat(12)}|${"-".repeat(46)}|${"-".repeat(30)}`);

    for (const m of masulJam.sort((a, b2) => b2._count._all - a._count._all)) {
      const u = userXarita.get(m.masulId);
      const soni = m._count._all;
      if (!u) {
        console.log(
          `| ${ust(qisqa(m.masulId), 25)} | ${ust("TENANTDA YO'Q", 20)} | ${ust("—", 25)} | ${ust(String(soni), 5)} | ${ust("NONE", 10)} | ${ust("foydalanuvchi topilmadi", 44)} | tekshirish kerak`
        );
        jamiQolda += soni;
        continue;
      }
      const { ishonch, nomzodlar, dalil } = xaritala(u, xodimlar);
      const empMatn =
        nomzodlar.length === 0 ? "—" : nomzodlar.length === 1 ? qisqa(nomzodlar[0].xodim.id) : `${nomzodlar.length} nomzod ↓`;
      const direktor = u.rol === "OWNER" || u.rol === "ADMIN";
      const action =
        ishonch === "EXACT"
          ? direktor
            ? "TASDIQ: direktor sotuvchimi?"
            : "bog'lash + a'zolik → migratsiya"
          : ishonch === "LIKELY"
            ? "QO'LDA TASDIQ kerak"
            : ishonch === "AMBIGUOUS"
              ? "QO'LDA TANLASH kerak"
              : direktor
                ? "TEGILMAYDI (direktor)"
                : "xodim kartochkasi kerak";
      console.log(
        `| ${ust(qisqa(m.masulId), 25)} | ${ust(`${niqob(u.ism)} ${u.rol}${u.isActive ? "" : " NOFAOL"}`, 20)} | ${ust(empMatn, 25)} | ` +
          `${ust(String(soni), 5)} | ${ust(ishonch, 10)} | ${ust(dalil, 44)} | ${action}`
      );
      // Bir nechta nomzod bo'lsa — har birini alohida qatorda (qo'lda tanlash uchun).
      if (nomzodlar.length > 1) {
        for (const n of nomzodlar) {
          console.log(
            `|${" ".repeat(27)}|${" ".repeat(22)}| nomzod: ${qisqa(n.xodim.id)} ${niqob(n.xodim.ism)} · ` +
              `ism ${n.mosToken}/${n.jamiToken} token · tel ${n.telHolati === "teng" ? "teng" : "yo'q"} · lavozim matni "${n.xodim.lavozim ?? "—"}"`
          );
        }
      }
      if (ishonch === "EXACT" && !direktor) jamiMigratsiya += soni;
      else jamiQolda += soni;
    }

    // --- Mas'ul bo'lmagan, lekin "sotuvchi" belgisi bor xodimlar
    const sotuvchiBelgili = xodimlar.filter(
      (x) => !x.deletedAt && (x.lavozim ?? "").toLowerCase().includes("sotuvchi")
    );
    if (sotuvchiBelgili.length) {
      console.log("");
      console.log("LAVOZIM MATNIDA \"sotuvchi\" bor xodimlar (a'zolik uchun nomzodlar):");
      for (const x of sotuvchiBelgili) {
        const masulmi = masulJam.some((m) => userXarita.get(m.masulId) && xaritala(userXarita.get(m.masulId)!, xodimlar).nomzodlar.some((n) => n.xodim.id === x.id));
        console.log(
          `  · emp ${qisqa(x.id)} ${niqob(x.ism)} · user ${x.userId ? qisqa(x.userId) : "yo'q"} · ` +
            `mas'ul zakazlari bilan bog'liqmi: ${masulmi ? "ha (yuqoridagi jadvalda)" : "yo'q — zakazsiz sotuvchi"}`
        );
      }
    }
  }

  console.log(`\n${"=".repeat(100)}`);
  console.log("XULOSA (hech narsa yozilmadi):");
  console.log(`  EXACT bog'lanish bilan migratsiya bo'ladigan zakazlar: ${jamiMigratsiya}`);
  console.log(`  Qo'lda qaror talab qiladigan zakazlar: ${jamiQolda}`);
  console.log("HOLAT: OK — faqat o'qildi.");
}

main()
  .then(() => rawPrisma.$disconnect())
  .catch(async (e) => {
    console.error("XATO:", e);
    await rawPrisma.$disconnect();
    process.exit(1);
  });

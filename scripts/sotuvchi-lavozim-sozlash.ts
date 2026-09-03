/**
 * SOTUVCHI LAVOZIMINI SOZLASH — bir martalik, IDEMPOTENT ma'lumot amali.
 *
 * NIMA QILADI (faqat `--qollash` bilan):
 *   1. Biznesda "sotuvchi" TURIDAGI `EmployeeCategory` bo'lmasa — yaratadi;
 *   2. Berilgan xodimlarni shu lavozimga a'zo qiladi (`EmployeeCategoryMember`);
 *   3. Berilgan `employeeId:userId` juftliklari uchun `Employee.userId` ni
 *      to'ldiradi — FAQAT hozir NULL bo'lsa.
 *
 * NIMA QILMAYDI: hech narsani o'chirmaydi, mavjud `userId` ni QAYTA yozmaydi,
 * ro'yxatda bo'lmagan xodimga tegmaydi, foydalanuvchi YARATMAYDI, `Deal` ga
 * umuman tegmaydi (zakaz biriktiruvi alohida skript — masul-sotuvchi-migratsiya).
 *
 * HIMOYA — yozishdan OLDIN hammasi tekshiriladi, bitta shart buzilsa BIRORTA
 * yozuv yozilmaydi (avval tekshir, keyin bitta tranzaksiyada yoz):
 *   · biznes mavjud;
 *   · har xodim SHU biznesniki, o'chirilmagan va faol;
 *   · har foydalanuvchi shu biznes TENANT'iga tegishli va faol;
 *   · foydalanuvchi shu bizneste ishlaydi (biznesga biriktirilgan yoki
 *     direktor/administrator — biriktiruvsiz barcha bizneslarga kiradi);
 *   · xodimning `userId` si NULL yoki AYNI o'sha foydalanuvchi (aks holda xato);
 *   · bitta foydalanuvchi ikkita xodimga bog'lanmaydi.
 *
 * IDEMPOTENT: qayta ishga tushirilsa mavjud lavozim qayta ishlatiladi,
 * mavjud a'zolik va mavjud bog'lanish o'tkazib yuboriladi.
 *
 * Standart rejim — QURUQ (dry-run). Qo'llash: `-- --qollash`.
 *
 * Sozlash (workflow'dan uzatiladi, kodga qotirilmagan):
 *   BUSINESS_ID       — majburiy;
 *   LAVOZIM_NOMI      — default "Sotuvchi";
 *   AZO_EMPLOYEE_IDS  — vergul bilan: "empId1,empId2";
 *   BOGLASH           — vergul bilan: "empId:userId,empId2:userId2".
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";

const QOLLASH = process.argv.includes("--qollash");
const BUSINESS_ID = (process.env.BUSINESS_ID ?? "").trim();
const LAVOZIM_NOMI = (process.env.LAVOZIM_NOMI ?? "Sotuvchi").trim();
const AZOLAR = (process.env.AZO_EMPLOYEE_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const BOGLASHLAR = (process.env.BOGLASH ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((juft) => {
    const [employeeId, userId] = juft.split(":").map((x) => x.trim());
    return { employeeId, userId };
  });

function yiqit(sabab: string): never {
  console.error(`\n❌ TO'XTADI: ${sabab}`);
  console.error("   Bazaga HECH NARSA yozilmadi.");
  process.exit(1);
}

async function main() {
  console.log(QOLLASH ? "REJIM: QO'LLASH (bazaga yoziladi)" : "REJIM: QURUQ (dry-run) — bazaga YOZILMAYDI");
  if (!BUSINESS_ID) yiqit("BUSINESS_ID berilmagan");

  const biznes = await rawPrisma.business.findUnique({
    where: { id: BUSINESS_ID },
    select: { id: true, nomi: true, tenantId: true },
  });
  if (!biznes) yiqit(`Biznes topilmadi: ${BUSINESS_ID}`);
  console.log(`Biznes: ${biznes.id} · tenant: ${biznes.tenantId}`);

  // ---------- 1. LAVOZIM ----------
  const mavjudSotuvchi = await rawPrisma.employeeCategory.findFirst({
    where: { businessId: biznes.id, turi: "sotuvchi" },
    select: { id: true, nomi: true, aktiv: true, kopXodim: true, zakazgaBiriktiriladi: true },
  });
  const nomBand = await rawPrisma.employeeCategory.findFirst({
    where: { businessId: biznes.id, nomi: LAVOZIM_NOMI },
    select: { id: true, turi: true },
  });
  if (!mavjudSotuvchi && nomBand) {
    yiqit(`"${LAVOZIM_NOMI}" nomi band, lekin turi "${nomBand.turi}" — qo'lda hal qiling`);
  }
  console.log(
    mavjudSotuvchi
      ? `LAVOZIM: mavjud (${mavjudSotuvchi.id}, "${mavjudSotuvchi.nomi}") — qayta ishlatiladi`
      : `LAVOZIM: yaratiladi — "${LAVOZIM_NOMI}" [turi=sotuvchi, zakazga=true, kopXodim=false, tartib=0]`
  );

  // ---------- 2. A'ZOLAR ----------
  const xodimlar = await rawPrisma.employee.findMany({
    where: { id: { in: AZOLAR }, businessId: biznes.id },
    select: { id: true, ism: true, isActive: true, deletedAt: true, userId: true, lavozim: true },
  });
  for (const id of AZOLAR) {
    const x = xodimlar.find((e) => e.id === id);
    if (!x) yiqit(`Xodim topilmadi yoki bu biznesga tegishli emas: ${id}`);
    if (x.deletedAt) yiqit(`Xodim o'chirilgan: ${id}`);
    if (!x.isActive) yiqit(`Xodim nofaol: ${id}`);
  }
  const mavjudAzolik = mavjudSotuvchi
    ? await rawPrisma.employeeCategoryMember.findMany({
        where: { businessId: biznes.id, categoryId: mavjudSotuvchi.id, employeeId: { in: AZOLAR } },
        select: { employeeId: true },
      })
    : [];
  const azoBor = new Set(mavjudAzolik.map((a) => a.employeeId));
  console.log(`A'ZOLAR: ${AZOLAR.length} ta so'ralgan`);
  for (const x of xodimlar) {
    console.log(
      `  · ${x.id} · eski lavozim matni "${x.lavozim ?? "—"}" · ${azoBor.has(x.id) ? "ALLAQACHON a'zo (o'tkaziladi)" : "a'zo qilinadi"}`
    );
  }

  // ---------- 3. USER ↔ EMPLOYEE ----------
  console.log(`BOG'LANISH: ${BOGLASHLAR.length} ta so'ralgan`);
  const boglanadigan: { employeeId: string; userId: string }[] = [];
  for (const juft of BOGLASHLAR) {
    if (!juft.employeeId || !juft.userId) yiqit(`BOGLASH formati xato: "${juft.employeeId}:${juft.userId}"`);
    const x = await rawPrisma.employee.findFirst({
      where: { id: juft.employeeId, businessId: biznes.id },
      select: { id: true, userId: true, deletedAt: true, isActive: true },
    });
    if (!x) yiqit(`Bog'lash uchun xodim topilmadi (biznes mos emas): ${juft.employeeId}`);
    if (x.deletedAt || !x.isActive) yiqit(`Bog'lash uchun xodim o'chirilgan/nofaol: ${juft.employeeId}`);

    const u = await rawPrisma.user.findFirst({
      where: { id: juft.userId, tenantId: biznes.tenantId },
      select: { id: true, rol: true, isActive: true, businessId: true, bizneslar: { select: { businessId: true } } },
    });
    if (!u) yiqit(`Foydalanuvchi topilmadi yoki boshqa tenantda: ${juft.userId}`);
    if (!u.isActive) yiqit(`Foydalanuvchi nofaol: ${juft.userId}`);
    // Biznesda ishlaydimi: biriktirilgan, eski usulda biriktirilgan yoki
    // direktor/administrator (ular biriktirilmaydi — barcha bizneslar).
    const biznesda =
      u.rol === "OWNER" ||
      u.rol === "ADMIN" ||
      u.businessId === biznes.id ||
      u.bizneslar.some((ub) => ub.businessId === biznes.id) ||
      (!u.businessId && u.bizneslar.length === 0);
    if (!biznesda) yiqit(`Foydalanuvchi bu bizneste ishlamaydi: ${juft.userId}`);

    // Bitta foydalanuvchi — bitta xodim kartochkasi (shu bizneste).
    const boshqaXodim = await rawPrisma.employee.findFirst({
      where: { businessId: biznes.id, userId: juft.userId, deletedAt: null, id: { not: juft.employeeId } },
      select: { id: true },
    });
    if (boshqaXodim) yiqit(`Bu foydalanuvchi allaqachon boshqa xodimga bog'langan: ${boshqaXodim.id}`);

    if (x.userId === juft.userId) {
      console.log(`  · ${juft.employeeId} → ${juft.userId} · ALLAQACHON bog'langan (o'tkaziladi)`);
      continue;
    }
    if (x.userId) yiqit(`Xodimda BOSHQA userId bor (qayta yozilmaydi): ${juft.employeeId} → ${x.userId}`);
    console.log(`  · ${juft.employeeId} → ${juft.userId} · bog'lanadi (hozir NULL)`);
    boglanadigan.push(juft);
  }

  const qoshiladiganAzolar = AZOLAR.filter((id) => !azoBor.has(id));
  console.log("");
  console.log("REJA:");
  console.log(`  Lavozim yaratiladi: ${mavjudSotuvchi ? "yo'q (mavjud)" : "ha"}`);
  console.log(`  Yangi a'zolik: ${qoshiladiganAzolar.length} ta`);
  console.log(`  Yangi bog'lanish: ${boglanadigan.length} ta`);
  console.log("  Tegilmaydi: ro'yxatda bo'lmagan xodimlar, Deal jadvali, mavjud userId'lar.");

  if (!QOLLASH) {
    console.log("\nQURUQ rejim — hech narsa yozilmadi. Qo'llash: -- --qollash");
    return;
  }

  // ---------- YOZISH (bitta tranzaksiya) ----------
  const natija = await rawPrisma.$transaction(async (tx) => {
    let categoryId = mavjudSotuvchi?.id;
    if (!categoryId) {
      const yangi = await tx.employeeCategory.create({
        data: {
          businessId: biznes.id,
          nomi: LAVOZIM_NOMI,
          turi: "sotuvchi",
          aktiv: true,
          tartib: 0,
          zakazgaBiriktiriladi: true,
          kopXodim: false,
        },
        select: { id: true },
      });
      categoryId = yangi.id;
    }
    for (const employeeId of qoshiladiganAzolar) {
      await tx.employeeCategoryMember.create({ data: { businessId: biznes.id, categoryId, employeeId } });
    }
    for (const juft of boglanadigan) {
      // `userId: null` sharti — poyga holatida ham qayta yozilmasin.
      const n = await tx.employee.updateMany({
        where: { id: juft.employeeId, businessId: biznes.id, userId: null },
        data: { userId: juft.userId },
      });
      if (n.count !== 1) throw new Error(`Bog'lanish yozilmadi (userId endi NULL emas): ${juft.employeeId}`);
    }
    return { categoryId };
  });

  console.log(`\n✅ Yozildi. Lavozim: ${natija.categoryId}`);

  // ---------- TEKSHIRUV (o'qish) ----------
  const yakun = await rawPrisma.employeeCategory.findFirst({
    where: { id: natija.categoryId, businessId: biznes.id },
    select: {
      id: true, nomi: true, turi: true, aktiv: true, kopXodim: true, zakazgaBiriktiriladi: true,
      azolar: { select: { employee: { select: { id: true, userId: true, isActive: true } } } },
    },
  });
  console.log(
    `TEKSHIRUV: "${yakun?.nomi}" [turi=${yakun?.turi}, aktiv=${yakun?.aktiv}, zakazga=${yakun?.zakazgaBiriktiriladi}, kopXodim=${yakun?.kopXodim}]`
  );
  for (const a of yakun?.azolar ?? []) {
    console.log(`  · a'zo ${a.employee.id} · user ${a.employee.userId ?? "yo'q"} · faol ${a.employee.isActive}`);
  }
}

main()
  .then(() => rawPrisma.$disconnect())
  .catch(async (e) => {
    console.error("XATO:", e);
    await rawPrisma.$disconnect();
    process.exit(1);
  });

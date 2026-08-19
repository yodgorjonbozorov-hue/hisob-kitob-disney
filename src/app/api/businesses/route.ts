import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { createBusinessSchema } from "@/lib/validation/business";
import { getAccessibleBusinesses } from "@/lib/business";
import { DEFAULT_KASSA_NOMI } from "@/lib/services/accounts";
import { faoliyatByCode, faoliyatModullari } from "@/lib/biznesFaoliyati";
import { planByCode } from "@/lib/billing/plans";
import { modulByCode } from "@/lib/modules/registry";

export const GET = withTenant(async (_request, _ctx, { session: user }) => {
  // Foydalanuvchi kira oladigan bizneslar (admin → barcha faol; kassir → o'ziniki).
  const businesses = await getAccessibleBusinesses(user);
  return NextResponse.json(businesses);
});

export const POST = withTenant(async (request, _ctx, { session: user, tenantId, tenant }) => {
  requireManager(user.rol);

  const body = await request.json();
  const parsed = createBusinessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // Faoliyat tanlangan bo'lsa u bayroqlarni belgilaydi: foydalanuvchi
  // "omborli"/"magazin" texnik nomlarini bilishi shart emas.
  const { faoliyat: faoliyatKodi, ...maydonlar } = parsed.data;
  const faoliyat = faoliyatByCode(faoliyatKodi);
  const faoliyatdan = faoliyat
    ? { turi: faoliyat.turi, omborli: faoliyat.omborli, magazin: faoliyat.magazin }
    : {};

  // Avto rejimi ombor tizimisiz ishlamaydi — birga yoqiladi (so'rovdagi qiymatdan ustun).
  const turi = faoliyat?.turi ?? maydonlar.turi;
  const avtoMajburiy = turi === "avto" ? { omborli: true } : {};
  // Magazin (kassa) ombor ustidagi qatlam — ombor yoqilmasa kassaning ma'nosi yo'q.
  const magazinTalabi =
    (faoliyatdan as { magazin?: boolean }).magazin ?? maydonlar.magazin ? { omborli: true } : {};
  // tenantId kontekstdan — extension ham xuddi shu qiymatni majburlaydi (lib/db/tenantDb.ts).
  const business = await prisma.business.create({
    data: { ...maydonlar, ...faoliyatdan, ...avtoMajburiy, ...magazinTalabi, tenantId },
  });

  // Tanlangan faoliyat uchun kerakli MODULLAR yoqiladi (tarifda bo'lsa).
  //
  // DIQQAT: bu funksiya faqat YOQADI. Mavjud yoqilgan modullar o'chirilmaydi
  // va boshqa bizneslarga ta'sir qilmaydi — "Do'kon" tanlangani boshqa
  // biznesning menyusini o'zgartirmaydi.
  if (faoliyat) {
    await modullarniYoq(tenant.plan, faoliyatModullari(faoliyat));
  }

  // Har biznesda kamida bitta kassa bo'lishi shart, aks holda yozuv qayerga
  // tushishini ko'rsatib bo'lmaydi (signup'dagi bilan bir xil qoida).
  await prisma.account.create({
    data: { businessId: business.id, nomi: DEFAULT_KASSA_NOMI, turi: "naqd", tartib: 0 },
  });

  return NextResponse.json(business, { status: 201 });
});

/**
 * Berilgan modul kodlarini tenant uchun yoqadi (tarifda bo'lsa).
 *
 * Idempotent va faqat qo'shuvchi: allaqachon yoqilgan modul tegilmaydi,
 * yoqilmagan modul esa hech qachon O'CHIRILMAYDI.
 */
async function modullarniYoq(planKodi: string, kodlar: string[]): Promise<void> {
  const plan = planByCode(planKodi);
  for (const code of kodlar) {
    const modul = modulByCode(code);
    if (!modul || modul.core) continue;
    if (!plan?.modullar.includes(code)) continue; // tarifda yo'q — jimgina o'tkazamiz
    const bor = await prisma.tenantModule.findFirst({ where: { code }, select: { id: true, isActive: true } });
    if (bor) {
      if (!bor.isActive) {
        await prisma.tenantModule.update({ where: { id: bor.id }, data: { isActive: true } });
      }
    } else {
      await prisma.tenantModule.create({ data: { code, isActive: true } as never });
    }
  }
}

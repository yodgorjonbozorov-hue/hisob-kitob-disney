import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { ForbiddenError, BadRequestError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import {
  moveDeal,
  biznesXodimi,
  holatniOzgartirish,
  bugungaKochirish,
  zakazTolovlariniAlmashtirish,
} from "@/lib/crm/service";
import { zakazniYakunlash } from "@/lib/crm/yakunlash";
import { buyurtmaPatchSchema } from "@/lib/validation/crm";
import { dashboardYangilandi } from "@/lib/cache";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import {
  jamoaOzgartiraOladimi,
  sotuvchiUserIdTop,
  zakazXodimlari,
  zakazXodimlariniSaqlash,
} from "@/lib/services/zakazJamoasi";
import { zakazBahosi } from "@/lib/services/zakazBaho";
import { sotuvchiniOzgartirish, zakazSotuvchisi } from "@/lib/services/zakazSotuvchi";
import { hasPermission } from "@/lib/permissions/tekshir";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";
import type { Prisma } from "@prisma/client";

/** Buyurtma tafsiloti + faoliyat tarixi (timeline) + bog'langan kirim. */
export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    const deal = await prisma.deal.findFirst({
      where: { id: params.id, businessId: businessId ?? "-", deletedAt: null },
      include: {
        contact: true,
        stage: true,
        category: { select: { id: true, nomi: true } },
        transaction: { select: { id: true, summa: true, sana: true, deletedAt: true } },
        debt: { select: { id: true, jamiSumma: true, tolangan: true, status: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!deal) return NextResponse.json({ error: "Buyurtma topilmadi" }, { status: 404 });
    // Zakazdagi xodimlar (kategoriya kesimida) — tafsilot oynasi ko'rsatadi.
    // `sotuvchi` alohida qaytadi: u ijrochilardan boshqa tushuncha (38-talab).
    const [xodimlar, sotuvchi, baho] = await Promise.all([
      zakazXodimlari(businessId ?? "-", deal.id),
      zakazSotuvchisi(businessId ?? "-", deal.id),
      zakazBahosi(businessId ?? "-", deal.id),
    ]);
    return NextResponse.json({ ...deal, xodimlar, sotuvchi, baho });
  },
  { module: "CRM" }
);

/**
 * Buyurtmani tahrirlash / holatga ko'chirish.
 *
 * DIQQAT: kirim yozilgandan keyin SUMMA va KATEGORIYA qulflanadi — aks holda
 * CRM bir raqamni, Kirim boshqasini ko'rsatardi (yozilgan tranzaksiya
 * o'zgarmaydi). Ularni o'zgartirish uchun avval Kirimdagi yozuv tahrirlanadi.
 */
export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = buyurtmaPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    const data = parsed.data;

    const maydonlar =
      data.nomi !== undefined ||
      data.summa !== undefined ||
      data.izoh !== undefined ||
      data.sana !== undefined ||
      data.categoryId !== undefined ||
      data.masulId !== undefined ||
      data.tolangan !== undefined ||
      data.tolovTuri !== undefined ||
      data.tolovlar !== undefined;

    if (maydonlar) {
      const existing = await prisma.deal.findFirst({
        where: { id: params.id, businessId, deletedAt: null },
        select: { id: true, holat: true, transactionId: true, debtId: true, summa: true, tolangan: true },
      });
      if (!existing) throw new ForbiddenError("Buyurtma topilmadi");

      if (existing.transactionId && (data.summa !== undefined || data.categoryId !== undefined)) {
        throw new BadRequestError(
          "Kirim yozilgan buyurtmaning summasi va kategoriyasi o'zgartirilmaydi"
        );
      }
      // TO'LOV moliyaga o'tgach QULFLANADI: kirim/qarz yozuvlari allaqachon
      // shu raqamlardan chiqqan, ularni keyin surish CRM va moliyani zid
      // holatga tushirardi (summa/kategoriya bilan bir xil qoida).
      if (
        (existing.transactionId || existing.debtId) &&
        (data.tolangan !== undefined ||
          data.tolovTuri !== undefined ||
          data.tolovlar !== undefined ||
          (data.summa !== undefined && data.summa !== existing.summa))
      ) {
        throw new BadRequestError(
          "Moliyaga o'tgan zakazning summasi va to'lovi o'zgartirilmaydi — Kirim yoki Qarzdorlik bo'limidan tuzating"
        );
      }
      const yangiSumma = data.summa ?? existing.summa;
      const yangiTolangan = data.tolangan ?? existing.tolangan;
      if (yangiTolangan > yangiSumma) {
        throw new BadRequestError("To'langan summa zakaz narxidan ko'p bo'lmasligi kerak");
      }

      if (data.categoryId) {
        const cat = await prisma.category.findFirst({
          where: { id: data.categoryId, businessId },
          select: { turi: true },
        });
        if (!cat) throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
        if (cat.turi !== "kirim") throw new BadRequestError("Kategoriya kirim turida bo'lishi kerak");
      }
      // Mas'ul xodim — shu BIZNESning xodimi (tenant filtri o'zi yetarli emas:
      // bir kompaniyaning ikkinchi biznesidagi xodim ham o'tib ketardi).
      if (data.masulId) await biznesXodimi(businessId, data.masulId);

      const patch: Prisma.DealUpdateInput = {};
      if (data.nomi !== undefined) patch.nomi = data.nomi;
      if (data.summa !== undefined) patch.summa = data.summa;
      if (data.izoh !== undefined) patch.izoh = data.izoh;
      if (data.masulId !== undefined) patch.masulId = data.masulId;
      if (data.sana !== undefined) patch.sana = data.sana ? dateOnlyStringToUTCDate(data.sana) : null;
      // ARALASH TO'LOV berilganda `tolangan`/`tolovTuri` bu yerda YOZILMAYDI:
      // ularni qatorlardan `zakazTolovlariniAlmashtirish` hisoblab, qatorlar
      // bilan BITTA tranzaksiyada yozadi (ikki xil raqam bo'lmasin).
      if (data.tolovlar === undefined && data.tolangan !== undefined) patch.tolangan = data.tolangan;
      if (data.tolovlar === undefined && data.tolovTuri !== undefined) patch.tolovTuri = data.tolovTuri;
      if (data.categoryId !== undefined) {
        patch.category = data.categoryId ? { connect: { id: data.categoryId } } : { disconnect: true };
      }
      await prisma.deal.update({ where: { id: params.id }, data: patch });

      // ARALASH TO'LOV qatorlari — atomik (qatorlar + yig'indi bir tranzaksiyada).
      // Tekshiruv yozishdan OLDIN bo'lgani uchun bu qadam faqat baza xatosida
      // yiqiladi; narx esa yuqorida allaqachon shu qatorlarga qarshi tekshirilgan.
      if (data.tolovlar !== undefined) {
        await zakazTolovlariniAlmashtirish({
          businessId,
          dealId: params.id,
          tolovlar: data.tolovlar,
          tolovTuri: data.tolovTuri ?? null,
          summa: yangiSumma,
        });
      }

      // YUTILGAN, lekin moliyasi hali yozilmagan zakazda (to'lov endi
      // belgilandi) kirim/qarz DARHOL yoziladi — foydalanuvchi alohida
      // "kirimga o'tkazish" bosmaydi. Idempotent: mavjud yozuv takrorlanmaydi.
      // `holat` ham kelgan bo'lsa quyidagi blok o'zi hal qiladi.
      const tolovOzgardi =
        data.tolangan !== undefined ||
        data.tolovTuri !== undefined ||
        data.tolovlar !== undefined ||
        data.summa !== undefined;
      if (existing.holat === "YUTILDI" && !existing.transactionId && !existing.debtId && tolovOzgardi && !data.holat) {
        await zakazniYakunlash({ businessId, dealId: params.id, userId: user.userId });
      }
    }

    // SOTUVCHINI ALMASHTIRISH (10-talab) — CRM'ga kira olgan har bir xodim
    // uchun ochiq: bitta kompyuterda ochiq turgan hisob sotuvchini
    // ANIQLAMAYDI, shuning uchun noto'g'ri yozilgan sotuvchini tuzatish
    // kundalik amal. Cheklov xizmat qatlamida: faqat shu biznesning FAOL
    // sotuvchisi tanlanadi. Amal atomik va audit jurnaliga yoziladi
    // (kim edi → kimga o'tdi → kim o'zgartirdi → qachon).
    if (data.sotuvchiId !== undefined) {
      await sotuvchiniOzgartirish({
        businessId,
        dealId: params.id,
        employeeId: data.sotuvchiId,
        userId: user.userId,
      });
    }

    // Zakaz JAMOASINI almashtirish — kirim yozilgan buyurtmada xizmat
    // qatlami o'zi qulflaydi. HUQUQ (37-talab): `crm.jamoa` yoki zakazning
    // o'z mas'uli (yakunlangunga qadar) — oddiy xodim boshqalarning
    // biriktiruvini o'zgartirib statistikani buza olmaydi.
    // Sotuvchi biriktiruvi mas'ulni yetaklaydi (createDeal bilan bir xil
    // qoida): keyin kirim yozilsa `sotuvchiId` ayni sotuvchiga tushadi.
    if (data.xodimlar !== undefined) {
      const ruxsat = await jamoaOzgartiraOladimi({
        businessId,
        dealId: params.id,
        userId: user.userId,
        huquqBor: await hasPermission(user.userId, "crm.jamoa"),
      });
      if (!ruxsat) throw new ForbiddenError("Zakaz jamoasini o'zgartirish uchun sizda huquq yo'q");
      await zakazXodimlariniSaqlash(businessId, params.id, data.xodimlar, user.userId);
      const sotuvchiUserId = await sotuvchiUserIdTop(businessId, data.xodimlar);
      if (sotuvchiUserId) {
        const sotuvchi = await prisma.user.findFirst({
          where: { id: sotuvchiUserId, isActive: true, ...biznesXodimlariWhere(businessId) },
          select: { id: true },
        });
        if (sotuvchi) {
          await prisma.deal.update({ where: { id: params.id }, data: { masulId: sotuvchi.id } });
        }
      }
    }

    // "Bugungi zakazga o'tkazish" — sanani bugunga suradi (holat o'zgarmaydi).
    if (data.bugungaKochir) {
      await bugungaKochirish({ businessId, dealId: params.id, userId: user.userId });
    }

    // HOLAT o'zgarishi maydonlardan KEYIN: YUTILDI yangi summa/to'lov bilan
    // yakunlansin.
    if (data.holat) {
      if (data.holat === "YUTILDI") {
        // MOLIYAVIY YAKUN: kirim + qarzdorlik, atomik va idempotent
        // (`lib/crm/yakunlash.ts`). Takroriy bosish yangi kirim yaratmaydi.
        await zakazniYakunlash({ businessId, dealId: params.id, userId: user.userId });
      } else {
        await holatniOzgartirish({
          businessId,
          dealId: params.id,
          holat: data.holat,
          userId: user.userId,
        });
      }
    }

    // ESKI YO'L (bosqichga sudrash) buzilmaydi: WON + kirimYoz bo'lsa kirim
    // yangi summa/kategoriya bilan yoziladi.
    if (data.stageId) {
      await moveDeal({
        businessId,
        dealId: params.id,
        stageId: data.stageId,
        kirimYoz: data.kirimYoz,
        userId: user.userId,
      });
    }

    // Dashboardga uch yo'l bilan ta'sir qiladi: summa/sana tahriri
    // "yangi buyurtmalar" ni, WON bosqichiga ko'chirish "yutilgan" ni,
    // `kirimYoz` esa KIRIM tranzaksiyasini o'zgartiradi.
    dashboardYangilandi(businessId);

    const deal = await prisma.deal.findFirst({
      where: { id: params.id, businessId },
      include: {
        contact: { select: { ism: true, tel: true } },
        stage: true,
        category: { select: { id: true, nomi: true } },
      },
    });
    return NextResponse.json(deal);
  },
  { module: "CRM" }
);

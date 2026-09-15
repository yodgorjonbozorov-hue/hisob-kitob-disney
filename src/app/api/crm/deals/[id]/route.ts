import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { ForbiddenError, BadRequestError, requireManager } from "@/lib/auth/guard";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import {
  moveDeal,
  biznesXodimi,
  holatniOzgartirish,
  bugungaKochirish,
  zakazMijoziniOzgartirish,
  zakazniOchirish,
  zakazTolovlariniAlmashtirish,
} from "@/lib/crm/service";
import { zakazniYakunlash } from "@/lib/crm/yakunlash";
import { zakazTolovHisobi } from "@/lib/crm/tolovQoshish";
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
    //
    // TO'LOV HISOBI HAM SHU YERDA: tafsilot oynasi jami/to'langan/qoldiq va
    // to'lovlar ro'yxatini doskadan kelgan ESKI snapshotdan emas, har
    // ochilganda SERVERDAN oladi — shuning uchun qo'shilgan to'lov sahifa
    // yangilanmasa ham ko'rinadi va yo'qolib qolmaydi.
    const [xodimlar, sotuvchi, baho, tolovHisobi] = await Promise.all([
      zakazXodimlari(businessId ?? "-", deal.id),
      zakazSotuvchisi(businessId ?? "-", deal.id),
      zakazBahosi(businessId ?? "-", deal.id),
      zakazTolovHisobi(businessId ?? "-", deal.id),
    ]);
    return NextResponse.json({ ...deal, xodimlar, sotuvchi, baho, tolovHisobi });
  },
  { module: "CRM" }
);

/**
 * Buyurtmani tahrirlash / holatga ko'chirish.
 *
 * TO'LOV BU YERDA YOZILMAYDI. Zakaz to'lovi — LEDGER: yangi to'lov
 * `POST /api/crm/deals/[id]/tolov` orqali QO'SHILADI (oldingilariga
 * tegilmaydi va pul o'sha zahoti kirimga tushadi), xato yozilgani esa
 * `DELETE .../tolov/[tolovId]` bilan direktor tomonidan olib tashlanadi.
 * Bu route'dagi `tolangan`/`tolovTuri`/`tolovlar` maydonlari faqat hali
 * kirimi bo'lmagan eski zakazlarni tuzatish uchun qolgan.
 *
 * QULFLAR:
 *   - KATEGORIYA — birinchi kirim yozilgach (yozuv o'sha kategoriyada);
 *   - NARX — zakaz yakunlangach yoki qarzga yopilgach; har qanday holatda
 *     to'langan summadan past qilib bo'lmaydi;
 *   - "YUTILDI" — faqat to'liq to'langan (yoki ataylab qarzga yopilgan)
 *     zakazda (`lib/crm/yakunlash.ts`).
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

      // KATEGORIYA — kirim yozilgach qulflanadi: yozilgan tranzaksiya o'sha
      // kategoriyada turadi, CRM esa boshqasini ko'rsatib qolardi.
      if (existing.transactionId && data.categoryId !== undefined) {
        throw new BadRequestError(
          "Kirim yozilgan buyurtmaning kategoriyasi o'zgartirilmaydi"
        );
      }
      // NARX — to'lov kelgani narxni QULFLAMAYDI (aks holda birinchi
      // zalogdan keyin zakaz narxini umuman tuzatib bo'lmasdi: to'lovlar
      // endi alohida kirim yozuvlari, ular narxga bog'lanmagan). Narx
      // YAKUNLANGAN yoki qarzga yopilgan zakazdagina qulflanadi, va hech
      // qachon to'langan summadan past bo'la olmaydi (pastda).
      if (
        data.summa !== undefined &&
        data.summa !== existing.summa &&
        (existing.holat === "YUTILDI" || existing.debtId)
      ) {
        throw new BadRequestError(
          "Yakunlangan zakaz summasi o'zgartirilmaydi — avval \"Yutildi\"dan qaytaring"
        );
      }
      // TO'LOVNI BU YO'LDAN ALMASHTIRISH moliyaga o'tgach QULFLANADI.
      // To'lov endi LEDGER: yangi to'lov `POST /api/crm/deals/[id]/tolov`
      // orqali QO'SHILADI (oldingilariga tegmaydi), xatosi esa direktor
      // tomonidan o'chiriladi. Bu maydonlar faqat hali kirimi yo'q eski
      // zakazlarni tuzatish uchun qoldi.
      if (
        (existing.transactionId || existing.debtId) &&
        (data.tolangan !== undefined || data.tolovTuri !== undefined || data.tolovlar !== undefined)
      ) {
        throw new BadRequestError(
          "Zakaz to'lovi bu yerdan o'zgartirilmaydi — to'lovni \"To'lovlar\" bo'limidan qo'shing " +
            "yoki Kirim/Qarzdorlik bo'limidan tuzating"
        );
      }
      const yangiSumma = data.summa ?? existing.summa;
      const yangiTolangan = data.tolangan ?? existing.tolangan;
      // NARX TO'LANGANDAN PAST BO'LMAYDI: aks holda zakaz "ortiqcha
      // to'langan" holatga tushib, qoldiq manfiy bo'lib qolardi.
      if (yangiTolangan > yangiSumma) {
        throw new BadRequestError(
          `Narx to'langan summadan kam bo'lmasligi kerak (to'langan: ${yangiTolangan} so'm)`
        );
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

      // ESKI ZAKAZNI TUZATISH YO'LI: zakaz YUTILDI, lekin moliyasi hali
      // yozilmagan (to'lovi endi belgilandi) — kirim darhol yoziladi.
      // Yangi zakazlarda bu yo'lga ehtiyoj yo'q: to'lov qo'shilgan paytda
      // kirim allaqachon yozilgan bo'ladi (`lib/crm/tolovQoshish.ts`).
      // To'liq to'lanmagan bo'lsa `zakazniYakunlash` RAD ETADI.
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

    // MIJOZNI ALMASHTIRISH/TUZATISH. Sxemada `kontaktIsm`/`kontaktTel`
    // ilgari ham bor edi, lekin route ularni JIMGINA e'tiborsiz qoldirardi —
    // xato kiritilgan mijozni tuzatib bo'lmasdi. Telefon bo'yicha mavjud
    // kartochka qayta ishlatiladi (`lib/crm/service.ts`).
    if (data.kontaktIsm !== undefined || data.kontaktTel !== undefined) {
      await zakazMijoziniOzgartirish({
        businessId,
        dealId: params.id,
        userId: user.userId,
        kontaktIsm: data.kontaktIsm,
        kontaktTel: data.kontaktTel,
      });
    }

    // "Bugungi zakazga o'tkazish" — sanani bugunga suradi (holat o'zgarmaydi).
    if (data.bugungaKochir) {
      await bugungaKochirish({ businessId, dealId: params.id, userId: user.userId });
    }

    // HOLAT o'zgarishi maydonlardan KEYIN: YUTILDI yangi summa/to'lov bilan
    // yakunlansin.
    if (data.holat) {
      if (data.holat === "YUTILDI") {
        // YAKUN: holat + (kerak bo'lsa) yetishmagan kirim va ANIQ tanlov
        // bilan qarzdorlik — atomik va idempotent (`lib/crm/yakunlash.ts`).
        // To'liq to'lanmagan zakaz shu yerda RAD ETILADI: himoya serverda,
        // brauzerdagi tugmani o'chirish yetarli emas.
        await zakazniYakunlash({
          businessId,
          dealId: params.id,
          userId: user.userId,
          qarzgaYopish: data.qarzgaYopish,
        });
      } else {
        // YO'QOTISH SABABI va DIREKTOR HUQUQI xizmat qatlamiga uzatiladi:
        // moliyaga o'tgan "Yutildi" ni faqat boshqaruvchi qaytara oladi
        // (kirim o'chadi, qarz bekor bo'ladi — `lib/crm/qaytarish.ts`).
        await holatniOzgartirish({
          businessId,
          dealId: params.id,
          holat: data.holat,
          userId: user.userId,
          yoqotishSababi: data.yoqotishSababi,
          boshqaruvchi: isManager(user.rol),
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

/**
 * ZAKAZNI O'CHIRISH — YUMSHOQ, FAQAT DIREKTOR/ADMINISTRATOR.
 *
 * HUQUQ SERVERDA: `requireManager` — frontenddagi tugmani yashirish himoya
 * emas, oddiy xodim bu yo'lni to'g'ridan-to'g'ri chaqira olmaydi.
 *
 * Yozuv bazadan yo'qolmaydi (`deletedAt` + `deletedBy`). Audit ikki qatlamda:
 * avtomatik (lib/db/tenantDb.ts `updateMany` ni ushlaydi) va biznes hodisasi
 * sifatida — "delete" amali va aniq `entityId` bilan. Ikkinchisi xizmat
 * qatlamida yoziladi, shuning uchun zakaz qayerdan o'chirilsa ham jurnalda
 * bir xil ko'rinadi.
 */
export const DELETE = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    // Audit xizmat qatlamida yoziladi (`lib/crm/service.ts`) — u yerda
    // bo'lgani uchun zakaz qayerdan o'chirilsa ham jurnalga "delete" bo'lib
    // aniq `entityId` bilan tushadi.
    await zakazniOchirish({ businessId, dealId: params.id, userId: user.userId });

    dashboardYangilandi(businessId);
    return NextResponse.json({ ok: true });
  },
  { module: "CRM" }
);

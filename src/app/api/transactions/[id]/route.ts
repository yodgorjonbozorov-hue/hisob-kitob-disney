import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerOrAdmin, ForbiddenError } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { isManager } from "@/lib/auth/roles";
import { updateTransactionSchema } from "@/lib/validation/transaction";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { kgSumma, kgToGram } from "@/lib/kg";
import { resolveActiveBusinessId } from "@/lib/business";
import { resolveAccountId } from "@/lib/services/accounts";
import { dashboardYangilandi } from "@/lib/cache";
import { kunlikSinxron } from "@/lib/services/kunlik";
import { tekshirilganSotuvchi } from "@/lib/services/sotuvchi";
import { qarzQulfiniTekshir } from "@/lib/services/yozuvQulfi";

export const PATCH = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);

  const existing = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Tranzaksiya topilmadi" }, { status: 404 });
  }
  // Faqat aktiv biznesning yozuvi tahrirlanadi (cross-business himoya).
  if (existing.businessId !== businessId) {
    throw new ForbiddenError("Bu yozuv boshqa biznesga tegishli");
  }
  if (existing.deletedAt) {
    throw new ForbiddenError("O'chirilgan yozuvni tahrirlab bo'lmaydi");
  }
  requireOwnerOrAdmin(user.rol, user.userId, existing.userId);
  // Qarz to'lovi yozuvi bu yerdan tuzatilmaydi: kassa o'zgarib, qarz
  // qoldig'i o'sha-o'sha qolardi (lib/services/yozuvQulfi.ts).
  await qarzQulfiniTekshir(existing.businessId, existing.id);

  const body = await request.json();
  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const data = parsed.data;

  // Kategoriya o'zgartirilsa, u ham shu biznesga tegishli bo'lishi kerak.
  let yangiKategoriyaKg: boolean | null = null;
  if (data.categoryId !== undefined) {
    const cat = await prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { businessId: true, kgAsosli: true },
    });
    if (!cat || cat.businessId !== existing.businessId) {
      throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
    }
    yangiKategoriyaKg = cat.kgAsosli;
  }

  // KG SAVDOSI (mijozga xos — Fortex Selos).
  //
  // Invariant: kg yozuvida summa QO'LDA tahrirlanmaydi — u har doim
  // miqdor × 1 kg narxi (lib/kg.ts). Aks holda tarixdagi "100 kg × 5 000 =
  // 500 000" qatori o'zaro qarama-qarshi bo'lib qolardi.
  const kgYozuvi = existing.miqdorGr != null && existing.kgNarxi != null;
  const kgKeldi = data.miqdorKg != null && data.kgNarxi != null;
  if (kgKeldi) {
    const kgAsosli = yangiKategoriyaKg ?? kgYozuvi;
    if (!kgAsosli) {
      return NextResponse.json({ error: "Bu kategoriya kg bo'yicha savdo qilmaydi" }, { status: 400 });
    }
    if ((data.turi ?? existing.turi) !== "kirim") {
      return NextResponse.json({ error: "Kg savdosi faqat kirim uchun" }, { status: 400 });
    }
  }
  if (kgYozuvi && !kgKeldi) {
    if (data.summa !== undefined && data.summa !== existing.summa) {
      return NextResponse.json(
        {
          error:
            "Kg savdosi summasi miqdor × 1 kg narxidan hisoblanadi — miqdor yoki narxni o'zgartiring",
        },
        { status: 400 }
      );
    }
    if (yangiKategoriyaKg === false) {
      return NextResponse.json(
        { error: "Kg savdosini kg'siz kategoriyaga o'tkazib bo'lmaydi" },
        { status: 400 }
      );
    }
    if (data.turi !== undefined && data.turi !== existing.turi) {
      return NextResponse.json({ error: "Kg savdosi faqat kirim bo'lib qoladi" }, { status: 400 });
    }
  }
  const kgYangilash = kgKeldi
    ? {
        miqdorGr: kgToGram(data.miqdorKg!),
        kgNarxi: data.kgNarxi!,
        summa: kgSumma(kgToGram(data.miqdorKg!), data.kgNarxi!),
      }
    : null;

  // To'lov turi qoidasi yakuniy holatda tekshiriladi (turi va tolovTuri
  // birga yoki alohida o'zgarishi mumkin): qarz faqat kirim uchun.
  const yakuniyTuri = data.turi ?? existing.turi;
  const yakuniyTolov = data.tolovTuri !== undefined ? data.tolovTuri : existing.tolovTuri;
  if (yakuniyTolov === "qarz" && yakuniyTuri === "chiqim") {
    return NextResponse.json({ error: "Qarz to'lov turi faqat kirim uchun" }, { status: 400 });
  }

  // Kassa bog'lanishi to'lov turiga ergashadi: qarz — kassasiz; qarzdan
  // naqd/click'ka qaytsa — mos faol kassa qayta bog'lanadi.
  let accountYangilash: { accountId: string | null } | Record<string, never> = {};
  if (data.tolovTuri !== undefined) {
    if (yakuniyTolov === "qarz") {
      accountYangilash = { accountId: null };
    } else if (existing.accountId === null || data.accountId !== undefined) {
      accountYangilash = {
        accountId: await resolveAccountId(businessId!, data.accountId, yakuniyTolov),
      };
    }
  }

  // SOTUVCHI tuzatish: faqat kirimda; boshqa xodimni belgilash — boshqaruvchi
  // yoki xodim shu biznesniki ekani tekshiriladi (lib/services/sotuvchi.ts).
  // Kirim chiqimga aylansa sotuvchi tozalanadi (chiqimda savdo yo'q).
  let sotuvchiYangilash: { sotuvchiId: string | null } | Record<string, never> = {};
  if (data.sotuvchiId !== undefined) {
    if (data.sotuvchiId && yakuniyTuri !== "kirim") {
      return NextResponse.json({ error: "Sotuvchi faqat kirim uchun belgilanadi" }, { status: 400 });
    }
    if (data.sotuvchiId === null || data.sotuvchiId === user.userId) {
      sotuvchiYangilash = { sotuvchiId: data.sotuvchiId };
    } else {
      if (!isManager(user.rol)) {
        throw new ForbiddenError("Boshqa xodim nomiga yozish faqat boshqaruvchiga ruxsat etilgan");
      }
      sotuvchiYangilash = { sotuvchiId: await tekshirilganSotuvchi(businessId!, data.sotuvchiId) };
    }
  }
  if (yakuniyTuri === "chiqim" && existing.sotuvchiId) {
    sotuvchiYangilash = { sotuvchiId: null };
  }

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data: {
      ...(data.turi !== undefined ? { turi: data.turi } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      // Kg yozuvida summa kg hisobidan keladi (pastdagi `kgYangilash` ustun turadi).
      ...(data.summa !== undefined ? { summa: data.summa } : {}),
      ...(kgYangilash ?? {}),
      ...(data.sana !== undefined ? { sana: dateOnlyStringToUTCDate(data.sana) } : {}),
      ...(data.tolovTuri !== undefined ? { tolovTuri: data.tolovTuri } : {}),
      ...accountYangilash,
      ...(data.izoh !== undefined ? { izoh: data.izoh } : {}),
      ...(data.filial !== undefined ? { filial: data.filial } : {}),
      ...sotuvchiYangilash,
    },
    include: {
      category: true,
      user: { select: { id: true, ism: true } },
      account: { select: { id: true, nomi: true, turi: true } },
      sotuvchi: { select: { id: true, ism: true } },
    },
  });

  // Kunlik hisobot bilan sinxron: sana bugungidan boshqasiga o'zgarsa kunlikdan
  // chiqadi, bugunga o'zgarsa tushadi, summa o'zgarsa qayta jamlanadi.
  await kunlikSinxron(updated, updated.user.ism);

  dashboardYangilandi(existing.businessId);
  return NextResponse.json(updated);
});

export const DELETE = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);

  const existing = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Tranzaksiya topilmadi" }, { status: 404 });
  }
  if (existing.businessId !== businessId) {
    throw new ForbiddenError("Bu yozuv boshqa biznesga tegishli");
  }
  requireOwnerOrAdmin(user.rol, user.userId, existing.userId);
  // O'chirish ham qarz qoldig'ini ledgerdan ajratib yuborardi — ayni qulf.
  await qarzQulfiniTekshir(existing.businessId, existing.id);

  const permanent = new URL(request.url).searchParams.get("permanent") === "true";

  if (permanent) {
    // Butunlay o'chirish — faqat admin. Avval kunlikdagi ulangan tushum olib tashlanadi.
    if (!isManager(user.rol)) throw new ForbiddenError("Butunlay o'chirish faqat direktor uchun");
    // KASSAGA BOG'LANGAN YOZUV LEDGER QATORI — u o'chirilsa kassa qoldig'i
    // sababsiz o'zgaradi va audit izi uziladi. Bunday yozuv faqat "savat"da
    // (soft-delete) turadi; tuzatish kerak bo'lsa teskari yozuv kiritiladi.
    if (existing.accountId) {
      throw new ForbiddenError(
        "Kassaga bog'langan moliyaviy yozuvni butunlay o'chirib bo'lmaydi — u kassa qoldig'ining bir qismi. " +
          "Xato bo'lsa teskari (storno) yozuv kiriting."
      );
    }
    await kunlikSinxron({ ...existing, deletedAt: new Date() }, null);
    await prisma.transaction.delete({ where: { id: params.id } });
    dashboardYangilandi(existing.businessId);
    return NextResponse.json({ ok: true, permanent: true });
  }

  // Soft delete — belgilanadi (undo/savat uchun). Kunlikdagi ulangan tushum ham chiqadi.
  await prisma.transaction.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  await kunlikSinxron({ ...existing, deletedAt: new Date() }, null);
  dashboardYangilandi(existing.businessId);
  return NextResponse.json({ ok: true });
});

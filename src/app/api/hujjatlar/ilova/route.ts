import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { listIlovalar } from "@/lib/queries/hujjat";
import { havolaBiriktir, faylBiriktir } from "@/lib/services/hujjat";
import { havolaIlovaSchema, ILOVA_ENTITYLARI, type IlovaEntity } from "@/lib/validation/hujjat";
import { MAX_FAYL_BAYT, saqlagichBor } from "@/lib/storage/driver";

export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ ilovalar: [], yuklashMumkin: false });

    const sp = new URL(request.url).searchParams;
    const entity = sp.get("entity");
    const entityId = sp.get("entityId");
    if (!entity || !entityId || !(ILOVA_ENTITYLARI as readonly string[]).includes(entity)) {
      return NextResponse.json({ error: "entity va entityId kerak" }, { status: 400 });
    }
    return NextResponse.json({
      ilovalar: await listIlovalar(businessId, entity as IlovaEntity, entityId),
      yuklashMumkin: saqlagichBor(),
    });
  },
  { module: "HUJJATLAR" }
);

/**
 * Ikki rejim: JSON — tashqi havola; multipart/form-data — fayl yuklash.
 * Havola rejimi saqlagichsiz ham ishlaydi.
 */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const entity = String(form.get("entity") ?? "");
      const entityId = String(form.get("entityId") ?? "");
      const fayl = form.get("fayl");

      if (!(ILOVA_ENTITYLARI as readonly string[]).includes(entity) || !entityId) {
        return NextResponse.json({ error: "entity va entityId kerak" }, { status: 400 });
      }
      if (!(fayl instanceof File)) {
        return NextResponse.json({ error: "Fayl tanlanmagan" }, { status: 400 });
      }
      if (fayl.size > MAX_FAYL_BAYT) {
        return NextResponse.json({ error: "Fayl 10 MB dan katta bo'lmasligi kerak" }, { status: 400 });
      }

      const natija = await faylBiriktir({
        businessId,
        userId: user.userId,
        entity: entity as IlovaEntity,
        entityId,
        nomi: String(form.get("nomi") ?? fayl.name),
        mimeType: fayl.type,
        mazmun: Buffer.from(await fayl.arrayBuffer()),
      });
      return NextResponse.json(natija, { status: 201 });
    }

    const parsed = havolaIlovaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await havolaBiriktir(businessId, user.userId, parsed.data), { status: 201 });
  },
  { module: "HUJJATLAR" }
);

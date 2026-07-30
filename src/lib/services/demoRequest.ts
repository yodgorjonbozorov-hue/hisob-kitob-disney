// Demo so'rovi platforma darajasidagi yozuv (hech qaysi tenantga tegishli emas) — rawPrisma.
import { rawPrisma } from "@/lib/db/rawPrisma";
import { notifyAdmin } from "@/lib/notify/admin";
import type { DemoRequestInput } from "@/lib/validation/demo";

export const DEMO_STATUSLAR = ["YANGI", "BOGLANILDI", "YOPILDI"] as const;
export type DemoStatus = (typeof DEMO_STATUSLAR)[number];

/**
 * Demo so'rovini saqlaydi va platforma egasiga Telegram xabarini yuboradi.
 * Bildirishnoma xatosi so'rovni buzmaydi — yozuv baribir saqlanadi.
 */
export async function createDemoRequest(input: DemoRequestInput) {
  const soraq = await rawPrisma.demoRequest.create({
    data: {
      ism: input.ism,
      telefon: input.telefon,
      biznesTuri: input.biznesTuri,
      izoh: input.izoh || null,
    },
  });

  const satrlar = [
    "🔔 Yangi demo so'rovi",
    `Ism: ${soraq.ism}`,
    `Telefon: ${soraq.telefon}`,
    `Biznes: ${soraq.biznesTuri}`,
  ];
  if (soraq.izoh) satrlar.push(`Izoh: ${soraq.izoh}`);
  await notifyAdmin(satrlar.join("\n"));

  return soraq;
}

/** Superadmin paneli uchun — eng yangilari birinchi. */
export async function listDemoRequests(limit = 50) {
  return rawPrisma.demoRequest.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

export async function setDemoRequestStatus(id: string, status: DemoStatus) {
  return rawPrisma.demoRequest.update({ where: { id }, data: { status } });
}

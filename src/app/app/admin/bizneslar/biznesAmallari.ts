import type { MenyuAmali } from "@/components/ui/AmalMenyu";
import type { BusinessDTO } from "./turlar";

/** Biznes tafsiloti sahifasi (bo'lim tanlangan holda). */
export function biznesHavolasi(id: string, bolim?: string): string {
  return bolim ? `/app/admin/bizneslar/${id}?bolim=${bolim}` : `/app/admin/bizneslar/${id}`;
}

/**
 * "•••" MENYUSI — ro'yxatdagi bitta biznes uchun.
 *
 * Qoida: asosiy qatorda faqat "Biznesni ochish" qoladi, qolgan hamma amal
 * shu menyuda. XAVFLI amallar (tozalash, o'chirish) BU YERDA UMUMAN YO'Q —
 * ular faqat tafsilot sahifasidagi "Xavfli zona" bo'limida, ya'ni tasodifan
 * bosib bo'lmaydigan joyda. Menyuda ularga faqat HAVOLA turadi va u ham
 * direktorga (OWNER) ko'rinadi.
 */
export function biznesAmallari(
  b: BusinessDTO,
  opts: { owner: boolean; onHolat: () => void }
): MenyuAmali[] {
  const amallar: MenyuAmali[] = [
    { label: "Sozlamalar", href: biznesHavolasi(b.id, "umumiy") },
    { label: "Modullar", href: biznesHavolasi(b.id, "modullar") },
    { label: "Xodimlar", href: biznesHavolasi(b.id, "xodimlar") },
    { label: "Kassa sozlamalari", href: biznesHavolasi(b.id, "kassa") },
    { label: "Ombor sozlamalari", href: biznesHavolasi(b.id, "ombor") },
    {
      label: b.isActive ? "Nofaollashtirish" : "Faollashtirish",
      onClick: opts.onHolat,
      ajrat: true,
    },
  ];
  if (opts.owner) {
    amallar.push({
      label: "Xavfli zona…",
      href: biznesHavolasi(b.id, "xavfsizlik"),
      tur: "xavf",
      ajrat: true,
    });
  }
  return amallar;
}

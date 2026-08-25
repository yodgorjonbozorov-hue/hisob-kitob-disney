/** Biznes tafsilotining bo'limlari — desktopda tab, mobilda navigatsiya kartochkasi. */
export type Bolim = "umumiy" | "modullar" | "xodimlar" | "kassa" | "ombor" | "xavfsizlik";

export const BOLIMLAR: { kod: Bolim; nomi: string; tavsif: string; ownerOnly?: boolean }[] = [
  { kod: "umumiy", nomi: "Umumiy", tavsif: "Nomi, holati va ishlash rejimi" },
  { kod: "modullar", nomi: "Modullar", tavsif: "Qaysi bo'limlar shu bizneste ishlaydi" },
  { kod: "xodimlar", nomi: "Xodimlar", tavsif: "Shu bizneste ishlaydiganlar" },
  { kod: "kassa", nomi: "Kassa", tavsif: "Kassalar va shaxsiy kassa rejimi" },
  { kod: "ombor", nomi: "Ombor", tavsif: "Mahsulot qoldig'i va sotuv" },
  {
    kod: "xavfsizlik",
    nomi: "Xavfsizlik",
    tavsif: "Ma'lumotlarni tozalash va biznesni o'chirish",
    ownerOnly: true,
  },
];

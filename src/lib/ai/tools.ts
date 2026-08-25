import { davrniHal, type Davr } from "./davr";
import {
  crmYakuni,
  davrYakuni,
  kassaYakuni,
  kategoriyaKesimi,
  kattaYozuvlar,
  mijozYakuni,
  omborYakuni,
  oylikTrend,
  qarzYakuni,
  sababTahlili,
  vazifaYakuni,
  type Havola,
} from "./analitika";
import { bugungiXulosa } from "./xulosa";
import { sohaOchiq, type AiRuxsat, type Soha } from "./ruxsat";

/**
 * AI TOOL QATLAMI — MODEL BAZAGA EMAS, SHU RO'YXATGA MUROJAAT QILADI.
 *
 * XAVFSIZLIK PRINSIPLARI:
 *  1. Model ixtiyoriy SQL yoza olmaydi va `businessId` ni O'ZI belgilay
 *     olmaydi — u har doim serverdagi autentifikatsiyalangan kontekstdan
 *     (`AiRuxsat`) keladi. Foydalanuvchi savolida "boshqa biznes ID sini
 *     tekshir" deb yozilsa ham, tool o'sha kontekstdagi biznesni ko'radi.
 *  2. Ruxsatsiz soha tool'i modelga UMUMAN yuborilmaydi (`aiToollar`) va
 *     yuborilgan taqdirda ham `runTool` ikkinchi marta tekshiradi.
 *  3. Natija — SERVERDA hisoblangan tayyor agregat (`lib/ai/analitika.ts`),
 *     xom yozuvlar ro'yxati emas.
 *  4. Faqat O'QISH. Yozadigan, o'chiradigan yoki holat o'zgartiradigan tool
 *     ATAYLAB yo'q — AI read-only yordamchi.
 */

export interface ToolNatija {
  /** Modelga `tool_result` sifatida qaytadigan JSON matn. */
  matn: string;
  /** Javob ostida ko'rsatiladigan drill-down havolalar. */
  havolalar: Havola[];
}

interface ToolTarifi {
  name: string;
  soha: Soha;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const DAVR_IZOH =
  "Davr: 'bugun' | 'kecha' | 'hafta' | 'oy' | '3oy' | 'yil' | 'YYYY-MM' (aniq oy) | " +
  "'YYYY-MM-DD:YYYY-MM-DD' (oraliq). Foydalanuvchi davrni aytmagan bo'lsa — bo'sh qoldir, " +
  "sahifada tanlangan davr ishlatiladi.";

const davrXossa = { davr: { type: "string", description: DAVR_IZOH } };

/** To'liq katalog. Foydalanuvchiga yuboriladigan qismini `aiToollar` tanlaydi. */
const KATALOG: ToolTarifi[] = [
  {
    name: "moliya_yakuni",
    soha: "moliya",
    description:
      "Davr yakuni: jami kirim, jami chiqim, sof natija va OLDINGI davr bilan solishtirish " +
      "(farq va foiz). \"Bu oy qanday o'tyapti?\", \"Bugun qancha pul kirdi?\", " +
      "\"O'tgan oy bilan solishtir\" savollari uchun asosiy tool.",
    input_schema: { type: "object", properties: { ...davrXossa } },
  },
  {
    name: "kategoriya_kesimi",
    soha: "hisobot",
    description:
      "Kategoriyalar kesimi: eng katta kirim yoki chiqim kategoriyalari, ulushi va oldingi davr bilan farqi. " +
      "\"Eng katta chiqimlarim qaysi?\", \"Qaysi xizmat ko'p pul olib keldi?\" uchun.",
    input_schema: {
      type: "object",
      properties: {
        turi: { type: "string", enum: ["kirim", "chiqim"] },
        limit: { type: "number", description: "Nechta kategoriya, 1-10 (default 5)" },
        ...davrXossa,
      },
      required: ["turi"],
    },
  },
  {
    name: "sabab_tahlili",
    soha: "hisobot",
    description:
      "\"Nega foyda kamaydi/oshdi?\" savoli uchun DALIL to'plami: davr yakuni + oldingi davrga nisbatan " +
      "eng kuchli o'zgargan kategoriyalar. Sababni faqat shu dalillar bilan tushuntir.",
    input_schema: { type: "object", properties: { ...davrXossa } },
  },
  {
    name: "katta_yozuvlar",
    soha: "moliya",
    description:
      "Davrdagi eng katta alohida yozuvlar (tranzaksiyalar): sana, kategoriya, summa, izoh. " +
      "Kategoriya emas, AYNAN bitta yozuv so'ralganda ishlat.",
    input_schema: {
      type: "object",
      properties: {
        turi: { type: "string", enum: ["kirim", "chiqim"] },
        limit: { type: "number", description: "1-10 (default 5)" },
        ...davrXossa,
      },
      required: ["turi"],
    },
  },
  {
    name: "oylik_trend",
    soha: "hisobot",
    description:
      "So'nggi bir necha oy dinamikasi: har oy uchun kirim, chiqim, sof natija va umumiy o'sish. " +
      "\"Oxirgi 3 oyda biznes o'sdimi?\" uchun.",
    input_schema: {
      type: "object",
      properties: { oylar: { type: "number", description: "2-12 (default 6)" } },
    },
  },
  {
    name: "qarz_holati",
    soha: "qarz",
    description:
      "Qarzdorlik: menga qarzdorlar va men qarzdor bo'lganlarim jami, eng katta qarzdorlar, " +
      "muddati o'tgan qarzlar soni va summasi.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number", description: "Ro'yxatda nechta, 1-10 (default 5)" } },
    },
  },
  {
    name: "kassa_holati",
    soha: "kassa",
    description:
      "Kassalar (hisob-raqamlar) joriy qoldig'i. Aniq kassa so'ralsa `nom` bilan filtrlash mumkin " +
      "(masalan \"Fayruza kassasida qancha pul bor?\").",
    input_schema: {
      type: "object",
      properties: { nom: { type: "string", description: "Kassa yoki egasi nomi bo'yicha qidiruv" } },
    },
  },
  {
    name: "crm_holati",
    soha: "crm",
    description:
      "CRM: bosqichlar bo'yicha bitimlar soni va summasi, davrda yaratilgan/yutilgan/yo'qotilgan " +
      "buyurtmalar, bugungi buyurtmalar soni.",
    input_schema: { type: "object", properties: { ...davrXossa } },
  },
  {
    name: "vazifa_holati",
    soha: "vazifalar",
    description: "Vazifalar: ochiq, jarayonda, bajarilgan, muddati o'tgan va bugunga belgilanganlar soni.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "ombor_holati",
    soha: "ombor",
    description:
      "Ombor va sotuv: mahsulot turlari soni, ombor qiymati, davrdagi sotuv summasi, " +
      "eng ko'p sotilgan mahsulot va kategoriyalar.",
    input_schema: { type: "object", properties: { ...davrXossa } },
  },
  {
    name: "mijoz_holati",
    soha: "mijozlar",
    description:
      "Mijozlar: jami soni, eng ko'p xarid qilganlar (sotuv summasi va ochiq qarzi), qarz limiti oshganlar.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number", description: "1-10 (default 5)" } },
    },
  },
  {
    name: "bugungi_holat",
    soha: "moliya",
    description:
      "Bugungi kunning tayyor kesimi: bugungi kirim/chiqim, eng katta chiqim, muddati o'tgan qarzlar, " +
      "kassa qoldig'i, bugungi buyurtmalar. \"Bugun nima bo'ldi?\" uchun BITTA chaqiruv yetadi.",
    input_schema: { type: "object", properties: {} },
  },
];

/** Foydalanuvchiga ochiq tool ta'riflari (Anthropic API formati). */
export function aiToollar(ruxsat: AiRuxsat) {
  return KATALOG.filter((t) => sohaOchiq(ruxsat, t.soha)).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

/** Tool nomi bo'yicha soha (ikkinchi qavat tekshiruv uchun). */
function sohaniTop(name: string): Soha | null {
  return KATALOG.find((t) => t.name === name)?.soha ?? null;
}

function son(xom: unknown, standart: number, min: number, max: number): number {
  const n = Number(xom);
  if (!Number.isFinite(n)) return standart;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function turiniOqi(xom: unknown): "kirim" | "chiqim" {
  return xom === "chiqim" ? "chiqim" : "kirim";
}

function javob(obyekt: unknown, havolalar: Havola[] = []): ToolNatija {
  return { matn: JSON.stringify(obyekt), havolalar };
}

/**
 * Tool'ni bajaradi.
 *
 * `ruxsat.businessId` — YAGONA biznes manbai: input'dagi hech qanday maydon
 * uni almashtira olmaydi. `davrStandart` — sahifadagi tanlangan davr; model
 * savolda aniq davr aytilganda `input.davr` bilan uni ustidan yozadi.
 */
export async function runTool(
  name: string,
  input: Record<string, unknown>,
  ruxsat: AiRuxsat,
  davrStandart: Davr
): Promise<ToolNatija> {
  const soha = sohaniTop(name);
  if (!soha) return javob({ xato: `Noma'lum tool: ${name}` });
  if (!sohaOchiq(ruxsat, soha)) {
    return javob({
      ruxsatYoq: true,
      xabar:
        "Bu ma'lumot sizning huquqlaringizga ochiq emas. Foydalanuvchiga shuni ayting va " +
        "raqam taxmin qilmang.",
    });
  }

  const davr =
    typeof input.davr === "string" && input.davr.trim() ? davrniHal(input.davr) : davrStandart;
  const b = ruxsat.businessId;

  switch (name) {
    case "moliya_yakuni": {
      const r = await davrYakuni(b, davr);
      // SOF NATIJA — hisobot darajasidagi ko'rsatkich. Yozuvlarni ko'ra
      // oladigan, lekin hisobot huquqi YO'Q xodim (masalan kassir) uni
      // sahifada ham ko'rmaydi; AI orqali ham ochilmasligi kerak.
      if (!sohaOchiq(ruxsat, "hisobot")) {
        return javob(
          {
            davr: r.davr,
            oraliq: r.oraliq,
            kirim: r.kirim,
            kirimMatn: r.kirimMatn,
            chiqim: r.chiqim,
            chiqimMatn: r.chiqimMatn,
            cheklov:
              "Sof natija va davrlar solishtiruvi bu foydalanuvchining huquqlarida yopiq — " +
              "faqat kirim va chiqim jamini ayt, foyda haqida raqam berma.",
          },
          r.havolalar
        );
      }
      return javob(r, r.havolalar);
    }
    case "kategoriya_kesimi": {
      const r = await kategoriyaKesimi(b, davr, turiniOqi(input.turi), son(input.limit, 5, 1, 10));
      const eng = r.kategoriyalar[0];
      return javob(r, [
        ...(eng ? [{ yorliq: `${eng.kategoriya} — yozuvlari`, href: eng.havola }] : []),
        ...r.havolalar,
      ]);
    }
    case "sabab_tahlili": {
      const r = await sababTahlili(b, davr);
      const eng = r.ozgargan[0];
      return javob(r, [
        ...r.yakun.havolalar,
        ...(eng ? [{ yorliq: `${eng.kategoriya} — yozuvlari`, href: eng.havola }] : []),
      ]);
    }
    case "katta_yozuvlar": {
      const r = await kattaYozuvlar(b, davr, turiniOqi(input.turi), son(input.limit, 5, 1, 10));
      return javob(r, r.havolalar);
    }
    case "oylik_trend": {
      const r = await oylikTrend(b, son(input.oylar, 6, 2, 12), davr.oy ?? davrStandart.oy ?? davr.toStr.slice(0, 7));
      return javob(r, r.havolalar);
    }
    case "qarz_holati": {
      const r = await qarzYakuni(b, son(input.limit, 5, 1, 10));
      return javob(r, r.havolalar);
    }
    case "kassa_holati": {
      const r = await kassaYakuni(b, typeof input.nom === "string" ? input.nom.slice(0, 60) : null);
      return javob(r, r.havolalar);
    }
    case "crm_holati": {
      const r = await crmYakuni(b, davr);
      return javob(r, r.havolalar);
    }
    case "vazifa_holati": {
      const r = await vazifaYakuni(b);
      return javob(r, r.havolalar);
    }
    case "ombor_holati": {
      const r = await omborYakuni(b, davr);
      return javob(r, r.havolalar);
    }
    case "mijoz_holati": {
      const r = await mijozYakuni(b, son(input.limit, 5, 1, 10));
      return javob(r, r.havolalar);
    }
    case "bugungi_holat": {
      const r = await bugungiXulosa(ruxsat);
      return javob(
        r,
        r.kuzatuvlar.map((k) => k.havola).filter((h): h is Havola => !!h)
      );
    }
    default:
      return javob({ xato: `Noma'lum tool: ${name}` });
  }
}

/** Tool nomlari — takliflar (follow-up chip) qatlami shu bo'yicha ishlaydi. */
export const TOOL_NOMLARI = KATALOG.map((t) => t.name);

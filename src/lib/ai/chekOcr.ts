import { AiSozlanmaganError } from "./claude";

/**
 * CHEK RASMIDAN CHIQIM TAKLIFI (Faza 6.5).
 *
 * Model chekni O'QIYDI, lekin hech narsa YOZMAYDI: natija faqat taklif.
 * Yozuv foydalanuvchi tugmani bosgandan keyin, odatdagi `chiqimYubor`
 * orqali yaratiladi — ya'ni tasdiqlash qoidalari ham o'z kuchida qoladi.
 *
 * Model xato o'qishi mumkin, shuning uchun `ishonch` maydoni bor va
 * summasi topilmagan chek ataylab rad etiladi — noto'g'ri raqamni jimgina
 * yozib qo'yishdan ko'ra "o'qiy olmadim" deyish xavfsizroq.
 */

const MODEL = "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

/** Telegram yuboradigan va model qabul qiladigan formatlar. */
export const RUXSAT_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type RuxsatMedia = (typeof RUXSAT_MEDIA)[number];

/** Rasm hajmi chegarasi — kattasi API'da ham rad etiladi. */
export const MAX_RASM_BAYT = 5 * 1024 * 1024;

export interface ChekNatija {
  /** Umumiy summa (so'm, butun son). */
  summa: number;
  /** "YYYY-MM-DD" — chekda topilmasa null (chaqiruvchi bugungi sanani qo'yadi). */
  sana: string | null;
  /** Do'kon/xizmat nomi — izohga tushadi. */
  savdoNomi: string | null;
  /** Model taklif qilgan kategoriya nomi (mavjud kategoriyalar ichidan). */
  kategoriya: string | null;
  /** "yuqori" | "orta" | "past" — past bo'lsa foydalanuvchini ogohlantiramiz. */
  ishonch: string;
}

const SYSTEM_PROMPT = `Sen chek va kvitansiyalarni o'qiydigan yordamchisan. Rasmda O'zbekistondagi
do'kon cheki, kvitansiya yoki hisob-faktura bo'ladi. Faqat JSON qaytar, boshqa hech narsa yozma.

JSON sxemasi:
{
  "summa": <butun son, so'mda, ajratgichsiz — chekdagi YAKUNIY to'langan summa>,
  "sana": "YYYY-MM-DD" yoki null,
  "savdoNomi": "<do'kon yoki tashkilot nomi>" yoki null,
  "kategoriya": "<berilgan ro'yxatdan eng mos kategoriya nomi>" yoki null,
  "ishonch": "yuqori" | "orta" | "past"
}

Qoidalar:
- Summani O'YLAB TOPMA. Aniq o'qiy olmasang "summa": 0 va "ishonch": "past" qaytar.
- Tiyin qismini tashla (butun so'mga yaxlitla).
- "JAMI", "ИТОГО", "TO'LANDI" kabi yakuniy qatorni ol — oraliq summalarni emas.
- Kategoriya faqat berilgan ro'yxatdan bo'lsin; mos kelmasa null.
- Sana kelajakda bo'lsa null qaytar.`;

interface ApiContent {
  type: string;
  text?: string;
}

/**
 * Model javobidan JSON ajratadi.
 *
 * Ataylab alohida va sof funksiya: model matn oldiga tushuntirish yoki
 * ```json belgilarini qo'shib yuborishi mumkin, bu esa eng ko'p uchraydigan
 * uzilish nuqtasi. Shu bois u testda alohida qoplanadi.
 */
export function chekNatijasiniAjrat(matn: string): ChekNatija | null {
  const boshi = matn.indexOf("{");
  const oxiri = matn.lastIndexOf("}");
  if (boshi === -1 || oxiri === -1 || oxiri < boshi) return null;

  let xom: unknown;
  try {
    xom = JSON.parse(matn.slice(boshi, oxiri + 1));
  } catch {
    return null;
  }
  if (typeof xom !== "object" || xom === null) return null;
  const o = xom as Record<string, unknown>;

  const summa = Math.round(Number(o.summa));
  if (!Number.isFinite(summa) || summa <= 0) return null;

  const sana = typeof o.sana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.sana) ? o.sana : null;
  const ishonch =
    o.ishonch === "yuqori" || o.ishonch === "orta" || o.ishonch === "past"
      ? o.ishonch
      : "past";

  return {
    summa,
    sana,
    savdoNomi: typeof o.savdoNomi === "string" && o.savdoNomi.trim() ? o.savdoNomi.trim().slice(0, 100) : null,
    kategoriya:
      typeof o.kategoriya === "string" && o.kategoriya.trim() ? o.kategoriya.trim().slice(0, 100) : null,
    ishonch,
  };
}

/**
 * Chek rasmini o'qiydi. `null` — model summani ishonchli topa olmadi.
 *
 * `fetchImpl` — testda tarmoqsiz sinash uchun (production'da global `fetch`).
 */
export async function chekniOqi(params: {
  base64: string;
  mediaType: string;
  /** Mavjud chiqim kategoriyalari — model shular ichidan tanlaydi. */
  kategoriyalar: string[];
  fetchImpl?: typeof fetch;
}): Promise<ChekNatija | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiSozlanmaganError();

  if (!(RUXSAT_MEDIA as readonly string[]).includes(params.mediaType)) {
    throw new Error("Bu rasm formati qo'llab-quvvatlanmaydi (JPEG, PNG, WEBP yoki GIF yuboring)");
  }

  const f = params.fetchImpl ?? fetch;
  const res = await f(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: params.mediaType, data: params.base64 },
            },
            {
              type: "text",
              text:
                params.kategoriyalar.length > 0
                  ? `Mavjud kategoriyalar: ${params.kategoriyalar.join(", ")}`
                  : "Kategoriyalar ro'yxati yo'q — \"kategoriya\": null qaytar.",
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Claude API xatosi (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { content: ApiContent[] };
  const matn = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
  return chekNatijasiniAjrat(matn);
}

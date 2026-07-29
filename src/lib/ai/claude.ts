import { AI_TOOLLAR, runTool, type ToolKontekst } from "./tools";

/**
 * Claude API mijozi (BOS-4). SDK'siz — to'g'ridan-to'g'ri fetch (bog'liqlik qo'shmaslik uchun).
 * Tool-use aylanishi: Claude kerakli tool'ni chaqiradi -> biz tenant kontekstida
 * bajaramiz -> natijani qaytaramiz -> yakuniy javob matni.
 */

const MODEL = "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_AYLANISH = 5;

export class AiSozlanmaganError extends Error {
  constructor() {
    super("AI hali sozlanmagan (ANTHROPIC_API_KEY env o'zgaruvchisi yo'q)");
    this.name = "AiSozlanmaganError";
  }
}

export interface SuhbatXabari {
  rol: "user" | "assistant";
  matn: string;
}

const SYSTEM_PROMPT = `Sen o'zbek tilidagi biznes moliya yordamchisisan. Foydalanuvchi — kichik biznes egasi.
Qoidalar:
- FAQAT tool'lar bergan raqamlarga tayan. Taxminiy raqam O'YLAB TOPMA.
- Javob qisqa va amaliy bo'lsin: 2-5 jumla, kerak bo'lsa qisqa ro'yxat.
- Summalarni ming ajratgichlar bilan yoz (masalan: 1 250 000 so'm).
- Foiz o'zgarishlarni ko'rsat, muhim ogohlantirishlarni ajrat.
- Moliyaviy maslahat bersang, ehtiyotkor bo'l — bu tavsiya, buyruq emas.
- Savol biznes ma'lumotiga aloqasiz bo'lsa, muloyim rad et.`;

interface ApiContent {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/** Bitta savol-javob (tool-use aylanishi bilan). Yakuniy matn qaytaradi. */
export async function aiSuhbat(params: {
  savol: string;
  tarix: SuhbatXabari[];
  ctx: ToolKontekst;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiSozlanmaganError();

  // Suhbat tarixi (oxirgi 10 xabar) + yangi savol.
  const messages: { role: string; content: unknown }[] = [
    ...params.tarix.slice(-10).map((x) => ({ role: x.rol, content: x.matn })),
    { role: "user", content: params.savol },
  ];

  for (let i = 0; i < MAX_AYLANISH; i++) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: AI_TOOLLAR,
        messages,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Claude API xatosi (${res.status}): ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as { content: ApiContent[]; stop_reason: string };

    if (data.stop_reason !== "tool_use") {
      return data.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .trim();
    }

    // Tool chaqiruvlari — tenant kontekstida bajarib, natijani qaytaramiz.
    messages.push({ role: "assistant", content: data.content });
    const toolResults = [];
    for (const block of data.content) {
      if (block.type !== "tool_use" || !block.id || !block.name) continue;
      let natija: string;
      try {
        natija = await runTool(block.name, block.input ?? {}, params.ctx);
      } catch (error) {
        natija = JSON.stringify({ xato: error instanceof Error ? error.message : "Tool xatosi" });
      }
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: natija });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return "Kechirasiz, savolingiz juda murakkab chiqdi — soddaroq qilib qayta so'rang.";
}

import type { NextRequest } from "next/server";

/**
 * Click so'rov tanasini o'qiydi. Click odatda `application/x-www-form-urlencoded`
 * yuboradi, lekin ba'zi integratsiyalarda JSON keladi — ikkalasi ham qo'llanadi.
 */
export async function clickBodyOqish(request: NextRequest): Promise<Record<string, string> | null> {
  const turi = request.headers.get("content-type") ?? "";
  try {
    if (turi.includes("application/json")) {
      const json = await request.json();
      if (!json || typeof json !== "object") return null;
      return Object.fromEntries(Object.entries(json).map(([k, v]) => [k, String(v ?? "")]));
    }
    const form = await request.formData();
    const obj: Record<string, string> = {};
    form.forEach((v, k) => {
      obj[k] = String(v);
    });
    return obj;
  } catch {
    return null;
  }
}

import { z } from "zod";

export const loginSchema = z.object({
  // Telefon klaviaturasi login oxiriga bo'shliq qo'shib yuborishi mumkin — kesamiz.
  // Parol tegilmaydi: bo'shliq parolning haqiqiy qismi bo'lishi mumkin.
  login: z.string().trim().min(1, "Login kiritilishi shart"),
  parol: z.string().min(1, "Parol kiritilishi shart"),
});

/** Telefon raqamni normalizatsiya qiladi: bo'shliq/chiziqchalar olib tashlanadi, + saqlanadi. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

export const signupSchema = z.object({
  kompaniya: z.string().trim().min(2, "Kompaniya nomi kamida 2 belgi bo'lsin").max(100),
  ism: z.string().trim().min(1, "Ismingizni kiriting").max(100),
  telefon: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{9,17}$/, "Telefon raqam noto'g'ri (masalan: +998901234567)"),
  // Parol siyosati: kamida 8 belgi.
  parol: z.string().min(8, "Parol kamida 8 belgi bo'lishi kerak").max(100),
});

export type SignupInput = z.infer<typeof signupSchema>;

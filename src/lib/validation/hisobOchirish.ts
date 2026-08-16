import { z } from "zod";

/**
 * Hisobni o'chirish so'rovi. `tasdiq` — foydalanuvchi qo'lda yozadigan
 * kompaniya nomi; mos kelishi route'da tekshiriladi (nom bazadan olinadi).
 */
export const hisobOchirishSchema = z.object({
  tasdiq: z.string().min(1, "Kompaniya nomini yozing").max(200),
});

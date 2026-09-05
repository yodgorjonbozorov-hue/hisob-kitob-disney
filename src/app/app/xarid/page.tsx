import { redirect } from "next/navigation";

/**
 * ESKI "XARID" SAHIFASI — endi Ombor ichida.
 *
 * Ta'minot (kelgan tovar) va ta'minotchilar reyestri OMBOR moduliga
 * ko'chirildi: foydalanuvchi kelgan tovarni yozish uchun qaysi bo'limga
 * borishni o'ylamasligi kerak. Bu yo'l saqlanib qoldi, chunki mijozlarda
 * eski xatcho'plar va Telegramdagi havolalar bor — ular yangi manzilga
 * olib boradi.
 */
export default function XaridPage() {
  redirect("/app/ombor?tab=taminotlar");
}

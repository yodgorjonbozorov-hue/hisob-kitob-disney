/**
 * Platforma egasiga (superadmin) Telegram xabari.
 *
 * grammY `bot` obyekti import qilinmaydi — u modul yuklanishida
 * TELEGRAM_BOT_TOKEN yo'q bo'lsa xato tashlaydi va web route'ni buzardi.
 * Bu yerda to'g'ridan-to'g'ri Telegram API'ga so'rov yuboriladi.
 *
 * ADMIN_CHAT_ID sozlanmagan bo'lsa — jim o'tkazib yuboriladi (xato emas):
 * bildirishnoma qo'shimcha qulaylik, asosiy oqim (DB yozuvi) undan bog'liq emas.
 */
export async function notifyAdmin(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ADMIN_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!res.ok) {
      console.error("Admin bildirishnomasi yuborilmadi:", res.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Admin bildirishnomasi xatosi:", error);
    return false;
  }
}

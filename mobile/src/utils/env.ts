// Muhit sozlamalari. Faqat ochiq (public) qiymatlar — hech qanday sir bu yerga yozilmaydi.
// EXPO_PUBLIC_API_URL: backend manzili, masalan https://balansa.uz
const rawUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://balansa.uz';

// Oxirgi slashni olib tashlaymiz — path'lar "/api/..." bilan boshlanadi
export const API_URL = rawUrl.replace(/\/+$/, '');

// RBAC yordamchilari — backend qoidalarining KO'RINISH nusxasi.
// Haqiqiy himoya har doim serverda (requireManager/forbidSeller/module guard);
// bu funksiyalar faqat UI'da tugma/ekran ko'rsatish-yashirish uchun.
import type { MeResponse, Rol } from '../api/types';

export function isManager(rol: Rol | undefined | null): boolean {
  return rol === 'OWNER' || rol === 'ADMIN';
}

// "Direktor" ko'rinishi — moliyaviy jamlamalar (Kirim/Chiqim/Sof) faqat shu rollar uchun
export function moliyaviyJamlamaKoradi(rol: Rol | undefined | null): boolean {
  return isManager(rol);
}

export function sellerEmas(rol: Rol | undefined | null): boolean {
  return rol !== 'SELLER' && rol != null;
}

export function modulYoqiq(me: MeResponse | null | undefined, code: string): boolean {
  return !!me?.modullar?.includes(code);
}

export function aktivBiznes(me: MeResponse | null | undefined) {
  if (!me) return null;
  return me.businesses.find((b) => b.id === me.activeBusinessId) ?? me.businesses[0] ?? null;
}

// Qarzdorlik bo'limi: SELLER'dan boshqa hamma (backend forbidSeller bilan mos)
export function qarzKoradi(rol: Rol | undefined | null): boolean {
  return sellerEmas(rol);
}

// Ombor: menejer to'liq (ombor/mahsulotlar), kassir faqat mahsulot ro'yxati
export function omborKoradi(me: MeResponse | null | undefined): boolean {
  const biznes = aktivBiznes(me);
  return !!biznes?.omborli && modulYoqiq(me, 'OMBOR') && sellerEmas(me?.rol);
}

// POS: MAGAZIN moduli + biznes bayrog'i + rol (SELLER hech qachon emas)
export function posKoradi(me: MeResponse | null | undefined): boolean {
  const biznes = aktivBiznes(me);
  return (
    !!biznes?.magazin &&
    !!biznes?.omborli &&
    modulYoqiq(me, 'MAGAZIN') &&
    sellerEmas(me?.rol)
  );
}

export function crmKoradi(me: MeResponse | null | undefined): boolean {
  return modulYoqiq(me, 'CRM');
}

export function kunlikKoradi(me: MeResponse | null | undefined): boolean {
  return modulYoqiq(me, 'KUNLIK');
}

export const ROL_NOMI: Record<Rol, string> = {
  SUPERADMIN: 'Super admin',
  OWNER: 'Direktor',
  ADMIN: 'Administrator',
  CASHIER: 'Kassir',
  SELLER: 'Sotuvchi',
};

import {
  isManager,
  moliyaviyJamlamaKoradi,
  qarzKoradi,
  posKoradi,
  omborKoradi,
  crmKoradi,
  aktivBiznes,
} from '../src/auth/rbac';
import type { MeResponse, BusinessDTO } from '../src/api/types';

function biznes(qisman: Partial<BusinessDTO> = {}): BusinessDTO {
  return {
    id: 'b1',
    nomi: 'Disney Flowers',
    isActive: true,
    omborli: true,
    turi: 'umumiy',
    shaxsiyKassa: false,
    magazin: true,
    ...qisman,
  };
}

function me(qisman: Partial<MeResponse> = {}): MeResponse {
  return {
    userId: 'u1',
    ism: 'Anvar',
    login: 'anvar',
    rol: 'OWNER',
    tenantId: 't1',
    businessId: null,
    mustChangePassword: false,
    tenant: { id: 't1', name: 'Disney', plan: 'PRO', status: 'ACTIVE' },
    access: { mode: 'FULL' },
    businesses: [biznes()],
    activeBusinessId: 'b1',
    modullar: ['MOLIYA', 'KUNLIK', 'OMBOR', 'MAGAZIN', 'CRM'],
    ruxsatlar: [],
    ...qisman,
  };
}

describe('moliyaviy jamlama (direktor ko‘rinishi)', () => {
  it('OWNER va ADMIN ko‘radi', () => {
    expect(moliyaviyJamlamaKoradi('OWNER')).toBe(true);
    expect(moliyaviyJamlamaKoradi('ADMIN')).toBe(true);
  });
  it('KASSIR va SOTUVCHI ko‘rmaydi', () => {
    expect(moliyaviyJamlamaKoradi('CASHIER')).toBe(false);
    expect(moliyaviyJamlamaKoradi('SELLER')).toBe(false);
  });
});

describe('isManager', () => {
  it('faqat OWNER/ADMIN', () => {
    expect(isManager('OWNER')).toBe(true);
    expect(isManager('ADMIN')).toBe(true);
    expect(isManager('CASHIER')).toBe(false);
    expect(isManager('SELLER')).toBe(false);
    expect(isManager(undefined)).toBe(false);
  });
});

describe('qarzKoradi (backend forbidSeller bilan mos)', () => {
  it('SELLER dan boshqa hamma', () => {
    expect(qarzKoradi('OWNER')).toBe(true);
    expect(qarzKoradi('CASHIER')).toBe(true);
    expect(qarzKoradi('SELLER')).toBe(false);
  });
});

describe('posKoradi — uch qavatli shart', () => {
  it('modul + biznes bayrog‘i + rol birga bo‘lsa true', () => {
    expect(posKoradi(me())).toBe(true);
  });
  it('MAGAZIN moduli o‘chiq bo‘lsa false', () => {
    expect(posKoradi(me({ modullar: ['MOLIYA', 'OMBOR'] }))).toBe(false);
  });
  it('biznes magazin emas bo‘lsa false', () => {
    expect(posKoradi(me({ businesses: [biznes({ magazin: false })] }))).toBe(false);
  });
  it('biznes omborsiz bo‘lsa false (MAGAZIN → OMBOR bog‘liqligi)', () => {
    expect(posKoradi(me({ businesses: [biznes({ omborli: false })] }))).toBe(false);
  });
  it('SELLER hech qachon ko‘rmaydi', () => {
    expect(posKoradi(me({ rol: 'SELLER' }))).toBe(false);
  });
});

describe('omborKoradi', () => {
  it('omborli biznes + modul + rol', () => {
    expect(omborKoradi(me())).toBe(true);
    expect(omborKoradi(me({ businesses: [biznes({ omborli: false })] }))).toBe(false);
    expect(omborKoradi(me({ rol: 'SELLER' }))).toBe(false);
  });
});

describe('crmKoradi', () => {
  it('modulga bog‘liq', () => {
    expect(crmKoradi(me())).toBe(true);
    expect(crmKoradi(me({ modullar: ['MOLIYA'] }))).toBe(false);
  });
});

describe('aktivBiznes', () => {
  it('activeBusinessId bo‘yicha topadi', () => {
    const m = me({
      businesses: [biznes({ id: 'b1' }), biznes({ id: 'b2', nomi: 'Ikkinchi' })],
      activeBusinessId: 'b2',
    });
    expect(aktivBiznes(m)?.id).toBe('b2');
  });
  it('topilmasa birinchisini oladi', () => {
    const m = me({ activeBusinessId: 'yoq' });
    expect(aktivBiznes(m)?.id).toBe('b1');
  });
});

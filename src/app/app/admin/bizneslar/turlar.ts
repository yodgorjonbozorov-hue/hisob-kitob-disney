/** Bizneslar sahifasining umumiy tiplari (client va modal orasida bo'lishiladi). */
export interface BusinessDTO {
  id: string;
  nomi: string;
  isActive: boolean;
  turi: string;
  /** Ombor va sotuv shu bizneste yuritiladimi (nav'da Ombor/Sotuv shunga bog'liq). */
  omborli: boolean;
  kategoriyalar: number;
  tranzaksiyalar: number;
}

/** Yangi biznes yaratilganda API qaytaradigan minimal shakl. */
export interface YangiBiznes {
  id: string;
  nomi: string;
  isActive: boolean;
  turi: string;
  omborli: boolean;
}

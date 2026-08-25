import { useEffect, useState } from 'react';

// Qidiruv kabi tez o'zgaruvchi qiymatlar uchun kechiktirish
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

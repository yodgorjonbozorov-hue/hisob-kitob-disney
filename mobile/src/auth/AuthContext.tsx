import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { loginRequest, logoutRequest, fetchMe, setActiveBusinessRequest } from '../api/auth';
import { setUnauthorizedHandler, ApiError } from '../api/client';
import {
  setToken,
  clearSession,
  getToken,
  setActiveBusinessId,
  getActiveBusinessId,
} from './sessionStore';
import type { MeResponse } from '../api/types';

type AuthStatus = 'yuklanmoqda' | 'kirgan' | 'chiqqan';

interface AuthValue {
  status: AuthStatus;
  me: MeResponse | null;
  login: (login: string, parol: string) => Promise<void>;
  logout: () => Promise<void>;
  switchBusiness: (businessId: string) => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('yuklanmoqda');
  const [me, setMe] = useState<MeResponse | null>(null);
  const queryClient = useQueryClient();

  const forceLogout = useCallback(() => {
    setMe(null);
    setStatus('chiqqan');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(forceLogout);
  }, [forceLogout]);

  // Sessiyani tiklash: token bo'lsa /api/me chaqiriladi
  useEffect(() => {
    let bekor = false;
    (async () => {
      const token = await getToken();
      if (!token) {
        if (!bekor) setStatus('chiqqan');
        return;
      }
      try {
        const profil = await fetchMe();
        if (bekor) return;
        // Lokal saqlangan biznes profil bilan nomos bo'lsa tozalaymiz
        const localBiznes = await getActiveBusinessId();
        if (localBiznes && !profil.businesses.some((b) => b.id === localBiznes)) {
          await setActiveBusinessId(profil.activeBusinessId);
        }
        setMe(profil);
        setStatus('kirgan');
      } catch (e) {
        if (bekor) return;
        if (e instanceof ApiError) {
          // 401/403 allaqachon clearSession qilgan; boshqa xato (server/billing)
          // bo'lsa ham login ekraniga emas — profil keshsiz davom etamiz
          setStatus('chiqqan');
        } else {
          // Tarmoq yo'q — tokenni saqlab qolamiz, lekin ilova login holatida
          // emas: me'siz ekranlar ishlamaydi. Foydalanuvchi qayta urinadi.
          setStatus('chiqqan');
        }
      }
    })();
    return () => {
      bekor = true;
    };
  }, []);

  const login = useCallback(async (loginVal: string, parol: string) => {
    const natija = await loginRequest(loginVal, parol);
    if (!natija.token) {
      throw new Error("Server mobil kirishni qo'llab-quvvatlamaydi — administratorga murojaat qiling");
    }
    await setToken(natija.token);
    const profil = await fetchMe();
    await setActiveBusinessId(profil.activeBusinessId);
    setMe(profil);
    setStatus('kirgan');
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Server javob bermasa ham lokal sessiya o'chiriladi
    }
    await clearSession();
    forceLogout();
  }, [forceLogout]);

  const refreshMe = useCallback(async () => {
    const profil = await fetchMe();
    setMe(profil);
  }, []);

  const switchBusiness = useCallback(
    async (businessId: string) => {
      // Server ruxsatni tekshiradi (403 bo'lsa lokal holat o'zgarmaydi)
      await setActiveBusinessRequest(businessId);
      await setActiveBusinessId(businessId);
      // Tenant ma'lumotlari aralashmasligi uchun barcha keshni tozalaymiz
      queryClient.clear();
      const profil = await fetchMe();
      setMe(profil);
    },
    [queryClient]
  );

  const value = useMemo<AuthValue>(
    () => ({ status, me, login, logout, switchBusiness, refreshMe }),
    [status, me, login, logout, switchBusiness, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider ichida chaqirilishi kerak');
  return ctx;
}

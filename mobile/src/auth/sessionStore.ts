// Sessiya saqlash: token SecureStore'da (shifrlangan), aktiv biznes AsyncStorage'da.
// Parol hech qachon saqlanmaydi.
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'balansa_token';
const BUSINESS_KEY = 'balansa_active_business';

let tokenCache: string | null | undefined;
let businessCache: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (tokenCache !== undefined) return tokenCache;
  try {
    tokenCache = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    tokenCache = null;
  }
  return tokenCache;
}

export async function setToken(token: string): Promise<void> {
  tokenCache = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getActiveBusinessId(): Promise<string | null> {
  if (businessCache !== undefined) return businessCache;
  try {
    businessCache = await AsyncStorage.getItem(BUSINESS_KEY);
  } catch {
    businessCache = null;
  }
  return businessCache;
}

export async function setActiveBusinessId(id: string | null): Promise<void> {
  businessCache = id;
  if (id) await AsyncStorage.setItem(BUSINESS_KEY, id);
  else await AsyncStorage.removeItem(BUSINESS_KEY);
}

export async function clearSession(): Promise<void> {
  tokenCache = null;
  businessCache = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // SecureStore mavjud bo'lmasa ham davom etamiz
  }
  await AsyncStorage.removeItem(BUSINESS_KEY);
}

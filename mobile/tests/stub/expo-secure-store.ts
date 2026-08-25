// Test stub: xotirada saqlovchi SecureStore
const saqlagich = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return saqlagich.get(key) ?? null;
}
export async function setItemAsync(key: string, value: string): Promise<void> {
  saqlagich.set(key, value);
}
export async function deleteItemAsync(key: string): Promise<void> {
  saqlagich.delete(key);
}
export function __tozalash() {
  saqlagich.clear();
}

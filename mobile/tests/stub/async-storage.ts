// Test stub: xotirada saqlovchi AsyncStorage
const saqlagich = new Map<string, string>();

export default {
  async getItem(key: string): Promise<string | null> {
    return saqlagich.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    saqlagich.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    saqlagich.delete(key);
  },
  __tozalash() {
    saqlagich.clear();
  },
};

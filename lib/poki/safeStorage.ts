// Safe localStorage wrapper — required by Poki for incognito/private browsing support.
// localStorage throws in some browsers when storage is blocked or in private mode.

export const safeStorage = {
  getItem(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
  removeItem(key: string): void {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

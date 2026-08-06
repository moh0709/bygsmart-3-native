// Native session storage — AsyncStorage (Supabase's recommended RN store; no per-key
// size limit, unlike expo-secure-store). The .web.ts sibling uses localStorage, so this
// native-only module never enters the web/admin bundle.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthStorage } from '@bygsmart/api-client';

export const sessionStorage: AuthStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store has no web implementation — every call rejects. On web the
// session token lives in localStorage instead (fine for a JWT-in-header app).
export const storage =
  Platform.OS === 'web'
    ? {
        getItemAsync: async (key: string) => window.localStorage.getItem(key),
        setItemAsync: async (key: string, value: string) => {
          window.localStorage.setItem(key, value);
        },
        deleteItemAsync: async (key: string) => {
          window.localStorage.removeItem(key);
        },
      }
    : {
        getItemAsync: (key: string) => SecureStore.getItemAsync(key),
        setItemAsync: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        deleteItemAsync: (key: string) => SecureStore.deleteItemAsync(key),
      };

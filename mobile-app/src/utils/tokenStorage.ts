import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';

export const tokenStorage = {
  async getAccessToken()  { return AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN); },
  async getRefreshToken() { return AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN); },

  async saveTokens(access: string, refresh: string) {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.ACCESS_TOKEN,  access],
      [STORAGE_KEYS.REFRESH_TOKEN, refresh],
    ]);
  },

  async clearTokens() {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  },

  async saveUserInfo(user: object) {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user));
  },

  async getUserInfo<T>(): Promise<T | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER_INFO);
    return raw ? JSON.parse(raw) : null;
  },
};
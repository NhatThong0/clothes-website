import Constants from 'expo-constants';
import { Platform } from 'react-native';

function getDevHostFromExpo() {
  const anyConstants: any = Constants;
  const hostUri: string | undefined =
    Constants.expoConfig?.hostUri ??
    anyConstants?.expoConfig?.hostUri ??
    anyConstants?.manifest?.debuggerHost ??
    anyConstants?.manifest2?.extra?.expoClient?.hostUri;

  if (!hostUri) return null;
  return hostUri.split(':')[0] || null;
}

const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const ENV_SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL;

const expoHost = getDevHostFromExpo();
const fallbackDevHost = Platform.OS === 'android' ? '192.168.1.97' : 'localhost';
const devHost = expoHost ?? fallbackDevHost;

export const API_BASE_URL =
  ENV_API_BASE_URL ?? (__DEV__ ? `http://${devHost}:5000/api` : 'https://your-domain.com/api');

export const SOCKET_URL =
  ENV_SOCKET_URL ?? (__DEV__ ? `http://${devHost}:5000` : 'https://your-domain.com');

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO: 'user_info',
} as const;

export const API_TIMEOUT = 15000;

export const API_BASE_URL = __DEV__
//   ? 'http://10.0.2.2:5000/api'   // Android Emulator
  // ? 'http://localhost:5000/api' // iOS Simulator
  ? 'http://10.0.0.60:5000/api'  // ✅ IP + port đúng
  : 'https://your-domain.com/api';

export const STORAGE_KEYS = {
  ACCESS_TOKEN:  'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO:     'user_info',
} as const;

export const API_TIMEOUT = 15000;
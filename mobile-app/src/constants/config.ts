export const API_BASE_URL = __DEV__// ✅ IP máy tính thật
  ? 'http://192.168.1.26:5000/api'   
  : 'https://your-domain.com/api';
  // ? 'http://10.0.0.60:5000/api'  
  // : 'https://your-domain.com/api';

export const SOCKET_URL = __DEV__
  ? 'http://192.168.1.26:5000'       
  : 'https://your-domain.com';
  //   ? 'http://10.0.0.60:5000'  
  // : 'https://your-domain.com';
export const STORAGE_KEYS = {
  ACCESS_TOKEN:  'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO:     'user_info',
} as const;

export const API_TIMEOUT = 15000;
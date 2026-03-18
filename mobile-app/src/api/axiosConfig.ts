import axios, { AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '../constants/config';
import { tokenStorage } from '../utils/tokenStorage';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let queue: { resolve: (t: string) => void; reject: (e: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  queue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token!));
  queue = [];
};

// Gắn token vào mỗi request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Tự động refresh khi hết hạn
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject }))
          .then((token) => {
            original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
            return api(original);
          });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        await tokenStorage.saveTokens(data.accessToken, data.refreshToken);
        processQueue(null, data.accessToken);
        original.headers = { ...original.headers, Authorization: `Bearer ${data.accessToken}` };
        return api(original);
      } catch (err) {
        processQueue(err, null);
        await tokenStorage.clearTokens();
        authEventEmitter.emit('logout');
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

// Event emitter báo logout về app
type Listener = () => void;
export const authEventEmitter = {
  _listeners: [] as Listener[],
  emit(e: 'logout') { this._listeners.forEach((fn) => fn()); },
  on(e: 'logout', fn: Listener) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter((l) => l !== fn); };
  },
};

export default api;
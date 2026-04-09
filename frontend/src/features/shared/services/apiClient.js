import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

function isAdminContext(config) {
  if (config?.headers?.['X-Admin-Request'] === '1') return true;
  if (config?.url?.includes('/admin')) return true;
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/admin');
}

// ── Request: gắn token ───────────────────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = isAdminContext(config)
    ? localStorage.getItem('adminToken')
    : localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  return config;
});

// ── Response: xử lý token hết hạn ────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    // ✅ Xử lý cả 401 và 403 — token hết hạn hoặc không hợp lệ
    if (status === 401 || status === 403) {
      if (isAdminContext(error.config)) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');

        if (!window.location.pathname.includes('/admin/login')) {
          window.location.href = '/admin/login';
        }
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('cart_guest');

        if (!window.location.pathname.includes('/auth/login')) {
          window.location.href = '/auth/login';
        }
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;

import apiClient from './apiClient';

// ============ PRODUCTS ============
export const productAPI = {
  getAllProducts: (params) => apiClient.get('/products', { params }),
  getAll: (params) => apiClient.get('/products', { params }),
  getProductById: (id) => apiClient.get(`/products/${id}`),
  getFeaturedProducts: () => apiClient.get('/products/featured'),
  getFeatured: () => apiClient.get('/products/featured'),
  searchProducts: (query) => apiClient.get('/products/search', { params: { q: query } }),
  getCategories: () => apiClient.get('/products/categories'),
  getReviews: (id) => apiClient.get(`/products/${id}/reviews`),
  addReview: (id, data) => apiClient.post(`/products/${id}/reviews`, data),
  getMyReview: (id) => apiClient.get(`/products/${id}/reviews/my`),
  updateReview: (id, reviewId, data) => apiClient.put(`/products/${id}/reviews/${reviewId}`, data),
  deleteReview: (id, reviewId) => apiClient.delete(`/products/${id}/reviews/${reviewId}`),
  create: (data) => apiClient.post('/products', data),
  update: (id, data) => apiClient.put(`/products/${id}`, data),
  delete: (id) => apiClient.delete(`/products/${id}`),
};

// ============ AUTH ============
export const authAPI = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (email, password) => apiClient.post('/auth/login', { email, password }),
  getCurrentUser: () => apiClient.get('/auth/me'),
  updateProfile: (data) => apiClient.put('/auth/profile', data),
  logout: () => apiClient.post('/auth/logout'),
};

// ============ CART ============
export const cartAPI = {
  getCart: () => apiClient.get('/cart'),
  addToCart: (productId, quantity) => apiClient.post('/cart', { productId, quantity }),
  updateCartItem: (productId, quantity) => apiClient.put(`/cart/${productId}`, { quantity }),
  removeFromCart: (productId) => apiClient.delete(`/cart/${productId}`),
  clearCart: () => apiClient.delete('/cart'),
};

// ============ ORDERS ============
export const orderAPI = {
  createOrder: (data) => apiClient.post('/orders', data),
  getUserOrders: () => apiClient.get('/orders'),
  getMyOrders: () => apiClient.get('/orders'),
  getOrderById: (id) => apiClient.get(`/orders/${id}`),
  updateOrderStatus: (id, status) => apiClient.put(`/orders/${id}/status`, { status }),
  cancelOrder: (id) => apiClient.post(`/orders/${id}/cancel`),
};

// ============ PAYMENT ============
export const paymentAPI = {
  // ✅ Tạo URL thanh toán VNPay
  createVnpayUrl: (orderId) => apiClient.post('/payment/vnpay-create', { orderId }),
};

// ============ USERS ============
export const userAPI = {
  getProfile: () => apiClient.get('/users/profile'),
  getAddresses: () => apiClient.get('/users/addresses'),
  addAddress: (data) => apiClient.post('/users/addresses', data),
  updateAddress: (id, data) => apiClient.put(`/users/addresses/${id}`, data),
  deleteAddress: (id) => apiClient.delete(`/users/addresses/${id}`),
};

// ============ ADMIN REVIEW MANAGEMENT ============
export const adminAPI = {
  toggleReview: (productId, reviewId) =>
    apiClient.put(`/admin/reviews/${productId}/${reviewId}/toggle`),
  deleteReview: (productId, reviewId) =>
    apiClient.delete(`/admin/reviews/${productId}/${reviewId}`),
};

// ============ UPLOAD ============
export const uploadAPI = {
  uploadImages: (formData) => apiClient.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteImage: (url) => apiClient.delete('/upload', { data: { url } }),
};

// ============ VOUCHER ============
export const voucherAPI = {
  // ✅ Dùng apiClient thay vì axios trực tiếp
  validateVoucher: (data) => apiClient.post('/promotions/validate', data),
};
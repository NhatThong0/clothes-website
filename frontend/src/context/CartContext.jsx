import { createContext, useState, useCallback, useEffect, useContext, useRef } from 'react';
import { AuthContext } from './AuthContext';
import LoginRequiredModal from '@components/LoginRequiredModal';

export const CartContext = createContext();

const API_BASE = '/api/cart';

const apiFetch = async (url, options = {}, token) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

// ✅ So sánh item theo id + color + size
function isSameItem(item, id, color = '', size = '') {
  return item.id === id &&
    (item.color || '') === (color || '') &&
    (item.size  || '') === (size  || '');
}

export function CartProvider({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const [cartItems,    setCartItems]    = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [minQtyAlert,  setMinQtyAlert]  = useState(null); // ✅ key = id__color__size
  const alertTimer = useRef(null);

  const getToken = () => localStorage.getItem('token');

  const normalizeItems = (items = []) =>
    items.map(item => {
      const product = item.productId;
      return {
        id:       product._id ?? product,
        name:     product.name      ?? 'Unknown Product',
        price:    product.price     ?? 0,
        image:    product.image || product.thumbnail || product.images?.[0] || null,
        color:    item.color  || '',
        size:     item.size   || '',
        quantity: item.quantity,
        addedAt:  item.addedAt,
      };
    });

  const fetchCart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(API_BASE, {}, getToken());
      setCartItems(normalizeItems(data.data.items));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchCart();
    else setCartItems([]);
  }, [isAuthenticated, fetchCart]);

  // ── Add to cart ───────────────────────────────────────────────────────────
  const addToCart = useCallback(async (product, quantity = 1, color = '', size = '') => {
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(
        `${API_BASE}/add`,
        { method: 'POST', body: JSON.stringify({ productId: product.id ?? product._id, quantity, color, size }) },
        getToken()
      );
      setCartItems(normalizeItems(data.data.items));
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // ── updateQuantity — theo id + color + size ───────────────────────────────
  const updateQuantity = useCallback(async (productId, quantity, color = '', size = '') => {
    if (!isAuthenticated) { setShowLoginModal(true); return; }

    // ✅ Chặn giảm dưới 1
    if (quantity <= 0) {
      const alertKey = `${productId}__${color}__${size}`;
      setMinQtyAlert(alertKey);
      clearTimeout(alertTimer.current);
      alertTimer.current = setTimeout(() => setMinQtyAlert(null), 2000);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(
        `${API_BASE}/update`,
        { method: 'PUT', body: JSON.stringify({ productId, quantity, color, size }) },
        getToken()
      );
      setCartItems(normalizeItems(data.data.items));
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // ── removeFromCart — xóa đúng theo id + color + size ─────────────────────
  const removeFromCart = useCallback(async (productId, color = '', size = '') => {
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(
        `${API_BASE}/remove`,
        { method: 'POST', body: JSON.stringify({ productId, color, size }) },
        getToken()
      );
      setCartItems(normalizeItems(data.data.items));
    } catch (err) {
      // ✅ Fallback: xóa local nếu server lỗi
      setCartItems(prev => prev.filter(i => !isSameItem(i, productId, color, size)));
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const clearCart = useCallback(async () => {
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`${API_BASE}/clear`, { method: 'DELETE' }, getToken());
      setCartItems([]);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const getTotalPrice = useCallback(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  );

  const getTotalItems = useCallback(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  return (
    <CartContext.Provider value={{
      cartItems,
      loading,
      error,
      minQtyAlert,  // ✅ export để CartPage dùng
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getTotalPrice,
      getTotalItems,
      refreshCart: fetchCart,
    }}>
      {children}
      <LoginRequiredModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
import { createContext, useState, useCallback, useEffect, useContext } from 'react';
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

export function CartProvider({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false); // 👈 modal state

  const getToken = () => localStorage.getItem('token');

  const normalizeItems = (items = []) =>
    items.map(item => {
      const product = item.productId;
      return {
        id: product._id ?? product,
        name: product.name ?? 'Unknown Product',
        price: product.price ?? 0,
        image: product.image || product.thumbnail || product.images?.[0] || null,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        addedAt: item.addedAt,
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
    if (isAuthenticated) {
      fetchCart();
    } else {
      setCartItems([]);
    }
  }, [isAuthenticated, fetchCart]);

  // ─── Add to cart ──────────────────────────────────────────────────────────
  const addToCart = useCallback(async (product, quantity = 1, color = '', size = '') => {
    if (!isAuthenticated) {
      setShowLoginModal(true); // 👈 hiện modal thay vì redirect
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(
        `${API_BASE}/add`,
        {
          method: 'POST',
          body: JSON.stringify({ productId: product.id ?? product._id, quantity, color, size }),
        },
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

  const updateQuantity = useCallback(async (productId, quantity) => {
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(
        `${API_BASE}/update`,
        { method: 'PUT', body: JSON.stringify({ productId, quantity }) },
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

  const removeFromCart = useCallback(async (productId) => {
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(
        `${API_BASE}/remove`,
        { method: 'POST', body: JSON.stringify({ productId }) },
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
    <CartContext.Provider
      value={{
        cartItems,
        loading,
        error,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotalPrice,
        getTotalItems,
        refreshCart: fetchCart,
      }}
    >
      {children}

      {/* 👇 Modal render ở đây — bao phủ toàn app */}
      <LoginRequiredModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
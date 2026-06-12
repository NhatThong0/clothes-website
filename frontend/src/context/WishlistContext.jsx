import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@features/auth/hooks/useAuth';
import { recommendationAPI } from '@features/shared/services/api';

const WishlistContext = createContext({
  isInWishlist: () => false,
  toggle: async () => {},
  total: 0,
});

export function WishlistProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [ids, setIds] = useState(new Set());

  // Load toàn bộ wishlist IDs khi user đăng nhập
  useEffect(() => {
    if (!isAuthenticated) { setIds(new Set()); return; }
    recommendationAPI.getWishlist()
      .then(res => {
        const items = res.data?.data || [];
        setIds(new Set(items.map(p => String(p._id || p.id))));
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const isInWishlist = useCallback(
    (productId) => ids.has(String(productId)),
    [ids],
  );

  const toggle = useCallback(async (productId) => {
    const id = String(productId);
    // Optimistic update
    setIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      await recommendationAPI.toggleWishlist(id);
    } catch {
      // Rollback nếu API lỗi
      setIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }, []);

  return (
    <WishlistContext.Provider value={{ isInWishlist, toggle, total: ids.size }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);

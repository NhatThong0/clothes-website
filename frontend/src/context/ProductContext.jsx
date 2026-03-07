import { createContext, useState, useCallback } from 'react';

export const ProductContext = createContext();

export function ProductProvider({ children }) {
  const [filters, setFilters] = useState({
    category: '',
    minPrice: 0,
    maxPrice: 10000000,
    sortBy: 'trending', // trending, price-low, price-high, newest
    search: '',
  });

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      category: '',
      minPrice: 0,
      maxPrice: 10000000,
      sortBy: 'trending',
      search: '',
    });
  }, []);

  const value = {
    filters,
    updateFilters,
    resetFilters,
  };

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
}

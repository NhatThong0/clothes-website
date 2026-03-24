import { create } from 'zustand';
import { Product, getDiscountedPrice } from '../api/productApi';
import { cartApi, CartItem as ApiCartItem } from '../api/cartApi';

export interface CartItem {
  product:  Product;
  quantity: number;
  color?:   string;
  size?:    string;
}

const itemKey = (productId: string, color?: string, size?: string) =>
  `${productId}__${color ?? ''}__${size ?? ''}`;

interface CartState {
  items:          CartItem[];
  syncCart:       () => Promise<void>;   // ✅ khai báo rõ return type
  totalItems:     () => number;
  totalPrice:     () => number;
  addToCart:      (product: Product, quantity?: number, color?: string, size?: string) => void;
  removeFromCart: (productId: string, color?: string, size?: string) => void;
  updateQuantity: (productId: string, quantity: number, color?: string, size?: string) => void;
  clearCart:      () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  syncCart: async (): Promise<void> => {
    try {
      const cart = await cartApi.getCart();
      const items: CartItem[] = cart.items.map((item: ApiCartItem) => ({
        product:  item.productId as unknown as Product,
        quantity: item.quantity,
        color:    item.color,
        size:     item.size,
      }));
      set({ items });
    } catch (e) {
      console.error('syncCart error:', e);
    }
  },

  totalItems: () =>
    get().items.reduce((sum, item) => sum + item.quantity, 0),

  totalPrice: () =>
    get().items.reduce((sum, item) => {
      const price = getDiscountedPrice(item.product.price, item.product.discount);
      return sum + price * item.quantity;
    }, 0),

  addToCart: (product, quantity = 1, color, size) => {
    const key = itemKey(product._id, color, size);
    set((state) => {
      const existing = state.items.find(
        i => itemKey(i.product._id, i.color, i.size) === key
      );
      if (existing) {
        return {
          items: state.items.map(i =>
            itemKey(i.product._id, i.color, i.size) === key
              ? { ...i, quantity: i.quantity + quantity }
              : i
          ),
        };
      }
      return { items: [...state.items, { product, quantity, color, size }] };
    });
  },

  removeFromCart: (productId, color, size) => {
    const key = itemKey(productId, color, size);
    set(state => ({
      items: state.items.filter(
        i => itemKey(i.product._id, i.color, i.size) !== key
      ),
    }));
  },

  updateQuantity: (productId, quantity, color, size) => {
    if (quantity <= 0) {
      get().removeFromCart(productId, color, size);
      return;
    }
    const key = itemKey(productId, color, size);
    set(state => ({
      items: state.items.map(i =>
        itemKey(i.product._id, i.color, i.size) === key ? { ...i, quantity } : i
      ),
    }));
  },

  clearCart: () => set({ items: [] }),
}));
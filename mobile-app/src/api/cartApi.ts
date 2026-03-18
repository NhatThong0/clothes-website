import api from './axiosConfig';
import { Product } from './productApi';

export interface CartItem {
  _id: string;
  productId: Product;
  quantity: number;
  color?: string;
  size?: string;
  addedAt: string;
}

export interface Cart {
  _id: string;
  userId: string;
  items: CartItem[];
  updatedAt: string;
}

interface CartResponse { status: string; data: Cart; }

export const cartApi = {
  // GET /api/cart
  async getCart(): Promise<Cart> {
    const { data } = await api.get<CartResponse>('/cart');
    return data.data;
  },

  // POST /api/cart/add   ← backend dùng /add không phải /cart
  async addToCart(
    productId: string,
    quantity = 1,
    color?: string,
    size?:  string
  ): Promise<Cart> {
    const { data } = await api.post<CartResponse>('/cart/add', {
      productId,
      quantity,
      color: color || undefined,
      size:  size  || undefined,
    });
    return data.data;
  },

  // PUT /api/cart/update
  async updateItem(
    productId: string,
    quantity: number,
    color?: string,
    size?:  string
  ): Promise<Cart> {
    const { data } = await api.put<CartResponse>('/cart/update', {
      productId,
      quantity,
      color: color || undefined,
      size:  size  || undefined,
    });
    return data.data;
  },

  // POST /api/cart/remove  ← backend dùng POST không phải DELETE
  async removeItem(
    productId: string,
    color?: string,
    size?:  string
  ): Promise<Cart> {
    const { data } = await api.post<CartResponse>('/cart/remove', {
      productId,
      color: color || undefined,
      size:  size  || undefined,
    });
    return data.data;
  },

  // DELETE /api/cart/clear
  async clearCart(): Promise<void> {
    await api.delete('/cart/clear');
  },
};
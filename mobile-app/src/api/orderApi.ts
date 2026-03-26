import api from './axiosConfig';

export type OrderStatus =
  | 'pending' | 'confirmed' | 'processing'
  | 'shipped' | 'delivered' | 'cancelled'
  | 'return_requested' | 'returned';

export interface ShippingAddress {
  fullName: string;
  phone:    string;
  street:   string;
  district: string;
  city:     string;
}

export interface OrderItem {
  productId: string;
  name:      string;
  price:     number;
  quantity:  number;
  color?:    string;
  size?:     string;
  image?:    string;
  discount?: number;
}

export interface Order {
  _id:             string;
  userId:          string;
  items:           OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod:   'cod' | 'vnpay' | 'momo';
  paymentStatus:   'pending' | 'completed' | 'failed';
  status:          OrderStatus;
  subtotal:        number;
  shippingFee:     number;
  discountAmount:  number;
  total:           number;
  voucherCode?:    string;
  notes?:          string;
  createdAt:       string;
  updatedAt:       string;
  deliveredAt?:    string;
  userConfirmedAt?: string;
}

export interface CreateOrderPayload {
  items: Array<{
    productId: string;
    quantity:  number;
    price:     number;
    color?:    string;
    size?:     string;
    discount?: number;
  }>;
  shippingAddress: ShippingAddress;
  paymentMethod:   Order['paymentMethod'];
  notes?:          string;
  voucherCode?:    string;
}

export const orderApi = {
  async createOrder(payload: CreateOrderPayload): Promise<Order> {
    const { data } = await api.post<{ status: string; data: Order }>('/orders', payload);
    return data.data;
  },

  async getMyOrders(page = 1, limit = 10, status?: OrderStatus): Promise<{
    orders: Order[];
    pagination: { total: number; page: number; pages: number; limit: number };
  }> {
    const { data } = await api.get('/orders', { params: { page, limit, status } });
    return data.data;
  },

  async getOrderById(id: string): Promise<Order> {
    const { data } = await api.get<{ status: string; data: Order }>(`/orders/${id}`);
    return data.data;
  },

  async cancelOrder(id: string): Promise<Order> {
    const { data } = await api.post<{ status: string; data: Order }>(`/orders/${id}/cancel`);
    return data.data;
  },

  async confirmDelivery(id: string): Promise<Order> {
    const { data } = await api.post<{ status: string; data: Order }>(`/orders/${id}/confirm-delivery`);
    return data.data;
  },
};
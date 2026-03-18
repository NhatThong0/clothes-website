import api from './axiosConfig';
import { Order } from './orderApi';

export interface Address {
  _id:       string;
  userId:    string;
  fullName:  string;
  phone:     string;
  province?: string;
  district?: string;
  ward?:     string;
  street?:   string;
  zipCode?:  string;
  type?:     'home' | 'office' | 'other';
  address?:  string;
  city?:     string;
  label?:    string;
  isDefault: boolean;
  createdAt: string;
}

export interface AddressPayload {
  fullName:   string;
  phone:      string;
  province:   string;
  district:   string;
  ward:       string;
  street:     string;
  zipCode?:   string;
  type?:      'home' | 'office' | 'other';
  isDefault?: boolean;
}

export interface UpdateProfilePayload {
  name?:   string;
  phone?:  string;
  avatar?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword:     string;
}

const userApi = {
  // ─── Profile ───────────────────────────────────────────────────────────────
  async getProfile() {
    const { data } = await api.get('/user/profile');
    return data.data;
  },

  async updateProfile(payload: UpdateProfilePayload) {
    const { data } = await api.put('/user/profile', payload);
    return data.data;
  },

  async changePassword(payload: ChangePasswordPayload) {
    const { data } = await api.put('/user/change-password', payload);
    return data;
  },

  /**
   * Upload avatar lên Cloudinary qua backend
   * @param uri - local URI từ ImagePicker
   * @returns URL ảnh trên Cloudinary
   */
  async uploadAvatar(uri: string): Promise<string> {
    const formData = new FormData();

    // Lấy tên file và type từ URI
    const filename  = uri.split('/').pop() ?? 'avatar.jpg';
    const extension = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType  = extension === 'png' ? 'image/png'
                    : extension === 'webp' ? 'image/webp'
                    : 'image/jpeg';

    formData.append('avatar', {
      uri,
      name: filename,
      type: mimeType,
    } as any);

    const { data } = await api.post('/upload/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return data.data; // Cloudinary URL
  },

  // ─── Orders ────────────────────────────────────────────────────────────────
  async getMyOrders(page = 1, limit = 10, status?: string): Promise<{
    data: Order[];
    pagination: { total: number; page: number; pages: number; limit: number };
  }> {
    const { data } = await api.get('/user/orders', { params: { page, limit, status } });
    return { data: data.data, pagination: data.pagination };
  },

  async getOrderById(id: string): Promise<Order> {
    const { data } = await api.get(`/user/orders/${id}`);
    return data.data;
  },

  async cancelOrder(id: string): Promise<Order> {
    const { data } = await api.put(`/user/orders/${id}/cancel`);
    return data.data;
  },

  // ─── Addresses ─────────────────────────────────────────────────────────────
  async getAddresses(): Promise<Address[]> {
    const { data } = await api.get('/user/addresses');
    return data.data;
  },

  async createAddress(payload: AddressPayload): Promise<Address> {
    const { data } = await api.post('/user/addresses', payload);
    return data.data;
  },

  async updateAddress(id: string, payload: AddressPayload): Promise<Address> {
    const { data } = await api.put(`/user/addresses/${id}`, payload);
    return data.data;
  },

  async deleteAddress(id: string): Promise<void> {
    await api.delete(`/user/addresses/${id}`);
  },

  async setDefaultAddress(id: string): Promise<Address> {
    const { data } = await api.put(`/user/addresses/${id}/set-default`);
    return data.data;
  },
};

export default userApi;
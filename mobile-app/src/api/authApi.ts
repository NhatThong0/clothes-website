import api from './axiosConfig';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: 'user' | 'admin';
}

interface AuthResponse {
  status: string;
  message: string;
  data: { user: User; token: string };
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const authApi = {
  async login(payload: LoginPayload): Promise<{ token: string; user: User }> {
    const { data } = await api.post<AuthResponse>('/auth/login', payload);
    return data.data;
  },

  async register(payload: RegisterPayload): Promise<{ token: string; user: User }> {
    const { data } = await api.post<AuthResponse>('/auth/register', payload);
    return data.data;
  },

  async getProfile(): Promise<User> {
    const { data } = await api.get<{ status: string; data: User }>('/auth/me');
    return data.data;
  },
};
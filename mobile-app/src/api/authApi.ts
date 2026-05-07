import api from './axiosConfig';

export interface LoyaltyTier {
  _id?: string;
  name?: string;
  icon_key?: string;
  iconKey?: string;
  icon?: string;
  discount_percent?: number;
  min_points?: number;
}

export interface LoyaltyInfo {
  tier?: LoyaltyTier | null;
  next_tier?: LoyaltyTier | null;
  tier_points?: number;
  spendable_points?: number;
  syncedAt?: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: 'user' | 'admin';
  loyalty?: LoyaltyInfo | null;
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

  async googleLogin(idToken: string): Promise<{ token: string; user: User }> {
    const { data } = await api.post<AuthResponse>('/auth/social-login', {
      provider: 'google',
      idToken,
    });
    return data.data;
  },

  async googleLoginWithAccessToken(accessToken: string): Promise<{ token: string; user: User }> {
    const { data } = await api.post<AuthResponse>('/auth/social-login', {
      provider: 'google',
      accessToken,
    });
    return data.data;
  },
};

import { create } from 'zustand';
import { tokenStorage } from '../utils/tokenStorage';
import { User } from '../api/authApi';

interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoggedIn: false,
  isLoading: true,

  loadFromStorage: async () => {
    try {
      const [token, user] = await Promise.all([
        tokenStorage.getAccessToken(),
        tokenStorage.getUserInfo<User>(),
      ]);
      if (token && user) set({ user, isLoggedIn: true });
    } catch {
      await tokenStorage.clearTokens();
    } finally {
      set({ isLoading: false });
    }
  },

  // Backend chỉ có 1 token → lưu vào accessToken, refreshToken để trống
  login: async (token, user) => {
    await tokenStorage.saveTokens(token, '');
    await tokenStorage.saveUserInfo(user);
    set({ user, isLoggedIn: true });
  },

  logout: async () => {
    await tokenStorage.clearTokens();
    set({ user: null, isLoggedIn: false });
  },

  setUser: (user) => set({ user }),
}));
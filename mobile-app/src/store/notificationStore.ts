import { create } from 'zustand';
import api from '../api/axiosConfig';

export interface Notification {
  _id:       string;
  userId:    string;
  title:     string;
  message:   string;
  type:      string;
  icon?:     string;
  color?:    string;
  meta?:     any;
  isRead:    boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount:   number;
  loading:       boolean;

  setNotifications: (notifs: Notification[]) => void;
  addNotification:  (notif: Notification) => void;
  setUnreadCount:   (count: number) => void;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount:   0,
  loading:       false,

  setNotifications: (notifications) => set({ notifications }),
  
  addNotification: (notif) => set((state) => ({
    notifications: [notif, ...state.notifications],
    unreadCount:   state.unreadCount + 1,
  })),

  setUnreadCount: (unreadCount) => set({ unreadCount }),

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/notifications');
      set({ 
        notifications: data.data.notifications || [],
        unreadCount:   data.data.unreadCount || 0
      });
    } catch (error) {
      console.error('fetchNotifications error:', error);
    } finally {
      set({ loading: false });
    }
  },

  markAsRead: async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      set((state) => ({
        notifications: state.notifications.map(n => 
          n._id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (error) {
      console.error('markAsRead error:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      await api.put('/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount:   0
      }));
    } catch (error) {
      console.error('markAllAsRead error:', error);
    }
  }
}));

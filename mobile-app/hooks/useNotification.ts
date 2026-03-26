import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/src/constants/config';
import { tokenStorage } from '@/src/utils/tokenStorage';
import { useAuthStore } from '@/src/store/authStore';
import { useNotificationStore, Notification } from '@/src/store/notificationStore';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

export function useNotification() {
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();
  const { isLoggedIn, user } = useAuthStore();
  const { addNotification, fetchNotifications } = useNotificationStore();

  useEffect(() => {
    let socket: Socket;

    const initSocket = async () => {
      if (!isLoggedIn) return;
      
      const token = await tokenStorage.getAccessToken();
      if (!token) return;

      socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[Socket] Global Notification Socket Connected');
      });

      socket.on('notification', (notif: Notification) => {
        console.log('[Socket] New Notification:', notif);
        addNotification(notif);
        
        // Vibrate
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

        // Show Toast
        Toast.show({
          type: 'info',
          text1: notif.title,
          text2: notif.message,
          onPress: () => {
             router.push('/profile/notifications' as any);
          }
        });
      });

      // Lấy danh sách ban đầu
      fetchNotifications();
    };

    if (isLoggedIn) {
      initSocket();
    }

    return () => {
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [isLoggedIn, user?._id]);

  return { socket: socketRef.current };
}

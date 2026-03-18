import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '@/src/store/authStore';
import { authEventEmitter } from '@/src/api/axiosConfig';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 5 * 60 * 1000 } },
});

function AuthGuard() {
  const { isLoggedIn, isLoading } = useAuthStore();
  const segments = useSegments();
  const router   = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isLoggedIn && !inAuthGroup) {
      // Chưa login → về trang login
      router.replace('/(auth)/login' as any);
    } else if (isLoggedIn && inAuthGroup) {
      // Đã login mà vào auth → về tabs
      router.replace('/(tabs)');
    }
  }, [isLoggedIn, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  const { logout } = useAuthStore();

  useEffect(() => {
    return authEventEmitter.on('logout', logout);
  }, [logout]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </QueryClientProvider>
  );
}
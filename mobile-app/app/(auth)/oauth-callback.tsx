import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuthStore } from '@/src/store/authStore';
import { authApi } from '@/src/api/authApi';

function parseUrlParams(url: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const u = new URL(url);
    u.searchParams.forEach((v, k) => { result[k] = v; });
    // Also check hash fragment — implicit flow puts tokens after # before proxy forwards them
    if (u.hash) new URLSearchParams(u.hash.replace(/^#/, '')).forEach((v, k) => { result[k] = v; });
  } catch {}
  return result;
}

// Android Expo Go: after proxy OAuth, deep link exp://IP/--/oauth-callback?id_token=...
// is handled by Expo Router (not WebBrowser). This route reads the token and completes login.
export default function OAuthCallbackScreen() {
  const routeParams = useLocalSearchParams<{
    id_token?: string;
    access_token?: string;
    error?: string;
    error_description?: string;
  }>();
  const { login } = useAuthStore();
  const processed = useRef(false);

  async function processTokens(params: Record<string, string | undefined>) {
    if (processed.current) return;
    processed.current = true;

    const { id_token, access_token, error, error_description } = params;
    try {
      if (error) throw new Error(error_description || error);
      if (id_token) {
        const { token, user } = await authApi.googleLogin(id_token);
        await login(token, user);
        router.replace('/(tabs)');
      } else if (access_token) {
        const { token, user } = await authApi.googleLoginWithAccessToken(access_token);
        await login(token, user);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Lỗi', 'Không nhận được token từ Google. Vui lòng thử lại.');
        router.replace('/(auth)/login');
      }
    } catch (err: any) {
      Alert.alert(
        'Đăng nhập Google thất bại',
        err?.response?.data?.message || err?.message || 'Vui lòng thử lại sau',
      );
      router.replace('/(auth)/login');
    }
  }

  // Primary path: Expo Router passes query params from the deep link URL
  useEffect(() => {
    const { id_token, access_token, error } = routeParams;
    if (id_token || access_token || error) {
      processTokens(routeParams as Record<string, string>);
    }
  }, [routeParams.id_token, routeParams.access_token, routeParams.error]);

  // Fallback path: params not in route (e.g. hash fragments, or warm-start timing)
  // Listen for the raw URL event fired by Expo Go when the deep link arrives.
  useEffect(() => {
    // Cold-start: URL that launched the app
    Linking.getInitialURL().then((url) => {
      if (!url || processed.current) return;
      const parsed = parseUrlParams(url);
      if (parsed.id_token || parsed.access_token || parsed.error) {
        processTokens(parsed);
      }
    });

    // Warm-start: URL event fired while app is already running
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!url.includes('oauth-callback') || processed.current) return;
      const parsed = parseUrlParams(url);
      if (parsed.id_token || parsed.access_token || parsed.error) {
        processTokens(parsed);
      }
    });

    // If no token source fires within 8 s, give up and go back to login
    const timeout = setTimeout(() => {
      if (!processed.current) {
        processed.current = true;
        Alert.alert('Lỗi', 'Không nhận được token từ Google. Vui lòng thử lại.');
        router.replace('/(auth)/login');
      }
    }, 8000);

    return () => {
      sub.remove();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#1A1A1A" />
    </View>
  );
}

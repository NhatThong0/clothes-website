import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '@/src/store/authStore';

export default function Index() {
  const { isLoggedIn, isLoading, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0c29' }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return isLoggedIn
    ? <Redirect href="/(tabs)" />
    : <Redirect href={'/(auth)/login' as any} />;
}
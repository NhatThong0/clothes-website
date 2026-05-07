import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';

// Android Expo Go: when the OAuth proxy redirects to exp://IP/--/expo-auth-session,
// Expo Router navigates here. Calling maybeCompleteAuthSession() broadcasts the URI
// to openAuthSessionAsync's receiver so the login flow can complete.
export default function ExpoAuthSessionScreen() {
  useEffect(() => {
    (async () => {
      const result = await WebBrowser.maybeCompleteAuthSession();
      if (result.type === 'no-auth-session') {
        router.replace('/(auth)/login');
      }
      // If 'complete': openAuthSessionAsync in login.tsx resolves and handles navigation
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#1A1A1A" />
    </View>
  );
}

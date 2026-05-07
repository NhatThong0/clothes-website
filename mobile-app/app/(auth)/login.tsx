import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { ResponseType } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useAuthStore } from '@/src/store/authStore';
import { authApi } from '@/src/api/authApi';

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID!;

// Expo Go dùng auth proxy vì iOS OAuth native không hỗ trợ exp:// scheme
const IS_EXPO_GO     = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const EXPO_OWNER     = process.env.EXPO_PUBLIC_EXPO_OWNER ?? 'nhatthong1909';
const PROXY_REDIRECT = `https://auth.expo.io/@${EXPO_OWNER}/mobile-app`;

function parseUrlParams(url: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const u = new URL(url);
    u.searchParams.forEach((v, k) => { result[k] = v; });
    if (u.hash) new URLSearchParams(u.hash.replace(/^#/, '')).forEach((v, k) => { result[k] = v; });
  } catch {}
  return result;
}


type Tab = 'login' | 'register';

export default function LoginScreen() {
  const router    = useRouter();
  const { login } = useAuthStore();
  const [tab, setTab]         = useState<Tab>('login');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const [name, setName]                       = useState('');
  const [regEmail, setRegEmail]               = useState('');
  const [regPassword, setRegPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ─── Google OAuth ─────────────────────────────────────────────────────────
  // Expo Go iOS: iOS OAuth native gây lỗi 400 vì exp:// scheme không được Google chấp nhận.
  // Giải pháp: dùng webClientId + auth proxy (https://auth.expo.io) làm redirect URI.
  // Cần thêm https://auth.expo.io/@nhatthong1909/mobile-app vào Authorized Redirect URIs
  // của Web OAuth Client trong Google Cloud Console.
  // Trong Expo Go, proxy flow dùng WEB_CLIENT_ID cho mọi platform (vì web client mới có
  // https://auth.expo.io/... trong authorized redirect URIs). Android/iOS native client
  // chỉ cho phép custom scheme như host.exp.exponent:/ hay com.googleusercontent.apps...:/
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId:        WEB_CLIENT_ID,
    webClientId:     WEB_CLIENT_ID,
    androidClientId: IS_EXPO_GO ? undefined : ANDROID_CLIENT_ID,
    scopes:          ['openid', 'profile', 'email'],
    responseType:    ResponseType.IdToken,
    redirectUri:     IS_EXPO_GO ? PROXY_REDIRECT : undefined,
  });

  React.useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const idToken     = response.params?.id_token     ?? response.authentication?.idToken;
      const accessToken = response.params?.access_token ?? response.authentication?.accessToken;
      if (idToken) {
        handleGoogleIdToken(idToken);
      } else if (accessToken) {
        handleGoogleAccessToken(accessToken);
      } else {
        Alert.alert('Lỗi', 'Không nhận được token từ Google. Vui lòng thử lại.');
        setGoogleLoading(false);
      }
    } else if (response.type === 'error') {
      Alert.alert('Đăng nhập Google thất bại', response.error?.message || 'Vui lòng thử lại');
      setGoogleLoading(false);
    } else if (response.type === 'dismiss' || response.type === 'cancel') {
      setGoogleLoading(false);
    }
  }, [response]);

  const handleGoogleSignIn = async () => {
    if (!request) {
      Alert.alert('Chưa sẵn sàng', 'Đang khởi tạo Google Sign-In, vui lòng thử lại sau giây lát');
      return;
    }
    setGoogleLoading(true);

    if (IS_EXPO_GO) {
      try {
        const returnUrl = Linking.createURL('oauth-callback');
        const proxyStartUrl = `https://auth.expo.io/@${EXPO_OWNER}/mobile-app/start?${new URLSearchParams({
          authUrl: request.url!,
          returnUrl,
        })}`;
        const result = await WebBrowser.openAuthSessionAsync(proxyStartUrl, returnUrl);

        if (result.type === 'success' && result.url) {
          // Chrome CCT captured the redirect URL directly (some Android versions)
          const parsed = parseUrlParams(result.url);
          if (parsed.id_token) {
            handleGoogleIdToken(parsed.id_token);
            return; // handleGoogleIdToken manages its own loading state
          } else if (parsed.access_token) {
            handleGoogleAccessToken(parsed.access_token);
            return;
          }
        }
        // dismiss/cancel or no token in result: oauth-callback.tsx handles it via deep link
      } catch {
        Alert.alert('Lỗi', 'Không thể mở trang đăng nhập Google.');
      }
      setGoogleLoading(false);
    } else {
      await promptAsync();
    }
  };

  const handleGoogleIdToken = async (idToken: string) => {
    try {
      const { token, user } = await authApi.googleLogin(idToken);
      await login(token, user);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Đăng nhập Google thất bại', err?.response?.data?.message || 'Vui lòng thử lại sau');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleAccessToken = async (accessToken: string) => {
    try {
      const { token, user } = await authApi.googleLoginWithAccessToken(accessToken);
      await login(token, user);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Đăng nhập Google thất bại', err?.response?.data?.message || 'Vui lòng thử lại sau');
    } finally {
      setGoogleLoading(false);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập email và mật khẩu');
      return;
    }
    try {
      setLoading(true);
      const { token, user } = await authApi.login({ email: email.trim(), password });
      await login(token, user);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Đăng nhập thất bại', err?.response?.data?.message || 'Sai email hoặc mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !regEmail.trim() || !regPassword || !confirmPassword) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ');
      return;
    }
    if (regPassword !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp');
      return;
    }
    try {
      setLoading(true);
      const { token, user } = await authApi.register({
        name: name.trim(), email: regEmail.trim(),
        password: regPassword, confirmPassword,
      });
      await login(token, user);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Đăng ký thất bại', err?.response?.data?.message || 'Vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  const isAnyLoading = loading || googleLoading;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={s.logoRow}>
            <View style={s.logoMark}>
              <Text style={s.logoText}>S</Text>
            </View>
            <Text style={s.logoName}>ShopApp</Text>
          </View>

          {/* Heading */}
          <Text style={s.heading}>
            {tab === 'login' ? 'Chào mừng\ntrở lại.' : 'Tạo tài\nkhoản mới.'}
          </Text>
          <Text style={s.subheading}>
            {tab === 'login'
              ? 'Đăng nhập để tiếp tục mua sắm'
              : 'Điền thông tin để bắt đầu'}
          </Text>

          {/* Tab switcher */}
          <View style={s.tabRow}>
            <TouchableOpacity
              style={[s.tabItem, tab === 'login' && s.tabItemActive]}
              onPress={() => setTab('login')}
            >
              <Text style={[s.tabText, tab === 'login' && s.tabTextActive]}>
                Đăng nhập
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tabItem, tab === 'register' && s.tabItemActive]}
              onPress={() => setTab('register')}
            >
              <Text style={[s.tabText, tab === 'register' && s.tabTextActive]}>
                Đăng ký
              </Text>
            </TouchableOpacity>
          </View>

          {/* LOGIN form */}
          {tab === 'login' && (
            <View style={s.form}>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="example@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Field
                label="Mật khẩu"
                value={password}
                onChangeText={setPassword}
                placeholder="Tối thiểu 6 ký tự"
                secureTextEntry={!showPass}
                rightLabel={showPass ? 'Ẩn' : 'Hiện'}
                onRightLabel={() => setShowPass(!showPass)}
              />
              <TouchableOpacity style={s.forgot}>
                <Text style={s.forgotText}>Quên mật khẩu?</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, isAnyLoading && s.btnDisabled]}
                onPress={handleLogin}
                disabled={isAnyLoading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Đăng nhập</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* REGISTER form */}
          {tab === 'register' && (
            <View style={s.form}>
              <Field
                label="Họ và tên"
                value={name}
                onChangeText={setName}
                placeholder="Nguyễn Văn A"
              />
              <Field
                label="Email"
                value={regEmail}
                onChangeText={setRegEmail}
                placeholder="example@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Field
                label="Mật khẩu"
                value={regPassword}
                onChangeText={setRegPassword}
                placeholder="Tối thiểu 6 ký tự"
                secureTextEntry={!showPass}
                rightLabel={showPass ? 'Ẩn' : 'Hiện'}
                onRightLabel={() => setShowPass(!showPass)}
              />
              <Field
                label="Xác nhận mật khẩu"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Nhập lại mật khẩu"
                secureTextEntry={!showConfirm}
                rightLabel={showConfirm ? 'Ẩn' : 'Hiện'}
                onRightLabel={() => setShowConfirm(!showConfirm)}
              />
              <TouchableOpacity
                style={[s.btn, isAnyLoading && s.btnDisabled]}
                onPress={handleRegister}
                disabled={isAnyLoading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Tạo tài khoản</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Divider */}
          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>hoặc</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Google Sign-In Button */}
          <TouchableOpacity
            style={[s.googleBtn, isAnyLoading && s.btnDisabled]}
            onPress={handleGoogleSignIn}
            disabled={isAnyLoading || !request}
            activeOpacity={0.85}
            accessibilityLabel="Đăng nhập bằng Google"
          >
            {googleLoading ? (
              <ActivityIndicator color="#1A1A1A" />
            ) : (
              <>
                <GoogleColorIcon />
                <Text style={s.googleBtnText}>Tiếp tục với Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={s.switchRow}>
            <Text style={s.switchText}>
              {tab === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
            </Text>
            <TouchableOpacity onPress={() => setTab(tab === 'login' ? 'register' : 'login')}>
              <Text style={s.switchLink}>
                {tab === 'login' ? 'Đăng ký' : 'Đăng nhập'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Google Color Icon ────────────────────────────────────────────────────────
function GoogleColorIcon() {
  return (
    <View style={gi.container}>
      <Text style={[gi.letter, { color: '#4285F4' }]}>G</Text>
      <Text style={[gi.letter, { color: '#EA4335' }]}>o</Text>
      <Text style={[gi.letter, { color: '#FBBC05' }]}>o</Text>
      <Text style={[gi.letter, { color: '#4285F4' }]}>g</Text>
      <Text style={[gi.letter, { color: '#34A853' }]}>l</Text>
      <Text style={[gi.letter, { color: '#EA4335' }]}>e</Text>
    </View>
  );
}

const gi = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  letter:    { fontSize: 16, fontWeight: '700' },
});

// ─── Field Component ──────────────────────────────────────────────────────────
function Field({ label, rightLabel, onRightLabel, ...props }: {
  label: string; rightLabel?: string; onRightLabel?: () => void; [k: string]: any;
}) {
  return (
    <View style={f.wrap}>
      <View style={f.labelRow}>
        <Text style={f.label}>{label}</Text>
        {rightLabel && (
          <TouchableOpacity onPress={onRightLabel}>
            <Text style={f.rightLabel}>{rightLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      <TextInput style={f.input} placeholderTextColor="#BBBBBB" {...props} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const TOKEN = { black: '#1A1A1A', surface: '#F5F5F0', border: '#E8E8E4', muted: '#AAAAAA' };

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#FFFFFF' },
  scroll:        { flexGrow: 1, paddingHorizontal: 28, paddingTop: 72, paddingBottom: 40 },
  logoRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 40 },
  logoMark:      { width: 32, height: 32, borderRadius: 8, backgroundColor: TOKEN.black, alignItems: 'center', justifyContent: 'center' },
  logoText:      { color: '#fff', fontSize: 16, fontWeight: '800' },
  logoName:      { fontSize: 16, fontWeight: '700', color: TOKEN.black },
  heading:       { fontSize: 34, fontWeight: '900', color: TOKEN.black, lineHeight: 40, marginBottom: 8 },
  subheading:    { fontSize: 15, color: TOKEN.muted, marginBottom: 32 },
  tabRow:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: TOKEN.border, marginBottom: 28 },
  tabItem:       { paddingBottom: 12, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: TOKEN.black },
  tabText:       { fontSize: 14, fontWeight: '600', color: TOKEN.muted },
  tabTextActive: { color: TOKEN.black },
  form:          { gap: 0 },
  forgot:        { alignSelf: 'flex-end', marginTop: -4, marginBottom: 24 },
  forgotText:    { fontSize: 13, color: TOKEN.black, fontWeight: '600' },
  btn:           { backgroundColor: TOKEN.black, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  btnDisabled:   { opacity: 0.5 },
  btnText:       { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: TOKEN.border },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: TOKEN.muted, fontWeight: '500' },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: TOKEN.border,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: TOKEN.black },

  switchRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  switchText: { fontSize: 14, color: TOKEN.muted },
  switchLink: { fontSize: 14, color: TOKEN.black, fontWeight: '700' },
});

const f = StyleSheet.create({
  wrap:       { marginBottom: 18 },
  labelRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label:      { fontSize: 12, fontWeight: '700', color: '#888', letterSpacing: 0.5, textTransform: 'uppercase' },
  rightLabel: { fontSize: 12, fontWeight: '600', color: '#1A1A1A' },
  input:      { backgroundColor: '#F5F5F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, fontSize: 15, color: '#1A1A1A' },
});
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/src/store/authStore';
import { authApi } from '@/src/api/authApi';

type Tab = 'login' | 'register';

export default function LoginScreen() {
  const router     = useRouter();
  const { login }  = useAuthStore();
  const [tab, setTab]         = useState<Tab>('login');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const [name, setName]                       = useState('');
  const [regEmail, setRegEmail]               = useState('');
  const [regPassword, setRegPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
          {/* Logo mark */}
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

          {/* LOGIN */}
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
                style={[s.btn, loading && s.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Đăng nhập</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* REGISTER */}
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
                style={[s.btn, loading && s.btnDisabled]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Tạo tài khoản</Text>}
              </TouchableOpacity>
            </View>
          )}

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
  switchRow:     { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  switchText:    { fontSize: 14, color: TOKEN.muted },
  switchLink:    { fontSize: 14, color: TOKEN.black, fontWeight: '700' },
});

const f = StyleSheet.create({
  wrap:       { marginBottom: 18 },
  labelRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label:      { fontSize: 12, fontWeight: '700', color: '#888', letterSpacing: 0.5, textTransform: 'uppercase' },
  rightLabel: { fontSize: 12, fontWeight: '600', color: '#1A1A1A' },
  input:      { backgroundColor: '#F5F5F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, fontSize: 15, color: '#1A1A1A' },
});
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import userApi from '@/src/api/userApi';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [loading, setLoading]         = useState(false);
  const [current, setCurrent]         = useState('');
  const [newPass, setNewPass]         = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = async () => {
    if (!current || !newPass || !confirm) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (newPass.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu mới phải ít nhất 6 ký tự');
      return;
    }
    if (newPass !== confirm) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp');
      return;
    }
    try {
      setLoading(true);
      await userApi.changePassword({ currentPassword: current, newPassword: newPass });
      Alert.alert('Thành công', 'Đổi mật khẩu thành công', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Lỗi', err?.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Đổi mật khẩu</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <View style={s.card}>
          <PasswordField label="Mật khẩu hiện tại" value={current} onChangeText={setCurrent}
            show={showCurrent} onToggle={() => setShowCurrent(!showCurrent)} />
          <PasswordField label="Mật khẩu mới" value={newPass} onChangeText={setNewPass}
            show={showNew} onToggle={() => setShowNew(!showNew)} />
          <PasswordField label="Xác nhận mật khẩu mới" value={confirm} onChangeText={setConfirm}
            show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
        </View>

        <View style={s.hintCard}>
          <Ionicons name="information-circle-outline" size={16} color="#3B82F6" />
          <Text style={s.hint}>Mật khẩu phải có ít nhất 6 ký tự</Text>
        </View>

        <TouchableOpacity
          style={[s.btn, loading && { opacity: 0.7 }]}
          onPress={handleChange}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Đổi mật khẩu</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function PasswordField({ label, show, onToggle, ...props }: {
  label: string; show: boolean; onToggle: () => void; [key: string]: any;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={!show}
          placeholder="••••••••"
          {...props}
        />
        <TouchableOpacity onPress={onToggle}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#F9FAFB' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  body:        { padding: 16, gap: 16 },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  label:       { fontSize: 12, color: '#6B7280', marginBottom: 6, fontWeight: '500' },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  input:       { flex: 1, fontSize: 14, color: '#111827' },
  hintCard:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', padding: 12, borderRadius: 10 },
  hint:        { fontSize: 13, color: '#3B82F6' },
  btn:         { backgroundColor: '#FF6B35', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});
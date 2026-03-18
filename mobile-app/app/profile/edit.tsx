import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  Image, ActionSheetIOS, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/src/store/authStore';
import userApi from '@/src/api/userApi';

const TOKEN = { black: '#1A1A1A', surface: '#F5F5F0', border: '#E8E8E4', muted: '#9CA3AF' };

export default function EditProfileScreen() {
  const router            = useRouter();
  const { user, setUser } = useAuthStore();

  const [loading, setLoading]           = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [name, setName]   = useState(user?.name  || '');
  const [phone, setPhone] = useState(user?.phone || '');
  // preview cục bộ trước khi lưu — dùng URI local hoặc URL Cloudinary
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar || null);

  // ── Xin quyền & mở picker ────────────────────────────────────────────────
  const requestAndPick = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Vui lòng cho phép truy cập camera trong cài đặt');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Vui lòng cho phép truy cập thư viện ảnh trong cài đặt');
        return;
      }
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],   // crop vuông
      quality: 0.8,
    };

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets?.[0]?.uri) {
      await handleUpload(result.assets[0].uri);
    }
  };

  // ── Upload lên Cloudinary ────────────────────────────────────────────────
  const handleUpload = async (uri: string) => {
    try {
      setAvatarLoading(true);
      setAvatarUri(uri); // preview ngay lập tức

      const cloudinaryUrl = await userApi.uploadAvatar(uri);

      // Cập nhật avatar trong profile
      const updated = await userApi.updateProfile({ avatar: cloudinaryUrl });
      setUser(updated);
      setAvatarUri(cloudinaryUrl);

      Alert.alert('Thành công', 'Ảnh đại diện đã được cập nhật');
    } catch (err: any) {
      setAvatarUri(user?.avatar || null); // rollback preview nếu lỗi
      Alert.alert('Lỗi', err?.response?.data?.message || 'Không thể tải ảnh lên');
    } finally {
      setAvatarLoading(false);
    }
  };

  // ── Hiện action sheet chọn nguồn ảnh ────────────────────────────────────
  const handleAvatarPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Hủy', 'Chụp ảnh mới', 'Chọn từ thư viện'],
          cancelButtonIndex: 0,
        },
        buttonIndex => {
          if (buttonIndex === 1) requestAndPick('camera');
          if (buttonIndex === 2) requestAndPick('library');
        },
      );
    } else {
      // Android: dùng Alert thay ActionSheet
      Alert.alert('Thay ảnh đại diện', '', [
        { text: 'Chụp ảnh mới',        onPress: () => requestAndPick('camera') },
        { text: 'Chọn từ thư viện',    onPress: () => requestAndPick('library') },
        { text: 'Hủy', style: 'cancel' },
      ]);
    }
  };

  // ── Lưu tên & số điện thoại ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Lỗi', 'Tên không được để trống');
      return;
    }
    try {
      setLoading(true);
      const updated = await userApi.updateProfile({ name: name.trim(), phone: phone.trim() });
      setUser(updated);
      Alert.alert('Thành công', 'Cập nhật thông tin thành công', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Lỗi', err?.response?.data?.message || 'Không thể cập nhật');
    } finally {
      setLoading(false);
    }
  };

  // ── Initials fallback ─────────────────────────────────────────────────────
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(-2).join('').toUpperCase() || '?';

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={TOKEN.black} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Thông tin cá nhân</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        {/* ── Avatar ── */}
        <View style={s.avatarSection}>
          <TouchableOpacity
            style={s.avatarWrap}
            onPress={handleAvatarPress}
            activeOpacity={0.85}
            disabled={avatarLoading}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatarImg} />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={s.avatarInitials}>{initials}</Text>
              </View>
            )}

            {/* Overlay loading */}
            {avatarLoading && (
              <View style={s.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}

            {/* Camera badge */}
            {!avatarLoading && (
              <View style={s.cameraBadge}>
                <Ionicons name="camera" size={13} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={s.avatarHint}>Nhấn để thay ảnh đại diện</Text>
        </View>

        {/* ── Form ── */}
        <View style={s.card}>
          <Field
            label="Họ và tên *"
            value={name}
            onChangeText={setName}
            placeholder="Nguyễn Văn A"
          />
          <Field
            label="Email"
            value={user?.email || ''}
            editable={false}
            placeholder=""
            style={s.fieldDisabled}
          />
          <Field
            label="Số điện thoại"
            value={phone}
            onChangeText={setPhone}
            placeholder="0912345678"
            keyboardType="phone-pad"
          />
        </View>

        <TouchableOpacity
          style={[s.saveBtn, (loading || avatarLoading) && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading || avatarLoading}
          activeOpacity={0.88}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveBtnText}>Lưu thay đổi</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────
function Field({ label, style, ...props }: { label: string; style?: any; [key: string]: any }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, style]}
        placeholderTextColor={TOKEN.muted}
        {...props}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const AVATAR_SIZE = 96;

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#F9FAFB' },
  header:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6',
  },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: TOKEN.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TOKEN.black },

  body: { padding: 16, gap: 16, paddingBottom: 40 },

  /* Avatar */
  avatarSection:  { alignItems: 'center', paddingVertical: 8, gap: 10 },
  avatarWrap:     { position: 'relative' },
  avatarImg:      { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarFallback: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    backgroundColor: TOKEN.black, alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { color: '#fff', fontSize: 32, fontWeight: '700' },
  avatarOverlay:  {
    ...StyleSheet.absoluteFillObject,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: TOKEN.black,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#F9FAFB',
  },
  avatarHint: { fontSize: 12, color: TOKEN.muted },

  /* Form */
  card:         {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  label:        { fontSize: 12, color: TOKEN.muted, marginBottom: 6, fontWeight: '500' },
  input:        {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: TOKEN.black,
  },
  fieldDisabled: { opacity: 0.5 },

  saveBtn:     { backgroundColor: TOKEN.black, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import userApi, { AddressPayload } from '@/src/api/userApi';

const TOKEN = { black: '#1A1A1A', surface: '#F5F5F0', border: '#E8E8E4', muted: '#AAAAAA' };

export default function AddressFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [loading, setLoading]     = useState(false);
  const [fetching, setFetching]   = useState(isEdit);
  const [isDefault, setIsDefault] = useState(false);

  const [form, setForm] = useState<AddressPayload>({
    fullName: '', phone: '',
    street:   '',
    ward:     '',
    district: '',
    province: '',
    type:     'home',
    isDefault: false,
  });

  useEffect(() => {
  if (!isEdit) return;
  userApi.getAddresses()
    .then(list => {
      const found = list.find(a => a._id === id);
      if (found) {
        setForm({
          fullName:  found.fullName  || '',
          phone:     found.phone     || '',
          // ✅ fallback: street → address (địa chỉ cũ dùng 'address')
          street:    found.street    || (found as any).address  || '',
          ward:      found.ward      || '',
          district:  found.district  || '',
          // ✅ fallback: province → city (địa chỉ cũ dùng 'city')
          province:  found.province  || (found as any).city     || '',
          type:      found.type      || 'home',
          isDefault: found.isDefault || false,
        });
        setIsDefault(found.isDefault || false);
      }
    })
    .catch(console.error)
    .finally(() => setFetching(false));
}, [id]);

  const set = (key: keyof AddressPayload, val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.fullName || !form.phone || !form.street || !form.ward || !form.district || !form.province) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ các trường bắt buộc (*)');
      return;
    }
    try {
      setLoading(true);
      const payload: AddressPayload = { ...form, isDefault };
      if (isEdit) {
        await userApi.updateAddress(id!, payload);
        Alert.alert('Thành công', 'Địa chỉ đã được cập nhật', [
          { text: 'OK', onPress: () => router.replace('/profile/addresses') },
        ]);
      } else {
        await userApi.createAddress(payload);
        Alert.alert('Thành công', 'Địa chỉ đã được thêm', [
          { text: 'OK', onPress: () => router.replace('/profile/addresses') },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err?.response?.data?.message || 'Không thể lưu địa chỉ');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <View style={s.center}><ActivityIndicator color={TOKEN.black} /></View>;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={TOKEN.black} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEdit ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <Field label="Họ và tên *"         value={form.fullName} onChangeText={(v: string) => set('fullName', v)} placeholder="Nguyễn Văn A" />
          <Field label="Số điện thoại *"     value={form.phone}    onChangeText={(v: string) => set('phone', v)}    placeholder="0912345678" keyboardType="phone-pad" />
          <Field label="Số nhà, tên đường *" value={form.street}   onChangeText={(v: string) => set('street', v)}   placeholder="123 Đường Lê Lợi" />
          <Field label="Phường / Xã *"       value={form.ward}     onChangeText={(v: string) => set('ward', v)}     placeholder="Phường Bến Nghé" />
          <Field label="Quận / Huyện *"      value={form.district} onChangeText={(v: string) => set('district', v)} placeholder="Quận 1" />
          <Field label="Tỉnh / Thành phố *"  value={form.province} onChangeText={(v: string) => set('province', v)} placeholder="TP. Hồ Chí Minh" />
          
          {/* Loại địa chỉ */}
          <Text style={s.label}>Loại địa chỉ</Text>
          <View style={s.typeRow}>
            {(['home', 'office', 'other'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[s.typeBtn, form.type === t && s.typeBtnActive]}
                onPress={() => set('type', t)}
              >
                <Ionicons
                  name={t === 'home' ? 'home-outline' : t === 'office' ? 'business-outline' : 'location-outline'}
                  size={14}
                  color={form.type === t ? '#fff' : TOKEN.muted}
                />
                <Text style={[s.typeBtnText, form.type === t && s.typeBtnTextActive]}>
                  {t === 'home' ? 'Nhà riêng' : t === 'office' ? 'Văn phòng' : 'Khác'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Đặt mặc định */}
        <View style={s.switchCard}>
          <View>
            <Text style={s.switchLabel}>Đặt làm địa chỉ mặc định</Text>
            <Text style={s.switchSub}>Dùng cho các đơn hàng tiếp theo</Text>
          </View>
          <Switch
            value={isDefault}
            onValueChange={setIsDefault}
            trackColor={{ false: TOKEN.border, true: TOKEN.black }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity
          style={[s.saveBtn, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveBtnText}>{isEdit ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ'}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Field({ label, ...props }: { label: string; [k: string]: any }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={TOKEN.muted} {...props} />
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#fff' },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: TOKEN.surface },
  backBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: TOKEN.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: 16, fontWeight: '800', color: TOKEN.black },
  body:          { padding: 16, gap: 14, paddingBottom: 40 },
  card:          { backgroundColor: TOKEN.surface, borderRadius: 16, padding: 16 },
  label:         { fontSize: 11, color: TOKEN.muted, marginBottom: 6, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  input:         { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: TOKEN.black },
  typeRow:       { flexDirection: 'row', gap: 8 },
  typeBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1.5, borderColor: TOKEN.border },
  typeBtnActive: { backgroundColor: TOKEN.black, borderColor: TOKEN.black },
  typeBtnText:   { fontSize: 12, fontWeight: '600', color: TOKEN.muted },
  typeBtnTextActive: { color: '#fff' },
  switchCard:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: TOKEN.surface, borderRadius: 16, padding: 16 },
  switchLabel:   { fontSize: 14, fontWeight: '700', color: TOKEN.black },
  switchSub:     { fontSize: 12, color: TOKEN.muted, marginTop: 2 },
  saveBtn:       { backgroundColor: TOKEN.black, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  saveBtnText:   { color: '#fff', fontSize: 15, fontWeight: '800' },
});
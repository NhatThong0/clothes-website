import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import userApi, { Address } from '@/src/api/userApi';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export default function AddressesScreen() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading]     = useState(true);

  // ✅ Thêm
useFocusEffect(
  useCallback(() => {
    setLoading(true);
    userApi.getAddresses()
      .then(setAddresses)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [])
);

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Xóa địa chỉ', `Xóa địa chỉ của "${name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive',
        onPress: async () => {
          try {
            await userApi.deleteAddress(id);
            setAddresses(prev => prev.filter(a => a._id !== id));
          } catch (err: any) {
            Alert.alert('Lỗi', err?.response?.data?.message || 'Không thể xóa');
          }
        },
      },
    ]);
  };

  const handleSetDefault = async (id: string) => {
    try {
      await userApi.setDefaultAddress(id);
      setAddresses(prev => prev.map(a => ({ ...a, isDefault: a._id === id })));
    } catch (err: any) {
      Alert.alert('Lỗi', err?.response?.data?.message || 'Không thể cập nhật');
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#FF6B35" /></View>;
  }

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Địa chỉ của tôi</Text>
        <TouchableOpacity onPress={() => router.push('/profile/address-form')}>
          <Ionicons name="add" size={24} color="#FF6B35" />
        </TouchableOpacity>
      </View>

      {addresses.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="location-outline" size={64} color="#E5E7EB" />
          <Text style={s.emptyTitle}>Chưa có địa chỉ nào</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => router.push('/profile/address-form')}>
            <Text style={s.addBtnText}>Thêm địa chỉ mới</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={item => item._id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View style={[s.addressCard, item.isDefault && s.addressCardDefault]}>
              <View style={s.addressTop}>
                <View style={s.addressIconWrap}>
                  <Ionicons
                    name={item.type === 'office' ? 'business-outline' : 'home-outline'}
                    size={18} color="#FF6B35"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.addressNameRow}>
                    <Text style={s.addressName}>{item.fullName}</Text>
                    {item.isDefault && (
                      <View style={s.defaultBadge}>
                        <Text style={s.defaultBadgeText}>Mặc định</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.addressPhone}>{item.phone}</Text>
                </View>
              </View>
              <Text style={s.addressDetail}>
                {[item.street||item.address, item.ward, item.district, item.province||item.city]
                  .filter(Boolean).join(', ')}
              </Text>
              <View style={s.addressActions}>
                {!item.isDefault && (
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => handleSetDefault(item._id)}
                  >
                    <Text style={s.actionBtnText}>Đặt mặc định</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => router.push({ pathname: '/profile/address-form', params: { id: item._id } })}
                >
                  <Ionicons name="pencil-outline" size={14} color="#6B7280" />
                  <Text style={s.actionBtnText}>Sửa</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => handleDelete(item._id, item.fullName)}
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  <Text style={[s.actionBtnText, { color: '#EF4444' }]}>Xóa</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListFooterComponent={
            <TouchableOpacity style={s.addMoreBtn} onPress={() => router.push('/profile/address-form')}>
              <Ionicons name="add-circle-outline" size={20} color="#FF6B35" />
              <Text style={s.addMoreText}>Thêm địa chỉ mới</Text>
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:               { flex: 1, backgroundColor: '#F9FAFB' },
  center:             { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  backBtn:            { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle:        { fontSize: 17, fontWeight: '700', color: '#111827' },
  emptyWrap:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle:         { fontSize: 16, fontWeight: '600', color: '#374151' },
  addBtn:             { backgroundColor: '#FF6B35', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  addBtnText:         { color: '#fff', fontWeight: '600' },
  addressCard:        { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  addressCardDefault: { borderColor: '#FF6B35', backgroundColor: '#FFF8F6' },
  addressTop:         { flexDirection: 'row', gap: 10, marginBottom: 8 },
  addressIconWrap:    { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF0EB', alignItems: 'center', justifyContent: 'center' },
  addressNameRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  addressName:        { fontSize: 14, fontWeight: '700', color: '#111827' },
  defaultBadge:       { backgroundColor: '#FF6B35', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  defaultBadgeText:   { color: '#fff', fontSize: 10, fontWeight: '600' },
  addressPhone:       { fontSize: 13, color: '#6B7280', marginTop: 2 },
  addressDetail:      { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 12 },
  addressActions:     { flexDirection: 'row', gap: 12, borderTopWidth: 0.5, borderTopColor: '#F3F4F6', paddingTop: 10 },
  actionBtn:          { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText:      { fontSize: 13, color: '#6B7280' },
  addMoreBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#FF6B35', borderStyle: 'dashed' },
  addMoreText:        { color: '#FF6B35', fontWeight: '600', fontSize: 14 },
});
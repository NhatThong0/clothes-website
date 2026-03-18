import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, RefreshControl, StatusBar, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/src/store/authStore';
import userApi from '@/src/api/userApi';

const TOKEN = { black: '#1A1A1A', surface: '#F5F5F0', border: '#E8E8E4', muted: '#AAAAAA', accent: '#ff0000' };

const ORDER_TABS = [
  { key: 'pending',   label: 'Chờ xác\nnhận',  icon: 'time-outline' },
  { key: 'confirmed', label: 'Đã xác\nnhận',   icon: 'checkmark-circle-outline' },
  { key: 'shipped',   label: 'Đang\ngiao',      icon: 'bicycle-outline' },
  { key: 'delivered', label: 'Đã\nnhận',        icon: 'bag-check-outline' },
];

export default function ProfileScreen() {
  const router           = useRouter();
  const { user, logout } = useAuthStore();
  const [counts, setCounts]         = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadCounts = async () => {
    try {
      const res = await Promise.all(
        ORDER_TABS.map(t => userApi.getMyOrders(1, 1, t.key))
      );
      const map: Record<string, number> = {};
      ORDER_TABS.forEach((t, i) => { map[t.key] = res[i].pagination.total; });
      setCounts(map);
    } catch {}
  };

  useEffect(() => { loadCounts(); }, []);

  const handleLogout = () =>
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: logout },
    ]);

  const initials = user?.name?.split(' ').map((w: string) => w[0]).slice(-2).join('').toUpperCase() || '?';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadCounts(); setRefreshing(false); }}
            tintColor={TOKEN.black}
          />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Tài khoản</Text>
        </View>

        {/* Profile card */}
        <TouchableOpacity
          style={s.profileCard}
          onPress={() => router.push('/profile/edit')}
          activeOpacity={0.88}
        >
          {/* Avatar: ảnh thật hoặc fallback initials */}
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={s.avatarImg} />
          ) : (
            <View style={s.avatarFallback}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={s.userName}>{user?.name}</Text>
            <Text style={s.userEmail}>{user?.email}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#CCC" />
        </TouchableOpacity>

        {/* Order status */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Đơn hàng</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
              <Text style={s.seeAll}>Xem tất cả →</Text>
            </TouchableOpacity>
          </View>
          <View style={s.orderGrid}>
            {ORDER_TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={s.orderItem}
                onPress={() => router.push({ pathname: '/(tabs)/orders', params: { status: tab.key } })}
              >
                <View style={s.orderIconWrap}>
                  <Ionicons name={tab.icon as any} size={22} color={TOKEN.black} />
                  {counts[tab.key] > 0 && (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{counts[tab.key]}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.orderLabel}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Menu */}
        <View style={s.section}>
          <Text style={s.menuGroupLabel}>Cá nhân</Text>
          <View style={s.menuCard}>
            <MenuItem icon="person-outline"      label="Thông tin cá nhân" onPress={() => router.push('/profile/edit')} />
            <MenuItem icon="location-outline"    label="Địa chỉ của tôi"   onPress={() => router.push('/profile/addresses')} />
            <MenuItem icon="lock-closed-outline" label="Đổi mật khẩu"      onPress={() => router.push('/profile/change-password')} last />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.menuGroupLabel}>Hỗ trợ</Text>
          <View style={s.menuCard}>
            <MenuItem icon="help-circle-outline"   label="Trung tâm hỗ trợ"   onPress={() => {}} />
            <MenuItem icon="document-text-outline" label="Điều khoản sử dụng" onPress={() => {}} last />
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={s.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function MenuItem({ icon, label, onPress, last }: {
  icon: string; label: string; onPress: () => void; last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[m.item, last && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={m.iconWrap}>
        <Ionicons name={icon as any} size={17} color={TOKEN.black} />
      </View>
      <Text style={m.label}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color="#CCC" />
    </TouchableOpacity>
  );
}

const AVATAR_SIZE = 52;

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#fff' },
  header:  { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  title:   { fontSize: 28, fontWeight: '900', color: TOKEN.black },

  profileCard:    {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, backgroundColor: TOKEN.surface,
    borderRadius: 18, padding: 16, marginBottom: 28,
  },
  /* Ảnh thật */
  avatarImg:      {
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  /* Fallback initials */
  avatarFallback: {
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: TOKEN.black,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 18, fontWeight: '800', color: '#fff' },
  userName:    { fontSize: 16, fontWeight: '800', color: TOKEN.black },
  userEmail:   { fontSize: 12, color: TOKEN.muted, marginTop: 2 },

  section:       { paddingHorizontal: 20, marginBottom: 24 },
  sectionRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle:  { fontSize: 16, fontWeight: '800', color: TOKEN.black },
  seeAll:        { fontSize: 12, fontWeight: '600', color: TOKEN.muted },
  orderGrid:     { flexDirection: 'row', backgroundColor: TOKEN.surface, borderRadius: 16, padding: 16 },
  orderItem:     { flex: 1, alignItems: 'center', gap: 8 },
  orderIconWrap: { position: 'relative' },
  badge:         {
    position: 'absolute', top: -5, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: TOKEN.black,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 2, borderColor: TOKEN.surface,
  },
  badgeText:     { fontSize: 8, fontWeight: '800', color: '#fff' },
  orderLabel:    { fontSize: 10, fontWeight: '600', color: TOKEN.muted, textAlign: 'center', lineHeight: 13 },

  menuGroupLabel:{ fontSize: 11, fontWeight: '700', color: TOKEN.muted, letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
  menuCard:      { backgroundColor: TOKEN.surface, borderRadius: 16, overflow: 'hidden' },
  logoutBtn:     { marginHorizontal: 20, backgroundColor: TOKEN.surface, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  logoutText:    { fontSize: 14, fontWeight: '700', color: '#EF4444' },
});

const m = StyleSheet.create({
  item:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
  iconWrap:{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  label:   { flex: 1, fontSize: 14, fontWeight: '600', color: TOKEN.black },
});
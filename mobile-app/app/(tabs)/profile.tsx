import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, RefreshControl, StatusBar, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/src/store/authStore';
import userApi from '@/src/api/userApi';
import type { LoyaltyInfo } from '@/src/api/authApi';

const TOKEN = { black: '#1A1A1A', surface: '#F5F5F0', border: '#E8E8E4', muted: '#AAAAAA', accent: '#ff0000' };

const ORDER_TABS = [
  { key: 'pending',   label: 'Chờ xác\nnhận',  icon: 'time-outline' },
  { key: 'confirmed', label: 'Đã xác\nnhận',   icon: 'checkmark-circle-outline' },
  { key: 'shipped',   label: 'Đang\ngiao',      icon: 'bicycle-outline' },
  { key: 'delivered', label: 'Đã\nnhận',        icon: 'bag-check-outline' },
];

export default function ProfileScreen() {
  const router           = useRouter();
  const { user, logout, setUser } = useAuthStore();
  const [counts, setCounts]         = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = async () => {
    try {
      const profile = await userApi.getProfile();
      setUser(profile);
    } catch {}
  };

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

  useEffect(() => {
    loadProfile();
    loadCounts();
  }, []);

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
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([loadProfile(), loadCounts()]);
              setRefreshing(false);
            }}
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

        {user?.role !== 'admin' && <LoyaltyCard loyalty={user?.loyalty} />}

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

function LoyaltyCard({ loyalty }: { loyalty?: LoyaltyInfo | null }) {
  const tier = loyalty?.tier;
  const nextTier = loyalty?.next_tier;
  const tierPoints = loyalty?.tier_points ?? 0;
  const spendablePoints = loyalty?.spendable_points ?? 0;
  const discountPercent = tier?.discount_percent ?? 0;
  const nextMinPoints = nextTier?.min_points ?? 0;
  const progress = nextMinPoints > 0 ? Math.min(100, (tierPoints / nextMinPoints) * 100) : 0;
  const pointsLeft = nextMinPoints > 0 ? Math.max(0, nextMinPoints - tierPoints) : 0;
  const accent = getTierAccent(tier?.icon_key || tier?.iconKey || tier?.icon || tier?.name);

  return (
    <View style={s.loyaltyCard}>
      <View style={s.loyaltyTopRow}>
        <View style={s.loyaltyMainInfo}>
          <View style={[s.loyaltyBadge, { backgroundColor: accent.soft, borderColor: accent.border }]}>
            <Ionicons name={accent.icon as any} size={28} color={accent.strong} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={s.loyaltyEyebrow}>Hạng thành viên</Text>
            <Text style={s.loyaltyTitle}>{tier?.name || 'Chưa co hang'}</Text>
            <Text style={s.loyaltySubtitle}>
              Hạng của bạn sẽ được cập nhật tự động theo điểm tích lũy.
            </Text>
          </View>
        </View>

        <View style={s.loyaltyBenefit}>
          <Text style={s.loyaltyEyebrow}>Ưu đãi</Text>
          <Text style={s.loyaltyPercent}>
            {discountPercent}
            <Text style={s.loyaltyPercentUnit}>%</Text>
          </Text>
        </View>
      </View>

      <View style={s.loyaltyStatsRow}>
        <View style={[s.loyaltyStatCol, s.loyaltyStatDivider]}>
          <Text style={s.loyaltyEyebrow}>Điểm xét hạng</Text>
          <Text style={s.loyaltyStatValue}>{tierPoints.toLocaleString('vi-VN')}</Text>
          <Text style={s.loyaltyStatHint}>Dùng để xét nâng hạng thành viên</Text>
        </View>

        <View style={s.loyaltyStatCol}>
          <Text style={s.loyaltyEyebrow}>Điểm dùng được</Text>
          <Text style={s.loyaltyStatValue}>{spendablePoints.toLocaleString('vi-VN')}</Text>
          <Text style={s.loyaltyStatHint}>Có thể sử dụng khi thanh toán đơn hàng</Text>
        </View>
      </View>

      {!!nextTier && nextMinPoints > 0 && (
        <View style={s.loyaltyProgressWrap}>
          <View style={s.loyaltyProgressHeader}>
            <Text style={s.loyaltyProgressText}>
              Tiến độ lên hạng <Text style={s.loyaltyProgressStrong}>{nextTier.name}</Text>
            </Text>
            <Text style={s.loyaltyProgressText}>
              {tierPoints.toLocaleString('vi-VN')} / {nextMinPoints.toLocaleString('vi-VN')}
            </Text>
          </View>

          <View style={s.loyaltyProgressTrack}>
            <View style={[s.loyaltyProgressBar, { width: `${progress}%`, backgroundColor: accent.strong }]} />
          </View>

          <Text style={s.loyaltyProgressHint}>
            Cần thêm {pointsLeft.toLocaleString('vi-VN')} điểm để đạt hạng tiếp theo
          </Text>
        </View>
      )}
    </View>
  );
}

function getTierAccent(rawTier?: string) {
  const tier = String(rawTier || '').toLowerCase();

  if (tier.includes('diamond')) {
    return { strong: '#5B5CE2', soft: '#EEF0FF', border: '#D8DCFF', icon: 'diamond-outline' };
  }
  if (tier.includes('platinum')) {
    return { strong: '#0F8FA6', soft: '#EAFBFF', border: '#C6EEF7', icon: 'sparkles-outline' };
  }
  if (tier.includes('gold')) {
    return { strong: '#B7791F', soft: '#FFF7DB', border: '#F6E3A3', icon: 'medal-outline' };
  }
  if (tier.includes('silver')) {
    return { strong: '#64748B', soft: '#F1F5F9', border: '#DDE5EE', icon: 'ribbon-outline' };
  }
  if (tier.includes('bronze')) {
    return { strong: '#B45309', soft: '#FFF1E6', border: '#F6D2B4', icon: 'flame-outline' };
  }

  return { strong: TOKEN.black, soft: '#F4F4EF', border: TOKEN.border, icon: 'star-outline' };
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

  loyaltyCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E6E8EE',
    backgroundColor: '#FCFCFA',
    overflow: 'hidden',
  },
  loyaltyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  loyaltyMainInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  loyaltyBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  loyaltyTitle: { fontSize: 22, fontWeight: '800', color: TOKEN.black },
  loyaltySubtitle: { marginTop: 6, fontSize: 12, lineHeight: 18, color: '#6B7280' },
  loyaltyBenefit: { minWidth: 74, alignItems: 'flex-end' },
  loyaltyPercent: { fontSize: 30, fontWeight: '800', color: TOKEN.black, lineHeight: 34 },
  loyaltyPercentUnit: { fontSize: 18, fontWeight: '700' },
  loyaltyStatsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E6E8EE',
    backgroundColor: '#FFFFFF',
  },
  loyaltyStatCol: { flex: 1, paddingHorizontal: 18, paddingVertical: 16 },
  loyaltyStatDivider: { borderRightWidth: 1, borderRightColor: '#E6E8EE' },
  loyaltyStatValue: { fontSize: 24, fontWeight: '800', color: TOKEN.black, marginBottom: 4 },
  loyaltyStatHint: { fontSize: 11, lineHeight: 16, color: '#9CA3AF' },
  loyaltyProgressWrap: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E6E8EE',
    backgroundColor: '#F8FAFC',
  },
  loyaltyProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  loyaltyProgressText: { flex: 1, fontSize: 12, color: '#6B7280' },
  loyaltyProgressStrong: { fontWeight: '700', color: '#374151' },
  loyaltyProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  loyaltyProgressBar: { height: '100%', borderRadius: 999 },
  loyaltyProgressHint: { marginTop: 8, fontSize: 11, color: '#9CA3AF' },

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

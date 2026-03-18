import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import userApi from '@/src/api/userApi';
import { Order, OrderStatus } from '@/src/api/orderApi';
import { formatPrice } from '@/src/api/productApi';

const TOKEN = { black: '#1A1A1A', surface: '#F5F5F0', border: '#E8E8E4', muted: '#AAAAAA', accent: '#ff0000' };

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '',          label: 'Tất cả' },
  { key: 'pending',   label: 'Chờ xác nhận' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'shipped',   label: 'Đang giao' },
  { key: 'delivered', label: 'Đã nhận' },
  { key: 'cancelled', label: 'Đã hủy' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending:          { bg: '#FEF3C7', text: '#92400E', label: 'Chờ xác nhận' },
  confirmed:        { bg: '#DBEAFE', text: '#1E40AF', label: 'Đã xác nhận' },
  processing:       { bg: '#EDE9FE', text: '#5B21B6', label: 'Đang xử lý' },
  shipped:          { bg: '#D1FAE5', text: '#065F46', label: 'Đang giao' },
  delivered:        { bg: '#D1FAE5', text: '#065F46', label: 'Đã nhận' },
  cancelled:        { bg: '#FEE2E2', text: '#991B1B', label: 'Đã hủy' },
  return_requested: { bg: '#FEE2E2', text: '#991B1B', label: 'Yêu cầu hoàn' },
  returned:         { bg: '#F3F4F6', text: '#374151', label: 'Đã hoàn' },
};

export default function OrdersScreen() {
  const router = useRouter();
  const { status: initStatus } = useLocalSearchParams<{ status?: string }>();

  const [orders, setOrders]           = useState<Order[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [activeTab, setActiveTab]     = useState(initStatus || '');
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchOrders = useCallback(async (p = 1, reset = true) => {
    try {
      if (p === 1) setLoading(true);
      else setLoadingMore(true);
      const res = await userApi.getMyOrders(p, 10, activeTab || undefined);
      if (reset || p === 1) setOrders(res.data);
      else setOrders(prev => [...prev, ...res.data]);
      setHasMore(p < res.pagination.pages);
      setPage(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchOrders(1, true); }, [fetchOrders]);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Đơn hàng</Text>
      </View>

      {/* ── Status tabs — View bọc cố định chiều cao, dùng ScrollView thay FlatList ── */}
      <View style={s.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabRow}
        >
          {STATUS_TABS.map(item => (
            <TouchableOpacity
              key={item.key}
              style={[s.tab, activeTab === item.key && s.tabActive]}
              onPress={() => setActiveTab(item.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, activeTab === item.key && s.tabTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={TOKEN.black} /></View>
      ) : orders.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="receipt-outline" size={64} color="#E5E7EB" />
          <Text style={s.emptyTitle}>Chưa có đơn hàng nào</Text>
          <TouchableOpacity style={s.shopBtn} onPress={() => router.push('/(tabs)/products')}>
            <Text style={s.shopBtnText}>Mua sắm ngay</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item._id}
          // Bỏ alignItems: 'center' — gây card bị thu hẹp chiều ngang
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchOrders(1); }}
              tintColor={TOKEN.black}
            />
          }
          onEndReached={() => { if (!loadingMore && hasMore) fetchOrders(page + 1, false); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={TOKEN.black} style={{ marginVertical: 16 }} />
              : null
          }
          renderItem={({ item }) => {
            const status = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
            return (
              <TouchableOpacity
                style={s.orderCard}
                onPress={() => router.push({ pathname: '/order/[id]', params: { id: item._id } })}
                activeOpacity={0.9}
              >
                <View style={s.orderTop}>
                  <Text style={s.orderId}>#{item._id.slice(-8).toUpperCase()}</Text>
                  <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[s.statusText, { color: status.text }]}>{status.label}</Text>
                  </View>
                </View>
                <Text style={s.orderDate}>
                  {new Date(item.createdAt).toLocaleDateString('vi-VN', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
                <View style={s.orderItems}>
                  {item.items.slice(0, 2).map((oi, i) => (
                    <Text key={i} style={s.orderItemText} numberOfLines={1}>
                      • {oi.name} x{oi.quantity}
                    </Text>
                  ))}
                  {item.items.length > 2 && (
                    <Text style={s.orderItemMore}>+{item.items.length - 2} sản phẩm khác</Text>
                  )}
                </View>
                <View style={s.orderBottom}>
                  <Text style={s.orderTotal}>{formatPrice(item.total)}</Text>
                  <TouchableOpacity
                    style={s.detailBtn}
                    onPress={() => router.push({ pathname: '/order/[id]', params: { id: item._id } })}
                  >
                    <Text style={s.detailBtnText}>Chi tiết</Text>
                    <Ionicons name="chevron-forward" size={14} color="#FF6B35" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:      {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },

  /* ── Tab bar ──
     View wrapper với height cố định ngăn chip bị cắt,
     ScrollView thay FlatList để tránh overflow bị clip cứng */
  tabBarWrapper: {
    height: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: TOKEN.border,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab:           {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 24,
    backgroundColor: TOKEN.surface,
    alignSelf: 'center',   // căn giữa dọc trong ScrollView
  },
  tabActive:     { backgroundColor: TOKEN.black },
  tabText:       { fontSize: 13, fontWeight: '600', color: TOKEN.muted },
  tabTextActive: { color: '#fff' },

  /* ── Empty ── */
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  shopBtn:    {
    backgroundColor: TOKEN.black,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  shopBtnText: { color: '#fff', fontWeight: '600' },

  /* ── Order card ── */
  orderCard:     {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  orderTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderId:       { fontSize: 14, fontWeight: '700', color: '#111827' },
  statusBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:    { fontSize: 11, fontWeight: '600' },
  orderDate:     { fontSize: 12, color: '#9CA3AF', marginBottom: 10 },
  orderItems:    { gap: 3, marginBottom: 12 },
  orderItemText: { fontSize: 13, color: '#6B7280' },
  orderItemMore: { fontSize: 12, color: '#9CA3AF' },
  orderBottom:   {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  orderTotal:    { fontSize: 16, fontWeight: '800', color: '#FF6B35' },
  detailBtn:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailBtnText: { fontSize: 13, color: '#FF6B35', fontWeight: '600' },
});
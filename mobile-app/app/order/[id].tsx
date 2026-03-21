import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import userApi from '@/src/api/userApi';
import { Order } from '@/src/api/orderApi';
import { formatPrice } from '@/src/api/productApi';

const STATUS_STEPS = ['pending', 'confirmed', 'shipped', 'delivered'];

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  pending:          { label: 'Chờ xác nhận', color: '#92400E', bg: '#FEF3C7' },
  confirmed:        { label: 'Đã xác nhận',  color: '#1E40AF', bg: '#DBEAFE' },

  shipped:          { label: 'Đang giao',     color: '#065F46', bg: '#D1FAE5' },
  delivered:        { label: 'Đã giao',       color: '#065F46', bg: '#D1FAE5' },
  cancelled:        { label: 'Đã hủy',        color: '#991B1B', bg: '#FEE2E2' },
  return_requested: { label: 'Yêu cầu hoàn', color: '#991B1B', bg: '#FEE2E2' },
  returned:         { label: 'Đã hoàn trả',  color: '#374151', bg: '#F3F4F6' },
};

export default function OrderDetailScreen() {
  const router         = useRouter();
  const { id }         = useLocalSearchParams<{ id: string }>();
  const [order, setOrder]   = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    userApi.getOrderById(id)
      .then(setOrder)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleCancel = () => {
    Alert.alert('Hủy đơn hàng', 'Bạn có chắc muốn hủy đơn hàng này?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy đơn', style: 'destructive',
        onPress: async () => {
          try {
            setCancelling(true);
            const updated = await userApi.cancelOrder(id!);
            setOrder(updated);
            Alert.alert('Thành công', 'Đơn hàng đã được hủy');
          } catch (err: any) {
            Alert.alert('Lỗi', err?.response?.data?.message || 'Không thể hủy đơn');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#FF6B35" /></View>;
  if (!order)  return <View style={s.center}><Text>Không tìm thấy đơn hàng</Text></View>;

  const statusInfo = STATUS_INFO[order.status] || STATUS_INFO.pending;
  const stepIndex  = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Chi tiết đơn hàng</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>

        {/* Order ID + status */}
        <View style={s.card}>
          <View style={s.orderTopRow}>
            <View>
              <Text style={s.orderId}>#{order._id.slice(-8).toUpperCase()}</Text>
              <Text style={s.orderDate}>
                {new Date(order.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[s.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          </View>

          {/* Progress steps */}
          {!isCancelled && (
            <View style={s.steps}>
              {STATUS_STEPS.map((step, i) => (
                <React.Fragment key={step}>
                  <View style={s.stepItem}>
                    <View style={[s.stepDot, i <= stepIndex && s.stepDotActive]}>
                      {i <= stepIndex && <Ionicons name="checkmark" size={10} color="#fff" />}
                    </View>
                  </View>
                  {i < STATUS_STEPS.length - 1 && (
                    <View style={[s.stepLine, i < stepIndex && s.stepLineActive]} />
                  )}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* Shipping address */}
        <Section title="Địa chỉ giao hàng" icon="location-outline">
          <Text style={s.infoText}>{order.shippingAddress.fullName}</Text>
          <Text style={s.infoSub}>{order.shippingAddress.phone}</Text>
          <Text style={s.infoSub}>
            {[order.shippingAddress.street, order.shippingAddress.district, order.shippingAddress.city]
              .filter(Boolean).join(', ')}
          </Text>
        </Section>

        {/* Items */}
        <Section title="Sản phẩm" icon="bag-outline">
          {order.items.map((item, i) => (
            <View key={i} style={s.itemRow}>
              <View style={s.itemInfo}>
                <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
                {(item.color || item.size) && (
                  <Text style={s.itemVariant}>{[item.color, item.size].filter(Boolean).join(' / ')}</Text>
                )}
              </View>
              <Text style={s.itemQty}>x{item.quantity}</Text>
              <Text style={s.itemPrice}>{formatPrice(item.price * item.quantity)}</Text>
            </View>
          ))}
        </Section>

        {/* Payment */}
        <Section title="Thanh toán" icon="card-outline">
          <InfoRow label="Phương thức" value={order.paymentMethod === 'cod' ? 'Tiền mặt khi nhận' : 'VNPay'} />
          <InfoRow label="Trạng thái" value={order.paymentStatus === 'completed' ? 'Đã thanh toán' : 'Chưa thanh toán'} />
          <View style={s.divider} />
          <InfoRow label="Tạm tính"    value={formatPrice(order.subtotal)} />
          <InfoRow label="Phí vận chuyển" value={order.shippingFee === 0 ? 'Miễn phí' : formatPrice(order.shippingFee)} />
          {order.discountAmount > 0 && (
            <InfoRow label="Giảm giá" value={`-${formatPrice(order.discountAmount)}`} valueColor="#10B981" />
          )}
          <View style={s.divider} />
          <InfoRow label="Tổng cộng" value={formatPrice(order.total)} bold />
        </Section>

        {/* Cancel button */}
        {order.status === 'pending' && (
          <TouchableOpacity
            style={[s.cancelBtn, cancelling && { opacity: 0.7 }]}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling
              ? <ActivityIndicator color="#EF4444" />
              : <>
                  <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                  <Text style={s.cancelBtnText}>Hủy đơn hàng</Text>
                </>
            }
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.sectionHeader}>
        <Ionicons name={icon as any} size={16} color="#FF6B35" />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value, bold, valueColor }: {
  label: string; value: string; bold?: boolean; valueColor?: string;
}) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, bold && { fontWeight: '700', color: '#FF6B35', fontSize: 15 }, valueColor ? { color: valueColor } : {}]}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#F9FAFB' },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  backBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: 17, fontWeight: '700', color: '#111827' },
  card:          { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  orderTopRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  orderId:       { fontSize: 16, fontWeight: '700', color: '#111827' },
  orderDate:     { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  statusBadge:   { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusText:    { fontSize: 12, fontWeight: '600' },
  steps:         { flexDirection: 'row', alignItems: 'center' },
  stepItem:      { alignItems: 'center' },
  stepDot:       { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#FF6B35' },
  stepLine:      { flex: 1, height: 2, backgroundColor: '#E5E7EB' },
  stepLineActive:{ backgroundColor: '#FF6B35' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: '#111827' },
  infoText:      { fontSize: 14, fontWeight: '600', color: '#111827' },
  infoSub:       { fontSize: 13, color: '#6B7280', marginTop: 2 },
  itemRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  itemInfo:      { flex: 1 },
  itemName:      { fontSize: 13, color: '#374151', fontWeight: '500' },
  itemVariant:   { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  itemQty:       { fontSize: 13, color: '#9CA3AF', minWidth: 28 },
  itemPrice:     { fontSize: 13, fontWeight: '600', color: '#111827' },
  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  infoLabel:     { fontSize: 13, color: '#6B7280' },
  infoValue:     { fontSize: 13, color: '#374151', fontWeight: '500' },
  divider:       { height: 0.5, backgroundColor: '#E5E7EB', marginVertical: 6 },
  cancelBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#FECACA' },
  cancelBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
});
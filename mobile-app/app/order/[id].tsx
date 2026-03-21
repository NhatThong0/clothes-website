import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image, TextInput, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import userApi from '@/src/api/userApi';
import { orderApi, Order } from '@/src/api/orderApi';
import { paymentApi } from '@/src/api/paymentApi';
import { cartApi } from '@/src/api/cartApi';
import { formatPrice } from '@/src/api/productApi';
import api from '@/src/api/axiosConfig';

// ─────────────────────────────────────────────────────────────────────────────
const STATUS_STEPS = ['pending', 'confirmed', 'shipped', 'delivered'];
const RETURN_WINDOW_DAYS = 5;

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  pending:          { label: 'Chờ xác nhận',          color: '#92400E', bg: '#FEF3C7' },
  confirmed:        { label: 'Đã xác nhận',            color: '#1E40AF', bg: '#DBEAFE' },
  shipped:          { label: 'Đang giao',              color: '#065F46', bg: '#D1FAE5' },
  delivered:        { label: 'Đã giao',                color: '#065F46', bg: '#D1FAE5' },
  cancelled:        { label: 'Đã hủy',                 color: '#991B1B', bg: '#FEE2E2' },
  return_requested: { label: 'Chờ xác nhận hoàn trả', color: '#9A3412', bg: '#FFF7ED' },
  returned:         { label: 'Đã hoàn trả',            color: '#374151', bg: '#F3F4F6' },
};

const RETURN_REASONS = [
  'Sản phẩm bị lỗi', 'Không đúng mô tả',
  'Sai size / màu',  'Hàng giả mạo',
  'Hư hỏng vận chuyển', 'Lý do khác',
];

// ─────────────────────────────────────────────────────────────────────────────
// Review Modal
// ─────────────────────────────────────────────────────────────────────────────
function ReviewModal({
  visible, order, onClose, onDone,
}: { visible: boolean; order: Order; onClose: () => void; onDone: () => void }) {
  const [selectedItem, setSelectedItem] = useState(0);
  const [rating,       setRating]       = useState(5);
  const [comment,      setComment]      = useState('');
  const [submitting,   setSubmitting]   = useState(false);

  const item = order.items[selectedItem];

  const handleSubmit = async () => {
    if (!comment.trim()) { Alert.alert('Thiếu nội dung', 'Vui lòng nhập nhận xét'); return; }
    try {
      setSubmitting(true);
      const productId = (item as any).productId?._id || (item as any).productId;
      await api.post(`/products/${productId}/reviews`, { rating, comment: comment.trim() });
      Alert.alert('Thành công', 'Cảm ơn bạn đã đánh giá!');
      setComment(''); setRating(5);
      onDone(); onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.response?.data?.message || 'Không thể gửi đánh giá');
    } finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={rm.overlay}>
        <View style={rm.sheet}>
          <View style={rm.header}>
            <Text style={rm.title}>Đánh giá sản phẩm</Text>
            <TouchableOpacity onPress={onClose} style={rm.closeBtn}>
              <Ionicons name="close" size={20} color="#111827" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {order.items.length > 1 && (
              <View>
                <Text style={rm.label}>Chọn sản phẩm</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {order.items.map((it, i) => (
                    <TouchableOpacity key={i}
                      style={[rm.chip, selectedItem === i && rm.chipActive]}
                      onPress={() => setSelectedItem(i)}>
                      <Text style={[rm.chipText, selectedItem === i && rm.chipTextActive]}
                        numberOfLines={1}>{it.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <View style={rm.productRow}>
              <View style={rm.productDot} />
              <Text style={rm.productName} numberOfLines={2}>{item.name}</Text>
            </View>
            <View>
              <Text style={rm.label}>Số sao</Text>
              <View style={rm.stars}>
                {[1, 2, 3, 4, 5].map(s => (
                  <TouchableOpacity key={s} onPress={() => setRating(s)} style={rm.starBtn}>
                    <Ionicons
                      name={s <= rating ? 'star' : 'star-outline'}
                      size={34} color={s <= rating ? '#F59E0B' : '#E5E7EB'} />
                  </TouchableOpacity>
                ))}
                <Text style={rm.ratingLabel}>
                  {['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Xuất sắc'][rating]}
                </Text>
              </View>
            </View>
            <View>
              <Text style={rm.label}>Nhận xét</Text>
              <TextInput style={rm.input}
                placeholder="Chia sẻ trải nghiệm của bạn..."
                placeholderTextColor="#9CA3AF"
                value={comment} onChangeText={setComment}
                multiline numberOfLines={4} textAlignVertical="top" />
            </View>
          </ScrollView>
          <View style={rm.footer}>
            <TouchableOpacity style={rm.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={rm.cancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[rm.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={rm.submitText}>Gửi đánh giá</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Return Modal
// ─────────────────────────────────────────────────────────────────────────────
function ReturnModal({
  visible, orderId, onClose, onDone,
}: { visible: boolean; orderId: string; onClose: () => void; onDone: () => void }) {
  const [reason,     setReason]     = useState('');
  const [images,     setImages]     = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    if (images.length >= 5) { Alert.alert('Tối đa 5 ảnh'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const uris = result.assets.slice(0, 5 - images.length).map(a => a.uri);
      setImages(p => [...p, ...uris]);
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) { Alert.alert('Thiếu thông tin', 'Vui lòng chọn lý do hoàn trả'); return; }
    if (images.length === 0) { Alert.alert('Thiếu ảnh', 'Vui lòng đính kèm ít nhất 1 ảnh'); return; }
    setSubmitting(true);
    try {
      const uploadedUrls: string[] = [];
      for (const uri of images) {
        const formData = new FormData();
        formData.append('image', { uri, type: 'image/jpeg', name: `return_${Date.now()}.jpg` } as any);
        const res = await api.post('/upload/return-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedUrls.push(res.data.url);
      }
      await api.post(`/orders/${orderId}/return-request`, { reason, images: uploadedUrls });
      Alert.alert('Đã gửi', 'Yêu cầu hoàn trả đã được gửi. Admin sẽ xem xét trong 1–3 ngày.');
      setReason(''); setImages([]);
      onDone(); onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.response?.data?.message || 'Không thể gửi yêu cầu hoàn trả');
    } finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={rtm.overlay}>
        <View style={rtm.sheet}>
          <View style={rtm.header}>
            <Text style={rtm.title}>Yêu cầu hoàn trả</Text>
            <TouchableOpacity onPress={onClose} style={rtm.closeBtn} disabled={submitting}>
              <Ionicons name="close" size={20} color="#111827" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View>
              <Text style={rtm.label}>Lý do <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <View style={rtm.reasonGrid}>
                {RETURN_REASONS.map(r => (
                  <TouchableOpacity key={r}
                    style={[rtm.reasonChip, reason === r && rtm.reasonChipActive]}
                    onPress={() => setReason(r)}>
                    <Text style={[rtm.reasonText, reason === r && rtm.reasonTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={rtm.input}
                placeholder="Hoặc mô tả chi tiết hơn..."
                placeholderTextColor="#9CA3AF"
                value={reason} onChangeText={setReason}
                multiline numberOfLines={2} textAlignVertical="top" />
            </View>
            <View>
              <Text style={rtm.label}>
                Ảnh minh chứng <Text style={{ color: '#EF4444' }}>*</Text>
                <Text style={{ color: '#9CA3AF', fontWeight: '400' }}> ({images.length}/5)</Text>
              </Text>
              <View style={rtm.imageRow}>
                {images.map((uri, i) => (
                  <View key={i} style={rtm.imgWrap}>
                    <Image source={{ uri }} style={rtm.img} />
                    <TouchableOpacity style={rtm.imgRemove}
                      onPress={() => setImages(p => p.filter((_, idx) => idx !== i))}>
                      <Ionicons name="close-circle" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < 5 && (
                  <TouchableOpacity style={rtm.addImg} onPress={pickImage}>
                    <Ionicons name="camera-outline" size={22} color="#9CA3AF" />
                    <Text style={rtm.addImgText}>Thêm ảnh</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={rtm.flowBox}>
              <Text style={rtm.flowTitle}>📋 Quy trình hoàn trả</Text>
              {['Gửi yêu cầu kèm ảnh', 'Admin xác nhận (1–3 ngày)', 'Gửi hàng — Admin xác nhận nhận'].map((step, i) => (
                <View key={i} style={rtm.flowRow}>
                  <View style={rtm.flowDot}><Text style={rtm.flowNum}>{i + 1}</Text></View>
                  <Text style={rtm.flowText}>{step}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={rtm.footer}>
            <TouchableOpacity style={rtm.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={rtm.cancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[rtm.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={rtm.submitText}>Gửi yêu cầu</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order,        setOrder]        = useState<Order | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [cancelling,   setCancelling]   = useState(false);
  const [reordering,   setReordering]   = useState(false);
  const [retryLoading, setRetryLoading] = useState(false);
  const [showReview,   setShowReview]   = useState(false);
  const [showReturn,   setShowReturn]   = useState(false);

  const fetchOrder = () => {
    if (!id) return;
    userApi.getOrderById(id)
      .then(setOrder)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrder(); }, [id]);

  const handleCancel = () => {
    Alert.alert('Hủy đơn hàng', 'Bạn có chắc muốn hủy đơn hàng này?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy đơn', style: 'destructive',
        onPress: async () => {
          try {
            setCancelling(true);
            await orderApi.cancelOrder(id!);
            fetchOrder();
            Alert.alert('Thành công', 'Đơn hàng đã được hủy');
          } catch (err: any) {
            Alert.alert('Lỗi', err?.response?.data?.message || 'Không thể hủy đơn');
          } finally { setCancelling(false); }
        },
      },
    ]);
  };

  const handleReorder = () => {
    if (!order) return;
    Alert.alert('Mua lại', 'Thêm tất cả sản phẩm vào giỏ hàng?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Thêm vào giỏ',
        onPress: async () => {
          try {
            setReordering(true);
            for (const item of order.items) {
              const productId = (item as any).productId?._id || (item as any).productId;
              await cartApi.addToCart(productId, item.quantity, item.color || '', item.size || '');
            }
            Alert.alert('Đã thêm', 'Bạn có muốn đến giỏ hàng không?', [
              { text: 'Ở lại', style: 'cancel' },
              { text: 'Xem giỏ hàng', onPress: () => router.push('/(tabs)/cart') },
            ]);
          } catch (err: any) {
            Alert.alert('Lỗi', err?.response?.data?.message || 'Không thể thêm vào giỏ');
          } finally { setReordering(false); }
        },
      },
    ]);
  };

  const handleRetryPayment = async () => {
    if (!order) return;
    try {
      setRetryLoading(true);
      const paymentUrl = await paymentApi.createVnpayUrl(order._id);
      await WebBrowser.openBrowserAsync(paymentUrl, {
        dismissButtonStyle: 'close',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        toolbarColor: '#FFFFFF',
        showTitle: true,
      });
      Alert.alert('Kiểm tra thanh toán', 'Thanh toán đã hoàn tất chưa?', [
        { text: 'Đã thanh toán',  onPress: fetchOrder },
        { text: 'Chưa / Thử lại', style: 'cancel' },
      ]);
    } catch (err: any) {
      Alert.alert('Lỗi', err?.response?.data?.message || 'Không thể mở trang thanh toán');
    } finally { setRetryLoading(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#FF6B35" /></View>;
  if (!order)  return <View style={s.center}><Text style={{ color: '#6B7280' }}>Không tìm thấy đơn hàng</Text></View>;

  const statusInfo    = STATUS_INFO[order.status] || STATUS_INFO.pending;
  const stepIndex     = STATUS_STEPS.indexOf(order.status);
  const isCancelled   = order.status === 'cancelled';
  const isReturn      = order.status === 'return_requested' || order.status === 'returned';
  const isPaid        = order.paymentStatus === 'completed';
  const deliveredAt   = (order as any).deliveredAt;
  const canReturn     = order.status === 'delivered' && deliveredAt
    && (Date.now() - new Date(deliveredAt).getTime()) / 86400000 <= RETURN_WINDOW_DAYS;
  const daysLeft      = deliveredAt
    ? Math.max(0, RETURN_WINDOW_DAYS - Math.floor((Date.now() - new Date(deliveredAt).getTime()) / 86400000))
    : null;
  const isVnpayUnpaid = order.paymentMethod === 'vnpay' && !isPaid
    && !isCancelled && order.status !== 'returned';

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Chi tiết đơn hàng</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>

        {/* Status card */}
        <View style={s.card}>
          <View style={s.orderTopRow}>
            <View>
              <Text style={s.orderId}>#{order._id.slice(-8).toUpperCase()}</Text>
              <Text style={s.orderDate}>
                {new Date(order.createdAt).toLocaleDateString('vi-VN', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[s.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          </View>

          {/* Stepper */}
          {!isCancelled && !isReturn && (
            <View style={s.steps}>
              {STATUS_STEPS.map((step, i) => (
                <React.Fragment key={step}>
                  <View style={s.stepItem}>
                    <View style={[s.stepDot, i <= stepIndex && s.stepDotActive]}>
                      {i <= stepIndex
                        ? <Ionicons name="checkmark" size={10} color="#fff" />
                        : <Text style={s.stepNum}>{i + 1}</Text>}
                    </View>
                    <Text style={[s.stepLabel, i <= stepIndex && s.stepLabelActive]} numberOfLines={2}>
                      {STATUS_INFO[step]?.label || step}
                    </Text>
                  </View>
                  {i < STATUS_STEPS.length - 1 && (
                    <View style={[s.stepLine, i < stepIndex && s.stepLineActive]} />
                  )}
                </React.Fragment>
              ))}
            </View>
          )}

          {/* Return flow */}
          {isReturn && (
            <View style={s.returnFlow}>
              <View style={s.returnDoneRow}>
                <View style={s.returnDoneDot}><Ionicons name="checkmark" size={10} color="#fff" /></View>
                <Text style={s.returnDoneText}>Đã giao thành công</Text>
              </View>
              <View style={{ paddingLeft: 8, marginVertical: 2 }}>
                <Ionicons name="arrow-down" size={12} color="#9CA3AF" />
              </View>
              <View style={[s.returnStatusRow, { backgroundColor: statusInfo.bg }]}>
                <Text style={[s.returnStatusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                <Text style={s.returnStatusSub}>
                  {order.status === 'return_requested'
                    ? 'Admin đang xem xét. Sau khi xác nhận, vui lòng gửi hàng về.'
                    : 'Admin đã nhận hàng. Hoàn trả hoàn tất.'}
                </Text>
              </View>
            </View>
          )}

          {/* Payment badge */}
          <View style={s.payRow}>
            <View style={[s.payBadge, { backgroundColor: isPaid ? '#D1FAE5' : '#FEF3C7' }]}>
              <Ionicons name={isPaid ? 'checkmark-circle' : 'time-outline'} size={12}
                color={isPaid ? '#10B981' : '#F59E0B'} />
              <Text style={[s.payBadgeText, { color: isPaid ? '#065F46' : '#92400E' }]}>
                {isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
              </Text>
            </View>
            <Text style={s.payMethod}>
              {order.paymentMethod === 'cod' ? 'COD' : order.paymentMethod.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* VNPay unpaid banner */}
        {isVnpayUnpaid && (
          <View style={s.vnpayBanner}>
            <View style={s.vnpayLeft}>
              <Ionicons name="alert-circle" size={20} color="#F59E0B" />
              <View>
                <Text style={s.vnpayTitle}>Đơn hàng chưa thanh toán</Text>
                <Text style={s.vnpaySub}>Vui lòng thanh toán để xác nhận đơn</Text>
              </View>
            </View>
            <TouchableOpacity style={[s.vnpayBtn, retryLoading && { opacity: 0.6 }]}
              onPress={handleRetryPayment} disabled={retryLoading}>
              {retryLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.vnpayBtnText}>Thanh toán</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Return countdown */}
        {order.status === 'delivered' && (
          <View style={[s.returnBanner, { backgroundColor: canReturn ? '#FFF7ED' : '#F9FAFB' }]}>
            <Ionicons name="time-outline" size={15} color={canReturn ? '#F59E0B' : '#9CA3AF'} />
            <Text style={[s.returnBannerText, { color: canReturn ? '#92400E' : '#9CA3AF' }]}>
              {canReturn ? `Còn ${daysLeft} ngày để yêu cầu hoàn trả` : 'Đã hết hạn hoàn trả (5 ngày)'}
            </Text>
          </View>
        )}

        {/* Shipping */}
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
          <InfoRow label="Phương thức"
            value={order.paymentMethod === 'cod' ? 'Tiền mặt khi nhận' : order.paymentMethod.toUpperCase()} />
          <InfoRow label="Trạng thái"
            value={isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
            valueColor={isPaid ? '#10B981' : '#F59E0B'} />
          <View style={s.divider} />
          <InfoRow label="Tạm tính"       value={formatPrice(order.subtotal)} />
          <InfoRow label="Phí vận chuyển"
            value={order.shippingFee === 0 ? 'Miễn phí' : formatPrice(order.shippingFee)} />
          {order.discountAmount > 0 && (
            <InfoRow label="Giảm giá"
              value={`-${formatPrice(order.discountAmount)}`} valueColor="#10B981" />
          )}
          <View style={s.divider} />
          <InfoRow label="Tổng cộng" value={formatPrice(order.total)} bold />
        </Section>

        {/* Action buttons */}
        <View style={s.actionsCol}>
          {order.status === 'pending' && (
            <ActionBtn icon="close-circle-outline" label="Hủy đơn hàng"
              color="#EF4444" bg="#FEF2F2" border="#FECACA"
              onPress={handleCancel} loading={cancelling} />
          )}
          {['delivered', 'confirmed', 'returned', 'cancelled'].includes(order.status) && (
            <ActionBtn icon="refresh-outline" label="Mua lại"
              color="#374151" bg="#F9FAFB" border="#E5E7EB"
              onPress={handleReorder} loading={reordering} />
          )}
          {order.status === 'delivered' && (
            <ActionBtn icon="star-outline" label="Viết đánh giá"
              color="#D97706" bg="#FFFBEB" border="#FDE68A"
              onPress={() => setShowReview(true)} />
          )}
          {order.status === 'delivered' && canReturn && (
            <ActionBtn
              icon="return-down-back-outline"
              label={`Yêu cầu hoàn trả${daysLeft !== null ? ` (còn ${daysLeft} ngày)` : ''}`}
              color="#FF6B35" bg="#FFF7ED" border="#FED7AA"
              onPress={() => setShowReturn(true)} />
          )}
          {isVnpayUnpaid && (
            <ActionBtn icon="card-outline" label="Tiếp tục thanh toán VNPay"
              color="#fff" bg="#3B82F6" border="#3B82F6"
              onPress={handleRetryPayment} loading={retryLoading} />
          )}
        </View>

        {/* Return reason */}
        {isReturn && (order as any).returnReason && (
          <View style={s.card}>
            <Text style={s.returnReasonLabel}>Lý do hoàn trả</Text>
            <Text style={s.returnReasonText}>{(order as any).returnReason}</Text>
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      {showReview && (
        <ReviewModal visible={showReview} order={order}
          onClose={() => setShowReview(false)} onDone={fetchOrder} />
      )}
      {showReturn && (
        <ReturnModal visible={showReturn} orderId={order._id}
          onClose={() => setShowReturn(false)} onDone={fetchOrder} />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
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

function ActionBtn({ icon, label, color, bg, border, onPress, loading }: {
  icon: string; label: string; color: string; bg: string;
  border: string; onPress: () => void; loading?: boolean;
}) {
  return (
    <TouchableOpacity style={[s.actionBtn, { backgroundColor: bg, borderColor: border }]}
      onPress={onPress} disabled={loading} activeOpacity={0.75}>
      {loading
        ? <ActivityIndicator color={color} size="small" />
        : <>
            <Ionicons name={icon as any} size={16} color={color} />
            <Text style={[s.actionBtnText, { color }]}>{label}</Text>
          </>}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#F9FAFB' },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },

  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  orderTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  orderId:     { fontSize: 16, fontWeight: '700', color: '#111827' },
  orderDate:   { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusText:  { fontSize: 12, fontWeight: '600' },

  steps:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  stepItem:      { alignItems: 'center', flex: 1 },
  stepDot:       { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stepDotActive: { backgroundColor: '#FF6B35' },
  stepNum:       { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
  stepLine:      { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginTop: 10, marginHorizontal: 2 },
  stepLineActive:{ backgroundColor: '#FF6B35' },
  stepLabel:     { fontSize: 9, color: '#9CA3AF', textAlign: 'center', lineHeight: 13 },
  stepLabelActive: { color: '#FF6B35', fontWeight: '600' },

  returnFlow:       { marginTop: 4 },
  returnDoneRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  returnDoneDot:    { width: 18, height: 18, borderRadius: 9, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  returnDoneText:   { fontSize: 12, color: '#10B981', fontWeight: '600' },
  returnStatusRow:  { padding: 12, borderRadius: 12 },
  returnStatusLabel:{ fontSize: 13, fontWeight: '700' },
  returnStatusSub:  { fontSize: 11, color: '#78716C', marginTop: 3, lineHeight: 16 },

  payRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  payBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  payBadgeText: { fontSize: 11, fontWeight: '600' },
  payMethod:    { fontSize: 11, color: '#9CA3AF' },

  vnpayBanner: { backgroundColor: '#FEF3C7', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderWidth: 1, borderColor: '#FDE68A' },
  vnpayLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  vnpayTitle:  { fontSize: 13, fontWeight: '700', color: '#92400E' },
  vnpaySub:    { fontSize: 11, color: '#92400E', marginTop: 1 },
  vnpayBtn:    { backgroundColor: '#3B82F6', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  vnpayBtnText:{ color: '#fff', fontSize: 12, fontWeight: '700' },

  returnBanner:    { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  returnBannerText:{ fontSize: 12, fontWeight: '600' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: '#111827' },

  infoText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  infoSub:  { fontSize: 13, color: '#6B7280', marginTop: 2 },

  itemRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  itemInfo:    { flex: 1 },
  itemName:    { fontSize: 13, color: '#374151', fontWeight: '500' },
  itemVariant: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  itemQty:     { fontSize: 13, color: '#9CA3AF', minWidth: 28 },
  itemPrice:   { fontSize: 13, fontWeight: '600', color: '#111827' },

  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 13, color: '#374151', fontWeight: '500' },
  divider:   { height: 0.5, backgroundColor: '#E5E7EB', marginVertical: 6 },

  actionsCol:    { gap: 10 },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  actionBtnText: { fontSize: 14, fontWeight: '700' },

  returnReasonLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  returnReasonText:  { fontSize: 13, color: '#78716C', lineHeight: 20 },
});

const rm = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  title:       { fontSize: 16, fontWeight: '800', color: '#111827' },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  label:       { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  chip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F9FAFB', marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive:  { backgroundColor: '#111827', borderColor: '#111827' },
  chipText:    { fontSize: 12, color: '#9CA3AF', maxWidth: 120 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  productRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF6B35' },
  productName: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  stars:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  starBtn:     { padding: 4 },
  ratingLabel: { fontSize: 13, color: '#9CA3AF', marginLeft: 8, fontWeight: '600' },
  input:       { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, fontSize: 14, color: '#111827', minHeight: 90 },
  footer:      { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 0.5, borderTopColor: '#F3F4F6' },
  cancelBtn:   { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center' },
  cancelText:  { fontSize: 14, fontWeight: '600', color: '#374151' },
  submitBtn:   { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center' },
  submitText:  { fontSize: 14, fontWeight: '700', color: '#fff' },
});

const rtm = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:           { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  title:           { fontSize: 16, fontWeight: '800', color: '#111827' },
  closeBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  label:           { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  reasonGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  reasonChip:      { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  reasonChipActive:{ backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  reasonText:      { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  reasonTextActive:{ color: '#fff' },
  input:           { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, fontSize: 13, color: '#111827', minHeight: 60 },
  imageRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imgWrap:         { width: 72, height: 72, position: 'relative' },
  img:             { width: 72, height: 72, borderRadius: 10 },
  imgRemove:       { position: 'absolute', top: -6, right: -6 },
  addImg:          { width: 72, height: 72, borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addImgText:      { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
  flowBox:         { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, gap: 8 },
  flowTitle:       { fontSize: 12, fontWeight: '700', color: '#1E40AF', marginBottom: 4 },
  flowRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flowDot:         { width: 18, height: 18, borderRadius: 9, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },
  flowNum:         { fontSize: 10, color: '#fff', fontWeight: '700' },
  flowText:        { fontSize: 12, color: '#1E40AF', flex: 1 },
  footer:          { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 0.5, borderTopColor: '#F3F4F6' },
  cancelBtn:       { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center' },
  cancelText:      { fontSize: 14, fontWeight: '600', color: '#374151' },
  submitBtn:       { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#FF6B35', alignItems: 'center' },
  submitText:      { fontSize: 14, fontWeight: '700', color: '#fff' },
});
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, StatusBar, Modal, FlatList, BackHandler,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cartApi } from '@/src/api/cartApi';
import { orderApi, ShippingAddress } from '@/src/api/orderApi';
import { paymentApi } from '@/src/api/paymentApi';
import { formatPrice, getDiscountedPrice } from '@/src/api/productApi';
import { useAuthStore } from '@/src/store/authStore';
import userApi, { Address } from '@/src/api/userApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import api from '@/src/api/axiosConfig';

const TOKEN = { black: '#1A1A1A', surface: '#F5F5F0', border: '#E8E8E4', muted: '#AAAAAA' };
type PaymentMethod = 'cod' | 'vnpay';
type AddressMode   = 'saved' | 'new';

// ── Voucher types ─────────────────────────────────────────────────────────────
interface AppliedVoucher {
  code:              string;
  description:       string;
  discountType:      'percentage' | 'fixed';
  discountValue:     number;
  maxDiscountAmount: number | null;
  minPurchaseAmount: number;
  discountAmount:    number; // số tiền thực tế giảm
}

export default function CheckoutScreen() {
  const router   = useRouter();
  const { user } = useAuthStore();
  const params   = useLocalSearchParams<{ items?: string; fromBuyNow?: string }>();
  const isBuyNow = params.fromBuyNow === '1';

  const [cartItems, setCartItems]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderDone, setOrderDone]   = useState(false);

  const [payment, setPayment] = useState<PaymentMethod>('cod');
  const [notes, setNotes]     = useState('');

  // ── Voucher state ──────────────────────────────────────────────────────────
  const [voucherCode,     setVoucherCode]     = useState('');
  const [appliedVoucher,  setAppliedVoucher]  = useState<AppliedVoucher | null>(null);
  const [voucherLoading,  setVoucherLoading]  = useState(false);
  const [voucherError,    setVoucherError]    = useState('');

  const [addressMode, setAddressMode]       = useState<AddressMode>('saved');
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddr, setSelectedAddr]     = useState<Address | null>(null);
  const [showAddrModal, setShowAddrModal]   = useState(false);
  const [newAddress, setNewAddress]         = useState<ShippingAddress>({
    fullName: user?.name  || '',
    phone:    user?.phone || '',
    street: '', district: '', city: '',
  });

  // ── 1. Load items + địa chỉ ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        if (params.items) {
          setCartItems(JSON.parse(params.items));
        } else {
          const cart = await cartApi.getCart();
          setCartItems(cart.items.map(i => ({
            productId: i.productId._id,
            quantity:  i.quantity,
            price:     getDiscountedPrice(i.productId.price, i.productId.discount),
            color:     i.color || '',
            size:      i.size  || '',
            name:      i.productId.name,
            image:     i.productId.images?.[0] || '',
            discount:  i.productId.discount || 0,
          })));
        }
        const addrs = await userApi.getAddresses();
        setSavedAddresses(addrs);
        const def = addrs.find(a => a.isDefault) || addrs[0] || null;
        setSelectedAddr(def);
        if (!def) setAddressMode('new');
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  // ── 2. Android back handler ───────────────────────────────────────────────
  useEffect(() => {
    const handleBack = () => {
      if (!isBuyNow || orderDone) return false;
      showBuyNowAlert();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => sub.remove();
  }, [isBuyNow, orderDone]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!isBuyNow || orderDone) return;
        AsyncStorage.getItem('buyNowItem').then(raw => {
          if (raw) showBuyNowAlert(JSON.parse(raw));
        });
      };
    }, [isBuyNow, orderDone])
  );

  const showBuyNowAlert = (items?: any[]) => {
    const doAlert = (parsedItems: any[]) => {
      Alert.alert(
        'Thêm vào giỏ hàng?',
        'Bạn có muốn thêm sản phẩm này vào giỏ hàng không?',
        [
          {
            text: 'Thêm vào giỏ',
            onPress: async () => {
              try {
                for (const item of parsedItems)
                  await cartApi.addToCart(item.productId, item.quantity, item.color, item.size);
              } catch (e) { console.error(e); }
              finally { await AsyncStorage.removeItem('buyNowItem'); }
            },
          },
          { text: 'Hủy', style: 'cancel', onPress: async () => { await AsyncStorage.removeItem('buyNowItem'); } },
        ],
      );
    };
    if (items) doAlert(items);
    else AsyncStorage.getItem('buyNowItem').then(raw => { if (raw) doAlert(JSON.parse(raw)); });
  };

  // ── Tính tổng ─────────────────────────────────────────────────────────────
  const subtotal     = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount     = appliedVoucher?.discountAmount ?? 0;
  const finalTotal   = Math.max(0, subtotal - discount);

  // ── Voucher handlers ──────────────────────────────────────────────────────
  const handleApplyVoucher = async () => {
    const code = voucherCode.trim().toUpperCase();
    if (!code) {
      setVoucherError('Vui lòng nhập mã voucher');
      return;
    }
    // Reset nếu đang apply lại
    setAppliedVoucher(null);
    setVoucherError('');
    setVoucherLoading(true);
    try {
      const { data } = await api.post('/vouchers/validate', {
        code,
        orderAmount: subtotal,
      });
      setAppliedVoucher(data.data);
      setVoucherCode(data.data.code);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Mã voucher không hợp lệ';
      setVoucherError(msg);
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode('');
    setVoucherError('');
  };

  // ── Map địa chỉ ──────────────────────────────────────────────────────────
  const getShippingAddress = (): ShippingAddress | null => {
    if (addressMode === 'saved' && selectedAddr) {
      return {
        fullName: selectedAddr.fullName || '',
        phone:    selectedAddr.phone    || '',
        street:   selectedAddr.street   || (selectedAddr as any).address || '',
        district: selectedAddr.district || selectedAddr.ward             || '',
        city:     selectedAddr.province || (selectedAddr as any).city    || '',
      };
    }
    if (addressMode === 'new') return newAddress;
    return null;
  };

  const validateAddress = (addr: ShippingAddress | null): string[] => {
    if (!addr) return ['Chưa chọn địa chỉ'];
    const missing: string[] = [];
    if (!addr.fullName?.trim()) missing.push('Họ tên');
    if (!addr.phone?.trim())    missing.push('Số điện thoại');
    if (!addr.street?.trim())   missing.push('Địa chỉ');
    if (!addr.city?.trim())     missing.push('Tỉnh/Thành phố');
    return missing;
  };

  // ── Đặt hàng ─────────────────────────────────────────────────────────────
  const handleOrder = async () => {
    const addr   = getShippingAddress();
    const errors = validateAddress(addr);
    if (errors.length > 0) {
      Alert.alert('Thiếu thông tin', `Vui lòng bổ sung: ${errors.join(', ')}`);
      return;
    }
    if (cartItems.length === 0) {
      Alert.alert('Lỗi', 'Không có sản phẩm để đặt hàng');
      return;
    }
    try {
      setSubmitting(true);
      const order = await orderApi.createOrder({
        items: cartItems.map(i => ({
          productId: i.productId,
          quantity:  i.quantity,
          price:     i.price,
          color:     i.color    || undefined,
          size:      i.size     || undefined,
          discount:  i.discount || 0,
        })),
        shippingAddress: addr!,
        paymentMethod:   payment,
        notes:           notes.trim() || undefined,
        voucherCode:     appliedVoucher?.code || undefined,
      });

      await Promise.allSettled(
        cartItems.map(i => cartApi.removeItem(i.productId, i.color || '', i.size || ''))
      );

      setOrderDone(true);
      await AsyncStorage.removeItem('buyNowItem');

      if (payment === 'vnpay') {
        try {
          const paymentUrl = await paymentApi.createVnpayUrl(order._id);
          await WebBrowser.openBrowserAsync(paymentUrl, {
            dismissButtonStyle: 'close',
            presentationStyle:  WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
            controlsColor:      '#1A1A1A',
            toolbarColor:       '#FFFFFF',
            showTitle:          true,
          });
          Alert.alert(
            'Kiểm tra đơn hàng',
            'Thanh toán đã hoàn tất chưa?',
            [
              { text: 'Đã thanh toán',  onPress: () => router.replace('/(tabs)/orders') },
              { text: 'Chưa / Thử lại', style: 'cancel', onPress: () => router.replace('/(tabs)/orders') },
            ],
          );
        } catch {
          Alert.alert(
            'Lỗi VNPay',
            'Không thể mở trang thanh toán. Đơn hàng đã được tạo, vui lòng thanh toán lại trong mục Đơn hàng.',
            [{ text: 'Xem đơn hàng', onPress: () => router.replace('/(tabs)/orders') }],
          );
        }
      } else {
        Alert.alert(
          'Đặt hàng thành công! 🎉',
          `Mã đơn: #${order._id.slice(-8).toUpperCase()}`,
          [{ text: 'Xem đơn hàng', onPress: () => router.replace('/(tabs)/orders') }],
        );
      }
    } catch (err: any) {
      Alert.alert('Đặt hàng thất bại', err?.response?.data?.message || 'Vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  const addrDisplay = (a: Address) =>
    [a.street || (a as any).address, a.ward, a.district, a.province || (a as any).city]
      .filter(Boolean).join(', ');

  if (loading) return <View style={s.center}><ActivityIndicator color={TOKEN.black} /></View>;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={async () => {
            if (isBuyNow && !orderDone) { showBuyNowAlert(); return; }
            router.back();
          }}
        >
          <Ionicons name="arrow-back" size={18} color={TOKEN.black} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Đặt hàng</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Địa chỉ */}
        <Section title="Địa chỉ giao hàng" icon="location-outline">
          <View style={s.modeRow}>
            {(['saved', 'new'] as AddressMode[]).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[s.modeBtn, addressMode === mode && s.modeBtnActive]}
                onPress={() => setAddressMode(mode)}
              >
                <Text style={[s.modeBtnText, addressMode === mode && s.modeBtnTextActive]}>
                  {mode === 'saved' ? 'Địa chỉ đã lưu' : 'Địa chỉ khác'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {addressMode === 'saved' && (
            savedAddresses.length === 0 ? (
              <TouchableOpacity style={s.noAddrBtn} onPress={() => router.push('/profile/address-form')}>
                <Ionicons name="add-circle-outline" size={18} color={TOKEN.muted} />
                <Text style={s.noAddrText}>Thêm địa chỉ mới</Text>
              </TouchableOpacity>
            ) : selectedAddr ? (
              <TouchableOpacity style={s.addrCard} onPress={() => setShowAddrModal(true)} activeOpacity={0.85}>
                <View style={{ flex: 1 }}>
                  <View style={s.addrTop}>
                    <Text style={s.addrName}>{selectedAddr.fullName}</Text>
                    <Text style={s.addrPhone}>{selectedAddr.phone}</Text>
                    {selectedAddr.isDefault && (
                      <View style={s.defaultBadge}><Text style={s.defaultBadgeText}>Mặc định</Text></View>
                    )}
                  </View>
                  <Text style={s.addrDetail}>{addrDisplay(selectedAddr)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={TOKEN.muted} />
              </TouchableOpacity>
            ) : null
          )}

          {addressMode === 'new' && (
            <View style={{ gap: 10 }}>
              <Field label="Họ và tên *"        value={newAddress.fullName} onChangeText={(v: string) => setNewAddress(a => ({ ...a, fullName: v }))} placeholder="Nguyễn Văn A" />
              <Field label="Số điện thoại *"    value={newAddress.phone}    onChangeText={(v: string) => setNewAddress(a => ({ ...a, phone: v }))}    placeholder="0912345678" keyboardType="phone-pad" />
              <Field label="Địa chỉ *"          value={newAddress.street}   onChangeText={(v: string) => setNewAddress(a => ({ ...a, street: v }))}   placeholder="123 Đường ABC" />
              <Field label="Quận / Huyện"       value={newAddress.district} onChangeText={(v: string) => setNewAddress(a => ({ ...a, district: v }))} placeholder="Quận 1" />
              <Field label="Tỉnh / Thành phố *" value={newAddress.city}     onChangeText={(v: string) => setNewAddress(a => ({ ...a, city: v }))}     placeholder="TP. Hồ Chí Minh" />
            </View>
          )}
        </Section>

        {/* Thanh toán */}
        <Section title="Thanh toán" icon="card-outline">
          {([
            { id: 'cod',   label: 'Tiền mặt khi nhận', sub: 'Trả tiền mặt khi nhận hàng',  icon: 'cash-outline' },
            { id: 'vnpay', label: 'VNPay',              sub: 'Thanh toán online qua VNPay', icon: 'card-outline' },
          ] as const).map(method => (
            <TouchableOpacity
              key={method.id}
              style={[s.payOption, payment === method.id && s.payOptionActive]}
              onPress={() => setPayment(method.id)}
            >
              <Ionicons name={method.icon} size={20} color={payment === method.id ? TOKEN.black : TOKEN.muted} />
              <View style={{ flex: 1 }}>
                <Text style={[s.payLabel, payment === method.id && s.payLabelActive]}>{method.label}</Text>
                <Text style={s.paySub}>{method.sub}</Text>
              </View>
              <View style={[s.radio, payment === method.id && s.radioActive]}>
                {payment === method.id && <View style={s.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </Section>

        {/* ── Voucher ── */}
        <Section title="Mã giảm giá" icon="pricetag-outline">
          {appliedVoucher ? (
            /* Voucher đã áp dụng thành công */
            <View style={s.voucherApplied}>
              <View style={s.voucherAppliedLeft}>
                <View style={s.voucherAppliedBadge}>
                  <Ionicons name="checkmark-circle" size={15} color="#22C55E" />
                  <Text style={s.voucherAppliedCode}>{appliedVoucher.code}</Text>
                </View>
                {appliedVoucher.description ? (
                  <Text style={s.voucherAppliedDesc} numberOfLines={1}>
                    {appliedVoucher.description}
                  </Text>
                ) : null}
                <Text style={s.voucherAppliedSaving}>
                  Tiết kiệm {formatPrice(appliedVoucher.discountAmount)}
                </Text>
              </View>
              <TouchableOpacity onPress={handleRemoveVoucher} style={s.voucherRemoveBtn}>
                <Ionicons name="close-circle" size={20} color={TOKEN.muted} />
              </TouchableOpacity>
            </View>
          ) : (
            /* Input nhập mã */
            <View>
              <View style={s.voucherRow}>
                <TextInput
                  style={s.voucherInput}
                  placeholder="Nhập mã voucher"
                  placeholderTextColor={TOKEN.muted}
                  value={voucherCode}
                  onChangeText={v => {
                    setVoucherCode(v.toUpperCase());
                    if (voucherError) setVoucherError('');
                  }}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  onSubmitEditing={handleApplyVoucher}
                />
                <TouchableOpacity
                  style={[s.voucherBtn, voucherLoading && { opacity: 0.6 }]}
                  onPress={handleApplyVoucher}
                  disabled={voucherLoading}
                >
                  {voucherLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.voucherBtnText}>Áp dụng</Text>
                  }
                </TouchableOpacity>
              </View>
              {/* Error message */}
              {voucherError ? (
                <View style={s.voucherErrorRow}>
                  <Ionicons name="alert-circle-outline" size={13} color="#EF4444" />
                  <Text style={s.voucherErrorText}>{voucherError}</Text>
                </View>
              ) : null}
            </View>
          )}
        </Section>

        {/* Ghi chú */}
        <Section title="Ghi chú" icon="create-outline">
          <TextInput
            style={s.notesInput}
            placeholder="Ghi chú cho đơn hàng..."
            placeholderTextColor={TOKEN.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </Section>

        {/* Tóm tắt */}
        <Section title="Tóm tắt đơn hàng" icon="receipt-outline">
          {cartItems.map((item, i) => (
            <View key={i} style={s.summaryItem}>
              <Text style={s.summaryName} numberOfLines={1}>
                {item.name}
                {(item.color || item.size) ? ` · ${[item.color, item.size].filter(Boolean).join('/')}` : ''}
              </Text>
              <Text style={s.summaryQty}>×{item.quantity}</Text>
              <Text style={s.summaryPrice}>{formatPrice(item.price * item.quantity)}</Text>
            </View>
          ))}
          <View style={s.divider} />

          {/* Phí vận chuyển */}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Phí vận chuyển</Text>
            <Text style={{ fontSize: 13, color: '#22C55E', fontWeight: '600' }}>Miễn phí</Text>
          </View>

          {/* Giảm giá voucher */}
          {appliedVoucher && (
            <View style={[s.totalRow, { marginTop: 6 }]}>
              <View style={s.discountLabelWrap}>
                <Text style={s.totalLabel}>Voucher </Text>
                <View style={s.discountCodeTag}>
                  <Text style={s.discountCodeTagText}>{appliedVoucher.code}</Text>
                </View>
              </View>
              <Text style={s.discountVal}>-{formatPrice(appliedVoucher.discountAmount)}</Text>
            </View>
          )}

          {/* Tổng */}
          <View style={[s.totalRow, { marginTop: 10 }]}>
            <Text style={s.grandLabel}>Tổng cộng</Text>
            <Text style={s.grandVal}>{formatPrice(finalTotal)}</Text>
          </View>
        </Section>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={s.bottom}>
        <View>
          <Text style={s.bottomLabel}>Tổng thanh toán</Text>
          <View style={s.bottomPriceWrap}>
            <Text style={s.bottomVal}>{formatPrice(finalTotal)}</Text>
            {appliedVoucher && (
              <Text style={s.bottomOldVal}>{formatPrice(subtotal)}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[s.orderBtn, submitting && { opacity: 0.6 }]}
          onPress={handleOrder}
          disabled={submitting}
          activeOpacity={0.88}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.orderBtnText}>
                {payment === 'vnpay' ? 'Thanh toán VNPay' : 'Xác nhận đặt hàng'}
              </Text>
          }
        </TouchableOpacity>
      </View>

      {/* Modal chọn địa chỉ */}
      <Modal visible={showAddrModal} animationType="slide" transparent onRequestClose={() => setShowAddrModal(false)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.sheetHeader}>
              <Text style={m.sheetTitle}>Chọn địa chỉ</Text>
              <TouchableOpacity onPress={() => setShowAddrModal(false)}>
                <Ionicons name="close" size={22} color={TOKEN.black} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={savedAddresses}
              keyExtractor={a => a._id}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              renderItem={({ item }) => {
                const active = selectedAddr?._id === item._id;
                return (
                  <TouchableOpacity
                    style={[m.addrCard, active && m.addrCardActive]}
                    onPress={() => { setSelectedAddr(item); setShowAddrModal(false); }}
                    activeOpacity={0.85}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={m.addrTop}>
                        <Text style={m.addrName}>{item.fullName}</Text>
                        <Text style={m.addrPhone}>{item.phone}</Text>
                        {item.isDefault && <View style={m.badge}><Text style={m.badgeText}>Mặc định</Text></View>}
                      </View>
                      <Text style={m.addrDetail}>{addrDisplay(item)}</Text>
                    </View>
                    <View style={[m.radio, active && m.radioActive]}>
                      {active && <View style={m.radioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListFooterComponent={
                <TouchableOpacity
                  style={m.addNewBtn}
                  onPress={() => { setShowAddrModal(false); router.push('/profile/address-form'); }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={TOKEN.black} />
                  <Text style={m.addNewText}>Thêm địa chỉ mới</Text>
                </TouchableOpacity>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Ionicons name={icon as any} size={15} color={TOKEN.black} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({ label, ...props }: { label: string; [k: string]: any }) {
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.fieldInput} placeholderTextColor={TOKEN.muted} {...props} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#fff' },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: TOKEN.surface },
  backBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: TOKEN.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: 16, fontWeight: '800', color: TOKEN.black },
  scroll:        { padding: 16, gap: 14, paddingBottom: 40 },
  section:       { backgroundColor: TOKEN.surface, borderRadius: 16, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  sectionTitle:  { fontSize: 14, fontWeight: '800', color: TOKEN.black },

  modeRow:           { flexDirection: 'row', backgroundColor: '#E8E8E4', borderRadius: 10, padding: 3, marginBottom: 14 },
  modeBtn:           { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  modeBtnActive:     { backgroundColor: '#fff' },
  modeBtnText:       { fontSize: 13, fontWeight: '600', color: TOKEN.muted },
  modeBtnTextActive: { color: TOKEN.black },

  addrCard:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 10 },
  addrTop:           { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  addrName:          { fontSize: 14, fontWeight: '700', color: TOKEN.black },
  addrPhone:         { fontSize: 13, color: TOKEN.muted },
  addrDetail:        { fontSize: 12, color: TOKEN.muted, lineHeight: 18 },
  defaultBadge:      { backgroundColor: TOKEN.black, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  defaultBadgeText:  { color: '#fff', fontSize: 9, fontWeight: '700' },
  noAddrBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: TOKEN.border, borderStyle: 'dashed' },
  noAddrText:        { fontSize: 14, color: TOKEN.muted, fontWeight: '500' },

  fieldLabel:    { fontSize: 11, color: TOKEN.muted, marginBottom: 6, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  fieldInput:    { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: TOKEN.black },

  payOption:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E8E8E4', marginBottom: 8, backgroundColor: '#fff' },
  payOptionActive:{ borderColor: TOKEN.black },
  payLabel:       { fontSize: 14, fontWeight: '600', color: TOKEN.muted },
  payLabelActive: { color: TOKEN.black },
  paySub:         { fontSize: 11, color: TOKEN.muted, marginTop: 2 },
  radio:          { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: TOKEN.border, alignItems: 'center', justifyContent: 'center' },
  radioActive:    { borderColor: TOKEN.black },
  radioDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: TOKEN.black },

  /* Voucher — input */
  voucherRow:      { flexDirection: 'row', gap: 10 },
  voucherInput:    { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: TOKEN.black, borderWidth: 1, borderColor: TOKEN.border },
  voucherBtn:      { backgroundColor: TOKEN.black, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minWidth: 88 },
  voucherBtnText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  voucherErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  voucherErrorText:{ fontSize: 12, color: '#EF4444', flex: 1 },

  /* Voucher — applied */
  voucherApplied:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#BBF7D0' },
  voucherAppliedLeft: { flex: 1, gap: 3 },
  voucherAppliedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 5 },
  voucherAppliedCode: { fontSize: 14, fontWeight: '800', color: TOKEN.black },
  voucherAppliedDesc: { fontSize: 12, color: TOKEN.muted },
  voucherAppliedSaving:{ fontSize: 12, fontWeight: '700', color: '#16A34A' },
  voucherRemoveBtn:   { padding: 4 },

  notesInput:    { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: TOKEN.black, height: 80, textAlignVertical: 'top' },

  summaryItem:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  summaryName:   { flex: 1, fontSize: 13, color: '#444' },
  summaryQty:    { fontSize: 12, color: TOKEN.muted, minWidth: 24 },
  summaryPrice:  { fontSize: 13, fontWeight: '700', color: TOKEN.black },
  divider:       { height: 1, backgroundColor: TOKEN.border, marginVertical: 10 },

  totalRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:        { fontSize: 13, color: TOKEN.muted },
  discountLabelWrap: { flexDirection: 'row', alignItems: 'center' },
  discountCodeTag:   { backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  discountCodeTagText:{ fontSize: 11, fontWeight: '700', color: '#16A34A' },
  discountVal:       { fontSize: 13, fontWeight: '700', color: '#16A34A' },
  grandLabel:        { fontSize: 15, fontWeight: '800', color: TOKEN.black },
  grandVal:          { fontSize: 16, fontWeight: '900', color: TOKEN.black },

  bottom:          { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36, borderTopWidth: 1, borderTopColor: TOKEN.surface, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottomLabel:     { fontSize: 12, color: TOKEN.muted, marginBottom: 2 },
  bottomPriceWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bottomVal:       { fontSize: 20, fontWeight: '900', color: TOKEN.black },
  bottomOldVal:    { fontSize: 13, color: TOKEN.muted, textDecorationLine: 'line-through' },
  orderBtn:        { backgroundColor: TOKEN.black, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 14 },
  orderBtnText:    { color: '#fff', fontSize: 14, fontWeight: '800' },
});

const m = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  sheetHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: TOKEN.surface },
  sheetTitle:     { fontSize: 16, fontWeight: '800', color: TOKEN.black },
  addrCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: TOKEN.surface, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1.5, borderColor: 'transparent' },
  addrCardActive: { borderColor: TOKEN.black, backgroundColor: '#fff' },
  addrTop:        { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  addrName:       { fontSize: 14, fontWeight: '700', color: TOKEN.black },
  addrPhone:      { fontSize: 13, color: TOKEN.muted },
  addrDetail:     { fontSize: 12, color: TOKEN.muted, lineHeight: 18 },
  badge:          { backgroundColor: TOKEN.black, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgeText:      { color: '#fff', fontSize: 9, fontWeight: '700' },
  radio:          { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: TOKEN.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioActive:    { borderColor: TOKEN.black },
  radioDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: TOKEN.black },
  addNewBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: TOKEN.border, borderStyle: 'dashed', margin: 4 },
  addNewText:     { fontSize: 14, fontWeight: '600', color: TOKEN.black },
});
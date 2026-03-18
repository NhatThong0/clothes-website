import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, StatusBar, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cartApi, Cart, CartItem } from '@/src/api/cartApi';
import { formatPrice, getDiscountedPrice } from '@/src/api/productApi';
import { useFocusEffect } from 'expo-router';


const TOKEN = { black: '#1A1A1A', surface: '#F5F5F0', border: '#E8E8E4', muted: '#AAAAAA', accent: '#E8FF4A' };

const itemKey = (item: CartItem) =>
  `${item.productId._id}__${item.color ?? ''}__${item.size ?? ''}`;

export default function CartScreen() {
  const router = useRouter();
  const [cart, setCart]           = useState<Cart | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating]   = useState<string | null>(null);
  const [selected, setSelected]   = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
  try {
    const data = await cartApi.getCart();
    setCart(data);
    // ✅ Reset selected mỗi lần load — chọn tất cả items mới
    setSelected(new Set(data.items.map(itemKey)));
  } catch (e) { console.error(e); }
  finally { setLoading(false); setRefreshing(false); }
}, []);

// ✅ Dùng useFocusEffect thay useEffect
useFocusEffect(
  useCallback(() => {
    setLoading(true);
    load();
  }, [load])
);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const allKeys       = cart?.items.map(itemKey) ?? [];
  const validSelected = new Set([...selected].filter(k => allKeys.includes(k)));
  const isAllSelected = allKeys.length > 0 && allKeys.every(k => validSelected.has(k));

  const toggleItem = (key: string) =>
    setSelected(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const toggleAll = () =>
    setSelected(isAllSelected ? new Set() : new Set(allKeys));

  // ── Cập nhật số lượng ────────────────────────────────────────────────────
  const handleQty = async (item: CartItem, delta: number) => {
    const key    = itemKey(item);
    const newQty = item.quantity + delta;
    const pid    = item.productId._id;

    if (newQty <= 0) {
      Alert.alert('Xóa sản phẩm', `Bỏ "${item.productId.name}" khỏi giỏ?`, [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa', style: 'destructive',
          onPress: async () => {
            try {
              const updated = await cartApi.removeItem(pid, item.color, item.size);
              setCart(updated);
              setSelected(prev => { const n = new Set(prev); n.delete(key); return n; });
            } catch (e: any) {
              Alert.alert('Lỗi', e?.response?.data?.message || 'Không thể xóa');
            }
          },
        },
      ]);
      return;
    }

    setUpdating(key);
    try {
      const updated = await cartApi.updateItem(pid, newQty, item.color, item.size);
      setCart(updated);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.response?.data?.message || 'Không thể cập nhật');
    } finally { setUpdating(null); }
  };

  // ── Xóa item ─────────────────────────────────────────────────────────────
  const handleRemove = (item: CartItem) => {
    const key = itemKey(item);
    Alert.alert('Xóa sản phẩm', `Bỏ "${item.productId.name}" khỏi giỏ?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive',
        onPress: async () => {
          try {
            const updated = await cartApi.removeItem(item.productId._id, item.color, item.size);
            setCart(updated);
            setSelected(prev => { const n = new Set(prev); n.delete(key); return n; });
          } catch (e: any) {
            Alert.alert('Lỗi', e?.response?.data?.message || 'Không thể xóa');
          }
        },
      },
    ]);
  };

  // ── Tính toán ─────────────────────────────────────────────────────────────
  const selectedItems = cart?.items.filter(i => validSelected.has(itemKey(i))) ?? [];
  const subtotal = selectedItems.reduce((sum, i) => {
    return sum + getDiscountedPrice(i.productId.price, i.productId.discount) * i.quantity;
  }, 0);

  // ── Checkout ──────────────────────────────────────────────────────────────
  const handleCheckout = () => {
    if (selectedItems.length === 0) {
      Alert.alert('Chưa chọn sản phẩm', 'Vui lòng chọn ít nhất 1 sản phẩm');
      return;
    }
    const itemsParam = JSON.stringify(
      selectedItems.map(i => ({
        productId: i.productId._id,
        quantity:  i.quantity,
        price:     getDiscountedPrice(i.productId.price, i.productId.discount),
        color:     i.color   || '',
        size:      i.size    || '',
        name:      i.productId.name,
        image:     i.productId.images?.[0] || '',
        discount:  i.productId.discount || 0,
      }))
    );
    router.push({ pathname: '/checkout', params: { items: itemsParam } });
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={TOKEN.black} /></View>;

  const empty = !cart?.items?.length;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={s.header}>
        <Text style={s.title}>Giỏ hàng</Text>
        {!empty && <Text style={s.count}>{cart!.items.length} sản phẩm</Text>}
      </View>

      {empty ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Ionicons name="bag-outline" size={40} color={TOKEN.muted} />
          </View>
          <Text style={s.emptyTitle}>Giỏ hàng trống</Text>
          <Text style={s.emptySub}>Thêm sản phẩm để bắt đầu</Text>
          <TouchableOpacity style={s.shopBtn} onPress={() => router.push('/(tabs)/products')}>
            <Text style={s.shopBtnText}>Khám phá sản phẩm</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Select all */}
          <TouchableOpacity style={s.selectBar} onPress={toggleAll} activeOpacity={0.7}>
            <Checkbox checked={isAllSelected} />
            <Text style={s.selectAllText}>
              {isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </Text>
            {validSelected.size > 0 && (
              <Text style={s.selectedCount}>{validSelected.size}/{cart!.items.length} sp</Text>
            )}
          </TouchableOpacity>

          <FlatList
            data={cart!.items}
            keyExtractor={itemKey}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 160 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={TOKEN.black} />}
            ItemSeparatorComponent={() => <View style={s.separator} />}
            renderItem={({ item }) => {
              const p       = item.productId;
              const price   = getDiscountedPrice(p.price, p.discount);
              const key     = itemKey(item);
              const checked = validSelected.has(key);
              const busy    = updating === key;

              return (
                <TouchableOpacity
                  style={[s.item, checked && s.itemChecked]}
                  onPress={() => toggleItem(key)}
                  activeOpacity={0.85}
                >
                  <Checkbox checked={checked} />

                  <View style={s.imgWrap}>
                    {p.images?.[0]
                      ? <Image source={{ uri: p.images[0] }} style={s.img} resizeMode="cover" />
                      : <View style={[s.img, s.imgEmpty]}>
                          <Ionicons name="image-outline" size={18} color="#CCC" />
                        </View>
                    }
                  </View>

                  <View style={s.body}>
                    <Text style={s.name} numberOfLines={2}>{p.name}</Text>
                    {(item.color || item.size) && (
                      <View style={s.variantRow}>
                        {item.color && <VariantBadge label={item.color} />}
                        {item.size  && <VariantBadge label={item.size} />}
                      </View>
                    )}
                    <View style={s.priceRow}>
                      <Text style={s.price}>{formatPrice(price)}</Text>
                      {p.discount > 0 && (
                        <Text style={s.priceOld}>{formatPrice(p.price)}</Text>
                      )}
                    </View>
                  </View>

                  <View style={s.right}>
                    <TouchableOpacity
                      style={s.deleteBtn}
                      onPress={() => handleRemove(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={15} color="#CCC" />
                    </TouchableOpacity>
                    <View style={s.qtyRow}>
                      <TouchableOpacity
                        style={s.qtyBtn}
                        onPress={() => handleQty(item, -1)}
                        disabled={busy}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Text style={s.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      {busy
                        ? <ActivityIndicator size="small" color={TOKEN.black} style={{ width: 28 }} />
                        : <Text style={s.qtyVal}>{item.quantity}</Text>
                      }
                      <TouchableOpacity
                        style={s.qtyBtn}
                        onPress={() => handleQty(item, 1)}
                        disabled={busy}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Text style={s.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          {/* Bottom bar */}
          <View style={s.bottom}>
            <View>
              <Text style={s.totalLabel}>
                Tổng {selectedItems.length > 0 ? `· ${selectedItems.length} sp` : ''}
              </Text>
              <Text style={s.totalVal}>{formatPrice(subtotal)}</Text>
            </View>
            <TouchableOpacity
              style={[s.checkoutBtn, selectedItems.length === 0 && s.checkoutBtnOff]}
              onPress={handleCheckout}
              activeOpacity={0.88}
            >
              <Text style={[s.checkoutText, selectedItems.length === 0 && s.checkoutTextOff]}>
                Thanh toán
              </Text>
              <Ionicons
                name="arrow-forward" size={16}
                color={selectedItems.length === 0 ? TOKEN.muted : '#fff'}
              />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View style={[cb.box, checked && cb.active]}>
      {checked && <Ionicons name="checkmark" size={11} color="#fff" />}
    </View>
  );
}

function VariantBadge({ label }: { label: string }) {
  return (
    <View style={vb.wrap}><Text style={vb.text}>{label}</Text></View>
  );
}

const cb = StyleSheet.create({
  box:    { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', flexShrink: 0 },
  active: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
});

const vb = StyleSheet.create({
  wrap: { backgroundColor: '#F5F5F0', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  text: { fontSize: 10, color: '#6B7280', fontWeight: '500' },
});

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#fff' },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  title:           { fontSize: 28, fontWeight: '900', color: TOKEN.black },
  count:           { fontSize: 13, color: TOKEN.muted },
  emptyWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 },
  emptyIcon:       { width: 80, height: 80, borderRadius: 40, backgroundColor: TOKEN.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle:      { fontSize: 18, fontWeight: '800', color: TOKEN.black },
  emptySub:        { fontSize: 14, color: TOKEN.muted },
  shopBtn:         { marginTop: 12, backgroundColor: TOKEN.black, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  shopBtnText:     { color: '#fff', fontWeight: '800', fontSize: 14 },
  selectBar:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: TOKEN.surface },
  selectAllText:   { fontSize: 13, fontWeight: '600', color: TOKEN.black, flex: 1 },
  selectedCount:   { fontSize: 12, color: TOKEN.muted },
  separator:       { height: 1, backgroundColor: TOKEN.surface, marginLeft: 20 },
  item:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12, backgroundColor: '#fff' },
  itemChecked:     { backgroundColor: '#FAFAFA' },
  imgWrap:         { width: 68, height: 68, borderRadius: 12, overflow: 'hidden', backgroundColor: TOKEN.surface, flexShrink: 0 },
  img:             { width: 68, height: 68 },
  imgEmpty:        { alignItems: 'center', justifyContent: 'center' },
  body:            { flex: 1, gap: 4 },
  name:            { fontSize: 13, fontWeight: '700', color: TOKEN.black, lineHeight: 18 },
  variantRow:      { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  priceRow:        { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  price:           { fontSize: 14, fontWeight: '900', color: TOKEN.black },
  priceOld:        { fontSize: 11, color: TOKEN.muted, textDecorationLine: 'line-through' },
  right:           { alignItems: 'flex-end', gap: 10 },
  deleteBtn:       { padding: 2 },
  qtyRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: TOKEN.surface, borderRadius: 10, padding: 2 },
  qtyBtn:          { width: 28, height: 28, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText:      { fontSize: 15, fontWeight: '700', color: TOKEN.black },
  qtyVal:          { fontSize: 13, fontWeight: '800', color: TOKEN.black, minWidth: 26, textAlign: 'center' },
  bottom:          { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36, borderTopWidth: 1, borderTopColor: TOKEN.surface, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:      { fontSize: 12, color: TOKEN.muted, marginBottom: 2 },
  totalVal:        { fontSize: 22, fontWeight: '900', color: TOKEN.black },
  checkoutBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TOKEN.black, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 14 },
  checkoutBtnOff:  { backgroundColor: TOKEN.surface },
  checkoutText:    { fontSize: 14, fontWeight: '800', color: '#fff' },
  checkoutTextOff: { color: TOKEN.muted },
});
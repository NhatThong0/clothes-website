import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions,
  StatusBar, Animated, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { productApi, Product, formatPrice, getDiscountedPrice } from '@/src/api/productApi';
import { cartApi } from '@/src/api/cartApi';
import { useCartStore } from '@/src/store/cartStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/src/api/axiosConfig';

const { width } = Dimensions.get('window');
const TOKEN = { black: '#1A1A1A', surface: '#F5F5F0', muted: '#AAAAAA', accent: '#e65c5c', border: '#E8E8E4' };

type Variant = { color: string; size: string; stock: number; price?: number };
type Review  = {
  _id:       string;
  userId:    { _id: string; name: string; avatar?: string } | null;
  rating:    number;
  comment:   string;
  images:    string[];
  createdAt: string;
};

const getVariant   = (variants: Variant[], color?: string, size?: string) =>
  variants.find(v => (!color || v.color === color) && (!size || v.size === size));
const uniqueColors = (variants: Variant[]) => [...new Set(variants.map(v => v.color))];
const uniqueSizes  = (variants: Variant[], color?: string) =>
  [...new Set(variants.filter(v => !color || v.color === color).map(v => v.size))];

// ── Stars ─────────────────────────────────────────────────────────────────────
function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Ionicons key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size} color="#F59E0B"
        />
      ))}
    </View>
  );
}

// ── Rating Summary ────────────────────────────────────────────────────────────
function RatingSummary({ reviews, avg }: { reviews: Review[]; avg: number }) {
  const total  = reviews.length;
  const counts = [5,4,3,2,1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
  }));
  return (
    <View style={rs.wrap}>
      <View style={rs.left}>
        <Text style={rs.bigNum}>{avg.toFixed(1)}</Text>
        <Stars rating={avg} size={16} />
        <Text style={rs.totalText}>{total} đánh giá</Text>
      </View>
      <View style={rs.bars}>
        {counts.map(({ star, count }) => (
          <View key={star} style={rs.barRow}>
            <Text style={rs.barLabel}>{star}</Text>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <View style={rs.barBg}>
              <View style={[rs.barFill, { width: `${total > 0 ? (count/total)*100 : 0}%` }]} />
            </View>
            <Text style={rs.barCount}>{count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Review Item ───────────────────────────────────────────────────────────────
function ReviewItem({ review }: { review: Review }) {
  const name    = review.userId?.name || 'Người dùng';
  const initial = name.charAt(0).toUpperCase();
  const date    = new Date(review.createdAt).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  return (
    <View style={rv.wrap}>
      <View style={rv.top}>
        {review.userId?.avatar
          ? <Image source={{ uri: review.userId.avatar }} style={rv.avatar} />
          : <View style={rv.avatarFb}><Text style={rv.avatarText}>{initial}</Text></View>
        }
        <View style={{ flex: 1 }}>
          <View style={rv.nameRow}>
            <Text style={rv.name} numberOfLines={1}>{name}</Text>
            <Text style={rv.date}>{date}</Text>
          </View>
          <Stars rating={review.rating} size={12} />
        </View>
      </View>
      <Text style={rv.comment}>{review.comment}</Text>
      {review.images?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {review.images.map((img, i) => (
              <Image key={i} source={{ uri: img }} style={rv.img} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const cartCount = useCartStore(s => s.items.reduce((sum, i) => sum + i.quantity, 0));

  const [product,         setProduct]         = useState<Product | null>(null);
  const [reviews,         setReviews]         = useState<Review[]>([]);
  const [reviewsLoading,  setReviewsLoading]  = useState(false);
  const [showAllReviews,  setShowAllReviews]  = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [imgIndex,        setImgIndex]        = useState(0);
  const [quantity,        setQuantity]        = useState(1);
  const [added,           setAdded]           = useState(false);
  const [selectedColor,   setSelectedColor]   = useState<string | undefined>();
  const [selectedSize,    setSelectedSize]    = useState<string | undefined>();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { useCartStore.getState().syncCart(); }, []);

  useEffect(() => {
    if (!id) return;
    productApi.getById(id)
      .then(p => {
        setProduct(p);
        const vv = (p.variants ?? []).filter(v => v.color && v.size) as Variant[];
        if (uniqueColors(vv).length === 1) setSelectedColor(uniqueColors(vv)[0]);
        if (uniqueSizes(vv).length === 1)  setSelectedSize(uniqueSizes(vv)[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // Load reviews
  useEffect(() => {
    if (!id) return;
    setReviewsLoading(true);
    api.get(`/products/${id}/reviews`)
      .then(res => setReviews(res.data?.data || []))
      .catch(console.error)
      .finally(() => setReviewsLoading(false));
  }, [id]);

  if (loading) return <View style={s.center}><ActivityIndicator color={TOKEN.black} /></View>;
  if (!product) return <View style={s.center}><Text style={{ color: TOKEN.muted }}>Không tìm thấy sản phẩm</Text></View>;

  const validVariants = (product.variants ?? []).filter(v => v.color && v.size) as Variant[];
  const hasVariants   = validVariants.length > 0;
  const colors        = uniqueColors(validVariants);
  const sizes         = uniqueSizes(validVariants, selectedColor);
  const activeVariant = hasVariants ? getVariant(validVariants, selectedColor, selectedSize) : undefined;
  const basePrice     = (activeVariant?.price != null && activeVariant.price > 0) ? activeVariant.price : product.price;
  const finalPrice    = getDiscountedPrice(basePrice, product.discount);
  const stockCount    = activeVariant?.stock ?? product.stock ?? 0;
  const outOfStock    = stockCount === 0;
  const needsColor    = hasVariants && colors.length > 0 && !selectedColor;
  const needsSize     = hasVariants && sizes.length > 0  && !selectedSize;

  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 3);

  const handleColorSelect = (color: string) => {
    setSelectedColor(color === selectedColor ? undefined : color);
    setSelectedSize(undefined); setQuantity(1);
  };
  const handleSizeSelect = (size: string) => {
    setSelectedSize(size === selectedSize ? undefined : size); setQuantity(1);
  };

  const handleAddToCart = async () => {
    if (needsColor) { Alert.alert('Chọn màu', 'Vui lòng chọn màu sắc'); return; }
    if (needsSize)  { Alert.alert('Chọn size', 'Vui lòng chọn kích thước'); return; }
    try {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
      setAdded(true);
      await cartApi.addToCart(product._id, quantity, selectedColor, selectedSize);
      await useCartStore.getState().syncCart();
      setTimeout(() => setAdded(false), 2000);
    } catch (err: any) {
      setAdded(false);
      Alert.alert('Lỗi', err?.response?.data?.message || 'Không thể thêm vào giỏ');
    }
  };

  const handleBuyNow = () => {
    if (needsColor) { Alert.alert('Chọn màu', 'Vui lòng chọn màu sắc'); return; }
    if (needsSize)  { Alert.alert('Chọn size', 'Vui lòng chọn kích thước'); return; }
    const item = {
      productId: product._id, quantity, price: finalPrice,
      color: selectedColor || '', size: selectedSize || '',
      name: product.name, image: product.images?.[0] || '', discount: product.discount || 0,
    };
    const itemsParam = JSON.stringify([item]);
    AsyncStorage.setItem('buyNowItem', itemsParam).finally(() =>
      router.push({ pathname: '/checkout', params: { items: itemsParam, fromBuyNow: '1' } })
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* ── Gallery ──────────────────────────────────────── */}
        <View style={s.gallery}>
          <Image source={{ uri: product.images?.[imgIndex] }} style={s.mainImg} resizeMode="cover" />
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color={TOKEN.black} />
          </TouchableOpacity>
          <TouchableOpacity style={s.cartBtn} onPress={() => router.push('/(tabs)/cart')}>
            <Ionicons name="bag-outline" size={18} color={TOKEN.black} />
            {cartCount > 0 && (
              <View style={s.cartDot}>
                <Text style={s.cartDotText}>{cartCount > 99 ? '99+' : cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          {product.discount > 0 && (
            <View style={s.badge}><Text style={s.badgeText}>-{product.discount}%</Text></View>
          )}
          {product.images?.length > 1 && (
            <View style={s.thumbRow}>
              {product.images.map((img, i) => (
                <TouchableOpacity key={i} onPress={() => setImgIndex(i)}>
                  <Image source={{ uri: img }} style={[s.thumb, i === imgIndex && s.thumbActive]} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Info ─────────────────────────────────────────── */}
        <View style={s.info}>
          <Text style={s.category}>{(product as any).category?.name?.toUpperCase()}</Text>
          <Text style={s.name}>{product.name}</Text>

          <View style={s.metaRow}>
            <View style={s.ratingWrap}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={s.ratingText}>{product.averageRating?.toFixed(1) || '0.0'}</Text>
            </View>
            <Text style={s.metaDot}>·</Text>
            <Text style={s.sold}>{reviews.length} đánh giá</Text>
            <Text style={s.metaDot}>·</Text>
            <Text style={[s.stock, outOfStock && { color: '#EF4444' }]}>
              {outOfStock ? 'Hết hàng' : `Còn ${stockCount}`}
            </Text>
          </View>

          <View style={s.priceRow}>
            <Text style={s.price}>{formatPrice(finalPrice)}</Text>
            {product.discount > 0 && <Text style={s.priceOld}>{formatPrice(basePrice)}</Text>}
          </View>

          {/* Color */}
          {hasVariants && colors.length > 0 && (
            <View style={s.variantSection}>
              <Text style={s.variantLabel}>
                Màu sắc{selectedColor && <Text style={s.variantSelected}> · {selectedColor}</Text>}
              </Text>
              <View style={s.colorRow}>
                {colors.map(color => {
                  const active   = selectedColor === color;
                  const hasStock = (product.variants ?? []).some(v => v.color === color && v.stock > 0);
                  return (
                    <TouchableOpacity key={color}
                      style={[s.colorChip, active && s.colorChipActive, !hasStock && s.chipDisabled]}
                      onPress={() => hasStock && handleColorSelect(color)} activeOpacity={hasStock ? 0.8 : 1}>
                      <Text style={[s.colorChipText, active && s.colorChipTextActive, !hasStock && s.chipDisabledText]}>
                        {color}
                      </Text>
                      {!hasStock && <View style={s.strikethrough} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Size */}
          {hasVariants && sizes.length > 0 && (
            <View style={s.variantSection}>
              <Text style={s.variantLabel}>
                Kích thước{selectedSize && <Text style={s.variantSelected}> · {selectedSize}</Text>}
              </Text>
              <View style={s.sizeRow}>
                {sizes.map(size => {
                  const active   = selectedSize === size;
                  const hasStock = (product.variants ?? []).some(
                    v => v.size === size && (!selectedColor || v.color === selectedColor) && v.stock > 0
                  );
                  return (
                    <TouchableOpacity key={size}
                      style={[s.sizeChip, active && s.sizeChipActive, !hasStock && s.chipDisabled]}
                      onPress={() => hasStock && handleSizeSelect(size)} activeOpacity={hasStock ? 0.8 : 1}>
                      <Text style={[s.sizeChipText, active && s.sizeChipTextActive, !hasStock && s.chipDisabledText]}>
                        {size}
                      </Text>
                      {!hasStock && <View style={s.strikethrough} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={s.divider} />
          <Text style={s.descLabel}>Mô tả sản phẩm</Text>
          <Text style={s.desc}>{product.description}</Text>
        </View>

        {/* ── Reviews ──────────────────────────────────────── */}
        <View style={s.reviewSection}>
          <View style={s.reviewHeader}>
            <Text style={s.reviewTitle}>Đánh giá</Text>
            {reviews.length > 0 && (
              <View style={s.reviewBadge}>
                <Text style={s.reviewBadgeText}>{reviews.length}</Text>
              </View>
            )}
          </View>

          {reviewsLoading ? (
            <ActivityIndicator color={TOKEN.black} style={{ marginVertical: 24 }} />
          ) : reviews.length === 0 ? (
            <View style={s.emptyReview}>
              <Ionicons name="chatbubble-outline" size={36} color={TOKEN.border} />
              <Text style={s.emptyReviewTitle}>Chưa có đánh giá</Text>
              <Text style={s.emptyReviewSub}>Hãy là người đầu tiên đánh giá sản phẩm này</Text>
            </View>
          ) : (
            <>
              <RatingSummary reviews={reviews} avg={product.averageRating || 0} />
              <View style={s.divider} />
              {displayedReviews.map(r => <ReviewItem key={r._id} review={r} />)}
              {reviews.length > 3 && (
                <TouchableOpacity style={s.showMoreBtn} onPress={() => setShowAllReviews(v => !v)}>
                  <Text style={s.showMoreText}>
                    {showAllReviews ? 'Thu gọn' : `Xem tất cả ${reviews.length} đánh giá`}
                  </Text>
                  <Ionicons name={showAllReviews ? 'chevron-up' : 'chevron-down'} size={14} color={TOKEN.black} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Bottom bar ───────────────────────────────────────── */}
      <View style={s.bar}>
        <View style={s.qty}>
          <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantity(q => Math.max(1, q - 1))} disabled={outOfStock}>
            <Ionicons name="remove" size={16} color={TOKEN.black} />
          </TouchableOpacity>
          <Text style={s.qtyVal}>{quantity}</Text>
          <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantity(q => Math.min(stockCount, q + 1))} disabled={outOfStock}>
            <Ionicons name="add" size={16} color={TOKEN.black} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[s.addBtn, (added || outOfStock || needsColor || needsSize) && s.addBtnDisabled]}
          onPress={handleAddToCart} disabled={outOfStock} activeOpacity={0.88}>
          <Ionicons name={added ? 'checkmark' : 'bag-add-outline'} size={18} color="#fff" />
        </TouchableOpacity>
        <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity style={[s.buyBtn, outOfStock && s.buyBtnDisabled]}
            onPress={handleBuyNow} disabled={outOfStock} activeOpacity={0.88}>
            <Text style={s.buyBtnText}>
              {outOfStock ? 'Hết hàng' : `Mua ngay · ${formatPrice(finalPrice * quantity)}`}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  gallery:     { position: 'relative', backgroundColor: TOKEN.surface },
  mainImg:     { width, height: width },
  backBtn:     { position: 'absolute', top: 56, left: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  cartBtn:     { position: 'absolute', top: 56, right: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  cartDot:     { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff' },
  cartDotText: { fontSize: 8, fontWeight: '800', color: '#fff' },
  badge:       { position: 'absolute', top: 56, left: 70, backgroundColor: TOKEN.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText:   { fontSize: 11, fontWeight: '800', color: '#fff' },
  thumbRow:    { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  thumb:       { width: 40, height: 40, borderRadius: 8, borderWidth: 2, borderColor: 'transparent', opacity: 0.6 },
  thumbActive: { borderColor: TOKEN.black, opacity: 1 },

  info:        { padding: 24, paddingBottom: 8 },
  category:    { fontSize: 10, fontWeight: '700', color: TOKEN.muted, letterSpacing: 1.5, marginBottom: 6 },
  name:        { fontSize: 22, fontWeight: '900', color: TOKEN.black, lineHeight: 28, marginBottom: 12 },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  ratingWrap:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText:  { fontSize: 13, fontWeight: '700', color: TOKEN.black },
  metaDot:     { color: '#DDD' },
  sold:        { fontSize: 12, color: TOKEN.muted },
  stock:       { fontSize: 12, fontWeight: '600', color: '#22C55E' },
  priceRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 20 },
  price:       { fontSize: 28, fontWeight: '900', color: TOKEN.black },
  priceOld:    { fontSize: 14, color: TOKEN.muted, textDecorationLine: 'line-through' },

  variantSection:      { marginBottom: 16 },
  variantLabel:        { fontSize: 13, fontWeight: '700', color: TOKEN.black, marginBottom: 10 },
  variantSelected:     { fontWeight: '500', color: TOKEN.muted },
  colorRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorChip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: TOKEN.border, backgroundColor: '#fff', position: 'relative', overflow: 'hidden' },
  colorChipActive:     { borderColor: TOKEN.black, backgroundColor: TOKEN.black },
  colorChipText:       { fontSize: 13, fontWeight: '500', color: '#444' },
  colorChipTextActive: { color: '#fff', fontWeight: '700' },
  sizeRow:             { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sizeChip:            { minWidth: 48, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: TOKEN.border, backgroundColor: '#fff', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  sizeChipActive:      { borderColor: TOKEN.black, backgroundColor: TOKEN.black },
  sizeChipText:        { fontSize: 13, fontWeight: '500', color: '#444' },
  sizeChipTextActive:  { color: '#fff', fontWeight: '700' },
  chipDisabled:        { borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' },
  chipDisabledText:    { color: '#CCC' },
  strikethrough:       { position: 'absolute', top: '50%', left: 0, right: 0, height: 1, backgroundColor: '#CCC' },

  divider:   { height: 1, backgroundColor: TOKEN.surface, marginVertical: 20 },
  descLabel: { fontSize: 13, fontWeight: '800', color: TOKEN.black, marginBottom: 8 },
  desc:      { fontSize: 14, color: '#555', lineHeight: 22, marginBottom: 8 },

  // Reviews
  reviewSection:   { paddingHorizontal: 24, paddingBottom: 16 },
  reviewHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  reviewTitle:     { fontSize: 18, fontWeight: '800', color: TOKEN.black },
  reviewBadge:     { backgroundColor: TOKEN.black, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  reviewBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  emptyReview:     { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyReviewTitle:{ fontSize: 15, fontWeight: '700', color: TOKEN.black },
  emptyReviewSub:  { fontSize: 13, color: TOKEN.muted, textAlign: 'center' },
  showMoreBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, backgroundColor: TOKEN.surface, borderRadius: 12, marginTop: 8 },
  showMoreText:    { fontSize: 13, fontWeight: '700', color: TOKEN.black },

  bar:            { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 36, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: TOKEN.surface },
  qty:            { flexDirection: 'row', alignItems: 'center', backgroundColor: TOKEN.surface, borderRadius: 12, padding: 4 },
  qtyBtn:         { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  qtyVal:         { fontSize: 16, fontWeight: '800', color: TOKEN.black, minWidth: 32, textAlign: 'center' },
  addBtn:         { width: 48, height: 48, borderRadius: 12, backgroundColor: TOKEN.black, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabled: { backgroundColor: '#9CA3AF' },
  buyBtn:         { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: TOKEN.black, borderRadius: 14, paddingVertical: 16 },
  buyBtnDisabled: { backgroundColor: '#9CA3AF' },
  buyBtnText:     { fontSize: 14, fontWeight: '800', color: '#fff' },
});

// Review item styles
const rv = StyleSheet.create({
  wrap:     { paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: TOKEN.border },
  top:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  avatar:   { width: 38, height: 38, borderRadius: 19 },
  avatarFb: { width: 38, height: 38, borderRadius: 19, backgroundColor: TOKEN.black, alignItems: 'center', justifyContent: 'center' },
  avatarText:{ fontSize: 15, fontWeight: '800', color: '#fff' },
  nameRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name:     { fontSize: 13, fontWeight: '700', color: TOKEN.black, flex: 1 },
  date:     { fontSize: 11, color: TOKEN.muted },
  comment:  { fontSize: 13, color: '#444', lineHeight: 20 },
  img:      { width: 72, height: 72, borderRadius: 10, backgroundColor: TOKEN.surface },
});

// Rating summary styles
const rs = StyleSheet.create({
  wrap:      { flexDirection: 'row', gap: 20, alignItems: 'center', paddingVertical: 8 },
  left:      { alignItems: 'center', gap: 6 },
  bigNum:    { fontSize: 48, fontWeight: '900', color: TOKEN.black, lineHeight: 52 },
  totalText: { fontSize: 11, color: TOKEN.muted, marginTop: 4 },
  bars:      { flex: 1, gap: 6 },
  barRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barLabel:  { fontSize: 11, fontWeight: '600', color: TOKEN.black, width: 10 },
  barBg:     { flex: 1, height: 6, backgroundColor: TOKEN.surface, borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: '100%', backgroundColor: '#F59E0B', borderRadius: 3 },
  barCount:  { fontSize: 11, color: TOKEN.muted, width: 20, textAlign: 'right' },
});
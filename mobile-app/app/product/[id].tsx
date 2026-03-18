import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions,
  StatusBar, Animated, Alert, BackHandler,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { productApi, Product, formatPrice, getDiscountedPrice } from '@/src/api/productApi';
import { cartApi } from '@/src/api/cartApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';

const { width } = Dimensions.get('window');
const TOKEN = { black: '#1A1A1A', surface: '#F5F5F0', muted: '#AAAAAA', accent: '#e65c5c', border: '#E8E8E4' };

type Variant = { color: string; size: string; stock: number; price?: number };

const getVariant   = (variants: Variant[], color?: string, size?: string) =>
  variants.find(v => (!color || v.color === color) && (!size || v.size === size));
const uniqueColors = (variants: Variant[]) => [...new Set(variants.map(v => v.color))];
const uniqueSizes  = (variants: Variant[], color?: string) =>
  [...new Set(variants.filter(v => !color || v.color === color).map(v => v.size))];

export default function ProductDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  // ── State ─────────────────────────────────────────────────────────────────
  const [cartCount, setCartCount]         = useState(0);
  const [product, setProduct]             = useState<Product | null>(null);
  const [loading, setLoading]             = useState(true);
  const [imgIndex, setImgIndex]           = useState(0);
  const [quantity, setQuantity]           = useState(1);
  const [added, setAdded]                 = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | undefined>();
  const [selectedSize, setSelectedSize]   = useState<string | undefined>();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // ── Load cart count ───────────────────────────────────────────────────────
  useEffect(() => {
    cartApi.getCart()
      .then(cart => setCartCount(cart.items.length))
      .catch(() => {});
  }, []);

  // ── Load product ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    productApi.getById(id)
      .then(p => {
        setProduct(p);
        const validVariants = (p.variants ?? []).filter(v => v.color && v.size) as Variant[];
        const colors = uniqueColors(validVariants);
        const sizes  = uniqueSizes(validVariants);
        if (colors.length === 1) setSelectedColor(colors[0]);
        if (sizes.length === 1)  setSelectedSize(sizes[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <View style={s.center}><ActivityIndicator color={TOKEN.black} /></View>;
  if (!product) return <View style={s.center}><Text style={{ color: TOKEN.muted }}>Không tìm thấy sản phẩm</Text></View>;

  // ── Computed ──────────────────────────────────────────────────────────────
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

  const btnLabel = outOfStock ? 'Hết hàng'
    : needsColor ? 'Chọn màu sắc'
    : needsSize  ? 'Chọn kích thước'
    : added      ? 'Đã thêm!'
    : `Thêm vào giỏ · ${formatPrice(finalPrice * quantity)}`;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleColorSelect = (color: string) => {
    setSelectedColor(color === selectedColor ? undefined : color);
    setSelectedSize(undefined);
    setQuantity(1);
  };

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size === selectedSize ? undefined : size);
    setQuantity(1);
  };

  const handleAddToCart = async () => {
    if (!product) return;
    if (needsColor) { Alert.alert('Chọn màu', 'Vui lòng chọn màu sắc'); return; }
    if (needsSize)  { Alert.alert('Chọn size', 'Vui lòng chọn kích thước'); return; }
    try {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
      setAdded(true);
      await cartApi.addToCart(product._id, quantity, selectedColor, selectedSize);
      setCartCount(c => c + quantity);
      setTimeout(() => setAdded(false), 2000);
    } catch (err: any) {
      setAdded(false);
      Alert.alert('Lỗi', err?.response?.data?.message || 'Không thể thêm vào giỏ');
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (needsColor) { Alert.alert('Chọn màu', 'Vui lòng chọn màu sắc'); return; }
    if (needsSize)  { Alert.alert('Chọn size', 'Vui lòng chọn kích thước'); return; }

    const item = {
      productId: product._id,
      quantity,
      price:     finalPrice,
      color:     selectedColor || '',
      size:      selectedSize  || '',
      name:      product.name,
      image:     product.images?.[0] || '',
      discount:  product.discount || 0,
    };

    const itemsParam = JSON.stringify([item]);

    AsyncStorage.setItem('buyNowItem', itemsParam)
      .finally(() => {
        router.push({
          pathname: '/checkout',
          params: { items: itemsParam, fromBuyNow: '1' },
        });
      });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ScrollView showsVerticalScrollIndicator={false} bounces>
        {/* Gallery */}
        <View style={s.gallery}>
          <Image source={{ uri: product.images?.[imgIndex] }} style={s.mainImg} resizeMode="cover" />
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color={TOKEN.black} />
          </TouchableOpacity>
          <TouchableOpacity style={s.cartBtn} onPress={() => router.push('/(tabs)/cart')}>
            <Ionicons name="bag-outline" size={18} color={TOKEN.black} />
            {cartCount > 0 && (
              <View style={s.cartDot}>
                <Text style={s.cartDotText}>{cartCount}</Text>
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

        {/* Info */}
        <View style={s.info}>
          <Text style={s.category}>{product.category?.name?.toUpperCase()}</Text>
          <Text style={s.name}>{product.name}</Text>

          <View style={s.metaRow}>
            <View style={s.ratingWrap}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={s.ratingText}>{product.averageRating?.toFixed(1) || '0.0'}</Text>
            </View>
            <Text style={s.metaDot}>·</Text>
            <Text style={s.sold}>{product.soldCount} đã bán</Text>
            <Text style={s.metaDot}>·</Text>
            <Text style={[s.stock, outOfStock && { color: '#EF4444' }]}>
              {outOfStock ? 'Hết hàng' : `Còn ${stockCount}`}
            </Text>
          </View>

          <View style={s.priceRow}>
            <Text style={s.price}>{formatPrice(finalPrice)}</Text>
            {product.discount > 0 && (
              <Text style={s.priceOld}>{formatPrice(basePrice)}</Text>
            )}
          </View>

          {/* Color selector */}
          {hasVariants && colors.length > 0 && (
            <View style={s.variantSection}>
              <Text style={s.variantLabel}>
                Màu sắc
                {selectedColor && <Text style={s.variantSelected}> · {selectedColor}</Text>}
              </Text>
              <View style={s.colorRow}>
                {colors.map(color => {
                  const active   = selectedColor === color;
                  const hasStock = (product.variants ?? []).some(v => v.color === color && v.stock > 0);
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[s.colorChip, active && s.colorChipActive, !hasStock && s.chipDisabled]}
                      onPress={() => hasStock && handleColorSelect(color)}
                      activeOpacity={hasStock ? 0.8 : 1}
                    >
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

          {/* Size selector */}
          {hasVariants && sizes.length > 0 && (
            <View style={s.variantSection}>
              <Text style={s.variantLabel}>
                Kích thước
                {selectedSize && <Text style={s.variantSelected}> · {selectedSize}</Text>}
              </Text>
              <View style={s.sizeRow}>
                {sizes.map(size => {
                  const active   = selectedSize === size;
                  const hasStock = (product.variants ?? []).some(
                    v => v.size === size && (!selectedColor || v.color === selectedColor) && v.stock > 0
                  );
                  return (
                    <TouchableOpacity
                      key={size}
                      style={[s.sizeChip, active && s.sizeChipActive, !hasStock && s.chipDisabled]}
                      onPress={() => hasStock && handleSizeSelect(size)}
                      activeOpacity={hasStock ? 0.8 : 1}
                    >
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
      </ScrollView>

      {/* Bottom bar */}
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

        {/* Thêm vào giỏ */}
        <TouchableOpacity
          style={[s.addBtn, (added || outOfStock || needsColor || needsSize) && s.addBtnDisabled]}
          onPress={handleAddToCart}
          disabled={outOfStock}
          activeOpacity={0.88}
        >
          <Ionicons name={added ? 'checkmark' : 'bag-add-outline'} size={18} color="#fff" />
        </TouchableOpacity>

        {/* Mua ngay */}
        <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={[s.buyBtn, outOfStock && s.buyBtnDisabled]}
            onPress={handleBuyNow}
            disabled={outOfStock}
            activeOpacity={0.88}
          >
            <Text style={s.buyBtnText}>
              {outOfStock ? 'Hết hàng' : `Mua ngay · ${formatPrice(finalPrice * quantity)}`}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#fff' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gallery:     { position: 'relative', backgroundColor: TOKEN.surface },
  mainImg:     { width, height: width },
  backBtn:     { position: 'absolute', top: 56, left: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  cartBtn:     { position: 'absolute', top: 56, right: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  cartDot:     { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: TOKEN.black, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
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
  variantSection: { marginBottom: 16 },
  variantLabel:   { fontSize: 13, fontWeight: '700', color: TOKEN.black, marginBottom: 10 },
  variantSelected:{ fontWeight: '500', color: TOKEN.muted },
  colorRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorChip:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: TOKEN.border, backgroundColor: '#fff', position: 'relative', overflow: 'hidden' },
  colorChipActive:     { borderColor: TOKEN.black, backgroundColor: TOKEN.black },
  colorChipText:       { fontSize: 13, fontWeight: '500', color: '#444' },
  colorChipTextActive: { color: '#fff', fontWeight: '700' },
  sizeRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sizeChip:    { minWidth: 48, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: TOKEN.border, backgroundColor: '#fff', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  sizeChipActive:     { borderColor: TOKEN.black, backgroundColor: TOKEN.black },
  sizeChipText:       { fontSize: 13, fontWeight: '500', color: '#444' },
  sizeChipTextActive: { color: '#fff', fontWeight: '700' },
  chipDisabled:     { borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' },
  chipDisabledText: { color: '#CCC' },
  strikethrough:    { position: 'absolute', top: '50%', left: 0, right: 0, height: 1, backgroundColor: '#CCC' },
  divider:   { height: 1, backgroundColor: TOKEN.surface, marginVertical: 20 },
  descLabel: { fontSize: 13, fontWeight: '800', color: TOKEN.black, marginBottom: 8 },
  desc:      { fontSize: 14, color: '#555', lineHeight: 22, marginBottom: 24 },
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
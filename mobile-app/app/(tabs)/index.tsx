import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Image, StyleSheet, ActivityIndicator, RefreshControl,
  Dimensions, StatusBar, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { productApi, Product, Category, formatPrice, getDiscountedPrice } from '@/src/api/productApi';
import { bannerApi, Banner } from '@/src/api/bannerApi';
import { useAuthStore } from '@/src/store/authStore';
import { useCartStore } from '@/src/store/cartStore';
import { useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');
const CARD  = (width - 48) / 2;
const TOKEN = { black: '#1A1A1A', surface: '#F5F5F0', border: '#E8E8E4', muted: '#AAAAAA', accent: '#ff4343', inline: '#ffffff' };

export default function HomeScreen() {
  const router      = useRouter();
  const { user }    = useAuthStore();

  // ✅ Lấy cả totalItems và syncCart từ store
  const totalItems  = useCartStore(s => s.totalItems);
  const syncCart    = useCartStore(s => s.syncCart);
  const cartCount   = totalItems();

  const [featured, setFeatured]     = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners]       = useState<Banner[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerIdx, setBannerIdx]   = useState(0);
  const bannerRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const [feat, cats, bans] = await Promise.all([
        productApi.getFeatured(8),
        productApi.getCategories(),
        bannerApi.getBanners(),
      ]);
      setFeatured(feat);
      setCategories(cats);
      setBanners(bans);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  // Load data lần đầu
  useEffect(() => { load(); }, []);

  // ✅ Mỗi lần focus vào HomeScreen → sync giỏ hàng từ API
  // Đảm bảo badge luôn đúng sau khi thêm/xóa sản phẩm rồi quay lại
  useFocusEffect(
    useCallback(() => {
      syncCart();
    }, [syncCart])
  );

  // Auto-scroll banner
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setBannerIdx(prev => {
        const next = (prev + 1) % banners.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 3500);
    return () => clearInterval(interval);
  }, [banners.length]);

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color={TOKEN.black} />
    </View>
  );

  const firstName = user?.name?.split(' ').pop() || 'bạn';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={TOKEN.black}
          />
        }
      >
        {/* ── Header ───────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Xin chào, {firstName} 👋</Text>
            <Text style={s.greetingSub}>Hôm nay mua gì?</Text>
          </View>

          <View style={s.headerActions}>
            {/* Nút Chat */}
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => router.push('/(tabs)/chat')}
              activeOpacity={0.75}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={TOKEN.black} />
            </TouchableOpacity>

            {/* ✅ Nút Giỏ hàng — badge số lượng từ API */}
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => router.push('/(tabs)/cart')}
              activeOpacity={0.75}
            >
              <Ionicons name="bag-outline" size={20} color={TOKEN.black} />
              {cartCount > 0 && (
                <View style={s.cartBadge}>
                  <Text style={s.cartBadgeText}>
                    {cartCount > 99 ? '99+' : cartCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Search ───────────────────────────────────────── */}
        <TouchableOpacity
          style={s.searchBar}
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/products')}
        >
          <Ionicons name="search-outline" size={18} color={TOKEN.muted} />
          <Text style={s.searchPlaceholder}>Tìm kiếm sản phẩm...</Text>
          <View style={s.filterBtn}>
            <Ionicons name="options-outline" size={16} color={TOKEN.black} />
          </View>
        </TouchableOpacity>

        {/* ── Banner ───────────────────────────────────────── */}
        {banners.length > 0 ? (
          <View style={s.bannerWrap}>
            <FlatList
              ref={bannerRef}
              data={banners}
              keyExtractor={b => b._id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
                setBannerIdx(Math.max(0, Math.min(idx, banners.length - 1)));
              }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.bannerSlide}
                  activeOpacity={0.92}
                  onPress={() => {
                    if (item.link) {
                      router.push({ pathname: '/(tabs)/products', params: { search: item.link } });
                    }
                  }}
                >
                  {item.image ? (
                    <>
                      <Image source={{ uri: item.image }} style={s.bannerImg} resizeMode="cover" />
                      {(item.title || item.subtitle) && (
                        <View style={s.bannerOverlay}>
                          {item.subtitle && <Text style={s.bannerOverlaySub}>{item.subtitle}</Text>}
                          {item.title    && <Text style={s.bannerOverlayTitle}>{item.title}</Text>}
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={s.bannerFallback}>
                      <View style={s.bannerContent}>
                        <Text style={s.bannerEyebrow}>{item.subtitle || 'KHUYẾN MÃI HÔM NAY'}</Text>
                        <Text style={s.bannerTitle}>{item.title || 'Giảm\nđến 50%'}</Text>
                        <View style={s.bannerCta}>
                          <Text style={s.bannerCtaText}>Mua ngay</Text>
                          <Ionicons name="arrow-forward" size={12} color={TOKEN.black} />
                        </View>
                      </View>
                      <Text style={{ fontSize: 64, lineHeight: 80 }}>🛍️</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
            {banners.length > 1 && (
              <View style={s.bannerDots}>
                {banners.map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      bannerRef.current?.scrollToIndex({ index: i, animated: true });
                      setBannerIdx(i);
                    }}
                  >
                    <View style={[s.bannerDot, i === bannerIdx && s.bannerDotActive]} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={s.bannerStatic}
            activeOpacity={0.92}
            onPress={() => router.push({ pathname: '/(tabs)/products', params: { type: 'sale' } })}
          >
            <View style={s.bannerContent}>
              <Text style={s.bannerEyebrow}>KHUYẾN MÃI HÔM NAY</Text>
              <Text style={s.bannerTitle}>Giảm{'\n'}đến 50%</Text>
              <View style={s.bannerCta}>
                <Text style={s.bannerCtaText}>Mua ngay</Text>
                <Ionicons name="arrow-forward" size={12} color={TOKEN.black} />
              </View>
            </View>
            <Text style={{ fontSize: 72, lineHeight: 88 }}>🛍️</Text>
          </TouchableOpacity>
        )}

        {/* ── Categories ───────────────────────────────────── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Danh mục</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.catList}
        >
          <TouchableOpacity style={s.catChip} onPress={() => router.push('/(tabs)/products')}>
            <Text style={s.catChipText}>Tất cả</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat._id}
              style={s.catChip}
              onPress={() => router.push({ pathname: '/(tabs)/products', params: { category: cat._id } })}
            >
              <Text style={s.catChipText}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Featured products ────────────────────────────── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Bán chạy</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/products')}>
            <Text style={s.seeAll}>Xem tất cả →</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={featured}
          keyExtractor={p => p._id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => router.push({ pathname: '/product/[id]', params: { id: item._id } })}
            />
          )}
        />

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
export function ProductCard({ product: p, onPress }: { product: Product; onPress: () => void }) {
  const final = getDiscountedPrice(p.price, p.discount);
  return (
    <TouchableOpacity style={[c.card, { width: CARD }]} onPress={onPress} activeOpacity={0.88}>
      <View style={c.imgWrap}>
        {p.images?.[0]
          ? <Image source={{ uri: p.images[0] }} style={c.img} resizeMode="cover" />
          : <View style={[c.img, c.imgEmpty]}>
              <Ionicons name="image-outline" size={28} color="#CCC" />
            </View>
        }
        {p.discount > 0 && (
          <View style={c.badge}>
            <Text style={c.badgeText}>-{p.discount}%</Text>
          </View>
        )}
      </View>
      <View style={c.body}>
        <Text style={c.name} numberOfLines={2}>{p.name}</Text>
        <View style={c.ratingRow}>
          <Ionicons name="star" size={10} color="#F59E0B" />
          <Text style={c.rating}>{p.averageRating?.toFixed(1) || '0.0'}</Text>
          <Text style={c.sold}> · {p.soldCount} đã bán</Text>
        </View>
        <Text style={c.price}>{formatPrice(final)}</Text>
        {p.discount > 0 && (
          <Text style={c.priceOld}>{formatPrice(p.price)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  greeting:      { fontSize: 20, fontWeight: '800', color: TOKEN.black },
  greetingSub:   { fontSize: 13, color: TOKEN.muted, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: TOKEN.surface,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },

  // ✅ Badge số lượng giỏ hàng
  cartBadge: {
    position: 'absolute',
    top: -2, right: -2,
    minWidth: 18, height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: '#fff',
    zIndex: 10,
  },
  cartBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', lineHeight: 11 },

  searchBar:         { flexDirection: 'row', alignItems: 'center', backgroundColor: TOKEN.surface, marginHorizontal: 20, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, gap: 10, marginBottom: 20 },
  searchPlaceholder: { flex: 1, fontSize: 14, color: TOKEN.muted },
  filterBtn:         { width: 30, height: 30, borderRadius: 8, backgroundColor: TOKEN.inline, alignItems: 'center', justifyContent: 'center' },

  bannerWrap:        { marginHorizontal: 20, marginBottom: 28 },
  bannerSlide:       { width: width - 40, height: 160, borderRadius: 20, overflow: 'hidden', backgroundColor: TOKEN.black },
  bannerImg:         { width: '100%', height: '100%' },
  bannerOverlay:     { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.45)', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  bannerOverlaySub:  { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1, marginBottom: 4 },
  bannerOverlayTitle:{ fontSize: 18, fontWeight: '900', color: '#fff' },
  bannerFallback:    { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, backgroundColor: TOKEN.black },
  bannerDots:        { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  bannerDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: TOKEN.border },
  bannerDotActive:   { width: 18, backgroundColor: TOKEN.black },
  bannerStatic:      { marginHorizontal: 20, backgroundColor: TOKEN.black, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  bannerContent:     { flex: 1 },
  bannerEyebrow:     { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 6 },
  bannerTitle:       { fontSize: 28, fontWeight: '900', color: '#fff', lineHeight: 32, marginBottom: 16 },
  bannerCta:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: TOKEN.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start' },
  bannerCtaText:     { fontSize: 12, fontWeight: '800', color: TOKEN.black },

  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: TOKEN.black },
  seeAll:       { fontSize: 13, fontWeight: '600', color: TOKEN.muted },

  catList:     { paddingHorizontal: 20, gap: 8, marginBottom: 28 },
  catChip:     { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: TOKEN.surface },
  catChipText: { fontSize: 13, fontWeight: '600', color: TOKEN.muted },
});

const c = StyleSheet.create({
  card:     { backgroundColor: TOKEN.surface, borderRadius: 16, overflow: 'hidden' },
  imgWrap:  { position: 'relative' },
  img:      { width: '100%', height: CARD * 0.9 },
  imgEmpty: { backgroundColor: '#EBEBEB', alignItems: 'center', justifyContent: 'center' },
  badge:    { position: 'absolute', top: 8, left: 8, backgroundColor: TOKEN.accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  badgeText:{ fontSize: 10, fontWeight: '800', color: TOKEN.black },
  body:     { padding: 10 },
  name:     { fontSize: 12, fontWeight: '600', color: TOKEN.black, lineHeight: 17, marginBottom: 4 },
  ratingRow:{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  rating:   { fontSize: 10, fontWeight: '600', color: TOKEN.black, marginLeft: 3 },
  sold:     { fontSize: 10, color: TOKEN.muted },
  price:    { fontSize: 14, fontWeight: '900', color: TOKEN.black },
  priceOld: { fontSize: 10, color: TOKEN.muted, textDecorationLine: 'line-through' },
});
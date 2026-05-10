import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { io, type Socket } from 'socket.io-client';

import AppHeader from '@/components/AppHeader';
import { ProductCard } from '@/components/ProductCard';
import { bannerApi, type Banner } from '@/src/api/bannerApi';
import flashSaleApi, { type FlashSalePromotion } from '@/src/api/flashSaleApi';
import { productApi, type Category, type Product } from '@/src/api/productApi';
import { SOCKET_URL } from '@/src/constants/config';
import { Colors, Radius } from '@/src/constants/theme';
import { useAuthStore } from '@/src/store/authStore';
import { useCartStore } from '@/src/store/cartStore';
import { tokenStorage } from '@/src/utils/tokenStorage';

const PAGE_PAD = 20;
const GRID_GAP = 12;

function getGridColumns(width: number) {
  if (width >= 900) return 4;
  if (width >= 700) return 3;
  return 2;
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isLoggedIn } = useAuthStore();

  const columns = getGridColumns(width);
  const cardWidth = Math.floor((width - PAGE_PAD * 2 - GRID_GAP * (columns - 1)) / columns);

  const heroWidth = width - PAGE_PAD * 2;
  const heroHeight = Math.round((heroWidth * 9) / 16);

  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [flashSales, setFlashSales] = useState<FlashSalePromotion[]>([]);
  const [nowTs, setNowTs] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [bannerIdx, setBannerIdx] = useState(0);
  const bannerRef = useRef<FlatList<Banner>>(null);
  const flashSocketRef = useRef<Socket | null>(null);
  const dotWidths = useRef<Animated.Value[]>([]);
  const isUserScrollingRef = useRef(false);

  const loadFlashSales = useCallback(async () => {
    try {
      const promotions = await flashSaleApi.getActive();
      setFlashSales(promotions);
    } catch {
      setFlashSales([]);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [feat, cats, bans, flashes] = await Promise.all([
        productApi.getFeatured(8),
        productApi.getCategories(),
        bannerApi.getBanners(),
        flashSaleApi.getActive(),
      ]);
      setFeatured(feat);
      setCategories(cats);
      setBanners(bans);
      setFlashSales(flashes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const poll = setInterval(loadFlashSales, 30000);
    return () => clearInterval(poll);
  }, [loadFlashSales]);

  useFocusEffect(
    useCallback(() => {
      useCartStore.getState().syncCart();
    }, []),
  );

  useEffect(() => {
    if (!isLoggedIn) {
      flashSocketRef.current?.disconnect();
      flashSocketRef.current = null;
      return;
    }

    let mounted = true;

    (async () => {
      const token = await tokenStorage.getAccessToken();
      if (!mounted || !token) return;

      const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 5,
        closeOnBeforeunload: false,
      });

      flashSocketRef.current = socket;

      const handleUpdate = () => {
        void loadFlashSales();
      };

      const handleRemaining = ({ promotionId, remaining }: { promotionId: string; remaining: number | null }) => {
        setFlashSales((prev) =>
          prev.map((item) =>
            String(item._id) === String(promotionId)
              ? { ...item, flashSaleRemaining: remaining }
              : item,
          ),
        );
      };

      socket.on('flash-sale:update', handleUpdate);
      socket.on('flash-sale:remaining', handleRemaining);

      socket.on('disconnect', (reason) => {
        if (reason === 'io server disconnect') {
          socket.connect();
        }
      });
    })();

    return () => {
      mounted = false;
      flashSocketRef.current?.disconnect();
      flashSocketRef.current = null;
    };
  }, [isLoggedIn, loadFlashSales]);

  // Initialize one Animated.Value per banner (6px = inactive, 28px = active)
  useEffect(() => {
    dotWidths.current = banners.map((_, i) => new Animated.Value(i === 0 ? 28 : 6));
  }, [banners.length]);

  // Animate active dot to pill, inactive back to circle
  useEffect(() => {
    dotWidths.current.forEach((v, i) => {
      Animated.spring(v, { toValue: i === bannerIdx ? 28 : 6, useNativeDriver: false, speed: 18, bounciness: 4 }).start();
    });
  }, [bannerIdx]);

  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      if (isUserScrollingRef.current) return;
      setBannerIdx((prev) => {
        const next = (prev + 1) % banners.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4200);

    return () => clearInterval(interval);
  }, [banners.length]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={Colors.light.text} />
      </View>
    );
  }

  const activeFlashSale =
    flashSales.find((item) => item.flashSaleRemaining === null || (item.flashSaleRemaining ?? 0) > 0) ||
    flashSales[0] ||
    null;
  const flashItem = activeFlashSale?.items?.[0] || null;
  const flashProduct = flashItem?.product || activeFlashSale?.products?.[0] || null;
  const flashPrice = flashItem?.price || activeFlashSale?.flashSalePrice || null;
  const flashItemCount = activeFlashSale?.items?.length || activeFlashSale?.productIds?.length || 0;
  const flashEndsAt = activeFlashSale?.endDate ? new Date(activeFlashSale.endDate).getTime() : null;
  const flashLeftMs = flashEndsAt ? Math.max(0, flashEndsAt - nowTs) : 0;
  const hh = String(Math.floor(flashLeftMs / 3600000)).padStart(2, '0');
  const mm = String(Math.floor((flashLeftMs % 3600000) / 60000)).padStart(2, '0');
  const ss = String(Math.floor((flashLeftMs % 60000) / 1000)).padStart(2, '0');

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.light.background} />
      <AppHeader title="Thời trang" subtitle="Unisex tối giản" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={Colors.light.text}
          />
        }
      >
        {activeFlashSale && flashProduct && (
          <TouchableOpacity
            style={s.flashSaleCard}
            activeOpacity={0.92}
            onPress={() => router.push({ pathname: '/product/[id]', params: { id: flashProduct._id } })}
          >
            <View style={s.flashSaleHeader}>
              <View style={s.flashSaleTitleRow}>
                <Text style={s.flashSaleChip}>Flash Sale</Text>
               
              </View>

              <View style={s.flashSaleMetaRow}>
                <View style={s.flashSaleMetaPill}>
                  <Text style={s.flashSaleMetaText}>
                    Còn lại: <Text style={s.flashSaleMetaStrong}>{activeFlashSale.flashSaleRemaining ?? '∞'}</Text>
                  </Text>
                </View>

                {flashItemCount > 1 && (
                  <View style={s.flashSaleMetaPill}>
                    <Text style={s.flashSaleMetaText}>{flashItemCount} sản phẩm</Text>
                  </View>
                )}

                <View style={s.flashSaleMetaPill}>
                  <Text style={[s.flashSaleMetaText, s.flashSaleClock]}>{hh}:{mm}:{ss}</Text>
                </View>
              </View>
            </View>

            <View style={s.flashSaleBody}>
              {flashProduct.images?.[0] ? (
                <Image source={{ uri: flashProduct.images[0] }} style={s.flashSaleImage} resizeMode="cover" />
              ) : (
                <View style={[s.flashSaleImage, s.flashSaleImageFallback]}>
                  <Ionicons name="flash-outline" size={20} color="#B45309" />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={s.flashSaleProductName} numberOfLines={2}>
                  {flashProduct.name}
                </Text>

                <View style={s.flashSalePriceRow}>
                  {flashPrice ? (
                    <Text style={s.flashSalePrice}>
                      {flashPrice.toLocaleString('vi-VN')}đ
                    </Text>
                  ) : null}
                  <Text style={s.flashSaleCta}>Nhấn để mua ngay</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {banners.length > 0 ? (
          <View style={s.heroWrap}>
            <FlatList
              ref={bannerRef}
              data={banners}
              keyExtractor={(b) => b._id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              decelerationRate="fast"
              onScrollBeginDrag={() => { isUserScrollingRef.current = true; }}
              onScrollEndDrag={() => { isUserScrollingRef.current = false; }}
              onMomentumScrollEnd={(e) => {
                isUserScrollingRef.current = false;
                const idx = Math.round(e.nativeEvent.contentOffset.x / heroWidth);
                setBannerIdx(Math.max(0, Math.min(idx, banners.length - 1)));
              }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.heroSlide, { width: heroWidth, height: heroHeight }]}
                  activeOpacity={0.9}
                  onPress={() => {
                    if (item.link) {
                      router.push({ pathname: '/(tabs)/products', params: { search: item.link } });
                    } else {
                      router.push('/(tabs)/products');
                    }
                  }}
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={s.heroImage} resizeMode="cover" />
                  ) : (
                    <View style={s.heroFallback} />
                  )}

                  <View style={s.heroOverlay}>
                    <Text style={s.heroEyebrow} numberOfLines={1}>
                      {item.subtitle || 'BỘ SƯU TẬP MỚI'}
                    </Text>
                    <Text style={s.heroTitle} numberOfLines={2}>
                      {item.title || 'Tối giản cho mọi giới'}
                    </Text>

                    <View style={s.heroCta}>
                      <Text style={s.heroCtaText}>Mua ngay</Text>
                      <Ionicons name="arrow-forward" size={16} color={Colors.light.text} />
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />

            {banners.length > 1 && (
              <View style={s.heroDots}>
                {banners.map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      bannerRef.current?.scrollToIndex({ index: i, animated: true });
                      setBannerIdx(i);
                    }}
                    activeOpacity={0.8}
                  >
                    <Animated.View
                      style={[
                        s.heroDot,
                        { width: dotWidths.current[i] ?? 6 },
                        i === bannerIdx && s.heroDotActive,
                      ]}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={s.heroWrap}>
            <TouchableOpacity
              style={[s.heroSlide, { width: heroWidth, height: heroHeight }]}
              activeOpacity={0.9}
              onPress={() => router.push('/(tabs)/products')}
            >
              <View style={s.heroFallback} />
              <View style={s.heroOverlay}>
                <Text style={s.heroEyebrow}>BỘ SƯU TẬP MỚI</Text>
                <Text style={s.heroTitle}>Tối giản cho mọi giới</Text>
                <View style={s.heroCta}>
                  <Text style={s.heroCtaText}>Mua ngay</Text>
                  <Ionicons name="arrow-forward" size={16} color={Colors.light.text} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Danh mục</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.catList}
        >
          <TouchableOpacity
            style={[s.catChip, s.catChipActive]}
            onPress={() => router.push('/(tabs)/products')}
            activeOpacity={0.8}
          >
            <Text style={[s.catChipText, s.catChipTextActive]}>Tất cả</Text>
          </TouchableOpacity>

          {categories.map((cat) => (
            <TouchableOpacity
              key={cat._id}
              style={s.catChip}
              onPress={() =>
                router.push({ pathname: '/(tabs)/products', params: { category: cat._id } })
              }
              activeOpacity={0.8}
            >
              <Text style={s.catChipText}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Bán chạy</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/products')} activeOpacity={0.8}>
            <Text style={s.seeAll}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={featured}
          keyExtractor={(p) => p._id}
          numColumns={columns}
          columnWrapperStyle={{ gap: GRID_GAP }}
          contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GRID_GAP }}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              width={cardWidth}
              onPress={() =>
                router.push({ pathname: '/product/[id]', params: { id: item._id } })
              }
            />
          )}
        />

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: PAGE_PAD,
    marginTop: 10,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  searchPlaceholder: { flex: 1, fontSize: 14, color: Colors.light.muted },
  searchAction: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroWrap: { marginHorizontal: PAGE_PAD, marginBottom: 18 },
  flashSaleCard: {
    marginHorizontal: PAGE_PAD,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F6D28B',
    backgroundColor: '#FFF7E6',
    gap: 12,
  },
  flashSaleHeader: {
    gap: 10,
  },
  flashSaleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flashSaleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F59E0B',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  flashSaleName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  flashSaleMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flashSaleMetaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.08)',
    backgroundColor: '#FFFFFF',
  },
  flashSaleMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  flashSaleMetaStrong: {
    fontWeight: '800',
    color: '#B45309',
  },
  flashSaleClock: {
    fontFamily: 'monospace',
    color: '#111111',
  },
  flashSaleBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flashSaleImage: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  flashSaleImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3D6',
  },
  flashSaleProductName: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: '#111111',
  },
  flashSalePriceRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  flashSalePrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
  },
  flashSaleCta: {
    fontSize: 12,
    color: '#64748B',
  },
  heroSlide: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.light.text,
  },
  heroImage: { width: '100%', height: '100%' },
  heroFallback: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.light.text },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.background,
    lineHeight: 26,
    marginBottom: 12,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroCtaText: { fontSize: 13, fontWeight: '700', color: Colors.light.text },

  heroDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  heroDot: {
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.light.border,
  },
  heroDotActive: {
    backgroundColor: Colors.light.text,
  },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: PAGE_PAD,
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.text,
    letterSpacing: 0.2,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.muted,
  },

  catList: {
    paddingHorizontal: PAGE_PAD,
    paddingBottom: 8,
    gap: 10,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  catChipActive: {
    backgroundColor: Colors.light.text,
    borderColor: Colors.light.text,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
  catChipTextActive: {
    color: Colors.light.background,
  },
});

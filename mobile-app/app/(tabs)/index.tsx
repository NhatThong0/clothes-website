import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
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

import AppHeader from '@/components/AppHeader';
import { ProductCard } from '@/components/ProductCard';
import { bannerApi, type Banner } from '@/src/api/bannerApi';
import { productApi, type Category, type Product } from '@/src/api/productApi';
import { Colors, Radius } from '@/src/constants/theme';
import { useCartStore } from '@/src/store/cartStore';

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

  const columns = getGridColumns(width);
  const cardWidth = Math.floor((width - PAGE_PAD * 2 - GRID_GAP * (columns - 1)) / columns);

  const heroWidth = width - PAGE_PAD * 2;
  const heroHeight = Math.round((heroWidth * 9) / 16);

  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [bannerIdx, setBannerIdx] = useState(0);
  const bannerRef = useRef<FlatList<Banner>>(null);

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

  useFocusEffect(
    useCallback(() => {
      useCartStore.getState().syncCart();
    }, []),
  );

  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
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
              onMomentumScrollEnd={(e) => {
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
                    style={[s.heroDot, i === bannerIdx && s.heroDotActive]}
                  />
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
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.border,
  },
  heroDotActive: {
    width: 18,
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

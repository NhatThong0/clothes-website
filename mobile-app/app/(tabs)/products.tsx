import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView, StatusBar, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { productApi, Product, Category } from '@/src/api/productApi';
import { ProductCard } from './index';

const TOKEN = { black: '#1A1A1A', surface: '#F5F5F0', border: '#E8E8E4', muted: '#AAAAAA', accent: '#ff0000' };

type Sort = 'newest' | 'price-low' | 'price-high' | 'discount';
const SORTS: { label: string; value: Sort }[] = [
  { label: 'Mới nhất', value: 'newest' },
  { label: 'Giá tăng', value: 'price-low' },
  { label: 'Giá giảm', value: 'price-high' },
  { label: 'Giảm giá', value: 'discount' },
];

export default function ProductsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string; category?: string; type?: string }>();

  const [products, setProducts]       = useState<Product[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch]           = useState(params.search || '');
  const [activeCat, setActiveCat]     = useState(params.category || '');
  const [sort, setSort]               = useState<Sort>('newest');
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const inputRef = useRef<TextInput>(null);

  const fetchProducts = useCallback(async (p = 1, reset = true) => {
    try {
      p === 1 ? setLoading(true) : setLoadingMore(true);
      const res = await productApi.getAll({
        page: p, limit: 12,
        search:   search   || undefined,
        category: activeCat || undefined,
        sort,
        type: params.type as any || undefined,
      });
      reset ? setProducts(res.data) : setProducts(prev => [...prev, ...res.data]);
      setHasMore(p < res.pagination.pages);
      setPage(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [search, activeCat, sort, params.type]);

  useEffect(() => { productApi.getCategories().then(setCategories); }, []);
  useEffect(() => { fetchProducts(1, true); }, [fetchProducts]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Search header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <Ionicons name="arrow-back" size={18} color={TOKEN.black} />
        </TouchableOpacity>
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={15} color={TOKEN.muted} />
          <TextInput
            ref={inputRef}
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm kiếm..."
            placeholderTextColor={TOKEN.muted}
            returnKeyType="search"
            onSubmitEditing={() => fetchProducts(1, true)}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={15} color="#CCC" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Category chips — ảnh tròn + label ── */}
      <View style={s.catBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.catRow}
        >
          {/* Nút "Tất cả" */}
          <TouchableOpacity
            style={s.catItem}
            onPress={() => setActiveCat('')}
            activeOpacity={0.8}
          >
            <View style={[s.catImgWrap, !activeCat && s.catImgWrapActive]}>
              <View style={s.catAllIcon}>
                <Ionicons name="grid-outline" size={20} color={!activeCat ? '#fff' : TOKEN.muted} />
              </View>
            </View>
            <Text style={[s.catLabel, !activeCat && s.catLabelActive]} numberOfLines={1}>
              Tất cả
            </Text>
          </TouchableOpacity>

          {categories.map(cat => (
            <TouchableOpacity
              key={cat._id}
              style={s.catItem}
              onPress={() => setActiveCat(activeCat === cat._id ? '' : cat._id)}
              activeOpacity={0.8}
            >
              <View style={[s.catImgWrap, activeCat === cat._id && s.catImgWrapActive]}>
                {cat.image ? (
                  <Image
                    source={{ uri: cat.image }}
                    style={s.catImg}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="pricetag-outline" size={20} color={activeCat === cat._id ? '#fff' : TOKEN.muted} />
                )}
              </View>
              <Text style={[s.catLabel, activeCat === cat._id && s.catLabelActive]} numberOfLines={1}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Sort bar ── */}
      <View style={s.sortBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.sortRow}
        >
          {SORTS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[s.sortChip, sort === opt.value && s.sortChipActive]}
              onPress={() => setSort(opt.value)}
              activeOpacity={0.75}
            >
              <Text style={[s.sortText, sort === opt.value && s.sortTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Product grid ── */}
      {loading ? (
        <View style={s.center}><ActivityIndicator color={TOKEN.black} /></View>
      ) : products.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="search-outline" size={48} color="#CCC" />
          <Text style={s.emptyText}>Không tìm thấy sản phẩm</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={i => i._id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => { if (!loadingMore && hasMore) fetchProducts(page + 1, false); }}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => router.push({ pathname: '/product/[id]', params: { id: item._id } })}
            />
          )}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={TOKEN.black} style={{ marginTop: 16 }} />
              : null
          }
        />
      )}
    </View>
  );
}

const CAT_IMG_SIZE = 56;

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: TOKEN.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKEN.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    minWidth: 0,
  },
  searchInput: { flex: 1, fontSize: 14, color: TOKEN.black, minWidth: 0 },

  /* ── Category — ảnh tròn ── */
  catBarWrapper: {
    borderBottomWidth: 0.5,
    borderBottomColor: TOKEN.border,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  catItem: {
    alignItems: 'center',
    width: CAT_IMG_SIZE + 8,
    gap: 6,
  },
  catImgWrap: {
    width: CAT_IMG_SIZE,
    height: CAT_IMG_SIZE,
    borderRadius: CAT_IMG_SIZE / 2,
    backgroundColor: TOKEN.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  catImgWrapActive: {
    borderColor: TOKEN.black,
    backgroundColor: TOKEN.black,
  },
  catAllIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  catImg: {
    width: CAT_IMG_SIZE,
    height: CAT_IMG_SIZE,
    borderRadius: CAT_IMG_SIZE / 2,
  },
  catLabel:       { fontSize: 11, color: TOKEN.muted, fontWeight: '500', textAlign: 'center' },
  catLabelActive: { color: TOKEN.black, fontWeight: '700' },

  /* ── Sort chips ── */
  sortBarWrapper: {
    height: 46,
    borderBottomWidth: 0.5,
    borderBottomColor: TOKEN.border,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: TOKEN.surface,
    alignSelf: 'center',
  },
  sortChipActive: { backgroundColor: TOKEN.black },
  sortText:       { fontSize: 12, fontWeight: '600', color: TOKEN.muted },
  sortTextActive: { color: '#fff' },

  /* ── Empty ── */
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 14, color: TOKEN.muted },
});
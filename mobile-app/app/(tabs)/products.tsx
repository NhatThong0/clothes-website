import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '@/components/AppHeader';
import { ProductCard } from '@/components/ProductCard';
import { productApi, type Category, type Product } from '@/src/api/productApi';
import { Colors, Radius } from '@/src/constants/theme';

type Sort = 'newest' | 'price-low' | 'price-high' | 'discount';
const SORTS: { label: string; value: Sort }[] = [
  { label: 'Mới nhất', value: 'newest' },
  { label: 'Giá tăng dần', value: 'price-low' },
  { label: 'Giá giảm dần', value: 'price-high' },
  { label: 'Giảm giá nhiều', value: 'discount' },
];

const PAGE_PAD = 20;
const GRID_GAP = 12;

function getGridColumns(width: number) {
  if (width >= 900) return 4;
  if (width >= 700) return 3;
  return 2;
}

export default function ProductsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string; category?: string; type?: string }>();
  const { width } = useWindowDimensions();

  const columns = getGridColumns(width);
  const cardWidth = Math.floor((width - PAGE_PAD * 2 - GRID_GAP * (columns - 1)) / columns);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(params.search || '');
  const [activeCat, setActiveCat] = useState(params.category || '');
  const [sort, setSort] = useState<Sort>('newest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showFilter, setShowFilter] = useState(false);

  // State tạm trong bottom sheet — chỉ áp dụng khi bấm "Áp dụng"
  const [tempCat, setTempCat] = useState(params.category || '');
  const [tempSort, setTempSort] = useState<Sort>('newest');

  const slideAnim = useRef(new Animated.Value(0)).current;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeCat) count++;
    if (sort !== 'newest') count++;
    return count;
  }, [activeCat, sort]);

  const inputRef = useRef<TextInput>(null);

  const query = useMemo(
    () => ({
      search: search || undefined,
      category: activeCat || undefined,
      sort,
      type: (params.type as any) || undefined,
    }),
    [search, activeCat, sort, params.type],
  );

  const fetchProducts = useCallback(
    async (p = 1, reset = true) => {
      try {
        if (p === 1) setLoading(true);
        else setLoadingMore(true);
        const res = await productApi.getAll({ page: p, limit: 12, ...query });
        if (reset) setProducts(res.data);
        else setProducts((prev) => [...prev, ...res.data]);
        setHasMore(p < res.pagination.pages);
        setPage(p);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query],
  );

  useEffect(() => {
    productApi.getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    fetchProducts(1, true);
  }, [fetchProducts]);

  const openFilter = () => {
    // Sync state tạm với state hiện tại khi mở
    setTempCat(activeCat);
    setTempSort(sort);
    setShowFilter(true);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeFilter = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setShowFilter(false));
  };

  const applyFilter = () => {
    setActiveCat(tempCat);
    setSort(tempSort);
    closeFilter();
  };

  const clearFilter = () => {
    setTempCat('');
    setTempSort('newest');
  };

  const sheetTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.light.background} />
      <AppHeader title="Sản phẩm" showBack showChat={false} />

      {/* ── Search bar ── */}
      <View style={s.searchRow}>
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={16} color={Colors.light.muted} />
          <TextInput
            ref={inputRef}
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm kiếm…"
            placeholderTextColor={Colors.light.muted}
            returnKeyType="search"
            onSubmitEditing={() => fetchProducts(1, true)}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={16} color={Colors.light.muted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={s.filterBtn}
          activeOpacity={0.75}
          onPress={() => {
            inputRef.current?.blur();
            openFilter();
          }}
        >
          <Ionicons name="options-outline" size={18} color="#fff" />
          {activeFilterCount > 0 && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>
                {activeFilterCount > 9 ? '9+' : activeFilterCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Category chips ── */}
      <View style={s.chipBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={s.chipRow}
        >
          <TouchableOpacity
            style={[s.chip, !activeCat && s.chipActive]}
            onPress={() => { inputRef.current?.blur(); setActiveCat(''); }}
            activeOpacity={0.85}
          >
            <Text style={[s.chipText, !activeCat && s.chipTextActive]} numberOfLines={1}>
              Tất cả
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => {
            const active = activeCat === cat._id;
            return (
              <TouchableOpacity
                key={cat._id}
                style={[s.chip, active && s.chipActive]}
                onPress={() => { inputRef.current?.blur(); setActiveCat(active ? '' : cat._id); }}
                activeOpacity={0.85}
              >
                <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Product list ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.light.text} />
        </View>
      ) : products.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="search-outline" size={48} color={Colors.light.border} />
          <Text style={s.emptyText}>Không tìm thấy sản phẩm</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          key={String(columns)}
          keyExtractor={(i) => i._id}
          numColumns={columns}
          columnWrapperStyle={{ gap: GRID_GAP }}
          contentContainerStyle={{ padding: PAGE_PAD, gap: GRID_GAP, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => {
            if (!loadingMore && hasMore) fetchProducts(page + 1, false);
          }}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              width={cardWidth}
              onPress={() => router.push({ pathname: '/product/[id]', params: { id: item._id } })}
            />
          )}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={Colors.light.text} style={{ marginTop: 16 }} />
            ) : null
          }
        />
      )}

      {/* ── Bottom sheet bộ lọc nâng cao ── */}
      <Modal
        visible={showFilter}
        transparent
        animationType="none"
        onRequestClose={closeFilter}
      >
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={closeFilter}>
          <View style={s.backdrop} />
        </TouchableWithoutFeedback>

        {/* Sheet */}
        <Animated.View style={[s.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          {/* Handle */}
          <View style={s.sheetHandle} />

          {/* Header */}
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Bộ lọc</Text>
            <TouchableOpacity onPress={closeFilter} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={Colors.light.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

            {/* ── Sắp xếp ── */}
            <View style={s.sheetSection}>
              <Text style={s.sheetSectionTitle}>Sắp xếp</Text>
              <View style={s.sheetChipRow}>
                {SORTS.map((opt) => {
                  const active = tempSort === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[s.sheetChip, active && s.sheetChipActive]}
                      onPress={() => setTempSort(opt.value)}
                      activeOpacity={0.85}
                    >
                      {active && (
                        <Ionicons name="checkmark" size={13} color={Colors.light.background} style={{ marginRight: 4 }} />
                      )}
                      <Text style={[s.sheetChipText, active && s.sheetChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={s.sheetDivider} />

            {/* ── Danh mục ── */}
            <View style={s.sheetSection}>
              <Text style={s.sheetSectionTitle}>Danh mục</Text>
              <View style={s.sheetChipRow}>
                <TouchableOpacity
                  style={[s.sheetChip, !tempCat && s.sheetChipActive]}
                  onPress={() => setTempCat('')}
                  activeOpacity={0.85}
                >
                  {!tempCat && (
                    <Ionicons name="checkmark" size={13} color={Colors.light.background} style={{ marginRight: 4 }} />
                  )}
                  <Text style={[s.sheetChipText, !tempCat && s.sheetChipTextActive]}>
                    Tất cả
                  </Text>
                </TouchableOpacity>

                {categories.map((cat) => {
                  const active = tempCat === cat._id;
                  return (
                    <TouchableOpacity
                      key={cat._id}
                      style={[s.sheetChip, active && s.sheetChipActive]}
                      onPress={() => setTempCat(active ? '' : cat._id)}
                      activeOpacity={0.85}
                    >
                      {active && (
                        <Ionicons name="checkmark" size={13} color={Colors.light.background} style={{ marginRight: 4 }} />
                      )}
                      <Text style={[s.sheetChipText, active && s.sheetChipTextActive]} numberOfLines={1}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* ── Footer buttons ── */}
          <View style={s.sheetFooter}>
            <TouchableOpacity
              style={s.clearBtn}
              onPress={clearFilter}
              activeOpacity={0.8}
            >
              <Text style={s.clearBtnText}>Xoá tất cả</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.applyBtn}
              onPress={applyFilter}
              activeOpacity={0.88}
            >
              <Text style={s.applyBtnText}>
                Áp dụng{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.light.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Search ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: PAGE_PAD,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
    overflow: 'visible',
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 999,
    backgroundColor: Colors.light.surface,
    borderWidth: 0.5,
    borderColor: Colors.light.border,
    minWidth: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    minWidth: 0,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'visible',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.light.background,
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 12,
  },

  // ── Chips ──
  chipBarWrapper: {
    height: 60,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.light.border,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAGE_PAD,
    paddingVertical: 8,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: Colors.light.surface,
    alignSelf: 'center',
  },
  chipActive: {
    backgroundColor: Colors.light.text,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.muted,
  },
  chipTextActive: {
    color: Colors.light.background,
  },

  // ── Empty ──
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: Colors.light.muted },

  // ── Bottom sheet ──
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 34,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.light.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_PAD,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.light.border,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
  },
  sheetSection: {
    paddingHorizontal: PAGE_PAD,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sheetSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  sheetChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sheetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: Colors.light.surface,
    borderWidth: 0.5,
    borderColor: Colors.light.border,
  },
  sheetChipActive: {
    backgroundColor: Colors.light.text,
    borderColor: Colors.light.text,
  },
  sheetChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.muted,
  },
  sheetChipTextActive: {
    color: Colors.light.background,
  },
  sheetDivider: {
    height: 0.5,
    backgroundColor: Colors.light.border,
    marginHorizontal: PAGE_PAD,
    marginTop: 20,
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: PAGE_PAD,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: Colors.light.border,
  },
  clearBtn: {
    flex: 1,
    height: 50,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.muted,
  },
  applyBtn: {
    flex: 2,
    height: 50,
    borderRadius: 999,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.background,
  },
});
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { type Product, formatPrice, getDiscountedPrice } from '@/src/api/productApi';
import { Colors, Radius } from '@/src/constants/theme';

export function ProductCard({
  product,
  width,
  onPress,
}: {
  product: Product;
  width: number;
  onPress: () => void;
}) {
  const finalPrice = getDiscountedPrice(product.price, product.discount);

  return (
    <TouchableOpacity style={[s.card, { width }]} onPress={onPress} activeOpacity={0.9}>
      <View style={s.media}>
        {product.images?.[0] ? (
          <Image source={{ uri: product.images[0] }} style={s.image} resizeMode="cover" />
        ) : (
          <View style={[s.image, s.imageEmpty]}>
            <Ionicons name="image-outline" size={28} color={Colors.light.muted} />
          </View>
        )}

        {product.discount > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>-{product.discount}%</Text>
          </View>
        )}
      </View>

      <View style={s.body}>
        <Text style={s.name} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={s.metaRow}>
          <Ionicons name="star" size={12} color="#111111" />
          <Text style={s.rating}>{product.averageRating?.toFixed(1) ?? '0.0'}</Text>
          <Text style={s.dot}>·</Text>
          <Text style={s.sold}>{product.soldCount} đã bán</Text>
        </View>

        <View style={s.priceRow}>
          <Text style={s.price}>{formatPrice(finalPrice)}</Text>
          {product.discount > 0 && <Text style={s.priceOld}>{formatPrice(product.price)}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  media: {
    position: 'relative',
    backgroundColor: Colors.light.surface,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 5,
  },
  imageEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.light.text,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.background,
  },
  body: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  name: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rating: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
  },
  dot: {
    fontSize: 12,
    color: Colors.light.muted,
  },
  sold: {
    fontSize: 12,
    color: Colors.light.muted,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.light.text,
    letterSpacing: 0.2,
  },
  priceOld: {
    fontSize: 12,
    color: Colors.light.muted,
    textDecorationLine: 'line-through',
  },
});


// src/components/AppHeader.tsx
import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCartStore } from '@/src/store/cartStore';
import { useAuthStore } from '@/src/store/authStore';

const C = {
  black:   '#1A1A1A',
  surface: '#F5F5F0',
  border:  '#E8E8E4',
  muted:   '#9CA3AF',
  white:   '#FFFFFF',
};

import { useNotificationStore } from '@/src/store/notificationStore';
import NotificationBell from './NotificationBell';

interface AppHeaderProps {
  title?:       string;
  subtitle?:    string;
  showBack?:    boolean;
  onBack?:      () => void;
  showCart?:    boolean;
  showChat?:    boolean;
  showNotification?: boolean;
  showSearch?:  boolean;
  onSearch?:    () => void;
  transparent?: boolean;
  noBorder?:    boolean;
}

export default function AppHeader({
  title,
  subtitle,
  showBack,
  onBack,
  showCart   = true,
  showChat   = true,
  showNotification = true,
  showSearch = false,
  onSearch,
  transparent = false,
  noBorder    = false,
}: AppHeaderProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const unreadCount = useNotificationStore(s => s.unreadCount);

  // ✅ Subscribe trực tiếp items.length để re-render khi giỏ hàng thay đổi
  const cartCount = useCartStore(s =>
    s.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  // ✅ Sync giỏ hàng từ API khi component mount
  useEffect(() => {
    useCartStore.getState().syncCart();
  }, []);

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    router.back();
  };

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={transparent ? 'transparent' : C.white}
      />
      <View style={[
        s.header,
        transparent && s.transparent,
        !noBorder && !transparent && s.border,
      ]}>
        {/* ── Left ─────────────────────────────────────────── */}
        <View style={s.left}>
          {showBack && (
            <TouchableOpacity style={s.backBtn} onPress={handleBack} activeOpacity={0.75}>
              <Ionicons name="arrow-back" size={20} color={C.black} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            {subtitle ? (
              <Text style={s.subtitle}>{subtitle}</Text>
            ) : !showBack && user?.name ? (
              <Text style={s.subtitle}>
                Xin chào, {user.name.split(' ').pop()} 👋
              </Text>
            ) : null}
            {title && (
              <Text
                style={[s.title, showBack && s.titleSmall]}
                numberOfLines={1}
              >
                {title}
              </Text>
            )}
          </View>
        </View>

        {/* ── Right ────────────────────────────────────────── */}
        <View style={s.right}>
          {showSearch && (
            <IconBtn
              icon="search-outline"
              onPress={onSearch ?? (() => {})}
            />
          )}

          {showNotification && (
            <NotificationBell size={20} bgColor={C.surface} />
          )}

          {showChat && (
            <IconBtn
              icon="chatbubble-ellipses-outline"
              onPress={() => router.push('/(tabs)/chat')}
            />
          )}

          {showCart && (
            <IconBtn
              icon="bag-outline"
              badge={cartCount}
              onPress={() => router.push('/(tabs)/cart')}
            />
          )}
        </View>
      </View>
    </>
  );
}

// ── Icon Button ───────────────────────────────────────────────────────────────
function IconBtn({
  icon,
  badge = 0,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={ib.btn} onPress={onPress} activeOpacity={0.75}>
      <Ionicons name={icon} size={22} color={C.black} />
      {badge > 0 && (
        <View style={ib.badge}>
          <Text style={ib.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const STATUS_H = Platform.OS === 'ios' ? 0 : StatusBar.currentHeight ?? 0;

const s = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingTop:        Platform.OS === 'ios' ? 54 : STATUS_H + 12,
    paddingBottom:     12,
    backgroundColor:   C.white,
    gap:               8,
  },
  transparent: { backgroundColor: 'transparent' },
  border:      { borderBottomWidth: 0.5, borderBottomColor: C.border },

  left:       { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  subtitle:   { fontSize: 11, color: C.muted, marginBottom: 1 },
  title:      { fontSize: 22, fontWeight: '900', color: C.black },
  titleSmall: { fontSize: 17, fontWeight: '700' },

  right: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
});

const ib = StyleSheet.create({
  btn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  badge:     { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: C.white },
  badgeText: { fontSize: 9, fontWeight: '800', color: C.white, lineHeight: 11 },
});
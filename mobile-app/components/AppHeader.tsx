import React, { useEffect } from 'react';
import { Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Colors } from '@/src/constants/theme';
import { useAuthStore } from '@/src/store/authStore';
import { useCartStore } from '@/src/store/cartStore';
import NotificationBell from '@/components/NotificationBell';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  showCart?: boolean;
  showChat?: boolean;
  showNotification?: boolean;
  showSearch?: boolean;
  onSearch?: () => void;
  transparent?: boolean;
  noBorder?: boolean;
}

export default function AppHeader({
  title,
  subtitle,
  showBack,
  onBack,
  showCart = true,
  showChat = true,
  showNotification = true,
  showSearch = false,
  onSearch,
  transparent = false,
  noBorder = false,
}: AppHeaderProps) {
  const router = useRouter();
  const { user } = useAuthStore();

  const cartCount = useCartStore((s) =>
    s.items.reduce((sum, item) => sum + item.quantity, 0),
  );

  useEffect(() => {
    useCartStore.getState().syncCart();
  }, []);

  const handleBack = () => {
    if (onBack) return onBack();
    router.back();
  };

  const resolvedSubtitle = subtitle ?? (!showBack && user?.name ? `Xin chào, ${user.name.split(' ').pop()}` : undefined);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={transparent ? 'transparent' : Colors.light.background} />

      <View
        style={[
          s.header,
          transparent && s.transparent,
          !transparent && !noBorder && s.border,
        ]}
      >
        <View style={s.left}>
          {showBack && (
            <TouchableOpacity style={s.iconBtn} onPress={handleBack} activeOpacity={0.75}>
              <Ionicons name="arrow-back" size={20} color={Colors.light.text} />
            </TouchableOpacity>
          )}

          <View style={s.titleWrap}>
            {resolvedSubtitle ? <Text style={s.subtitle}>{resolvedSubtitle}</Text> : null}
            {title ? (
              <Text style={[s.title, showBack && s.titleSmall]} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={s.right}>
          {showSearch && (
            <IconBtn icon="search-outline" onPress={onSearch ?? (() => {})} />
          )}

          {showNotification && (
            <NotificationBell size={20} bgColor={Colors.light.surface} />
          )}

          {showChat && (
            <IconBtn icon="chatbubble-ellipses-outline" onPress={() => router.push('/(tabs)/chat')} />
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
      <Ionicons name={icon} size={22} color={Colors.light.text} />
      {badge > 0 && (
        <View style={ib.badge}>
          <Text style={ib.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const STATUS_H = Platform.OS === 'ios' ? 0 : StatusBar.currentHeight ?? 0;

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : STATUS_H + 12,
    paddingBottom: 12,
    backgroundColor: Colors.light.background,
    gap: 10,
  },
  transparent: { backgroundColor: 'transparent' },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.light.border },

  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  titleWrap: { flex: 1, minWidth: 0 },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  subtitle: { fontSize: 12, color: Colors.light.muted, marginBottom: 2 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.light.text, letterSpacing: 0.3 },
  titleSmall: { fontSize: 18, fontWeight: '700' },

  right: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
});

const ib = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.light.background,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.light.background,
    lineHeight: 11,
  },
});

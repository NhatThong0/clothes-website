import React from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/src/constants/theme';
import { useCartStore } from '@/src/store/cartStore';
import { useNotificationStore } from '@/src/store/notificationStore';

type TabName = 'index' | 'orders' | 'profile';

const HIDDEN_ROUTES = ['/chat', '/cart'];

const TABS: {
  name: TabName;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { name: 'index', label: 'Trang chủ', icon: 'home-outline', iconActive: 'home' },
  { name: 'orders', label: 'Đơn hàng', icon: 'receipt-outline', iconActive: 'receipt' },
  { name: 'profile', label: 'Tài khoản', icon: 'person-outline', iconActive: 'person' },
];

export function HeaderActions() {
  const router = useRouter();
  const totalItems = useCartStore((s) => s.totalItems);
  const cartCount = totalItems();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <View style={h.row}>
      <TouchableOpacity
        style={h.btn}
        onPress={() => router.push('/profile/notifications' as any)}
        activeOpacity={0.75}
      >
        <Ionicons name="notifications-outline" size={22} color={Colors.light.text} />
        {unreadCount > 0 && (
          <View style={h.badge}>
            <Text style={h.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={h.btn}
        onPress={() => router.push('/(tabs)/chat')}
        activeOpacity={0.75}
      >
        <Ionicons name="chatbubble-outline" size={22} color={Colors.light.text} />
      </TouchableOpacity>

      <TouchableOpacity
        style={h.btn}
        onPress={() => router.push('/(tabs)/cart')}
        activeOpacity={0.75}
      >
        <Ionicons name="bag-outline" size={22} color={Colors.light.text} />
        {cartCount > 0 && (
          <View style={h.badge}>
            <Text style={h.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

function FloatingTabBar({ state, navigation }: any) {
  const pathname = usePathname();
  if (HIDDEN_ROUTES.some((r) => pathname.startsWith(r))) return null;

  return (
    <View style={s.wrapper} pointerEvents="box-none">
      <View style={s.container}>
        {state.routes.map((route: any, index: number) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              style={[s.tabItem, isFocused && s.tabItemActive]}
              onPress={onPress}
              activeOpacity={0.75}
            >
              <Ionicons
                name={isFocused ? tab.iconActive : tab.icon}
                size={20}
                color={isFocused ? Colors.light.background : Colors.light.muted}
              />
              <Text style={[s.label, isFocused && s.labelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Trang chủ' }} />
      <Tabs.Screen name="orders" options={{ title: 'Đơn hàng' }} />
      <Tabs.Screen name="profile" options={{ title: 'Tài khoản' }} />

      <Tabs.Screen name="cart" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="products" options={{ href: null }} />
    </Tabs>
  );
}

const h = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.light.background,
  },
  badgeText: { fontSize: 8, fontWeight: '800', color: Colors.light.background },
});

const s = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 16,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.light.background,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 999,
    gap: 4,
  },
  tabItemActive: {
    backgroundColor: Colors.light.text,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.light.muted,
  },
  labelActive: {
    color: Colors.light.background,
  },
});

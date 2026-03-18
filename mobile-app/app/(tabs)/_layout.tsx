import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '@/src/store/cartStore';

const TOKEN = { black: '#1A1A1A', white: '#FFFFFF', muted: '#AAAAAA' };

type TabName = 'index' | 'cart' | 'orders' | 'chat' | 'profile';

const TABS: {
  name: TabName;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { name: 'index',   label: 'Home',     icon: 'home-outline',           iconActive: 'home' },
  { name: 'cart',    label: 'Giỏ hàng', icon: 'bag-outline',            iconActive: 'bag' },
  { name: 'orders',  label: 'Đơn hàng', icon: 'receipt-outline',        iconActive: 'receipt' },
  { name: 'chat',    label: 'Hỗ trợ',   icon: 'chatbubble-outline',     iconActive: 'chatbubble' },
  { name: 'profile', label: 'Tài khoản',icon: 'person-outline',         iconActive: 'person' },
];

function FloatingTabBar({ state, navigation }: any) {
  const totalItems = useCartStore(s => s.totalItems);
  const cartCount  = totalItems();

  return (
    <View style={s.wrapper} pointerEvents="box-none">
      <View style={s.container}>
        {state.routes.map((route: any, index: number) => {
          const tab     = TABS.find(t => t.name === route.name);
          if (!tab) return null;

          const isFocused = state.index === index;
          const isCart    = route.name === 'cart';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented)
              navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              style={s.tabItem}
              onPress={onPress}
              activeOpacity={0.75}
            >
              {isFocused && <View style={s.activePill} />}

              <View style={s.iconWrap}>
                <Ionicons
                  name={isFocused ? tab.iconActive : tab.icon}
                  size={21}
                  color={isFocused ? TOKEN.white : TOKEN.muted}
                />
                {isCart && cartCount > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                  </View>
                )}
              </View>

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
    <Tabs
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Home' }} />
      <Tabs.Screen name="cart"     options={{ title: 'Giỏ hàng' }} />
      <Tabs.Screen name="orders"   options={{ title: 'Đơn hàng' }} />
      <Tabs.Screen name="chat"     options={{ title: 'Hỗ trợ' }} />
      <Tabs.Screen name="profile"  options={{ title: 'Tài khoản' }} />
      <Tabs.Screen name="products" options={{ href: null }} />
    </Tabs>
  );
}

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
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderRadius: 32,
    paddingHorizontal: 6,
    paddingVertical: 8,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 24,
    position: 'relative',
    gap: 3,
  },
  activePill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 24,
  },
  iconWrap:    { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -5, right: -8,
    minWidth: 15, height: 15,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#1A1A1A',
  },
  badgeText:   { fontSize: 8, fontWeight: '800', color: TOKEN.white },
  label:       { fontSize: 9, fontWeight: '500', color: TOKEN.muted },
  labelActive: { color: TOKEN.white, fontWeight: '700' },
});
import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '@/src/store/cartStore';
import { useRouter, usePathname } from 'expo-router';

const TOKEN = { black: '#1A1A1A', white: '#FFFFFF', muted: '#AAAAAA' };

// ── Chỉ còn 3 tab chính ──────────────────────────────────────────────────────
type TabName = 'index' | 'orders' | 'profile';

const HIDDEN_ROUTES = ['/chat', '/cart',]; // Những route này sẽ ẩn tab bar khi truy cập

const TABS: {
  name: TabName;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { name: 'index',   label: 'Home',      icon: 'home-outline',    iconActive: 'home' },
  { name: 'orders',  label: 'Đơn hàng',  icon: 'receipt-outline', iconActive: 'receipt' },
  { name: 'profile', label: 'Tài khoản', icon: 'person-outline',  iconActive: 'person' },
];

// ── Header actions (giỏ hàng + chat) ────────────────────────────────────────
export function HeaderActions() {
  const router     = useRouter();
  const totalItems = useCartStore(s => s.totalItems);
  const cartCount  = totalItems();

  return (
    <View style={h.row}>
      {/* Nút Chat */}
      <TouchableOpacity style={h.btn} onPress={() => router.push('/(tabs)/chat')} activeOpacity={0.75}>
        <Ionicons name="chatbubble-outline" size={22} color={TOKEN.black} />
      </TouchableOpacity>

      {/* Nút Giỏ hàng */}
      <TouchableOpacity style={h.btn} onPress={() => router.push('/(tabs)/cart')} activeOpacity={0.75}>
        <Ionicons name="bag-outline" size={22} color={TOKEN.black} />
        {cartCount > 0 && (
          <View style={h.badge}>
            <Text style={h.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Floating Tab Bar ─────────────────────────────────────────────────────────
function FloatingTabBar({ state, navigation }: any) {
  const pathname = usePathname();
  if (HIDDEN_ROUTES.some(r => pathname.startsWith(r))) return null;

  return (
    <View style={s.wrapper} pointerEvents="box-none">
      <View style={s.container}>
        {state.routes.map((route: any, index: number) => {
          const tab = TABS.find(t => t.name === route.name);
          if (!tab) return null;

          const isFocused = state.index === index;

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

// ── Tab Layout ───────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Home' }} />
      <Tabs.Screen name="orders"   options={{ title: 'Đơn hàng' }} />
      <Tabs.Screen name="profile"  options={{ title: 'Tài khoản' }} />
      {/* Ẩn khỏi tab bar nhưng vẫn navigate được */}
      <Tabs.Screen name="cart"     options={{ href: null }} />
      <Tabs.Screen name="chat"     options={{ href: null }} />
      <Tabs.Screen name="products" options={{ href: null }} />
    </Tabs>
  );
}

// ── Header Actions styles ────────────────────────────────────────────────────
const h = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btn:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  badge:     { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff' },
  badgeText: { fontSize: 8, fontWeight: '800', color: '#fff' },
});

// ── Tab Bar styles ───────────────────────────────────────────────────────────
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
  activePill:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 24 },
  iconWrap:    { position: 'relative' },
  label:       { fontSize: 9, fontWeight: '500', color: TOKEN.muted },
  labelActive: { color: TOKEN.white, fontWeight: '700' },
});
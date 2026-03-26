import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNotificationStore } from '@/src/store/notificationStore';

interface Props {
  size?: number;
  color?: string;
  bgColor?: string;
}

export default function NotificationBell({ 
  size = 22, 
  color = '#1A1A1A',
  bgColor = '#F5F5F0'
}: Props) {
  const router = useRouter();
  const { unreadCount, notifications } = useNotificationStore();
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Rung chuông khi có thông báo mới
  useEffect(() => {
    if (unreadCount > 0) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [unreadCount, notifications?.[0]?._id]);

  return (
    <TouchableOpacity 
      style={[s.btn, { backgroundColor: bgColor, width: size + 18, height: size + 18 }]} 
      onPress={() => router.push('/profile/notifications' as any)}
      activeOpacity={0.75}
    >
      <Animated.View style={{ transform: [{ rotate: shakeAnim.interpolate({
        inputRange: [-10, 10],
        outputRange: ['-15deg', '15deg']
      }) }] }}>
        <Ionicons name="notifications-outline" size={size} color={color} />
      </Animated.View>
      
      {unreadCount > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
    zIndex: 10,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 11,
  },
});

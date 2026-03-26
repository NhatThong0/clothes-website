import React, { useEffect, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SectionList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNotificationStore, Notification } from '@/src/store/notificationStore';
import AppHeader from '@/components/AppHeader';

const TOKEN = { 
  black: '#1A1A1A', 
  white: '#FFFFFF', 
  muted: '#9CA3AF', 
  surface: '#F8F9FA',
  accent: '#EF4444',
  blue: '#2563EB',
  emerald: '#10B981',
  orange: '#F59E0B',
  rose: '#F43F5E',
  purple: '#8B5CF6'
};

export default function NotificationScreen() {
  const router = useRouter();
  const { 
    notifications, 
    loading, 
    fetchNotifications, 
    markAsRead, 
    markAllAsRead 
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Gom nhóm thông báo theo ngày
  const sections = useMemo(() => {
    const todayStr     = new Date().toDateString();
    const yesterday    = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const groups: Record<string, Notification[]> = {};
    
    notifications.forEach(notif => {
      const d = new Date(notif.createdAt);
      const dStr = d.toDateString();
      let label = dStr === todayStr ? 'Hôm nay' : (dStr === yesterdayStr ? 'Hôm qua' : d.toLocaleDateString('vi-VN'));
      
      if (!groups[label]) groups[label] = [];
      groups[label].push(notif);
    });

    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [notifications]);

  const handlePress = async (item: Notification) => {
    if (!item.isRead) markAsRead(item._id);
    
    // Điều hướng dựa trên loại và meta
    if (item.type === 'order' && item.meta?.orderId) {
      router.push(`/order/${item.meta.orderId}` as any);
    } else if (item.type === 'voucher') {
      router.push('/(tabs)' as any);
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const isNew = !item.isRead;
    // Lấy styleConfig từ item.type hoặc item.color nếu backend gửi
    const baseStyle = getNotifStyle(item.type);
    const itemColor = getColorHex(item.color as string) || baseStyle.color;
    
    return (
      <TouchableOpacity 
        style={[s.card, isNew && s.cardUnread]} 
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={s.iconWrap}>
          <View style={[s.iconBg, { backgroundColor: itemColor + '20' }]}>
            <Text style={{ fontSize: 20 }}>{getIconEmoji(item.icon as string) || '🔔'}</Text>
          </View>
          {isNew && <View style={s.unreadDot} />}
        </View>

        <View style={s.content}>
          <View style={s.headerRow}>
            <Text style={[s.title, isNew && s.titleUnread]} numberOfLines={1}>{item.title}</Text>
            <Text style={s.time}>{formatSimpleTime(item.createdAt)}</Text>
          </View>
          
          <Text style={[s.body, !isNew && s.bodyRead]} numberOfLines={2}>{item.message}</Text>

          {/* Hiển thị meta Chi tiết */}
          {item.meta && (
            <View style={s.metaRow}>
              {item.meta.orderId && (
                <View style={[s.metaBadge, { backgroundColor: itemColor + '15' }]}>
                  <Text style={[s.metaBadgeText, { color: itemColor, fontWeight: '800' }]}>
                    #{String(item.meta.orderId).slice(-8).toUpperCase()}
                  </Text>
                </View>
              )}
              {item.meta.status && (
                <View style={[s.statusBadge, { backgroundColor: getStatusColor(item.meta.status) }]}>
                  <Text style={s.statusBadgeText}>{getStatusLabel(item.meta.status)}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={16} color="#E5E7EB" style={{ alignSelf: 'center' }} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      <AppHeader 
        title="Thông báo" 
        showBack 
        showCart={false} 
        showChat={false}
        showNotification={false}
      />
      
      <View style={s.topActions}>
        <View style={s.countBadge}>
          <Text style={s.countText}>{notifications.length} tin mới</Text>
        </View>
        <TouchableOpacity onPress={markAllAsRead} activeOpacity={0.6}>
          <Text style={s.markAllText}>Đọc tất cả</Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item._id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>{title}</Text>
          </View>
        )}
        contentContainerStyle={s.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={fetchNotifications} 
            tintColor={TOKEN.blue}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <View style={s.emptyIconBg}>
                <Ionicons name="notifications-off-outline" size={48} color={TOKEN.muted} />
              </View>
              <Text style={s.emptyText}>Hộp thư rỗng</Text>
              <Text style={s.emptySubText}>Bạn sẽ nhận được thông báo về đơn hàng và ưu đãi tại đây</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const getNotifStyle = (type: string) => {
  switch (type) {
    case 'order':   return { icon: 'cart', bg: '#D1FAE5', color: TOKEN.blue };
    case 'promo':   return { icon: 'gift', bg: '#FFEDD5', color: TOKEN.orange };
    case 'system':  return { icon: 'shield-checkmark', bg: '#DBEAFE', color: TOKEN.blue };
    case 'refund':  return { icon: 'refresh-circle', bg: '#FFE4E6', color: TOKEN.rose };
    default:        return { icon: 'notifications', bg: '#F3F4F6', color: '#4B5563' };
  }
};

const getColorHex = (colorName: string) => {
  const map: Record<string, string> = {
    blue:   '#2563EB',
    green:  '#10B981',
    orange: '#F59E0B',
    red:    '#F43F5E',
    purple: '#8B5CF6',
    sky:    '#0EA5E9',
    slate:  '#64748B'
  };
  return map[colorName] || colorName;
};

const getIconEmoji = (icon: string) => {
  return icon; // Backend sends raw emoji
};

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    confirmed: '#3B82F6', // Blue
    shipped:   '#0EA5E9', // Sky
    delivered: '#10B981', // Green
    cancelled: '#EF4444', // Red
    returned:  '#8B5CF6', // Purple
  };
  return map[status] || '#9CA3AF';
};

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    confirmed: 'Đã xác nhận',
    shipped:   'Đang giao',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
    return_approved: 'Chờ trả hàng',
    returned:  'Đã trả hàng',
  };
  return map[status] || status;
};

const formatSimpleTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  countBadge: {
    backgroundColor: TOKEN.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countText: { fontSize: 12, color: '#4B5563', fontWeight: '700' },
  markAllText: { fontSize: 13, color: TOKEN.blue, fontWeight: '700' },
  
  list: { paddingBottom: 40 },
  sectionHeader: { 
    paddingHorizontal: 20, 
    paddingTop: 20, 
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  sectionHeaderText: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: TOKEN.muted, 
    textTransform: 'uppercase', 
    letterSpacing: 1 
  },

  card: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    gap: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  cardUnread: { backgroundColor: '#F0F7FF' },
  
  iconWrap: { position: 'relative' },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: TOKEN.accent,
    borderWidth: 2,
    borderColor: '#fff',
  },
  
  content: { flex: 1, gap: 4, justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 14, fontWeight: '600', color: '#4B5563', flex: 1, marginRight: 8 },
  titleUnread: { color: TOKEN.black, fontWeight: '800' },
  time: { fontSize: 10, color: TOKEN.muted, fontWeight: '500' },
  body: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  bodyRead: { color: '#9CA3AF' },
  
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  metaBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },
  statusText: {
    fontSize: 11,
    color: TOKEN.muted,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
  },

  empty: { marginTop: 120, alignItems: 'center', paddingHorizontal: 40 },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: TOKEN.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: { fontSize: 18, fontWeight: '800', color: TOKEN.black, marginBottom: 8 },
  emptySubText: { fontSize: 13, color: TOKEN.muted, textAlign: 'center', lineHeight: 20 },
});

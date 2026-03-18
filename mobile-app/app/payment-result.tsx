import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentResultScreen() {
  const router = useRouter();
  const { status, orderId } = useLocalSearchParams<{ status: string; orderId?: string }>();
  const success = status === 'success';

  return (
    <View style={s.root}>
      <View style={[s.iconWrap, { backgroundColor: success ? '#F0FDF4' : '#FEF2F2' }]}>
        <Ionicons
          name={success ? 'checkmark-circle' : 'close-circle'}
          size={64}
          color={success ? '#22C55E' : '#EF4444'}
        />
      </View>
      <Text style={s.title}>
        {success ? 'Thanh toán thành công!' : 'Thanh toán thất bại'}
      </Text>
      <Text style={s.sub}>
        {success
          ? 'Đơn hàng của bạn đã được xác nhận'
          : 'Giao dịch không thành công. Vui lòng thử lại.'}
      </Text>
      <TouchableOpacity
        style={s.btn}
        onPress={() => {
          if (success && orderId) {
            router.replace({ pathname: '/order/[id]', params: { id: orderId } });
          } else {
            router.replace('/(tabs)/orders');
          }
        }}
      >
        <Text style={s.btnText}>
          {success ? 'Xem đơn hàng' : 'Về trang đơn hàng'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  iconWrap: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title:    { fontSize: 22, fontWeight: '900', color: '#1A1A1A', textAlign: 'center' },
  sub:      { fontSize: 14, color: '#AAAAAA', textAlign: 'center', lineHeight: 20 },
  btn:      { backgroundColor: '#1A1A1A', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 14, marginTop: 8 },
  btnText:  { color: '#fff', fontSize: 15, fontWeight: '800' },
});

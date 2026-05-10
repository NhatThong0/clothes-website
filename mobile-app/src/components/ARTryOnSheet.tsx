import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Alert, ScrollView, Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '@/src/api/axiosConfig';

type Step = 'upload' | 'processing' | 'result';

interface Props {
  productId: string;
  productName: string;
  garmentImageUrl: string;
  onClose: () => void;
}

export default function ARTryOnSheet({ productId, productName, garmentImageUrl, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [personImageUri, setPersonImageUri] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async (source: 'camera' | 'library') => {
    const permResult = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permResult.granted) {
      Alert.alert('Cần quyền truy cập', `Vui lòng cấp quyền truy cập ${source === 'camera' ? 'camera' : 'thư viện ảnh'} trong Cài đặt.`);
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [3, 4] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [3, 4] });

    if (!result.canceled && result.assets[0]) {
      setPersonImageUri(result.assets[0].uri);
      setError(null);
    }
  };

  const handleTryOn = async () => {
    if (!personImageUri) return;
    setStep('processing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('productId', productId);
      formData.append('personImage', {
        uri: personImageUri,
        type: 'image/jpeg',
        name: 'person.jpg',
      } as any);

      const res = await api.post('/ar-tryon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180_000, // 3 minutes
      });

      setResultUrl(res.data.data.resultUrl);
      setStep('result');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể xử lý ảnh. Vui lòng thử lại.';
      setError(msg);
      setStep('upload');
    }
  };

  const handleReset = () => {
    setStep('upload');
    setPersonImageUri(null);
    setResultUrl(null);
    setError(null);
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerIcon}>
              <Text style={{ fontSize: 18 }}>✨</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>Thử đồ ảo</Text>
              <Text style={s.headerSub} numberOfLines={1}>{productName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

            {/* ── UPLOAD STEP ────────────────────────────────── */}
            {step === 'upload' && (
              <>
                {/* Image previews */}
                <View style={s.previewRow}>
                  <View style={s.previewItem}>
                    <Text style={s.previewLabel}>Sản phẩm</Text>
                    <Image source={{ uri: garmentImageUrl }} style={s.previewImg} resizeMode="cover" />
                  </View>

                  <View style={s.previewItem}>
                    <Text style={s.previewLabel}>Ảnh của bạn</Text>
                    {personImageUri ? (
                      <View>
                        <Image source={{ uri: personImageUri }} style={s.previewImg} resizeMode="cover" />
                        <TouchableOpacity onPress={() => setPersonImageUri(null)} style={s.removeImgBtn}>
                          <Text style={s.removeImgBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={s.pickPlaceholder}>
                        <Text style={{ fontSize: 28, marginBottom: 8 }}>📷</Text>
                        <Text style={s.pickPlaceholderText}>Chọn ảnh toàn thân</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Pick source buttons */}
                {!personImageUri && (
                  <View style={s.pickBtnRow}>
                    <TouchableOpacity style={[s.pickBtn, s.pickBtnCamera]} onPress={() => pickImage('camera')}>
                      <Text style={s.pickBtnIcon}>📸</Text>
                      <Text style={s.pickBtnText}>Chụp ảnh</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.pickBtn, s.pickBtnLibrary]} onPress={() => pickImage('library')}>
                      <Text style={s.pickBtnIcon}>🖼️</Text>
                      <Text style={s.pickBtnText}>Chọn từ thư viện</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Tips */}
                <View style={s.tipBox}>
                  <Text style={s.tipText}>
                    💡 <Text style={{ fontWeight: '700' }}>Mẹo:</Text> Ảnh toàn thân, đứng thẳng, nền đơn giản, ánh sáng đủ để có kết quả đẹp nhất.
                  </Text>
                </View>

                {error && (
                  <View style={s.errorBox}>
                    <Text style={s.errorText}>✗ {error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[s.tryOnBtn, !personImageUri && s.tryOnBtnDisabled]}
                  onPress={handleTryOn}
                  disabled={!personImageUri}
                  activeOpacity={0.85}>
                  <Text style={s.tryOnBtnText}>✨ Thử đồ với AI</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── PROCESSING STEP ────────────────────────────── */}
            {step === 'processing' && (
              <View style={s.processingWrap}>
                <View style={s.processingIcon}>
                  <ActivityIndicator size="large" color="#9333EA" />
                </View>
                <Text style={s.processingTitle}>AI đang xử lý ảnh...</Text>
                <Text style={s.processingSubtitle}>Quá trình mất khoảng 30–60 giây</Text>
                <Text style={s.processingNote}>Vui lòng không đóng màn hình này</Text>
              </View>
            )}

            {/* ── RESULT STEP ────────────────────────────────── */}
            {step === 'result' && resultUrl && (
              <>
                <View style={s.resultHeader}>
                  <Text style={s.resultHeaderText}>✓ Kết quả thử đồ của bạn</Text>
                </View>
                <Image source={{ uri: resultUrl }} style={s.resultImg} resizeMode="contain" />
                <View style={s.resultBtnRow}>
                  <TouchableOpacity style={s.retryBtn} onPress={handleReset} activeOpacity={0.85}>
                    <Text style={s.retryBtnText}>Thử lại</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.openBtn}
                    onPress={() => Linking.openURL(resultUrl)}
                    activeOpacity={0.85}>
                    <Text style={s.openBtnText}>Xem ảnh đầy đủ</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const PURPLE = '#9333EA';
const PURPLE_LIGHT = '#F3E8FF';

const s = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', paddingBottom: 32 },

  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerIcon:  { width: 40, height: 40, borderRadius: 12, backgroundColor: PURPLE_LIGHT, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#111' },
  headerSub:   { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  closeBtnText:{ fontSize: 14, color: '#6B7280', fontWeight: '700' },

  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },

  previewRow:   { flexDirection: 'row', gap: 12, marginBottom: 16 },
  previewItem:  { flex: 1 },
  previewLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  previewImg:   { width: '100%', aspectRatio: 3/4, borderRadius: 12, backgroundColor: '#F9FAFB' },

  removeImgBtn:     { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  removeImgBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  pickPlaceholder:     { width: '100%', aspectRatio: 3/4, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  pickPlaceholderText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },

  pickBtnRow:     { flexDirection: 'row', gap: 10, marginBottom: 16 },
  pickBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  pickBtnCamera:  { borderColor: PURPLE, backgroundColor: PURPLE_LIGHT },
  pickBtnLibrary: { borderColor: '#6B7280', backgroundColor: '#F9FAFB' },
  pickBtnIcon:    { fontSize: 16 },
  pickBtnText:    { fontSize: 13, fontWeight: '700', color: '#374151' },

  tipBox:  { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 12, marginBottom: 14 },
  tipText: { fontSize: 12, color: '#92400E', lineHeight: 18 },

  errorBox:  { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { fontSize: 12, color: '#DC2626' },

  tryOnBtn:         { backgroundColor: PURPLE, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  tryOnBtnDisabled: { backgroundColor: '#E5E7EB' },
  tryOnBtnText:     { color: '#fff', fontSize: 15, fontWeight: '800' },

  processingWrap:     { alignItems: 'center', paddingVertical: 48, gap: 12 },
  processingIcon:     { width: 72, height: 72, borderRadius: 36, backgroundColor: PURPLE_LIGHT, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  processingTitle:    { fontSize: 16, fontWeight: '800', color: '#111' },
  processingSubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  processingNote:     { fontSize: 11, color: '#9CA3AF' },

  resultHeader:     { alignItems: 'center', marginBottom: 12 },
  resultHeaderText: { fontSize: 13, fontWeight: '700', color: '#059669' },
  resultImg:        { width: '100%', height: 400, borderRadius: 16, backgroundColor: '#F9FAFB', marginBottom: 16 },

  resultBtnRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  retryBtn:     { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center' },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  openBtn:      { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: PURPLE, alignItems: 'center' },
  openBtnText:  { fontSize: 14, fontWeight: '700', color: '#fff' },
});

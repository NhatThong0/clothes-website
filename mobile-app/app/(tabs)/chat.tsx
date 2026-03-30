import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, StatusBar, Animated, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/src/store/authStore';
import chatApi, { ChatMessage, ChatConversation } from '@/src/api/chatApi';
import { useChatSocket } from '@/hooks/useChatSocket';
import aiChatApi, { AiChatMessage, SuggestedProduct } from '@/src/api/aiChatApi';

const TOKEN = { black: '#1A1A1A', surface: '#F5F5F0', border: '#E8E8E4', muted: '#AAAAAA' };

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const groupByDate = (msgs: ChatMessage[]) => {
  const groups: { date: string; messages: ChatMessage[] }[] = [];
  msgs.forEach(msg => {
    const date = fmtDate(msg.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.messages.push(msg);
    else groups.push({ date, messages: [msg] });
  });
  return groups;
};

type Mode = 'support' | 'ai';

const groupByDateAi = (msgs: AiChatMessage[]) => {
  const groups: { date: string; messages: AiChatMessage[] }[] = [];
  msgs.forEach(msg => {
    const date = fmtDate(msg.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.messages.push(msg);
    else groups.push({ date, messages: [msg] });
  });
  return groups;
};

function ProductSuggestionCard({ p, onPress }: { p: SuggestedProduct; onPress: () => void }) {
  return (
    <TouchableOpacity style={pc.wrap} activeOpacity={0.85} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={pc.name} numberOfLines={2}>{p.name}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {!!p.discount && p.discount > 0 && (
            <View style={pc.badgeRed}><Text style={pc.badgeText}>-{p.discount}%</Text></View>
          )}
          {!!p.categoryName && (
            <View style={pc.badgeBlue}><Text style={pc.badgeBlueText}>{p.categoryName}</Text></View>
          )}
        </View>
        <Text style={pc.price}>
          {typeof p.price === 'number' ? p.price.toLocaleString('vi-VN') + ' ₫' : ''}
        </Text>
      </View>
      <View style={pc.btn}>
        <Text style={pc.btnText}>Xem</Text>
        <Ionicons name="chevron-forward" size={14} color="#2563EB" />
      </View>
    </TouchableOpacity>
  );
}

// ── In-app notification banner ────────────────────────────────────────────────
function NotifBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(dismiss, 3500);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,    duration: 250, useNativeDriver: true }),
    ]).start(onDismiss);
  };

  return (
    <Animated.View style={[nb.wrap, { transform: [{ translateY }], opacity }]}>
      <TouchableOpacity style={nb.inner} onPress={dismiss} activeOpacity={0.9}>
        <View style={nb.iconWrap}>
          <Ionicons name="headset" size={14} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={nb.title}>Hỗ trợ khách hàng</Text>
          <Text style={nb.body} numberOfLines={2}>{message}</Text>
        </View>
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={14} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const router   = useRouter();
  const { user } = useAuthStore();

  const [mode, setMode] = useState<Mode>('ai');

  const [conv, setConv]               = useState<ChatConversation | null>(null);
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(true);
  const [sending, setSending]         = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const [notifMsg, setNotifMsg]       = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const [aiMessages, setAiMessages]   = useState<AiChatMessage[]>([]);
  const [aiTyping, setAiTyping]       = useState(false);

  const flatRef  = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // ── Load conversation ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setError(null);
        if (mode === 'support') {
          const data = await chatApi.getMyConversation();
          setConv(data);
          setMessages(data.messages ?? []);
          if (data.unreadByUser > 0) chatApi.markRead().catch(() => {});
        } else {
          const ai = await aiChatApi.getMyConversation();
          setAiMessages(ai.messages ?? []);
        }
      } catch (e: any) {
        console.error('[Chat] load error:', e?.response?.data || e?.message || e);
        setError('Không thể tải cuộc trò chuyện. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    })();
  }, [mode]);

  // ── Nhận tin nhắn mới ─────────────────────────────────────────────────────
  const handleNewMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => {
      if (prev.some(m => m._id === msg._id)) return prev;
      return [...prev, msg];
    });
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    if (msg.senderRole === 'admin') {
      setNotifMsg(msg.content);
      chatApi.markRead().catch(() => {});
    }
  }, []);

  const { emitTyping, emitRead } = useChatSocket({
    convId:    conv?._id ?? null,
    onMessage: handleNewMessage,
    onTyping:  setAdminTyping,
    onReadAck: () => {
      setMessages(prev =>
        prev.map(m =>
          m.senderRole === 'customer' && !m.readAt
            ? { ...m, readAt: new Date().toISOString() }
            : m
        )
      );
    },
  });

  useEffect(() => {
    if (mode === 'support' && conv?._id) emitRead();
  }, [conv?._id]);

  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 150);
  }, [messages.length]);

  // ── Gửi tin nhắn ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    if (sending) return;

    if (mode === 'ai') {
      const tmpId = `tmp_ai_${Date.now()}`;
      const optimistic: AiChatMessage = {
        _id: tmpId,
        senderRole: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setAiMessages(prev => [...prev, optimistic]);
      setInput('');
      setAiTyping(true);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);

      try {
        setSending(true);
        const { ai } = await aiChatApi.sendMessage(text);
        // keep optimistic user message, append ai message
        setAiMessages(prev => [...prev, ai]);
      } catch (e: any) {
        setAiMessages(prev => prev.filter(m => m._id !== tmpId));
        setInput(text);
        const errMsg = e?.response?.data?.message || e?.message || 'Không thể gửi tin nhắn AI';
        Alert.alert('Lỗi chatbot AI', errMsg);
      } finally {
        setSending(false);
        setAiTyping(false);
      }
      return;
    }

    const tmpId = `tmp_${Date.now()}`;
    const optimistic: ChatMessage = {
      _id:        tmpId,
      senderId:   (user as any)?._id ?? (user as any)?.id ?? 'me',
      senderRole: 'customer',
      content:    text,
      type:       'text',
      isRead:     false,
      readAt:     null,
      createdAt:  new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimistic]);
    setInput('');
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      setSending(true);
      const saved = await chatApi.sendMessage(text);
      
      setMessages(prev => prev.map(m => m._id === tmpId ? saved : m));
    } catch (e: any) {

      // Rollback optimistic message
      setMessages(prev => prev.filter(m => m._id !== tmpId));
      setInput(text);

      const errMsg = e?.response?.data?.message || e?.message || 'Không thể gửi tin nhắn';
      Alert.alert('Lỗi gửi tin', errMsg);
    } finally {
      setSending(false);
    }
  };

  // ── Retry load ─────────────────────────────────────────────────────────────
  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'support') {
        const data = await chatApi.getMyConversation();
        setConv(data);
        setMessages(data.messages ?? []);
      } else {
        const ai = await aiChatApi.getMyConversation();
        setAiMessages(ai.messages ?? []);
      }
    } catch (e: any) {
      setError('Không thể kết nối. Kiểm tra mạng và thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // ── Loading / Error states ─────────────────────────────────────────────────
  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color={TOKEN.black} size="large" />
      <Text style={{ color: TOKEN.muted, marginTop: 12, fontSize: 13 }}>Đang tải...</Text>
    </View>
  );

  if (error) return (
    <View style={s.center}>
      <Ionicons name="wifi-outline" size={48} color={TOKEN.muted} />
      <Text style={{ color: TOKEN.black, marginTop: 12, fontSize: 15, fontWeight: '600' }}>
        Không thể kết nối
      </Text>
      <Text style={{ color: TOKEN.muted, marginTop: 6, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 }}>
        {error}
      </Text>
      <TouchableOpacity
        style={{ marginTop: 20, backgroundColor: TOKEN.black, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        onPress={handleRetry}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Thử lại</Text>
      </TouchableOpacity>
    </View>
  );

  const groups = mode === 'support' ? groupByDate(messages) : groupByDateAi(aiMessages);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* In-app notification banner */}
      {mode === 'support' && notifMsg && (
        <NotifBanner message={notifMsg} onDismiss={() => setNotifMsg(null)} />
      )}

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={TOKEN.black} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View>
            <Text style={s.headerName}>{mode === 'ai' ? 'Chatbot AI' : 'Hỗ trợ khách hàng'}</Text>
            <Text style={s.headerSub}>
              {mode === 'ai'
                ? (aiTyping ? '🟢 Đang trả lời...' : 'Gợi ý sản phẩm theo nhu cầu')
                : (adminTyping ? '🟢 Đang nhập...' : 'Thường phản hồi trong vài phút')
              }
            </Text>
          </View>
        </View>
      </View>

      {/* Mode switch */}
      <View style={s.modeRow}>
        <TouchableOpacity
          style={[s.modeBtn, mode === 'ai' && s.modeBtnActive]}
          onPress={() => setMode('ai')}
          activeOpacity={0.85}
        >
          <Ionicons name="sparkles-outline" size={14} color={mode === 'ai' ? '#fff' : TOKEN.black} />
          <Text style={[s.modeText, mode === 'ai' && s.modeTextActive]}>AI</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.modeBtn, mode === 'support' && s.modeBtnActive]}
          onPress={() => setMode('support')}
          activeOpacity={0.85}
        >
          <Ionicons name="headset-outline" size={14} color={mode === 'support' ? '#fff' : TOKEN.black} />
          <Text style={[s.modeText, mode === 'support' && s.modeTextActive]}>Hỗ trợ</Text>
        </TouchableOpacity>
      </View>

      {/* Messages + Input */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatRef}
          data={groups}
          keyExtractor={g => g.date}
          contentContainerStyle={s.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: group }) => (
            <View>
              <View style={s.dateDivider}>
                <View style={s.dateLine} />
                <Text style={s.dateText}>{group.date}</Text>
                <View style={s.dateLine} />
              </View>

              {group.messages.map((msg: any, idx: number) => {
                const isMe =
                  mode === 'support'
                    ? (msg as ChatMessage).senderRole === 'customer'
                    : (msg as AiChatMessage).senderRole === 'user';
                const isOptimistic = String(msg._id || '').startsWith(mode === 'support' ? 'tmp_' : 'tmp_ai_');
                const showAvatar =
                  mode === 'support'
                    ? (!isMe && (idx === 0 || group.messages[idx - 1]?.senderRole !== 'admin'))
                    : (!isMe && (idx === 0 || group.messages[idx - 1]?.senderRole !== 'ai'));

                return (
                  <View key={msg._id} style={[s.msgRow, isMe ? s.msgRowMe : s.msgRowThem]}>
                    {!isMe && (
                      showAvatar
                        ? <View style={s.adminAvatarSm}><Ionicons name={mode === 'ai' ? 'sparkles' : 'headset'} size={12} color="#fff" /></View>
                        : <View style={{ width: 28 }} />
                    )}
                    <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
                      <Text style={[s.bubbleText, isMe ? s.bubbleTextMe : s.bubbleTextThem]}>
                        {msg.content}
                      </Text>

                      {mode === 'ai' && (msg as AiChatMessage).senderRole === 'ai' && Array.isArray((msg as AiChatMessage).suggestedProducts) && (msg as AiChatMessage).suggestedProducts!.length > 0 && (
                        <View style={{ marginTop: 10, gap: 8 }}>
                          {(msg as AiChatMessage).suggestedProducts!.slice(0, 3).map((p, i) => (
                            <ProductSuggestionCard
                              key={`${p.productId || i}`}
                              p={p}
                              onPress={() => {
                                const pid = p.productId;
                                if (pid) router.push(`/product/${pid}` as any);
                              }}
                            />
                          ))}
                        </View>
                      )}

                      <View style={s.bubbleMeta}>
                        <Text style={[s.timeText, isMe && { color: 'rgba(255,255,255,0.55)' }]}>
                          {fmtTime(msg.createdAt)}
                        </Text>
                        {mode === 'support' && isMe && (
                          <Ionicons
                            name={isOptimistic ? 'time-outline' : msg.readAt ? 'checkmark-done' : 'checkmark'}
                            size={12}
                            color={msg.readAt ? '#60A5FA' : 'rgba(255,255,255,0.55)'}
                          />
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <View style={s.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={40} color={TOKEN.muted} />
              </View>
              <Text style={s.emptyTitle}>Bắt đầu cuộc trò chuyện</Text>
              <Text style={s.emptySub}>Chúng tôi sẽ phản hồi sớm nhất có thể</Text>
            </View>
          }
          ListFooterComponent={
            (mode === 'support' ? adminTyping : aiTyping) ? (
              <View style={[s.msgRow, s.msgRowThem, { marginTop: 4 }]}>
                <View style={s.adminAvatarSm}>
                  <Ionicons name={mode === 'ai' ? 'sparkles' : 'headset'} size={12} color="#fff" />
                </View>
                <View style={[s.bubble, s.bubbleThem, { paddingVertical: 14 }]}>
                  <View style={s.typingDots}>
                    {[0, 1, 2].map(i => <View key={i} style={s.typingDot} />)}
                  </View>
                </View>
              </View>
            ) : null
          }
        />

        {/* Input bar */}
        <View style={s.inputBar}>
          <TextInput
            ref={inputRef}
            style={s.input}
            value={input}
            onChangeText={v => { setInput(v); if (mode === 'support' && conv?._id) emitTyping(); }}
            placeholder={mode === 'ai' ? 'Bạn muốn mua gì?' : 'Nhập tin nhắn...'}
            placeholderTextColor={TOKEN.muted}
            multiline
            maxLength={mode === 'ai' ? 1000 : 2000}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="send" size={16} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: TOKEN.surface },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: TOKEN.surface, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerName:   { fontSize: 14, fontWeight: '700', color: TOKEN.black },
  headerSub:    { fontSize: 11, color: TOKEN.muted, marginTop: 1 },

  modeRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: TOKEN.surface },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 14, backgroundColor: TOKEN.surface, borderWidth: 1, borderColor: TOKEN.border },
  modeBtnActive: { backgroundColor: TOKEN.black, borderColor: TOKEN.black },
  modeText: { fontSize: 12, fontWeight: '800', color: TOKEN.black, letterSpacing: 0.2 },
  modeTextActive: { color: '#fff' },

  msgList:     { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 8 },
  dateDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  dateLine:    { flex: 1, height: 1, backgroundColor: TOKEN.border },
  dateText:    { fontSize: 11, color: TOKEN.muted, fontWeight: '500' },

  msgRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 2 },
  msgRowMe:   { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },

  adminAvatarSm:  { width: 28, height: 28, borderRadius: 14, backgroundColor: TOKEN.black, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble:         { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMe:       { backgroundColor: TOKEN.black, borderBottomRightRadius: 4 },
  bubbleThem:     { backgroundColor: TOKEN.surface, borderBottomLeftRadius: 4 },
  bubbleText:     { fontSize: 14, lineHeight: 20 },
  bubbleTextMe:   { color: '#fff' },
  bubbleTextThem: { color: TOKEN.black },
  bubbleMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 4 },
  timeText:       { fontSize: 10, color: TOKEN.muted },

  typingDots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  typingDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: TOKEN.muted },

  emptyWrap:  { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 10 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: TOKEN.surface, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: TOKEN.black },
  emptySub:   { fontSize: 13, color: TOKEN.muted, textAlign: 'center' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: TOKEN.surface,
  },
  input: {
    flex: 1, backgroundColor: TOKEN.surface, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: TOKEN.black, maxHeight: 120, minHeight: 42,
  },
  sendBtn:         { width: 42, height: 42, borderRadius: 21, backgroundColor: TOKEN.black, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: TOKEN.border },
});

const pc = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: TOKEN.border,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  name: { fontSize: 13, fontWeight: '800', color: TOKEN.black, lineHeight: 18 },
  price: { marginTop: 8, fontSize: 12, fontWeight: '800', color: '#2563EB' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE' },
  btnText: { fontSize: 12, fontWeight: '900', color: '#2563EB' },
  badgeRed: { backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  badgeBlue: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: '#DBEAFE' },
  badgeBlueText: { fontSize: 10, fontWeight: '900', color: '#2563EB' },
});

const nb = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 999, paddingTop: Platform.OS === 'ios' ? 52 : 12,
    paddingHorizontal: 12,
  },
  inner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  body:     { fontSize: 13, fontWeight: '500', color: '#fff', lineHeight: 18 },
});
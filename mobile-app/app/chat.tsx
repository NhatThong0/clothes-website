import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, StatusBar, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/src/store/authStore';
import chatApi, { ChatMessage, ChatConversation } from '@/src/api/chatApi';
import { useChatSocket } from '@/hooks/useChatSocket';

const TOKEN = { black: '#1A1A1A', surface: '#F5F5F0', border: '#E8E8E4', muted: '#AAAAAA' };

// ── Format giờ ────────────────────────────────────────────────────────────────
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

// Nhóm tin nhắn theo ngày
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

export default function ChatScreen() {
  const router       = useRouter();
  const { user }     = useAuthStore();

  const [conv, setConv]           = useState<ChatConversation | null>(null);
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);

  const flatRef = useRef<FlatList>(null);

  // ── Load conversation ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await chatApi.getMyConversation();
        setConv(data);
        setMessages(data.messages);
        // Đánh dấu đã đọc khi mở chat
        if (data.unreadByUser > 0) await chatApi.markRead();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Socket ────────────────────────────────────────────────────────────────
  const handleNewMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => {
      // Tránh duplicate nếu REST và socket cùng trả về
      if (prev.some(m => m._id === msg._id)) return prev;
      return [...prev, msg];
    });
    // Auto scroll xuống
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    // Đánh dấu đọc nếu từ admin
    if (msg.senderRole === 'admin') chatApi.markRead().catch(() => {});
  }, []);

  const { emitTyping, emitRead } = useChatSocket({
    convId:    conv?._id ?? null,
    onMessage: handleNewMessage,
    onTyping:  (t) => setAdminTyping(t),
    onReadAck: () => {},
  });

  // Emit read khi mở màn hình và có conv
  useEffect(() => {
    if (conv?._id) emitRead();
  }, [conv?._id]);

  // Auto scroll khi messages thay đổi
  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 150);
  }, [messages.length]);

  // ── Gửi tin nhắn ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    // Optimistic UI
    const optimistic: ChatMessage = {
      _id:        `tmp_${Date.now()}`,
      senderId:   user?._id ?? '',
      senderRole: 'customer',
      content:    text,
      type:       'text',
      isRead:     false,
      readAt:     null,
      createdAt:  new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      setSending(true);
      const saved = await chatApi.sendMessage(text);
      // Thay optimistic bằng tin thật
      setMessages(prev => prev.map(m => m._id === optimistic._id ? saved : m));
    } catch {
      // Rollback nếu lỗi
      setMessages(prev => prev.filter(m => m._id !== optimistic._id));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <View style={s.center}><ActivityIndicator color={TOKEN.black} /></View>
  );

  const groups = groupByDate(messages);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={TOKEN.black} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.adminAvatar}>
            <Ionicons name="headset" size={16} color="#fff" />
          </View>
          <View>
            <Text style={s.headerName}>Hỗ trợ khách hàng</Text>
            <Text style={s.headerSub}>
              {adminTyping ? 'Đang nhập...' : 'Thường phản hồi trong vài phút'}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatRef}
          data={groups}
          keyExtractor={g => g.date}
          contentContainerStyle={s.msgList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: group }) => (
            <View>
              {/* Date divider */}
              <View style={s.dateDivider}>
                <View style={s.dateLine} />
                <Text style={s.dateText}>{group.date}</Text>
                <View style={s.dateLine} />
              </View>

              {/* Messages in group */}
              {group.messages.map((msg: ChatMessage, idx: number)=> {
                const isMe = msg.senderRole === 'customer';
                const isOptimistic = msg._id.startsWith('tmp_');
                return (
                  <View
                    key={msg._id}
                    style={[s.msgRow, isMe ? s.msgRowMe : s.msgRowThem]}
                  >
                    {/* Admin avatar chỉ hiện ở tin đầu nhóm liên tiếp */}
                    {!isMe && (idx === 0 || group.messages[idx - 1]?.senderRole !== 'admin') ? (
                      <View style={s.adminAvatarSm}>
                        <Ionicons name="headset" size={12} color="#fff" />
                      </View>
                    ) : !isMe ? (
                      <View style={{ width: 28 }} />
                    ) : null}

                    <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
                      <Text style={[s.bubbleText, isMe ? s.bubbleTextMe : s.bubbleTextThem]}>
                        {msg.content}
                      </Text>
                      <View style={s.bubbleMeta}>
                        <Text style={[s.timeText, isMe && { color: 'rgba(255,255,255,0.6)' }]}>
                          {fmtTime(msg.createdAt)}
                        </Text>
                        {isMe && (
                          <Ionicons
                            name={isOptimistic ? 'time-outline' : msg.readAt ? 'checkmark-done' : 'checkmark'}
                            size={12}
                            color={msg.readAt ? '#60A5FA' : 'rgba(255,255,255,0.6)'}
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
            adminTyping ? (
              <View style={[s.msgRow, s.msgRowThem]}>
                <View style={s.adminAvatarSm}>
                  <Ionicons name="headset" size={12} color="#fff" />
                </View>
                <View style={[s.bubble, s.bubbleThem, s.typingBubble]}>
                  <View style={s.typingDots}>
                    {[0, 1, 2].map(i => (
                      <View key={i} style={s.typingDot} />
                    ))}
                  </View>
                </View>
              </View>
            ) : null
          }
        />

        {/* Input bar */}
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={v => { setInput(v); emitTyping(); }}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={TOKEN.muted}
            multiline
            maxLength={2000}
            returnKeyType="default"
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

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: TOKEN.surface,
  },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: TOKEN.surface, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  adminAvatar:  { width: 38, height: 38, borderRadius: 19, backgroundColor: TOKEN.black, alignItems: 'center', justifyContent: 'center' },
  headerName:   { fontSize: 14, fontWeight: '700', color: TOKEN.black },
  headerSub:    { fontSize: 11, color: TOKEN.muted, marginTop: 1 },

  /* Message list */
  msgList: { paddingHorizontal: 16, paddingVertical: 12, gap: 4, paddingBottom: 8 },

  /* Date divider */
  dateDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  dateLine:    { flex: 1, height: 1, backgroundColor: TOKEN.border },
  dateText:    { fontSize: 11, color: TOKEN.muted, fontWeight: '500' },

  /* Message row */
  msgRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 2 },
  msgRowMe:   { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },

  adminAvatarSm: { width: 28, height: 28, borderRadius: 14, backgroundColor: TOKEN.black, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  /* Bubble */
  bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, gap: 4 },
  bubbleMe:   { backgroundColor: TOKEN.black, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: TOKEN.surface, borderBottomLeftRadius: 4 },
  bubbleText:      { fontSize: 14, lineHeight: 20 },
  bubbleTextMe:    { color: '#fff' },
  bubbleTextThem:  { color: TOKEN.black },
  bubbleMeta:  { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  timeText:    { fontSize: 10, color: TOKEN.muted },

  /* Typing indicator */
  typingBubble: { paddingVertical: 12 },
  typingDots:   { flexDirection: 'row', gap: 4, alignItems: 'center' },
  typingDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: TOKEN.muted },

  /* Empty */
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 10 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: TOKEN.surface, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: TOKEN.black },
  emptySub:   { fontSize: 13, color: TOKEN.muted, textAlign: 'center' },

  /* Input bar */
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: TOKEN.surface,
  },
  input: {
    flex: 1, backgroundColor: TOKEN.surface, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: TOKEN.black,
    maxHeight: 120, minHeight: 42,
  },
  sendBtn:         { width: 42, height: 42, borderRadius: 21, backgroundColor: TOKEN.black, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: TOKEN.border },
});
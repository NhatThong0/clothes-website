import api from './axiosConfig';

export interface ChatMessage {
  _id:        string;
  senderId:   string;
  senderRole: 'customer' | 'admin';
  content:    string;
  type:       'text' | 'image';
  isRead:     boolean;
  readAt:     string | null;
  createdAt:  string;
}

export interface ChatConversation {
  _id:           string;
  userId:        string;
  messages:      ChatMessage[];
  lastMessage:   string;
  lastMessageAt: string;
  unreadByAdmin: number;
  unreadByUser:  number;
  isOpen:        boolean;
}

const chatApi = {
  /** Lấy hoặc tạo conversation của user hiện tại */
  async getMyConversation(): Promise<ChatConversation> {
    const { data } = await api.get('/chat/my');
    return data.data;
  },

  /** Gửi tin nhắn qua REST (fallback khi socket lỗi) */
  async sendMessage(content: string): Promise<ChatMessage> {
    const { data } = await api.post('/chat/my/send', { content });
    return data.data;
  },

  /** Đánh dấu đã đọc */
  async markRead(): Promise<void> {
    await api.post('/chat/my/read');
  },
};

export default chatApi;
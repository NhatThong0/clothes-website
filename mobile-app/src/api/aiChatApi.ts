import api from './axiosConfig';

export interface SuggestedProduct {
  productId?: string;
  name: string;
  price?: number;
  discount?: number;
  categoryName?: string;
  image?: string;
  stock?: number;
  rating?: number;
}

export interface AiChatMessage {
  _id: string;
  senderRole: 'user' | 'ai';
  content: string;
  suggestedProducts?: SuggestedProduct[];
  createdAt: string;
}

export interface AiChatConversation {
  _id: string;
  userId: string;
  messages: AiChatMessage[];
  lastMessage: string;
  lastMessageAt: string;
}

const aiChatApi = {
  async getMyConversation(): Promise<AiChatConversation> {
    const { data } = await api.get('/ai-chat/my');
    return data.data;
  },

  async sendMessage(content: string): Promise<{ user: AiChatMessage; ai: AiChatMessage }> {
    const { data } = await api.post('/ai-chat/my/send', { content });
    return data.data;
  },
};

export default aiChatApi;


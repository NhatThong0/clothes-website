import api from './axiosConfig';

export const paymentApi = {
  async createVnpayUrl(orderId: string): Promise<string> {
    const { data } = await api.post('/payment/vnpay-create', { orderId });
    return data.data.paymentUrl;
  },
};
import api from './axiosConfig';

export interface FlashSaleProduct {
  _id: string;
  name: string;
  images?: string[];
}

export interface FlashSaleItem {
  productId?: string;
  product?: FlashSaleProduct | null;
  price?: number | null;
}

export interface FlashSalePromotion {
  _id: string;
  name?: string;
  endDate?: string;
  flashSaleRemaining?: number | null;
  flashSalePrice?: number | null;
  items?: FlashSaleItem[];
  products?: FlashSaleProduct[];
  productIds?: string[];
}

const flashSaleApi = {
  async getActive(): Promise<FlashSalePromotion[]> {
    const { data } = await api.get<{ status: string; data?: { promotions?: FlashSalePromotion[] } }>('/flash-sale/active');
    return data.data?.promotions || [];
  },
};

export default flashSaleApi;

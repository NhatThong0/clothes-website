import api from './axiosConfig';

export interface Banner {
  _id:      string;
  image:    string;
  title:    string;
  subtitle: string;
  link:     string;
  isActive: boolean;
  order:    number;
}

export const bannerApi = {
  async getBanners(): Promise<Banner[]> {
    const { data } = await api.get<{ status: string; data: Banner[] }>('/banners');
    return data.data;
  },
};
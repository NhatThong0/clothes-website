import api from './axiosConfig';

export interface Category {
  _id: string;
  name: string;
  image?: string;
}

export interface Variant {
  color?: string;
  size?: string;
  stock: number;
  price?: number;
  sku?: string;
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  discount: number;
  images: string[];
  category: Category;
  soldCount: number;
  averageRating: number;
  stock: number;
  variants: Variant[];
  features?: string[];
  reviews?: Review[];
  isActive: boolean;
  createdAt: string;
}

export interface Review {
  _id: string;
  userId: { _id: string; name: string; avatar?: string };
  rating: number;
  comment: string;
  images?: string[];
  createdAt: string;
}

export interface ProductsQuery {
  page?:         number;
  limit?:        number;
  search?:       string;
  category?:     string;
  minPrice?:     number;
  maxPrice?:     number;
  sort?:         'newest' | 'price-low' | 'price-high' | 'discount';
  type?:         'sale' | 'new';
}

export interface ProductsResponse {
  status: string;
  data: Product[];
  pagination: {
    total: number;
    page:  number;
    limit: number;
    pages: number;
  };
}

export const productApi = {
  async getAll(query: ProductsQuery = {}): Promise<ProductsResponse> {
    const { data } = await api.get<ProductsResponse>('/products', { params: query });
    return data;
  },

  async getById(id: string): Promise<Product> {
    const { data } = await api.get<{ status: string; data: Product }>(`/products/${id}`);
    return data.data;
  },

  async getFeatured(limit = 6): Promise<Product[]> {
    const { data } = await api.get<{ status: string; data: Product[] }>('/products/featured', {
      params: { limit },
    });
    return data.data;
  },

  async getCategories(): Promise<Category[]> {
    const { data } = await api.get<{ status: string; data: Category[] }>('/products/categories');
    return data.data;
  },

  async getReviews(productId: string): Promise<Review[]> {
    const { data } = await api.get<{ status: string; data: Review[] }>(`/products/${productId}/reviews`);
    return data.data;
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const getDiscountedPrice = (price: number, discount: number) =>
  discount > 0 ? Math.round(price * (1 - discount / 100)) : price;

export const formatPrice = (price: number) =>
  price.toLocaleString('vi-VN') + 'đ';
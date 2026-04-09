// src/constants/theme.ts
// Unisex hiện đại, tối giản: nền trắng, nhấn đen + xám nhạt.
export const Colors = {
  light: {
    text: '#111111',
    background: '#FFFFFF',
    surface: '#F6F6F6',
    border: '#E5E7EB',
    muted: '#6B7280',
    icon: '#111111',
    tint: '#111111',

    success: '#16A34A',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  dark: {
    text: '#F5F5F5',
    background: '#0B0B0C',
    surface: '#121214',
    border: '#26272B',
    muted: '#9CA3AF',
    icon: '#F5F5F5',
    tint: '#FFFFFF',

    success: '#22C55E',
    warning: '#F59E0B',
    error: '#F87171',
  },
} as const;

export const Typography = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const Font = {
  // Giữ hệ chữ sans-serif mặc định của hệ điều hành.
  family: {
    regular: undefined,
    medium: undefined,
    semibold: undefined,
    bold: undefined,
  },
} as const;

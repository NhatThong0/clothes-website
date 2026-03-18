// src/constants/theme.ts — Cập nhật toàn bộ
export const Colors = {
  // Nền tảng Minimalism
  black:      '#1A1A1A',   // primary action, text
  white:      '#FFFFFF',   // surface
  surface:    '#F5F5F0',   // background, card fill
  border:     '#E8E8E4',   // dividers
  muted:      '#AAAAAA',   // secondary text
  accent:     '#e65c5c',   // highlight (sale badge, CTA phụ)

  // Semantic
  success:    '#22C55E',
  error:      '#EF4444',
  warning:    '#F59E0B',
} as const;

export const Typography = {
  xs: 10, sm: 12, md: 14, base: 16,
  lg: 18, xl: 20, '2xl': 24, '3xl': 30,
} as const;

export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32,
} as const;

export const Radius = {
  sm: 6, md: 10, lg: 14, xl: 20, full: 9999,
} as const;
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/src/constants/theme';

type Theme = keyof typeof Colors;

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof (typeof Colors)['light'],
) {
  const theme = (useColorScheme() ?? 'light') as Theme;
  const fromProps = props[theme];
  if (fromProps) return fromProps;
  return Colors[theme][colorName];
}

import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../store/settingsStore';
import { resolveTheme, ThemePalette } from './themes';

export function useTheme(): ThemePalette {
  const systemScheme = useColorScheme();
  const themeId = useSettingsStore((s) => s.themeId);
  return resolveTheme(themeId, systemScheme === 'dark');
}

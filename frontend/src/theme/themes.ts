// SelfTalk Theme System - 5 temas + auto
export type ThemeId = 'auto' | 'light' | 'dark' | 'cyberpunk' | 'pink' | 'minimal';

export interface ThemePalette {
  id: ThemeId;
  label: string;
  isDark: boolean;
  isSpecial: boolean;

  // Backgrounds
  background: string;
  surface: string;
  surfaceAlt: string;
  card: string;

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;

  // Borders / dividers
  border: string;
  divider: string;

  // Brand / accent
  primary: string;
  primarySoft: string;
  primaryGradient: [string, string, string];
  onPrimary: string;

  // Bubble
  bubbleBg: string;
  bubbleText: string;
  bubbleMeta: string;

  // Status
  danger: string;
  warning: string;
  success: string;

  // Input
  inputBg: string;
  inputText: string;
  placeholder: string;
}

// LIGHT
const LIGHT: ThemePalette = {
  id: 'light',
  label: 'Claro',
  isDark: false,
  isSpecial: false,
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  card: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  border: '#F1F5F9',
  divider: '#E2E8F0',
  primary: '#6366F1',
  primarySoft: '#E0E7FF',
  primaryGradient: ['#6366F1', '#8B5CF6', '#EC4899'],
  onPrimary: '#FFFFFF',
  bubbleBg: '#EEF2FF',
  bubbleText: '#1E1B4B',
  bubbleMeta: '#6366F1',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  inputBg: '#F1F5F9',
  inputText: '#0F172A',
  placeholder: '#94A3B8',
};

// DARK (estándar)
const DARK: ThemePalette = {
  id: 'dark',
  label: 'Oscuro',
  isDark: true,
  isSpecial: false,
  background: '#0F172A',
  surface: '#0F172A',
  surfaceAlt: '#1E293B',
  card: '#0F172A',
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textTertiary: '#94A3B8',
  border: '#1E293B',
  divider: '#334155',
  primary: '#8B5CF6',
  primarySoft: '#4338CA',
  primaryGradient: ['#6366F1', '#8B5CF6', '#EC4899'],
  onPrimary: '#FFFFFF',
  bubbleBg: '#312E81',
  bubbleText: '#E0E7FF',
  bubbleMeta: '#A78BFA',
  danger: '#F87171',
  warning: '#FBBF24',
  success: '#34D399',
  inputBg: '#1E293B',
  inputText: '#F8FAFC',
  placeholder: '#64748B',
};

// CYBERPUNK (neón, verde/cyan/magenta sobre negro)
const CYBERPUNK: ThemePalette = {
  id: 'cyberpunk',
  label: 'Cyberpunk',
  isDark: true,
  isSpecial: true,
  background: '#06030F',
  surface: '#0A0518',
  surfaceAlt: '#150B2E',
  card: '#0A0518',
  text: '#F0EBFF',
  textSecondary: '#B19CFF',
  textTertiary: '#7B6AB8',
  border: '#1E1140',
  divider: '#2A1A55',
  primary: '#00FFE5',
  primarySoft: '#0D3A36',
  primaryGradient: ['#00FFE5', '#FF00C8', '#A100FF'],
  onPrimary: '#06030F',
  bubbleBg: '#1A0B40',
  bubbleText: '#F0EBFF',
  bubbleMeta: '#FF00C8',
  danger: '#FF3366',
  warning: '#FFD600',
  success: '#00FFA3',
  inputBg: '#150B2E',
  inputText: '#F0EBFF',
  placeholder: '#5B4A88',
};

// PINK (rosa femenino, cálido)
const PINK: ThemePalette = {
  id: 'pink',
  label: 'Rosa',
  isDark: false,
  isSpecial: true,
  background: '#FFF5F8',
  surface: '#FFFFFF',
  surfaceAlt: '#FFE4EC',
  card: '#FFFFFF',
  text: '#5D1A38',
  textSecondary: '#9D3C66',
  textTertiary: '#C77B9D',
  border: '#FFE4EC',
  divider: '#FECDD3',
  primary: '#EC4899',
  primarySoft: '#FCE7F3',
  primaryGradient: ['#F472B6', '#EC4899', '#BE185D'],
  onPrimary: '#FFFFFF',
  bubbleBg: '#FCE7F3',
  bubbleText: '#5D1A38',
  bubbleMeta: '#BE185D',
  danger: '#E11D48',
  warning: '#F59E0B',
  success: '#10B981',
  inputBg: '#FFE4EC',
  inputText: '#5D1A38',
  placeholder: '#C77B9D',
};

// MINIMAL META (oficina de Meta - blancos, grises, azul Meta)
const MINIMAL: ThemePalette = {
  id: 'minimal',
  label: 'Meta Office',
  isDark: false,
  isSpecial: true,
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F2F5',
  card: '#FFFFFF',
  text: '#050505',
  textSecondary: '#65676B',
  textTertiary: '#8A8D91',
  border: '#E4E6EB',
  divider: '#CED0D4',
  primary: '#0866FF',
  primarySoft: '#E7F0FF',
  primaryGradient: ['#0866FF', '#0866FF', '#0866FF'],
  onPrimary: '#FFFFFF',
  bubbleBg: '#0866FF',
  bubbleText: '#FFFFFF',
  bubbleMeta: '#BFD7FF',
  danger: '#FA383E',
  warning: '#F7B928',
  success: '#31A24C',
  inputBg: '#F0F2F5',
  inputText: '#050505',
  placeholder: '#8A8D91',
};

export const THEMES: Record<Exclude<ThemeId, 'auto'>, ThemePalette> = {
  light: LIGHT,
  dark: DARK,
  cyberpunk: CYBERPUNK,
  pink: PINK,
  minimal: MINIMAL,
};

export function resolveTheme(id: ThemeId, systemIsDark: boolean): ThemePalette {
  if (id === 'auto') {
    return systemIsDark ? DARK : LIGHT;
  }
  return THEMES[id];
}

export const THEME_OPTIONS: Array<{
  id: ThemeId;
  label: string;
  description: string;
  icon: string;
  preview: [string, string, string];
}> = [
  {
    id: 'auto',
    label: 'Automático',
    description: 'Sigue al sistema',
    icon: 'phone-portrait-outline',
    preview: ['#FFFFFF', '#6366F1', '#0F172A'],
  },
  {
    id: 'light',
    label: 'Claro',
    description: 'Fondo blanco, índigo',
    icon: 'sunny-outline',
    preview: ['#FFFFFF', '#EEF2FF', '#6366F1'],
  },
  {
    id: 'dark',
    label: 'Oscuro',
    description: 'Fondo profundo',
    icon: 'moon-outline',
    preview: ['#0F172A', '#312E81', '#8B5CF6'],
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    description: 'Neón cyan + magenta',
    icon: 'flash-outline',
    preview: ['#06030F', '#00FFE5', '#FF00C8'],
  },
  {
    id: 'pink',
    label: 'Rosa',
    description: 'Tonos rosados cálidos',
    icon: 'heart-outline',
    preview: ['#FFF5F8', '#FCE7F3', '#EC4899'],
  },
  {
    id: 'minimal',
    label: 'Meta Office',
    description: 'Minimalista corporativo',
    icon: 'business-outline',
    preview: ['#FAFAFA', '#F0F2F5', '#0866FF'],
  },
];

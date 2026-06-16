import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemePalette, ThemeId, THEME_OPTIONS } from '../theme/themes';

interface ThemeSelectorProps {
  theme: ThemePalette;
  currentThemeId: ThemeId;
  onSelect: (themeId: ThemeId) => void;
}

export function ThemeSelector({ theme, currentThemeId, onSelect }: ThemeSelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {THEME_OPTIONS.map((option) => {
        const isActive = currentThemeId === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: isActive ? theme.primary : theme.border,
                borderWidth: isActive ? 2 : 1,
              },
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            testID={`theme-${option.id}`}
          >
            {/* Preview swatches */}
            <View style={styles.preview}>
              <View style={[styles.swatch, styles.swatchTopLeft, { backgroundColor: option.preview[0] }]} />
              <View style={[styles.swatch, styles.swatchTopRight, { backgroundColor: option.preview[1] }]} />
              <View style={[styles.swatchBottom, { backgroundColor: option.preview[2] }]} />
            </View>

            <View style={styles.cardBody}>
              <View style={styles.labelRow}>
                <Ionicons
                  name={option.icon as any}
                  size={14}
                  color={isActive ? theme.primary : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.label,
                    { color: isActive ? theme.primary : theme.text },
                  ]}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              </View>
              <Text style={[styles.desc, { color: theme.textTertiary }]} numberOfLines={1}>
                {option.description}
              </Text>
            </View>

            {isActive && (
              <View style={[styles.checkBadge, { backgroundColor: theme.primary }]}>
                <Ionicons name="checkmark" size={12} color={theme.onPrimary} />
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const CARD_W = 130;

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  card: {
    width: CARD_W,
    borderRadius: 14,
    overflow: 'hidden',
    flexShrink: 0,
  },
  preview: {
    height: 70,
    position: 'relative',
  },
  swatch: {
    position: 'absolute',
    top: 0,
    width: '50%',
    height: '60%',
  },
  swatchTopLeft: {
    left: 0,
  },
  swatchTopRight: {
    right: 0,
  },
  swatchBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  cardBody: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  desc: {
    fontSize: 10,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

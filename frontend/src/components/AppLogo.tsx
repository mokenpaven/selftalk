import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const logoSource = require('../../assets/images/icon.png');

interface AppLogoProps {
  size?: number;
  theme?: { primary?: string };
}

export function AppLogo({ size = 40 }: AppLogoProps) {
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 4,
        },
      ]}
    >
      <Image
        source={logoSource}
        style={{
          width: size,
          height: size,
          borderRadius: size / 4,
        }}
        contentFit="cover"
        accessibilityLabel="Logo de SelfTalk"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
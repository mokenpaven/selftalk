import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { ThemePalette } from '../theme/themes';

interface VoicePlayerProps {
  uri: string;
  durationMs: number;
  theme: ThemePalette;
}

const WAVE_PATTERN = [
  0.3, 0.6, 0.4, 0.8, 0.5, 0.7, 0.4, 0.6, 0.5, 0.9,
  0.4, 0.7, 0.3, 0.6, 0.8, 0.5, 0.4, 0.7, 0.6, 0.4,
];

export function VoicePlayer({ uri, durationMs, theme }: VoicePlayerProps) {
  const player = useAudioPlayer(Platform.OS === 'web' ? null : { uri });
  const status = useAudioPlayerStatus(player);
  const [, setHasError] = useState(false);

  const handlePlayPause = async () => {
    try {
      if (Platform.OS === 'web') return;
      if (status.playing) {
        player.pause();
      } else {
        if (status.didJustFinish || (status.currentTime > 0 && status.currentTime >= (status.duration || 0))) {
          await player.seekTo(0);
        }
        player.play();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setHasError(true);
    }
  };

  const formatTime = (seconds: number): string => {
    const totalSec = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDurationSec = (durationMs || 0) / 1000;
  const currentTime = status.currentTime || 0;
  const isPlaying = status.playing || false;
  const progress = totalDurationSec > 0 ? Math.min(1, currentTime / totalDurationSec) : 0;
  const displayTime = isPlaying || currentTime > 0 ? currentTime : totalDurationSec;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handlePlayPause}
        style={({ pressed }) => [
          styles.playButton,
          { backgroundColor: `${theme.primary}33` },
          pressed && styles.pressed,
        ]}
        testID="play-voice"
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={16}
          color={theme.primary}
          style={!isPlaying && { marginLeft: 2 }}
        />
      </Pressable>

      <View style={styles.waveform}>
        {WAVE_PATTERN.map((h, i) => {
          const barProgress = i / WAVE_PATTERN.length;
          const isFilled = barProgress < progress;
          return (
            <View
              key={i}
              style={[
                styles.waveBar,
                {
                  height: 18 * h,
                  backgroundColor: theme.primary,
                  opacity: isFilled ? 1 : 0.35,
                },
              ]}
            />
          );
        })}
      </View>

      <Text style={[styles.duration, { color: theme.primary }]}>
        {formatTime(displayTime)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 10,
    minWidth: 200,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 22,
    minWidth: 90,
  },
  waveBar: {
    width: 2.5,
    borderRadius: 2,
  },
  duration: {
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    minWidth: 32,
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});

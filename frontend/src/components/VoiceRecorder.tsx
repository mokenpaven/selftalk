import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AudioModule,
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
} from 'expo-audio';

import { ThemePalette } from '../theme/themes';

interface VoiceRecorderProps {
  onCancel: () => void;
  onComplete: (data: { uri: string; durationMs: number }) => void;
  theme: ThemePalette;
}

export function VoiceRecorder({ onCancel, onComplete, theme }: VoiceRecorderProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const startedRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initRecording();
    startPulse();
    return () => {
      if (startedRef.current && !recorderState.isRecording) {
        recorder.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const initRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert(
          'No disponible',
          'La grabación de voz solo está disponible en dispositivos móviles'
        );
        onCancel();
        return;
      }

      const permission = await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted) {
        setHasPermission(false);
        Alert.alert(
          'Permiso requerido',
          'Necesitamos acceso al micrófono para grabar audios',
          [{ text: 'OK', onPress: onCancel }]
        );
        return;
      }

      setHasPermission(true);

      await AudioModule.setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await recorder.prepareToRecordAsync();
      await recorder.record();
      startedRef.current = true;
      startTimeRef.current = Date.now();
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'No se pudo iniciar la grabación');
      onCancel();
    }
  };

  const handleStop = async () => {
    try {
      if (!startedRef.current) {
        onCancel();
        return;
      }

      const durationMs = Date.now() - startTimeRef.current;
      await recorder.stop();
      startedRef.current = false;

      const uri = recorder.uri;
      if (!uri) {
        Alert.alert('Error', 'No se pudo guardar el audio');
        onCancel();
        return;
      }

      // Minimum 500ms recording
      if (durationMs < 500) {
        Alert.alert('Muy corto', 'Mantén presionado para grabar');
        onCancel();
        return;
      }

      onComplete({ uri, durationMs });
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'No se pudo detener la grabación');
      onCancel();
    }
  };

  const handleCancel = async () => {
    try {
      if (startedRef.current) {
        await recorder.stop();
        startedRef.current = false;
      }
    } catch (error) {
      // ignore
    }
    onCancel();
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const elapsedMs = recorderState.isRecording
    ? Date.now() - startTimeRef.current
    : 0;

  if (hasPermission === false) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <Pressable
        onPress={handleCancel}
        style={({ pressed }) => [
          styles.cancelButton,
          { backgroundColor: `${theme.danger}22` },
          pressed && styles.pressed,
        ]}
        testID="cancel-recording"
      >
        <Ionicons name="trash" size={20} color={theme.danger} />
      </Pressable>

      <View style={[styles.recordingInfo, { backgroundColor: theme.surfaceAlt }]}>
        <Animated.View
          style={[
            styles.recordingDot,
            { backgroundColor: theme.danger },
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
        <Text style={[styles.recordingText, { color: theme.textSecondary }]}>
          Grabando...
        </Text>
        <Text style={[styles.duration, { color: theme.primary }]}>
          {formatTime(elapsedMs)}
        </Text>
      </View>

      <Pressable
        onPress={handleStop}
        style={({ pressed }) => [
          styles.sendButton,
          { backgroundColor: theme.primary, shadowColor: theme.primary },
          pressed && styles.pressed,
        ]}
        testID="stop-recording"
      >
        <Ionicons name="send" size={20} color={theme.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonDark: {
    backgroundColor: '#7F1D1D',
  },
  recordingInfo: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  recordingTextDark: {
    color: '#94A3B8',
  },
  duration: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
    fontVariant: ['tabular-nums'],
  },
  durationDark: {
    color: '#A78BFA',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});

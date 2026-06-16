import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../store/settingsStore';
import { useTheme } from '../theme/useTheme';
import { AppLogo } from './AppLogo';

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;

export function LockScreen() {
  const theme = useTheme();
  const { useBiometric, hasPin, verifyPin, unlock } = useSettingsStore();

  const [pin, setPin] = useState('');
  const [isWrong, setIsWrong] = useState(false);
  const [biometricTypes, setBiometricTypes] = useState<LocalAuthentication.AuthenticationType[]>([]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    LocalAuthentication.supportedAuthenticationTypesAsync()
      .then(setBiometricTypes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (useBiometric && hasPin) {
      const timer = setTimeout(() => {
        tryBiometric();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [useBiometric, hasPin]);

  const tryBiometric = async () => {
    try {
      if (Platform.OS === 'web') return;
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return;

      let result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloquea SelfTalk',
        fallbackLabel: 'Usar PIN',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: true,
        biometricsSecurityLevel: 'weak',
      });

      if (!result.success && result.error === 'unknown') {
        result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Desbloquea SelfTalk',
          fallbackLabel: 'Usar PIN',
          cancelLabel: 'Cancelar',
          disableDeviceFallback: false,
        });
      }

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        unlock();
      }
    } catch (error) {
      console.error('Biometric error:', error);
    }
  };

  const submitPin = async (digits: string) => {
    const isValid = await verifyPin(digits);
    if (isValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      unlock();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setIsWrong(true);
    setTimeout(() => {
      setPin('');
      setIsWrong(false);
    }, 700);
  };

  const handleKeyPress = (key: (typeof PIN_KEYS)[number]) => {
    if (key === 'back') {
      setPin((prev) => prev.slice(0, -1));
      setIsWrong(false);
      return;
    }
    if (!key || pin.length >= 4) return;

    const next = pin + key;
    setPin(next);
    setIsWrong(false);
    if (next.length === 4) {
      submitPin(next);
    }
  };

  const biometricIcon = biometricTypes.includes(
    LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
  )
    ? 'scan-outline'
    : 'finger-print';

  const biometricLabel = biometricTypes.includes(
    LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
  )
    ? 'Usar desbloqueo facial'
    : 'Usar huella digital';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <View style={styles.content}>
        <AppLogo size={80} theme={theme} />
        <Text style={[styles.title, { color: theme.text }]}>SelfTalk</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {useBiometric ? 'Ingresa tu PIN o usa biometría' : 'Ingresa tu PIN para continuar'}
        </Text>

        {hasPin ? (
          <>
            <View style={styles.pinDisplay}>
              {[0, 1, 2, 3].map((i) => {
                const filled = pin.length > i;
                return (
                  <View
                    key={i}
                    style={[
                      styles.pinDot,
                      {
                        borderColor: isWrong
                          ? theme.danger
                          : filled
                          ? theme.primary
                          : theme.divider,
                        backgroundColor: isWrong
                          ? theme.danger
                          : filled
                          ? theme.primary
                          : 'transparent',
                      },
                    ]}
                  />
                );
              })}
            </View>

            {isWrong && (
              <Text style={[styles.errorText, { color: theme.danger }]}>
                PIN incorrecto
              </Text>
            )}

            <View style={styles.keypad}>
              {PIN_KEYS.map((key, index) => {
                if (key === '') {
                  return <View key={`spacer-${index}`} style={styles.keyEmpty} />;
                }
                const isBack = key === 'back';
                return (
                  <Pressable
                    key={key}
                    onPress={() => handleKeyPress(key)}
                    style={({ pressed }) => [
                      styles.key,
                      { backgroundColor: theme.surfaceAlt },
                      pressed && styles.pressed,
                    ]}
                    testID={isBack ? 'pin-backspace' : `pin-key-${key}`}
                  >
                    {isBack ? (
                      <Ionicons name="backspace-outline" size={24} color={theme.text} />
                    ) : (
                      <Text style={[styles.keyText, { color: theme.text }]}>{key}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            No hay PIN configurado. Desactiva el bloqueo en Configuración.
          </Text>
        )}

        {useBiometric && hasPin && (
          <Pressable
            onPress={tryBiometric}
            style={({ pressed }) => [
              styles.biometricButton,
              { backgroundColor: theme.surfaceAlt },
              pressed && styles.pressed,
            ]}
            testID="biometric-button"
          >
            <Ionicons name={biometricIcon} size={28} color={theme.primary} />
            <Text style={[styles.biometricText, { color: theme.primary }]}>
              {biometricLabel}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 12,
    textAlign: 'center',
  },
  pinDisplay: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  key: {
    width: 76,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: {
    width: 76,
    height: 56,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 10,
    marginTop: 20,
  },
  biometricText: {
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
});
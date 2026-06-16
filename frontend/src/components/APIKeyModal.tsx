import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemePalette } from '../theme/themes';
import {
  AIProvider,
  PROVIDERS,
  PROVIDER_LIST,
  chatWithAI,
} from '../utils/aiProviders';
import { useSettingsStore } from '../store/settingsStore';

interface APIKeyModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  theme: ThemePalette;
  initialProvider?: AIProvider | null;
}

export function APIKeyModal({
  visible,
  onClose,
  onSaved,
  theme,
  initialProvider,
}: APIKeyModalProps) {
  const { aiApiKeys, setAIApiKey, removeAIApiKey, setAIActiveProvider } =
    useSettingsStore();

  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(
    initialProvider || 'openai'
  );
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedProvider(initialProvider || 'openai');
      setApiKey('');
      setShowKey(false);
      setSaved(false);
    }
  }, [visible, initialProvider]);

  useEffect(() => {
    // Prefill with existing key when changing provider
    const existing = aiApiKeys[selectedProvider];
    if (existing) setApiKey(existing);
    else setApiKey('');
  }, [selectedProvider, aiApiKeys]);

  const provider = PROVIDERS[selectedProvider];
  const hasExisting = !!aiApiKeys[selectedProvider];

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    if (trimmed.length < 8) {
      Alert.alert('API key inválida', 'La API key parece muy corta. Verifica que sea correcta.');
      return;
    }

    setTesting(true);
    try {
      // Quick test call
      const result = await chatWithAI({
        provider: selectedProvider,
        apiKey: trimmed,
        model: provider.models[0].id,
        systemPrompt: 'Responde solo con "OK".',
        history: [{ role: 'user', content: 'ping' }],
      });

      if (result.error) {
        Alert.alert(
          'No se pudo validar',
          result.error + '\n\n¿Querés guardar la API key de todas formas?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Guardar igual',
              onPress: async () => {
                await setAIApiKey(selectedProvider, trimmed);
                await setAIActiveProvider(selectedProvider);
                setSaved(true);
                onSaved?.();
                setTimeout(onClose, 600);
              },
            },
          ]
        );
        return;
      }

      await setAIApiKey(selectedProvider, trimmed);
      await setAIActiveProvider(selectedProvider);
      setSaved(true);
      onSaved?.();
      setTimeout(onClose, 600);
    } catch (e) {
      Alert.alert('Error', 'No se pudo conectar para validar.');
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = () => {
    Alert.alert(
      'Eliminar API key',
      `¿Eliminar la API key de ${provider.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await removeAIApiKey(selectedProvider);
            setApiKey('');
            onClose();
          },
        },
      ]
    );
  };

  const openProviderLink = () => {
    Linking.openURL(provider.apiKeyUrl).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={[styles.handle, { backgroundColor: theme.divider }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              Conectar IA
            </Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: theme.surfaceAlt },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Pegá tu API key. Se guarda cifrada solo en tu dispositivo.
          </Text>

          {/* Provider selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.providersRow}
          >
            {PROVIDER_LIST.map((p) => {
              const isActive = selectedProvider === p.id;
              const hasKey = !!aiApiKeys[p.id];
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedProvider(p.id)}
                  style={({ pressed }) => [
                    styles.providerChip,
                    {
                      backgroundColor: isActive ? p.color : theme.surfaceAlt,
                      borderColor: isActive ? p.color : theme.border,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                  testID={`provider-${p.id}`}
                >
                  <Ionicons
                    name={p.icon as any}
                    size={14}
                    color={isActive ? '#FFFFFF' : p.color}
                  />
                  <Text
                    style={[
                      styles.providerLabel,
                      { color: isActive ? '#FFFFFF' : theme.text },
                    ]}
                  >
                    {p.name.split(' ')[0]}
                  </Text>
                  {hasKey && (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: isActive ? '#FFFFFF' : theme.success },
                      ]}
                    />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Info row */}
          <View style={[styles.infoBox, { backgroundColor: theme.surfaceAlt }]}>
            <View style={[styles.infoIcon, { backgroundColor: `${provider.color}22` }]}>
              <Ionicons name={provider.icon as any} size={20} color={provider.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoTitle, { color: theme.text }]}>
                {provider.name}
              </Text>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                {provider.apiKeyPattern}
              </Text>
            </View>
            <Pressable
              onPress={openProviderLink}
              style={({ pressed }) => [
                styles.linkBtn,
                { backgroundColor: theme.surface, borderColor: theme.border },
                pressed && { opacity: 0.7 },
              ]}
              testID="open-provider-link"
            >
              <Text style={[styles.linkBtnText, { color: provider.color }]}>
                Obtener
              </Text>
              <Ionicons name="open-outline" size={14} color={provider.color} />
            </Pressable>
          </View>

          {/* API Key input */}
          <View style={[styles.inputRow, { backgroundColor: theme.inputBg }]}>
            <TextInput
              style={[styles.input, { color: theme.inputText }]}
              placeholder="Pegá tu API key aquí"
              placeholderTextColor={theme.placeholder}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
              testID="api-key-input"
            />
            <Pressable onPress={() => setShowKey((v) => !v)} style={styles.eyeBtn}>
              <Ionicons
                name={showKey ? 'eye-off' : 'eye'}
                size={18}
                color={theme.textSecondary}
              />
            </Pressable>
          </View>

          {/* Action buttons */}
          <View style={styles.buttonsRow}>
            {hasExisting && (
              <Pressable
                onPress={handleRemove}
                style={({ pressed }) => [
                  styles.dangerBtn,
                  { backgroundColor: `${theme.danger}22` },
                  pressed && { opacity: 0.7 },
                ]}
                testID="remove-api-key"
              >
                <Ionicons name="trash-outline" size={18} color={theme.danger} />
              </Pressable>
            )}
            <Pressable
              onPress={handleSave}
              disabled={testing || !apiKey.trim()}
              style={({ pressed }) => [
                styles.saveBtn,
                {
                  backgroundColor: saved ? theme.success : theme.primary,
                  shadowColor: theme.primary,
                  opacity: !apiKey.trim() ? 0.5 : 1,
                },
                pressed && { opacity: 0.85 },
              ]}
              testID="save-api-key"
            >
              <Ionicons
                name={saved ? 'checkmark' : testing ? 'sync' : 'save'}
                size={18}
                color={theme.onPrimary}
              />
              <Text style={[styles.saveBtnText, { color: theme.onPrimary }]}>
                {saved ? 'Guardado' : testing ? 'Validando...' : 'Guardar y validar'}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.help, { color: theme.textTertiary }]}>
            🔒 Tu API key se guarda cifrada con el sistema seguro del dispositivo
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  providersRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
  },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    gap: 6,
    flexShrink: 0,
  },
  providerLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
    marginTop: 12,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 11,
    marginTop: 2,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  linkBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginTop: 12,
    height: 48,
    paddingLeft: 14,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  eyeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  dangerBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  help: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
    fontStyle: 'italic',
  },
});

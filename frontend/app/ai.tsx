import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '../src/store/settingsStore';
import { useChatStore } from '../src/store/chatStore';
import { useTheme } from '../src/theme/useTheme';
import { chatWithAI, PROVIDERS, AIChatMessage } from '../src/utils/aiProviders';
import { APIKeyModal } from '../src/components/APIKeyModal';
import { Message } from '../src/database/db';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
  error?: boolean;
}

export default function AIChatScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const {
    aiApiKeys,
    aiActiveProvider,
    aiActiveModel,
    setAIActiveProvider,
    setAIActiveModel,
  } = useSettingsStore();
  const messages = useChatStore((s) => s.messages);

  const [conversation, setConversation] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);

  const activeProvider = aiActiveProvider;
  const activeKey = activeProvider ? aiApiKeys[activeProvider] : undefined;
  const hasKey = !!activeKey;

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [conversation.length]);

  const buildSystemPrompt = () => {
    const notesContext = buildNotesContext(messages);
    return `Eres el asistente personal de SelfTalk, una app de notas privadas. El usuario te envió sus notas auto-enviadas y quiere que le ayudes con ellas.

Podés: resumir, buscar información, sugerir ideas, encontrar patrones, recordar tareas pendientes, y responder preguntas sobre sus notas.

Respondé siempre en español, de manera amable, concisa y útil. Si no encontrás la información en las notas, decilo claramente.

NOTAS DEL USUARIO (más recientes primero):
${notesContext}

FIN DE LAS NOTAS.`;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    if (!activeProvider || !activeKey || !aiActiveModel) {
      setShowKeyModal(true);
      return;
    }

    const userMsg: AIMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text,
    };
    const aiPlaceholder: AIMessage = {
      id: `a_${Date.now()}`,
      role: 'assistant',
      text: '',
      pending: true,
    };

    setConversation((prev) => [...prev, userMsg, aiPlaceholder]);
    setInput('');
    setSending(true);

    try {
      // Build history (exclude pending placeholder)
      const history: AIChatMessage[] = [
        ...conversation
          .filter((m) => !m.pending && !m.error)
          .map((m) => ({ role: m.role, content: m.text })),
        { role: 'user' as const, content: text },
      ];

      const result = await chatWithAI({
        provider: activeProvider,
        apiKey: activeKey,
        model: aiActiveModel,
        systemPrompt: buildSystemPrompt(),
        history,
      });

      setConversation((prev) =>
        prev.map((m) =>
          m.id === aiPlaceholder.id
            ? {
                ...m,
                pending: false,
                text: result.error || result.text || 'Sin respuesta',
                error: !!result.error,
              }
            : m
        )
      );
    } catch (err: any) {
      setConversation((prev) =>
        prev.map((m) =>
          m.id === aiPlaceholder.id
            ? {
                ...m,
                pending: false,
                text: err?.message || 'Error de conexión',
                error: true,
              }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  const handleClearConversation = () => {
    setConversation([]);
  };

  const currentProviderConfig = activeProvider ? PROVIDERS[activeProvider] : null;
  const currentModel = aiActiveModel
    ? currentProviderConfig?.models.find((m) => m.id === aiActiveModel)
    : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: theme.surfaceAlt },
              pressed && styles.pressed,
            ]}
            testID="ai-back-button"
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>

          <Pressable
            onPress={() => hasKey && setShowProviderPicker(true)}
            style={styles.headerTitleArea}
          >
            <View
              style={[
                styles.aiIcon,
                {
                  backgroundColor: currentProviderConfig
                    ? `${currentProviderConfig.color}22`
                    : `${theme.primary}22`,
                },
              ]}
            >
              <Ionicons
                name="sparkles"
                size={20}
                color={currentProviderConfig?.color || theme.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                Chat con IA
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {currentProviderConfig
                  ? `${currentProviderConfig.name} · ${currentModel?.label || ''}`
                  : 'Sin configurar'}
              </Text>
            </View>
            {hasKey && (
              <Ionicons name="chevron-down" size={16} color={theme.textTertiary} />
            )}
          </Pressable>

          {conversation.length > 0 && (
            <Pressable
              onPress={handleClearConversation}
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: theme.surfaceAlt },
                pressed && styles.pressed,
              ]}
              testID="clear-ai-conversation"
            >
              <Ionicons name="refresh" size={20} color={theme.text} />
            </Pressable>
          )}
        </View>

        {/* Body */}
        {!hasKey ? (
          <View style={styles.emptyWrapper}>
            <View
              style={[styles.emptyIcon, { backgroundColor: `${theme.warning}22` }]}
            >
              <Ionicons name="key-outline" size={48} color={theme.warning} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              Conectá una IA
            </Text>
            <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
              Para chatear con una IA sobre tus notas, necesitás conectar tu propia API key de OpenAI, Claude, Gemini o DeepSeek.{'\n\n'}
              Tu API key se guarda <Text style={{ fontWeight: '700' }}>cifrada solo en tu dispositivo</Text>. Nada se sube a nuestros servidores.
            </Text>
            <Pressable
              onPress={() => setShowKeyModal(true)}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: theme.primary,
                  shadowColor: theme.primary,
                },
                pressed && styles.pressed,
              ]}
              testID="configure-ai-button"
            >
              <Ionicons name="add-circle" size={20} color={theme.onPrimary} />
              <Text style={[styles.primaryBtnText, { color: theme.onPrimary }]}>
                Configurar API key
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: theme.surfaceAlt },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="settings-outline" size={16} color={theme.text} />
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
                Ver en ajustes
              </Text>
            </Pressable>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
            {conversation.length === 0 && (
              <View style={styles.welcomeWrapper}>
                <View
                  style={[
                    styles.welcomeIcon,
                    { backgroundColor: `${theme.primary}22` },
                  ]}
                >
                  <Ionicons name="sparkles" size={36} color={theme.primary} />
                </View>
                <Text style={[styles.welcomeTitle, { color: theme.text }]}>
                  Preguntá sobre tus notas
                </Text>
                <Text style={[styles.welcomeDesc, { color: theme.textSecondary }]}>
                  Tengo acceso a tus últimas {Math.min(messages.length, 100)} notas. Probá preguntar:
                </Text>
                <View style={styles.suggestions}>
                  {[
                    '¿Qué tareas pendientes tengo?',
                    'Resumí mis notas de esta semana',
                    '¿Qué ideas anoté últimamente?',
                    'Buscá algo sobre #trabajo',
                  ].map((suggestion) => (
                    <Pressable
                      key={suggestion}
                      onPress={() => setInput(suggestion)}
                      style={({ pressed }) => [
                        styles.suggestionChip,
                        {
                          backgroundColor: theme.surfaceAlt,
                          borderColor: theme.border,
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.suggestionText, { color: theme.text }]}>
                        {suggestion}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {conversation.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.bubbleRow,
                  msg.role === 'user' ? styles.userRow : styles.aiRow,
                ]}
              >
                {msg.role === 'assistant' && (
                  <View
                    style={[
                      styles.avatarMini,
                      {
                        backgroundColor: currentProviderConfig
                          ? `${currentProviderConfig.color}33`
                          : `${theme.primary}33`,
                      },
                    ]}
                  >
                    <Ionicons
                      name="sparkles"
                      size={12}
                      color={currentProviderConfig?.color || theme.primary}
                    />
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    msg.role === 'user'
                      ? {
                          backgroundColor: theme.primary,
                          borderBottomRightRadius: 4,
                        }
                      : {
                          backgroundColor: theme.surfaceAlt,
                          borderBottomLeftRadius: 4,
                          borderColor: msg.error ? theme.danger : 'transparent',
                          borderWidth: msg.error ? 1 : 0,
                        },
                  ]}
                >
                  {msg.pending ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Text
                      style={[
                        styles.bubbleText,
                        {
                          color: msg.role === 'user' ? theme.onPrimary : theme.text,
                        },
                      ]}
                    >
                      {msg.text}
                    </Text>
                  )}
                </View>
              </View>
            ))}
            </ScrollView>

            <View
              style={[
                styles.inputArea,
                {
                  backgroundColor: theme.surface,
                  borderTopColor: theme.border,
                  paddingBottom: Math.max(insets.bottom, 20),
                },
              ]}
            >
              <View style={[styles.inputBg, { backgroundColor: theme.inputBg }]}>
                <TextInput
                  style={[styles.input, { color: theme.inputText }]}
                  placeholder="Preguntale a la IA..."
                  placeholderTextColor={theme.placeholder}
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={handleSend}
                  blurOnSubmit={false}
                  multiline
                  maxLength={2000}
                  testID="ai-input"
                  editable={!sending}
                />
              </View>
              <Pressable
                onPress={handleSend}
                disabled={!input.trim() || sending}
                style={({ pressed }) => [
                  styles.sendBtn,
                  {
                    backgroundColor: theme.primary,
                    shadowColor: theme.primary,
                    opacity: !input.trim() || sending ? 0.5 : 1,
                  },
                  pressed && styles.pressed,
                ]}
                testID="ai-send-button"
              >
                {sending ? (
                  <ActivityIndicator size="small" color={theme.onPrimary} />
                ) : (
                  <Ionicons name="send" size={20} color={theme.onPrimary} />
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>

      {/* API Key Modal */}
      <APIKeyModal
        visible={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        theme={theme}
        initialProvider={activeProvider}
      />

      {/* Provider/Model picker */}
      {showProviderPicker && activeProvider && (
        <ProviderPickerModal
          visible={showProviderPicker}
          onClose={() => setShowProviderPicker(false)}
          theme={theme}
        />
      )}
    </View>
  );
}

// ===== Provider/Model picker =====

function ProviderPickerModal({
  visible,
  onClose,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const {
    aiApiKeys,
    aiActiveProvider,
    aiActiveModel,
    setAIActiveProvider,
    setAIActiveModel,
  } = useSettingsStore();

  if (!visible || !aiActiveProvider) return null;

  const configured = (Object.keys(aiApiKeys) as Array<keyof typeof aiApiKeys>).filter(
    (p) => !!aiApiKeys[p]
  );

  const provider = PROVIDERS[aiActiveProvider];

  return (
    <View style={styles.pickerBackdrop}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <View style={[styles.pickerSheet, { backgroundColor: theme.surface }]}>
        <View style={[styles.handle, { backgroundColor: theme.divider }]} />
        <Text style={[styles.pickerTitle, { color: theme.text }]}>
          Proveedor activo
        </Text>
        <View style={styles.providerCardsRow}>
          {configured.map((pid) => {
            const p = PROVIDERS[pid as keyof typeof PROVIDERS];
            const isActive = aiActiveProvider === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setAIActiveProvider(p.id)}
                style={({ pressed }) => [
                  styles.providerCard,
                  {
                    backgroundColor: isActive ? p.color : theme.surfaceAlt,
                    borderColor: isActive ? p.color : theme.border,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons
                  name={p.icon as any}
                  size={16}
                  color={isActive ? '#FFFFFF' : p.color}
                />
                <Text
                  style={[
                    styles.providerCardLabel,
                    { color: isActive ? '#FFFFFF' : theme.text },
                  ]}
                >
                  {p.name.split(' ')[0]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.pickerTitle, { color: theme.text, marginTop: 16 }]}>
          Modelo
        </Text>
        {provider.models.map((m) => {
          const isActive = aiActiveModel === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => {
                setAIActiveModel(m.id);
                onClose();
              }}
              style={({ pressed }) => [
                styles.modelRow,
                {
                  backgroundColor: isActive ? `${provider.color}22` : 'transparent',
                  borderColor: isActive ? provider.color : theme.border,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.modelLabel, { color: theme.text }]}>{m.label}</Text>
                <Text style={[styles.modelDesc, { color: theme.textSecondary }]}>
                  {m.description}
                </Text>
              </View>
              {isActive && (
                <Ionicons name="checkmark-circle" size={20} color={provider.color} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ===== Helpers =====

function buildNotesContext(messages: Message[]): string {
  if (messages.length === 0) {
    return '(El usuario aún no tiene notas)';
  }
  // Take last 100, most recent first
  const recent = [...messages].reverse().slice(0, 100);
  return recent
    .map((m) => {
      const date = format(m.timestamp, "d MMM yyyy HH:mm", { locale: es });
      let content = '';
      switch (m.type) {
        case 'text':
          content = m.content;
          break;
        case 'link':
          content = `[ENLACE] ${m.content}`;
          break;
        case 'image':
          content = '[IMAGEN]';
          break;
        case 'voice':
          content = '[AUDIO DE VOZ]';
          break;
        case 'file':
          content = `[ARCHIVO] ${m.file_name || 'sin nombre'}`;
          break;
      }
      const pinned = m.is_pinned === 1 ? ' [FIJADO]' : '';
      return `[${date}]${pinned} ${content}`;
    })
    .join('\n');
}

// ===== Styles =====

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  messagesContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  welcomeWrapper: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  welcomeDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  suggestions: {
    gap: 8,
    width: '100%',
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 4,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  avatarMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
  },
  inputBg: {
    flex: 1,
    borderRadius: 20,
    minHeight: 40,
    maxHeight: 120,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  input: {
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 110,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  // Picker
  pickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    gap: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  pickerTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  providerCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    gap: 6,
  },
  providerCardLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 6,
    gap: 12,
  },
  modelLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  modelDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});

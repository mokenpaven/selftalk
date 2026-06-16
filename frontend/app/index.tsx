import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  StatusBar,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { database, Message, getDatabaseErrorMessage } from '../src/database/db';
import { useChatStore } from '../src/store/chatStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { useTheme } from '../src/theme/useTheme';
import { MessageBubble } from '../src/components/MessageBubble';
import { MessageInput } from '../src/components/MessageInput';
import { AppLogo } from '../src/components/AppLogo';
import { HeaderNavMenu } from '../src/components/HeaderNavMenu';
import { MessageActionsSheet } from '../src/components/MessageActionsSheet';
import { useRouter } from 'expo-router';
import { ensureWelcomeMessage } from '../src/constants/welcomeMessage';
import { cancelAlarm } from '../src/utils/alarms';

const HEADER_HEIGHT = 64;
const SCROLL_THRESHOLD = 120;

export default function Index() {
  const theme = useTheme();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const chatName = useSettingsStore((s) => s.chatName);
  const lockEnabled = useSettingsStore((s) => s.lockEnabled);
  const lockApp = useSettingsStore((s) => s.lock);

  const { messages, loadMessages, addMessage, moveToTrash, moveToArchive } = useChatStore();

  const [initState, setInitState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [navMenuVisible, setNavMenuVisible] = useState(false);
  const userScrolledUpRef = useRef(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    setInitState('loading');
    try {
      await database.init();
      await ensureWelcomeMessage();
      await loadMessages();
      setInitState('ready');
    } catch (error) {
      console.error('Error initializing app:', error);
      setInitState('error');
    }
  };

  const scrollToEnd = useCallback((animated = true) => {
    flatListRef.current?.scrollToEnd({ animated });
  }, []);

  useEffect(() => {
    if (messages.length > 0 && flatListRef.current && !userScrolledUpRef.current) {
      setTimeout(() => scrollToEnd(true), 100);
    }
  }, [messages.length, scrollToEnd]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => scrollToEnd(true), 50);
      }
    );
    return () => showSub.remove();
  }, [scrollToEnd]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    const nearBottom = distanceFromBottom < SCROLL_THRESHOLD;
    setIsNearBottom(nearBottom);
    setCanScrollUp(contentOffset.y > SCROLL_THRESHOLD);
    userScrolledUpRef.current = !nearBottom;
  };

  const handleScrollNav = () => {
    if (!isNearBottom) {
      userScrolledUpRef.current = false;
      scrollToEnd(true);
      return;
    }
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const showDbError = (error: unknown, fallback: string) => {
    Alert.alert('Error', getDatabaseErrorMessage(error) || fallback);
  };

  const handleSendText = async (text: string) => {
    try {
      const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;
      const isLink = urlRegex.test(text);
      const hashtagRegex = /#[a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ]+/g;
      const hashtags = text.match(hashtagRegex) || [];

      await addMessage({
        type: isLink ? 'link' : 'text',
        content: text,
        hashtags: hashtags.length > 0 ? JSON.stringify(hashtags) : undefined,
      });
      userScrolledUpRef.current = false;
    } catch (error) {
      console.error('Error sending message:', error);
      showDbError(error, 'No se pudo enviar el mensaje');
    }
  };

  const handleSendImage = async (base64: string) => {
    try {
      await addMessage({ type: 'image', content: base64 });
      userScrolledUpRef.current = false;
    } catch (error) {
      showDbError(error, 'No se pudo enviar la imagen');
    }
  };

  const handleSendFile = async (file: { uri: string; name: string; size: number }) => {
    try {
      await addMessage({
        type: 'file',
        content: '',
        file_uri: file.uri,
        file_name: file.name,
        file_size: file.size,
      });
      userScrolledUpRef.current = false;
    } catch (error) {
      showDbError(error, 'No se pudo enviar el archivo');
    }
  };

  const handleSendVoice = async (data: { uri: string; durationMs: number }) => {
    try {
      await addMessage({
        type: 'voice',
        content: '',
        file_uri: data.uri,
        metadata: JSON.stringify({ durationMs: data.durationMs }),
      });
      userScrolledUpRef.current = false;
    } catch (error) {
      showDbError(error, 'No se pudo enviar el audio');
    }
  };

  const handleSwipeTrash = async (message: Message) => {
    try {
      const meta = message.metadata ? JSON.parse(message.metadata) : {};
      const alarmId = meta?.alarm?.notificationId;
      if (alarmId) await cancelAlarm(alarmId);
      await moveToTrash(message.id);
    } catch (error) {
      showDbError(error, 'No se pudo mover a la papelera');
    }
  };

  const handleSwipeArchive = async (message: Message) => {
    try {
      await moveToArchive(message.id);
    } catch (error) {
      showDbError(error, 'No se pudo archivar el mensaje');
    }
  };

  const handleManualLock = () => {
    if (!lockEnabled) {
      Alert.alert(
        'Bloqueo no configurado',
        'Activa el bloqueo de la app desde Configuración para poder usar el candado.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ir a Configuración', onPress: () => router.push('/settings') },
        ]
      );
      return;
    }
    lockApp();
  };

  const showScrollFab = messages.length > 0 && (!isNearBottom || canScrollUp);

  if (initState === 'loading') {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <AppLogo size={64} theme={theme} />
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24 }} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Iniciando SelfTalk...
        </Text>
      </View>
    );
  }

  if (initState === 'error') {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <AppLogo size={64} theme={theme} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          No se pudo inicializar la aplicación
        </Text>
        <Text style={[styles.errorSubtext, { color: theme.textSecondary }]}>
          Hubo un problema al abrir la base de datos local.
        </Text>
        <Pressable
          onPress={initializeApp}
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: theme.primary },
            pressed && styles.headerButtonPressed,
          ]}
        >
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top', 'left', 'right']}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <Pressable
            onPress={() => setNavMenuVisible(true)}
            style={({ pressed }) => [
              styles.headerLeft,
              pressed && styles.headerButtonPressed,
            ]}
            testID="header-logo-menu"
          >
            <AppLogo size={40} theme={theme} />
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>SelfTalk</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {chatName}
              </Text>
            </View>
            <Ionicons
              name="chevron-down"
              size={16}
              color={theme.textSecondary}
              style={styles.headerChevron}
            />
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/search')}
              style={({ pressed }) => [
                styles.headerButton,
                { backgroundColor: theme.surfaceAlt },
                pressed && styles.headerButtonPressed,
              ]}
              testID="search-button"
            >
              <Ionicons name="search" size={20} color={theme.text} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/ai')}
              style={({ pressed }) => [
                styles.headerButton,
                { backgroundColor: `${theme.primary}22` },
                pressed && styles.headerButtonPressed,
              ]}
              testID="ai-button"
            >
              <Ionicons name="sparkles" size={18} color={theme.primary} />
            </Pressable>
            <Pressable
              onPress={handleManualLock}
              style={({ pressed }) => [
                styles.headerButton,
                {
                  backgroundColor: lockEnabled ? `${theme.primary}22` : theme.surfaceAlt,
                },
                pressed && styles.headerButtonPressed,
              ]}
              testID="manual-lock-button"
            >
              <Ionicons
                name="lock-closed"
                size={18}
                color={lockEnabled ? theme.primary : theme.text}
              />
            </Pressable>
            <Pressable
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [
                styles.headerButton,
                { backgroundColor: theme.surfaceAlt },
                pressed && styles.headerButtonPressed,
              ]}
              testID="settings-button"
            >
              <Ionicons name="settings-outline" size={20} color={theme.text} />
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + HEADER_HEIGHT : 0}
        >
          <View style={{ flex: 1 }}>
            {messages.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View
                  style={[
                    styles.emptyIconContainer,
                    { backgroundColor: theme.surfaceAlt },
                  ]}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={56}
                    color={theme.primary}
                  />
                </View>
                <Text style={[styles.emptyText, { color: theme.text }]}>
                  Comienza tu conversación
                </Text>
                <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                  Envíate notas, ideas, enlaces y más. {'\n'}Todo queda guardado en tu dispositivo.
                </Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  theme={theme}
                  onLongPress={setSelectedMessage}
                  onSwipeTrash={handleSwipeTrash}
                  onSwipeArchive={handleSwipeArchive}
                />
                )}
                style={{ flex: 1 }}
                contentContainerStyle={styles.messagesList}
                keyboardShouldPersistTaps="handled"
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onContentSizeChange={() => {
                  if (!userScrolledUpRef.current) {
                    scrollToEnd(false);
                  }
                }}
              />
            )}

            {showScrollFab && (
              <Pressable
                onPress={handleScrollNav}
                style={({ pressed }) => [
                  styles.scrollFab,
                  {
                    backgroundColor: theme.primary,
                    shadowColor: theme.primary,
                    bottom: 72 + Math.max(insets.bottom, 8),
                  },
                  pressed && styles.headerButtonPressed,
                ]}
                testID="scroll-nav-button"
                accessibilityLabel={isNearBottom ? 'Ir arriba' : 'Ir abajo'}
              >
                <Ionicons
                  name={isNearBottom ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color={theme.onPrimary}
                />
              </Pressable>
            )}
          </View>

          <MessageInput
            onSendText={handleSendText}
            onSendImage={handleSendImage}
            onSendFile={handleSendFile}
            onSendVoice={handleSendVoice}
            onInputFocus={() => {
              setTimeout(() => scrollToEnd(true), 100);
            }}
            bottomInset={insets.bottom}
            theme={theme}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      <MessageActionsSheet
        visible={!!selectedMessage}
        message={selectedMessage}
        theme={theme}
        onClose={() => setSelectedMessage(null)}
      />

      <HeaderNavMenu
        visible={navMenuVisible}
        theme={theme}
        onClose={() => setNavMenuVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, fontWeight: '500' },
  errorSubtext: { marginTop: 8, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  headerChevron: {
    marginLeft: 4,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  messagesList: {
    paddingVertical: 12,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollFab: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
});
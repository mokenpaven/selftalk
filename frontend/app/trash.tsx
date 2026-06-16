import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  StatusBar,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { database, Message } from '../src/database/db';
import { useTheme } from '../src/theme/useTheme';
import { MessageBubble } from '../src/components/MessageBubble';
import { MessageActionsSheet } from '../src/components/MessageActionsSheet';

export default function TrashScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const loadTrash = useCallback(async () => {
    await database.init();
    const trashed = await database.getTrashedMessages();
    setMessages(trashed);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrash();
    }, [loadTrash])
  );

  const handleEmptyTrash = () => {
    if (messages.length === 0) return;
    Alert.alert(
      'Vaciar papelera',
      '¿Eliminar definitivamente todos los mensajes de la papelera?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vaciar',
          style: 'destructive',
          onPress: async () => {
            await database.emptyTrash();
            await loadTrash();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: theme.surfaceAlt },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Papelera</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {messages.length} {messages.length === 1 ? 'mensaje' : 'mensajes'}
            </Text>
          </View>
          {messages.length > 0 && (
            <Pressable onPress={handleEmptyTrash} style={styles.emptyButton}>
              <Text style={[styles.emptyButtonText, { color: theme.danger }]}>Vaciar</Text>
            </Pressable>
          )}
        </View>

        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="trash-outline" size={56} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.text }]}>Papelera vacía</Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              Los mensajes enviados aquí se pueden restaurar
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                theme={theme}
                onLongPress={setSelectedMessage}
              />
            )}
            contentContainerStyle={styles.list}
          />
        )}
      </SafeAreaView>

      <MessageActionsSheet
        visible={!!selectedMessage}
        message={selectedMessage}
        theme={theme}
        listContext="trash"
        onClose={() => {
          setSelectedMessage(null);
          loadTrash();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  emptyButton: { paddingHorizontal: 8, paddingVertical: 6 },
  emptyButtonText: { fontSize: 14, fontWeight: '600' },
  list: { paddingVertical: 12 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyText: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptySubtext: { fontSize: 14, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  FlatList,
  StyleSheet,
  StatusBar,
  Text,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useChatStore } from '../src/store/chatStore';
import { useTheme } from '../src/theme/useTheme';
import { MessageBubble } from '../src/components/MessageBubble';
import { MessageActionsSheet } from '../src/components/MessageActionsSheet';
import { Message } from '../src/database/db';

type FilterChip = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  type: string | null;
  isPin?: boolean;
  isArchive?: boolean;
};

const FILTER_CHIPS: FilterChip[] = [
  { key: 'pinned', label: 'Fijados', icon: 'pin', type: null, isPin: true },
  { key: 'archived', label: 'Archivados', icon: 'archive', type: null, isArchive: true },
  { key: 'text', label: 'Texto', icon: 'chatbox', type: 'text' },
  { key: 'image', label: 'Imágenes', icon: 'image', type: 'image' },
  { key: 'link', label: 'Enlaces', icon: 'link', type: 'link' },
  { key: 'file', label: 'Archivos', icon: 'document', type: 'file' },
  { key: 'voice', label: 'Audios', icon: 'mic', type: 'voice' },
];

export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();

  const {
    messages,
    filterType,
    showPinnedOnly,
    showArchivedOnly,
    searchQuery,
    searchMessages,
    filterByType,
    togglePinnedOnly,
    toggleArchivedOnly,
    clearSearch,
    applyFilters,
  } = useChatStore();

  const [localQuery, setLocalQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  useEffect(() => {
    applyFilters();
    return () => {
      clearSearch();
    };
  }, []);

  const handleSearch = (text: string) => {
    setLocalQuery(text);
    searchMessages(text);
  };

  const handleChipPress = (chip: FilterChip) => {
    if (chip.isPin) togglePinnedOnly();
    else if (chip.isArchive) toggleArchivedOnly();
    else filterByType(filterType === chip.type ? null : chip.type);
  };

  const isChipActive = (chip: FilterChip) => {
    if (chip.isPin) return showPinnedOnly;
    if (chip.isArchive) return showArchivedOnly;
    return filterType === chip.type;
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      <SafeAreaView
        style={{ flex: 1 }}
        edges={['top', 'left', 'right', 'bottom']}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: theme.surfaceAlt },
              pressed && styles.pressed,
            ]}
            testID="back-button"
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>

          <View style={[styles.searchInputWrapper, { backgroundColor: theme.inputBg }]}>
            <Ionicons
              name="search"
              size={18}
              color={theme.placeholder}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: theme.inputText }]}
              placeholder="Buscar mensajes..."
              placeholderTextColor={theme.placeholder}
              value={localQuery}
              onChangeText={handleSearch}
              autoFocus
              testID="search-input"
            />
            {localQuery ? (
              <Pressable onPress={() => handleSearch('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={18} color={theme.placeholder} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Chips */}
        <View
          style={[
            styles.filtersWrapper,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            {FILTER_CHIPS.map((chip) => {
              const active = isChipActive(chip);
              return (
                <Pressable
                  key={chip.key}
                  onPress={() => handleChipPress(chip)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    {
                      backgroundColor: active ? theme.primary : theme.surfaceAlt,
                      borderColor: active ? theme.primary : 'transparent',
                    },
                    pressed && styles.pressed,
                  ]}
                  testID={`filter-chip-${chip.key}`}
                >
                  <Ionicons
                    name={chip.icon}
                    size={14}
                    color={active ? theme.onPrimary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: active ? theme.onPrimary : theme.textSecondary,
                        fontWeight: active ? '600' : '500',
                      },
                    ]}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Results */}
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconContainer,
                { backgroundColor: theme.surfaceAlt },
              ]}
            >
              <Ionicons name="search-outline" size={48} color={theme.primary} />
            </View>
            <Text style={[styles.emptyText, { color: theme.text }]}>
              {localQuery || searchQuery || filterType || showPinnedOnly || showArchivedOnly
                ? 'No se encontraron resultados'
                : 'Busca tus mensajes'}
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              {localQuery || searchQuery || filterType || showPinnedOnly || showArchivedOnly
                ? 'Intenta con otra búsqueda o filtro'
                : 'Escribe para buscar o usa los filtros arriba'}
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
            contentContainerStyle={styles.resultsList}
          />
        )}
      </SafeAreaView>

      <MessageActionsSheet
        visible={!!selectedMessage}
        message={selectedMessage}
        theme={theme}
        onClose={() => setSelectedMessage(null)}
      />
    </View>
  );
}

const CHIP_HEIGHT = 36;
const FILTERS_ROW_HEIGHT = 56;

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  clearButton: { padding: 4 },
  filtersWrapper: {
    height: FILTERS_ROW_HEIGHT,
    borderBottomWidth: 1,
  },
  filtersContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
    height: FILTERS_ROW_HEIGHT,
  },
  filterChip: {
    flexShrink: 0,
    height: CHIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
  },
  filterChipText: {
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  resultsList: { paddingVertical: 12 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

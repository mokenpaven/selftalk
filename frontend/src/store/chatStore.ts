import { create } from 'zustand';
import { database, Message, getDatabaseErrorMessage } from '../database/db';

function sortChatMessages(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    const pinDiff = (b.is_pinned ?? 0) - (a.is_pinned ?? 0);
    if (pinDiff !== 0) return pinDiff;
    if (a.is_pinned === 1 && b.is_pinned === 1) {
      return (b.pinned_at ?? b.timestamp) - (a.pinned_at ?? a.timestamp);
    }
    return a.timestamp - b.timestamp;
  });
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  searchQuery: string;
  filterType: string | null;
  showPinnedOnly: boolean;
  showArchivedOnly: boolean;
  lastError: string | null;

  loadMessages: () => Promise<void>;
  addMessage: (message: Omit<Message, 'id' | 'timestamp' | 'is_pinned' | 'is_trashed' | 'is_archived' | 'pinned_at'>) => Promise<Message>;
  deleteMessage: (id: string) => Promise<void>;
  moveToTrash: (id: string) => Promise<void>;
  moveToArchive: (id: string) => Promise<void>;
  restoreFromArchive: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  updateMessage: (id: string, patch: Partial<Message>) => Promise<void>;
  searchMessages: (query: string) => Promise<void>;
  filterByType: (type: string | null) => Promise<void>;
  togglePinnedOnly: () => Promise<void>;
  toggleArchivedOnly: () => Promise<void>;
  clearSearch: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  applyFilters: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  searchQuery: '',
  filterType: null,
  showPinnedOnly: false,
  showArchivedOnly: false,
  lastError: null,

  loadMessages: async () => {
    set({ isLoading: true, lastError: null });
    try {
      const messages = await database.getMessages(1000);
      set({ messages, isLoading: false });
    } catch (error) {
      console.error('Error loading messages:', error);
      set({ isLoading: false, lastError: getDatabaseErrorMessage(error) });
    }
  },

  addMessage: async (message) => {
    const newMessage = await database.addMessage(message);
    set((state) => ({
      messages: sortChatMessages([...state.messages, newMessage]),
      lastError: null,
    }));
    return newMessage;
  },

  deleteMessage: async (id) => {
    await database.deleteMessage(id);
    set((state) => ({ messages: state.messages.filter((m) => m.id !== id) }));
  },

  moveToTrash: async (id) => {
    await database.moveToTrash(id);
    set((state) => ({ messages: state.messages.filter((m) => m.id !== id) }));
  },

  moveToArchive: async (id) => {
    await database.moveToArchive(id);
    set((state) => ({ messages: state.messages.filter((m) => m.id !== id) }));
  },

  restoreFromArchive: async (id) => {
    await database.restoreFromArchive(id);
    set((state) => ({ messages: state.messages.filter((m) => m.id !== id) }));
  },

  togglePin: async (id) => {
    const now = Date.now();
    await database.togglePin(id);
    set((state) => ({
      messages: sortChatMessages(
        state.messages.map((m) => {
          if (m.id !== id) return m;
          const willPin = m.is_pinned !== 1;
          return {
            ...m,
            is_pinned: willPin ? 1 : 0,
            pinned_at: willPin ? now : null,
          };
        })
      ),
    }));
  },

  updateMessage: async (id, patch) => {
    await database.updateMessage(id, patch);
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  },

  applyFilters: async () => {
    const { searchQuery, filterType, showPinnedOnly, showArchivedOnly } = get();
    const hasFilters =
      searchQuery.trim() !== '' ||
      filterType !== null ||
      showPinnedOnly ||
      showArchivedOnly;

    set({ isLoading: true, lastError: null });
    try {
      if (!hasFilters) {
        await get().loadMessages();
        return;
      }
      const messages = await database.getFilteredMessages({
        query: searchQuery,
        type: filterType,
        pinnedOnly: showPinnedOnly,
        archivedOnly: showArchivedOnly,
      });
      set({ messages, isLoading: false });
    } catch (error) {
      console.error('Error applying filters:', error);
      set({ isLoading: false, lastError: getDatabaseErrorMessage(error) });
    }
  },

  searchMessages: async (query) => {
    set({ searchQuery: query });
    await get().applyFilters();
  },

  filterByType: async (type) => {
    set({ filterType: type });
    await get().applyFilters();
  },

  togglePinnedOnly: async () => {
    set({ showPinnedOnly: !get().showPinnedOnly });
    await get().applyFilters();
  },

  toggleArchivedOnly: async () => {
    set({ showArchivedOnly: !get().showArchivedOnly });
    await get().applyFilters();
  },

  clearSearch: async () => {
    set({
      searchQuery: '',
      filterType: null,
      showPinnedOnly: false,
      showArchivedOnly: false,
      lastError: null,
    });
    await get().loadMessages();
  },

  refreshMessages: async () => {
    await get().applyFilters();
  },
}));
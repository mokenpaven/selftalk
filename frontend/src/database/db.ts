import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let SQLite: any = null;

function loadSQLite() {
  if (Platform.OS === 'web') return null;
  if (!SQLite) {
    SQLite = require('expo-sqlite');
  }
  return SQLite;
}

export interface Message {
  id: string;
  type: 'text' | 'image' | 'voice' | 'file' | 'link';
  content: string;
  file_uri?: string;
  file_name?: string;
  file_size?: number;
  timestamp: number;
  is_pinned: number;
  is_trashed: number;
  is_archived: number;
  pinned_at?: number | null;
  hashtags?: string;
  metadata?: string; // JSON: { durationMs?, alarm?: { at, sound, notificationId } }
}

export interface MessageFilter {
  query?: string;
  type?: string | null;
  pinnedOnly?: boolean;
  archivedOnly?: boolean;
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

const STORAGE_KEY = '@selftalk_messages';
const MIN_FREE_BYTES = 50 * 1024 * 1024;

function wrapDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const upper = message.toUpperCase();

  if (upper.includes('SQLITE_FULL') || upper.includes('DISK') || upper.includes('ENOSPC')) {
    throw new DatabaseError(
      'Espacio insuficiente en el dispositivo. Libera espacio e intenta de nuevo.',
      'SQLITE_FULL'
    );
  }
  if (upper.includes('SQLITE_CORRUPT') || upper.includes('CORRUPT')) {
    throw new DatabaseError(
      'Error en la base de datos local. Reinicia la app o exporta tu backup.',
      'SQLITE_CORRUPT'
    );
  }
  if (upper.includes('LOCKED') || upper.includes('BUSY')) {
    throw new DatabaseError(
      'La base de datos está ocupada. Espera un momento e intenta de nuevo.',
      'SQLITE_BUSY'
    );
  }

  throw new DatabaseError('No se pudo completar la operación en la base de datos local.');
}

class Database {
  private db: any = null;
  private isWeb = Platform.OS === 'web';
  private ready = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.ready) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  isReady(): boolean {
    return this.ready;
  }

  private async doInit(): Promise<void> {
    try {
      if (this.isWeb) {
        console.log('Using AsyncStorage for web platform');
      } else {
        const sqlite = loadSQLite();
        if (!sqlite) {
          throw new DatabaseError('SQLite no disponible en esta plataforma');
        }
        this.db = await sqlite.openDatabaseAsync('selftalk.db');
        await this.db.execAsync('PRAGMA journal_mode=WAL;');
        await this.createTables();
        await this.migrate();
      }
      this.ready = true;
    } catch (error) {
      this.initPromise = null;
      console.error('Error initializing database:', error);
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }
  }

  private ensureReady(): void {
    if (this.isWeb) return;
    if (!this.ready || !this.db) {
      throw new DatabaseError(
        'La base de datos no está lista. Reinicia la aplicación.',
        'NOT_READY'
      );
    }
  }

  private async createTables() {
    if (!this.db) return;
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT,
        file_uri TEXT,
        file_name TEXT,
        file_size INTEGER,
        timestamp INTEGER NOT NULL,
        is_pinned INTEGER DEFAULT 0,
        is_trashed INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        pinned_at INTEGER,
        hashtags TEXT,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_is_pinned ON messages(is_pinned);
      CREATE INDEX IF NOT EXISTS idx_is_trashed ON messages(is_trashed);
      CREATE INDEX IF NOT EXISTS idx_type ON messages(type);
      CREATE INDEX IF NOT EXISTS idx_pinned_at ON messages(pinned_at);
      CREATE INDEX IF NOT EXISTS idx_is_archived ON messages(is_archived);
    `);
  }

  private async migrate() {
    if (!this.db) return;
    try {
      const cols = (await this.db.getAllAsync(
        'PRAGMA table_info(messages)'
      )) as Array<{ name: string }>;
      const colNames = cols.map((c: { name: string }) => c.name);

      if (!colNames.includes('is_trashed')) {
        await this.db.execAsync(
          'ALTER TABLE messages ADD COLUMN is_trashed INTEGER DEFAULT 0'
        );
      }
      if (!colNames.includes('pinned_at')) {
        await this.db.execAsync('ALTER TABLE messages ADD COLUMN pinned_at INTEGER');
        await this.db.execAsync(
          'UPDATE messages SET pinned_at = timestamp WHERE is_pinned = 1 AND pinned_at IS NULL'
        );
      }
      if (!colNames.includes('is_archived')) {
        await this.db.execAsync(
          'ALTER TABLE messages ADD COLUMN is_archived INTEGER DEFAULT 0'
        );
      }
    } catch (error) {
      console.warn('Migration check failed:', error);
    }
  }

  private sortForChat(messages: Message[]): Message[] {
    return messages
      .filter((m) => m.is_trashed !== 1 && m.is_archived !== 1)
      .sort((a, b) => {
        const pinDiff = (b.is_pinned ?? 0) - (a.is_pinned ?? 0);
        if (pinDiff !== 0) return pinDiff;
        if (a.is_pinned === 1 && b.is_pinned === 1) {
          return (b.pinned_at ?? b.timestamp) - (a.pinned_at ?? a.timestamp);
        }
        return a.timestamp - b.timestamp;
      });
  }

  private sortForSearch(messages: Message[]): Message[] {
    return messages
      .filter((m) => m.is_trashed !== 1)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // ===== Web fallback =====
  private async getWebMessages(): Promise<Message[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = data ? JSON.parse(data) : [];
      return parsed.map((m: Message) => ({
        ...m,
        is_trashed: m.is_trashed ?? 0,
        is_archived: m.is_archived ?? 0,
        pinned_at: m.pinned_at ?? (m.is_pinned === 1 ? m.timestamp : null),
      }));
    } catch (error) {
      console.error('Error getting messages from AsyncStorage:', error);
      return [];
    }
  }

  private async setWebMessages(messages: Message[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving messages to AsyncStorage:', error);
      wrapDbError(error);
    }
  }

  async checkFreeSpace(estimatedBytes = 0): Promise<void> {
    if (this.isWeb || Platform.OS === 'web') return;
    try {
      const FileSystem = require('expo-file-system/legacy');
      const freeBytes = await FileSystem.getFreeDiskStorageAsync();
      if (freeBytes < MIN_FREE_BYTES + estimatedBytes) {
        throw new DatabaseError(
          'Espacio insuficiente en el dispositivo. Libera espacio e intenta de nuevo.',
          'LOW_DISK'
        );
      }
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
    }
  }

  async addMessage(
    message: Omit<Message, 'id' | 'timestamp' | 'is_pinned' | 'is_trashed' | 'is_archived' | 'pinned_at'>
  ): Promise<Message> {
    await this.init();
    const estimatedSize = (message.content?.length || 0) + (message.file_size || 0);
    await this.checkFreeSpace(estimatedSize);

    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    const newMessage: Message = {
      id,
      timestamp,
      is_pinned: 0,
      is_trashed: 0,
      is_archived: 0,
      pinned_at: null,
      ...message,
    };

    try {
      if (this.isWeb) {
        const messages = await this.getWebMessages();
        messages.push(newMessage);
        await this.setWebMessages(messages);
      } else {
        this.ensureReady();
        await this.db.runAsync(
          `INSERT INTO messages (id, type, content, file_uri, file_name, file_size, timestamp, is_pinned, is_trashed, is_archived, pinned_at, hashtags, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newMessage.id,
            newMessage.type,
            newMessage.content || null,
            newMessage.file_uri || null,
            newMessage.file_name || null,
            newMessage.file_size || null,
            newMessage.timestamp,
            newMessage.is_pinned,
            newMessage.is_trashed,
            newMessage.is_archived,
            newMessage.pinned_at,
            newMessage.hashtags || null,
            newMessage.metadata || null,
          ]
        );
      }
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }

    return newMessage;
  }

  async insertSystemMessage(
    message: Pick<Message, 'id' | 'type' | 'content' | 'metadata' | 'timestamp'> &
      Partial<Pick<Message, 'file_uri' | 'file_name' | 'file_size' | 'hashtags'>>
  ): Promise<Message> {
    await this.init();
    const newMessage: Message = {
      is_pinned: 0,
      is_trashed: 0,
      is_archived: 0,
      pinned_at: null,
      file_uri: message.file_uri,
      file_name: message.file_name,
      file_size: message.file_size,
      hashtags: message.hashtags,
      ...message,
    };

    try {
      if (this.isWeb) {
        const messages = await this.getWebMessages();
        if (messages.some((m) => m.id === newMessage.id)) return newMessage;
        messages.push(newMessage);
        await this.setWebMessages(messages);
      } else {
        this.ensureReady();
        const existing = await this.db.getFirstAsync(
          'SELECT id FROM messages WHERE id = ?',
          [newMessage.id]
        );
        if (existing) return newMessage;
        await this.db.runAsync(
          `INSERT INTO messages (id, type, content, file_uri, file_name, file_size, timestamp, is_pinned, is_trashed, is_archived, pinned_at, hashtags, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newMessage.id,
            newMessage.type,
            newMessage.content || null,
            newMessage.file_uri || null,
            newMessage.file_name || null,
            newMessage.file_size || null,
            newMessage.timestamp,
            newMessage.is_pinned,
            newMessage.is_trashed,
            newMessage.is_archived,
            newMessage.pinned_at,
            newMessage.hashtags || null,
            newMessage.metadata || null,
          ]
        );
      }
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }

    return newMessage;
  }

  async updateMessage(id: string, patch: Partial<Message>): Promise<void> {
    await this.init();
    try {
      if (this.isWeb) {
        const messages = await this.getWebMessages();
        const updated = messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
        await this.setWebMessages(updated);
      } else {
        this.ensureReady();
        const allowed = [
          'content',
          'file_uri',
          'file_name',
          'file_size',
          'is_pinned',
          'is_trashed',
          'is_archived',
          'pinned_at',
          'hashtags',
          'metadata',
        ];
        const keys = Object.keys(patch).filter((k) => allowed.includes(k));
        if (keys.length === 0) return;
        const setClause = keys.map((k) => `${k} = ?`).join(', ');
        const values = keys.map((k) => (patch as any)[k] ?? null);
        await this.db.runAsync(`UPDATE messages SET ${setClause} WHERE id = ?`, [
          ...values,
          id,
        ]);
      }
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }
  }

  async getMessages(limit: number = 1000, offset: number = 0): Promise<Message[]> {
    await this.init();
    try {
      if (this.isWeb) {
        const sorted = this.sortForChat(await this.getWebMessages());
        return sorted.slice(offset, offset + limit);
      }
      this.ensureReady();
      const result = (await this.db.getAllAsync(
        `SELECT * FROM messages WHERE is_trashed = 0 AND is_archived = 0
         ORDER BY is_pinned DESC, CASE WHEN is_pinned = 1 THEN pinned_at ELSE timestamp END ASC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      )) as Message[];
      return result;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }
  }

  async getFilteredMessages(filter: MessageFilter = {}): Promise<Message[]> {
    await this.init();
    const { query, type, pinnedOnly, archivedOnly } = filter;
    const trimmedQuery = query?.trim() ?? '';

    try {
      if (this.isWeb) {
        let results = await this.getWebMessages();
        if (archivedOnly) {
          results = results.filter((m) => m.is_archived === 1);
        } else {
          results = results.filter((m) => m.is_archived !== 1);
        }
        if (pinnedOnly) results = results.filter((m) => m.is_pinned === 1);
        if (type) results = results.filter((m) => m.type === type);
        if (trimmedQuery) {
          const q = trimmedQuery.toLowerCase();
          results = results.filter(
            (m) =>
              m.content?.toLowerCase().includes(q) ||
              m.file_name?.toLowerCase().includes(q)
          );
        }
        return this.sortForSearch(results);
      }

      this.ensureReady();
      const conditions = ['is_trashed = 0'];
      const params: (string | number)[] = [];

      if (archivedOnly) {
        conditions.push('is_archived = 1');
      } else {
        conditions.push('is_archived = 0');
      }
      if (pinnedOnly) conditions.push('is_pinned = 1');
      if (type) {
        conditions.push('type = ?');
        params.push(type);
      }
      if (trimmedQuery) {
        conditions.push('(content LIKE ? OR file_name LIKE ?)');
        const term = `%${trimmedQuery}%`;
        params.push(term, term);
      }

      const where = conditions.join(' AND ');
      return (await this.db.getAllAsync(
        `SELECT * FROM messages WHERE ${where} ORDER BY timestamp DESC`,
        params
      )) as Message[];
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }
  }

  async getTrashedMessages(): Promise<Message[]> {
    await this.init();
    try {
      if (this.isWeb) {
        const all = await this.getWebMessages();
        return all.filter((m) => m.is_trashed === 1).sort((a, b) => b.timestamp - a.timestamp);
      }
      this.ensureReady();
      return (await this.db.getAllAsync(
        'SELECT * FROM messages WHERE is_trashed = 1 ORDER BY timestamp DESC'
      )) as Message[];
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }
  }

  async searchMessages(query: string): Promise<Message[]> {
    return this.getFilteredMessages({ query });
  }

  async togglePin(id: string): Promise<void> {
    await this.init();
    const now = Date.now();
    try {
      if (this.isWeb) {
        const all = await this.getWebMessages();
        await this.setWebMessages(
          all.map((m) => {
            if (m.id !== id) return m;
            const willPin = m.is_pinned !== 1;
            return {
              ...m,
              is_pinned: willPin ? 1 : 0,
              pinned_at: willPin ? now : null,
            };
          })
        );
      } else {
        this.ensureReady();
        await this.db.runAsync(
          `UPDATE messages SET
            is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END,
            pinned_at = CASE WHEN is_pinned = 1 THEN NULL ELSE ? END
           WHERE id = ?`,
          [now, id]
        );
      }
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }
  }

  async moveToTrash(id: string): Promise<void> {
    await this.updateMessage(id, { is_trashed: 1, is_archived: 0 });
  }

  async moveToArchive(id: string): Promise<void> {
    await this.updateMessage(id, { is_archived: 1, is_trashed: 0 });
  }

  async restoreFromArchive(id: string): Promise<void> {
    await this.updateMessage(id, { is_archived: 0 });
  }

  async restoreFromTrash(id: string): Promise<void> {
    await this.updateMessage(id, { is_trashed: 0 });
  }

  async deleteMessage(id: string): Promise<void> {
    await this.init();
    try {
      if (this.isWeb) {
        const all = await this.getWebMessages();
        await this.setWebMessages(all.filter((m) => m.id !== id));
      } else {
        this.ensureReady();
        await this.db.runAsync('DELETE FROM messages WHERE id = ?', [id]);
      }
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }
  }

  async getMessagesByType(type: string): Promise<Message[]> {
    return this.getFilteredMessages({ type });
  }

  async getPinnedMessages(): Promise<Message[]> {
    return this.getFilteredMessages({ pinnedOnly: true });
  }

  async getArchivedMessages(): Promise<Message[]> {
    return this.getFilteredMessages({ archivedOnly: true });
  }

  async getMessagesByHashtag(tag: string): Promise<Message[]> {
    await this.init();
    try {
      if (this.isWeb) {
        const all = await this.getWebMessages();
        return this.sortForSearch(
          all.filter((m) => m.hashtags?.includes(tag) && m.is_trashed !== 1)
        );
      }
      this.ensureReady();
      return (await this.db.getAllAsync(
        'SELECT * FROM messages WHERE hashtags LIKE ? AND is_trashed = 0 ORDER BY timestamp DESC',
        [`%${tag}%`]
      )) as Message[];
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }
  }

  async getAllMessages(): Promise<Message[]> {
    await this.init();
    try {
      if (this.isWeb) {
        return this.sortForChat(await this.getWebMessages());
      }
      this.ensureReady();
      return (await this.db.getAllAsync(
        `SELECT * FROM messages WHERE is_trashed = 0
         ORDER BY is_pinned DESC, CASE WHEN is_pinned = 1 THEN pinned_at ELSE timestamp END ASC`
      )) as Message[];
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }
  }

  async importMessages(
    messages: Message[],
    mode: 'merge' | 'replace'
  ): Promise<{ imported: number; skipped: number }> {
    await this.init();
    let imported = 0;
    let skipped = 0;

    const insertOne = async (msg: Message, skipIfExists: boolean): Promise<void> => {
      const normalized: Message = {
        ...msg,
        is_pinned: msg.is_pinned ?? 0,
        is_trashed: msg.is_trashed ?? 0,
        is_archived: msg.is_archived ?? 0,
        pinned_at: msg.pinned_at ?? (msg.is_pinned === 1 ? msg.timestamp : null),
      };

      if (this.isWeb) {
        const all = await this.getWebMessages();
        if (skipIfExists && all.some((m) => m.id === normalized.id)) {
          skipped++;
          return;
        }
        all.push(normalized);
        await this.setWebMessages(all);
        imported++;
        return;
      }

      this.ensureReady();
      if (skipIfExists) {
        const existing = await this.db.getFirstAsync('SELECT id FROM messages WHERE id = ?', [
          normalized.id,
        ]);
        if (existing) {
          skipped++;
          return;
        }
      }

      await this.db.runAsync(
        `INSERT INTO messages (id, type, content, file_uri, file_name, file_size, timestamp, is_pinned, is_trashed, is_archived, pinned_at, hashtags, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalized.id,
          normalized.type,
          normalized.content || null,
          normalized.file_uri || null,
          normalized.file_name || null,
          normalized.file_size || null,
          normalized.timestamp,
          normalized.is_pinned,
          normalized.is_trashed,
          normalized.is_archived,
          normalized.pinned_at,
          normalized.hashtags || null,
          normalized.metadata || null,
        ]
      );
      imported++;
    };

    try {
      if (this.isWeb) {
        if (mode === 'replace') {
          await this.setWebMessages([]);
        }
        for (const msg of messages) {
          await insertOne(msg, mode === 'merge');
        }
        return { imported, skipped };
      }

      this.ensureReady();
      await this.db.withTransactionAsync(async () => {
        if (mode === 'replace') {
          await this.db.runAsync('DELETE FROM messages');
        }
        for (const msg of messages) {
          await insertOne(msg, mode === 'merge');
        }
      });
      return { imported, skipped };
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }
  }

  async clearAllMessages(): Promise<void> {
    await this.init();
    try {
      if (this.isWeb) {
        await this.setWebMessages([]);
      } else {
        this.ensureReady();
        await this.db.runAsync('DELETE FROM messages');
      }
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }
  }

  async emptyTrash(): Promise<void> {
    await this.init();
    try {
      if (this.isWeb) {
        const all = await this.getWebMessages();
        await this.setWebMessages(all.filter((m) => m.is_trashed !== 1));
      } else {
        this.ensureReady();
        await this.db.runAsync('DELETE FROM messages WHERE is_trashed = 1');
      }
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }
  }

  async getStorageStats(): Promise<{ totalBytes: number; messageCount: number }> {
    await this.init();
    try {
      const messages = this.isWeb
        ? await this.getWebMessages()
        : ((await this.db.getAllAsync('SELECT * FROM messages')) as Message[]);

      let totalBytes = 0;
      for (const m of messages) {
        totalBytes += (m.content?.length || 0) * 1;
        totalBytes += m.file_name?.length || 0;
        totalBytes += m.file_uri?.length || 0;
        totalBytes += m.file_size || 0;
        totalBytes += m.hashtags?.length || 0;
        totalBytes += m.metadata?.length || 0;
        totalBytes += 64;
      }

      return { totalBytes, messageCount: messages.length };
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      wrapDbError(error);
    }
  }
}

export const database = new Database();

export function getDatabaseErrorMessage(error: unknown): string {
  if (error instanceof DatabaseError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Ocurrió un error inesperado.';
}
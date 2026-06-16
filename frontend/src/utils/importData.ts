import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Platform } from 'react-native';
import { database, Message, getDatabaseErrorMessage } from '../database/db';
import {
  BackupMessageType,
  BackupPayload,
  ExportBackupMessage,
  filterMessagesByTypes,
} from './backupTypes';

function extensionFromMime(mime?: string, fileName?: string): string {
  if (fileName?.includes('.')) {
    return fileName.split('.').pop() || 'bin';
  }
  if (!mime) return 'bin';
  if (mime.includes('m4a') || mime.includes('mp4')) return 'm4a';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  return 'bin';
}

function normalizeImportedMessage(raw: ExportBackupMessage): Message {
  return {
    id: raw.id,
    type: raw.type,
    content: raw.content || '',
    file_uri: raw.file_uri,
    file_name: raw.file_name,
    file_size: raw.file_size,
    timestamp: raw.timestamp,
    is_pinned: raw.is_pinned ?? 0,
    is_trashed: raw.is_trashed ?? 0,
    is_archived: raw.is_archived ?? 0,
    pinned_at: raw.pinned_at ?? (raw.is_pinned === 1 ? raw.timestamp : null),
    hashtags: Array.isArray(raw.hashtags)
      ? JSON.stringify(raw.hashtags)
      : typeof raw.hashtags === 'string'
        ? raw.hashtags
        : undefined,
    metadata:
      raw.metadata && typeof raw.metadata === 'object'
        ? JSON.stringify(raw.metadata)
        : typeof raw.metadata === 'string'
          ? raw.metadata
          : undefined,
  };
}

async function restoreEmbeddedMedia(message: Message, raw: ExportBackupMessage): Promise<Message> {
  if (!raw.embeddedData || Platform.OS === 'web') {
    return message;
  }

  const ext = extensionFromMime(raw.embeddedMime, raw.embeddedFileName || raw.file_name);
  const safeId = message.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const destUri = `${FileSystem.documentDirectory}imported_${safeId}.${ext}`;

  await FileSystem.writeAsStringAsync(destUri, raw.embeddedData, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const info = await FileSystem.getInfoAsync(destUri);
  return {
    ...message,
    file_uri: destUri,
    file_name: raw.embeddedFileName || raw.file_name || `imported.${ext}`,
    file_size: info.exists && 'size' in info ? info.size : message.file_size,
  };
}

function parseBackupJson(content: string): BackupPayload {
  const parsed = JSON.parse(content) as BackupPayload;
  if (parsed.app !== 'SelfTalk' || !Array.isArray(parsed.messages)) {
    throw new Error('El archivo no es un backup válido de SelfTalk');
  }
  return parsed;
}

function countByType(messages: Message[]): string {
  const counts: Record<string, number> = {};
  for (const m of messages) {
    counts[m.type] = (counts[m.type] || 0) + 1;
  }
  const labels: Record<string, string> = {
    text: 'texto',
    link: 'enlaces',
    image: 'imágenes',
    voice: 'notas de voz',
    file: 'archivos',
  };
  return Object.entries(counts)
    .map(([type, n]) => `${n} ${labels[type] || type}`)
    .join(' · ');
}

export async function pickBackupFile(): Promise<BackupPayload | null> {
  const pick = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });

  if (pick.canceled || !pick.assets[0]) {
    return null;
  }

  const content = await FileSystem.readAsStringAsync(pick.assets[0].uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return parseBackupJson(content);
}

export async function importBackup(
  includedTypes: BackupMessageType[],
  mode: 'merge' | 'replace',
  payload: BackupPayload,
  options?: { updateChatName?: (name: string) => Promise<void> }
): Promise<{ imported: number; skipped: number; warnings: string[] }> {
  const rawById = new Map(payload.messages.map((m) => [m.id, m]));
  const normalized = payload.messages.map(normalizeImportedMessage);
  const filtered = filterMessagesByTypes(normalized, includedTypes);

  if (filtered.length === 0) {
    throw new Error('No hay mensajes que coincidan con los tipos seleccionados');
  }

  let estimatedBytes = 0;
  for (const raw of payload.messages) {
    estimatedBytes += (raw.content?.length || 0) + (raw.embeddedData?.length || 0);
  }
  await database.checkFreeSpace(estimatedBytes);

  const warnings: string[] = [];
  const restored: Message[] = [];

  for (const msg of filtered) {
    const raw = rawById.get(msg.id);
    let restoredMsg = msg;

    if ((msg.type === 'voice' || msg.type === 'file') && raw?.embeddedData) {
      restoredMsg = await restoreEmbeddedMedia(msg, raw);
    } else if ((msg.type === 'voice' || msg.type === 'file') && !raw?.embeddedData) {
      warnings.push(`Audio/archivo sin datos embebidos: ${msg.file_name || msg.id}`);
    }

    restored.push(restoredMsg);
  }

  const result = await database.importMessages(restored, mode);

  if (payload.chatName && options?.updateChatName) {
    await options.updateChatName(payload.chatName);
  }

  return { ...result, warnings: [...new Set(warnings)] };
}

export async function runImportBackupFlow(
  includedTypes: BackupMessageType[],
  options: {
    updateChatName?: (name: string) => Promise<void>;
    onComplete?: () => Promise<void>;
  }
): Promise<void> {
  try {
    const payload = await pickBackupFile();
    if (!payload) return;

    const filtered = filterMessagesByTypes(
      payload.messages.map(normalizeImportedMessage),
      includedTypes
    );

    if (filtered.length === 0) {
      Alert.alert('Sin mensajes', 'El archivo no contiene mensajes de los tipos seleccionados');
      return;
    }

    const dateLabel = payload.exportedAt
      ? new Date(payload.exportedAt).toLocaleDateString('es-ES')
      : 'fecha desconocida';

    const summary =
      `Backup de "${payload.chatName || 'Yo'}" (${dateLabel})\n` +
      `${countByType(filtered)}\n\n` +
      `Total a importar: ${filtered.length}`;

    const executeImport = async (mode: 'merge' | 'replace') => {
      try {
        const result = await importBackup(includedTypes, mode, payload, options);
        let message = `Se importaron ${result.imported} mensaje(s)`;
        if (result.skipped > 0) {
          message += `\n${result.skipped} omitido(s) por ID duplicado`;
        }
        if (result.warnings.length > 0) {
          message += `\n\nAviso: algunos audios/archivos no pudieron restaurarse.`;
        }
        Alert.alert('Importación completa', message);
        await options.onComplete?.();
      } catch (error) {
        console.error('Import backup error:', error);
        Alert.alert('Error', getDatabaseErrorMessage(error));
      }
    };

    Alert.alert('Importar conversación', `${summary}\n\n¿Cómo querés importar?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Combinar', onPress: () => executeImport('merge') },
      { text: 'Reemplazar', style: 'destructive', onPress: () => executeImport('replace') },
    ]);
  } catch (error) {
    console.error('Import flow error:', error);
    Alert.alert('Error', getDatabaseErrorMessage(error));
  }
}

export { DEFAULT_BACKUP_TYPES, BACKUP_TYPE_OPTIONS } from './backupTypes';
export type { BackupMessageType } from './backupTypes';
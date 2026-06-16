import { Message } from '../database/db';

export type BackupMessageType = 'text' | 'link' | 'image' | 'voice' | 'file';

export const BACKUP_TYPE_OPTIONS: Array<{ id: BackupMessageType; label: string }> = [
  { id: 'text', label: 'Texto' },
  { id: 'link', label: 'Enlaces' },
  { id: 'image', label: 'Imágenes' },
  { id: 'voice', label: 'Notas de voz' },
  { id: 'file', label: 'Archivos adjuntos' },
];

export const DEFAULT_BACKUP_TYPES: BackupMessageType[] = BACKUP_TYPE_OPTIONS.map((o) => o.id);

export function filterMessagesByTypes(
  messages: Message[],
  types: BackupMessageType[]
): Message[] {
  const set = new Set(types);
  return messages.filter((m) => set.has(m.type as BackupMessageType));
}

export interface ExportBackupMessage extends Omit<Message, 'hashtags' | 'metadata'> {
  hashtags?: string[] | null;
  metadata?: Record<string, unknown> | null;
  embeddedData?: string;
  embeddedMime?: string;
  embeddedFileName?: string;
}

export interface BackupPayload {
  app: string;
  version: string;
  exportedAt: string;
  chatName: string;
  includedTypes: BackupMessageType[];
  messageCount: number;
  messages: ExportBackupMessage[];
}
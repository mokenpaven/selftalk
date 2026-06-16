import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import { Platform, Alert } from 'react-native';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { database, Message, getDatabaseErrorMessage } from '../database/db';
import {
  BackupMessageType,
  BackupPayload,
  ExportBackupMessage,
  filterMessagesByTypes,
} from './backupTypes';

export type ExportFormat = 'markdown' | 'json';
export { BACKUP_TYPE_OPTIONS, DEFAULT_BACKUP_TYPES } from './backupTypes';
export type { BackupMessageType } from './backupTypes';

const typeLabels: Record<string, string> = {
  text: '💬 Texto',
  image: '🖼️ Imagen',
  voice: '🎤 Audio',
  file: '📎 Archivo',
  link: '🔗 Enlace',
};

function groupByDate(messages: Message[]): Record<string, Message[]> {
  const groups: Record<string, Message[]> = {};
  messages.forEach((m) => {
    const dateKey = format(m.timestamp, 'yyyy-MM-dd');
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(m);
  });
  return groups;
}

function formatMessageForMarkdown(m: Message): string {
  const time = format(m.timestamp, 'HH:mm', { locale: es });
  const pinIcon = m.is_pinned === 1 ? '📌 ' : '';

  let body = '';
  switch (m.type) {
    case 'text':
      body = m.content;
      break;
    case 'link':
      body = `[${m.content}](${m.content.startsWith('http') ? m.content : 'https://' + m.content})`;
      break;
    case 'image':
      body = '*[Imagen]*';
      break;
    case 'voice':
      try {
        const meta = m.metadata ? JSON.parse(m.metadata) : {};
        const seconds = Math.floor((meta.durationMs || 0) / 1000);
        body = `*[Audio de voz · ${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}]*`;
      } catch {
        body = '*[Audio de voz]*';
      }
      break;
    case 'file':
      body = `*[Archivo: ${m.file_name || 'sin nombre'}]*`;
      break;
  }

  let result = `**[${time}]** ${pinIcon}${typeLabels[m.type] || m.type}\n\n${body}\n`;

  if (m.hashtags) {
    try {
      const tags = JSON.parse(m.hashtags) as string[];
      if (tags.length > 0) {
        result += `\n*Etiquetas: ${tags.join(' ')}*\n`;
      }
    } catch {
      // ignore
    }
  }

  return result;
}

async function buildExportContent(
  format_: ExportFormat,
  chatName: string
): Promise<{ content: string; fileName: string; mimeType: string; messageCount: number } | null> {
  const messages = await database.getAllMessages();
  if (messages.length === 0) {
    Alert.alert('Sin mensajes', 'No hay mensajes para exportar');
    return null;
  }

  const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm');
  let content = '';
  let fileName = '';
  let mimeType = '';

  if (format_ === 'markdown') {
    const lines: string[] = [];
    lines.push(`# SelfTalk - Conversación con ${chatName}`);
    lines.push('');
    lines.push(
      `*Exportado el ${format(new Date(), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}*`
    );
    lines.push('');
    lines.push(`**Total de mensajes:** ${messages.length}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    const grouped = groupByDate(messages);
    const dateKeys = Object.keys(grouped).sort();

    for (const dateKey of dateKeys) {
      const dateLabel = format(new Date(dateKey), "EEEE, d 'de' MMMM 'de' yyyy", {
        locale: es,
      });
      lines.push(`## ${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}`);
      lines.push('');
      for (const m of grouped[dateKey]) {
        lines.push(formatMessageForMarkdown(m));
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }

    lines.push('');
    lines.push('*Generado por SelfTalk - Tu espacio personal*');

    content = lines.join('\n');
    fileName = `SelfTalk-${timestamp}.md`;
    mimeType = 'text/markdown';
  } else {
    const exportData = {
      app: 'SelfTalk',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      chatName,
      messageCount: messages.length,
      messages: messages.map((m) => ({
        ...m,
        hashtags: m.hashtags ? safeJsonParse(m.hashtags) : null,
        metadata: m.metadata ? safeJsonParse(m.metadata) : null,
      })),
    };

    content = JSON.stringify(exportData, null, 2);
    fileName = `SelfTalk-Backup-${timestamp}.json`;
    mimeType = 'application/json';
  }

  return { content, fileName, mimeType, messageCount: messages.length };
}

function guessEmbeddedMime(message: Message): string {
  if (message.type === 'voice') return 'audio/m4a';
  const name = message.file_name?.toLowerCase() || '';
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

async function embedMediaForExport(message: Message): Promise<ExportBackupMessage> {
  const exported: ExportBackupMessage = {
    ...message,
    hashtags: message.hashtags ? (safeJsonParse(message.hashtags) as string[] | null) : null,
    metadata: message.metadata
      ? (safeJsonParse(message.metadata) as Record<string, unknown> | null)
      : null,
  };

  if (
    (message.type === 'voice' || message.type === 'file') &&
    message.file_uri &&
    Platform.OS !== 'web'
  ) {
    try {
      const info = await FileSystem.getInfoAsync(message.file_uri);
      if (info.exists) {
        const embeddedData = await FileSystem.readAsStringAsync(message.file_uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        exported.embeddedData = embeddedData;
        exported.embeddedMime = guessEmbeddedMime(message);
        exported.embeddedFileName = message.file_name || `${message.id}.bin`;
      }
    } catch (error) {
      console.warn('Could not embed media for export:', message.id, error);
    }
  }

  return exported;
}

async function buildBackupContent(
  chatName: string,
  includedTypes: BackupMessageType[]
): Promise<{ content: string; fileName: string; mimeType: string; messageCount: number } | null> {
  const allMessages = await database.getAllMessages();
  const messages = filterMessagesByTypes(allMessages, includedTypes);

  if (messages.length === 0) {
    Alert.alert('Sin mensajes', 'No hay mensajes que coincidan con los tipos seleccionados');
    return null;
  }

  const exportedMessages: ExportBackupMessage[] = [];
  for (const message of messages) {
    exportedMessages.push(await embedMediaForExport(message));
  }

  const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm');
  const payload: BackupPayload = {
    app: 'SelfTalk',
    version: '1.1.0',
    exportedAt: new Date().toISOString(),
    chatName,
    includedTypes,
    messageCount: exportedMessages.length,
    messages: exportedMessages,
  };

  return {
    content: JSON.stringify(payload, null, 2),
    fileName: `SelfTalk-Backup-${timestamp}.json`,
    mimeType: 'application/json',
    messageCount: exportedMessages.length,
  };
}

export async function exportBackup(
  includedTypes: BackupMessageType[],
  chatName: string = 'Yo'
): Promise<void> {
  try {
    const built = await buildBackupContent(chatName, includedTypes);
    if (!built) return;
    const { content, fileName, mimeType } = built;

    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle: 'Exportar backup',
        UTI: 'public.json',
      });
    } else {
      Alert.alert('Archivo guardado', `El archivo se guardó en: ${fileUri}`);
    }
  } catch (error) {
    console.error('Error exporting backup:', error);
    Alert.alert('Error', getDatabaseErrorMessage(error));
  }
}

export async function exportMessages(
  format_: ExportFormat,
  chatName: string = 'Yo'
): Promise<void> {
  try {
    const built = await buildExportContent(format_, chatName);
    if (!built) return;
    const { content, fileName, mimeType } = built;

    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle:
          format_ === 'markdown'
            ? 'Exportar como Markdown'
            : 'Backup completo (JSON)',
        UTI: format_ === 'markdown' ? 'net.daringfireball.markdown' : 'public.json',
      });
    } else {
      Alert.alert('Archivo guardado', `El archivo se guardó en: ${fileUri}`);
    }
  } catch (error) {
    console.error('Error exporting messages:', error);
    Alert.alert('Error', getDatabaseErrorMessage(error));
  }
}

/**
 * Send Markdown export by email to the configured address.
 * Falls back to native mail composer or share sheet.
 */
export async function sendMarkdownByEmail(
  chatName: string,
  email: string
): Promise<void> {
  if (!email || !email.includes('@')) {
    Alert.alert(
      'Email no configurado',
      'Configura un correo válido en Ajustes para usar esta función.'
    );
    return;
  }

  try {
    const built = await buildExportContent('markdown', chatName);
    if (!built) return;
    const { content, fileName, messageCount } = built;

    const subject = `📝 SelfTalk - Backup de tu conversación con ${chatName}`;
    const dateStr = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
    const bodyText = `Hola,\n\nAquí tienes tu backup de SelfTalk del ${dateStr}.\n\nResumen:\n• Total de mensajes: ${messageCount}\n• Formato: Markdown\n• Chat: ${chatName}\n\nGuarda este archivo en un lugar seguro.\n\n— SelfTalk · Tus notas son tuyas.`;

    if (Platform.OS === 'web') {
      // Build mailto with body (limited length); also download file for attaching
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
      window.location.href = mailto;
      Alert.alert(
        'Email preparado',
        'El archivo se descargó. Adjúntalo manualmente al correo que se acaba de abrir.'
      );
      return;
    }

    // Mobile: try MailComposer first
    const available = await MailComposer.isAvailableAsync();
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (available) {
      const result = await MailComposer.composeAsync({
        recipients: [email],
        subject,
        body: bodyText,
        attachments: [fileUri],
        isHtml: false,
      });

      if (result.status === MailComposer.MailComposerStatus.SENT) {
        Alert.alert('✅ Enviado', `Backup enviado a ${email}`);
      }
      return;
    }

    // Fallback to share sheet
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      Alert.alert(
        'Correo no configurado',
        'No hay app de email configurada. Te abrimos el menú compartir para que elijas dónde enviarlo.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Compartir',
            onPress: () =>
              Sharing.shareAsync(fileUri, {
                mimeType: 'text/markdown',
                dialogTitle: `Enviar a ${email}`,
              }),
          },
        ]
      );
    } else {
      Alert.alert('Error', 'No se pudo enviar el correo en este dispositivo.');
    }
  } catch (error) {
    console.error('Error sending email:', error);
    Alert.alert('Error', 'No se pudo enviar el correo. Intenta de nuevo.');
  }
}

function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

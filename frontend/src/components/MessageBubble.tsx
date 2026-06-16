import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { RectButton } from 'react-native-gesture-handler';
import { Message } from '../database/db';
import { Image } from 'expo-image';
import { VoicePlayer } from './VoicePlayer';
import { ThemePalette } from '../theme/themes';
import { isWelcomeMessage } from '../constants/welcomeMessage';

const WELCOME_BUBBLE_BG = '#4C1D95';
const WELCOME_BUBBLE_TEXT = '#EDE9FE';
const WELCOME_BUBBLE_META = '#C4B5FD';

interface MessageBubbleProps {
  message: Message;
  theme: ThemePalette;
  onLongPress: (message: Message) => void;
  onSwipeTrash?: (message: Message) => void;
  onSwipeArchive?: (message: Message) => void;
}

export function MessageBubble({
  message,
  theme,
  onLongPress,
  onSwipeTrash,
  onSwipeArchive,
}: MessageBubbleProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const isWelcome = isWelcomeMessage(message);
  const canSwipe = !!onSwipeTrash || !!onSwipeArchive;

  const handleLinkPress = async () => {
    if (message.type === 'link' && message.content) {
      try {
        const url = message.content.startsWith('http')
          ? message.content
          : `https://${message.content}`;
        await Linking.openURL(url);
      } catch (error) {
        console.error('Error opening link:', error);
      }
    }
  };

  const meta = message.metadata ? safeParse(message.metadata) : {};
  const alarm = meta.alarm as { notificationId?: string; at?: number } | undefined;
  const hasAlarm = !!alarm?.notificationId;
  const alarmAt = alarm?.at;
  const isPinned = message.is_pinned === 1;

  const bubbleBg = isWelcome ? WELCOME_BUBBLE_BG : theme.bubbleBg;
  const bubbleText = isWelcome ? WELCOME_BUBBLE_TEXT : theme.bubbleText;
  const bubbleMeta = isWelcome ? WELCOME_BUBBLE_META : theme.bubbleMeta;

  const renderContent = () => {
    switch (message.type) {
      case 'text':
        return (
          <Text style={[styles.messageText, { color: bubbleText }]}>
            {message.content}
          </Text>
        );

      case 'image':
        return (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: message.content }}
              style={styles.image}
              contentFit="cover"
            />
          </View>
        );

      case 'link':
        return (
          <Pressable onPress={handleLinkPress}>
            <View style={styles.linkContainer}>
              <View style={[styles.linkIconWrapper, { backgroundColor: `${theme.primary}33` }]}>
                <Ionicons name="link" size={14} color={isWelcome ? WELCOME_BUBBLE_TEXT : theme.primary} />
              </View>
              <Text
                style={[styles.linkText, { color: isWelcome ? WELCOME_BUBBLE_TEXT : theme.primary }]}
                numberOfLines={2}
              >
                {message.content}
              </Text>
            </View>
          </Pressable>
        );

      case 'voice':
        if (!message.file_uri) {
          return (
            <View style={styles.voiceUnavailable}>
              <Ionicons name="alert-circle-outline" size={20} color={bubbleMeta} />
              <Text style={[styles.voiceText, { color: bubbleMeta }]}>
                Audio no disponible
              </Text>
            </View>
          );
        }
        return (
          <VoicePlayer
            uri={message.file_uri}
            durationMs={(meta.durationMs as number) || 0}
            theme={theme}
          />
        );

      case 'file':
        return (
          <View style={styles.fileContainer}>
            <View style={[styles.fileIconWrapper, { backgroundColor: `${theme.primary}33` }]}>
              <Ionicons name="document" size={20} color={isWelcome ? WELCOME_BUBBLE_TEXT : theme.primary} />
            </View>
            <View style={styles.fileInfo}>
              <Text
                style={[styles.fileName, { color: bubbleText }]}
                numberOfLines={1}
              >
                {message.file_name || 'Archivo'}
              </Text>
              {message.file_size && (
                <Text style={[styles.fileSize, { color: bubbleMeta }]}>
                  {formatFileSize(message.file_size)}
                </Text>
              )}
            </View>
          </View>
        );
    }
  };

  const bubbleBody = (
    <Pressable
      onLongPress={() => onLongPress(message)}
      delayLongPress={350}
      style={styles.bubbleContainer}
      testID={`message-${message.id}`}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleBg,
            shadowColor: isWelcome ? WELCOME_BUBBLE_BG : theme.primary,
            borderColor: isPinned ? theme.warning : 'transparent',
            borderWidth: isPinned ? 1.5 : 0,
          },
        ]}
      >
        {isPinned && (
          <View style={styles.pinIndicator}>
            <Ionicons name="pin" size={11} color={theme.warning} />
          </View>
        )}

        {renderContent()}

        {hasAlarm && alarmAt != null && (
          <View style={[styles.alarmBadge, { backgroundColor: `${theme.primary}22` }]}>
            <Ionicons name="alarm" size={11} color={theme.primary} />
            <Text style={[styles.alarmText, { color: theme.primary }]}>
              {formatAlarmTime(alarmAt)}
            </Text>
          </View>
        )}

        <View style={styles.metaRow}>
          <Text style={[styles.timestamp, { color: bubbleMeta }]}>
            {format(message.timestamp, 'HH:mm', { locale: es })}
          </Text>
          {!isWelcome && (
            <Ionicons name="checkmark-done" size={14} color={bubbleMeta} />
          )}
        </View>
      </View>
    </Pressable>
  );

  if (!canSwipe) return bubbleBody;

  const renderArchiveAction = () => (
    <RectButton
      style={[styles.swipeAction, styles.archiveAction]}
      onPress={() => {
        swipeableRef.current?.close();
        onSwipeArchive?.(message);
      }}
    >
      <Ionicons name="archive" size={22} color="#fff" />
      <Text style={styles.swipeActionText}>Archivar</Text>
    </RectButton>
  );

  const renderTrashAction = () => (
    <RectButton
      style={[styles.swipeAction, styles.trashAction]}
      onPress={() => {
        swipeableRef.current?.close();
        onSwipeTrash?.(message);
      }}
    >
      <Ionicons name="trash" size={22} color="#fff" />
      <Text style={styles.swipeActionText}>Papelera</Text>
    </RectButton>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={onSwipeArchive ? renderArchiveAction : undefined}
      renderRightActions={onSwipeTrash ? renderTrashAction : undefined}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
      onSwipeableOpen={(direction) => {
        swipeableRef.current?.close();
        if (direction === 'left') onSwipeArchive?.(message);
        if (direction === 'right') onSwipeTrash?.(message);
      }}
    >
      {bubbleBody}
    </Swipeable>
  );
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAlarmTime(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `Hoy ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  bubbleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 3,
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingTop: 10,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  pinIndicator: {
    position: 'absolute',
    top: 6,
    left: 8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
    opacity: 0.85,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  image: {
    width: 220,
    height: 220,
    borderRadius: 12,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 8,
  },
  linkIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 15,
    flex: 1,
    textDecorationLine: 'underline',
  },
  voiceUnavailable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  voiceText: {
    fontSize: 14,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 10,
    minWidth: 180,
  },
  fileIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileSize: {
    fontSize: 11,
    marginTop: 2,
  },
  alarmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
    gap: 4,
  },
  alarmText: {
    fontSize: 11,
    fontWeight: '600',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    marginVertical: 3,
    borderRadius: 16,
    gap: 4,
  },
  archiveAction: {
    backgroundColor: '#7C3AED',
    marginLeft: 16,
  },
  trashAction: {
    backgroundColor: '#DC2626',
    marginRight: 16,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
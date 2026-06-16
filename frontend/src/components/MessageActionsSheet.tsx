import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { database, Message } from '../database/db';
import { ThemePalette } from '../theme/themes';
import { useSettingsStore, ALARM_SOUNDS, AlarmSound } from '../store/settingsStore';
import { useChatStore } from '../store/chatStore';
import {
  scheduleAlarm,
  cancelAlarm,
  ALARM_PRESETS,
  getNextOccurrence,
  formatTime24h,
} from '../utils/alarms';
interface MessageActionsSheetProps {
  visible: boolean;
  message: Message | null;
  theme: ThemePalette;
  onClose: () => void;
  listContext?: 'chat' | 'trash' | 'archived';
}

type Step = 'main' | 'alarm-time' | 'alarm-custom-time' | 'alarm-sound';

export function MessageActionsSheet({
  visible,
  message,
  theme,
  onClose,
  listContext = 'chat',
}: MessageActionsSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetBottomPadding = Math.max(insets.bottom, 16) + 16;
  const [step, setStep] = useState<Step>('main');
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState(() => getNextOccurrence(9, 0));
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const defaultSound = useSettingsStore((s) => s.defaultAlarmSound);
  const setDefaultAlarmSound = useSettingsStore((s) => s.setDefaultAlarmSound);
  const {
    togglePin,
    moveToTrash,
    moveToArchive,
    restoreFromArchive,
    deleteMessage,
    updateMessage,
  } = useChatStore();

  const handleClose = () => {
    setStep('main');
    setPendingPreset(null);
    setShowAndroidPicker(false);
    onClose();
  };

  const handleSaveToGallery = async () => {
    if (!message || message.type !== 'image' || !message.content) return;

    if (Platform.OS === 'web') {
      Alert.alert('No disponible', 'Guardar en galería solo está disponible en dispositivos móviles');
      return;
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para guardar la imagen');
        return;
      }

      let base64 = message.content;
      let extension = 'jpg';
      const dataUriMatch = message.content.match(/^data:image\/(\w+);base64,(.+)$/);
      if (dataUriMatch) {
        extension = dataUriMatch[1] === 'png' ? 'png' : 'jpg';
        base64 = dataUriMatch[2];
      }

      const fileUri = `${FileSystem.cacheDirectory}selftalk_${message.id}.${extension}`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await MediaLibrary.saveToLibraryAsync(fileUri);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Guardada', 'La imagen se guardó en tu galería');
      handleClose();
    } catch (error) {
      console.error('Save to gallery error:', error);
      Alert.alert('Error', 'No se pudo guardar la imagen en la galería');
    }
  };

  const handleCopy = async () => {
    if (!message) return;
    const text = getCopyText(message);
    await Clipboard.setStringAsync(text);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    handleClose();
  };

  const handleTrash = async () => {
    if (!message) return;
    try {
      const existingAlarmId = getAlarmNotificationId(message);
      if (existingAlarmId) await cancelAlarm(existingAlarmId);
      if (listContext === 'chat') {
        await moveToTrash(message.id);
      } else {
        await database.moveToTrash(message.id);
      }
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Trash error:', error);
    }
    handleClose();
  };

  const handleRestoreTrash = async () => {
    if (!message) return;
    try {
      await database.restoreFromTrash(message.id);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Restore trash error:', error);
    }
    handleClose();
  };

  const handleDeletePermanent = () => {
    if (!message) return;
    Alert.alert(
      '¿Eliminar definitivamente?',
      'Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const existingAlarmId = getAlarmNotificationId(message);
            if (existingAlarmId) await cancelAlarm(existingAlarmId);
            if (listContext === 'chat') {
              await deleteMessage(message.id);
            } else {
              await database.deleteMessage(message.id);
            }
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            handleClose();
          },
        },
      ]
    );
  };

  const handleTogglePin = async () => {
    if (!message) return;
    await togglePin(message.id);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    handleClose();
  };

  const handleArchive = async () => {
    if (!message) return;
    try {
      const existingAlarmId = getAlarmNotificationId(message);
      if (existingAlarmId) await cancelAlarm(existingAlarmId);
      if (listContext === 'chat') {
        await moveToArchive(message.id);
      } else {
        await database.moveToArchive(message.id);
      }
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Archive error:', error);
    }
    handleClose();
  };

  const handleRestoreArchive = async () => {
    if (!message) return;
    try {
      if (listContext === 'chat') {
        await restoreFromArchive(message.id);
      } else {
        await database.restoreFromArchive(message.id);
      }
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Restore archive error:', error);
    }
    handleClose();
  };

  const handleSelectPreset = (presetId: string) => {
    if (presetId === 'custom') {
      setPendingPreset('custom');
      setCustomTime(getNextOccurrence(9, 0));
      if (Platform.OS === 'android') {
        setShowAndroidPicker(true);
      }
      setStep('alarm-custom-time');
      return;
    }
    setPendingPreset(presetId);
    setStep('alarm-sound');
  };

  const handleCustomTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowAndroidPicker(false);
      if (event.type === 'dismissed') {
        setStep('alarm-time');
        setPendingPreset(null);
        return;
      }
    }
    if (date) {
      const next = getNextOccurrence(date.getHours(), date.getMinutes());
      setCustomTime(next);
    }
  };

  const handleConfirmCustomTime = () => {
    setStep('alarm-sound');
  };

  const handleSelectSound = async (sound: AlarmSound) => {
    if (!message || !pendingPreset) return;

    const preview = getPreview(message);
    const customDate = pendingPreset === 'custom' ? customTime : undefined;
    const result = await scheduleAlarm(pendingPreset, preview, sound, customDate);

    if (result) {
      const existingMeta = parseMetadata(message.metadata);
      const newMeta = {
        ...existingMeta,
        alarm: {
          at: result.scheduledAt,
          sound,
          notificationId: result.notificationId,
        },
      };
      await updateMessage(message.id, { metadata: JSON.stringify(newMeta) });
      await setDefaultAlarmSound(sound);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      let presetLabel =
        ALARM_PRESETS.find((p) => p.id === pendingPreset)?.label || 'la hora indicada';
      if (pendingPreset === 'custom') {
        presetLabel = `a las ${formatTime24h(new Date(result.scheduledAt))}`;
      }
      Alert.alert('🔔 Alarma programada', `Te recordaremos ${presetLabel.toLowerCase()}`);
    }
    handleClose();
  };

  const hasAlarm = !!getAlarmNotificationId(message);
  const isTrashed = message?.is_trashed === 1 || listContext === 'trash';
  const isArchived = message?.is_archived === 1 || listContext === 'archived';
  const showChatActions = listContext === 'chat';

  if (!visible || !message) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: sheetBottomPadding },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: theme.divider }]} />

          {step === 'main' && (
            <>
              <Text style={[styles.title, { color: theme.text }]}>Acciones</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {getPreview(message)}
              </Text>

              <ScrollView
                style={styles.actionsScroll}
                bounces={false}
                showsVerticalScrollIndicator={false}
              >
              <View style={styles.actions}>
                <ActionRow
                  icon="copy-outline"
                  label="Copiar"
                  color={theme.primary}
                  theme={theme}
                  onPress={handleCopy}
                  testID="action-copy"
                />
                {message.type === 'image' && (
                  <ActionRow
                    icon="download-outline"
                    label="Guardar en galería"
                    subtitle="Exportar al carrete del teléfono"
                    color={theme.success}
                    theme={theme}
                    onPress={handleSaveToGallery}
                    testID="action-save-gallery"
                  />
                )}
                {isTrashed && (
                  <ActionRow
                    icon="arrow-undo-outline"
                    label="Restaurar de papelera"
                    subtitle="Volver al chat principal"
                    color={theme.success}
                    theme={theme}
                    onPress={handleRestoreTrash}
                    testID="action-restore-trash"
                  />
                )}
                {showChatActions && (
                  <>
                    <ActionRow
                      icon={message.is_pinned === 1 ? 'pin' : 'pin-outline'}
                      label={message.is_pinned === 1 ? 'Desfijar' : 'Fijar'}
                      color={theme.warning}
                      theme={theme}
                      onPress={handleTogglePin}
                      testID="action-pin"
                    />
                    <ActionRow
                      icon="alarm-outline"
                      label={hasAlarm ? 'Cambiar alarma' : 'Asignar alarma'}
                      subtitle={hasAlarm ? formatAlarm(message) : 'Recibí un recordatorio'}
                      color={theme.primary}
                      theme={theme}
                      onPress={() => setStep('alarm-time')}
                      testID="action-alarm"
                    />
                  </>
                )}
                {isArchived ? (
                  <ActionRow
                    icon="arrow-undo-outline"
                    label="Restaurar del archivo"
                    subtitle="Volver al chat principal"
                    color={theme.success}
                    theme={theme}
                    onPress={handleRestoreArchive}
                    testID="action-restore-archive"
                  />
                ) : (
                  !isTrashed && (
                    <ActionRow
                      icon="archive-outline"
                      label="Archivar"
                      subtitle="Ocultar del chat principal"
                      color="#7C3AED"
                      theme={theme}
                      onPress={handleArchive}
                      testID="action-archive"
                    />
                  )
                )}
                {!isTrashed && (
                  <ActionRow
                    icon="trash-outline"
                    label="Mover a papelera"
                    subtitle="Se puede recuperar"
                    color={theme.warning}
                    theme={theme}
                    onPress={handleTrash}
                    testID="action-trash"
                  />
                )}
                <ActionRow
                  icon="close-circle-outline"
                  label="Eliminar definitivamente"
                  subtitle="No se puede recuperar"
                  color={theme.danger}
                  theme={theme}
                  onPress={handleDeletePermanent}
                  testID="action-delete"
                />
              </View>
              </ScrollView>
            </>
          )}

          {step === 'alarm-time' && (
            <>
              <View style={styles.stepHeader}>
                <Pressable
                  onPress={() => setStep('main')}
                  style={styles.backIcon}
                  testID="alarm-back"
                >
                  <Ionicons name="chevron-back" size={22} color={theme.text} />
                </Pressable>
                <Text style={[styles.title, { color: theme.text }]}>
                  ¿Cuándo te recordamos?
                </Text>
              </View>

              <ScrollView style={styles.scroll}>
                {ALARM_PRESETS.map((preset) => (
                  <ActionRow
                    key={preset.id}
                    icon={preset.icon as keyof typeof Ionicons.glyphMap}
                    label={preset.label}
                    color={theme.primary}
                    theme={theme}
                    onPress={() => handleSelectPreset(preset.id)}
                    testID={`alarm-preset-${preset.id}`}
                  />
                ))}
              </ScrollView>
            </>
          )}

          {step === 'alarm-custom-time' && (
            <>
              <View style={styles.stepHeader}>
                <Pressable
                  onPress={() => {
                    setStep('alarm-time');
                    setPendingPreset(null);
                    setShowAndroidPicker(false);
                  }}
                  style={styles.backIcon}
                  testID="custom-time-back"
                >
                  <Ionicons name="chevron-back" size={22} color={theme.text} />
                </Pressable>
                <Text style={[styles.title, { color: theme.text }]}>
                  Elegir hora (24 h)
                </Text>
              </View>

              <Text style={[styles.hint, { color: theme.textTertiary }]}>
                La alarma sonará hoy o mañana a las {formatTime24h(customTime)}
              </Text>

              {(Platform.OS === 'ios' || showAndroidPicker) && (
                <DateTimePicker
                  value={customTime}
                  mode="time"
                  is24Hour
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleCustomTimeChange}
                  testID="alarm-time-picker"
                />
              )}

              {Platform.OS === 'android' && !showAndroidPicker && (
                <Pressable
                  onPress={() => setShowAndroidPicker(true)}
                  style={({ pressed }) => [
                    styles.timeButton,
                    { backgroundColor: theme.surfaceAlt },
                    pressed && { opacity: 0.8 },
                  ]}
                  testID="open-time-picker"
                >
                  <Ionicons name="time-outline" size={20} color={theme.primary} />
                  <Text style={[styles.timeButtonText, { color: theme.text }]}>
                    {formatTime24h(customTime)}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleConfirmCustomTime}
                style={({ pressed }) => [
                  styles.confirmButton,
                  { backgroundColor: theme.primary },
                  pressed && { opacity: 0.85 },
                ]}
                testID="confirm-custom-time"
              >
                <Text style={[styles.confirmButtonText, { color: theme.onPrimary }]}>
                  Continuar
                </Text>
              </Pressable>
            </>
          )}

          {step === 'alarm-sound' && (
            <>
              <View style={styles.stepHeader}>
                <Pressable
                  onPress={() =>
                    setStep(pendingPreset === 'custom' ? 'alarm-custom-time' : 'alarm-time')
                  }
                  style={styles.backIcon}
                  testID="sound-back"
                >
                  <Ionicons name="chevron-back" size={22} color={theme.text} />
                </Pressable>
                <Text style={[styles.title, { color: theme.text }]}>
                  Elegí el sonido
                </Text>
              </View>

              <Text style={[styles.hint, { color: theme.textTertiary }]}>
                Sonidos suaves y no irritantes
              </Text>

              <ScrollView style={styles.scroll}>
                {ALARM_SOUNDS.map((s) => {
                  const isDefault = defaultSound === s.id;
                  return (
                    <ActionRow
                      key={s.id}
                      icon={isDefault ? 'musical-note' : 'musical-note-outline'}
                      label={s.label}
                      subtitle={s.description + (isDefault ? ' · Predeterminado' : '')}
                      color={theme.primary}
                      theme={theme}
                      onPress={() => handleSelectSound(s.id)}
                      testID={`alarm-sound-${s.id}`}
                    />
                  );
                })}
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ===== Subcomponents =====

interface ActionRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  color: string;
  theme: ThemePalette;
  onPress: () => void;
  testID?: string;
}

function ActionRow({ icon, label, subtitle, color, theme, onPress, testID }: ActionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.surfaceAlt },
      ]}
      testID={testID}
    >
      <View style={[styles.iconBg, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        {subtitle && (
          <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
    </Pressable>
  );
}

// ===== Helpers =====

function getPreview(m: Message): string {
  if (m.type === 'text' || m.type === 'link') return m.content.slice(0, 60);
  if (m.type === 'image') return '🖼️ Imagen';
  if (m.type === 'voice') return '🎤 Audio de voz';
  if (m.type === 'file') return `📎 ${m.file_name || 'Archivo'}`;
  return 'Mensaje';
}

function getCopyText(m: Message): string {
  if (m.type === 'text' || m.type === 'link') return m.content;
  if (m.type === 'file') return m.file_name || 'Archivo';
  return getPreview(m);
}

function parseMetadata(metadata?: string): Record<string, unknown> {
  if (!metadata) return {};
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}

function getAlarmNotificationId(m: Message | null): string | null {
  if (!m) return null;
  const meta = parseMetadata(m.metadata);
  const alarm = meta.alarm as { notificationId?: string } | undefined;
  return alarm?.notificationId || null;
}

function formatAlarm(m: Message): string {
  const meta = parseMetadata(m.metadata);
  const alarm = meta.alarm as { at?: number } | undefined;
  if (!alarm?.at) return 'Programada';
  const d = new Date(alarm.at);
  return `📅 ${d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} · ${formatTime24h(d)}`;
}

// ===== Styles =====

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
    maxHeight: '80%',
  },
  actionsScroll: {
    maxHeight: 420,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    paddingHorizontal: 4,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  hint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  backIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: 2,
  },
  scroll: {
    maxHeight: 360,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
    borderRadius: 12,
  },
  iconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginVertical: 8,
  },
  timeButtonText: {
    fontSize: 22,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  confirmButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
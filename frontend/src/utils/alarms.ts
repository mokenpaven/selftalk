import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import { AlarmSound } from '../store/settingsStore';

const ALARM_CHANNEL_ID = 'selftalk-alarms';

export const ALARM_SOUND_FILES: Record<AlarmSound, string> = {
  bell: 'bell.wav',
  chime: 'chime.wav',
  marimba: 'marimba.wav',
  piano: 'piano.wav',
};

let notificationsConfigured = false;

function ensureNotificationsConfigured() {
  if (notificationsConfigured || Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  notificationsConfigured = true;
}

async function ensureAlarmChannel(sound: AlarmSound): Promise<string> {
  const channelId = `${ALARM_CHANNEL_ID}-${sound}`;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: 'Recordatorios SelfTalk',
      importance: Notifications.AndroidImportance.MAX,
      sound: ALARM_SOUND_FILES[sound],
      vibrationPattern: [0, 300, 200, 300],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  return channelId;
}

export async function setupNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  ensureNotificationsConfigured();

  if (Platform.OS === 'android') {
    await Promise.all(
      (Object.keys(ALARM_SOUND_FILES) as AlarmSound[]).map((sound) =>
        ensureAlarmChannel(sound)
      )
    );
  }
}

export const ALARM_PRESETS: Array<{
  id: string;
  label: string;
  minutes: number;
  icon: string;
}> = [
  { id: '5m', label: 'En 5 min', minutes: 5, icon: 'time-outline' },
  { id: '15m', label: 'En 15 min', minutes: 15, icon: 'time-outline' },
  { id: '1h', label: 'En 1 hora', minutes: 60, icon: 'time-outline' },
  { id: '3h', label: 'En 3 horas', minutes: 180, icon: 'time-outline' },
  { id: 'custom', label: 'Elegir hora', minutes: 0, icon: 'calendar-outline' },
];

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  try {
    await setupNotifications();
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Permission error:', error);
    return false;
  }
}

/** Next occurrence of hour:minute (today or tomorrow) in local time. */
export function getNextOccurrence(hours: number, minutes: number): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

export function formatTime24h(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Schedule a local notification for a message.
 * Returns the notification identifier and the scheduled timestamp, or null on failure.
 */
export async function scheduleAlarm(
  presetId: string,
  messagePreview: string,
  sound: AlarmSound,
  customDate?: Date
): Promise<{ notificationId: string; scheduledAt: number } | null> {
  if (Platform.OS === 'web') {
    Alert.alert(
      'No disponible en web',
      'Las alarmas solo funcionan en la app móvil instalada'
    );
    return null;
  }

  await setupNotifications();
  const granted = await ensureNotificationPermission();
  if (!granted) {
    Alert.alert(
      'Permiso requerido',
      'Activa las notificaciones para usar alarmas en tus mensajes'
    );
    return null;
  }

  let triggerDate: Date;
  if (presetId === 'custom') {
    if (!customDate || customDate.getTime() <= Date.now()) {
      Alert.alert('Hora inválida', 'Elige una hora futura para la alarma.');
      return null;
    }
    triggerDate = customDate;
  } else {
    const preset = ALARM_PRESETS.find((p) => p.id === presetId);
    if (!preset || preset.minutes === 0) return null;
    triggerDate = new Date(Date.now() + preset.minutes * 60 * 1000);
  }

  const soundFile = ALARM_SOUND_FILES[sound] ?? ALARM_SOUND_FILES.bell;
  const channelId =
    Platform.OS === 'android' ? await ensureAlarmChannel(sound) : undefined;

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Recordatorio de SelfTalk',
        body: messagePreview.slice(0, 140),
        sound: soundFile,
        data: { sound, type: 'message-alarm' },
        ...(channelId ? { channelId } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId,
      } as Notifications.NotificationTriggerInput,
    });
    return { notificationId, scheduledAt: triggerDate.getTime() };
  } catch (error) {
    console.error('Error scheduling notification:', error);
    Alert.alert('Error', 'No se pudo programar la alarma');
    return null;
  }
}

export async function cancelAlarm(notificationId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.warn('Error cancelling alarm:', error);
  }
}
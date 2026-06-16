import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Switch,
  ScrollView,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  useSettingsStore,
  AUTO_LOCK_OPTIONS,
  ALARM_SOUNDS,
  AutoLockOption,
  AlarmSound,
} from '../src/store/settingsStore';
import { useChatStore } from '../src/store/chatStore';
import { useTheme } from '../src/theme/useTheme';
import { ThemePalette, ThemeId } from '../src/theme/themes';
import { exportMessages, exportBackup, BACKUP_TYPE_OPTIONS, DEFAULT_BACKUP_TYPES } from '../src/utils/exportData';
import { runImportBackupFlow } from '../src/utils/importData';
import type { BackupMessageType } from '../src/utils/backupTypes';
import { database } from '../src/database/db';
import { ThemeSelector } from '../src/components/ThemeSelector';
import { StorageBar } from '../src/components/StorageBar';
import { APIKeyModal } from '../src/components/APIKeyModal';
import { PROVIDERS, AIProvider } from '../src/utils/aiProviders';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const {
    lockEnabled,
    useBiometric,
    hasPin,
    chatName,
    themeId,
    autoLock,
    email,
    defaultAlarmSound,
    aiApiKeys,
    aiActiveProvider,
    setLockEnabled,
    setUseBiometric,
    setPin,
    removePin,
    setChatName,
    setThemeId,
    setAutoLock,
    setEmail,
    setDefaultAlarmSound,
  } = useSettingsStore();

  const { messages, loadMessages } = useChatStore();

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');

  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState(chatName);

  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailInput, setEmailInput] = useState(email);
  const [emailError, setEmailError] = useState('');

  const [autoLockModalVisible, setAutoLockModalVisible] = useState(false);
  const [soundModalVisible, setSoundModalVisible] = useState(false);
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const [apiKeyInitialProvider, setApiKeyInitialProvider] = useState<AIProvider | null>(null);

  const [storageRefresh, setStorageRefresh] = useState(0);
  const [pendingLockEnable, setPendingLockEnable] = useState(false);
  const [backupExportModalVisible, setBackupExportModalVisible] = useState(false);
  const [backupImportModalVisible, setBackupImportModalVisible] = useState(false);
  const [selectedBackupTypes, setSelectedBackupTypes] = useState<BackupMessageType[]>(DEFAULT_BACKUP_TYPES);

  useEffect(() => {
    // Refresh storage when messages change
    setStorageRefresh((n) => n + 1);
  }, [messages.length]);

  const styles = createStyles(theme);

  const toggleBackupType = (type: BackupMessageType) => {
    setSelectedBackupTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  const handleConfirmExportBackup = async () => {
    setBackupExportModalVisible(false);
    await exportBackup(selectedBackupTypes, chatName);
  };

  const handleConfirmImportBackup = async () => {
    setBackupImportModalVisible(false);
    await runImportBackupFlow(selectedBackupTypes, {
      updateChatName: setChatName,
      onComplete: loadMessages,
    });
  };

  const openPinModal = (enableLockAfter = false) => {
    setPendingLockEnable(enableLockAfter);
    setPinModalVisible(true);
    setPinStep('enter');
    setPinInput('');
    setPinConfirm('');
    setPinError('');
  };

  const handleLockToggle = async (value: boolean) => {
    if (value && !hasPin) {
      openPinModal(true);
      return;
    }
    if (!value) {
      Alert.alert(
        'Desactivar bloqueo',
        '¿Seguro que quieres desactivar el bloqueo de la app?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Desactivar',
            style: 'destructive',
            onPress: async () => {
              await setLockEnabled(false);
              await setUseBiometric(false);
              await removePin();
            },
          },
        ]
      );
      return;
    }
    await setLockEnabled(value);
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value && !hasPin) {
      Alert.alert(
        'PIN requerido',
        'Configura un PIN de 4 dígitos antes de activar la biometría.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Configurar PIN', onPress: () => openPinModal(false) },
        ]
      );
      return;
    }
    if (value) {
      if (Platform.OS === 'web') {
        Alert.alert('No disponible', 'La biometría solo está disponible en dispositivos móviles');
        return;
      }
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware) {
        Alert.alert('No disponible', 'Tu dispositivo no soporta autenticación biométrica');
        return;
      }
      if (!isEnrolled) {
        Alert.alert(
          'Sin biometría configurada',
          'Configura una huella o Face ID en los ajustes de tu dispositivo'
        );
        return;
      }
    }
    await setUseBiometric(value);
  };

  const handlePinSubmit = async () => {
    setPinError('');
    if (pinStep === 'enter') {
      if (pinInput.length !== 4) {
        setPinError('El PIN debe tener 4 dígitos');
        return;
      }
      setPinStep('confirm');
      return;
    }
    if (pinConfirm !== pinInput) {
      setPinError('Los PIN no coinciden');
      setPinConfirm('');
      return;
    }
    try {
      const enableLockAfter = pendingLockEnable;
      await setPin(pinInput);
      if (enableLockAfter) {
        await setLockEnabled(true);
      }
      setPendingLockEnable(false);
      setPinModalVisible(false);
      setPinInput('');
      setPinConfirm('');
      setPinStep('enter');
      Alert.alert(
        'PIN configurado',
        enableLockAfter
          ? 'Tu PIN se guardó y el bloqueo quedó activado.'
          : 'Tu PIN se ha guardado correctamente.'
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo guardar el PIN';
      setPinError(msg);
    }
  };

  const handleChangePin = () => {
    openPinModal(false);
  };

  const handleNameSave = async () => {
    await setChatName(nameInput);
    setNameModalVisible(false);
  };

  const handleEmailSave = async () => {
    setEmailError('');
    const trimmed = emailInput.trim();
    if (!trimmed) {
      await setEmail('');
      setEmailModalVisible(false);
      return;
    }
    if (!isValidEmail(trimmed)) {
      setEmailError('Ingresa un correo electrónico válido');
      return;
    }
    await setEmail(trimmed);
    setEmailModalVisible(false);
  };

  const currentAutoLockLabel =
    AUTO_LOCK_OPTIONS.find((o) => o.id === autoLock)?.label || 'Al salir de la app';

  const currentSoundLabel =
    ALARM_SOUNDS.find((s) => s.id === defaultAlarmSound)?.label || 'Campana suave';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: theme.surfaceAlt },
              pressed && styles.pressed,
            ]}
            testID="settings-back-button"
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Configuración</Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Tema */}
          <Section title="APARIENCIA" theme={theme}>
            <Text style={[styles.sectionDesc, { color: theme.textSecondary }]}>
              Elegí el estilo visual de tu SelfTalk
            </Text>
            <ThemeSelector
              theme={theme}
              currentThemeId={themeId}
              onSelect={(id: ThemeId) => setThemeId(id)}
            />
          </Section>

          {/* Almacenamiento */}
          <Section title="ALMACENAMIENTO" theme={theme}>
            <View style={{ paddingHorizontal: 16 }}>
              <StorageBar theme={theme} refreshTrigger={storageRefresh} />
            </View>
          </Section>

          {/* Personalización */}
          <Section title="PERSONALIZACIÓN" theme={theme}>
            <Card theme={theme}>
              <SettingRow
                icon="person-circle-outline"
                iconColor={theme.primary}
                title="Nombre del chat"
                subtitle={chatName}
                onPress={() => {
                  setNameInput(chatName);
                  setNameModalVisible(true);
                }}
                theme={theme}
                testID="setting-chat-name"
              />
              <SettingRow
                icon="mail-outline"
                iconColor={theme.success}
                title="Mi correo"
                subtitle={email || 'Sin configurar'}
                onPress={() => {
                  setEmailInput(email);
                  setEmailError('');
                  setEmailModalVisible(true);
                }}
                theme={theme}
                testID="setting-email"
              />
            </Card>
          </Section>

          {/* Seguridad */}
          <Section title="SEGURIDAD" theme={theme}>
            <Card theme={theme}>
              <SettingRow
                icon="key-outline"
                iconColor={theme.primary}
                title={hasPin ? 'Cambiar PIN' : 'Configurar PIN'}
                subtitle={hasPin ? 'Modificar tu PIN de 4 dígitos' : 'Obligatorio para bloquear la app'}
                onPress={handleChangePin}
                theme={theme}
                testID="change-pin"
              />
              <SettingRow
                icon="finger-print-outline"
                iconColor={theme.primary}
                title="Desbloquear con biometría"
                subtitle={
                  hasPin
                    ? 'Huella, rostro o lo configurado en tu dispositivo'
                    : 'Configura un PIN primero'
                }
                theme={theme}
                right={
                  <Switch
                    value={useBiometric}
                    onValueChange={handleBiometricToggle}
                    disabled={!hasPin}
                    trackColor={{ false: theme.divider, true: theme.primarySoft }}
                    thumbColor={useBiometric ? theme.primary : theme.surface}
                    testID="biometric-toggle"
                  />
                }
              />
              <SettingRow
                icon="lock-closed-outline"
                iconColor={theme.primary}
                title="Bloquear la app"
                subtitle={hasPin ? 'Requiere PIN al abrir' : 'Configura un PIN para activar'}
                theme={theme}
                right={
                  <Switch
                    value={lockEnabled}
                    onValueChange={handleLockToggle}
                    disabled={!hasPin}
                    trackColor={{ false: theme.divider, true: theme.primarySoft }}
                    thumbColor={lockEnabled ? theme.primary : theme.surface}
                    testID="lock-toggle"
                  />
                }
              />
              {lockEnabled && (
                <SettingRow
                  icon="time-outline"
                  iconColor={theme.warning}
                  title="Bloqueo automático"
                  subtitle={currentAutoLockLabel}
                  onPress={() => setAutoLockModalVisible(true)}
                  theme={theme}
                  testID="auto-lock"
                />
              )}
            </Card>
          </Section>

          {/* IA - Asistente */}
          <Section title="ASISTENTE DE IA" theme={theme}>
            <Card theme={theme}>
              {(Object.keys(PROVIDERS) as AIProvider[]).map((pid, idx) => {
                const p = PROVIDERS[pid];
                const isConfigured = !!aiApiKeys[pid];
                const isActive = aiActiveProvider === pid;
                return (
                  <SettingRow
                    key={pid}
                    icon={p.icon as any}
                    iconColor={p.color}
                    title={p.name}
                    subtitle={
                      isConfigured
                        ? isActive
                          ? '✓ Configurado · Activo'
                          : '✓ Configurado'
                        : 'Sin configurar'
                    }
                    onPress={() => {
                      setApiKeyInitialProvider(pid);
                      setApiKeyModalVisible(true);
                    }}
                    theme={theme}
                    testID={`setting-ai-${pid}`}
                  />
                );
              })}
            </Card>
          </Section>

          {/* Recordatorios */}
          <Section title="RECORDATORIOS" theme={theme}>
            <Card theme={theme}>
              <SettingRow
                icon="musical-note-outline"
                iconColor={theme.primary}
                title="Sonido predeterminado"
                subtitle={currentSoundLabel}
                onPress={() => setSoundModalVisible(true)}
                theme={theme}
                testID="default-sound"
              />
            </Card>
          </Section>

          {/* Backup */}
          <Section title="BACKUP Y EXPORTACIÓN" theme={theme}>
            <Card theme={theme}>
              <SettingRow
                icon="cloud-upload-outline"
                iconColor={theme.primary}
                title="Exportar backup"
                subtitle="JSON con texto, imágenes, voz y archivos"
                onPress={() => {
                  setSelectedBackupTypes(DEFAULT_BACKUP_TYPES);
                  setBackupExportModalVisible(true);
                }}
                theme={theme}
                testID="export-backup"
              />
              <SettingRow
                icon="cloud-download-outline"
                iconColor={theme.success}
                title="Importar conversación"
                subtitle="Desde Drive, Dropbox o almacenamiento local"
                onPress={() => {
                  setSelectedBackupTypes(DEFAULT_BACKUP_TYPES);
                  setBackupImportModalVisible(true);
                }}
                theme={theme}
                testID="import-backup"
              />
              <SettingRow
                icon="document-text-outline"
                iconColor={theme.warning}
                title="Exportar como Markdown"
                subtitle="Solo lectura humana (sin importación)"
                onPress={() => exportMessages('markdown', chatName)}
                theme={theme}
                testID="export-markdown"
              />
            </Card>
          </Section>

          {/* Zona peligrosa */}
          <Section title="ZONA PELIGROSA" theme={theme}>
            <Card theme={theme}>
              <SettingRow
                icon="trash-outline"
                iconColor={theme.danger}
                title="Eliminar todos los mensajes"
                subtitle="Esta acción no se puede deshacer"
                onPress={() => handleClearAll(loadMessages)}
                theme={theme}
                titleColor={theme.danger}
                testID="clear-all"
              />
            </Card>
          </Section>

          {/* About */}
          <View style={styles.aboutSection}>
            <Text style={[styles.aboutAppName, { color: theme.primary }]}>SelfTalk</Text>
            <Text style={[styles.aboutVersion, { color: theme.textTertiary }]}>Versión 1.0.0</Text>
            <Text style={[styles.aboutTagline, { color: theme.textTertiary }]}>
              Tus notas son tuyas.{'\n'}No analizamos ni almacenamos tus datos.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* PIN Modal */}
      <CenterModal
        visible={pinModalVisible}
        onClose={() => {
          setPinModalVisible(false);
          setPendingLockEnable(false);
        }}
        theme={theme}
      >
        <Text style={[styles.modalTitle, { color: theme.text }]}>
          {pinStep === 'enter' ? 'Crea tu PIN' : 'Confirma tu PIN'}
        </Text>
        <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
          {pinStep === 'enter' ? 'Ingresa un PIN de 4 dígitos' : 'Vuelve a ingresar tu PIN'}
        </Text>
        <TextInput
          style={[styles.pinInput, { backgroundColor: theme.inputBg, color: theme.text }]}
          value={pinStep === 'enter' ? pinInput : pinConfirm}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, '');
            if (pinStep === 'enter') setPinInput(digits);
            else setPinConfirm(digits);
            setPinError('');
          }}
          keyboardType="number-pad"
          maxLength={4}
          autoFocus
          secureTextEntry
          placeholder="••••"
          placeholderTextColor={theme.placeholder}
          testID="pin-input-modal"
        />
        {pinError ? <Text style={[styles.errorText, { color: theme.danger }]}>{pinError}</Text> : null}
        <ModalButtons
          onCancel={() => {
            setPinModalVisible(false);
            setPinInput('');
            setPinConfirm('');
            setPinStep('enter');
            setPinError('');
          }}
          onConfirm={handlePinSubmit}
          confirmLabel={pinStep === 'enter' ? 'Continuar' : 'Guardar'}
          theme={theme}
          testID="pin-submit"
        />
      </CenterModal>

      {/* Name Modal */}
      <CenterModal visible={nameModalVisible} onClose={() => setNameModalVisible(false)} theme={theme}>
        <Text style={[styles.modalTitle, { color: theme.text }]}>Nombre del chat</Text>
        <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
          Cómo te referís a vos mismo
        </Text>
        <TextInput
          style={[styles.fullInput, { backgroundColor: theme.inputBg, color: theme.text }]}
          value={nameInput}
          onChangeText={setNameInput}
          maxLength={30}
          autoFocus
          placeholder="Yo"
          placeholderTextColor={theme.placeholder}
          testID="name-input"
        />
        <ModalButtons
          onCancel={() => setNameModalVisible(false)}
          onConfirm={handleNameSave}
          confirmLabel="Guardar"
          theme={theme}
          testID="name-save"
        />
      </CenterModal>

      {/* Email Modal */}
      <CenterModal visible={emailModalVisible} onClose={() => setEmailModalVisible(false)} theme={theme}>
        <Text style={[styles.modalTitle, { color: theme.text }]}>Mi correo</Text>
        <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
          Lo usaremos para enviarte tus backups
        </Text>
        <TextInput
          style={[styles.fullInput, { backgroundColor: theme.inputBg, color: theme.text }]}
          value={emailInput}
          onChangeText={(v) => {
            setEmailInput(v);
            setEmailError('');
          }}
          autoFocus
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="tucorreo@ejemplo.com"
          placeholderTextColor={theme.placeholder}
          testID="email-input"
        />
        {emailError ? <Text style={[styles.errorText, { color: theme.danger }]}>{emailError}</Text> : null}
        <ModalButtons
          onCancel={() => setEmailModalVisible(false)}
          onConfirm={handleEmailSave}
          confirmLabel="Guardar"
          theme={theme}
          testID="email-save"
        />
      </CenterModal>

      {/* Auto-lock options */}
      <CenterModal visible={autoLockModalVisible} onClose={() => setAutoLockModalVisible(false)} theme={theme} wide>
        <Text style={[styles.modalTitle, { color: theme.text }]}>Bloqueo automático</Text>
        <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
          ¿Cuándo se debe bloquear la app?
        </Text>
        <View style={{ width: '100%', marginTop: 8 }}>
          {AUTO_LOCK_OPTIONS.map((opt) => {
            const isActive = autoLock === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={async () => {
                  await setAutoLock(opt.id as AutoLockOption);
                  setAutoLockModalVisible(false);
                }}
                style={({ pressed }) => [
                  styles.optionRow,
                  { borderColor: isActive ? theme.primary : theme.border },
                  pressed && { backgroundColor: theme.surfaceAlt },
                ]}
                testID={`autolock-${opt.id}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>{opt.label}</Text>
                  <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>{opt.description}</Text>
                </View>
                {isActive && (
                  <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                )}
              </Pressable>
            );
          })}
        </View>
      </CenterModal>

      {/* Sound options */}
      <CenterModal visible={soundModalVisible} onClose={() => setSoundModalVisible(false)} theme={theme} wide>
        <Text style={[styles.modalTitle, { color: theme.text }]}>Sonido de alarma</Text>
        <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
          Sonidos suaves para tus recordatorios
        </Text>
        <View style={{ width: '100%', marginTop: 8 }}>
          {ALARM_SOUNDS.map((s) => {
            const isActive = defaultAlarmSound === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={async () => {
                  await setDefaultAlarmSound(s.id as AlarmSound);
                  setSoundModalVisible(false);
                }}
                style={({ pressed }) => [
                  styles.optionRow,
                  { borderColor: isActive ? theme.primary : theme.border },
                  pressed && { backgroundColor: theme.surfaceAlt },
                ]}
                testID={`sound-${s.id}`}
              >
                <View
                  style={[
                    styles.soundIconWrap,
                    { backgroundColor: `${theme.primary}22` },
                  ]}
                >
                  <Ionicons name="musical-note" size={18} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>{s.label}</Text>
                  <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>{s.description}</Text>
                </View>
                {isActive && (
                  <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                )}
              </Pressable>
            );
          })}
        </View>
      </CenterModal>

      {/* API Key Modal (interconectado con pestaña IA) */}
      <APIKeyModal
        visible={apiKeyModalVisible}
        onClose={() => setApiKeyModalVisible(false)}
        theme={theme}
        initialProvider={apiKeyInitialProvider}
      />

      <BackupTypeModal
        visible={backupExportModalVisible}
        onClose={() => setBackupExportModalVisible(false)}
        title="Exportar backup"
        subtitle="Elegí qué tipos de mensajes incluir"
        selectedTypes={selectedBackupTypes}
        onToggleType={toggleBackupType}
        onConfirm={handleConfirmExportBackup}
        confirmLabel="Exportar"
        theme={theme}
      />

      <BackupTypeModal
        visible={backupImportModalVisible}
        onClose={() => setBackupImportModalVisible(false)}
        title="Importar conversación"
        subtitle="Elegí qué tipos importar del archivo"
        selectedTypes={selectedBackupTypes}
        onToggleType={toggleBackupType}
        onConfirm={handleConfirmImportBackup}
        confirmLabel="Seleccionar archivo"
        theme={theme}
      />
    </View>
  );
}

// ===== Helpers =====

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function handleClearAll(loadMessages: () => Promise<void>) {
  Alert.alert(
    'Eliminar todo',
    '¿Estás seguro? Esta acción no se puede deshacer. Te recomendamos hacer un backup antes.',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar todo',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Confirmación final',
            'Se eliminarán TODOS tus mensajes permanentemente',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Sí, eliminar',
                style: 'destructive',
                onPress: async () => {
                  await database.clearAllMessages();
                  await loadMessages();
                  Alert.alert('Listo', 'Todos los mensajes fueron eliminados');
                },
              },
            ]
          );
        },
      },
    ]
  );
}

// ===== Subcomponents =====

function Section({
  title,
  theme,
  children,
}: {
  title: string;
  theme: ThemePalette;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: theme.textTertiary,
          letterSpacing: 0.8,
          paddingHorizontal: 20,
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Card({ theme, children }: { theme: ThemePalette; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        marginHorizontal: 16,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  theme: ThemePalette;
  titleColor?: string;
  testID?: string;
}

const SETTING_ROW_RIGHT_WIDTH = 52;

const settingRowBaseStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  paddingHorizontal: 14,
  paddingVertical: 12,
  gap: 12,
  borderBottomWidth: StyleSheet.hairlineWidth,
};

function SettingRow({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  right,
  theme,
  titleColor,
  testID,
}: SettingRowProps) {
  const rowStyle = [settingRowBaseStyle, { borderBottomColor: theme.border }];
  const trailing = right ?? (
    onPress ? <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} /> : null
  );

  const content = (
    <>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${iconColor}1A`,
        }}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: titleColor || theme.text }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      <View
        style={{
          width: SETTING_ROW_RIGHT_WIDTH,
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        {trailing}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [rowStyle, pressed && { backgroundColor: theme.surfaceAlt }]}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={rowStyle} testID={testID}>
      {content}
    </View>
  );
}

function BackupTypeModal({
  visible,
  onClose,
  title,
  subtitle,
  selectedTypes,
  onToggleType,
  onConfirm,
  confirmLabel,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  selectedTypes: BackupMessageType[];
  onToggleType: (type: BackupMessageType) => void;
  onConfirm: () => void;
  confirmLabel: string;
  theme: ThemePalette;
}) {
  return (
    <CenterModal visible={visible} onClose={onClose} theme={theme} wide>
      <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, alignSelf: 'flex-start' }}>
        {title}
      </Text>
      <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4, marginBottom: 12, alignSelf: 'flex-start' }}>
        {subtitle}
      </Text>
      <View style={{ width: '100%', marginBottom: 16 }}>
        {BACKUP_TYPE_OPTIONS.map((opt) => {
          const checked = selectedTypes.includes(opt.id);
          return (
            <Pressable
              key={opt.id}
              onPress={() => onToggleType(opt.id)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 4,
                  gap: 12,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
                pressed && { backgroundColor: theme.surfaceAlt },
              ]}
            >
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={22}
                color={checked ? theme.primary : theme.textTertiary}
              />
              <Text style={{ fontSize: 15, color: theme.text, flex: 1 }}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ModalButtons
        onCancel={onClose}
        onConfirm={onConfirm}
        confirmLabel={confirmLabel}
        theme={theme}
      />
    </CenterModal>
  );
}

function CenterModal({
  visible,
  onClose,
  theme,
  children,
  wide,
}: {
  visible: boolean;
  onClose: () => void;
  theme: ThemePalette;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View
          style={{
            width: '100%',
            maxWidth: wide ? 420 : 360,
            backgroundColor: theme.surface,
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            maxHeight: '85%',
          }}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

function ModalButtons({
  onCancel,
  onConfirm,
  confirmLabel,
  theme,
  testID,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  theme: ThemePalette;
  testID?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' }}>
      <Pressable
        onPress={onCancel}
        style={({ pressed }) => [
          {
            flex: 1,
            height: 46,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.surfaceAlt,
          },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textSecondary }}>Cancelar</Text>
      </Pressable>
      <Pressable
        onPress={onConfirm}
        style={({ pressed }) => [
          {
            flex: 1,
            height: 46,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.primary,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 4,
          },
          pressed && { opacity: 0.7 },
        ]}
        testID={testID}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.onPrimary }}>{confirmLabel}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: ThemePalette) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 12,
      borderBottomWidth: 1,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    pressed: {
      opacity: 0.7,
      transform: [{ scale: 0.97 }],
    },
    sectionDesc: {
      fontSize: 12,
      paddingHorizontal: 20,
      marginBottom: 4,
      fontStyle: 'italic',
    },
    modalTitle: {
      fontSize: 19,
      fontWeight: '700',
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    modalSubtitle: {
      fontSize: 14,
      marginBottom: 16,
      textAlign: 'center',
    },
    pinInput: {
      width: 180,
      height: 60,
      fontSize: 28,
      textAlign: 'center',
      letterSpacing: 16,
      borderRadius: 12,
      fontWeight: '600',
      marginBottom: 8,
    },
    fullInput: {
      width: '100%',
      height: 48,
      fontSize: 16,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginBottom: 8,
    },
    errorText: {
      fontSize: 13,
      fontWeight: '500',
      marginTop: 4,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      marginBottom: 6,
      gap: 12,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: '600',
    },
    optionDesc: {
      fontSize: 12,
      marginTop: 2,
    },
    soundIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aboutSection: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: 32,
    },
    aboutAppName: {
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    aboutVersion: {
      fontSize: 12,
      marginTop: 4,
    },
    aboutTagline: {
      fontSize: 12,
      textAlign: 'center',
      marginTop: 12,
      lineHeight: 18,
      fontStyle: 'italic',
    },
  });
}

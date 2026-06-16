import { create } from 'zustand';
import { storage } from '@/src/utils/storage';
import { ThemeId } from '../theme/themes';
import { AIProvider, PROVIDERS } from '../utils/aiProviders';
import { savePin, loadPin, clearPin, verifyPinInput } from '../utils/pinStorage';

const LOCK_ENABLED_KEY = '@selftalk_lock_enabled';
const USE_BIOMETRIC_KEY = '@selftalk_use_biometric';
const CHAT_NAME_KEY = '@selftalk_chat_name';
const THEME_KEY = '@selftalk_theme';
const AUTO_LOCK_KEY = '@selftalk_auto_lock';
const EMAIL_KEY = '@selftalk_email';
const ALARM_SOUND_KEY = '@selftalk_alarm_sound';
const AI_KEYS_PREFIX = '@selftalk_ai_key_'; // secure store, per provider
const AI_PROVIDER_KEY = '@selftalk_ai_provider';
const AI_MODEL_KEY = '@selftalk_ai_model';

// Auto-lock options: 'background' = lock when app goes to background
// 'manual' = only manual lock from header button
// number = minutes of inactivity since last background
export type AutoLockOption = 'manual' | 'background' | '5' | '15' | '30';

export type AlarmSound = 'bell' | 'chime' | 'marimba' | 'piano';

export const AUTO_LOCK_OPTIONS: Array<{ id: AutoLockOption; label: string; description: string }> = [
  { id: 'manual', label: 'Solo manualmente', description: 'Solo al tocar el candado' },
  { id: 'background', label: 'Al salir de la app', description: 'Inmediato al cambiar de app' },
  { id: '5', label: '5 minutos', description: 'Tras 5 min fuera de la app' },
  { id: '15', label: '15 minutos', description: 'Tras 15 min fuera de la app' },
  { id: '30', label: '30 minutos', description: 'Tras 30 min fuera de la app' },
];

export const ALARM_SOUNDS: Array<{ id: AlarmSound; label: string; description: string }> = [
  { id: 'bell', label: 'Campana suave', description: 'Tono cálido y delicado' },
  { id: 'chime', label: 'Carillón', description: 'Repique armónico' },
  { id: 'marimba', label: 'Marimba', description: 'Notas de madera' },
  { id: 'piano', label: 'Piano', description: 'Acorde suave de piano' },
];

interface SettingsState {
  lockEnabled: boolean;
  useBiometric: boolean;
  hasPin: boolean;
  chatName: string;
  themeId: ThemeId;
  autoLock: AutoLockOption;
  email: string;
  defaultAlarmSound: AlarmSound;
  aiApiKeys: Partial<Record<AIProvider, string>>;
  aiActiveProvider: AIProvider | null;
  aiActiveModel: string | null;
  isUnlocked: boolean;
  lastBackgroundedAt: number | null;
  isLoaded: boolean;

  loadSettings: () => Promise<void>;
  setLockEnabled: (enabled: boolean) => Promise<void>;
  setUseBiometric: (enabled: boolean) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  setChatName: (name: string) => Promise<void>;
  setThemeId: (themeId: ThemeId) => Promise<void>;
  setAutoLock: (option: AutoLockOption) => Promise<void>;
  setEmail: (email: string) => Promise<void>;
  setDefaultAlarmSound: (sound: AlarmSound) => Promise<void>;
  setAIApiKey: (provider: AIProvider, key: string) => Promise<void>;
  removeAIApiKey: (provider: AIProvider) => Promise<void>;
  setAIActiveProvider: (provider: AIProvider | null) => Promise<void>;
  setAIActiveModel: (model: string | null) => Promise<void>;
  unlock: () => void;
  lock: () => void;
  markBackgrounded: () => void;
  checkAutoLockOnResume: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  lockEnabled: false,
  useBiometric: false,
  hasPin: false,
  chatName: 'Yo',
  themeId: 'auto',
  autoLock: 'background',
  email: '',
  defaultAlarmSound: 'bell',
  aiApiKeys: {},
  aiActiveProvider: null,
  aiActiveModel: null,
  isUnlocked: false,
  lastBackgroundedAt: null,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const lockEnabled = await storage.getItem<boolean>(LOCK_ENABLED_KEY, false);
      const useBiometric = await storage.getItem<boolean>(USE_BIOMETRIC_KEY, false);
      const pin = await loadPin();
      const chatName = await storage.getItem<string>(CHAT_NAME_KEY, 'Yo');
      const themeId = await storage.getItem<string>(THEME_KEY, 'auto');
      const autoLock = await storage.getItem<string>(AUTO_LOCK_KEY, 'background');
      const email = await storage.getItem<string>(EMAIL_KEY, '');
      const alarmSound = await storage.getItem<string>(ALARM_SOUND_KEY, 'bell');
      const aiProvider = await storage.getItem<string>(AI_PROVIDER_KEY, '');
      const aiModel = await storage.getItem<string>(AI_MODEL_KEY, '');

      // Load all AI API keys from secure storage
      const aiApiKeys: Partial<Record<AIProvider, string>> = {};
      for (const providerId of Object.keys(PROVIDERS) as AIProvider[]) {
        const key = await storage.secureGet<string>(`${AI_KEYS_PREFIX}${providerId}`, '');
        if (key) aiApiKeys[providerId] = key;
      }

      const lockOn = lockEnabled === true;

      set({
        lockEnabled: lockOn,
        useBiometric: useBiometric === true,
        hasPin: !!pin && pin.length > 0,
        chatName: chatName || 'Yo',
        themeId: (themeId as ThemeId) || 'auto',
        autoLock: (autoLock as AutoLockOption) || 'background',
        email: email || '',
        defaultAlarmSound: (alarmSound as AlarmSound) || 'bell',
        aiApiKeys,
        aiActiveProvider: (aiProvider as AIProvider) || null,
        aiActiveModel: aiModel || null,
        isUnlocked: !lockOn,
        isLoaded: true,
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      set({ isLoaded: true, isUnlocked: true });
    }
  },

  setLockEnabled: async (enabled) => {
    await storage.setItem(LOCK_ENABLED_KEY, enabled);
    set({ lockEnabled: enabled, isUnlocked: !enabled ? true : get().isUnlocked });
  },

  setUseBiometric: async (enabled) => {
    await storage.setItem(USE_BIOMETRIC_KEY, enabled);
    set({ useBiometric: enabled });
  },

  setPin: async (pin) => {
    await savePin(pin);
    set({ hasPin: true });
  },

  removePin: async () => {
    await clearPin();
    set({ hasPin: false });
  },

  verifyPin: async (pin) => {
    const stored = await loadPin();
    return verifyPinInput(pin, stored);
  },

  setChatName: async (name) => {
    const trimmed = name.trim() || 'Yo';
    await storage.setItem(CHAT_NAME_KEY, trimmed);
    set({ chatName: trimmed });
  },

  setThemeId: async (themeId) => {
    await storage.setItem(THEME_KEY, themeId);
    set({ themeId });
  },

  setAutoLock: async (option) => {
    await storage.setItem(AUTO_LOCK_KEY, option);
    set({ autoLock: option });
  },

  setEmail: async (email) => {
    await storage.setItem(EMAIL_KEY, email);
    set({ email });
  },

  setDefaultAlarmSound: async (sound) => {
    await storage.setItem(ALARM_SOUND_KEY, sound);
    set({ defaultAlarmSound: sound });
  },

  setAIApiKey: async (provider, key) => {
    const trimmed = key.trim();
    await storage.secureSet(`${AI_KEYS_PREFIX}${provider}`, trimmed);
    set((state) => ({
      aiApiKeys: { ...state.aiApiKeys, [provider]: trimmed },
      // Auto-select this provider if none active yet
      aiActiveProvider: state.aiActiveProvider || provider,
      aiActiveModel: state.aiActiveModel || PROVIDERS[provider].models[0].id,
    }));
    // Persist the auto-selected provider/model
    const newState = get();
    if (newState.aiActiveProvider === provider) {
      await storage.setItem(AI_PROVIDER_KEY, provider);
      if (newState.aiActiveModel) {
        await storage.setItem(AI_MODEL_KEY, newState.aiActiveModel);
      }
    }
  },

  removeAIApiKey: async (provider) => {
    await storage.secureRemove(`${AI_KEYS_PREFIX}${provider}`);
    set((state) => {
      const next = { ...state.aiApiKeys };
      delete next[provider];
      const newActive =
        state.aiActiveProvider === provider ? null : state.aiActiveProvider;
      const newModel = newActive === null ? null : state.aiActiveModel;
      return {
        aiApiKeys: next,
        aiActiveProvider: newActive,
        aiActiveModel: newModel,
      };
    });
    if (get().aiActiveProvider === null) {
      await storage.setItem(AI_PROVIDER_KEY, '');
      await storage.setItem(AI_MODEL_KEY, '');
    }
  },

  setAIActiveProvider: async (provider) => {
    await storage.setItem(AI_PROVIDER_KEY, provider || '');
    set({ aiActiveProvider: provider });
    if (provider) {
      // Set default model for new provider
      const defaultModel = PROVIDERS[provider].models[0].id;
      await storage.setItem(AI_MODEL_KEY, defaultModel);
      set({ aiActiveModel: defaultModel });
    } else {
      await storage.setItem(AI_MODEL_KEY, '');
      set({ aiActiveModel: null });
    }
  },

  setAIActiveModel: async (model) => {
    await storage.setItem(AI_MODEL_KEY, model || '');
    set({ aiActiveModel: model });
  },

  unlock: () => set({ isUnlocked: true, lastBackgroundedAt: null }),
  lock: () => set({ isUnlocked: false }),

  markBackgrounded: () => {
    const { lockEnabled, autoLock, isUnlocked } = get();
    const updates: Partial<SettingsState> = { lastBackgroundedAt: Date.now() };
    if (lockEnabled && isUnlocked && autoLock === 'background') {
      updates.isUnlocked = false;
    }
    set(updates);
  },

  checkAutoLockOnResume: () => {
    const { lockEnabled, autoLock, lastBackgroundedAt, isUnlocked } = get();

    if (!lockEnabled || !isUnlocked) return;
    if (autoLock === 'manual') return;

    if (autoLock === 'background') {
      // Always lock when coming back from background
      if (lastBackgroundedAt !== null) {
        set({ isUnlocked: false });
      }
      return;
    }

    // Numeric: minutes of inactivity
    const minutes = parseInt(autoLock, 10);
    if (!isNaN(minutes) && lastBackgroundedAt !== null) {
      const elapsedMin = (Date.now() - lastBackgroundedAt) / (1000 * 60);
      if (elapsedMin >= minutes) {
        set({ isUnlocked: false });
      }
    }
  },
}));

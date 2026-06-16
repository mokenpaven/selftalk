import * as SecureStore from 'expo-secure-store';
import { storage } from '@/src/utils/storage';

const PIN_SECURE_KEY = '@selftalk_pin';
const PIN_FALLBACK_KEY = '@selftalk_pin_backup';

export async function savePin(pin: string): Promise<void> {
  const normalized = pin.replace(/\D/g, '').slice(0, 4);
  if (normalized.length !== 4) {
    throw new Error('El PIN debe tener 4 dígitos');
  }

  let secureSaved = false;
  try {
    await SecureStore.setItemAsync(PIN_SECURE_KEY, normalized, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
    secureSaved = true;
  } catch (error) {
    console.warn('SecureStore PIN save failed, using fallback:', error);
  }

  const fallbackSaved = await storage.setItem(PIN_FALLBACK_KEY, normalized);
  if (!secureSaved && !fallbackSaved) {
    throw new Error('No se pudo guardar el PIN. Reinicia la app e intenta de nuevo.');
  }
}

export async function loadPin(): Promise<string> {
  try {
    const secure = await SecureStore.getItemAsync(PIN_SECURE_KEY);
    if (secure && /^\d{4}$/.test(secure)) return secure;
  } catch (error) {
    console.warn('SecureStore PIN read failed:', error);
  }

  const raw = await storage.secureGetRaw(PIN_SECURE_KEY, '');
  if (raw && /^\d{4}$/.test(raw)) return raw;

  const fallback = await storage.getItem<string>(PIN_FALLBACK_KEY, '');
  return fallback && /^\d{4}$/.test(fallback) ? fallback : '';
}

export async function clearPin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PIN_SECURE_KEY);
  } catch {
    // ignore
  }
  await storage.secureRemove(PIN_SECURE_KEY);
  await storage.removeItem(PIN_FALLBACK_KEY);
}

export function verifyPinInput(entered: string, stored: string): boolean {
  const normalized = entered.replace(/\D/g, '').slice(0, 4);
  return normalized.length === 4 && stored.length === 4 && normalized === stored;
}
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { View, AppState, AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { useSettingsStore } from "@/src/store/settingsStore";
import { LockScreen } from "@/src/components/LockScreen";
import { database } from "@/src/database/db";
import { setupNotifications } from "@/src/utils/alarms";

SplashScreen.preventAutoHideAsync().catch((err) => {
  console.warn('SplashScreen.preventAutoHideAsync failed:', err);
});

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const {
    isLoaded,
    lockEnabled,
    isUnlocked,
    loadSettings,
    markBackgrounded,
    checkAutoLockOnResume,
  } = useSettingsStore();
  const lastStateRef = useRef<AppStateStatus>('active');

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    database.init().catch((err) => {
      console.error('Global database init failed:', err);
    });
    setupNotifications().catch((err) => {
      console.warn('Notification setup failed:', err);
    });
  }, []);

  const showLock = lockEnabled && !isUnlocked;
  const appReady = (loaded || error) && isLoaded;

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync().catch((err) => {
        console.warn('SplashScreen.hideAsync failed:', err);
      });
    }
  }, [appReady]);

  // Listen for app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prevState = lastStateRef.current;

      if (nextState === 'background' || nextState === 'inactive') {
        // Going to background: mark timestamp
        if (prevState === 'active') {
          markBackgrounded();
        }
      } else if (nextState === 'active') {
        // Coming back: check if we should lock based on autoLock setting
        if (prevState !== 'active') {
          checkAutoLockOnResume();
        }
      }

      lastStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [markBackgrounded, checkAutoLockOnResume]);

  if (!appReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <View style={{ flex: 1 }}>
          {showLock ? (
            <LockScreen />
          ) : (
            <Stack screenOptions={{ headerShown: false }} />
          )}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

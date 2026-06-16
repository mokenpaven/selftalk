import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { database, getDatabaseErrorMessage } from '../database/db';
import { ThemePalette } from '../theme/themes';

interface StorageBarProps {
  theme: ThemePalette;
  refreshTrigger?: number;
}

interface StorageInfo {
  appBytes: number;
  freeBytes: number;
  totalBytes: number;
  messageCount: number;
}

const ONE_GB = 1024 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < ONE_GB) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / ONE_GB).toFixed(2)} GB`;
}

export function StorageBar({ theme, refreshTrigger }: StorageBarProps) {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // App data size
        const stats = await database.getStorageStats();

        // Device free space
        let freeBytes = 0;
        let totalBytes = 0;
        if (Platform.OS !== 'web') {
          try {
            freeBytes = await FileSystem.getFreeDiskStorageAsync();
            totalBytes = await FileSystem.getTotalDiskCapacityAsync();
          } catch {
            // ignore
          }
        }
        // On web, simulate a default 4GB total to show the bar meaningfully
        if (totalBytes === 0) {
          totalBytes = 4 * ONE_GB;
          freeBytes = 4 * ONE_GB - stats.totalBytes;
        }

        if (!cancelled) {
          setInfo({
            appBytes: stats.totalBytes,
            freeBytes,
            totalBytes,
            messageCount: stats.messageCount,
          });
        }
      } catch (err) {
        console.error('Storage stats error:', err);
        if (!cancelled) setError(getDatabaseErrorMessage(err));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  if (error || !info) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surfaceAlt }]}>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>
          {error ?? 'Calculando…'}
        </Text>
      </View>
    );
  }

  // Used = total - free
  const usedBytes = Math.max(0, info.totalBytes - info.freeBytes);
  const otherUsedBytes = Math.max(0, usedBytes - info.appBytes);
  // Percentages of total
  const appPct = Math.min(100, (info.appBytes / info.totalBytes) * 100);
  const otherPct = Math.min(100 - appPct, (otherUsedBytes / info.totalBytes) * 100);
  // Visual minimum so it's perceivable when app is tiny
  const visualAppPct = Math.max(appPct, info.appBytes > 0 ? 0.5 : 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>
          Espacio en el dispositivo
        </Text>
        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
          {formatBytes(info.totalBytes)}
        </Text>
      </View>

      {/* Bar */}
      <View style={[styles.barTrack, { backgroundColor: theme.surfaceAlt }]}>
        {/* Other apps usage - subtle */}
        {otherPct > 0 && (
          <View
            style={[
              styles.barFill,
              {
                width: `${otherPct}%`,
                backgroundColor: theme.divider,
              },
            ]}
          />
        )}
        {/* SelfTalk usage - brand color */}
        {visualAppPct > 0 && (
          <View
            style={[
              styles.barFill,
              {
                width: `${visualAppPct}%`,
                backgroundColor: theme.primary,
              },
            ]}
          />
        )}
        {/* Free space marker (decorative, takes rest) */}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
          <View>
            <Text style={[styles.legendLabel, { color: theme.text }]}>
              SelfTalk
            </Text>
            <Text style={[styles.legendValue, { color: theme.textSecondary }]}>
              {formatBytes(info.appBytes)} · {info.messageCount} {info.messageCount === 1 ? 'mensaje' : 'mensajes'}
            </Text>
          </View>
        </View>

        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: theme.divider, borderWidth: 1, borderColor: theme.border },
            ]}
          />
          <View>
            <Text style={[styles.legendLabel, { color: theme.text }]}>Libre</Text>
            <Text style={[styles.legendValue, { color: theme.textSecondary }]}>
              {formatBytes(info.freeBytes)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  barTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barFill: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  legendValue: {
    fontSize: 11,
    marginTop: 1,
  },
});

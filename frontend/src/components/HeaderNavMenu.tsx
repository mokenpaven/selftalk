import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ThemePalette } from '../theme/themes';

interface HeaderNavMenuProps {
  visible: boolean;
  theme: ThemePalette;
  onClose: () => void;
}

interface MenuItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  color: string;
  route: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'trash',
    icon: 'trash-outline',
    label: 'Papelera',
    subtitle: 'Mensajes eliminados temporalmente',
    color: '#F59E0B',
    route: '/trash',
  },
  {
    id: 'archived',
    icon: 'archive-outline',
    label: 'Archivados',
    subtitle: 'Mensajes ocultos del chat principal',
    color: '#7C3AED',
    route: '/archived',
  },
  {
    id: 'ai',
    icon: 'sparkles',
    label: 'Chat con IA',
    subtitle: 'Conversa sobre tus notas',
    color: '#6366F1',
    route: '/ai',
  },
];

export function HeaderNavMenu({ visible, theme, onClose }: HeaderNavMenuProps) {
  const router = useRouter();

  const handlePress = (route: string) => {
    onClose();
    router.push(route as never);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.menu, { backgroundColor: theme.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: theme.divider }]} />
          <Text style={[styles.title, { color: theme.text }]}>Menú de SelfTalk</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Accesos rápidos
          </Text>

          <View style={styles.items}>
            {MENU_ITEMS.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handlePress(item.route)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: theme.surfaceAlt },
                ]}
                testID={`nav-menu-${item.id}`}
              >
                <View style={[styles.iconBg, { backgroundColor: `${item.color}22` }]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: theme.text }]}>{item.label}</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>
                    {item.subtitle}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: 72,
    paddingHorizontal: 16,
  },
  menu: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  items: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 12,
  },
  iconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Member = { id: string; name: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  householdId: string;
  members: Member[];
  selectedId: string | undefined;
  onSelect: (profileId: string) => void;
};

/**
 * The dropdown sheet (backdrop + profile list + "Add profile") shared by
 * every profile-switcher trigger in the app. Callers own their own trigger
 * markup (pill, header row, ...) and just control `visible`/`onSelect`.
 */
export function ProfileDropdownMenu({ visible, onClose, householdId, members, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.dropdownSheet} onPress={() => undefined}>
          {members.map((profile) => (
            <Pressable
              key={profile.id}
              accessibilityRole="button"
              style={styles.dropdownRow}
              onPress={() => {
                onSelect(profile.id);
                onClose();
              }}>
              <Text style={styles.dropdownRowLabel}>{profile.name}</Text>
              {profile.id === selectedId ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            style={styles.dropdownAdd}
            onPress={() => {
              onClose();
              router.push({ pathname: '/profile/new', params: { householdId } });
            }}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.dropdownAddLabel}>{t('settings.addProfile')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    dropdownSheet: {
      backgroundColor: colors.background,
      borderRadius: radius.card,
      padding: spacing.sm,
    },
    dropdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    dropdownRowLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    dropdownAdd: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: spacing.xs,
    },
    dropdownAddLabel: {
      color: colors.primary,
      fontSize: typography.body,
      fontWeight: '700',
    },
  });
}

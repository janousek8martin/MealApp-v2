import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { useProfiles } from '@/hooks/data';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  householdId: string;
};

/**
 * A single compact avatar+name pill – tapping it opens a dropdown listing
 * every household profile plus "Add profile", instead of showing every
 * profile as its own chip inline (the previous ProfileSwitcher behavior).
 */
export function ProfileDropdownChip({ householdId }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const memberList = useProfiles(householdId);
  const activeProfileId = useAppStore((state) => state.activeProfileId);
  const setActiveProfileId = useAppStore((state) => state.setActiveProfileId);
  const [visible, setVisible] = useState(false);

  const selected = memberList.find((p) => p.id === activeProfileId) ?? memberList[0];
  if (!selected) return null;

  return (
    <>
      <Pressable accessibilityRole="button" style={styles.chip} onPress={() => setVisible(true)}>
        <Text style={styles.initial}>{selected.name.slice(0, 1).toUpperCase()}</Text>
        <Text style={styles.name}>{selected.name}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.onPrimary} />
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.dropdownSheet} onPress={() => undefined}>
            {memberList.map((profile) => (
              <Pressable
                key={profile.id}
                accessibilityRole="button"
                style={styles.dropdownRow}
                onPress={() => {
                  setActiveProfileId(profile.id);
                  setVisible(false);
                }}>
                <Text style={styles.dropdownRowLabel}>{profile.name}</Text>
                {profile.id === selected.id ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              style={styles.dropdownAdd}
              onPress={() => {
                setVisible(false);
                router.push({ pathname: '/profile/new', params: { householdId } });
              }}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.dropdownAddLabel}>{t('settings.addProfile')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: radius.chip,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      alignSelf: 'flex-start',
    },
    initial: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primaryLight,
      color: colors.onPrimary,
      textAlign: 'center',
      textAlignVertical: 'center',
      fontWeight: '700',
      fontSize: typography.small,
      overflow: 'hidden',
    },
    name: {
      color: colors.onPrimary,
      fontSize: typography.small,
      fontWeight: '700',
    },
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

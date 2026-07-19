import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ProfileDropdownMenu } from '@/components/ProfileDropdownMenu';
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

      <ProfileDropdownMenu
        visible={visible}
        onClose={() => setVisible(false)}
        householdId={householdId}
        members={memberList}
        selectedId={selected.id}
        onSelect={setActiveProfileId}
      />
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
      backgroundColor: colors.interactive,
      color: colors.onInteractive,
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
  });
}

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useProfiles } from '@/hooks/data';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  householdId: string;
};

/** Horizontal avatar chips – tapping switches whose numbers the app shows. */
export function ProfileSwitcher({ householdId }: Props) {
  const memberList = useProfiles(householdId);
  const activeProfileId = useAppStore((state) => state.activeProfileId);
  const setActiveProfileId = useAppStore((state) => state.setActiveProfileId);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const effectiveActiveId = memberList.some((p) => p.id === activeProfileId)
    ? activeProfileId
    : memberList[0]?.id;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.row}>
      {memberList.map((profile) => {
        const selected = profile.id === effectiveActiveId;
        return (
          <Pressable
            key={profile.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => setActiveProfileId(profile.id)}
            style={[styles.chip, selected && styles.chipSelected]}>
            <Text style={[styles.initial, selected && styles.initialSelected]}>
              {profile.name.slice(0, 1).toUpperCase()}
            </Text>
            <Text style={[styles.name, selected && styles.nameSelected]}>{profile.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      // A horizontal ScrollView with no height constraint will stretch to
      // fill any leftover cross-axis space in a flex-column parent (visible
      // when this sits directly in a screen body rather than nested inside
      // another scroll view's content).
      flexGrow: 0,
      flexShrink: 0,
    },
    row: {
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.chip,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    initial: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.accentSoft,
      color: colors.text,
      textAlign: 'center',
      textAlignVertical: 'center',
      fontWeight: '700',
      fontSize: typography.small,
      overflow: 'hidden',
    },
    initialSelected: {
      backgroundColor: colors.interactive,
      color: colors.onInteractive,
    },
    name: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '600',
    },
    nameSelected: {
      color: colors.onPrimary,
    },
  });
}

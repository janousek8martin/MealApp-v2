import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileDropdownMenu } from '@/components/ProfileDropdownMenu';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { useProfiles } from '@/hooks/data';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  householdId: string;
  /** Which profile this pill shows as selected. Undefined falls back to the first household member. */
  selectedProfileId: string | undefined;
  /** Called with the tapped profile's id when the caller picks one from the dropdown. */
  onSelect: (profileId: string) => void;
};

/**
 * The single, shared profile-picker pill used on Plan, Progress, Home, and
 * Settings -> Profil: avatar/initial circle + name + chevron, opening the
 * shared `ProfileDropdownMenu` on tap. Deliberately a controlled component –
 * it never reads/writes the global active-profile store itself. Each screen
 * supplies its own `selectedProfileId`/`onSelect`, so Settings can track a
 * profile being viewed/edited locally without changing which profile is
 * "active" app-wide, while Plan/Progress/Home wire it straight to the global
 * `useAppStore` active-profile state.
 */
export function ProfileChip({ householdId, selectedProfileId, onSelect }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const members = useProfiles(householdId);
  const [visible, setVisible] = useState(false);

  const selected = members.find((m) => m.id === selectedProfileId) ?? members[0];
  if (!selected) return null;

  return (
    <>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" style={styles.chip} onPress={() => setVisible(true)}>
          <Text style={styles.initial}>{selected.name.slice(0, 1).toUpperCase()}</Text>
          <Text style={styles.name}>{selected.name}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.text} />
        </Pressable>
        <InfoTooltip titleKey="tooltip.profileChip.title" bodyKey="tooltip.profileChip.body" />
      </View>

      <ProfileDropdownMenu
        visible={visible}
        onClose={() => setVisible(false)}
        householdId={householdId}
        members={members}
        selectedId={selected.id}
        onSelect={onSelect}
      />
    </>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      alignSelf: 'flex-start',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.accentSoft,
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
      color: colors.text,
      fontSize: typography.label,
      fontWeight: '700',
    },
  });
}

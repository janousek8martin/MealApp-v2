import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ALL_NAV_KEYS, useAppStore, type NavKey } from '@/stores/appStore';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

const NAV_META: Record<NavKey, { icon: IconName; labelKey: string }> = {
  index: { icon: 'sunny', labelKey: 'tabs.home' },
  plan: { icon: 'calendar', labelKey: 'tabs.plan' },
  library: { icon: 'restaurant', labelKey: 'tabs.library' },
  shopping: { icon: 'cart', labelKey: 'tabs.shopping' },
  pantry: { icon: 'file-tray-stacked-outline', labelKey: 'tabs.pantry' },
  progress: { icon: 'trending-up', labelKey: 'tabs.progress' },
  settings: { icon: 'settings-outline', labelKey: 'tabs.settings' },
};

/** Minimal structural shape of expo-router's BottomTabBarProps – avoids a fragile deep import. */
type Props = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

function NavButton({
  navKey,
  active,
  onPress,
}: {
  navKey: NavKey;
  active: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const meta = NAV_META[navKey];
  return (
    <Pressable accessibilityRole="button" style={styles.navButton} onPress={onPress}>
      <Ionicons name={meta.icon} size={22} color={active ? colors.primary : colors.textSecondary} />
      <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
        {t(meta.labelKey)}
      </Text>
    </Pressable>
  );
}

/**
 * Custom bottom bar: a fixed main row (user-configurable in Settings, default
 * Home/Plan/Shopping/Settings) plus an expand toggle that reveals the
 * remaining routes (default Recipes/Pantry/Progress) in a panel above it.
 */
export function AppTabBar({ state, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const mainNavKeys = useAppStore((s) => s.mainNavKeys);
  const moreNavKeys = ALL_NAV_KEYS.filter((key) => !mainNavKeys.includes(key));
  const [expanded, setExpanded] = useState(false);

  const activeName = state.routes[state.index]?.name;

  const go = (key: NavKey) => {
    navigation.navigate(key);
    setExpanded(false);
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      {expanded && moreNavKeys.length > 0 ? (
        <View style={styles.moreRow}>
          {moreNavKeys.map((key) => (
            <NavButton key={key} navKey={key} active={activeName === key} onPress={() => go(key)} />
          ))}
        </View>
      ) : null}
      <View style={styles.mainRow}>
        {mainNavKeys.map((key) => (
          <NavButton key={key} navKey={key} active={activeName === key} onPress={() => go(key)} />
        ))}
        {moreNavKeys.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            style={styles.navButton}
            onPress={() => setExpanded((prev) => !prev)}>
            <Ionicons
              name={expanded ? 'chevron-down' : 'chevron-up'}
              size={22}
              color={expanded ? colors.primary : colors.textSecondary}
            />
            <Text style={styles.navLabel}>{expanded ? '—' : '···'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mainRow: {
    flexDirection: 'row',
  },
  moreRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderRadius: radius.card,
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: 2,
  },
  navLabel: {
    color: colors.textSecondary,
    fontSize: typography.small - 2,
    fontWeight: '600',
  },
  navLabelActive: {
    color: colors.primary,
  },
});

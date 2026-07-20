import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScrollDownHintButton } from '@/components/ScrollDownHintButton';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { useScrollDownHint } from '@/hooks/useScrollDownHint';
import { useTabScrollRestore } from '@/hooks/useTabScrollRestore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type CategoryRow = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: '/settings-app' | '/settings-household' | '/settings-profile' | '/settings-about';
  titleKey: string;
  hintKey: string;
  /** Only set where the existing one-line hint doesn't already cover what a tooltip would add (see task-11-report.md). */
  tooltipKey?: string;
};

const CATEGORIES: CategoryRow[] = [
  { key: 'app', icon: 'phone-portrait-outline', route: '/settings-app', titleKey: 'settings.category.app.title', hintKey: 'settings.category.app.hint' },
  { key: 'household', icon: 'home-outline', route: '/settings-household', titleKey: 'settings.category.household.title', hintKey: 'settings.category.household.hint' },
  { key: 'profile', icon: 'person-outline', route: '/settings-profile', titleKey: 'settings.category.profile.title', hintKey: 'settings.category.profile.hint', tooltipKey: 'tooltip.settingsProfile' },
  { key: 'about', icon: 'information-circle-outline', route: '/settings-about', titleKey: 'settings.category.about.title', hintKey: 'settings.category.about.hint' },
];

/** Settings hub: four category rows, each leading to its own dedicated settings screen. */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const { onScroll: onRestoreScroll, scrollEventThrottle } = useTabScrollRestore(scrollRef);
  const scrollHint = useScrollDownHint(scrollRef);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onScroll={(e) => {
          onRestoreScroll(e);
          scrollHint.onScroll(e);
        }}
        onContentSizeChange={scrollHint.onContentSizeChange}
        onLayout={scrollHint.onLayout}
        scrollEventThrottle={scrollEventThrottle}>
        <Text style={styles.heading}>{t('settings.title')}</Text>

        {CATEGORIES.map((category) => (
          <View key={category.key} style={styles.categoryRow}>
            <Pressable
              accessibilityRole="button"
              style={styles.categoryPress}
              onPress={() => router.push(category.route)}>
              <View style={styles.categoryIcon}>
                <Ionicons name={category.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.categoryText}>
                <Text style={styles.categoryTitle}>{t(category.titleKey)}</Text>
                <Text style={styles.categoryHint}>{t(category.hintKey)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </Pressable>
            {category.tooltipKey ? (
              <InfoTooltip titleKey={`${category.tooltipKey}.title`} bodyKey={`${category.tooltipKey}.body`} />
            ) : null}
          </View>
        ))}
      </ScrollView>

      <ScrollDownHintButton
        visible={scrollHint.visible}
        onPressIn={scrollHint.onPressIn}
        onPressOut={scrollHint.onPressOut}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    heading: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
      marginBottom: spacing.sm,
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    categoryPress: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    categoryIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryText: {
      flex: 1,
    },
    categoryTitle: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    categoryHint: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
      lineHeight: 18,
    },
  });
}

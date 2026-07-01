import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { TdciCard } from '@/components/TdciCard';
import { useActiveProfile, useHousehold, useProfileTargets } from '@/hooks/data';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function TodayScreen() {
  const { t } = useTranslation();
  const { household } = useHousehold();
  const activeProfile = useActiveProfile(household?.id);
  const targets = useProfileTargets(activeProfile);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('today.title')}</Text>

        {household ? <ProfileSwitcher householdId={household.id} /> : null}

        {activeProfile && targets ? (
          <TdciCard name={activeProfile.name} targets={targets} />
        ) : null}

        <View style={styles.mealsPlaceholder}>
          <Text style={styles.placeholderTitle}>{t('today.mealsComingTitle')}</Text>
          <Text style={styles.placeholderText}>{t('today.mealsComingText')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  mealsPlaceholder: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  placeholderTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  placeholderText: {
    color: colors.textSecondary,
    fontSize: typography.small,
    lineHeight: 20,
  },
});

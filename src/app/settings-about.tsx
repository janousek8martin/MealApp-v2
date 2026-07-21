import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HintedScrollView } from '@/components/HintedScrollView';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

export default function SettingsAboutScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setWalkthroughSeen = useAppStore((s) => s.setWalkthroughSeen);

  const replayOnboarding = () => {
    setWalkthroughSeen(false);
    router.push('/walkthrough');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <HintedScrollView contentContainerStyle={styles.content}>
        <ScreenHeader />
        <Text style={styles.heading}>{t('settings.category.about.title')}</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('settingsAbout.version')}</Text>
          <Text style={styles.infoValue}>{Constants.expoConfig?.version ?? '—'}</Text>
        </View>

        <Button label={t('settingsAbout.replayOnboarding')} variant="secondary" onPress={replayOnboarding} />

        {/* TODO(licence): Martin needs to pick the actual open-source licence + finalize this wording before any public release. */}
        <Text style={styles.licenceText}>{t('settingsAbout.licencePlaceholder')}</Text>

        <View style={styles.disclaimerCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.disclaimerText}>{t('settings.disclaimer')}</Text>
        </View>
      </HintedScrollView>
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
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    infoLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    infoValue: {
      color: colors.textSecondary,
      fontSize: typography.body,
    },
    licenceText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: 18,
      marginTop: spacing.md,
    },
    disclaimerCard: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm + 2,
      marginTop: spacing.lg,
    },
    disclaimerText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: 18,
    },
  });
}

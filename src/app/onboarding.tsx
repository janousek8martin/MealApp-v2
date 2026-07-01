import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileForm, type ProfileFormValue } from '@/components/ProfileForm';
import { TdciCard } from '@/components/TdciCard';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { createHouseholdWithDefaults } from '@/db/repositories/households';
import { createProfile } from '@/db/repositories/profiles';
import { ageYears } from '@/domain/age';
import { computeTargets, type TargetsResult } from '@/domain/targets';
import { useAppStore } from '@/stores/appStore';
import { colors, spacing, typography } from '@/theme/tokens';

type Step = 'welcome' | 'household' | 'profile' | 'result';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('welcome');
  const [householdName, setHouseholdName] = useState('');
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [lastResult, setLastResult] = useState<{ name: string; targets: TargetsResult } | null>(null);
  const setActiveProfileId = useAppStore((state) => state.setActiveProfileId);

  const handleCreateHousehold = async () => {
    const name = householdName.trim();
    if (!name) return;
    const id = await createHouseholdWithDefaults(db, name);
    setHouseholdId(id);
    setStep('profile');
  };

  const handleCreateProfile = async (value: ProfileFormValue) => {
    if (!householdId) return;
    const profileId = await createProfile(db, { householdId, ...value });
    if (memberCount === 0) {
      setActiveProfileId(profileId);
    }
    setMemberCount((count) => count + 1);
    setLastResult({
      name: value.name,
      targets: computeTargets({
        profileType: value.profileType,
        sex: value.sex,
        ageYears: ageYears(value.birthDate),
        heightCm: value.heightCm,
        weightKg: value.weightKg,
        bodyFatPct: value.bodyFatPct,
        activityLevel: value.activityLevel,
        goal: value.goal ?? 'maintain',
        goalBodyFatPct: value.goalBodyFatPct,
      }),
    });
    setStep('result');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 'welcome' ? (
            <View style={styles.centered}>
              <Text style={styles.title}>{t('onboarding.welcomeTitle')}</Text>
              <Text style={styles.subtitle}>{t('onboarding.welcomeSubtitle')}</Text>
              <Button
                label={t('onboarding.start')}
                onPress={() => setStep('household')}
                style={styles.cta}
              />
            </View>
          ) : null}

          {step === 'household' ? (
            <View>
              <Text style={styles.title}>{t('onboarding.householdTitle')}</Text>
              <Text style={styles.subtitle}>{t('onboarding.householdSubtitle')}</Text>
              <TextField
                label={t('onboarding.householdName')}
                value={householdName}
                onChangeText={setHouseholdName}
                placeholder={t('onboarding.householdPlaceholder')}
              />
              <Button
                label={t('common.continue')}
                onPress={handleCreateHousehold}
                disabled={!householdName.trim()}
              />
            </View>
          ) : null}

          {step === 'profile' ? (
            <View>
              <Text style={styles.title}>
                {memberCount === 0 ? t('onboarding.firstProfileTitle') : t('onboarding.nextProfileTitle')}
              </Text>
              <Text style={styles.subtitle}>{t('onboarding.profileSubtitle')}</Text>
              <ProfileForm submitLabel={t('onboarding.computeTdci')} onSubmit={handleCreateProfile} />
            </View>
          ) : null}

          {step === 'result' && lastResult ? (
            <View>
              <Text style={styles.title}>{t('onboarding.resultTitle')}</Text>
              <Text style={styles.subtitle}>{t('onboarding.resultSubtitle')}</Text>
              <TdciCard name={lastResult.name} targets={lastResult.targets} />
              <View style={styles.resultActions}>
                <Button
                  label={t('onboarding.addAnother')}
                  variant="secondary"
                  onPress={() => setStep('profile')}
                />
                <Button label={t('onboarding.finish')} onPress={() => router.replace('/(tabs)')} />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  centered: {
    alignItems: 'stretch',
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  cta: {
    marginTop: spacing.md,
  },
  resultActions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});

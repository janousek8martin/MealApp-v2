import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme/tokens';
import { db } from './client';
import migrations from './migrations/migrations';
import { seedIfEmpty } from './seed';

type Props = { children: ReactNode };

/**
 * Blocks the UI until migrations have run and the first-launch seed finished.
 * Keeps the splash-like state minimal – both steps are local and fast.
 */
export function DbGate({ children }: Props) {
  const { success, error } = useMigrations(db, migrations);
  const [seedState, setSeedState] = useState<'pending' | 'done' | 'failed'>('pending');

  useEffect(() => {
    if (!success) return;
    seedIfEmpty(db)
      .then(() => setSeedState('done'))
      .catch((seedError) => {
        console.error('Seeding failed', seedError);
        setSeedState('failed');
      });
  }, [success]);

  if (error || seedState === 'failed') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Database error</Text>
        <Text style={styles.errorDetail}>{error?.message ?? 'Seeding failed'}</Text>
      </View>
    );
  }

  if (!success || seedState !== 'done') {
    return <View style={styles.container} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  errorDetail: {
    color: colors.textSecondary,
    fontSize: typography.small,
    textAlign: 'center',
  },
});

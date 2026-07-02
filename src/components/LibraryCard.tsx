import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = {
  title: string;
  subtitle: string;
  photoUri?: string | null;
  /** Fallback block color when there is no photo yet. */
  accent?: string;
  badge?: string;
  favorite?: boolean;
  onPress: () => void;
};

/** Rounded card used for recipes and foods in the library lists. */
export function LibraryCard({ title, subtitle, photoUri, accent, badge, favorite, onPress }: Props) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, { backgroundColor: accent ?? colors.mint }]} />
      )}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {favorite ? <Ionicons name="heart" size={16} color={colors.success} /> : null}
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.card - 8,
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    flexShrink: 1,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.small,
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.lime,
    borderRadius: radius.chip,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  badgeLabel: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '600',
  },
});

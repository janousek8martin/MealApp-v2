import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  title: string;
  subtitle: string;
  photoUri?: string | null;
  /** Fallback block color when there is no photo yet. */
  accent?: string;
  badge?: string;
  favorite?: boolean;
  tags?: string[];
  onPress: () => void;
  /** When provided, a long-press on the card reveals a delete (trash) button. */
  onDelete?: () => void;
};

/** Rounded card used for recipes and foods in the library lists. */
export function LibraryCard({
  title,
  subtitle,
  photoUri,
  accent,
  badge,
  favorite,
  tags,
  onPress,
  onDelete,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [deleteRevealed, setDeleteRevealed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onDelete ? () => setDeleteRevealed(true) : undefined}
      style={styles.card}>
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
        {tags && tags.length > 0 ? (
          <View style={styles.tagRow}>
            {tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagLabel} numberOfLines={1}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {deleteRevealed && onDelete ? (
        <Pressable
          accessibilityRole="button"
          style={styles.deleteButton}
          onPress={() => {
            setDeleteRevealed(false);
            onDelete();
          }}
          hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      ) : badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
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
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    tag: {
      backgroundColor: colors.tealTint,
      borderRadius: radius.chip,
      paddingVertical: 1,
      paddingHorizontal: spacing.xs + 2,
    },
    tagLabel: {
      color: colors.text,
      fontSize: typography.small - 2,
      fontWeight: '600',
    },
    deleteButton: {
      padding: spacing.xs,
    },
  });
}

import { Image } from 'expo-image';
import { useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

const MALE_VALUES = [8, 12, 15, 20, 25, 30, 35];
const FEMALE_VALUES = [15, 20, 25, 30, 35, 40, 45];

const MALE_IMAGES: Record<number, number> = {
  8: require('../assets/images/body-fat/male/8BF.png'),
  12: require('../assets/images/body-fat/male/12BF.png'),
  15: require('../assets/images/body-fat/male/15BF.png'),
  20: require('../assets/images/body-fat/male/20BF.png'),
  25: require('../assets/images/body-fat/male/25BF.png'),
  30: require('../assets/images/body-fat/male/30BF.png'),
  35: require('../assets/images/body-fat/male/35BF.png'),
};

const FEMALE_IMAGES: Record<number, number> = {
  15: require('../assets/images/body-fat/female/15BFf.png'),
  20: require('../assets/images/body-fat/female/20BFf.png'),
  25: require('../assets/images/body-fat/female/25BFf.png'),
  30: require('../assets/images/body-fat/female/30BFf.png'),
  35: require('../assets/images/body-fat/female/35BFf.png'),
  40: require('../assets/images/body-fat/female/40BFf.png'),
  45: require('../assets/images/body-fat/female/45BFf.png'),
};

type Props = {
  sex: 'male' | 'female';
  value: number | null;
  onSelect: (value: number) => void;
};

/** Horizontal picker of body-fat silhouettes – an alternative to typing a % directly. */
export function BodyFatCarousel({ sex, value, onSelect }: Props) {
  const values = sex === 'male' ? MALE_VALUES : FEMALE_VALUES;
  const images = sex === 'male' ? MALE_IMAGES : FEMALE_IMAGES;
  const listRef = useRef<FlatList<number>>(null);

  return (
    <FlatList
      ref={listRef}
      data={values}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => String(item)}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const selected = value === item;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(item)}
            style={[styles.item, selected && styles.itemSelected]}>
            <Image source={images[item]} style={styles.image} contentFit="contain" />
            <Text style={[styles.label, selected && styles.labelSelected]}>{item} %</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  item: {
    alignItems: 'center',
    padding: spacing.xs,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  image: {
    width: 72,
    height: 128,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.small,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  labelSelected: {
    color: colors.primary,
  },
});

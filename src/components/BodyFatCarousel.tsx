import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, type ColorTokens } from '@/theme/tokens';

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
  /** The body-fat input's current numeric value (may not exactly match a carousel step). */
  value: number | null;
  /** Fired only for user-driven selection (tap, swipe-settle, arrow) – never for external value changes. */
  onSelect: (value: number) => void;
};

function nearestIndex(values: number[], target: number | null): number {
  if (target === null) return Math.floor(values.length / 2);
  let bestIndex = 0;
  let bestDiff = Infinity;
  values.forEach((v, i) => {
    const diff = Math.abs(v - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  });
  return bestIndex;
}

/**
 * Body-fat silhouette picker – 3 visible at a time, center one enlarged.
 * The center item always reflects `value`'s nearest step: typing a custom
 * number into the linked input scrolls the carousel here without echoing
 * back (see the lastEmittedValue guard), while tapping/swiping/arrows here
 * push the exact chosen value back out via onSelect.
 */
export function BodyFatCarousel({ sex, value, onSelect }: Props) {
  const values = sex === 'male' ? MALE_VALUES : FEMALE_VALUES;
  const images = sex === 'male' ? MALE_IMAGES : FEMALE_IMAGES;
  const listRef = useRef<FlatList<number>>(null);
  const { colors } = useTheme();
  const [containerWidth, setContainerWidth] = useState(300);
  const itemWidth = containerWidth / 3;
  const styles = useMemo(() => createStyles(colors, itemWidth), [colors, itemWidth]);

  const lastEmittedValue = useRef<number | null>(null);
  // Programmatic scrollToOffset (from the value-sync effect below) still fires
  // onMomentumScrollEnd once its animation settles, indistinguishable from a real
  // user swipe. This flag lets onMomentumScrollEnd tell the two apart so typing
  // a custom value never echoes back and stomps on what the user just typed.
  const suppressNextScrollEnd = useRef(false);
  const [centeredIndex, setCenteredIndex] = useState(() => nearestIndex(values, value));

  useEffect(() => {
    setCenteredIndex(nearestIndex(values, value));
  }, [sex]);

  useEffect(() => {
    if (value === lastEmittedValue.current) return;
    const index = nearestIndex(values, value);
    setCenteredIndex(index);
    suppressNextScrollEnd.current = true;
    listRef.current?.scrollToOffset({ offset: index * itemWidth, animated: true });
  }, [value, itemWidth]);

  const commitSelection = (index: number) => {
    const clamped = Math.max(0, Math.min(values.length - 1, index));
    lastEmittedValue.current = values[clamped];
    setCenteredIndex(clamped);
    onSelect(values[clamped]);
    listRef.current?.scrollToOffset({ offset: clamped * itemWidth, animated: true });
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (Math.abs(width - containerWidth) > 1) setContainerWidth(width);
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (suppressNextScrollEnd.current) {
      suppressNextScrollEnd.current = false;
      return;
    }
    const index = Math.round(event.nativeEvent.contentOffset.x / itemWidth);
    commitSelection(index);
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous"
        onPress={() => commitSelection(centeredIndex - 1)}
        disabled={centeredIndex === 0}
        style={styles.arrow}>
        <Ionicons name="chevron-back" size={22} color={centeredIndex === 0 ? colors.border : colors.primary} />
      </Pressable>

      <View style={styles.list} onLayout={onLayout}>
        <FlatList
          ref={listRef}
          data={values}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => String(item)}
          snapToInterval={itemWidth}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: itemWidth }}
          getItemLayout={(_, index) => ({ length: itemWidth, offset: itemWidth * index, index })}
          onMomentumScrollEnd={onMomentumScrollEnd}
          renderItem={({ item, index }) => {
            const selected = index === centeredIndex;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => commitSelection(index)}
                style={[styles.item, { width: itemWidth }]}>
                <Image
                  source={images[item]}
                  style={selected ? styles.imageSelected : styles.image}
                  contentFit="contain"
                />
                <Text style={[styles.label, selected && styles.labelSelected]}>{item} %</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next"
        onPress={() => commitSelection(centeredIndex + 1)}
        disabled={centeredIndex === values.length - 1}
        style={styles.arrow}>
        <Ionicons
          name="chevron-forward"
          size={22}
          color={centeredIndex === values.length - 1 ? colors.border : colors.primary}
        />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorTokens, itemWidth: number) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    arrow: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      flex: 1,
    },
    item: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xs,
    },
    image: {
      width: itemWidth * 0.5,
      height: itemWidth * 0.9,
      opacity: 0.6,
    },
    imageSelected: {
      width: itemWidth * 0.7,
      height: itemWidth * 1.25,
    },
    label: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
      marginTop: spacing.xs,
    },
    labelSelected: {
      color: colors.primary,
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
}

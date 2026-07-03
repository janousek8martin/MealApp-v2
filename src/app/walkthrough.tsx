import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { db } from '@/db/client';
import { createHouseholdWithDefaults } from '@/db/repositories/households';
import { createProfile } from '@/db/repositories/profiles';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const PAGES: { image: ReturnType<typeof require>; titleKey: string; bodyKey: string }[] = [
  {
    image: require('../assets/images/walkthrough/household.png'),
    titleKey: 'walkthrough.page1Title',
    bodyKey: 'walkthrough.page1Body',
  },
  {
    image: require('../assets/images/walkthrough/calories.png'),
    titleKey: 'walkthrough.page2Title',
    bodyKey: 'walkthrough.page2Body',
  },
  {
    image: require('../assets/images/walkthrough/mealplan.png'),
    titleKey: 'walkthrough.page3Title',
    bodyKey: 'walkthrough.page3Body',
  },
  {
    image: require('../assets/images/walkthrough/shopping.png'),
    titleKey: 'walkthrough.page4Title',
    bodyKey: 'walkthrough.page4Body',
  },
  {
    image: require('../assets/images/walkthrough/progress.png'),
    titleKey: 'walkthrough.page5Title',
    bodyKey: 'walkthrough.page5Body',
  },
];

/** Quick-start defaults for the "skip the wizard" path – editable later in Profile settings. */
const QUICK_START_PROFILE = {
  name: 'Já',
  profileType: 'adult' as const,
  sex: 'male' as const,
  birthDate: '1995-01-01',
  heightCm: 175,
  weightKg: 75,
  activityLevel: 'moderate' as const,
  goal: 'maintain' as const,
};

export default function WalkthroughScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const [pageIndex, setPageIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const setWalkthroughSeen = useAppStore((s) => s.setWalkthroughSeen);
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId);

  const isLast = pageIndex === PAGES.length - 1;

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: false,
    listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setPageIndex(Math.round(event.nativeEvent.contentOffset.x / width));
    },
  });

  const goNext = () => {
    listRef.current?.scrollToIndex({ index: Math.min(pageIndex + 1, PAGES.length - 1) });
  };

  const startWizard = () => {
    setWalkthroughSeen(true);
    router.replace('/wizard');
  };

  const quickStart = async () => {
    setWalkthroughSeen(true);
    const householdId = await createHouseholdWithDefaults(db, t('walkthrough.defaultHouseholdName'));
    const profileId = await createProfile(db, { householdId, ...QUICK_START_PROFILE });
    setActiveProfileId(profileId);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <FlatList
        ref={listRef}
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.titleKey}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[styles.page, { width }]}>
            <Image source={item.image} style={styles.illustration} contentFit="contain" />
            <Text style={styles.title}>{t(item.titleKey)}</Text>
            <Text style={styles.body}>{t(item.bodyKey)}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {PAGES.map((page, index) => {
          const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 20, 8],
            extrapolate: 'clamp',
          });
          const dotColor = scrollX.interpolate({
            inputRange,
            outputRange: [colors.border, colors.primary, colors.border],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={page.titleKey}
              style={[styles.dot, { width: dotWidth, backgroundColor: dotColor }]}
            />
          );
        })}
      </View>

      <View style={styles.footer}>
        {isLast ? (
          <>
            <Button label={t('walkthrough.setupHousehold')} onPress={startWizard} style={styles.footerButton} />
            <Button
              label={t('walkthrough.quickStart')}
              variant="secondary"
              onPress={quickStart}
              style={styles.footerButton}
            />
          </>
        ) : (
          <Button label={t('common.continue')} onPress={goNext} style={styles.footerButton} />
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    page: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
      gap: spacing.lg,
    },
    illustration: {
      width: '100%',
      height: 220,
      borderRadius: radius.card,
    },
    title: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    body: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: 22,
      textAlign: 'center',
      maxWidth: 320,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    dot: {
      height: 8,
      borderRadius: 4,
    },
    footer: {
      padding: spacing.lg,
      gap: spacing.sm,
    },
    footerButton: {
      width: '100%',
    },
  });
}

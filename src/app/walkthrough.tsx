import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
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
  {
    image: require('../assets/images/walkthrough/import.png'),
    titleKey: 'walkthrough.page6Title',
    bodyKey: 'walkthrough.page6Body',
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

  // Button cross-fade, driven explicitly instead of via LayoutAnimation –
  // LayoutAnimation is unreliable (often a silent no-op) on Android with the
  // New Architecture, which caused the old "one button just pops into
  // existence" jump instead of a smooth transition.
  //
  // The footer's box height is reserved at its maximum (two-button) size from
  // the very first page and never animated – only opacity cross-fades inside
  // it. This keeps the FlatList's available height constant across every
  // page, so the illustration/title/body don't shift vertically when the
  // last page's footer would otherwise grow taller.
  const [buttonHeight, setButtonHeight] = useState<number | null>(null);
  const footerAnim = useRef(new Animated.Value(isLast ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(footerAnim, {
      toValue: isLast ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isLast, footerAnim]);

  const footerContentHeight = buttonHeight ? buttonHeight * 2 + spacing.sm : undefined;

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: false,
    listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
      setPageIndex(newIndex);
    },
  });

  const goNext = () => {
    listRef.current?.scrollToIndex({ index: Math.min(pageIndex + 1, PAGES.length - 1) });
  };

  const goBack = () => {
    listRef.current?.scrollToIndex({ index: Math.max(pageIndex - 1, 0) });
  };

  // Back chevron fades with page position (swipe already works both ways;
  // this is the visible affordance). Opacity-only - no layout shift.
  const backOpacity = scrollX.interpolate({
    inputRange: [0, width * 0.6],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

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
      <Animated.View style={[styles.backWrap, { opacity: backOpacity }]} pointerEvents={pageIndex > 0 ? 'auto' : 'none'}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('carousel.back')} style={styles.backButton} onPress={goBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      </Animated.View>
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
        <Animated.View style={footerContentHeight ? { height: footerContentHeight } : undefined}>
          <Animated.View
            pointerEvents={isLast ? 'none' : 'auto'}
            onLayout={(event) => setButtonHeight((prev) => prev ?? event.nativeEvent.layout.height)}
            style={[
              styles.footerLayer,
              { opacity: footerAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
            ]}>
            <Button label={t('common.continue')} onPress={goNext} style={styles.footerButton} />
          </Animated.View>
          <Animated.View
            pointerEvents={isLast ? 'auto' : 'none'}
            style={[styles.footerLayer, { opacity: footerAnim }]}>
            <Button label={t('walkthrough.setupHousehold')} onPress={startWizard} style={styles.footerButton} />
            <Button
              label={t('walkthrough.quickStart')}
              variant="secondary"
              onPress={quickStart}
              style={styles.footerButton}
            />
          </Animated.View>
        </Animated.View>
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
    backWrap: {
      position: 'absolute',
      top: spacing.xl,
      left: spacing.lg,
      zIndex: 1,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
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
    },
    footerLayer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      gap: spacing.sm,
    },
    footerButton: {
      width: '100%',
    },
  });
}

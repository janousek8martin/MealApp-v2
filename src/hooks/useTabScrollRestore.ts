import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, type RefObject } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { shouldRestoreScroll } from '@/domain/scrollRestore';
import { useAppStore } from '@/stores/appStore';

type ScrollableRef = {
  scrollTo?: (options: { y: number; animated?: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
};

/**
 * Resets a tab screen's scroll position to the top every time the tab is
 * re-focused. If the user enables "restore scroll position" in Settings and
 * returns within `restoreScrollTimeoutSec` of leaving, it restores the
 * offset they were at instead of resetting – tab screens stay mounted across
 * switches (expo-router Tabs default), so a plain ref survives the round trip.
 *
 * Pass the returned `onScroll`/`scrollEventThrottle` to the ScrollView/FlatList.
 */
export function useTabScrollRestore(ref: RefObject<ScrollableRef | null>) {
  const restoreEnabled = useAppStore((state) => state.restoreScrollEnabled);
  const restoreTimeoutSec = useAppStore((state) => state.restoreScrollTimeoutSec);
  const lastOffset = useRef(0);
  const leftAt = useRef<number | null>(null);

  const scrollTo = useCallback(
    (offset: number) => {
      ref.current?.scrollTo?.({ y: offset, animated: false });
      ref.current?.scrollToOffset?.({ offset, animated: false });
    },
    [ref],
  );

  useFocusEffect(
    useCallback(() => {
      const restore = shouldRestoreScroll({
        enabled: restoreEnabled,
        leftAt: leftAt.current,
        now: Date.now(),
        timeoutSec: restoreTimeoutSec,
      });
      scrollTo(restore ? lastOffset.current : 0);
      return () => {
        leftAt.current = Date.now();
      };
    }, [restoreEnabled, restoreTimeoutSec, scrollTo]),
  );

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    lastOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  return { onScroll, scrollEventThrottle: 16 };
}

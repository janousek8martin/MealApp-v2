import { useCallback, useRef, useState, type RefObject } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { clampScrollOffset, shouldShowScrollHint } from '@/domain/scrollHint';

type ScrollableRef = {
  scrollTo?: (options: { y: number; animated?: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
};

const TAP_NUDGE_PX = 180;
const HOLD_STEP_PX = 12;
const HOLD_INTERVAL_MS = 16;
/** Below this press duration, treat it as a tap (one nudge) rather than a hold (continuous scroll). */
const HOLD_DELAY_MS = 220;

/**
 * Drives the "scroll down" hint FAB shown above the tab bar: visible only
 * when there's more content below, a tap nudges the view down a bit, and a
 * press-and-hold scrolls continuously until released or the bottom is
 * reached. The show/hide and offset-clamping decisions are pure functions
 * (src/domain/scrollHint.ts) so they're unit-tested rather than eyeballed.
 */
export function useScrollDownHint(ref: RefObject<ScrollableRef | null>) {
  const [visible, setVisible] = useState(false);
  const offset = useRef(0);
  const layoutHeight = useRef(0);
  const contentHeight = useRef(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHolding = useRef(false);

  const recomputeVisibility = useCallback(() => {
    setVisible(shouldShowScrollHint(offset.current, layoutHeight.current, contentHeight.current));
  }, []);

  const scrollTo = useCallback(
    (next: number) => {
      ref.current?.scrollTo?.({ y: next, animated: true });
      ref.current?.scrollToOffset?.({ offset: next, animated: true });
    },
    [ref],
  );

  const stopHolding = useCallback(() => {
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  }, []);

  const step = useCallback(
    (delta: number) => {
      const next = clampScrollOffset(offset.current + delta, layoutHeight.current, contentHeight.current);
      scrollTo(next);
      if (next === offset.current) {
        stopHolding();
      }
      offset.current = next;
    },
    [scrollTo, stopHolding],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = event.nativeEvent.contentOffset.y;
      layoutHeight.current = event.nativeEvent.layoutMeasurement.height;
      contentHeight.current = event.nativeEvent.contentSize.height;
      recomputeVisibility();
    },
    [recomputeVisibility],
  );

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeight.current = height;
      recomputeVisibility();
    },
    [recomputeVisibility],
  );

  const onLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      layoutHeight.current = event.nativeEvent.layout.height;
      recomputeVisibility();
    },
    [recomputeVisibility],
  );

  const onPressIn = useCallback(() => {
    isHolding.current = false;
    pressTimer.current = setTimeout(() => {
      isHolding.current = true;
      holdInterval.current = setInterval(() => step(HOLD_STEP_PX), HOLD_INTERVAL_MS);
    }, HOLD_DELAY_MS);
  }, [step]);

  const onPressOut = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (isHolding.current) {
      stopHolding();
    } else {
      step(TAP_NUDGE_PX);
    }
    isHolding.current = false;
  }, [step, stopHolding]);

  return { visible, onScroll, onContentSizeChange, onLayout, onPressIn, onPressOut };
}

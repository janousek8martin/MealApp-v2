import { forwardRef, useImperativeHandle, useRef } from 'react';
import { ScrollView, View, type ScrollViewProps, StyleSheet } from 'react-native';

import { ScrollDownHintButton } from '@/components/ScrollDownHintButton';
import { useScrollDownHint } from '@/hooks/useScrollDownHint';

type Props = ScrollViewProps & {
  /** Extra clearance for the hint FAB, e.g. to sit above a sticky footer. */
  hintBottomOffset?: number;
};

/**
 * Drop-in ScrollView replacement that shows the "more content below" hint FAB
 * by default. Use this on every non-tab scrollable screen so the hint can't be
 * forgotten (the tab screens wire the hint themselves alongside scroll
 * restore). Composes the caller's onScroll/onContentSizeChange/onLayout with
 * the hint's own handlers.
 */
export const HintedScrollView = forwardRef<ScrollView, Props>(function HintedScrollView(
  { children, onScroll, onContentSizeChange, onLayout, hintBottomOffset = 0, scrollEventThrottle, ...rest },
  ref,
) {
  const innerRef = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => innerRef.current as ScrollView);
  const hint = useScrollDownHint(innerRef);

  return (
    <View style={styles.fill}>
      <ScrollView
        ref={innerRef}
        onScroll={(e) => {
          hint.onScroll(e);
          onScroll?.(e);
        }}
        onContentSizeChange={(w, h) => {
          hint.onContentSizeChange(w, h);
          onContentSizeChange?.(w, h);
        }}
        onLayout={(e) => {
          hint.onLayout(e);
          onLayout?.(e);
        }}
        scrollEventThrottle={scrollEventThrottle ?? 16}
        {...rest}>
        {children}
      </ScrollView>
      <ScrollDownHintButton
        visible={hint.visible}
        onPressIn={hint.onPressIn}
        onPressOut={hint.onPressOut}
        bottomOffset={hintBottomOffset}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

/** Pixels of slack before we consider the scroll view "at the bottom". */
export const SCROLL_HINT_BOTTOM_SLOP_PX = 24;

/** Whether there's enough content to actually scroll (vs. everything already fits on screen). */
export function isContentScrollable(contentHeight: number, layoutHeight: number): boolean {
  return contentHeight > layoutHeight + SCROLL_HINT_BOTTOM_SLOP_PX;
}

/** Whether the current offset is already at (or past) the bottom of the content. */
export function isScrolledToBottom(offset: number, layoutHeight: number, contentHeight: number): boolean {
  return offset + layoutHeight >= contentHeight - SCROLL_HINT_BOTTOM_SLOP_PX;
}

/** Whether the down-arrow hint button should be visible right now. */
export function shouldShowScrollHint(offset: number, layoutHeight: number, contentHeight: number): boolean {
  return isContentScrollable(contentHeight, layoutHeight) && !isScrolledToBottom(offset, layoutHeight, contentHeight);
}

/** Clamps a proposed next scroll offset to [0, maxScrollableOffset]. */
export function clampScrollOffset(nextOffset: number, layoutHeight: number, contentHeight: number): number {
  const maxOffset = Math.max(0, contentHeight - layoutHeight);
  return Math.max(0, Math.min(nextOffset, maxOffset));
}

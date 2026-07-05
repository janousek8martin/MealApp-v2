import { clampScrollOffset, isContentScrollable, isScrolledToBottom, shouldShowScrollHint } from '../scrollHint';

describe('isContentScrollable', () => {
  it('is false when content fits entirely within the viewport', () => {
    expect(isContentScrollable(500, 800)).toBe(false);
  });

  it('is false when content only barely exceeds the viewport (within slop)', () => {
    expect(isContentScrollable(810, 800)).toBe(false);
  });

  it('is true once content meaningfully exceeds the viewport', () => {
    expect(isContentScrollable(1200, 800)).toBe(true);
  });
});

describe('isScrolledToBottom', () => {
  it('is false near the top of long content', () => {
    expect(isScrolledToBottom(0, 800, 2000)).toBe(false);
  });

  it('is true once offset + viewport reaches the content end', () => {
    expect(isScrolledToBottom(1200, 800, 2000)).toBe(true);
  });

  it('treats the last few pixels (within slop) as already at the bottom', () => {
    expect(isScrolledToBottom(1190, 800, 2000)).toBe(true);
  });
});

describe('shouldShowScrollHint', () => {
  it('hides the hint on a short, non-scrollable screen', () => {
    expect(shouldShowScrollHint(0, 800, 500)).toBe(false);
  });

  it('shows the hint on a long screen scrolled to the top', () => {
    expect(shouldShowScrollHint(0, 800, 2000)).toBe(true);
  });

  it('hides the hint once the user reaches the bottom of long content', () => {
    expect(shouldShowScrollHint(1200, 800, 2000)).toBe(false);
  });
});

describe('clampScrollOffset', () => {
  it('never goes below zero', () => {
    expect(clampScrollOffset(-50, 800, 2000)).toBe(0);
  });

  it('never exceeds the maximum scrollable offset', () => {
    expect(clampScrollOffset(5000, 800, 2000)).toBe(1200);
  });

  it('passes through values within range unchanged', () => {
    expect(clampScrollOffset(600, 800, 2000)).toBe(600);
  });
});

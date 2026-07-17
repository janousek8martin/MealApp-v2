import { classifyGoalReview } from '../goalReview';

describe('classifyGoalReview', () => {
  it('classifies a 5% change as realistic', () => {
    expect(classifyGoalReview(100, 95).tier).toBe('realistic');
  });

  it('classifies exactly 10% as realistic (inclusive boundary)', () => {
    expect(classifyGoalReview(100, 90).tier).toBe('realistic');
  });

  it('classifies just over 10% as ambitious', () => {
    expect(classifyGoalReview(100, 89.9).tier).toBe('ambitious');
  });

  it('classifies exactly 20% as ambitious (inclusive boundary)', () => {
    expect(classifyGoalReview(100, 80).tier).toBe('ambitious');
  });

  it('classifies just over 20% as challenging', () => {
    expect(classifyGoalReview(100, 79.9).tier).toBe('challenging');
  });

  it('treats weight gain symmetrically to weight loss', () => {
    expect(classifyGoalReview(100, 115).tier).toBe('ambitious');
    expect(classifyGoalReview(100, 105).tier).toBe('realistic');
  });

  describe('pace reaction', () => {
    it('no rate given -> no pace flag, no weeks estimate', () => {
      const review = classifyGoalReview(100, 90);
      expect(review.paceExceedsSafeBand).toBe(false);
      expect(review.estimatedWeeks).toBeNull();
    });

    it('a loss rate inside the safe band does not bump the tier', () => {
      // 0.9 kg/week at 100 kg = 0.9 %/week, inside the 1 % ceiling.
      const review = classifyGoalReview(100, 90, 0.9);
      expect(review.paceExceedsSafeBand).toBe(false);
      expect(review.tier).toBe('realistic');
    });

    it('a loss rate above 1 %/week flags the pace and bumps the tier one step', () => {
      // 1.2 kg/week at 100 kg = 1.2 %/week.
      const review = classifyGoalReview(100, 90, 1.2);
      expect(review.paceExceedsSafeBand).toBe(true);
      expect(review.tier).toBe('ambitious');
    });

    it('a challenging goal stays challenging when the pace is also excessive (no overflow)', () => {
      const review = classifyGoalReview(100, 70, 1.5);
      expect(review.tier).toBe('challenging');
      expect(review.paceExceedsSafeBand).toBe(true);
    });

    it('gain goals never trip the loss pace band', () => {
      // 1.5 kg/week gain at 100 kg would exceed the LOSS band, but this is a gain.
      const review = classifyGoalReview(100, 110, 1.5);
      expect(review.paceExceedsSafeBand).toBe(false);
      expect(review.tier).toBe('realistic');
    });

    it('estimates weeks to goal as ceil(delta / rate)', () => {
      expect(classifyGoalReview(100, 90, 0.7).estimatedWeeks).toBe(Math.ceil(10 / 0.7));
      expect(classifyGoalReview(100, 105, 0.25).estimatedWeeks).toBe(20);
    });

    it('returns null weeks for a zero/absent delta or non-positive rate', () => {
      expect(classifyGoalReview(100, 100, 0.5).estimatedWeeks).toBeNull();
      expect(classifyGoalReview(100, 90, 0).estimatedWeeks).toBeNull();
    });
  });
});

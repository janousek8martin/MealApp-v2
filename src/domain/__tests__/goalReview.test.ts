import { classifyGoalReview } from '../goalReview';

describe('classifyGoalReview', () => {
  it('classifies a 5% change as realistic', () => {
    expect(classifyGoalReview(100, 95)).toBe('realistic');
  });

  it('classifies exactly 10% as realistic (inclusive boundary)', () => {
    expect(classifyGoalReview(100, 90)).toBe('realistic');
  });

  it('classifies just over 10% as ambitious', () => {
    expect(classifyGoalReview(100, 89.9)).toBe('ambitious');
  });

  it('classifies exactly 20% as ambitious (inclusive boundary)', () => {
    expect(classifyGoalReview(100, 80)).toBe('ambitious');
  });

  it('classifies just over 20% as challenging', () => {
    expect(classifyGoalReview(100, 79.9)).toBe('challenging');
  });

  it('treats weight gain symmetrically to weight loss', () => {
    expect(classifyGoalReview(100, 115)).toBe('ambitious');
    expect(classifyGoalReview(100, 105)).toBe('realistic');
  });
});

export type ProfileType = 'adult' | 'child';

export interface CompositionCounts {
  adults: number;
  children: number;
}

export interface CompositionCheckResult extends CompositionCounts {
  matches: boolean;
}

/**
 * Compares the profile types actually created in the wizard against the
 * adults/children counts chosen in the composition step. A mismatch happens
 * when the user goes back to composition mid-wizard and changes the split.
 */
export function checkCompositionMatch(
  createdTypes: ProfileType[],
  planned: CompositionCounts,
): CompositionCheckResult {
  const adults = createdTypes.filter((type) => type === 'adult').length;
  const children = createdTypes.filter((type) => type === 'child').length;
  return { adults, children, matches: adults === planned.adults && children === planned.children };
}

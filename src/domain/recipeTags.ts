import { normalizeForMatch } from './recipeImport';

export type TagMatchCandidate = { tag: string; label: string };

/** Substring matches shorter than this are too noisy to suggest (e.g. "no" would match half the list). */
const MIN_SUBSTRING_MATCH_LEN = 3;

/**
 * Finds an existing tag (fixed RECIPE_TAG_KEYS translation or another
 * recipe's custom tag) whose normalized form matches the typed input closely
 * enough to suggest "did you mean X?" instead of silently creating a
 * near-duplicate custom tag (e.g. "bezmasé" vs "bez masa"). Exact
 * normalized matches win outright; otherwise a substring match on either
 * side is accepted, but only past a minimum length to avoid noisy short
 * matches. Returns null when nothing is close enough - the caller then
 * creates a new tag with no prompt.
 */
export function findSimilarTag(input: string, candidates: TagMatchCandidate[]): TagMatchCandidate | null {
  const normalizedInput = normalizeForMatch(input);
  if (!normalizedInput) return null;

  for (const candidate of candidates) {
    if (normalizeForMatch(candidate.label) === normalizedInput) return candidate;
  }

  if (normalizedInput.length < MIN_SUBSTRING_MATCH_LEN) return null;
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeForMatch(candidate.label);
    if (normalizedCandidate.length < MIN_SUBSTRING_MATCH_LEN) continue;
    if (normalizedCandidate.includes(normalizedInput) || normalizedInput.includes(normalizedCandidate)) {
      return candidate;
    }
  }
  return null;
}

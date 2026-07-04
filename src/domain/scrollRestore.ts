/**
 * Decides whether a tab screen should restore its previous scroll offset on
 * re-focus (vs. resetting to the top). True only when the user opted in and
 * came back within the configured timeout of leaving.
 */
export function shouldRestoreScroll(params: {
  enabled: boolean;
  leftAt: number | null;
  now: number;
  timeoutSec: number;
}): boolean {
  const { enabled, leftAt, now, timeoutSec } = params;
  if (!enabled || leftAt === null) return false;
  return now - leftAt < timeoutSec * 1000;
}

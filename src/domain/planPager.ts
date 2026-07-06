import { addDays } from './week';

export type PagerTransition = { date: string; dir: 1 | -1 };

/** Which way the day pager should slide to get from one ISO date to another. */
export function jumpDirection(from: string, to: string): 1 | -1 | 0 {
  if (to > from) return 1;
  if (to < from) return -1;
  return 0;
}

/**
 * The three dates rendered by the day pager: [left, middle, right]. Idle it's
 * the selected day flanked by its neighbours; during a programmatic jump the
 * pane on the jump side renders the target date instead, so the incoming
 * content is real from the first frame of the slide.
 */
export function paneDates(selected: string, override?: PagerTransition): [string, string, string] {
  let left = addDays(selected, -1);
  let right = addDays(selected, 1);
  if (override && override.date !== selected) {
    if (override.dir === 1) right = override.date;
    else left = override.date;
  }
  return [left, selected, right];
}

/** Week arrows jump to the same weekday one week away, not the week's Monday. */
export function weekJumpTarget(selected: string, delta: 1 | -1): string {
  return addDays(selected, delta * 7);
}

import type { TFunction } from 'i18next';

/** A slot's display name - the built-in 5 slots use their `slots.${slotKey}` translation (label is null for them); any slot inserted via "+ Add meal" carries its own label instead. */
export function slotDisplayLabel(t: TFunction, slot: { slotKey: string; label: string | null }): string {
  return slot.label ?? t(`slots.${slot.slotKey}`);
}

export type MacroOverrides = {
  proteinPerKgLbm?: number;
  surplusKcal?: number;
  fatShareOfTdci?: number;
};

/** A per-day override wins per-field; the profile-wide override fills any gaps it leaves. */
export function mergeMacroOverrides(
  profileWide: MacroOverrides,
  dayOverride: MacroOverrides | undefined,
): MacroOverrides {
  if (!dayOverride) return profileWide;
  return {
    proteinPerKgLbm: dayOverride.proteinPerKgLbm ?? profileWide.proteinPerKgLbm,
    surplusKcal: dayOverride.surplusKcal ?? profileWide.surplusKcal,
    fatShareOfTdci: dayOverride.fatShareOfTdci ?? profileWide.fatShareOfTdci,
  };
}

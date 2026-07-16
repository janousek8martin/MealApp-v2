# Second Feedback Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 8 queued UI/UX items from the user's second feedback batch: water unit setting, kitchen-units removal, compact Plan-screen buttons, pantry prefill, Home meal-plan-section removal, compact blue water card, a diet radio-list, and tap-to-open streak detail modals.

**Architecture:** Each item is scoped to its own file boundary (component/repo/domain) and lands as its own commit. Two foundational tasks (a new `colors.water` theme token, and ml↔fl-oz conversion helpers) are built first since two later tasks depend on them. No new native dependencies.

**Tech Stack:** React Native + Expo Router, Drizzle ORM + expo-sqlite/better-sqlite3, react-i18next, Jest (pure domain/repo-logic tests only — no React Native Testing Library in this codebase).

## Global Constraints

- Amounts are always stored in canonical units (ml for water, grams for food) — unit-system toggles are presentation-only, matching the existing `kitchenUnitDisplayMode`/`formatAmount` convention.
- Every new i18n key must be added to **both** `src/i18n/locales/en.json` and `src/i18n/locales/cs.json` — `src/i18n/__tests__/locales.test.ts` asserts exact key parity between the two files and will fail the build if one is missed.
- `npx tsc --noEmit` and `npx jest` must both be clean after every task.
- Do not use `db.transaction()` — this codebase's dual driver setup (`better-sqlite3` for tests, `expo-sqlite` for production) makes it unusable: `better-sqlite3` throws if the transaction callback is `async`/returns a Promise, while `expo-sqlite` requires genuinely async operations. This was tested and confirmed earlier in the session; don't re-attempt it.
- **Known pre-existing gap, not to be fixed in this plan:** of the 11 `MANUAL_DIET_KEYS` (`src/constants/options.ts`), only `vegetarian`/`vegan` have any seed food actually tagged with them (`src/db/seed/foods.ts`). Selecting any other manual diet (including the new `mediterranean` key this plan adds) as a *required* diet currently returns zero generator candidates until a user tags foods with it via `food/edit.tsx`'s existing diet-flag chips. This plan does not add seed-food tagging — it's a pre-existing, out-of-scope content gap.

---

### Task 1: `colors.water` theme token

**Files:**
- Modify: `src/theme/tokens.ts:8-31` (`ColorTokens` type), `:33-53` (`lightColors`), `:55-75` (`darkColors`)

**Interfaces:**
- Produces: `ColorTokens.water: string` — consumed by Task 5 (`WaterCard.tsx`).

- [ ] **Step 1: Add the field to the type and both palettes**

In `src/theme/tokens.ts`, add `water: string;` to the `ColorTokens` type right after `secondaryLight`:

```ts
export type ColorTokens = {
  background: string;
  heroGradientStart: string;
  heroGradientEnd: string;
  primary: string;
  primaryLight: string;
  onPrimary: string;
  /** Secondary (violet) accent – decorative highlights, charts, alt CTAs. */
  secondary: string;
  secondaryLight: string;
  /** Water/hydration accent (sky blue) – used by WaterCard, distinct from the green primary. */
  water: string;
  success: string;
  /** Kept for API compatibility with older call sites; same as `success`. */
  teal: string;
  mint: string;
  lime: string;
  tealTint: string;
  danger: string;
  text: string;
  textSecondary: string;
  border: string;
  surface: string;
  /** A second, slightly-raised surface for nested cards / rows. */
  surfaceAlt: string;
};
```

Add to `lightColors` right after `secondaryLight: '#8B5CF6',`:

```ts
  water: '#0EA5E9',
```

Add to `darkColors` right after `secondaryLight: '#C4B5FD',`:

```ts
  water: '#38BDF8',
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/theme/tokens.ts
git commit -m "feat: add water (blue) theme token"
```

---

### Task 2: ml ↔ fl oz conversion helpers

**Files:**
- Modify: `src/domain/units.ts` (add exports near the existing `mlToUsCups`/`usCupsToMl` pair, ~line 37-43)
- Test: `src/domain/__tests__/units.test.ts`

**Interfaces:**
- Consumes: `KITCHEN_VOLUME_ML.fl_oz` (already exported from `src/domain/units.ts`, value `29.5735`).
- Produces: `export function mlToFlOz(ml: number): number` and `export function flOzToMl(flOz: number): number` — consumed by Task 3 (`WaterSettingsCard.tsx`) and Task 5 (`WaterCard.tsx`).

- [ ] **Step 1: Write the failing test**

Add to `src/domain/__tests__/units.test.ts` (find the existing `describe('mlToUsCups'` block for the file's setup pattern and add a new `describe` after it):

```ts
describe('mlToFlOz / flOzToMl', () => {
  it('converts 1000 ml to about 33.81 fl oz', () => {
    expect(mlToFlOz(1000)).toBeCloseTo(33.814, 2);
  });

  it('round-trips cleanly', () => {
    expect(flOzToMl(mlToFlOz(750))).toBeCloseTo(750, 5);
  });
});
```

Add `mlToFlOz, flOzToMl` to the existing `import { ... } from '../units'` line at the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/domain/__tests__/units.test.ts`
Expected: FAIL — `mlToFlOz is not a function`.

- [ ] **Step 3: Implement**

In `src/domain/units.ts`, add right after the existing `usCupsToMl` function:

```ts
export function mlToFlOz(ml: number): number {
  return ml / KITCHEN_VOLUME_ML.fl_oz;
}

export function flOzToMl(flOz: number): number {
  return flOz * KITCHEN_VOLUME_ML.fl_oz;
}
```

`KITCHEN_VOLUME_ML` is declared further down in the same file (~line 87) — since this is all one module, forward-reference within the file is fine at call time (both are plain function declarations, not immediately-invoked), but to keep the file's existing top-to-bottom readability, move these two new functions to directly *after* the `KITCHEN_VOLUME_ML` constant's declaration block instead (i.e., after the closing `};` of `export const KITCHEN_VOLUME_ML = { ... }`), not before it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/domain/__tests__/units.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/units.ts src/domain/__tests__/units.test.ts
git commit -m "feat: ml/fl-oz conversion helpers for water unit display"
```

---

### Task 3: Water unit setting — `WaterSettingsCard`

**Files:**
- Modify: `src/components/WaterSettingsCard.tsx` (full rewrite of the goal/glass display logic)
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json`

**Interfaces:**
- Consumes: `mlToFlOz`/`flOzToMl` from `@/domain/units` (Task 2).
- Produces: `WaterSettingsCard`'s `Props` gains `unitSystem: 'metric' | 'us'` — consumed by Task 4's callers (`settings.tsx`, `WaterCard.tsx`'s embedded modal).

- [ ] **Step 1: Add i18n keys**

In `en.json`, inside `settings`, add (find `"waterGoalOverride"` and add these next to it):

```json
"waterUnitFlOz": "fl oz",
```

In `cs.json`, inside `settings`:

```json
"waterUnitFlOz": "fl oz",
```

(No translation needed — "fl oz" is used as-is in both locales, same as how "ml" is already hardcoded as a literal suffix rather than a translated string elsewhere in this file.)

- [ ] **Step 2: Rewrite the component**

Replace the full contents of `src/components/WaterSettingsCard.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { SwitchRow } from '@/components/ui/SwitchRow';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { updateProfileWaterSettings } from '@/db/repositories/profiles';
import { DEFAULT_GLASS_ML } from '@/domain/water';
import { flOzToMl, mlToFlOz } from '@/domain/units';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  profileId: string;
  trackWater: boolean;
  /** null = auto-computed from weight/sex. */
  waterGoalMl: number | null;
  /** null = the 250 ml default. */
  waterGlassMl: number | null;
  /** 'us' displays/accepts fl oz; amounts are still always stored in ml. */
  unitSystem: 'metric' | 'us';
};

function parseNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

/** Displays/parses a stored-ml value in the household's unit system - metric shows ml as-is, US converts to/from fl oz. */
function toDisplay(ml: number, unitSystem: 'metric' | 'us'): number {
  return unitSystem === 'us' ? mlToFlOz(ml) : ml;
}
function fromDisplay(value: number, unitSystem: 'metric' | 'us'): number {
  return unitSystem === 'us' ? flOzToMl(value) : value;
}

/** Per-profile water settings: tracking toggle, optional daily-goal override, and the size of one logged serving ("glass"). */
export function WaterSettingsCard({ profileId, trackWater, waterGoalMl, waterGlassMl, unitSystem }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const unitSuffix = unitSystem === 'us' ? t('settings.waterUnitFlOz') : 'ml';
  const [goalText, setGoalText] = useState(
    waterGoalMl !== null ? String(Math.round(toDisplay(waterGoalMl, unitSystem) * 10) / 10) : '',
  );
  const [glassText, setGlassText] = useState(
    waterGlassMl !== null ? String(Math.round(toDisplay(waterGlassMl, unitSystem) * 10) / 10) : '',
  );

  const save = (patch: Partial<{ trackWater: boolean; waterGoalMl: number | null; waterGlassMl: number | null }>) => {
    void updateProfileWaterSettings(db, profileId, {
      trackWater,
      waterGoalMl,
      waterGlassMl,
      ...patch,
    });
  };

  return (
    <>
      <SwitchRow label={t('water.toggle')} value={trackWater} onChange={(value) => save({ trackWater: value })} />
      <TextField
        label={t('settings.waterGoalOverride')}
        value={goalText}
        onChangeText={(text) => {
          setGoalText(text);
          const parsed = parseNumber(text);
          save({ waterGoalMl: parsed !== null ? fromDisplay(parsed, unitSystem) : null });
        }}
        keyboardType="decimal-pad"
        suffix={unitSuffix}
        placeholder={t('settings.waterGoalAuto')}
      />
      <TextField
        label={t('settings.waterGlassSize')}
        value={glassText}
        onChangeText={(text) => {
          setGlassText(text);
          const parsed = parseNumber(text);
          save({ waterGlassMl: parsed !== null ? fromDisplay(parsed, unitSystem) : null });
        }}
        keyboardType="decimal-pad"
        suffix={unitSuffix}
        placeholder={String(Math.round(toDisplay(DEFAULT_GLASS_ML, unitSystem)))}
      />
      <Text style={styles.hint}>{t('water.hint')}</Text>
    </>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    hint: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: -spacing.sm,
    },
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors at every call site missing the new required `unitSystem` prop — this is expected and gets fixed in Task 4. Confirm the *only* errors are about `unitSystem` being required on `WaterSettingsCard` call sites (in `settings.tsx` and `WaterCard.tsx`), nothing else.

- [ ] **Step 4: Commit**

```bash
git add src/components/WaterSettingsCard.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: water goal/glass size respect metric vs US unit system"
```

---

### Task 4: Thread `unitSystem` into `WaterSettingsCard`'s call sites

**Files:**
- Modify: `src/app/(tabs)/settings.tsx` (the `<WaterSettingsCard>` call site inside the per-profile settings section)
- Modify: `src/components/WaterCard.tsx` (its embedded `<WaterSettingsCard>` inside the settings modal)

**Interfaces:**
- Consumes: `WaterSettingsCard`'s new `unitSystem` prop (Task 3).

- [ ] **Step 1: Fix the `settings.tsx` call site**

Run `grep -n "<WaterSettingsCard" src/app/\(tabs\)/settings.tsx` to find the exact call site (per the plan's research, it's inside `ProfileSections`, which already has access to `settings.unitSystem` via the `useHouseholdSettings` hook already in scope for the general-settings accordion). Add `unitSystem={settings.unitSystem}` as a new prop on that call:

```tsx
<WaterSettingsCard
  profileId={profile.id}
  trackWater={profile.trackWater}
  waterGoalMl={profile.waterGoalMl}
  waterGlassMl={profile.waterGlassMl}
  unitSystem={settings.unitSystem}
/>
```

(Match the exact existing prop names/values already there — only add the new `unitSystem` line.)

- [ ] **Step 2: `WaterCard.tsx` needs `unitSystem` threaded in from its own caller first**

`WaterCard`'s `Props` type (`src/components/WaterCard.tsx:22-31`) gets a new field:

```ts
type Props = {
  profileId: string;
  sex: 'male' | 'female';
  weightKg: number;
  trackWater: boolean;
  /** Explicit override; falls back to the weight-based domain default. */
  waterGoalMl: number | null;
  /** Size of one logged serving; falls back to DEFAULT_GLASS_ML. */
  waterGlassMl: number | null;
  /** 'us' displays fl oz throughout; amounts are always stored in ml. */
  unitSystem: 'metric' | 'us';
};
```

And its function signature:

```ts
export function WaterCard({ profileId, sex, weightKg, trackWater, waterGoalMl, waterGlassMl, unitSystem }: Props) {
```

Its embedded `<WaterSettingsCard>` call (inside the `<Modal>`, ~line 144-149) gets the new prop:

```tsx
<WaterSettingsCard
  profileId={profileId}
  trackWater={trackWater}
  waterGoalMl={waterGoalMl}
  waterGlassMl={waterGlassMl}
  unitSystem={unitSystem}
/>
```

- [ ] **Step 3: Thread it from `WaterCard`'s own caller in `index.tsx`**

In `src/app/(tabs)/index.tsx`, add `useHouseholdSettings` to the existing `@/hooks/data` import (it's already imported for `useHousehold`/`useActiveProfile`/etc. — add `useHouseholdSettings` to that same import line), then add a hook call near the other data hooks (after `const { household } = useHousehold();`):

```ts
const settings = useHouseholdSettings(household?.id);
```

Then update the `<WaterCard>` call site (~line 196-204) to pass it:

```tsx
{activeProfile?.trackWater && latestMetric && settings ? (
  <WaterCard
    profileId={activeProfile.id}
    sex={activeProfile.sex}
    weightKg={latestMetric.weightKg}
    trackWater={activeProfile.trackWater}
    waterGoalMl={activeProfile.waterGoalMl}
    waterGlassMl={activeProfile.waterGlassMl}
    unitSystem={settings.unitSystem}
  />
) : null}
```

(Added `&& settings` to the existing guard condition, since `useHouseholdSettings` can return `undefined` before the household's settings row loads.)

Check `useHouseholdSettings`'s actual return type via `grep -n "export function useHouseholdSettings" src/hooks/data.ts` to confirm it returns `HouseholdSettings | undefined` (not a wrapped object) before finalizing this — if it returns something structured differently (e.g. `{ settings }`), adjust the destructuring accordingly to match its real shape.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Full test suite**

Run: `npx jest`
Expected: all pass (no repo/domain logic changed in this task, purely prop threading).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(tabs)/settings.tsx" "src/app/(tabs)/index.tsx" src/components/WaterCard.tsx
git commit -m "feat: thread household unit system into water settings"
```

---

### Task 5: `WaterCard` compact + blue redesign

**Files:**
- Modify: `src/components/WaterCard.tsx`

**Interfaces:**
- Consumes: `colors.water` (Task 1), `mlToFlOz` (Task 2, for the per-serving label when `unitSystem === 'us'`).

- [ ] **Step 1: Drop the numeric ml/goal header text, keep percent as the primary indicator**

In `WaterCard.tsx`'s `headerRow` JSX (~lines 86-92), remove the `amountText` `<Text>` entirely:

```tsx
<View style={styles.headerRow}>
  <Ionicons name="water" size={16} color={colors.water} />
  <Text style={styles.title}>{t('water.cardTitle')}</Text>
  <Pressable accessibilityRole="button" accessibilityLabel={t('water.settingsLink')} onPress={() => setSettingsVisible(true)} hitSlop={8}>
    <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
  </Pressable>
</View>
```

This both drops the `{totalMl}/{goalMl} ml` text and moves the settings entry point up into the header (a gear icon) — remove the old bottom `settingsLink` `Pressable` block (~lines 128-131) entirely, since it's now redundant with the header gear icon.

- [ ] **Step 2: Switch wave/tank/icon colors from `colors.primary` to `colors.water`**

In the wave `<Path>` (line 99): change `fill={colors.primary}` to `fill={colors.water}`.

In `styles.waterBody` (line 217): change `backgroundColor: colors.primary` to `backgroundColor: colors.water`.

In the `-`/`+` glass buttons and the water-drop/cup icons, change every `color={colors.primary}` to `color={colors.water}`: the `-` button icon (line 114), the cup icon (line 117), and `styles.glassButtonPrimary`'s `backgroundColor`/`borderColor` (lines 244-245) from `colors.primary` to `colors.water`. The `+` button's icon stays `color={colors.onPrimary}` (line 125, unchanged — it's already theme-neutral white/dark text-on-fill, which still reads correctly against the new blue fill).

- [ ] **Step 3: Show the per-serving amount in the active unit**

The `glassIconLabel` text (line 118) currently always shows `{Math.round(glassMl)} ml`. `WaterCard` doesn't have `unitSystem` context for pure display conversion beyond what Task 4 already threaded in as a prop — reuse it:

```tsx
<Text style={styles.glassIconLabel}>
  {unitSystem === 'us' ? `${Math.round(mlToFlOz(glassMl) * 10) / 10} fl oz` : `${Math.round(glassMl)} ml`}
</Text>
```

Add `import { mlToFlOz } from '@/domain/units';` to the top of the file.

- [ ] **Step 4: Remove the now-orphaned `settingsLink`/`settingsLinkLabel` styles**

Delete the `settingsLink` and `settingsLinkLabel` entries from `createStyles` (they're no longer referenced after Step 1's JSX change).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Full test suite**

Run: `npx jest`
Expected: all pass (this task only touches JSX/styles, no domain/repo logic).

- [ ] **Step 7: On-device verify**

Boot the emulator (`adb devices` to confirm one is running; if not, launch per the project's established `emulator -avd mealapp_test -gpu swiftshader_indirect` + `adb reverse tcp:8081 tcp:8081` + reload flow), navigate to Home, confirm: the water card's wave/tank/+button/icons are blue (not green), the numeric ml/goal text is gone from the header, a gear icon sits in the header, tapping it still opens the same settings sheet, and the per-serving label still shows a sane number.

- [ ] **Step 8: Commit**

```bash
git add src/components/WaterCard.tsx
git commit -m "feat: compact blue water card - drop numeric header, gear-icon settings"
```

---

### Task 6: Remove the kitchen-units subsystem

**Files:**
- Modify: `src/app/(tabs)/settings.tsx` (remove the button + display-mode chip + modal wiring + now-dead state)
- Modify: `src/app/recipe/[id].tsx` (remove the kitchen-equivalent display branch, always show grams)
- Modify: `src/db/repositories/units.ts` (remove `createCustomKitchenUnit`/`updateCustomKitchenUnit`/`deleteCustomKitchenUnit`, keep every other export)
- Modify: `src/hooks/data.ts` (remove `useHouseholdCustomUnits`)
- Modify: `src/db/__tests__/units.test.ts` (remove tests for the deleted repo functions; update the "defaults to hybrid" assertion)
- Delete: `src/components/KitchenUnitsModal.tsx`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json` (remove now-orphaned keys)

**Interfaces:**
- None produced — this task only removes UI surface. The `household_custom_units` DB table and `kitchenUnitDisplayMode` schema column are deliberately left in place (unused/orphaned) rather than dropped, per this codebase's existing precedent for low-priority dead columns (see the 2026-07 audit's D2 finding) — writing a `DROP COLUMN`/`DROP TABLE` migration is a bigger, riskier change than this batch calls for.

- [ ] **Step 1: Remove the button, chip, and modal wiring from `settings.tsx`**

Delete the entire block quoted in this plan's research (the `<Pressable style={styles.kitchenUnitsRow}>` row opening `KitchenUnitsModal`, and the `<ChipSelect label={t('settings.kitchenUnitDisplayMode')}>` block right after it) from the `settings.general` `AccordionCard`. The accordion should go straight from the `settings.units` (metric/US) `ChipSelect` to the `settings.language` `ChipSelect`.

Remove the `<KitchenUnitsModal visible={kitchenUnitsVisible} onClose={...} householdId={household.id} />` render at the bottom of the file (~lines 821-825).

Remove the `kitchenUnitsVisible` state declaration (~line 611) and its `setKitchenUnitsVisible` setter.

Remove the `import { KitchenUnitsModal } from '@/components/KitchenUnitsModal';` import line.

- [ ] **Step 2: Simplify `recipe/[id].tsx` to always show plain grams**

Replace:

```ts
const unitDisplayMode = householdSettings?.kitchenUnitDisplayMode ?? 'hybrid';
const showKitchenEquivalent = unitDisplayMode === 'hybrid' || unitDisplayMode === 'kitchen';
```

Find every use of `showKitchenEquivalent` further down in this file (`grep -n "showKitchenEquivalent" src/app/recipe/\[id\].tsx`) and remove the conditional branch that renders the kitchen-measure text, keeping only the plain-grams rendering path. Delete the two lines above once `showKitchenEquivalent` has no remaining references.

- [ ] **Step 3: Delete the modal component**

```bash
rm src/components/KitchenUnitsModal.tsx
```

- [ ] **Step 4: Remove the now-unused repo functions**

In `src/db/repositories/units.ts`, delete `createCustomKitchenUnit`, `updateCustomKitchenUnit`, and `deleteCustomKitchenUnit` (and their exported input types, e.g. `CreateCustomKitchenUnitInput`, if not used elsewhere — confirm with `grep -rn "CreateCustomKitchenUnitInput\|createCustomKitchenUnit\|updateCustomKitchenUnit\|deleteCustomKitchenUnit" src/` first that `KitchenUnitsModal.tsx` was their only consumer besides the test file). Keep every other export in this file (`ouncesToGrams`, `poundsToGrams`, and anything else used by `units.ts`'s other consumers like the water-unit work in Tasks 2-5).

- [ ] **Step 5: Remove the now-unused hook**

In `src/hooks/data.ts`, delete `useHouseholdCustomUnits` and its import of `householdCustomUnits` from the schema (only if nothing else in this file's import list needs `householdCustomUnits` — confirm with a grep first).

- [ ] **Step 6: Update the test file**

In `src/db/__tests__/units.test.ts`: remove every `describe`/`it` block that exercises `createCustomKitchenUnit`/`updateCustomKitchenUnit`/`deleteCustomKitchenUnit` (and remove those three names from the file's import line). Find the `it('defaults to hybrid', ...)` test (asserting `settings.kitchenUnitDisplayMode).toBe('hybrid')`) — since the schema's `.default('hybrid')` is untouched (Step-0 constraint: no migration), this assertion is still factually true and can stay as-is, just rename the test description if it now reads oddly next to the removed UI (e.g. `it('kitchenUnitDisplayMode still defaults to hybrid at the schema level (UI removed, column untouched)', ...)`).

- [ ] **Step 7: Remove orphaned i18n keys**

In both `en.json` and `cs.json`, remove: `settings.kitchenUnits`, `settings.kitchenUnitDisplayMode`, `settings.kitchenUnitDisplayGrams`, `settings.kitchenUnitDisplayHybrid`, `settings.kitchenUnitDisplayKitchen`. Grep first (`grep -rn "kitchenUnitDisplay\|settings.kitchenUnits" src/ --include=*.tsx --include=*.ts`) to confirm none of these keys are referenced anywhere else in the codebase before deleting — the locale-parity test will catch a mismatch between the two files, but not a key that's still referenced from code after being deleted from JSON (that would show up as a missing-translation warning at runtime instead, so the grep is the real safety check here).

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (in particular, no "unused import" issues if this codebase's tsconfig has `noUnusedLocals` on — check `tsconfig.json` and remove any leftover unused imports the deletions surfaced).

- [ ] **Step 9: Full test suite**

Run: `npx jest`
Expected: all pass, including `src/i18n/__tests__/locales.test.ts` (confirms the removed keys were deleted from both locale files symmetrically).

- [ ] **Step 10: On-device verify**

Navigate to Settings → General: confirm the Kitchen units button and its display-mode chip are gone, the Metric/US chip is untouched and still works. Open a recipe with ingredients that previously showed a kitchen-measure equivalent (e.g. one with `gramsPerCup` data, like oats or rice) — confirm it now shows plain grams only, with no crash.

- [ ] **Step 11: Commit**

```bash
git add "src/app/(tabs)/settings.tsx" "src/app/recipe/[id].tsx" src/db/repositories/units.ts src/hooks/data.ts src/db/__tests__/units.test.ts src/i18n/locales/en.json src/i18n/locales/cs.json
git rm src/components/KitchenUnitsModal.tsx
git commit -m "feat: remove kitchen-units button, display-mode setting, and custom-unit editor"
```

---

### Task 7: Compact Plan-screen action buttons

**Files:**
- Modify: `src/components/ui/Button.tsx` (add a `size` prop)
- Modify: `src/app/(tabs)/plan.tsx` (apply `size="compact"` to the 3 footer buttons)

**Interfaces:**
- Produces: `Button`'s `Props` gains `size?: 'default' | 'compact'` (default `'default'`, fully backward-compatible — every other `Button` call site in the app is unaffected).

- [ ] **Step 1: Add the `size` prop to `Button.tsx`**

Replace the full contents of `src/components/ui/Button.tsx`:

```tsx
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  /** 'compact' shrinks padding and font size for dense rows (e.g. Plan screen's footer). Defaults to 'default'. */
  size?: 'default' | 'compact';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'primary', size = 'default', disabled, style }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        size === 'compact' && styles.compact,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <Text
        style={[
          styles.label,
          size === 'compact' && styles.labelCompact,
          variant === 'primary' ? styles.labelOnPrimary : styles.labelOnLight,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    base: {
      borderRadius: radius.input,
      paddingVertical: spacing.md - 2,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compact: {
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
    },
    primary: {
      backgroundColor: colors.primary,
    },
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    disabled: {
      opacity: 0.45,
    },
    pressed: {
      opacity: 0.85,
    },
    label: {
      fontSize: typography.body,
      fontWeight: '600',
    },
    labelCompact: {
      fontSize: typography.small,
    },
    labelOnPrimary: {
      color: colors.onPrimary,
    },
    labelOnLight: {
      color: colors.primary,
    },
  });
}
```

- [ ] **Step 2: Apply `size="compact"` to the 3 Plan-screen buttons**

In `src/app/(tabs)/plan.tsx`, add `size="compact"` to each of the 3 `<Button>` calls in the footer block (the "Generate week", "Generate day", and "Copy yesterday" buttons quoted in this plan's research, ~lines 481-511) — one line added per `<Button>`, no other prop changes:

```tsx
<Button
  label={generating === 'week' ? t('today.generating') : t('planScreen.generateWeek')}
  variant="secondary"
  size="compact"
  onPress={generateWeekAction}
  disabled={generating !== null || copyingYesterday}
  style={styles.actionButton}
/>
```

(Repeat the same `size="compact"` addition for the "Generate day" and "Copy yesterday" `<Button>`s in that same block.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Full test suite**

Run: `npx jest`
Expected: all pass.

- [ ] **Step 5: On-device verify**

Navigate to Plan screen: confirm the 3 footer buttons are visibly smaller/more compact than before, still legible, still functional (tap each and confirm the existing generate/copy behavior still works). Spot-check 2-3 other screens using `<Button>` (e.g. Settings' "Save" button, a modal's confirm button) to confirm they're completely unaffected (still full-size, since they didn't get `size="compact"`).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Button.tsx "src/app/(tabs)/plan.tsx"
git commit -m "feat: add compact Button size, apply to Plan screen's footer actions"
```

---

### Task 8: Pantry prefill-staples domain + repo

**Files:**
- Create: `src/domain/pantryStaples.ts`
- Modify: `src/db/repositories/shopping.ts` (add `prefillPantryStaples`)
- Test: `src/domain/__tests__/pantryStaples.test.ts`, `src/db/__tests__/shopping.test.ts`

**Interfaces:**
- Produces (domain): `export const PANTRY_STAPLE_SEED_KEYS: { seedKey: string; quantity: number }[]` — a curated list of common staple foods (by their seed `seedKey`) with a sensible default pantry quantity in the food's own base unit.
- Produces (repo): `export async function prefillPantryStaples(db: AppDb, householdId: string): Promise<{ added: number; alreadyPresent: number }>` — consumed by Task 9 (`pantry.tsx`).
- Consumes: `addPantryItem` (already exported from `src/db/repositories/shopping.ts`), `foods`/`pantryItems` schema tables.

- [ ] **Step 1: Write the staples list**

Create `src/domain/pantryStaples.ts`:

```ts
/**
 * Curated list of common household staple foods for the pantry's "Prefill
 * pantry" button, matched by the seed database's stable `seedKey` (see
 * src/db/seed/foods.ts). Quantities are in the food's own base unit (g for
 * solids, ml for liquids) and are deliberately generous "you probably have
 * about this much" defaults, not precise measurements - the user edits/
 * removes individual pantry rows afterward like any other pantry item.
 */
export const PANTRY_STAPLE_SEED_KEYS: { seedKey: string; quantity: number }[] = [
  { seedKey: 'olive_oil', quantity: 500 },
  { seedKey: 'onion', quantity: 500 },
  { seedKey: 'garlic', quantity: 100 },
  { seedKey: 'egg', quantity: 10 },
  { seedKey: 'milk_semi', quantity: 1000 },
  { seedKey: 'butter', quantity: 250 },
  { seedKey: 'rice_white_dry', quantity: 1000 },
  { seedKey: 'pasta_dry', quantity: 500 },
  { seedKey: 'oats', quantity: 500 },
  { seedKey: 'potatoes', quantity: 1500 },
  { seedKey: 'lentils_dry', quantity: 500 },
  { seedKey: 'tomato', quantity: 500 },
  { seedKey: 'bread_wholegrain', quantity: 500 },
  { seedKey: 'greek_yogurt', quantity: 500 },
  { seedKey: 'cheese_edam', quantity: 200 },
];
```

- [ ] **Step 2: Write the failing repo test**

Add to `src/db/__tests__/shopping.test.ts` (check the file's existing `createHouseholdWithDefaults`/`upsertFood` setup pattern used elsewhere in this file and match it):

```ts
import { prefillPantryStaples } from '../repositories/shopping';
import { PANTRY_STAPLE_SEED_KEYS } from '../../domain/pantryStaples';

describe('prefillPantryStaples', () => {
  it('adds a pantry row for every staple that has a matching seed food and none already in the pantry', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await seedIfEmpty(db);

    const result = await prefillPantryStaples(db, householdId);

    expect(result.added).toBe(PANTRY_STAPLE_SEED_KEYS.length);
    expect(result.alreadyPresent).toBe(0);

    const rows = await db.select().from(pantryItems).where(eq(pantryItems.householdId, householdId));
    expect(rows.length).toBe(PANTRY_STAPLE_SEED_KEYS.length);
  });

  it('skips staples already present in the pantry instead of duplicating them', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await seedIfEmpty(db);

    await prefillPantryStaples(db, householdId);
    const secondRun = await prefillPantryStaples(db, householdId);

    expect(secondRun.added).toBe(0);
    expect(secondRun.alreadyPresent).toBe(PANTRY_STAPLE_SEED_KEYS.length);

    const rows = await db.select().from(pantryItems).where(eq(pantryItems.householdId, householdId));
    expect(rows.length).toBe(PANTRY_STAPLE_SEED_KEYS.length);
  });
});
```

Check the top of `shopping.test.ts` for its existing imports (`createTestDb`, `createHouseholdWithDefaults`, `seedIfEmpty`, `eq`, `pantryItems` schema) and add only what's missing from that list rather than re-importing what's already there.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/db/__tests__/shopping.test.ts`
Expected: FAIL — `prefillPantryStaples is not a function`.

- [ ] **Step 4: Implement**

In `src/db/repositories/shopping.ts`, add near `addPantryItem`:

```ts
export async function prefillPantryStaples(db: AppDb, householdId: string): Promise<{ added: number; alreadyPresent: number }> {
  const existing = await db
    .select()
    .from(pantryItems)
    .where(and(eq(pantryItems.householdId, householdId), isNull(pantryItems.deletedAt)));
  const existingFoodIds = new Set(existing.map((row) => row.foodId));

  let added = 0;
  let alreadyPresent = 0;
  for (const staple of PANTRY_STAPLE_SEED_KEYS) {
    const [food] = await db.select().from(foods).where(eq(foods.seedKey, staple.seedKey));
    if (!food) continue; // staple has no matching seed food in this DB - skip silently, not an error
    if (existingFoodIds.has(food.id)) {
      alreadyPresent++;
      continue;
    }
    await addPantryItem(db, householdId, { foodId: food.id, quantity: staple.quantity });
    added++;
  }
  return { added, alreadyPresent };
}
```

Add the import `import { PANTRY_STAPLE_SEED_KEYS } from '@/domain/pantryStaples';` to the top of `shopping.ts` (check the file's existing import style — relative vs `@/` alias — and match it; other repo files in this codebase use `@/domain/...` per earlier tasks this session, so use that form unless `shopping.ts` specifically uses relative domain imports elsewhere).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/db/__tests__/shopping.test.ts`
Expected: PASS.

- [ ] **Step 6: Write and run the domain test**

Create `src/domain/__tests__/pantryStaples.test.ts`:

```ts
import { PANTRY_STAPLE_SEED_KEYS } from '../pantryStaples';

describe('PANTRY_STAPLE_SEED_KEYS', () => {
  it('has no duplicate seed keys', () => {
    const keys = PANTRY_STAPLE_SEED_KEYS.map((s) => s.seedKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every quantity is positive', () => {
    for (const staple of PANTRY_STAPLE_SEED_KEYS) {
      expect(staple.quantity).toBeGreaterThan(0);
    }
  });
});
```

Run: `npx jest src/domain/__tests__/pantryStaples.test.ts`
Expected: PASS.

- [ ] **Step 7: Full test suite**

Run: `npx jest`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/domain/pantryStaples.ts src/domain/__tests__/pantryStaples.test.ts src/db/repositories/shopping.ts src/db/__tests__/shopping.test.ts
git commit -m "feat: prefillPantryStaples repository function + staples list"
```

---

### Task 9: Wire "+ Prefill pantry" button into the Pantry screen

**Files:**
- Modify: `src/app/(tabs)/pantry.tsx`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json`

**Interfaces:**
- Consumes: `prefillPantryStaples` (Task 8).

- [ ] **Step 1: Add i18n keys**

In `en.json`, inside `pantry` (check the existing namespace name for this screen's other strings via `grep -n "pantry\." src/i18n/locales/en.json | head -5` and match it exactly):

```json
"prefillStaples": "Prefill pantry",
"prefillStapleResult": "Added {{added}} staples ({{alreadyPresent}} already in your pantry)",
```

In `cs.json`:

```json
"prefillStaples": "Doplnit základy",
"prefillStapleResult": "Přidáno {{added}} základních položek ({{alreadyPresent}} už bylo ve spíži)",
```

- [ ] **Step 2: Add the button and its handler**

In `src/app/(tabs)/pantry.tsx`, add a second `<Button>` to the existing `actionsRow` (the plan's research quoted this block at lines 80-88) as a sibling of the existing "+ Add item" button:

```tsx
<View style={styles.actionsRow}>
  <Button label={t('shopping.addItem')} onPress={() => setPickerVisible(true)} style={styles.actionButton} />
  <Button label={t('pantry.prefillStaples')} variant="secondary" onPress={prefillStaples} style={styles.actionButton} />
</View>
```

Add the handler function near the file's other action handlers (find `confirmAddItem`'s definition, ~lines 72-78, and add this right after it):

```ts
const prefillStaples = async () => {
  if (!household) return;
  const result = await prefillPantryStaples(db, household.id);
  Alert.alert('', t('pantry.prefillStapleResult', { added: result.added, alreadyPresent: result.alreadyPresent }));
};
```

Add the import `import { prefillPantryStaples } from '@/db/repositories/shopping';` — check whether `shopping.ts` repo functions are already imported in this file (likely yes, for `addPantryItem`) and add `prefillPantryStaples` to that existing import line rather than creating a second import statement. Add `Alert` to the existing `react-native` import line if it isn't already imported in this file.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Locale parity + full suite**

Run: `npx jest`
Expected: all pass.

- [ ] **Step 5: On-device verify**

Navigate to Pantry (fresh/empty pantry ideally): tap "Prefill pantry", confirm a result alert appears with a sane count, confirm the pantry list now shows the staple items. Tap it a second time, confirm the alert reports 0 added / all already-present, and the list didn't duplicate any rows.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(tabs)/pantry.tsx" src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: Prefill pantry button on the Pantry screen"
```

---

### Task 10: Remove Home's meal-plan section, add a Plan-screen redirect button

**Files:**
- Modify: `src/app/(tabs)/index.tsx`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json`

**Interfaces:**
- None new — this task only removes/replaces JSX and its exclusively-feeding state/handlers.

- [ ] **Step 1: Add the i18n key for the redirect button**

In `en.json`, inside `today`:

```json
"viewMealPlan": "View meal plan",
```

In `cs.json`:

```json
"viewMealPlan": "Zobrazit jídelníček",
```

- [ ] **Step 2: Replace the removed block with a single redirect button**

In `src/app/(tabs)/index.tsx`, replace the entire span from `{!hasAnyMeal ? (` through the closing `{activeProfile ? ( <View style={styles.mealList}> ... </View> ) : null}` (the full block quoted in this plan's research, ~lines 207-250) with:

```tsx
<Button
  label={t('today.viewMealPlan')}
  variant="secondary"
  onPress={() => router.push('/plan')}
  style={styles.viewPlanButton}
/>
```

- [ ] **Step 3: Remove the now-dead state, handler, and imports**

Remove `const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({});` and `const [generating, setGenerating] = useState(false);` (both now unused).

Remove `const hasAnyMeal = meals.length > 0;` (now unused — `meals` itself stays, it's still consumed by `nextMealEntry`'s `findMealForProfileInSlot(meals, slot, activeProfile)` call).

Remove the `generateThisWeek` async function (~lines 123-131, now unused).

Remove the now-unused imports: `Image` from `expo-image` (confirm first with `grep -n "<Image" "src/app/(tabs)/index.tsx"` that no other `<Image>` usage remains in this file — the research found none besides the removed block), `ActivityIndicator` from `react-native` (same check), `MealSlotCard` from `@/components/MealSlotCard`, `generateWeek` from `@/db/repositories/plan` (keep `setPortionStatus` from that same import line, it's still used elsewhere), `startOfWeek` from `@/domain/week` (keep `addDays` from that line, still used for `streakSinceDate`).

- [ ] **Step 4: Remove the now-dead styles, add the new button's style**

In `createStyles`, remove `emptyState`, `emptyImage`, `emptyTitle`, `emptyText`, `generateButton`, `spinner`, and `mealList` (all now unused after Step 2-3). Add:

```ts
viewPlanButton: {
  marginTop: spacing.sm,
},
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (this will surface any remaining reference to a removed identifier — fix any that appear).

- [ ] **Step 6: Full test suite**

Run: `npx jest`
Expected: all pass — this task is pure JSX/state removal in a screen component, no domain/repo logic touched, but confirms nothing else in the test suite unexpectedly imports from this file.

- [ ] **Step 7: On-device verify**

Navigate to Home: confirm the hero card, quick-stat row, water card, and (if applicable) next-meal row are all still present and unchanged; confirm the old "Jídla dneška" list and the empty-state illustration/CTA are gone, replaced by a single "View meal plan" button; tap it and confirm it navigates to the Plan tab. Test both with an empty week (no meals generated yet) and with a populated week, to confirm the button behaves identically in both states (since the removed block's two branches — empty-state vs. meal-list — are now unified into one always-shown button).

- [ ] **Step 8: Commit**

```bash
git add "src/app/(tabs)/index.tsx" src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: replace Home's meal-plan section with a Plan-screen redirect button"
```

---

### Task 11: Add `mediterranean` diet key + descriptions for the radio-list

**Files:**
- Modify: `src/constants/options.ts` (add `mediterranean` to `MANUAL_DIET_KEYS`)
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json` (add the new diet's label + a short description for every diet key)

**Interfaces:**
- Produces: `mediterranean` becomes a valid member of `DIET_KEYS` (consumed by Task 12/13) and immediately selectable in `food/edit.tsx`'s existing diet-flag chips (that screen already maps over `MANUAL_DIET_KEYS`, no code change needed there).

- [ ] **Step 1: Add the key**

In `src/constants/options.ts`, add `'mediterranean'` to `MANUAL_DIET_KEYS` (append it, keeping the existing 11 in place, matching the array's existing style):

```ts
export const MANUAL_DIET_KEYS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'mediterranean',
  'balanced',
  'keto',
  'paleo',
  'low_fat',
  'halal',
  'kosher',
  'whole30',
  'fodmap',
] as const;
```

- [ ] **Step 2: Add the label + description i18n keys**

In `en.json`, inside `diets`, add the new label:

```json
"mediterranean": "Mediterranean",
```

Then add a new top-level `dietDescriptions` namespace (short, evidence-neutral one-liners — these are descriptive, not medical claims) covering all 17 keys:

```json
"dietDescriptions": {
  "vegetarian": "No meat or fish; dairy and eggs are fine.",
  "vegan": "No animal products at all.",
  "pescatarian": "Vegetarian, plus fish and seafood.",
  "mediterranean": "Olive oil, vegetables, whole grains, fish, and legumes; less red meat.",
  "balanced": "A general mix of all food groups with no specific restriction.",
  "keto": "Very low carb, high fat - carbs typically under 10% of calories.",
  "paleo": "Whole foods only - no grains, legumes, dairy, or refined sugar.",
  "low_fat": "Keeps fat intake noticeably below a typical diet.",
  "halal": "Follows Islamic dietary law.",
  "kosher": "Follows Jewish dietary law.",
  "whole30": "A strict 30-day reset excluding sugar, alcohol, grains, legumes, and dairy.",
  "fodmap": "Limits fermentable carbs that commonly trigger digestive discomfort.",
  "gluten_free": "No wheat, barley, or rye.",
  "dairy_free": "No milk or milk-based products.",
  "low_carb": "Reduced carbohydrates, less strict than keto.",
  "nut_free": "No tree nuts or peanuts.",
  "soy_free": "No soy-based ingredients."
}
```

In `cs.json`, add the label:

```json
"mediterranean": "Středomořská",
```

And the matching `dietDescriptions` block:

```json
"dietDescriptions": {
  "vegetarian": "Bez masa a ryb, mléčné výrobky a vejce v pořádku.",
  "vegan": "Zcela bez živočišných produktů.",
  "pescatarian": "Vegetariánská strava plus ryby a mořské plody.",
  "mediterranean": "Olivový olej, zelenina, celozrnné produkty, ryby a luštěniny; méně červeného masa.",
  "balanced": "Obecná vyvážená strava bez konkrétního omezení.",
  "keto": "Velmi nízký příjem sacharidů, vysoký podíl tuků - obvykle pod 10 % kalorií ze sacharidů.",
  "paleo": "Jen celistvé potraviny - žádné obiloviny, luštěniny, mléčné výrobky ani rafinovaný cukr.",
  "low_fat": "Výrazně nižší příjem tuků než běžná strava.",
  "halal": "Řídí se islámskými stravovacími pravidly.",
  "kosher": "Řídí se židovskými stravovacími pravidly.",
  "whole30": "Přísný 30denní reset bez cukru, alkoholu, obilovin, luštěnin a mléčných výrobků.",
  "fodmap": "Omezuje fermentovatelné sacharidy, které často zhoršují trávicí potíže.",
  "gluten_free": "Bez pšenice, ječmene a žita.",
  "dairy_free": "Bez mléka a mléčných výrobků.",
  "low_carb": "Omezené sacharidy, méně přísné než keto.",
  "nut_free": "Bez ořechů a arašídů.",
  "soy_free": "Bez surovin ze sóji."
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Locale parity**

Run: `npx jest src/i18n/__tests__/locales.test.ts`
Expected: PASS.

- [ ] **Step 5: Full test suite**

Run: `npx jest`
Expected: all pass — no test currently pins the exact length/contents of `MANUAL_DIET_KEYS`/`DIET_KEYS`, but confirm this with `grep -rn "MANUAL_DIET_KEYS\|DIET_KEYS" src/**/__tests__/*.test.ts` before moving on; if one exists, update its expected array to include `'mediterranean'`.

- [ ] **Step 6: Commit**

```bash
git add src/constants/options.ts src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: add Mediterranean diet key + descriptions for all diet options"
```

---

### Task 12: `DietRadioList` component

**Files:**
- Create: `src/components/DietRadioList.tsx`

**Interfaces:**
- Produces: `DietRadioList({ value, onChange, recommendedKey }: { value: string | null; onChange: (value: string | null) => void; recommendedKey?: string }): JSX.Element` — single-select radio-row list over `DIET_KEYS`, each row expandable to show its description, an optional `recommendedKey` gets a "Recommended" badge. Consumed by Task 13.
- Consumes: `DIET_KEYS` from `@/constants/options`, `resolveChipSelectTap` from `@/components/ui/chipSelectLogic` (Phase Z's deselect-tap helper, reused here so tapping the already-selected diet deselects it back to "none" instead of being stuck).

- [ ] **Step 1: Write the component**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { resolveChipSelectTap } from '@/components/ui/chipSelectLogic';
import { DIET_KEYS } from '@/constants/options';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
  /** Diet key to badge as "Recommended" (e.g. 'mediterranean'). Omit for no recommendation. */
  recommendedKey?: string;
};

/** Single-select radio-style diet picker: one row per diet key, tap to select/deselect, tap "Details" to expand its description in place. Replaces the old multi-select ChipSelect usage for diet (a profile/household picks at most one primary diet here). */
export function DietRadioList({ value, onChange, recommendedKey }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  return (
    <View style={styles.list}>
      {DIET_KEYS.map((key) => {
        const selected = value === key;
        const expanded = expandedKey === key;
        return (
          <View key={key} style={[styles.row, selected && styles.rowSelected]}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={styles.rowMain}
              onPress={() => onChange(resolveChipSelectTap(value, key, true))}>
              <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                {selected ? <View style={styles.radioInner} /> : null}
              </View>
              <Text style={styles.rowLabel}>{t(`diets.${key}`)}</Text>
              {key === recommendedKey ? (
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedBadgeLabel}>{t('diets.recommended')}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.detailsButton}
              onPress={() => setExpandedKey(expanded ? null : key)}>
              <Text style={styles.detailsLabel}>{t('diets.details')}</Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
            </Pressable>
            {expanded ? <Text style={styles.description}>{t(`dietDescriptions.${key}`)}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    list: {
      gap: spacing.xs + 2,
    },
    row: {
      borderRadius: radius.card - 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    rowSelected: {
      borderColor: colors.primary,
    },
    rowMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOuterSelected: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    rowLabel: {
      flex: 1,
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    recommendedBadge: {
      backgroundColor: colors.primary,
      borderRadius: radius.chip,
      paddingVertical: 2,
      paddingHorizontal: spacing.xs + 2,
    },
    recommendedBadgeLabel: {
      color: colors.onPrimary,
      fontSize: 10,
      fontWeight: '700',
    },
    detailsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      alignSelf: 'flex-start',
      marginTop: spacing.xs,
      marginLeft: 28,
    },
    detailsLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    description: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: spacing.xs,
      marginLeft: 28,
    },
  });
}
```

- [ ] **Step 2: Add the two new i18n keys `diets.recommended` / `diets.details`**

In `en.json`, inside `diets`:

```json
"recommended": "Recommended",
"details": "Details",
```

In `cs.json`, inside `diets`:

```json
"recommended": "Doporučeno",
"details": "Detaily",
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Locale parity**

Run: `npx jest src/i18n/__tests__/locales.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DietRadioList.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: DietRadioList component - single-select radio rows with expandable descriptions"
```

---

### Task 13: Wire `DietRadioList` into both diet-selection call sites

**Files:**
- Modify: `src/components/profileWizard/ProfileSetupCarousel.tsx` (the `currentKey === 'diet'` card)
- Modify: `src/app/(tabs)/settings.tsx` (the `HouseholdSection`'s household-diet `ChipSelect`)

**Interfaces:**
- Consumes: `DietRadioList` (Task 12).

- [ ] **Step 1: `ProfileSetupCarousel.tsx`**

The current `diets` state is `const [diets, setDiets] = useState<string[]>([])` and gets submitted as `diets` (a `string[]`) in the profile-create payload — `DietRadioList` is single-select (`string | null`), so keep the underlying array-shaped state (unchanged, since `createProfile`'s `diets?: string[]` field expects an array and other code paths may still assume that shape) but bridge it at the call site:

Replace the diet card's `ChipSelect` block:

```tsx
{currentKey === 'diet' ? (
  <View>
    <Text style={styles.cardTitle}>{t('carousel.cardDiet')}</Text>
    <ChipSelect
      label={t('form.diets')}
      multi
      options={DIET_KEYS.map((key) => ({ value: key, label: t(`diets.${key}`), icon: DIET_ICONS[key] }))}
      value={diets}
      onChange={setDiets}
    />
  </View>
) : null}
```

with:

```tsx
{currentKey === 'diet' ? (
  <View>
    <Text style={styles.cardTitle}>{t('carousel.cardDiet')}</Text>
    <DietRadioList
      value={diets[0] ?? null}
      onChange={(key) => setDiets(key ? [key] : [])}
      recommendedKey="mediterranean"
    />
  </View>
) : null}
```

Add the import `import { DietRadioList } from '@/components/DietRadioList';`. The `DIET_ICONS` import may now be unused in this file if the diet `ChipSelect` was its only consumer — check with `grep -n "DIET_ICONS" src/components/profileWizard/ProfileSetupCarousel.tsx` and remove the import if so (leave it if other chips in this file still use it, e.g. the allergens card might use a different icon set, so confirm before removing).

- [ ] **Step 2: `settings.tsx`'s `HouseholdSection`**

Replace:

```tsx
<ChipSelect
  label={t('settings.householdDiets')}
  multi
  options={DIET_KEYS.map((key) => ({ value: key, label: t(`diets.${key}`), icon: DIET_ICONS[key] }))}
  value={restrictions.diets}
  onChange={(diets) => void replaceHouseholdPreferences(db, householdId, { diets })}
/>
```

with:

```tsx
<Text style={styles.slotLabel}>{t('settings.householdDiets')}</Text>
<DietRadioList
  value={restrictions.diets[0] ?? null}
  onChange={(key) => void replaceHouseholdPreferences(db, householdId, { diets: key ? [key] : [] })}
  recommendedKey="mediterranean"
/>
```

(`DietRadioList` renders its own rows without a separate `label` prop the way `ChipSelect` does, so the label is now a standalone `<Text>` above it — reuse the `styles.slotLabel` style already defined in this file for other section labels, matching the pattern used elsewhere in `HouseholdSection`; if this exact style name doesn't exist in this file, use whatever this file's existing convention is for a section sub-label, found via `grep -n "styles.slotLabel\|styles\.\w*[Ll]abel" src/app/\(tabs\)/settings.tsx` in the same component.)

Add the import `import { DietRadioList } from '@/components/DietRadioList';` to `settings.tsx`. Check whether `DIET_ICONS`/`ChipSelect`'s import is still needed elsewhere in this file (the household cuisines `ChipSelect` right below the diet block still uses `multi` chips and `CUISINE_ICONS`, and there may be other `ChipSelect` usages throughout this large file — only remove `DIET_ICONS` from the import list if `grep -n "DIET_ICONS" src/app/\(tabs\)/settings.tsx` shows zero remaining references after this edit; keep `ChipSelect` imported regardless, since the cuisines chip group still needs it).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Full test suite**

Run: `npx jest`
Expected: all pass — no domain/repo logic changed, `replaceHouseholdPreferences`/`createProfile` both already accept `diets: string[]` of any length including 0 or 1, so no repo-side change is needed.

- [ ] **Step 5: On-device verify**

Wizard flow: create a new profile, reach the diet card, confirm it now shows a scrollable radio-row list (not chips), Mediterranean has a "Recommended" badge, tapping "Details" on a row expands its description, selecting a diet shows the radio filled, tapping the same selected diet again deselects it back to none, only one diet can be selected at a time. Settings flow: open Domácnost → confirm the household diet section shows the same radio-list style, selecting a diet persists (re-open Settings, confirm it's still selected).

- [ ] **Step 6: Commit**

```bash
git add src/components/profileWizard/ProfileSetupCarousel.tsx "src/app/(tabs)/settings.tsx"
git commit -m "feat: wire DietRadioList into wizard and household settings diet pickers"
```

---

### Task 14: `longestConsecutiveRun` pure domain function

**Files:**
- Modify: `src/domain/streak.ts`
- Test: `src/domain/__tests__/streak.test.ts`

**Interfaces:**
- Produces: `export function longestConsecutiveRun(qualifyingDates: Set<string>, maxLookbackDays?: number): number` — scans the whole set (not just backward from today) for the longest unbroken run of consecutive qualifying dates. Consumed by Task 15 (`StreakDetailModal`).
- Consumes: `previousDay`/`addDays` from `@/domain/week` (already imported in `streak.ts` for `countConsecutiveDays`).

- [ ] **Step 1: Write the failing test**

Add to `src/domain/__tests__/streak.test.ts` (check the file's existing test setup/date-fixture pattern for `countConsecutiveDays` and match it):

```ts
import { longestConsecutiveRun } from '../streak';

describe('longestConsecutiveRun', () => {
  it('returns 0 for an empty set', () => {
    expect(longestConsecutiveRun(new Set())).toBe(0);
  });

  it('returns the length of a single run', () => {
    const dates = new Set(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(longestConsecutiveRun(dates)).toBe(3);
  });

  it('returns the longest of several runs, not the most recent one', () => {
    const dates = new Set([
      '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05',
      '2026-07-10', '2026-07-11',
    ]);
    expect(longestConsecutiveRun(dates)).toBe(5);
  });

  it('treats non-adjacent dates as separate runs of length 1', () => {
    const dates = new Set(['2026-07-01', '2026-07-05', '2026-07-09']);
    expect(longestConsecutiveRun(dates)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/domain/__tests__/streak.test.ts`
Expected: FAIL — `longestConsecutiveRun is not a function`.

- [ ] **Step 3: Implement**

In `src/domain/streak.ts`, add after `countConsecutiveDays`:

```ts
/**
 * Longest unbroken run of consecutive qualifying dates anywhere in the set
 * (not just ending at "today", unlike countConsecutiveDays) - used for a
 * streak detail view's "best streak" figure.
 */
export function longestConsecutiveRun(qualifyingDates: Set<string>): number {
  if (qualifyingDates.size === 0) return 0;
  const sorted = [...qualifyingDates].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    current = sorted[i] === addDays(sorted[i - 1], 1) ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}
```

Check the top of `src/domain/streak.ts` for its existing import of `previousDay`/`addDays` from `@/domain/week` (already there for `countConsecutiveDays`) — `addDays` is what this new function needs; if only `previousDay` is currently imported, add `addDays` to that same import line.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/domain/__tests__/streak.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/streak.ts src/domain/__tests__/streak.test.ts
git commit -m "feat: longestConsecutiveRun domain function for streak detail view"
```

---

### Task 15: `StreakDetailModal` component

**Files:**
- Create: `src/components/StreakDetailModal.tsx`

**Interfaces:**
- Produces: `StreakDetailModal({ visible, onClose, kind, current, best, todayCount, todayTotal, onAddMeal }: Props): JSX.Element`, where:
  ```ts
  type Props = {
    visible: boolean;
    onClose: () => void;
    kind: 'meal' | 'water';
    current: number;
    best: number;
    /** For kind: 'meal' only - "3 of 5 meals logged today"; ignored for 'water'. */
    todayCount?: number;
    todayTotal?: number;
    onAddMeal?: () => void;
  };
  ```
- Consumed by Task 16 (`HomeHeroCard.tsx`).

- [ ] **Step 1: Write the component**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  kind: 'meal' | 'water';
  current: number;
  best: number;
  /** For kind: 'meal' only - e.g. "3 of 5 meals logged today"; ignored for 'water'. */
  todayCount?: number;
  todayTotal?: number;
  onAddMeal?: () => void;
};

/** Tap-to-open detail behind the Home hero card's streak pills - shows current vs. best streak, and (meal streak only) today's logged-meal count. */
export function StreakDetailModal({ visible, onClose, kind, current, best, todayCount, todayTotal, onAddMeal }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Ionicons name={kind === 'meal' ? 'flame' : 'water'} size={22} color={colors.primary} />
            <Text style={styles.title}>{t(kind === 'meal' ? 'streakDetail.mealTitle' : 'streakDetail.waterTitle')}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{current}</Text>
              <Text style={styles.statLabel}>{t('streakDetail.current')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{best}</Text>
              <Text style={styles.statLabel}>{t('streakDetail.best')}</Text>
            </View>
          </View>

          {kind === 'meal' && todayCount !== undefined && todayTotal !== undefined ? (
            <Text style={styles.todayText}>
              {t('streakDetail.mealsLoggedToday', { count: todayCount, total: todayTotal })}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {kind === 'meal' && onAddMeal ? (
              <Button label={t('streakDetail.addMeal')} onPress={onAddMeal} style={styles.actionButton} />
            ) : null}
            <Button label={t('common.close')} variant="secondary" onPress={onClose} style={styles.actionButton} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      padding: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.input,
      paddingVertical: spacing.md,
    },
    statValue: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
    },
    statLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
    },
    todayText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    actionButton: {
      flex: 1,
    },
  });
}
```

- [ ] **Step 2: Add i18n keys**

In `en.json`, add a new `streakDetail` namespace:

```json
"streakDetail": {
  "mealTitle": "Meal streak",
  "waterTitle": "Water streak",
  "current": "Current",
  "best": "Best",
  "mealsLoggedToday": "{{count}} of {{total}} meals logged today",
  "addMeal": "Add meal"
}
```

In `cs.json`:

```json
"streakDetail": {
  "mealTitle": "Šňůra jídel",
  "waterTitle": "Šňůra pitného režimu",
  "current": "Aktuální",
  "best": "Nejlepší",
  "mealsLoggedToday": "{{count}} z {{total}} jídel dnes zaznamenáno",
  "addMeal": "Přidat jídlo"
}
```

Check `common.close` already exists in both locale files (`grep -n '"close"' src/i18n/locales/en.json` — it's a very common key in this codebase, almost certainly already present); if not, add it alongside the other `common.*` keys.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Locale parity**

Run: `npx jest src/i18n/__tests__/locales.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/StreakDetailModal.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: StreakDetailModal component - current/best streak + today's meal count"
```

---

### Task 16: Wire tap-to-open into `HomeHeroCard`

**Files:**
- Modify: `src/components/HomeHeroCard.tsx`
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `StreakDetailModal` (Task 15), `longestConsecutiveRun` (Task 14).
- `HomeHeroCard`'s `Props` gains: `mealCompletionDates: Set<string>`, `waterGoalDates: Set<string>` (the raw date sets, threaded down alongside the already-existing `mealStreak`/`waterStreak` counts so the modal can compute "best streak" without recomputing the sets itself), `todayMealCount: number`, `todayMealTotal: number`, `onAddMeal: () => void`.

- [ ] **Step 1: Make the streak pills tappable, add local modal state**

In `src/components/HomeHeroCard.tsx`, update `Props`:

```ts
type Props = {
  householdId: string;
  targets: TargetsResult;
  eatenKcal: number;
  targetKcal: number;
  onEditProfile: () => void;
  nextMeal?: { slotLabel: string; meal: MealRow };
  mealStreak: number;
  waterStreak: number;
  mealCompletionDates: Set<string>;
  waterGoalDates: Set<string>;
  todayMealCount: number;
  todayMealTotal: number;
  onAddMeal: () => void;
};
```

Update the function signature to destructure the new props, and add local state near the top of the component body:

```ts
const [openStreak, setOpenStreak] = useState<'meal' | 'water' | null>(null);
```

Add `useState` to the existing `react` import line (currently only imports `useMemo`).

- [ ] **Step 2: Make the streak `View`s tappable**

Replace:

```tsx
<View style={styles.streaksRow}>
  <View style={styles.streak}>
    <Ionicons name="flame" size={16} color={colors.mint} />
    <Text style={styles.streakValue}>{mealStreak}</Text>
    <Text style={styles.streakLabel}>{t('today.mealStreak')}</Text>
  </View>
  <View style={styles.streak}>
    <Ionicons name="water" size={16} color={colors.mint} />
    <Text style={styles.streakValue}>{waterStreak}</Text>
    <Text style={styles.streakLabel}>{t('today.waterStreak')}</Text>
  </View>
</View>
```

with:

```tsx
<View style={styles.streaksRow}>
  <Pressable accessibilityRole="button" style={styles.streak} onPress={() => setOpenStreak('meal')}>
    <Ionicons name="flame" size={16} color={colors.mint} />
    <Text style={styles.streakValue}>{mealStreak}</Text>
    <Text style={styles.streakLabel}>{t('today.mealStreak')}</Text>
  </Pressable>
  <Pressable accessibilityRole="button" style={styles.streak} onPress={() => setOpenStreak('water')}>
    <Ionicons name="water" size={16} color={colors.mint} />
    <Text style={styles.streakValue}>{waterStreak}</Text>
    <Text style={styles.streakLabel}>{t('today.waterStreak')}</Text>
  </Pressable>
</View>
```

(`Pressable` is already imported in this file's `react-native` import line, along with `StyleSheet`/`Text`/`View` — no new import needed for that.)

- [ ] **Step 3: Render the modal**

Add right before the closing `</LinearGradient>` (after the `{nextMeal ? (...) : null}` block):

```tsx
<StreakDetailModal
  visible={openStreak !== null}
  onClose={() => setOpenStreak(null)}
  kind={openStreak ?? 'meal'}
  current={openStreak === 'water' ? waterStreak : mealStreak}
  best={longestConsecutiveRun(openStreak === 'water' ? waterGoalDates : mealCompletionDates)}
  todayCount={openStreak === 'meal' ? todayMealCount : undefined}
  todayTotal={openStreak === 'meal' ? todayMealTotal : undefined}
  onAddMeal={openStreak === 'meal' ? onAddMeal : undefined}
/>
```

Add the imports `import { StreakDetailModal } from '@/components/StreakDetailModal';` and `import { longestConsecutiveRun } from '@/domain/streak';` to the top of the file.

- [ ] **Step 4: Thread the new props from `index.tsx`**

In `src/app/(tabs)/index.tsx`, compute `todayMealCount`/`todayMealTotal` from data already in scope (`profilePortionsToday`, already computed at line 107-109) and add `onAddMeal`:

```ts
const todayMealTotal = profilePortionsToday.length;
const todayMealCount = profilePortionsToday.filter((row) => row.portion.status === 'eaten').length;
```

Update the `<HomeHeroCard>` call site to pass the 5 new props:

```tsx
<HomeHeroCard
  householdId={household.id}
  targets={targets}
  eatenKcal={eaten?.kcal ?? 0}
  targetKcal={dailyTargets?.kcal ?? 0}
  onEditProfile={() => router.push({ pathname: '/profile/[id]', params: { id: activeProfile.id } })}
  nextMeal={
    nextMealEntry?.meal
      ? { slotLabel: slotDisplayLabel(t, nextMealEntry.slot), meal: nextMealEntry.meal }
      : undefined
  }
  mealStreak={mealStreak}
  waterStreak={waterStreak}
  mealCompletionDates={mealCompletionDates}
  waterGoalDates={waterGoalDates}
  todayMealCount={todayMealCount}
  todayMealTotal={todayMealTotal}
  onAddMeal={() => router.push('/plan')}
/>
```

(`mealCompletionDates`/`waterGoalDates` are already computed in this file at lines 75-82 per this plan's research — no new hook calls needed, just pass the existing variables through.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Full test suite**

Run: `npx jest`
Expected: all pass.

- [ ] **Step 7: On-device verify**

Home screen: tap the meal-streak pill, confirm a modal opens showing current/best streak numbers and a "X of Y meals logged today" line, tap "Add meal" and confirm it navigates to Plan, re-open Home and tap the water-streak pill, confirm the modal shows water-specific title/stats with no "meals logged" line and no "Add meal" button, tap "Close" and confirm it dismisses. If the household has enough history, verify "best" is ever different from "current" (e.g. after breaking a streak) — if there's no such history in the current test data, this is fine to skip and note as unverified in the final summary rather than fabricating test data just for this check.

- [ ] **Step 8: Commit**

```bash
git add src/components/HomeHeroCard.tsx "src/app/(tabs)/index.tsx"
git commit -m "feat: tap-to-open streak detail modal on the Home hero card"
```

---

### Task 17: Final verification + push

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + test suite**

Run: `npx tsc --noEmit && npx jest`
Expected: zero errors, all suites green. Compare the total test count against the pre-batch baseline (457 tests as of the last push before this batch) to confirm nothing was silently skipped — this batch adds tests in Tasks 2, 8, 14 at minimum, so the count should have grown.

- [ ] **Step 2: Diff review**

Run: `git log --oneline <first-task-1-commit>^..HEAD --stat` to get the full file list touched across this batch, and `git status --short` to confirm no untracked/uncommitted changes remain.

- [ ] **Step 3: Push**

```bash
git push
```

---

## Self-review notes (writing-plans skill)

- **Spec coverage:** all 8 requested items map to tasks — water unit (Tasks 3-4), kitchen-units removal (Task 6), compact Plan buttons (Task 7), pantry prefill (Tasks 8-9), Home meal-plan removal (Task 10), compact blue water card (Task 5), diet radio-list (Tasks 11-13), streak detail modal (Tasks 14-16). Tasks 1-2 are shared foundations for Tasks 3-5.
- **Type consistency check:** `WaterSettingsCard`'s `unitSystem` prop (Task 3) matches its usage in both call sites threaded in Task 4. `DietRadioList`'s `value: string | null` / `onChange: (value: string | null) => void` signature (Task 12) matches exactly how Task 13 bridges it to the existing `string[]`-shaped `diets` state at both call sites. `StreakDetailModal`'s `Props` (Task 15) match exactly how Task 16 constructs them at its one call site. `longestConsecutiveRun(qualifyingDates: Set<string>)` (Task 14) takes the same `Set<string>` shape `mealCompletionDates`/`waterGoalDates` already have in `index.tsx`, so Task 16 passes them through with no transformation.
- **Placeholder scan:** no TBD/TODO markers; every step shows complete, real code including exact i18n JSON blocks for both locales.
- **Known scope boundaries** (flagged inline in the relevant tasks, not silently omitted): Task 6 leaves the `household_custom_units` table and `kitchenUnitDisplayMode` column in the schema (unused) rather than writing a drop migration. Task 11's new `mediterranean` diet key — and the 7 pre-existing manual diet keys besides vegetarian/vegan — will show zero generator candidates until a user tags foods with them via the existing (unchanged) `food/edit.tsx` diet-flag UI; this plan does not retroactively tag seed recipes/foods. Task 16's "best streak ever different from current" on-device check may be unverifiable without enough historical data in the test household — noted as acceptable to leave unverified rather than fabricate data.

# Wizard & walkthrough overhaul — design spec

Status: approved (user authorized full autonomous execution, 2026-07-13 — see "Autonomy note" below).

## Context

After going through the onboarding wizard and app-intro walkthrough end-to-end on-device, the user gave a large batch of feedback spanning the walkthrough, the household-preferences carousel, the per-profile setup carousel, the progress/summary screen, and one genuinely new feature (flexible per-day meal slots). This spec groups that feedback into three phases and designs each one against the actual current implementation (not assumptions) — see "Findings" below for what's already true in the codebase versus what needs to change.

**Autonomy note**: the user reviewed a summary of this design conversationally, said "continue," then had to step away and explicitly authorized full autonomous execution: decide every remaining open question, use best judgment where something isn't 100% certain (flagging it rather than blocking on it), and proceed through spec → plan → implementation without further check-ins. This spec incorporates that authorization — remaining opens are resolved inline with a rationale, not left as questions.

## Findings from the existing codebase (grounding, not decisions)

- **Walkthrough images**: `src/assets/images/walkthrough/{household,calories,mealplan,shopping,progress}.png` are 1.3–1.7 MB each; `import.png` (generated more carefully in a later phase) is 73 KB. The "images take forever to load" complaint is unoptimized asset weight, not a loading-logic bug.
- **Maintenance-period cycling already exists in two places**: `computeWeightProjection` (`src/domain/projection.ts`) already cycles 3 weeks deficit / 1 week maintenance for weight-loss projections (`MAINTENANCE_PHASE`, cites MATADOR/ICECAP trial schedules), and `shouldRecommendMaintenance` (`src/domain/goals.ts`) already implements the 5%/7% (male/female) body-fat-drop threshold from CLAUDE.md's spec, wired into the Progress tab (`src/app/(tabs)/progress.tsx:121-131`) as an advisory banner condition. CLAUDE.md's "odloženo" note on this is stale. Nothing to build here structurally — Phase 2 only adds axis/timeline labels to the chart that already draws the cycling.
- **Pace values already cite sources** in code comments: `SPEED_PRESETS_LOSE_PCT_BW` (0.5% / 0.7% / 0.95% of bodyweight/week) cites the existing safe weekly-loss band and Garthe et al. (2011) on lean-mass cost above ~1%/week; `SPEED_PRESETS_GAIN` (200/300/450 kcal/day) cites Iraki et al.'s beginner/intermediate/advanced surplus ranges (`src/domain/constants.ts:94-125`).
- **The meal-slot schema already supports an ordered, variable-length list**: `meal_slot_settings` (householdId, slotKey, kind, sharing, time, calorieShare, sortOrder, enabled, + soft-delete via the shared `meta` columns). There is currently no insert/delete — only `updateMealSlotSetting` (edit an existing row) and the one-time seed insert in `createHouseholdWithDefaults`.
- **The generator already iterates snack slots generically** (`ctx.slots.filter(s => s.kind === 'snack')`, `src/db/repositories/plan.ts:865`) — no hardcoded slot-key list. Notification sync (`src/services/notifications.ts`) and the portion editor (`ProfilePortionsCard`) also already iterate `mealSlotSettings` dynamically rather than a fixed set.
- **However, `generateDay`'s snack-target math has a real bug for >1 snack slot per profile**: it computes each snack's target as `dailyTarget - consumedSoFar`, processed sequentially in `sortOrder` — so the *first* snack slot for a profile claims the entire remaining budget, leaving near-zero for the second, third, etc. This has been tolerable with the current fixed 2-snack default (morning/afternoon) but breaks down once a profile can have several inserted slots. **This must be fixed as part of Phase 3**, not treated as pre-existing/out of scope. `regenerateSlot`'s single-slot snack path (`src/db/repositories/plan.ts:1008-1020`) is *not* affected — it derives "remaining" from `computeConsumedExcluding`, i.e. from what's actually already committed for every other slot that day, which is correct regardless of slot count.
- **Slot display labels are only translation-keyed** (`t('slots.${slotKey}')`) at 6 call sites (`index.tsx` ×2, `settings.tsx` ×2, `ProfilePortionsCard.tsx` ×2, `PlanDayList.tsx`) with no fallback for a slot key that has no translation entry — which every newly-inserted custom slot will be missing.
- **Meal-time editing UI convention**: a plain `TextField` with an `HH:MM` placeholder validated by the existing `TIME_RE` regex (`settings.tsx`'s `MealTimesSection`) — no wheel/native time picker exists anywhere in the app. Phase 3's "Add meal" modal reuses this exact pattern rather than introducing a new one.
- **`ChipSelect`** (`src/components/ui/ChipSelect.tsx`) is a discriminated union on `multi`; single-select always calls `onChange(option)` on press, with no deselect path. Its `onChange` signature (`(value: string) => void`, non-nullable) is used by ~15 call sites across the app, so widening it everywhere would be a needless ripple.

---

## Phase Z — Quick polish

Independent, low-risk UI/content changes. No schema changes.

### Lifestyle question (`LifestylePicker.tsx`)
- Subtitle under each level's title (`activityInfo.*`, already exists) gets a leading **"Example:"** label so it visually reads as an example, matching the reference framing (office job / retail job / etc. — the existing copy is already example-shaped, this is a presentational change, not new content).
- Remove the Low/Medium/High fine-tune dots row (`dotsRow`, `ACTIVITY_MULTIPLIER_DOTS`) entirely — selecting a level now sets `activityMultiplier` to that level's middle value automatically (`ACTIVITY_MULTIPLIER_DOTS[level][1]`, which already equals `ACTIVITY_MULTIPLIERS[level]` per the existing comment). `ACTIVITY_MULTIPLIER_DOTS` stays in `constants.ts` (still used for the auto-set default) but the picker UI for it is deleted.

### Cooking experience / cooking time / budget (`HouseholdPreferencesCarousel.tsx`)
- Change the three `useState` initializers from their schema-default values (`'hard'`, `ANY_TIME_KEY`, `'high'`) to `null` / unset, and render `SelectableRow` with none selected until tapped.
- On submit, `handlePreferencesSubmit` (`wizard.tsx`) already receives whatever the carousel's local state holds — if the user never touched a card, substitute the same schema defaults at submit time (`cookingExperienceLevel ?? 'hard'`, `cookingTimeKey ?? ANY_TIME_KEY`, `budgetLevel ?? 'high'`) so behavior for a skip is identical to today.

### Walkthrough images
- Recompress the 5 oversized PNGs (resize to the same display dimensions `import.png` uses, re-export at similar quality/size class, ~50–100 KB target) using the same scratchpad-local `sharp` approach used for `import.png`. Pure asset replacement, no code change.

### Body-fat calculator button
- Rename `navy.open` i18n string from "Calculate from tape measurements" / "Vypočítat z tělesných obvodů" (or equivalent) to "Calculate · Body fat" / a matching Czech phrase ("Vypočítat · tělesný tuk"), in both locales.

### Deselectable training experience
- Extend `ChipSelect`'s discriminated union with a third variant: `{ label; options; value: string | null; onChange: (value: string | null) => void; multi?: false; allowDeselect: true }`. `toggle()` becomes: if `allowDeselect && isSelected(option)`, call `onChange(null)`; otherwise existing behavior. Existing call sites are unaffected (they don't pass `allowDeselect`, so the type/behavior is identical). `ProfileSetupCarousel`'s `fitnessExperience` field switches to this variant.

### Repetition & Variety card split + breathing room
- Split `HouseholdPreferencesCarousel`'s `'repetition'` card into two cards: **"Repetition"** (max reps, allow-consecutive, allow-same-lunch-dinner) and **"Variety & pantry"** (meal variety, prefer-pantry, cold-dinner frequency). `CARD_KEYS` grows from 8 to 9 entries; progress bar/back-next logic needs no change since it's already driven by array length.
- General pass: increase `marginBottom` spacing between `SwitchRow`/`Stepper`/`ChipSelect` blocks across `HouseholdPreferencesCarousel` and `ProfileSetupCarousel`'s denser cards (`lifestyle`, `training`) so related controls have clearer visual grouping. This is a styling-only change (`spacing.md` → `spacing.lg` between control blocks, or an explicit `<View style={styles.controlGap}>` wrapper) — chip-grid cards (diet/cuisine/avoid-food) are unaffected since they weren't flagged and scrolling is expected there.

### Conditional diet card in profile setup
- `ProfileSetupCarousel`'s `cardKeys` filter (`CARD_KEYS.filter(...)`, currently only hides `goal`/`tempo`/`training` for children) gains: `if (key === 'diet' && sharesMainMeals) return false`. When hidden, `handleSubmit` passes `diets: []` (profile-level diets stay empty; the household-level diet list already collected in `HouseholdPreferencesCarousel` is what the generator reads for shared-track profiles via `loadGeneratorContext`'s household-restriction lookup — no repository change needed, this is purely which card is shown).

**Testing**: `ChipSelect`'s new deselect branch gets a unit test (existing `ChipSelect` has no test file today — will add one). No other Phase Z item touches domain/generator logic, so verification is on-device (typecheck + full Jest suite already covers everything else transitively via existing tests).

---

## Phase AA — Evidence-based content

### Pace pros/cons (tempo card)
Short pros/cons block under each of the three `ChipSelect` options on the `tempo` card (`ProfileSetupCarousel.tsx`), sourced directly from the existing `constants.ts` comments:

- **Slow** (0.5%/wk or 200 kcal surplus): *Pro* — best preserves lean mass, most sustainable. *Con* — slowest visible progress.
- **Recommended** (0.7%/wk or 300 kcal surplus): *Pro* — the evidence-backed middle of the safe range. *Con* — still requires months of consistency.
- **Fast** (0.95%/wk or 450 kcal surplus): *Pro* — quickest visible results. *Con* — for loss, rates above ~1%/week are associated with lean-mass loss alongside fat (Garthe et al. 2011); for gain, a larger surplus means proportionally more fat gain since muscle-building is rate-limited by training response, not just food.

New i18n keys under `tempo.*`: `slowPro`, `slowCon`, `recommendedPro`, `recommendedCon`, `fastPro`, `fastCon` (×2 sets, lose/gain phrasing differs slightly — reuse the existing `goal === 'lose' ? ... : ...` branch already present for the hint text).

### Hydration benefits screen (water card)
Three short benefit rows (icon + title + one-line body) added above the existing toggle on the `water` card, in the same visual shape as the household carousel's `SelectableRow`-adjacent info style but non-interactive:
- **Metabolism** — mild dehydration measurably slows metabolic processes; adequate intake supports normal metabolic function.
- **Energy** — even mild dehydration (~1–2% of body weight in fluid) is linked to fatigue and reduced concentration.
- **Appetite & recovery** — proper hydration supports digestion and joint/muscle function, and helps avoid mistaking thirst for hunger.

New i18n keys: `water.benefitMetabolismTitle/Body`, `water.benefitEnergyTitle/Body`, `water.benefitRecoveryTitle/Body`.

### Goal-review tiers screen
New card (`goalReview`) inserted into `CARD_KEYS` after `tempo`, added to the same `cardKeys` filter as `goal`/`tempo` (hidden for children, and additionally hidden whenever `goal === 'maintain'` or `goalWeightKg` isn't set yet — mirrors the existing `tempo` card's visibility rule exactly, so the same filter branch condition is reused/extended rather than duplicated) in `ProfileSetupCarousel`. Computes `pctChange = Math.abs(goalWeightKg - weightKg) / weightKg`, and classifies into one of three tiers using general clinical obesity-guidance thresholds (this is a defensible simplification grounded in commonly-cited consensus, not a single named RCT — worded honestly in-app rather than over-citing):

| Tier | Threshold | Framing |
|---|---|---|
| Realistic | ≤ 10% of current body weight | "A well-supported, clinically meaningful target most people can reach and maintain." |
| Ambitious | 10–20% | "Achievable, but expect several months of sustained consistency." |
| Challenging | > 20% | "A significant transformation — success and long-term maintenance rates drop noticeably at this scale in outcome research. Consider a longer timeline or medical guidance." |

Same three tiers apply to `gain` goals using the same percentage-of-bodyweight framing (muscle-gain literature ties feasible rate to training experience already captured by `fitnessExperience`, but a single bodyweight-% framing keeps the UI consistent between lose/gain rather than forking the whole card). New component `GoalReviewCard.tsx`, new i18n namespace `goalReview.*`.

### Projection chart timeline
`WeightProjectionChart` gains an optional `startDate` prop (`ProfileSetupCarousel`/`progress.tsx` pass `todayIsoDate()`); the chart computes a calendar date per point (`addDays(startDate, point.week * 7)`) and renders:
- A small legend row above the chart: solid line = active phase, dashed = maintenance week (existing visual distinction, currently unlabeled).
- A one-line summary below the chart: "~{N} weeks · around {formatted last date}" computed from `projection[projection.length - 1]`.

No changes to `computeWeightProjection` itself (it deliberately stays date-agnostic/pure — dates are a presentation concern layered on top in the component, consistent with how the rest of the domain layer avoids `Date.now()`/wall-clock coupling).

**Testing**: goal-tier classification is a pure function (`classifyGoalReview(currentKg, goalKg): 'realistic' | 'ambitious' | 'challenging'`) in `src/domain/goalReview.ts`, unit tested for boundary values (exactly 10%, exactly 20%). Timeline date math is a pure helper in the chart component's module, tested via a small `projectionTimeline.ts` domain helper (`formatProjectionSummary(projection, startDate): { weeks, endDate }`) rather than inline in the component, so it's testable without rendering.

---

## Phase BB — Flexible meal slots

### Data model
- New migration: `meal_slot_settings` gains a nullable `label: text('label')` column. `NULL` for the 5 built-in slots (they keep using the `slots.${slotKey}` translation); non-null for any inserted slot (its display name, user-provided or auto-suggested).
- New shared helper `slotDisplayLabel(t, slot): string` in `src/utils/mealSlots.ts`: `slot.label ?? t(\`slots.${slot.slotKey}\`)`. Replaces the raw `t(\`slots.${slot.slotKey}\`)` call at all 6 existing call sites (`index.tsx` ×2, `settings.tsx` ×2 — `MealTimesSection` and the household section's slot editor if any, `ProfilePortionsCard.tsx` ×2, `PlanDayList.tsx`) plus the new `MealSlotsPicker` label line, which already has an equivalent `defaultValue` fallback (`t('mealSlots.slot.${slot.slotKey}', { defaultValue: slot.time })`) — that one also switches to `slotDisplayLabel` for consistency (a custom slot's `label` should win over its raw `time` fallback).

### Repository functions (`src/db/repositories/households.ts`)
```ts
export async function insertMealSlot(db: AppDb, householdId: string, input: {
  afterSlotId: string | null; // null = insert as the new first slot
  label: string;
  time: string; // 'HH:MM'
}): Promise<string /* new slot id */>

export async function deleteMealSlot(db: AppDb, slotId: string): Promise<void>
```
- `insertMealSlot`: loads the household's current enabled+non-deleted slots ordered by `sortOrder`; finds the anchor's `sortOrder` (or -1 if `afterSlotId` is null); shifts every slot with `sortOrder > anchor` up by 1 (single `UPDATE ... SET sort_order = sort_order + 1 WHERE household_id = ? AND sort_order > ?`); inserts the new row at `anchor + 1` with `kind: 'snack'`, `sharing: 'individual'`, `calorieShare: 0` (deliberately — see generator fix below, calorieShare is no longer authoritative for snack-target sizing, so a new slot needs no share guess), `enabled: true`.
- `deleteMealSlot`: soft-delete only (`deletedAt`), matching every other table's convention — does not renumber `sortOrder` (gaps are harmless, every query already orders by `sortOrder` and filters `deletedAt IS NULL`).
- The creating profile is auto-enabled for the new slot: after insert, the wizard/settings caller adds the new `slotKey` to that profile's `enabledSlotKeys` (via the existing `updateProfile`/`ProfileFormValue.enabledSlotKeys` path). Other profiles are not auto-enabled (matches "individual fine-tuning" framing) but can toggle it on later from their own `MealSlotsPicker`.

### Generator fix (`src/db/repositories/plan.ts`, `generateDay`)
Replace the sequential "remaining after mains, consumed greedily per snack" loop (lines ~865–892) with an up-front proportional split, computed once per profile immediately before that profile's snack slots are processed:

```ts
const profileSnackSlots = ctx.slots.filter(
  (s) => s.kind === 'snack' && isSlotEnabledForProfile(profile, s.slotKey),
);
const remainingAfterMains = { kcal: profile.dailyTarget.kcal - consumedSoFar.get(profile.id)!.kcal, ... };
const weights = profileSnackSlots.map(
  (s) => profile.slotOverrides.get(s.id)?.calorieSharePercent ?? (s.calorieShare > 0 ? s.calorieShare : null),
);
const weightSum = weights.reduce((sum, w) => sum + (w ?? 0), 0);
// Equal-split fallback when no slot has a meaningful weight (e.g. all newly inserted, calorieShare 0).
const normalizedWeights = weightSum > 0
  ? weights.map((w) => (w ?? 0) / weightSum)
  : profileSnackSlots.map(() => 1 / profileSnackSlots.length);
```
Each slot's *target* becomes `remainingAfterMains * normalizedWeights[i]` — computed once, fixed for the rest of that profile's snack loop (not re-derived from a shrinking "consumed so far," since that's what caused the greedy-first-slot bug). `resolveSnackTarget`'s existing override precedence (explicit protein/fat override still wins per-slot) is preserved — this only changes how the *default* (no-override) share is derived when there are multiple slots. `regenerateSlot`'s snack path is untouched (already correct, see Findings).

New domain test in `src/domain/generator/__tests__/portions.test.ts` (or a new `snackAllocation.test.ts`): 3 snack slots with no overrides split remaining evenly; a mix of weighted + zero-weight (newly inserted) slots falls back sensibly; a single snack slot still gets 100% of remaining (regression check against the pre-fix behavior for the common case).

### "Add meal" UI
Replace the current always-visible `snack_morning`/`snack_afternoon` rows' *special-casing* — they remain in the list as ordinary toggleable rows (nothing removes existing households' slots), but the picker's affordance for *creating new ones* changes:
- `MealSlotsPicker` gains a `+ Add meal` row at the bottom (only rendered when `householdId` is available, i.e. not during the very first wizard step before a household exists — matches existing `householdId: string | undefined` prop).
- Tapping it opens a new `AddMealSlotModal`: step 1 is a tappable list of insertion points ("Before {first slot}", "Between {A} and {B}" for every adjacent pair, "After {last slot}") built from the already-loaded `slots` array; step 2 (shown after picking a position) is a small form — `TextField` for name (placeholder "Extra meal", not required — empty submits with an auto-generated fallback like "Extra meal" + a running count) and a `TextField` for time (`HH:MM`, `TIME_RE`-validated, defaulting to the midpoint time between the two neighboring slots, or ±30 min from the single neighbor at the very start/end) — then an "Add" button calling `insertMealSlot`.
- Count warning: below the slot list (not blocking), a hint line reads the current enabled-slot count for this profile and shows nothing between 3–6, a soft note below 3 ("Very few meals can make it harder to hit your macro targets") and a soft warning above 6 ("More than 6 meals a day isn't usually necessary, but you can keep going") — framed as guidance, not a hard cap, since meal-frequency research is genuinely agnostic on strict optimums (worded to avoid overclaiming a specific "best" number).
- Delete: existing custom slots get a small trailing "×" in `MealSlotsPicker`'s row (only for slots with a non-null `label`, i.e. never on the 5 built-ins) calling `deleteMealSlot` after a confirmation `Alert` (matches the app's established delete-confirmation convention).

### Touch points needing the generic label fallback
`index.tsx`, `settings.tsx` (`MealTimesSection` and the household slot editor), `ProfilePortionsCard.tsx`, `PlanDayList.tsx` — see Findings; mechanical find/replace of `t(\`slots.${slot.slotKey}\`)` → `slotDisplayLabel(t, slot)`.

**Testing**: `insertMealSlot`/`deleteMealSlot` get repository tests (insert at start/middle/end shifts `sortOrder` correctly; delete soft-deletes and is excluded from subsequent queries) in `src/db/__tests__/households.test.ts`. The snack-allocation fix gets the domain test described above. On-device: add two extra meals via the wizard, generate a day, confirm all snack-kind slots (built-in + custom) get sensible non-zero portions instead of the first one eating everything.

---

## Risks & deliberate simplifications

1. **Goal-review tiers are a defensible simplification, not a single cited study** — framed honestly in-app as general guidance rather than attributed to a specific RCT, since that's what it actually is. Percentage boundaries (10%/20%) can be revisited if they read wrong once seen on-device.
2. **"Recommend 5 meals" is deliberately hedged, not asserted as optimal** — meal-frequency literature doesn't strongly support a single best number; the copy frames it as helpful for protein distribution/appetite control, not a hard nutritional requirement.
3. **New meal slots default to `calorieShare: 0`** rather than guessing a share — this is intentional (see generator fix) and relies on the proportional-split fix landing in the same phase; shipping the UI without the generator fix would reproduce the "first slot eats everything" bug on real data, so these two pieces are not separable across commits within Phase BB.
4. **Diet-card visibility change is a UI-only gate** — profile-level `diets` isn't populated when the card is hidden, but the generator's existing household-diet lookup already covers shared-track profiles, so no repository/generator change is needed there.
5. **No changes to `computeWeightProjection`'s cycling model itself** — Phase AA only adds presentation (dates, legend, summary text) on top of behavior that already exists and is already tested.

## Verification (all phases)

- `npx tsc --noEmit` and `npx jest` (locale-parity test guards every i18n addition) after each phase.
- On-device via the existing Android emulator toolchain, screenshots read back by me for verification (the user is unavailable this session) — confirm each changed screen renders, confirm the snack-allocation fix with a real multi-slot generation, confirm insert/delete round-trips through the DB.
- One commit per phase (Z, AA, BB), matching this project's established discipline; push after each.
- A final adversarial code-review pass (multi-agent) across the full diff before the last push, specifically checking: generator correctness (the snack-split fix), i18n parity, and any UI regression in screens touched by more than one phase (`ProfileSetupCarousel.tsx` is touched by all three).

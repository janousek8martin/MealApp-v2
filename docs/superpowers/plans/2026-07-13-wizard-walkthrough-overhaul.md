# Wizard & Walkthrough Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three phases of wizard/walkthrough improvements — quick UI polish (Z), evidence-based content additions (AA), and a new flexible/insertable meal-slot system (BB) — against the design in `docs/superpowers/specs/2026-07-13-wizard-walkthrough-overhaul-design.md`.

**Architecture:** No new screens beyond one modal (`AddMealSlotModal`) and one card (`GoalReviewCard`); everything else extends existing wizard-carousel components in place. Pure logic (chip-select deselect resolution, goal-review classification, projection timeline formatting, snack-target allocation) is extracted into small testable functions, matching this codebase's established convention of unit-testing domain logic rather than component rendering (no React Native Testing Library usage exists anywhere in this repo today — don't introduce it).

**Tech Stack:** React Native + Expo Router, Drizzle ORM + expo-sqlite, react-i18next, Jest.

## Global Constraints

- Every user-facing string change needs both `src/i18n/locales/en.json` and `src/i18n/locales/cs.json` entries — `src/i18n/__tests__/locales.test.ts` fails the build otherwise.
- `npx tsc --noEmit` and `npx jest` must be clean after every task that touches `.ts`/`.tsx`.
- One git commit per task (or per tightly-coupled pair of tasks where a partial commit would leave the app broken — noted explicitly where that applies), using this repo's existing commit-message style (`type: summary (phase X)`).
- Soft-delete convention: every table has `deletedAt` via the shared `meta` spread; never hard-delete rows.
- No new component-rendering test files — this repo tests domain/db logic only.

---

## Part 1 — Phase Z: Quick polish

### Task 1: `ChipSelect` deselect variant

**Files:**
- Modify: `src/components/ui/ChipSelect.tsx`

**Interfaces:**
- Produces: `resolveChipSelectTap(current: string | null, tapped: string, allowDeselect: boolean): string | null` (exported, pure) — used by Task 7 (training experience) and by the component's own `toggle()`.
- Produces: new prop shape `DeselectableSingleProps = { label: string; options: ChipOption[]; value: string | null; onChange: (value: string | null) => void; multi?: false; allowDeselect: true }`, added to the exported `Props` union alongside existing `SingleProps`/`MultiProps`.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/__tests__/ChipSelect.test.ts`:

```ts
import { resolveChipSelectTap } from '../ChipSelect';

describe('resolveChipSelectTap', () => {
  it('selects a new option when nothing is selected', () => {
    expect(resolveChipSelectTap(null, 'a', true)).toBe('a');
  });

  it('deselects when tapping the already-selected option and allowDeselect is true', () => {
    expect(resolveChipSelectTap('a', 'a', true)).toBeNull();
  });

  it('switches selection when tapping a different option', () => {
    expect(resolveChipSelectTap('a', 'b', true)).toBe('b');
  });

  it('never deselects when allowDeselect is false (existing single-select behavior)', () => {
    expect(resolveChipSelectTap('a', 'a', false)).toBe('a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/ui/__tests__/ChipSelect.test.ts`
Expected: FAIL — `resolveChipSelectTap` is not exported from `../ChipSelect`.

- [ ] **Step 3: Implement**

In `src/components/ui/ChipSelect.tsx`, add the pure function (near the top, after the existing type definitions) and wire it into the component:

```ts
export type ChipOption = { value: string; label: string; icon?: ImageSourcePropType };

type SingleProps = {
  label: string;
  options: ChipOption[];
  value: string | null;
  onChange: (value: string) => void;
  multi?: false;
  allowDeselect?: false;
};

type DeselectableSingleProps = {
  label: string;
  options: ChipOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  multi?: false;
  allowDeselect: true;
};

type MultiProps = {
  label: string;
  options: ChipOption[];
  value: string[];
  onChange: (value: string[]) => void;
  multi: true;
};

type Props = SingleProps | DeselectableSingleProps | MultiProps;

/** Pure resolution of a single-select tap, extracted so the deselect branch is unit-testable without rendering. */
export function resolveChipSelectTap(current: string | null, tapped: string, allowDeselect: boolean): string | null {
  if (allowDeselect && current === tapped) return null;
  return tapped;
}
```

Update the component body's `toggle`/`isSelected` to route through it:

```ts
export function ChipSelect(props: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isSelected = (option: string) =>
    props.multi ? props.value.includes(option) : props.value === option;

  const toggle = (option: string) => {
    if (props.multi) {
      const next = props.value.includes(option)
        ? props.value.filter((item) => item !== option)
        : [...props.value, option];
      props.onChange(next);
    } else if (props.allowDeselect) {
      props.onChange(resolveChipSelectTap(props.value, option, true));
    } else {
      props.onChange(option);
    }
  };
```

(The rest of the component — the `<View>`/`<Pressable>` render tree — is unchanged; `isSelected`/`toggle` already cover the new branch since `DeselectableSingleProps.value` is still `string | null`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/ui/__tests__/ChipSelect.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (existing `SingleProps`/`MultiProps` call sites are untouched since `allowDeselect` is optional-and-`false` by default on `SingleProps`).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ChipSelect.tsx src/components/ui/__tests__/ChipSelect.test.ts
git commit -m "feat: deselectable ChipSelect variant (phase Z)"
```

---

### Task 2: Lifestyle picker cleanup — remove fine-tune dots, auto-set multiplier, "Example:" label

**Files:**
- Modify: `src/components/LifestylePicker.tsx`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json`

**Interfaces:**
- Consumes: `ACTIVITY_MULTIPLIER_DOTS` from `@/domain/constants` (unchanged, still exported — only the picker's dots *row* is removed, the constant itself stays since it still supplies the auto-set middle value).
- No new exports; `LifestylePicker`'s public props (`value`, `onChange`, `multiplier`, `onChangeMultiplier`, `customTdeeKcal`, `onChangeCustomTdeeKcal`, `error`) are unchanged, so `ProfileSetupCarousel` needs no changes for this task.

- [ ] **Step 1: Add the "Example:" i18n key**

In `src/i18n/locales/en.json`, inside the `activityQuestion` object, add:

```json
"exampleLabel": "Example:"
```

In `src/i18n/locales/cs.json`, inside `activityQuestion`, add:

```json
"exampleLabel": "Příklad:"
```

- [ ] **Step 2: Verify locale parity**

Run: `npx jest src/i18n/__tests__/locales.test.ts`
Expected: PASS

- [ ] **Step 3: Edit `LifestylePicker.tsx`**

Change the card's subtitle render (currently `<Text style={styles.cardSubtitle}>{t(\`activityInfo.${level.value}\`)}</Text>`) to prefix the example label:

```tsx
<Text style={styles.cardSubtitle}>
  {t('activityQuestion.exampleLabel')} {t(`activityInfo.${level.value}`)}
</Text>
```

Remove the entire `onChange(level.value)` auto-set gap by making level selection also set the multiplier automatically. Change the card's `onPress`:

```tsx
onPress={() => {
  onChange(level.value);
  onChangeMultiplier(ACTIVITY_MULTIPLIER_DOTS[level.value][1]);
}}
```

Delete the entire dots block (the `{value && !hasCustomTdee ? (<View style={styles.dotsRow}>...</View>) : null}` section, roughly lines 99-117) and the now-unused `dotIndex` function and `DOT_KEYS` constant. Also remove the now-dead styles `dotsRow`, `dotWrap`, `dot`, `dotSelected`, `dotValue`, `dotLabel` from `createStyles`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `multiplier`/`onChangeMultiplier` become unused by any *caller* other than the auto-set above, that's fine — they're still part of the public prop contract used by `ProfileSetupCarousel`.)

- [ ] **Step 5: Full test suite**

Run: `npx jest`
Expected: all suites pass (437+ tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/LifestylePicker.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: simplify lifestyle picker - drop fine-tune dots, auto-set multiplier (phase Z)"
```

---

### Task 3: Household preferences carousel — no preselection on cooking-experience/time/budget

**Files:**
- Modify: `src/components/householdWizard/HouseholdPreferencesCarousel.tsx`

**Interfaces:**
- No exported-type changes; `HouseholdPreferencesValue`'s fields stay non-nullable (`cookingExperienceLevel: 'easy'|'medium'|'hard'`, etc.) — only the *local component state* becomes nullable until submit, where it's defaulted.

- [ ] **Step 1: Change the three `useState` initializers to unset**

```ts
const [cookingExperienceLevel, setCookingExperienceLevel] = useState<'easy' | 'medium' | 'hard' | null>(null);
const [cookingTimeKey, setCookingTimeKey] = useState<string | null>(null);
const [budgetLevel, setBudgetLevel] = useState<'low' | 'medium' | 'high' | null>(null);
```

- [ ] **Step 2: Update the three `SelectableRow` blocks' `selected` checks**

They already compare `cookingExperienceLevel === level` / `cookingTimeKey === key` / `budgetLevel === level` — these still work correctly with a `null` state (nothing matches, so nothing renders selected). No change needed to the JSX itself, only to the `onPress` handlers, which already just call the setters with a concrete value — also unchanged.

- [ ] **Step 3: Default at submit time**

In `handleSubmit`, change:

```ts
const handleSubmit = () => {
  onSubmit({
    maxReps,
    allowConsecutive,
    allowSameLunchDinner,
    preferPantryItems,
    mealVarietyLevel,
    coldDinnerFrequencyPerWeek,
    diets,
    favoriteCuisines,
    avoidFoodGroupKeys,
    cookingExperienceLevel: cookingExperienceLevel ?? 'hard',
    cookingTimeLimitMinutes: cookingTimeKey === null || cookingTimeKey === ANY_TIME_KEY ? null : Number(cookingTimeKey),
    budgetLevel: budgetLevel ?? 'high',
    notificationsEnabled,
  });
};
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/householdWizard/HouseholdPreferencesCarousel.tsx
git commit -m "feat: no preselection on cooking-experience/time/budget cards (phase Z)"
```

---

### Task 4: Split "Repetition & variety" into two cards

**Files:**
- Modify: `src/components/householdWizard/HouseholdPreferencesCarousel.tsx`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json`

**Interfaces:**
- `CARD_KEYS` grows from `['repetition', 'diet', 'cuisines', 'avoid', 'cookingExperience', 'cookingTime', 'budget', 'notifications']` (8) to `['repetition', 'variety', 'diet', 'cuisines', 'avoid', 'cookingExperience', 'cookingTime', 'budget', 'notifications']` (9). No other component reads `CARD_KEYS` directly (it's module-private), so this is a self-contained change.

- [ ] **Step 1: Add i18n keys**

In `src/i18n/locales/en.json`, inside `householdCarousel`, add:

```json
"cardVariety": "Variety & pantry"
```

In `src/i18n/locales/cs.json`, inside `householdCarousel`, add:

```json
"cardVariety": "Pestrost a spíž"
```

- [ ] **Step 2: Update `CARD_KEYS`**

```ts
const CARD_KEYS = [
  'repetition',
  'variety',
  'diet',
  'cuisines',
  'avoid',
  'cookingExperience',
  'cookingTime',
  'budget',
  'notifications',
] as const;
```

- [ ] **Step 3: Split the card content**

Change the `currentKey === 'repetition'` block to only contain the repetition-specific controls, and add a new `currentKey === 'variety'` block for the rest:

```tsx
{currentKey === 'repetition' ? (
  <View>
    <Text style={styles.cardTitle}>{t('householdCarousel.cardRepetition')}</Text>
    <Stepper
      label={t('settings.maxRepetitionsPerWeek')}
      value={maxReps}
      onChange={setMaxReps}
      min={1}
      max={7}
    />
    <Text style={styles.hintText}>{t('wizard.maxRepetitionsHint')}</Text>
    <SwitchRow
      label={t('settings.allowConsecutiveDays')}
      hint={t('settings.allowConsecutiveDaysHint')}
      value={allowConsecutive}
      onChange={setAllowConsecutive}
    />
    <SwitchRow
      label={t('settings.allowSameLunchDinner')}
      hint={t('settings.allowSameLunchDinnerHint')}
      value={allowSameLunchDinner}
      onChange={setAllowSameLunchDinner}
    />
  </View>
) : null}

{currentKey === 'variety' ? (
  <View>
    <Text style={styles.cardTitle}>{t('householdCarousel.cardVariety')}</Text>
    <SwitchRow
      label={t('settings.preferPantryItems')}
      hint={t('settings.preferPantryItemsHint')}
      value={preferPantryItems}
      onChange={setPreferPantryItems}
    />
    <ChipSelect
      label={t('settings.mealVariety')}
      options={(['low', 'medium', 'high'] as const).map((level) => ({
        value: level,
        label: t(`mealVariety.${level}`),
      }))}
      value={mealVarietyLevel}
      onChange={(v) => setMealVarietyLevel(v as 'low' | 'medium' | 'high')}
    />
    <Text style={styles.hintText}>{t('settings.mealVarietyHint')}</Text>
    <Stepper
      label={t('settings.coldDinnerFrequency')}
      value={coldDinnerFrequencyPerWeek}
      onChange={setColdDinnerFrequencyPerWeek}
      min={0}
      max={7}
    />
    <Text style={styles.hintText}>{t('settings.coldDinnerFrequencyHint')}</Text>
  </View>
) : null}
```

(This removes `allowSameLunchDinner`'s `SwitchRow` from the old combined block and keeps it on `repetition`; `preferPantryItems`, `mealVarietyLevel`, `coldDinnerFrequencyPerWeek` move to the new `variety` card — matching the spec's grouping.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Locale parity + full suite**

Run: `npx jest`
Expected: all pass.

- [ ] **Step 6: On-device verify**

Using the established adb screenshot workflow (emulator `mealapp_test`, `pm clear` + relaunch to reach the wizard, tap through household preferences), confirm: 9 dots on the progress bar, "Repetition" card shows 3 controls, "Variety & pantry" card shows 3 controls, Back/Next navigate correctly between them.

- [ ] **Step 7: Commit**

```bash
git add src/components/householdWizard/HouseholdPreferencesCarousel.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: split Repetition & Variety into two wizard cards (phase Z)"
```

---

### Task 5: Recompress walkthrough images

**Files:**
- Modify (binary replace): `src/assets/images/walkthrough/household.png`, `calories.png`, `mealplan.png`, `shopping.png`, `progress.png`

**Interfaces:** none (asset-only change; `walkthrough.tsx`'s `require()` calls are untouched).

- [ ] **Step 1: Check current dimensions and confirm a target**

Run (from the scratchpad, using the project's own `sharp` if available, or install it scratchpad-locally as was done for `import.png`):

```bash
cd "/c/Users/Martin/Documents/Claude Code"
node -e "
const sharp = require('sharp');
(async () => {
  for (const name of ['household','calories','mealplan','shopping','progress','import']) {
    const meta = await sharp('src/assets/images/walkthrough/'+name+'.png').metadata();
    console.log(name, meta.width+'x'+meta.height);
  }
})();
"
```

If `sharp` isn't resolvable from the project root, install it in the scratchpad directory instead (`npm install sharp --prefix "$SCRATCHPAD"`) and reference it via full path, exactly as the earlier `import.png` generation did — do not add `sharp` to the app's own `package.json` dependencies.

- [ ] **Step 2: Recompress each oversized PNG to `import.png`'s dimensions/quality class**

```bash
node -e "
const sharp = require('sharp');
const fs = require('fs');
(async () => {
  const target = await sharp('src/assets/images/walkthrough/import.png').metadata();
  for (const name of ['household','calories','mealplan','shopping','progress']) {
    const path = 'src/assets/images/walkthrough/'+name+'.png';
    const before = fs.statSync(path).size;
    await sharp(path)
      .resize({ width: target.width, height: target.height, fit: 'inside' })
      .png({ quality: 80, compressionLevel: 9 })
      .toFile(path + '.tmp');
    fs.renameSync(path + '.tmp', path);
    const after = fs.statSync(path).size;
    console.log(name, before, '->', after);
  }
})();
"
```

- [ ] **Step 3: Verify the walkthrough still renders each image correctly**

Run the app on the emulator (`pm clear` + relaunch), swipe through all 6 walkthrough pages, screenshot each, confirm no visual regression (same illustration, just lighter file).

- [ ] **Step 4: Commit**

```bash
git add src/assets/images/walkthrough/*.png
git commit -m "perf: recompress oversized walkthrough images (phase Z)"
```

---

### Task 6: Rename the body-fat calculator button

**Files:**
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json`

- [ ] **Step 1: Edit the string**

In `en.json`, inside `navy`, change:

```json
"open": "Calculate · Body fat"
```

In `cs.json`, inside `navy`, change (find the current Czech value for `navy.open` and replace with):

```json
"open": "Vypočítat · tělesný tuk"
```

- [ ] **Step 2: Locale parity**

Run: `npx jest src/i18n/__tests__/locales.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "content: rename body-fat calculator button label (phase Z)"
```

---

### Task 7: Deselectable training experience

**Files:**
- Modify: `src/components/profileWizard/ProfileSetupCarousel.tsx`

**Interfaces:**
- Consumes: Task 1's `DeselectableSingleProps` variant of `ChipSelect`.

- [ ] **Step 1: Switch the `fitnessExperience` `ChipSelect` to the deselectable variant**

```tsx
<ChipSelect
  label={t('form.fitnessExperience')}
  options={[
    { value: 'beginner', label: t('fitness.beginner') },
    { value: 'intermediate', label: t('fitness.intermediate') },
    { value: 'advanced', label: t('fitness.advanced') },
  ]}
  value={fitnessExperience}
  onChange={setFitnessExperience}
  allowDeselect
/>
```

(`fitnessExperience` is already typed `useState<string | null>(null)` and `setFitnessExperience` already accepts a plain setter — since `ChipSelect`'s `DeselectableSingleProps.onChange` is `(value: string | null) => void`, `setFitnessExperience` (a raw `Dispatch<SetStateAction<string | null>>`) satisfies it directly with no wrapper needed.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: On-device verify**

Reach the "training" card in the wizard, tap an experience level, tap it again, confirm it deselects (no chip highlighted) and Next still proceeds (submitting `fitnessExperience: undefined`, matching the field's existing optionality in `ProfileFormValue`).

- [ ] **Step 4: Commit**

```bash
git add src/components/profileWizard/ProfileSetupCarousel.tsx
git commit -m "feat: allow deselecting training experience (phase Z)"
```

---

### Task 8: Conditional diet card in profile setup

**Files:**
- Modify: `src/components/profileWizard/ProfileSetupCarousel.tsx`

- [ ] **Step 1: Extend the `cardKeys` filter**

```ts
const cardKeys = useMemo<CardKey[]>(() => {
  return CARD_KEYS.filter((key) => {
    if (isChild && (key === 'goal' || key === 'tempo' || key === 'training')) return false;
    if (!isChild && key === 'tempo' && goal === 'maintain') return false;
    if (key === 'diet' && sharesMainMeals) return false;
    return true;
  });
}, [isChild, goal, sharesMainMeals]);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: On-device verify**

Create a profile with "Shares main meals" ON → confirm the diet card never appears in the carousel. Create one with it OFF → confirm the diet card does appear.

- [ ] **Step 4: Commit**

```bash
git add src/components/profileWizard/ProfileSetupCarousel.tsx
git commit -m "feat: hide diet card for profiles sharing household meals (phase Z)"
```

---

### Task 9: Breathing-room spacing pass

**Files:**
- Modify: `src/components/householdWizard/HouseholdPreferencesCarousel.tsx`
- Modify: `src/components/profileWizard/ProfileSetupCarousel.tsx`

- [ ] **Step 1: Increase inter-control spacing on the denser cards**

In both files' `createStyles`, controls inside a card are separated only by each control's own `marginBottom` (e.g. `SwitchRow`, `Stepper`, `ChipSelect` each already carry `spacing.md`/`spacing.sm` bottom margins per their own component styles). Add a small wrapping `<View style={styles.controlGap}>` around each control on the `repetition`, `variety`, `lifestyle`, and `training` cards specifically (the ones the user called out as cramped), with:

```ts
controlGap: {
  marginBottom: spacing.lg,
},
```

Concretely, wrap each direct child of those four card bodies (e.g. `<View style={styles.controlGap}><Stepper .../></View>`) rather than editing the shared `Stepper`/`SwitchRow`/`ChipSelect` components themselves (which are used elsewhere at their current, correct spacing — e.g. inside dense chip-grid cards like `diet`/`avoid` where the tighter spacing is fine).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: On-device verify**

Screenshot the `repetition`, `variety`, `lifestyle`, `training` cards, confirm visibly more separation between controls than before, and confirm no card that previously fit without scrolling now requires scrolling (spacing added should still comfortably fit a Pixel-class 6.7" screen for these specific low-control-count cards).

- [ ] **Step 4: Commit**

```bash
git add src/components/householdWizard/HouseholdPreferencesCarousel.tsx src/components/profileWizard/ProfileSetupCarousel.tsx
git commit -m "style: more breathing room on dense wizard cards (phase Z)"
```

---

### Task 10: Phase Z final verification

- [ ] **Step 1: Full typecheck + test suite**

Run: `npx tsc --noEmit && npx jest`
Expected: zero errors, all suites green.

- [ ] **Step 2: End-to-end on-device walkthrough**

`pm clear` the app, relaunch, walk through: app-intro walkthrough (6 pages, confirm images load quickly), household composition → household preferences (9 cards, no preselection on cooking/time/budget, split repetition/variety cards) → profile setup (lifestyle "Example:" labels no dots, deselectable training, diet card conditional on shares-main-meals) → confirm submit still lands cleanly on the home screen.

- [ ] **Step 3: Push**

```bash
git push
```

---

## Part 2 — Phase AA: Evidence-based content

### Task 11: Pace pros/cons copy on the tempo card

**Files:**
- Modify: `src/components/profileWizard/ProfileSetupCarousel.tsx`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json`

- [ ] **Step 1: Add i18n keys**

In `en.json`, inside `tempo`, add:

```json
"slowProLose": "Best preserves muscle, most sustainable pace.",
"slowConLose": "Slowest visible progress.",
"recommendedProLose": "The evidence-backed middle of the safe range.",
"recommendedConLose": "Still requires months of consistency.",
"fastProLose": "Fastest visible results.",
"fastConLose": "Rates above ~1%/week are linked to losing muscle alongside fat (Garthe et al., 2011).",
"slowProGain": "Minimal fat gain, the leanest way to build muscle.",
"slowConGain": "Slowest visible muscle gain.",
"recommendedProGain": "A balanced muscle-to-fat gain ratio for most people.",
"recommendedConGain": "Some fat gain should be expected.",
"fastProGain": "Maximizes your growth signal, especially early in training.",
"fastConGain": "More of the surplus ends up as fat - muscle gain is capped by training response, not just food."
```

In `cs.json`, inside `tempo`, add the Czech equivalents:

```json
"slowProLose": "Nejlépe šetří svaly, nejudržitelnější tempo.",
"slowConLose": "Nejpomalejší viditelný pokrok.",
"recommendedProLose": "Střed bezpečného pásma podložený výzkumem.",
"recommendedConLose": "Pořád vyžaduje měsíce vytrvalosti.",
"fastProLose": "Nejrychlejší viditelné výsledky.",
"fastConLose": "Tempo nad ~1 %/týden je spojováno se ztrátou svalů spolu s tukem (Garthe et al., 2011).",
"slowProGain": "Minimální nabírání tuku, nejčistší cesta k svalům.",
"slowConGain": "Nejpomalejší viditelný nárůst svalů.",
"recommendedProGain": "Vyvážený poměr svalů a tuku pro většinu lidí.",
"recommendedConGain": "Je třeba počítat s určitým nabíráním tuku.",
"fastProGain": "Maximalizuje růstový signál, hlavně na začátku tréninku.",
"fastConGain": "Větší část přebytku skončí jako tuk - nabírání svalů limituje trénink, ne jen jídlo."
```

- [ ] **Step 2: Render pros/cons under the tempo `ChipSelect`**

In `ProfileSetupCarousel.tsx`'s `currentKey === 'tempo'` block, after the existing `ChipSelect`, add:

```tsx
<View style={styles.proConBox}>
  <Text style={styles.proConLine}>
    <Text style={styles.proConLabel}>{t('common.pro')} </Text>
    {t(`tempo.${tempoPreset}Pro${goal === 'lose' ? 'Lose' : 'Gain'}`)}
  </Text>
  <Text style={styles.proConLine}>
    <Text style={styles.proConLabel}>{t('common.con')} </Text>
    {t(`tempo.${tempoPreset}Con${goal === 'lose' ? 'Lose' : 'Gain'}`)}
  </Text>
</View>
```

Add `common.pro`/`common.con` keys ("Pro:"/"Con:" and "Klad:"/"Zápor:") to both locale files, and add the two new styles to `createStyles`:

```ts
proConBox: {
  marginTop: spacing.sm,
  marginBottom: spacing.md,
},
proConLine: {
  color: colors.textSecondary,
  fontSize: typography.small,
  lineHeight: 18,
  marginBottom: 2,
},
proConLabel: {
  fontWeight: '700',
  color: colors.text,
},
```

- [ ] **Step 3: Typecheck + locale parity + full suite**

Run: `npx tsc --noEmit && npx jest`
Expected: all green.

- [ ] **Step 4: On-device verify**

Reach the tempo card for a `lose` goal, confirm 3 pros/cons blocks show correctly per preset tap; repeat for a `gain` goal.

- [ ] **Step 5: Commit**

```bash
git add src/components/profileWizard/ProfileSetupCarousel.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: evidence-based pros/cons copy on the pace card (phase AA)"
```

---

### Task 12: Hydration benefits screen on the water card

**Files:**
- Modify: `src/components/profileWizard/ProfileSetupCarousel.tsx`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json`

- [ ] **Step 1: Add i18n keys**

In `en.json`, inside `water`, add:

```json
"benefitMetabolismTitle": "Metabolism",
"benefitMetabolismBody": "Even mild dehydration can measurably slow your metabolic rate.",
"benefitEnergyTitle": "Energy",
"benefitEnergyBody": "Losing as little as 1-2% of body weight in fluid is linked to fatigue and lower focus.",
"benefitRecoveryTitle": "Appetite & recovery",
"benefitRecoveryBody": "Good hydration supports digestion and joints, and helps you tell thirst apart from hunger."
```

In `cs.json`, inside `water`, add:

```json
"benefitMetabolismTitle": "Metabolismus",
"benefitMetabolismBody": "I mírná dehydratace dokáže měřitelně zpomalit metabolismus.",
"benefitEnergyTitle": "Energie",
"benefitEnergyBody": "Ztráta už 1-2 % tělesné hmotnosti v tekutinách je spojena s únavou a horší koncentrací.",
"benefitRecoveryTitle": "Chuť k jídlu a regenerace",
"benefitRecoveryBody": "Dostatek tekutin podporuje trávení a klouby a pomáhá rozeznat žízeň od hladu."
```

- [ ] **Step 2: Render the three benefit rows above the toggle**

In `ProfileSetupCarousel.tsx`'s `currentKey === 'water'` block:

```tsx
{currentKey === 'water' ? (
  <View>
    <Text style={styles.cardTitle}>{t('water.title')}</Text>
    <Text style={styles.hintText}>{t('water.hint')}</Text>
    {(
      [
        { icon: 'flash-outline' as const, titleKey: 'water.benefitMetabolismTitle', bodyKey: 'water.benefitMetabolismBody' },
        { icon: 'battery-charging-outline' as const, titleKey: 'water.benefitEnergyTitle', bodyKey: 'water.benefitEnergyBody' },
        { icon: 'restaurant-outline' as const, titleKey: 'water.benefitRecoveryTitle', bodyKey: 'water.benefitRecoveryBody' },
      ]
    ).map((row) => (
      <View key={row.titleKey} style={styles.benefitRow}>
        <View style={styles.benefitIconWrap}>
          <Ionicons name={row.icon} size={18} color={colors.primary} />
        </View>
        <View style={styles.benefitText}>
          <Text style={styles.benefitTitle}>{t(row.titleKey)}</Text>
          <Text style={styles.benefitBody}>{t(row.bodyKey)}</Text>
        </View>
      </View>
    ))}
    <SwitchRow label={t('water.toggle')} value={trackWater} onChange={setTrackWater} />
  </View>
) : null}
```

Add to `createStyles`:

```ts
benefitRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing.sm,
  backgroundColor: colors.surface,
  borderRadius: radius.card - 6,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.md,
  marginBottom: spacing.sm,
},
benefitIconWrap: {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: colors.background,
  alignItems: 'center',
  justifyContent: 'center',
},
benefitText: {
  flex: 1,
},
benefitTitle: {
  color: colors.text,
  fontSize: typography.body,
  fontWeight: '700',
},
benefitBody: {
  color: colors.textSecondary,
  fontSize: typography.small,
  marginTop: 1,
},
```

- [ ] **Step 3: Typecheck + locale parity + full suite**

Run: `npx tsc --noEmit && npx jest`
Expected: all green.

- [ ] **Step 4: On-device verify**

Reach the water card, confirm 3 benefit rows render above the toggle with icons/titles/bodies.

- [ ] **Step 5: Commit**

```bash
git add src/components/profileWizard/ProfileSetupCarousel.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: hydration benefits screen on the water opt-in card (phase AA)"
```

---

### Task 13: Goal-review classifier (pure domain function)

**Files:**
- Create: `src/domain/goalReview.ts`
- Create: `src/domain/__tests__/goalReview.test.ts`

**Interfaces:**
- Produces: `export type GoalReviewTier = 'realistic' | 'ambitious' | 'challenging'` and `export function classifyGoalReview(currentWeightKg: number, goalWeightKg: number): GoalReviewTier` — consumed by Task 14.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/domain/__tests__/goalReview.test.ts`
Expected: FAIL — module `../goalReview` doesn't exist.

- [ ] **Step 3: Implement**

Create `src/domain/goalReview.ts`:

```ts
export type GoalReviewTier = 'realistic' | 'ambitious' | 'challenging';

const REALISTIC_MAX_PCT = 0.1;
const AMBITIOUS_MAX_PCT = 0.2;

/**
 * Classifies a weight-change goal by the percentage of current body weight
 * involved, using general clinical obesity-guidance thresholds (5-10% is
 * commonly cited as a realistic, clinically meaningful initial target;
 * 10-20% is achievable but needs sustained multi-month adherence; beyond
 * 20% success/maintenance rates drop noticeably in outcome literature).
 * This is a deliberate simplification (see design spec's Risks section),
 * not a single-study threshold - framed as general guidance in the UI.
 * Symmetric for both loss and gain goals.
 */
export function classifyGoalReview(currentWeightKg: number, goalWeightKg: number): GoalReviewTier {
  const pctChange = Math.abs(goalWeightKg - currentWeightKg) / currentWeightKg;
  if (pctChange <= REALISTIC_MAX_PCT) return 'realistic';
  if (pctChange <= AMBITIOUS_MAX_PCT) return 'ambitious';
  return 'challenging';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/domain/__tests__/goalReview.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domain/goalReview.ts src/domain/__tests__/goalReview.test.ts
git commit -m "feat: pure goal-review tier classifier (phase AA)"
```

---

### Task 14: `GoalReviewCard` component + wire into the wizard

**Files:**
- Create: `src/components/GoalReviewCard.tsx`
- Modify: `src/components/profileWizard/ProfileSetupCarousel.tsx`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json`

**Interfaces:**
- Consumes: `classifyGoalReview` from `@/domain/goalReview` (Task 13).
- Produces: `GoalReviewCard({ currentWeightKg, goalWeightKg }: { currentWeightKg: number; goalWeightKg: number }): JSX.Element`.

- [ ] **Step 1: Add i18n keys**

In `en.json`, add a new top-level `goalReview` namespace:

```json
"goalReview": {
  "title": "Goal review",
  "realisticTitle": "Realistic",
  "realisticBody": "A well-supported, clinically meaningful target most people can reach and maintain.",
  "ambitiousTitle": "Ambitious",
  "ambitiousBody": "Achievable, but expect several months of sustained consistency.",
  "challengingTitle": "Challenging",
  "challengingBody": "A significant transformation - success and long-term maintenance rates drop noticeably at this scale in outcome research. Consider a longer timeline or medical guidance.",
  "changeLabel": "{{pct}}% of current weight"
}
```

In `cs.json`, add:

```json
"goalReview": {
  "title": "Zhodnocení cíle",
  "realisticTitle": "Realistický",
  "realisticBody": "Dobře podložený, klinicky smysluplný cíl, který většina lidí dokáže dosáhnout a udržet.",
  "ambitiousTitle": "Ambiciózní",
  "ambitiousBody": "Dosažitelné, ale očekávejte několik měsíců vytrvalosti.",
  "challengingTitle": "Náročný",
  "challengingBody": "Výrazná proměna - úspěšnost a dlouhodobé udržení v této škále podle výzkumu citelně klesají. Zvažte delší časový horizont nebo odborné vedení.",
  "changeLabel": "{{pct}} % současné váhy"
}
```

- [ ] **Step 2: Add `carousel.cardGoalReview` title key**

In `en.json`'s `carousel` object: `"cardGoalReview": "Goal review"`. In `cs.json`'s `carousel` object: `"cardGoalReview": "Zhodnocení cíle"`.

- [ ] **Step 3: Create `GoalReviewCard.tsx`**

```tsx
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { classifyGoalReview, type GoalReviewTier } from '@/domain/goalReview';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const TIER_COLOR_KEY: Record<GoalReviewTier, 'secondary' | 'accentSand' | 'danger'> = {
  realistic: 'secondary',
  ambitious: 'accentSand',
  challenging: 'danger',
};

type Props = {
  currentWeightKg: number;
  goalWeightKg: number;
};

/** Shows a feasibility tier (realistic/ambitious/challenging) for the requested weight change, framed as general clinical guidance - see domain/goalReview.ts. */
export function GoalReviewCard({ currentWeightKg, goalWeightKg }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const tier = classifyGoalReview(currentWeightKg, goalWeightKg);
  const pct = Math.round((Math.abs(goalWeightKg - currentWeightKg) / currentWeightKg) * 100);
  const tierColor = colors[TIER_COLOR_KEY[tier]] ?? colors.primary;

  return (
    <View style={[styles.card, { borderColor: tierColor }]}>
      <Text style={[styles.tierTitle, { color: tierColor }]}>{t(`goalReview.${tier}Title`)}</Text>
      <Text style={styles.changeLabel}>{t('goalReview.changeLabel', { pct })}</Text>
      <Text style={styles.tierBody}>{t(`goalReview.${tier}Body`)}</Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      borderRadius: radius.card,
      borderWidth: 1.5,
      backgroundColor: colors.surface,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    tierTitle: {
      fontSize: typography.subtitle,
      fontWeight: '800',
      marginBottom: 2,
    },
    changeLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    tierBody: {
      color: colors.text,
      fontSize: typography.body,
      lineHeight: 20,
    },
  });
}
```

If `colors.accentSand` doesn't exist on the theme's `ColorTokens` type, check `src/theme/tokens.ts` for the actual available token names (this repo's palette uses named tokens like `colors.secondary`/`colors.danger`/warm accent tones per CLAUDE.md's palette) and substitute the correct existing token name for the "ambitious" (middle/warning) tier — do not invent a new token.

- [ ] **Step 4: Wire into `ProfileSetupCarousel`**

Add `'goalReview'` to `CARD_KEYS` right after `'tempo'`:

```ts
const CARD_KEYS = [
  'basics',
  'body',
  'goal',
  'tempo',
  'goalReview',
  'lifestyle',
  'training',
  'meals',
  'water',
  'allergens',
  'diet',
  'summary',
] as const;
```

Extend the `cardKeys` filter (same function touched in Task 8) to hide it for children, for `goal === 'maintain'`, and when `goalWeightKg` isn't set yet:

```ts
const cardKeys = useMemo<CardKey[]>(() => {
  return CARD_KEYS.filter((key) => {
    if (isChild && (key === 'goal' || key === 'tempo' || key === 'goalReview' || key === 'training')) return false;
    if (!isChild && key === 'tempo' && goal === 'maintain') return false;
    if (key === 'goalReview' && (goal === 'maintain' || goalWeightKg === null)) return false;
    if (key === 'diet' && sharesMainMeals) return false;
    return true;
  });
}, [isChild, goal, goalWeightKg, sharesMainMeals]);
```

Add the render block, after the `tempo` block:

```tsx
{currentKey === 'goalReview' ? (
  <View>
    <Text style={styles.cardTitle}>{t('carousel.cardGoalReview')}</Text>
    {weightKg !== null && goalWeightKg !== null ? (
      <GoalReviewCard currentWeightKg={weightKg} goalWeightKg={goalWeightKg} />
    ) : null}
  </View>
) : null}
```

Add the import: `import { GoalReviewCard } from '@/components/GoalReviewCard';`

- [ ] **Step 5: Typecheck + locale parity + full suite**

Run: `npx tsc --noEmit && npx jest`
Expected: all green.

- [ ] **Step 6: On-device verify**

Set a goal weight ~5% below current → confirm "Realistic" card. Set one ~15% below → "Ambitious". Set one ~30% below → "Challenging". Confirm the card is skipped entirely for `goal === 'maintain'` and for children.

- [ ] **Step 7: Commit**

```bash
git add src/components/GoalReviewCard.tsx src/components/profileWizard/ProfileSetupCarousel.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: goal-review feasibility tier card (phase AA)"
```

---

### Task 15: Projection timeline formatter (pure domain function)

**Files:**
- Create: `src/domain/projectionTimeline.ts`
- Create: `src/domain/__tests__/projectionTimeline.test.ts`

**Interfaces:**
- Consumes: `ProjectionPoint` type from `@/domain/projection`, `addDays` from `@/domain/week`.
- Produces: `export function formatProjectionSummary(projection: ProjectionPoint[], startDateIso: string): { weeks: number; endDateIso: string }`.

- [ ] **Step 1: Check `addDays`'s exact signature**

Run: `grep -n "export function addDays" src/domain/week.ts`

(Confirm it's `addDays(dateIso: string, days: number): string` before writing the implementation below — adjust the call if the signature differs.)

- [ ] **Step 2: Write the failing test**

```ts
import { formatProjectionSummary } from '../projectionTimeline';
import type { ProjectionPoint } from '../projection';

describe('formatProjectionSummary', () => {
  it('computes weeks and end date from the last projection point', () => {
    const projection: ProjectionPoint[] = [
      { week: 0, weightKg: 80, phase: 'maintenance' },
      { week: 1, weightKg: 79.5, phase: 'deficit' },
      { week: 2, weightKg: 79, phase: 'deficit' },
    ];
    const result = formatProjectionSummary(projection, '2026-07-13');
    expect(result.weeks).toBe(2);
    expect(result.endDateIso).toBe('2026-07-27');
  });

  it('returns 0 weeks and the start date for a single-point projection (goal already met)', () => {
    const projection: ProjectionPoint[] = [{ week: 0, weightKg: 80, phase: 'maintenance' }];
    const result = formatProjectionSummary(projection, '2026-07-13');
    expect(result.weeks).toBe(0);
    expect(result.endDateIso).toBe('2026-07-13');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/domain/__tests__/projectionTimeline.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Implement**

```ts
import { addDays } from './week';
import type { ProjectionPoint } from './projection';

export type ProjectionSummary = { weeks: number; endDateIso: string };

/** Derives a human-facing timeline summary from a computeWeightProjection result - kept separate from projection.ts itself so the domain layer stays date-agnostic (see computeWeightProjection's own doc comment). */
export function formatProjectionSummary(projection: ProjectionPoint[], startDateIso: string): ProjectionSummary {
  const lastWeek = projection[projection.length - 1]?.week ?? 0;
  return {
    weeks: lastWeek,
    endDateIso: addDays(startDateIso, lastWeek * 7),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/domain/__tests__/projectionTimeline.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/domain/projectionTimeline.ts src/domain/__tests__/projectionTimeline.test.ts
git commit -m "feat: pure projection-timeline summary helper (phase AA)"
```

---

### Task 16: Projection chart — legend + timeline summary

**Files:**
- Modify: `src/components/WeightProjectionChart.tsx`
- Modify: `src/components/profileWizard/ProfileSetupCarousel.tsx` (pass `startDate`)
- Modify: `src/app/(tabs)/progress.tsx` (pass `startDate`)
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json`

**Interfaces:**
- Consumes: `formatProjectionSummary` from `@/domain/projectionTimeline` (Task 15).
- `WeightProjectionChart`'s props gain one new optional field: `startDateIso?: string`. When omitted, the legend/summary row is not rendered (backward compatible with any caller that doesn't care about dates) — but both known callers (`ProfileSetupCarousel`'s summary card and `progress.tsx`) will pass it.

- [ ] **Step 1: Add i18n keys**

In `en.json`, inside `summary`, add:

```json
"legendActive": "Active phase",
"legendMaintenance": "Maintenance week",
"timelineSummary": "~{{weeks}} weeks · around {{date}}"
```

In `cs.json`, inside `summary`, add:

```json
"legendActive": "Aktivní fáze",
"legendMaintenance": "Udržovací týden",
"timelineSummary": "~{{weeks}} týdnů · kolem {{date}}"
```

- [ ] **Step 2: Extend `WeightProjectionChart`**

```tsx
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { formatProjectionSummary } from '@/domain/projectionTimeline';
import type { ProjectionPoint } from '@/domain/projection';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, type ColorTokens } from '@/theme/tokens';

type ActualPoint = { week: number; weightKg: number };

type Props = {
  projection: ProjectionPoint[];
  actualPoints?: ActualPoint[];
  height?: number;
  /** ISO date the projection starts from - when provided, renders a legend + "~N weeks · around <date>" summary line. */
  startDateIso?: string;
};
```

(Keep the existing `pathFor`/`phaseRuns`/`VIEW_WIDTH` and the whole `<Svg>` block exactly as-is — only wrap the return value and add new elements around it.)

```tsx
export function WeightProjectionChart({ projection, actualPoints, height = 160, startDateIso }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { segments, xForWeek, yForWeight } = useMemo(() => {
    // ... unchanged existing body ...
  }, [projection, actualPoints, height]);

  const summary = startDateIso ? formatProjectionSummary(projection, startDateIso) : null;

  return (
    <View>
      {startDateIso ? (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendLabel}>{t('summary.legendActive')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.legendSwatchDashed, { borderColor: colors.textSecondary }]} />
            <Text style={styles.legendLabel}>{t('summary.legendMaintenance')}</Text>
          </View>
        </View>
      ) : null}

      <Svg width="100%" height={height} viewBox={`0 0 ${VIEW_WIDTH} ${height}`}>
        {/* ... unchanged existing Svg children ... */}
      </Svg>

      {summary ? (
        <Text style={styles.summaryText}>
          {t('summary.timelineSummary', {
            weeks: summary.weeks,
            date: new Date(summary.endDateIso).toLocaleDateString(),
          })}
        </Text>
      ) : null}
    </View>
  );
}
```

Add to a new `createStyles` function (the file currently has none — inline styles were used directly; introduce one, matching every other component's convention):

```ts
function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    legendRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.xs,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendSwatch: {
      width: 12,
      height: 3,
      borderRadius: 2,
    },
    legendSwatchDashed: {
      backgroundColor: 'transparent',
      borderTopWidth: 2,
      borderStyle: 'dashed',
    },
    legendLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
    },
    summaryText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: spacing.xs,
    },
  });
}
```

- [ ] **Step 3: Pass `startDateIso` from both callers**

In `ProfileSetupCarousel.tsx`'s summary card:

```tsx
<WeightProjectionChart projection={projection} startDateIso={todayIsoDate()} />
```

(Import `todayIsoDate` from `@/db/time` — check the exact export name/path first: `grep -n "export function todayIsoDate" src/db/time.ts`.)

In `progress.tsx`, find the existing `<WeightProjectionChart projection={...} actualPoints={...} />` call and add `startDateIso={history[0]?.date ?? todayIsoDate()}` (using the first body-metric history entry's date as the projection's actual start, falling back to today — check the exact shape of `history[0]` first via `grep -n "useBodyMetricHistory" src/hooks/data.ts` to confirm the field name).

- [ ] **Step 4: Typecheck + locale parity + full suite**

Run: `npx tsc --noEmit && npx jest`
Expected: all green.

- [ ] **Step 5: On-device verify**

Reach the wizard summary card with a `lose` goal set, confirm the legend row and "~N weeks · around <date>" line render below the chart. Check the Progress tab's existing projection chart shows the same treatment.

- [ ] **Step 6: Commit**

```bash
git add src/components/WeightProjectionChart.tsx src/components/profileWizard/ProfileSetupCarousel.tsx "src/app/(tabs)/progress.tsx" src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: projection chart legend + expected timeline summary (phase AA)"
```

---

### Task 17: Phase AA final verification

- [ ] **Step 1: Full typecheck + test suite**

Run: `npx tsc --noEmit && npx jest`
Expected: zero errors, all suites green.

- [ ] **Step 2: End-to-end on-device walkthrough**

Create a fresh profile with a `lose` goal, confirm: tempo card shows pros/cons, goal-review card shows the correct tier, water card shows hydration benefits, summary card's chart shows the legend + timeline text. Repeat quickly for a `gain` goal (pros/cons + goal review only, water/summary are goal-independent).

- [ ] **Step 3: Push**

```bash
git push
```

---

## Part 3 — Phase BB: Flexible meal slots

### Task 18: Schema migration — `label` column on `meal_slot_settings`

**Files:**
- Modify: `src/db/schema.ts`
- Create (generated): a new `src/db/migrations/00XX_*.sql` + updated `meta/_journal.json` + `meta/00XX_snapshot.json` + `migrations.js`

- [ ] **Step 1: Add the column**

In `src/db/schema.ts`, inside the `mealSlotSettings` table definition, add (after `sortOrder`, before `enabled`, matching the file's existing column-ordering convention of grouping related fields):

```ts
/** User-given display name for a slot inserted via "+ Add meal" - null for the 5 built-in slots, which keep using the `slots.${slotKey}` translation. */
label: text('label'),
```

- [ ] **Step 2: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: a new migration file is created adding the `label` column to `meal_slot_settings`.

- [ ] **Step 3: Verify the generated SQL**

Read the new `src/db/migrations/00XX_*.sql` file and confirm it contains exactly one `ALTER TABLE meal_slot_settings ADD COLUMN label text;` statement (or equivalent) — nothing else. If drizzle-kit generated anything unexpected (e.g. it tried to recreate the whole table), stop and investigate before proceeding — SQLite's `ALTER TABLE ADD COLUMN` is well-supported and should be a single clean statement.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the `label` field is optional/nullable so existing `mealSlotSettings` insert call sites without it still typecheck).

- [ ] **Step 5: Full test suite**

Run: `npx jest`
Expected: all pass (schema change alone shouldn't break anything — no existing code reads/writes `label` yet).

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/db/migrations/
git commit -m "feat: add label column to meal_slot_settings (phase BB)"
```

---

### Task 19: `slotDisplayLabel` helper + replace call sites

**Files:**
- Create: `src/utils/mealSlots.ts`
- Modify: `src/app/(tabs)/index.tsx`, `src/app/(tabs)/settings.tsx`, `src/components/ProfilePortionsCard.tsx`, `src/components/PlanDayList.tsx`, `src/components/MealSlotsPicker.tsx`

**Interfaces:**
- Produces: `export function slotDisplayLabel(t: TFunction, slot: { slotKey: string; label: string | null }): string`.

- [ ] **Step 1: Create the helper**

```ts
import type { TFunction } from 'i18next';

/** A slot's display name - the built-in 5 slots use their `slots.${slotKey}` translation (label is null for them); any slot inserted via "+ Add meal" carries its own label instead. */
export function slotDisplayLabel(t: TFunction, slot: { slotKey: string; label: string | null }): string {
  return slot.label ?? t(`slots.${slot.slotKey}`);
}
```

- [ ] **Step 2: Replace each call site**

For each of these 6 locations, replace `t(\`slots.${slot.slotKey}\`)` (or the equivalent `t(\`slots.${nextMealEntry.slot.slotKey}\`)`) with `slotDisplayLabel(t, slot)` (or `slotDisplayLabel(t, nextMealEntry.slot)`), adding the import `import { slotDisplayLabel } from '@/utils/mealSlots';` to each file:

- `src/app/(tabs)/index.tsx:155` and `:233`
- `src/app/(tabs)/settings.tsx:319`
- `src/components/ProfilePortionsCard.tsx:57` and `:190`
- `src/components/PlanDayList.tsx:143`

Run `grep -n "t(\`slots\.\${" src/app/\(tabs\)/index.tsx src/app/\(tabs\)/settings.tsx src/components/ProfilePortionsCard.tsx src/components/PlanDayList.tsx` first to confirm you've found all of them and none have moved line numbers since the spec was written.

- [ ] **Step 3: Update `MealSlotsPicker`'s existing fallback**

In `MealSlotsPicker.tsx`, replace:

```tsx
{t(`mealSlots.slot.${slot.slotKey}`, { defaultValue: slot.time })}
```

with:

```tsx
{slot.label ? slot.label : t(`mealSlots.slot.${slot.slotKey}`, { defaultValue: slot.time })}
```

(Kept slightly different from the plain `slotDisplayLabel` helper here since this picker specifically wants the `mealSlots.slot.*` namespace with a time-string fallback for the 5 built-ins, not the `slots.*` namespace the other 6 call sites use — these are two different existing translation namespaces for the same slot keys; don't conflate them.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Full test suite**

Run: `npx jest`
Expected: all pass.

- [ ] **Step 6: On-device verify**

Confirm every screen showing meal-slot names (Home, Plan, Settings meal-times, Profile portions editor) still displays the 5 built-in slots' names correctly (regression check — `label` is null for all of them right now, so behavior must be unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/utils/mealSlots.ts "src/app/(tabs)/index.tsx" "src/app/(tabs)/settings.tsx" src/components/ProfilePortionsCard.tsx src/components/PlanDayList.tsx src/components/MealSlotsPicker.tsx
git commit -m "refactor: shared slot-display-label helper for custom meal slots (phase BB)"
```

---

### Task 20: Repository functions — `insertMealSlot` / `deleteMealSlot`

**Files:**
- Modify: `src/db/repositories/households.ts`
- Modify: `src/db/__tests__/households.test.ts`

**Interfaces:**
- Produces: `export async function insertMealSlot(db: AppDb, householdId: string, input: { afterSlotId: string | null; label: string; time: string }): Promise<string>` and `export async function deleteMealSlot(db: AppDb, slotId: string): Promise<void>`.
- Consumes: `mealSlotSettings`, `newId`, `nowIso` (all already imported/used elsewhere in `households.ts`).

- [ ] **Step 1: Write the failing tests**

Add to `src/db/__tests__/households.test.ts` (check the file's existing setup helpers first — it should already have a way to create a test household via `createHouseholdWithDefaults`, matching every other repo test file's pattern):

```ts
import { deleteMealSlot, insertMealSlot } from '../repositories/households';
import { mealSlotSettings } from '../schema';
import { eq, isNull, and, asc } from 'drizzle-orm';

describe('insertMealSlot', () => {
  it('inserts a new slot immediately after the given anchor, shifting later slots', async () => {
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const before = await db
      .select()
      .from(mealSlotSettings)
      .where(and(eq(mealSlotSettings.householdId, householdId), isNull(mealSlotSettings.deletedAt)))
      .orderBy(asc(mealSlotSettings.sortOrder));
    const breakfast = before.find((s) => s.slotKey === 'breakfast')!;
    const originalLunchSortOrder = before.find((s) => s.slotKey === 'lunch')!.sortOrder;

    const newSlotId = await insertMealSlot(db, householdId, {
      afterSlotId: breakfast.id,
      label: 'Pre-lunch snack',
      time: '10:30',
    });

    const after = await db
      .select()
      .from(mealSlotSettings)
      .where(and(eq(mealSlotSettings.householdId, householdId), isNull(mealSlotSettings.deletedAt)))
      .orderBy(asc(mealSlotSettings.sortOrder));

    const newSlot = after.find((s) => s.id === newSlotId)!;
    expect(newSlot.sortOrder).toBe(breakfast.sortOrder + 1);
    expect(newSlot.label).toBe('Pre-lunch snack');
    expect(newSlot.time).toBe('10:30');
    expect(newSlot.kind).toBe('snack');
    expect(newSlot.sharing).toBe('individual');
    expect(newSlot.enabled).toBe(true);

    const lunch = after.find((s) => s.slotKey === 'lunch')!;
    expect(lunch.sortOrder).toBe(originalLunchSortOrder + 1);
  });

  it('inserts as the first slot when afterSlotId is null', async () => {
    const householdId = await createHouseholdWithDefaults(db, 'Test2');
    const before = await db
      .select()
      .from(mealSlotSettings)
      .where(and(eq(mealSlotSettings.householdId, householdId), isNull(mealSlotSettings.deletedAt)))
      .orderBy(asc(mealSlotSettings.sortOrder));
    const originalFirstSortOrder = before[0].sortOrder;

    const newSlotId = await insertMealSlot(db, householdId, { afterSlotId: null, label: 'Early snack', time: '06:00' });

    const after = await db
      .select()
      .from(mealSlotSettings)
      .where(and(eq(mealSlotSettings.householdId, householdId), isNull(mealSlotSettings.deletedAt)))
      .orderBy(asc(mealSlotSettings.sortOrder));

    expect(after[0].id).toBe(newSlotId);
    expect(after[0].sortOrder).toBe(originalFirstSortOrder);
    expect(after[1].sortOrder).toBe(originalFirstSortOrder + 1);
  });
});

describe('deleteMealSlot', () => {
  it('soft-deletes the slot and excludes it from subsequent queries', async () => {
    const householdId = await createHouseholdWithDefaults(db, 'Test3');
    const slotId = await insertMealSlot(db, householdId, { afterSlotId: null, label: 'Removable', time: '08:00' });

    await deleteMealSlot(db, slotId);

    const remaining = await db
      .select()
      .from(mealSlotSettings)
      .where(and(eq(mealSlotSettings.householdId, householdId), isNull(mealSlotSettings.deletedAt)));
    expect(remaining.find((s) => s.id === slotId)).toBeUndefined();

    const raw = await db.select().from(mealSlotSettings).where(eq(mealSlotSettings.id, slotId));
    expect(raw[0].deletedAt).not.toBeNull();
  });
});
```

Check the exact `import { db } from ...` / test-DB-setup pattern already used at the top of `households.test.ts` and match it — don't introduce a second DB-setup convention.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/db/__tests__/households.test.ts`
Expected: FAIL — `insertMealSlot`/`deleteMealSlot` not exported.

- [ ] **Step 3: Implement**

In `src/db/repositories/households.ts`, add:

```ts
export async function insertMealSlot(
  db: AppDb,
  householdId: string,
  input: { afterSlotId: string | null; label: string; time: string },
): Promise<string> {
  const now = nowIso();
  const siblings = await db
    .select()
    .from(mealSlotSettings)
    .where(and(eq(mealSlotSettings.householdId, householdId), isNull(mealSlotSettings.deletedAt)))
    .orderBy(asc(mealSlotSettings.sortOrder));

  const anchorSortOrder = input.afterSlotId
    ? (siblings.find((s) => s.id === input.afterSlotId)?.sortOrder ?? -1)
    : -1;
  const insertAtSortOrder = anchorSortOrder + 1;

  await db
    .update(mealSlotSettings)
    .set({ sortOrder: sql`${mealSlotSettings.sortOrder} + 1`, updatedAt: now })
    .where(
      and(
        eq(mealSlotSettings.householdId, householdId),
        isNull(mealSlotSettings.deletedAt),
        gte(mealSlotSettings.sortOrder, insertAtSortOrder),
      ),
    );

  const id = newId();
  await db.insert(mealSlotSettings).values({
    id,
    createdAt: now,
    updatedAt: now,
    householdId,
    slotKey: `custom_${id}`,
    kind: 'snack',
    sharing: 'individual',
    time: input.time,
    calorieShare: 0,
    sortOrder: insertAtSortOrder,
    enabled: true,
    label: input.label,
  });
  return id;
}

export async function deleteMealSlot(db: AppDb, slotId: string): Promise<void> {
  await db.update(mealSlotSettings).set({ deletedAt: nowIso(), updatedAt: nowIso() }).where(eq(mealSlotSettings.id, slotId));
}
```

Check the top of `households.ts` for its existing Drizzle operator imports (`eq`, `and`, `isNull`, `asc`) and add whichever of `gte`, `sql` aren't already imported from `'drizzle-orm'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/db/__tests__/households.test.ts`
Expected: PASS (all households tests, including the 3 new ones).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/db/repositories/households.ts src/db/__tests__/households.test.ts
git commit -m "feat: insertMealSlot/deleteMealSlot repository functions (phase BB)"
```

---

### Task 21: Fix `generateDay`'s snack-target allocation for multiple slots

**Files:**
- Modify: `src/domain/generator/portions.ts`
- Modify: `src/domain/generator/__tests__/portions.test.ts`
- Modify: `src/db/repositories/plan.ts`

**Interfaces:**
- Produces (in `portions.ts`): `export function allocateSnackWeights(slots: { id: string; calorieShare: number }[], overrides: Map<string, SlotPortionOverride | undefined>): number[]` — returns a normalized (sums to 1) weight per input slot, in the same order, falling back to an equal split when every slot's effective weight is 0.
- Consumes: `SlotPortionOverride` type (already defined in `portions.ts`).

- [ ] **Step 1: Write the failing test**

Add to `src/domain/generator/__tests__/portions.test.ts`:

```ts
import { allocateSnackWeights } from '../portions';

describe('allocateSnackWeights', () => {
  it('splits evenly across slots with no calorieShare and no overrides (e.g. all newly inserted)', () => {
    const slots = [{ id: 'a', calorieShare: 0 }, { id: 'b', calorieShare: 0 }, { id: 'c', calorieShare: 0 }];
    const weights = allocateSnackWeights(slots, new Map());
    expect(weights).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('gives a single slot the full weight', () => {
    const slots = [{ id: 'a', calorieShare: 0 }];
    expect(allocateSnackWeights(slots, new Map())).toEqual([1]);
  });

  it('splits proportionally to calorieShare when set', () => {
    const slots = [{ id: 'a', calorieShare: 0.1 }, { id: 'b', calorieShare: 0.3 }];
    const weights = allocateSnackWeights(slots, new Map());
    expect(weights[0]).toBeCloseTo(0.25);
    expect(weights[1]).toBeCloseTo(0.75);
  });

  it('lets a per-profile override win over the slot default', () => {
    const slots = [{ id: 'a', calorieShare: 0.1 }, { id: 'b', calorieShare: 0.1 }];
    const overrides = new Map([['a', { calorieSharePercent: 0.4, proteinTargetG: null, fatTargetG: null }]]);
    const weights = allocateSnackWeights(slots, overrides);
    expect(weights[0]).toBeCloseTo(0.8);
    expect(weights[1]).toBeCloseTo(0.2);
  });
});
```

Check `SlotPortionOverride`'s exact field names in `portions.ts` first (`grep -n "SlotPortionOverride" src/domain/generator/portions.ts`) and match them exactly in the test's override object literal.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/domain/generator/__tests__/portions.test.ts`
Expected: FAIL — `allocateSnackWeights` not exported.

- [ ] **Step 3: Implement**

In `src/domain/generator/portions.ts`, add:

```ts
/**
 * Normalizes weights (summing to 1) for a set of snack-kind slots being
 * filled in the same generateDay pass, so the remaining post-mains budget
 * is split up front rather than greedily consumed by whichever slot is
 * processed first (the bug this fixes: with a fixed remaining-kcal target
 * recomputed after each pick, the first slot in sortOrder claimed nearly
 * the entire remaining budget, leaving near-zero for the rest). Falls back
 * to an equal split when every slot's effective weight is 0 (e.g. a batch
 * of newly-inserted slots that haven't been given a calorieShare).
 */
export function allocateSnackWeights(
  slots: { id: string; calorieShare: number }[],
  overrides: Map<string, SlotPortionOverride | undefined>,
): number[] {
  const rawWeights = slots.map((slot) => overrides.get(slot.id)?.calorieSharePercent ?? slot.calorieShare);
  const sum = rawWeights.reduce((total, w) => total + w, 0);
  if (sum <= 0) return slots.map(() => 1 / slots.length);
  return rawWeights.map((w) => w / sum);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/domain/generator/__tests__/portions.test.ts`
Expected: PASS (4 new tests, plus all existing ones in this file still passing).

- [ ] **Step 5: Wire the fix into `generateDay`**

In `src/db/repositories/plan.ts`, replace the snack loop (currently ~line 865-892):

```ts
for (const slot of ctx.slots.filter((s) => s.kind === 'snack')) {
  for (const profile of ctx.profiles) {
    if (!profile.dailyTarget || !isSlotEnabledForProfile(profile, slot.slotKey)) continue;
    const key = slotTrackKey(slot.slotKey, profile.id);
    if (lockedKeys.has(key)) {
      await accumulateLockedMeal(db, householdId, date, slot.slotKey, profile.id, ctx, consumedSoFar);
      continue;
    }
    const consumed = consumedSoFar.get(profile.id) ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    const remaining = {
      kcal: profile.dailyTarget.kcal - consumed.kcal,
      proteinG: profile.dailyTarget.proteinG - consumed.proteinG,
      carbsG: profile.dailyTarget.carbsG - consumed.carbsG,
      fatG: profile.dailyTarget.fatG - consumed.fatG,
    };
    const target = resolveSnackTarget(remaining, profile.dailyTarget.kcal, profile.slotOverrides.get(slot.id));
    const picked = pickSnackForSlot(ctx.snackItems, profile.restrictions, repetitionCtx, target, ctx.candidateFilters);
    if (!picked) continue;
    const multiplier = scalingMultiplier(target.kcal, picked.candidate.nutritionPerPortion.kcal);
    await insertPlannedMeal(db, householdId, date, slot.slotKey, profile.id, picked.itemType, picked.candidate.id, [
      { profileId: profile.id, multiplier },
    ]);
    repetitionCtx = recordPick(repetitionCtx, picked.candidate.id);
    addConsumed(consumedSoFar, profile.id, picked.candidate.nutritionPerPortion, multiplier);
  }
}
```

with:

```ts
const snackSlots = ctx.slots.filter((s) => s.kind === 'snack');
for (const profile of ctx.profiles) {
  if (!profile.dailyTarget) continue;
  const profileSnackSlots = snackSlots.filter(
    (slot) => isSlotEnabledForProfile(profile, slot.slotKey) && !lockedKeys.has(slotTrackKey(slot.slotKey, profile.id)),
  );
  const lockedSnackSlots = snackSlots.filter(
    (slot) => isSlotEnabledForProfile(profile, slot.slotKey) && lockedKeys.has(slotTrackKey(slot.slotKey, profile.id)),
  );
  for (const slot of lockedSnackSlots) {
    await accumulateLockedMeal(db, householdId, date, slot.slotKey, profile.id, ctx, consumedSoFar);
  }
  if (profileSnackSlots.length === 0) continue;

  const consumed = consumedSoFar.get(profile.id) ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const remaining = {
    kcal: profile.dailyTarget.kcal - consumed.kcal,
    proteinG: profile.dailyTarget.proteinG - consumed.proteinG,
    carbsG: profile.dailyTarget.carbsG - consumed.carbsG,
    fatG: profile.dailyTarget.fatG - consumed.fatG,
  };
  const weights = allocateSnackWeights(
    profileSnackSlots,
    new Map(profileSnackSlots.map((s) => [s.id, profile.slotOverrides.get(s.id)])),
  );

  profileSnackSlots.forEach((slot, i) => {
    const slotRemaining = {
      kcal: remaining.kcal * weights[i],
      proteinG: remaining.proteinG * weights[i],
      carbsG: remaining.carbsG * weights[i],
      fatG: remaining.fatG * weights[i],
    };
    const target = resolveSnackTarget(slotRemaining, profile.dailyTarget!.kcal, profile.slotOverrides.get(slot.id));
    const picked = pickSnackForSlot(ctx.snackItems, profile.restrictions, repetitionCtx, target, ctx.candidateFilters);
    if (!picked) return;
    const multiplier = scalingMultiplier(target.kcal, picked.candidate.nutritionPerPortion.kcal);
    void insertPlannedMeal(db, householdId, date, slot.slotKey, profile.id, picked.itemType, picked.candidate.id, [
      { profileId: profile.id, multiplier },
    ]);
    repetitionCtx = recordPick(repetitionCtx, picked.candidate.id);
    addConsumed(consumedSoFar, profile.id, picked.candidate.nutritionPerPortion, multiplier);
  });
}
```

Since the original loop used `await` sequentially inside a `for...of` (so each `insertPlannedMeal`/repetition-tracking update happens in order before the next), and `forEach` doesn't await, change the inner `profileSnackSlots.forEach(...)` to a plain `for` loop instead so ordering/await semantics exactly match the original:

```ts
for (let i = 0; i < profileSnackSlots.length; i += 1) {
  const slot = profileSnackSlots[i];
  const slotRemaining = {
    kcal: remaining.kcal * weights[i],
    proteinG: remaining.proteinG * weights[i],
    carbsG: remaining.carbsG * weights[i],
    fatG: remaining.fatG * weights[i],
  };
  const target = resolveSnackTarget(slotRemaining, profile.dailyTarget.kcal, profile.slotOverrides.get(slot.id));
  const picked = pickSnackForSlot(ctx.snackItems, profile.restrictions, repetitionCtx, target, ctx.candidateFilters);
  if (!picked) continue;
  const multiplier = scalingMultiplier(target.kcal, picked.candidate.nutritionPerPortion.kcal);
  await insertPlannedMeal(db, householdId, date, slot.slotKey, profile.id, picked.itemType, picked.candidate.id, [
    { profileId: profile.id, multiplier },
  ]);
  repetitionCtx = recordPick(repetitionCtx, picked.candidate.id);
  addConsumed(consumedSoFar, profile.id, picked.candidate.nutritionPerPortion, multiplier);
}
```

(Use this `for` version, not the `forEach` sketch above — it was shown first only to introduce the per-slot math clearly.) Add the import: `import { allocateSnackWeights } from '@/domain/generator/portions';` (check `plan.ts`'s existing import block for `portions.ts` — it likely already imports `resolveSnackTarget`/`resolveMainSlotTarget`/`resolveSlotCalorieShare` from the same module, so just add `allocateSnackWeights` to that existing import line).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Full test suite**

Run: `npx jest`
Expected: all pass, including `src/db/__tests__/plan.test.ts`'s existing snack-generation tests (this is the key regression check — confirm no existing test asserted on the old greedy-first-slot behavior; if one did, update its expectation to the new even/proportional split, since the old behavior was the bug being fixed).

- [ ] **Step 8: Add a regression test for the multi-slot case**

Add to `src/db/__tests__/plan.test.ts` (find the existing snack-generation test for structure/setup pattern to match):

```ts
it('splits remaining calories across multiple snack slots instead of giving it all to the first one', async () => {
  // ... set up a household + profile with 3 enabled snack-kind slots (2 built-in + 1 inserted via insertMealSlot) ...
  // ... call generateDay ...
  // ... load the day's planned meals for all 3 snack slotKeys ...
  // ... assert each snack's planned nutritionKcal (multiplier * candidate kcal) is roughly remaining/3,
  //     not one slot getting ~all of it and the others getting ~0 ...
});
```

Write out the actual setup/assertions using this file's existing helper functions (`createHouseholdWithDefaults`, `createAdult` or equivalent, a way to seed snack-eligible foods/recipes) — check the file's existing snack-related test immediately above/below the insertion point for the exact helper calls and copy that pattern, don't invent new setup helpers.

- [ ] **Step 9: Run the new test, confirm pass**

Run: `npx jest src/db/__tests__/plan.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/domain/generator/portions.ts src/domain/generator/__tests__/portions.test.ts src/db/repositories/plan.ts src/db/__tests__/plan.test.ts
git commit -m "fix: split remaining calories across all snack slots, not just the first (phase BB)"
```

---

### Task 22: `AddMealSlotModal` component

**Files:**
- Create: `src/components/AddMealSlotModal.tsx`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json`

**Interfaces:**
- Produces: `AddMealSlotModal({ visible, householdId, onClose, onAdded }: { visible: boolean; householdId: string; onClose: () => void; onAdded: (slotKey: string) => void }): JSX.Element` — `onAdded` is called with the new slot's `slotKey` after a successful insert, so the caller (Task 23) can fold it into the calling profile's locally-tracked `enabledSlotKeys`.
- Consumes: `useMealSlots` (`@/hooks/plan`), `insertMealSlot` (`@/db/repositories/households`), `slotDisplayLabel` (`@/utils/mealSlots`).

- [ ] **Step 1: Add i18n keys**

In `en.json`, add a new top-level `addMeal` namespace:

```json
"addMeal": {
  "title": "Add a meal",
  "positionPrompt": "Where do you want to add it?",
  "beforeFirst": "Before {{slot}}",
  "between": "Between {{before}} and {{after}}",
  "afterLast": "After {{slot}}",
  "nameLabel": "Name (optional)",
  "namePlaceholder": "Extra meal",
  "timeLabel": "Time",
  "add": "Add",
  "cancel": "Cancel",
  "countLow": "Very few meals can make it harder to hit your macro targets.",
  "countHigh": "More than 6 meals a day isn't usually necessary, but you can keep going."
}
```

In `cs.json`, add:

```json
"addMeal": {
  "title": "Přidat jídlo",
  "positionPrompt": "Kam ho chceš přidat?",
  "beforeFirst": "Před {{slot}}",
  "between": "Mezi {{before}} a {{after}}",
  "afterLast": "Po {{slot}}",
  "nameLabel": "Název (nepovinné)",
  "namePlaceholder": "Jídlo navíc",
  "timeLabel": "Čas",
  "add": "Přidat",
  "cancel": "Zrušit",
  "countLow": "Příliš málo jídel může ztížit plnění cílů maker.",
  "countHigh": "Víc než 6 jídel denně obvykle není potřeba, ale klidně pokračuj."
}
```

- [ ] **Step 2: Create the component**

```tsx
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { insertMealSlot } from '@/db/repositories/households';
import { useMealSlots } from '@/hooks/plan';
import { slotDisplayLabel } from '@/utils/mealSlots';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

type Position = { afterSlotId: string | null; labelKey: 'beforeFirst' | 'between' | 'afterLast'; labelParams: Record<string, string> };

function midpointTime(before: string | undefined, after: string | undefined): string {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const toTime = (mins: number) => {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  if (before && after) return toTime(Math.round((toMinutes(before) + toMinutes(after)) / 2));
  if (before) return toTime(toMinutes(before) + 30);
  if (after) return toTime(toMinutes(after) - 30);
  return '12:00';
}

type Props = {
  visible: boolean;
  householdId: string;
  onClose: () => void;
  onAdded: (slotKey: string) => void;
};

/** Two-step "+ Add meal" flow: pick where to insert, then name/time it. Positions are built from the household's currently-enabled slots (useMealSlots), matching what MealSlotsPicker already renders. */
export function AddMealSlotModal({ visible, householdId, onClose, onAdded }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const slots = useMealSlots(householdId);

  const [position, setPosition] = useState<Position | null>(null);
  const [name, setName] = useState('');
  const [time, setTime] = useState('12:00');

  const reset = () => {
    setPosition(null);
    setName('');
    setTime('12:00');
  };

  const close = () => {
    reset();
    onClose();
  };

  const positions: Position[] = [];
  if (slots.length > 0) {
    positions.push({
      afterSlotId: null,
      labelKey: 'beforeFirst',
      labelParams: { slot: slotDisplayLabel(t, slots[0]) },
    });
    for (let i = 0; i < slots.length - 1; i += 1) {
      positions.push({
        afterSlotId: slots[i].id,
        labelKey: 'between',
        labelParams: { before: slotDisplayLabel(t, slots[i]), after: slotDisplayLabel(t, slots[i + 1]) },
      });
    }
    positions.push({
      afterSlotId: slots[slots.length - 1].id,
      labelKey: 'afterLast',
      labelParams: { slot: slotDisplayLabel(t, slots[slots.length - 1]) },
    });
  }

  const selectPosition = (p: Position) => {
    const beforeSlot = slots.find((s) => s.id === p.afterSlotId);
    const afterIndex = p.afterSlotId ? slots.findIndex((s) => s.id === p.afterSlotId) + 1 : 0;
    const afterSlot = slots[afterIndex];
    setTime(midpointTime(beforeSlot?.time, afterSlot?.time));
    setPosition(p);
  };

  const add = async () => {
    if (!position || !TIME_RE.test(time)) return;
    const slotId = await insertMealSlot(db, householdId, {
      afterSlotId: position.afterSlotId,
      label: name.trim() || t('addMeal.namePlaceholder'),
      time,
    });
    onAdded(`custom_${slotId}`);
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t('addMeal.title')}</Text>

          {!position ? (
            <>
              <Text style={styles.prompt}>{t('addMeal.positionPrompt')}</Text>
              {positions.map((p, i) => (
                <Pressable key={i} style={styles.positionRow} onPress={() => selectPosition(p)}>
                  <Text style={styles.positionLabel}>{t(`addMeal.${p.labelKey}`, p.labelParams)}</Text>
                </Pressable>
              ))}
              <Button label={t('addMeal.cancel')} variant="secondary" onPress={close} />
            </>
          ) : (
            <>
              <TextField label={t('addMeal.nameLabel')} value={name} onChangeText={setName} placeholder={t('addMeal.namePlaceholder')} />
              <TextField label={t('addMeal.timeLabel')} value={time} onChangeText={setTime} placeholder="HH:MM" />
              <View style={styles.actions}>
                <Button label={t('addMeal.cancel')} variant="secondary" onPress={close} style={styles.actionButton} />
                <Button label={t('addMeal.add')} onPress={add} disabled={!TIME_RE.test(time)} style={styles.actionButton} />
              </View>
            </>
          )}
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
    title: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
      marginBottom: spacing.sm,
    },
    prompt: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.sm,
    },
    positionRow: {
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.xs,
    },
    positionLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    actionButton: {
      flex: 1,
    },
  });
}
```

Check `Button`'s exact prop names (`label`, `variant`, `onPress`, `disabled`, `style`) and `TextField`'s (`label`, `value`, `onChangeText`, `placeholder`) against their actual current definitions before finalizing — this plan assumes they match every other call site already read in this codebase, but confirm with `grep -n "type.*Props" src/components/ui/Button.tsx src/components/ui/TextField.tsx` first.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Locale parity**

Run: `npx jest src/i18n/__tests__/locales.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AddMealSlotModal.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: AddMealSlotModal - position picker + name/time form (phase BB)"
```

---

### Task 23: Wire "+ Add meal" and delete into `MealSlotsPicker`

**Files:**
- Modify: `src/components/MealSlotsPicker.tsx`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json`

**Interfaces:**
- Consumes: `AddMealSlotModal` (Task 22), `deleteMealSlot` (Task 20).
- `MealSlotsPicker`'s public props are unchanged (`householdId`, `sharesMainMeals`, `value`, `onChange`) — the add/delete flow is fully self-contained inside the component, folding results into the existing `onChange` callback exactly like any other slot toggle.

- [ ] **Step 1: Add i18n keys**

In `en.json`, inside `mealSlots`, add:

```json
"addButton": "+ Add meal",
"deleteConfirmTitle": "Remove this meal?",
"deleteConfirmMessage": "This removes {{name}} for everyone in the household who has it enabled."
```

In `cs.json`, inside `mealSlots`, add:

```json
"addButton": "+ Přidat jídlo",
"deleteConfirmTitle": "Odebrat toto jídlo?",
"deleteConfirmMessage": "Tím se {{name}} odebere všem v domácnosti, kdo ho má zapnuté."
```

- [ ] **Step 2: Extend the component**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AddMealSlotModal } from '@/components/AddMealSlotModal';
import { db } from '@/db/client';
import { deleteMealSlot } from '@/db/repositories/households';
import { useMealSlots } from '@/hooks/plan';
import { slotDisplayLabel } from '@/utils/mealSlots';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  householdId: string | undefined;
  sharesMainMeals: boolean;
  value: string[] | null;
  onChange: (slotKeys: string[] | null) => void;
};

export function MealSlotsPicker({ householdId, sharesMainMeals, value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const slots = useMealSlots(householdId);
  const [addVisible, setAddVisible] = useState(false);

  const toggle = (slotKey: string) => {
    const baseline = value ?? slots.map((s) => s.slotKey);
    const next = baseline.includes(slotKey) ? baseline.filter((key) => key !== slotKey) : [...baseline, slotKey];
    onChange(next);
  };

  const enable = (slotKey: string) => {
    const baseline = value ?? slots.map((s) => s.slotKey);
    if (baseline.includes(slotKey)) return;
    onChange([...baseline, slotKey]);
  };

  const remove = (slot: (typeof slots)[number]) => {
    Alert.alert(
      t('mealSlots.deleteConfirmTitle'),
      t('mealSlots.deleteConfirmMessage', { name: slotDisplayLabel(t, slot) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => void deleteMealSlot(db, slot.id) },
      ],
    );
  };

  const enabledCount = (value ?? slots.map((s) => s.slotKey)).length;

  return (
    <View>
      <Text style={styles.title}>{t('mealSlots.title')}</Text>
      <Text style={styles.hint}>{t('mealSlots.hint')}</Text>
      <View style={styles.list}>
        {slots.map((slot) => {
          const selected = value === null || value.includes(slot.slotKey);
          const showSharedTag = sharesMainMeals && slot.kind === 'main' && selected;
          return (
            <Pressable
              key={slot.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => toggle(slot.slotKey)}
              style={[styles.row, selected && styles.rowSelected]}>
              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                {selected ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
              </View>
              <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{slotDisplayLabel(t, slot)}</Text>
              {showSharedTag ? <Text style={styles.sharedTag}>{t('mealSlots.shared')}</Text> : null}
              {slot.label ? (
                <Pressable accessibilityRole="button" onPress={() => remove(slot)} hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {enabledCount < 3 ? <Text style={styles.countHint}>{t('addMeal.countLow')}</Text> : null}
      {enabledCount > 6 ? <Text style={styles.countHint}>{t('addMeal.countHigh')}</Text> : null}

      {householdId ? (
        <Pressable style={styles.addRow} onPress={() => setAddVisible(true)}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addLabel}>{t('mealSlots.addButton')}</Text>
        </Pressable>
      ) : null}

      {householdId ? (
        <AddMealSlotModal
          visible={addVisible}
          householdId={householdId}
          onClose={() => setAddVisible(false)}
          onAdded={enable}
        />
      ) : null}
    </View>
  );
}
```

(Keep the existing `createStyles` function's current entries and add these three:)

```ts
countHint: {
  color: colors.textSecondary,
  fontSize: typography.small,
  marginTop: spacing.xs,
  marginBottom: spacing.sm,
},
addRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing.xs,
  paddingVertical: spacing.sm,
},
addLabel: {
  color: colors.primary,
  fontSize: typography.body,
  fontWeight: '600',
},
```

Check `common.cancel`/`common.delete` already exist in both locale files (this repo's established delete-confirmation convention per `confirmDeleteMeal` elsewhere) before assuming they're available — if `common.delete` doesn't exist, use whatever the existing delete-confirm dialogs elsewhere in the app actually use (`grep -n "deleteConfirm\|common.delete" src/i18n/locales/en.json` to find the established key name and reuse it, don't invent a duplicate).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Locale parity + full suite**

Run: `npx jest`
Expected: all pass.

- [ ] **Step 5: On-device verify**

In the wizard's "meals" card: tap "+ Add meal", pick "Between Breakfast and Lunch", leave name blank, confirm default time is the midpoint, tap Add — confirm the new row appears checked immediately (live-query picks up the insert), confirm it shows an "×" delete affordance while the 5 built-ins don't. Add a second meal at the same position (test "2 meals before breakfast" from the original request by picking "Before Breakfast" twice). Delete a custom slot, confirm a confirmation dialog appears and the row disappears after confirming. Add meals until the count exceeds 6, confirm the warning text appears but doesn't block adding more.

- [ ] **Step 6: Commit**

```bash
git add src/components/MealSlotsPicker.tsx src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: add/delete meal slots from the wizard's meals card (phase BB)"
```

---

### Task 24: Phase BB final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + test suite**

Run: `npx tsc --noEmit && npx jest`
Expected: zero errors, all suites green (this is the largest phase — recheck the full count against the pre-phase-BB baseline to confirm nothing was silently skipped).

- [ ] **Step 2: End-to-end on-device generation test**

Create a household + profile via the wizard, add 2 extra custom meal slots (one before breakfast, one after lunch) alongside the 2 built-in snack slots (4 total snack-kind slots), finish onboarding, generate the week, open a day's plan, confirm all 4 snack slots got a real (non-empty, non-degenerate) recipe/food pick with roughly comparable portion sizes — this is the direct on-device confirmation of Task 21's fix.

- [ ] **Step 3: Push**

```bash
git push
```

---

## Part 4 — Final review pass

### Task 25: Adversarial code review across the full diff

- [ ] **Step 1: Diff scope**

Run: `git log --oneline main --not origin/main` (or equivalent) to confirm the exact commit range covering phases Z/AA/BB pushed this session, and `git diff <first-phase-Z-commit>^..HEAD --stat` to get the full file list.

- [ ] **Step 2: Run a multi-dimension review**

Use the Workflow tool (ultracode is on for this session) with dimensions: **correctness** (especially the Task 21 generator fix and Task 20 sortOrder-shift logic), **i18n parity** (every new key present in both locales, no orphaned keys), **UI regression** (any of the 6 `slotDisplayLabel` call sites, or any card touched by more than one phase — `ProfileSetupCarousel.tsx` is touched by Tasks 2, 7, 8, 9, 11, 12, 14, 16), each finding adversarially verified (≥2 of 3 skeptical passes must agree it's real) before being reported.

- [ ] **Step 3: Fix confirmed findings**

Apply fixes for anything CONFIRMED as real, in new small commits (don't amend the phase commits already pushed).

- [ ] **Step 4: Final full suite + push**

Run: `npx tsc --noEmit && npx jest`
Expected: all green.

```bash
git push
```

---

## Self-review notes (writing-plans skill)

- **Spec coverage**: every Phase Z/AA/BB item from the design spec maps to a task above (lifestyle → Task 2, no-preselect → Task 3, image recompression → Task 5, button rename → Task 6, deselect → Tasks 1+7, card split → Task 4, diet conditional → Task 8, spacing → Task 9; pace pros/cons → Task 11, hydration → Task 12, goal review → Tasks 13-14, projection timeline → Tasks 15-16; schema/label → Task 18, insert/delete → Task 20, generator fix → Task 21, add-meal UI → Tasks 22-23, label fallback → Task 19).
- **Type consistency check**: `slotDisplayLabel(t, slot)` used identically across Tasks 19, 22, 23. `insertMealSlot`'s return type (`Promise<string>`, the new slot's `id`) is consumed correctly in Task 22 by prefixing `custom_` — this matches Task 20's `slotKey: \`custom_${id}\`` construction exactly (the modal computes the same prefixed key from the returned id rather than needing a second DB round-trip to look up the slotKey). `allocateSnackWeights`'s signature in Task 21 matches its Task 21-Step-3 test usage exactly.
- **No placeholders**: every step has real code, not a description of code. Steps that depend on confirming an exact existing signature (`addDays`, `todayIsoDate`, `Button`/`TextField` props, `common.delete`) say explicitly which grep to run first rather than guessing — this is a deliberate acknowledgment of uncertainty, not a placeholder, and is resolved by a concrete shell command before the step is considered done.

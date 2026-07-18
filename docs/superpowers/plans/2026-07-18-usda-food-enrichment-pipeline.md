# USDA/OFF Food Data Enrichment Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle USDA FoodData Central (Foundation + SR Legacy, ~8,000 generic foods) locally so the food library has real macro+micronutrient coverage beyond the 74 hand-curated foods, while keeping the household's allergen safety guarantees intact for anything that wasn't manually reviewed.

**Architecture:** A one-time, offline dev-tool import (CSV → generated TS seed file, committed to the repo like the existing curated seed) merges into `seedIfEmpty` alongside the current 74 foods. Every bulk-imported food carries a `needsReview: true` flag and heuristically-derived (not guaranteed) allergen tags. The generator's hard allergy filter is changed to treat `needsReview` foods as **excluded**, not "missing data ≠ 0", for any profile with an active allergy — a deliberate, documented exception to the app's usual silent-skip convention. Open Food Facts stays exactly as it is today (live barcode lookup only, no bulk cache), just extended to also capture NOVA/Nutri-Score/Eco-Score/category fields it already returns for free. A branded-item → nearest-generic-USDA matching service fills missing micronutrients on scanned products, never inventing a number.

**Tech Stack:** Existing stack (Expo/RN, Drizzle+SQLite, TypeScript, Jest). New: a Node-only import script (`ts-node`, devDependency) that never ships in the app bundle. No AI/LLM calls in this plan — deferred (see Global Constraints).

## Global Constraints

- **No AI/LLM enrichment in this plan.** Explicitly deferred by the user (2026-07-18): the app has zero existing LLM integration, and the marginal value (name disambiguation, category tagging, translation) is mostly already covered by structured data OFF/USDA already provide. If revisited later, use a free-tier hosted open-weight model (e.g. via OpenRouter), never on-device (a phone can't practically run a quality model), never a paid-by-default API.
- **No bulk import of USDA Branded Foods** (~450k US commercial products) — low relevance to a Czech household, would bloat the local DB for near-zero benefit. Branded products stay OFF's job (live lookup).
- **OFF stays live-query-only.** No bulk OFF cache. Nothing changes about `src/services/openFoodFacts.ts`'s "fetch on barcode scan, never throws, manual entry is always the fallback" contract except the fields it extracts.
- **Missing data is still never treated as 0** — except allergen safety for `needsReview` foods, which is the one deliberate exception (see Task 6). Every other missing field (micronutrients, NOVA, etc.) keeps the existing silent-skip convention.
- **No `db.transaction()`** (dual-driver conflict between expo-sqlite and better-sqlite3, per existing project convention).
- Commit after each task; `npx tsc --noEmit && npx jest` per task.

---

### Task 1: Provenance/needsReview domain types + schema migration

**Files:**
- Create: `src/domain/nutrientProvenance.ts`
- Modify: `src/db/schema.ts` (`foods` table)
- Create: drizzle migration (generate via `npx drizzle-kit generate`)
- Test: `src/domain/__tests__/nutrientProvenance.test.ts`

**Interfaces:**
- Produces: `ProvenanceSource = 'usda_foundation' | 'usda_sr_legacy' | 'off_label' | 'user_entered'`, `type NutrientConfidence = 'high' | 'medium' | 'low'`, `isTrustedForAllergySafety(needsReview: boolean): boolean` (returns `!needsReview` — trivial today, exists so the one safety rule has a single named call site instead of being re-derived inline everywhere it matters).

- [ ] **Step 1: Write the domain types**

```typescript
// src/domain/nutrientProvenance.ts
export type ProvenanceSource = 'usda_foundation' | 'usda_sr_legacy' | 'off_label' | 'user_entered';
export type NutrientConfidence = 'high' | 'medium' | 'low';

/**
 * A food is safe to auto-suggest to a profile with an active allergy only
 * once a human has looked at it. Bulk-imported/heuristically-tagged foods
 * start as needsReview=true; user-entered and hand-curated seed foods are
 * never review-gated. This is the one place the app's usual "missing data
 * != 0" rule is deliberately overridden for safety.
 */
export function isTrustedForAllergySafety(needsReview: boolean): boolean {
  return !needsReview;
}
```

- [ ] **Step 2: Write the (trivial but documented) test**

```typescript
// src/domain/__tests__/nutrientProvenance.test.ts
import { isTrustedForAllergySafety } from '../nutrientProvenance';

describe('isTrustedForAllergySafety', () => {
  it('trusts a reviewed food', () => expect(isTrustedForAllergySafety(false)).toBe(true));
  it('does not trust an unreviewed food', () => expect(isTrustedForAllergySafety(true)).toBe(false));
});
```

- [ ] **Step 3: Run test, confirm it passes**

Run: `npx jest src/domain/__tests__/nutrientProvenance.test.ts`

- [ ] **Step 4: Add schema columns**

In `src/db/schema.ts`, inside the `foods` table definition (after `seedKey: text('seed_key'),`):

```typescript
  /** True until a human confirms this food's data (allergens especially) - see src/domain/nutrientProvenance.ts. Bulk-imported foods start true; hand-curated seed and user-entered foods are false. */
  needsReview: integer('needs_review', { mode: 'boolean' }).notNull().default(false),
  /** NOVA processing group (1-4), from Open Food Facts - null when unknown/not applicable (e.g. generic USDA foods). */
  novaGroup: integer('nova_group'),
  /** Nutri-Score letter grade (a-e), from Open Food Facts. */
  nutriScoreGrade: text('nutri_score_grade', { enum: ['a', 'b', 'c', 'd', 'e'] }),
  /** Eco-Score letter grade (a-e), from Open Food Facts. */
  ecoScoreGrade: text('eco_score_grade', { enum: ['a', 'b', 'c', 'd', 'e'] }),
```

- [ ] **Step 5: Generate and review the migration**

Run: `npx drizzle-kit generate`
Expected: a new `drizzle/NNNN_*.sql` adding the four columns with the stated defaults, `needsReview` NOT NULL DEFAULT 0 (so every existing food in a live install stays trusted — no retroactive review-gating of data the user already has).

- [ ] **Step 6: Commit**

```bash
git add src/domain/nutrientProvenance.ts src/domain/__tests__/nutrientProvenance.test.ts src/db/schema.ts drizzle/
git commit -m "feat: add needsReview/provenance columns to foods table"
```

---

### Task 2: Expand `FoodSeed.micronutrients` to the full 20-key registry

**Files:**
- Modify: `src/db/seed/types.ts`
- Test: existing `src/db/__tests__/seedContent.test.ts` must keep passing unmodified (regression guard)

**Interfaces:**
- Consumes: `MicronutrientKey` from `src/domain/micronutrients.ts` (already has all 20 keys - vitaminAUg, vitaminCMg, vitaminDUg, vitaminEMg, vitaminKUg, b1Mg, b2Mg, b3Mg, b6Mg, b12Ug, folateUg, calciumMg, ironMg, magnesiumMg, potassiumMg, sodiumMg, zincMg, seleniumUg, iodineUg, omega3G).
- Produces: `FoodSeed.micronutrients: Partial<Record<MicronutrientKey, number>>` (was a hardcoded 5-key type).

- [ ] **Step 1: Widen the type**

In `src/db/seed/types.ts`:

```typescript
import type { MicronutrientKey } from '../../domain/micronutrients';

export type Micronutrients = Partial<Record<MicronutrientKey, number>>;
```

Delete the old hardcoded 5-field `Micronutrients` type it replaces.

- [ ] **Step 2: Typecheck and run the full seed test**

Run: `npx tsc --noEmit && npx jest src/db/__tests__/seedContent.test.ts`
Expected: PASS unchanged — the 5 keys already in use (`ironMg`, `vitaminDUg`, `b12Ug`, `calciumMg`, `omega3G`) are a subset of the 20, so no existing seed data breaks; this only *widens* what's allowed.

- [ ] **Step 3: Commit**

```bash
git add src/db/seed/types.ts
git commit -m "fix: widen FoodSeed.micronutrients to the full 20-key registry"
```

---

### Task 3: Allergen-derivation heuristic

**Files:**
- Create: `src/domain/allergenHeuristic.ts`
- Test: `src/domain/__tests__/allergenHeuristic.test.ts`

**Interfaces:**
- Consumes: `ALLERGEN_KEYS` from `src/constants/options.ts` (currently just a `readonly string[]` - no `AllergenKey` type exists yet anywhere in the codebase; this task adds one).
- Produces: `type AllergenKey = (typeof ALLERGEN_KEYS)[number]` (new - export it from `src/constants/options.ts` itself, not from this file, so every other allergen-typed call site in the codebase can migrate to it later instead of `string`), `deriveAllergensFromName(nameCs: string, nameEn: string): AllergenKey[]` - pure, case-insensitive, bilingual keyword match. Deliberately favors false positives over false negatives (a wrongly-tagged allergen just means the generator is overly cautious with that food for that profile; a missed one is the actual safety failure).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/domain/__tests__/allergenHeuristic.test.ts
import { deriveAllergensFromName } from '../allergenHeuristic';

describe('deriveAllergensFromName', () => {
  it('detects peanuts in English and Czech', () => {
    expect(deriveAllergensFromName('', 'Peanut butter')).toContain('peanuts');
    expect(deriveAllergensFromName('Arašídové máslo', '')).toContain('peanuts');
  });

  it('detects dairy/lactose from common terms', () => {
    expect(deriveAllergensFromName('Mléko', 'Milk')).toContain('lactose');
    expect(deriveAllergensFromName('Sýr eidam', 'Edam cheese')).toContain('lactose');
    expect(deriveAllergensFromName('Jogurt', 'Yogurt')).toContain('lactose');
  });

  it('detects gluten-bearing grains', () => {
    expect(deriveAllergensFromName('Pšeničná mouka', 'Wheat flour')).toContain('gluten');
    expect(deriveAllergensFromName('Žitný chléb', 'Rye bread')).toContain('gluten');
  });

  it('detects shellfish vs molluscs as distinct EU categories', () => {
    expect(deriveAllergensFromName('Krevety', 'Shrimp')).toEqual(['shellfish']);
    expect(deriveAllergensFromName('Slávky', 'Mussels')).toEqual(['molluscs']);
  });

  it('is case-insensitive', () => {
    expect(deriveAllergensFromName('', 'PEANUT BUTTER')).toContain('peanuts');
  });

  it('can match multiple allergens in one name', () => {
    const result = deriveAllergensFromName('', 'Peanut butter cheese sandwich (wheat bread)');
    expect(result).toEqual(expect.arrayContaining(['peanuts', 'lactose', 'gluten']));
  });

  it('returns an empty array when nothing matches, never null/undefined', () => {
    expect(deriveAllergensFromName('Mrkev', 'Carrot')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx jest src/domain/__tests__/allergenHeuristic.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement**

First, in `src/constants/options.ts`, add right after `ALLERGEN_KEYS`:

```typescript
export type AllergenKey = (typeof ALLERGEN_KEYS)[number];
```

Then:

```typescript
// src/domain/allergenHeuristic.ts
import type { AllergenKey } from '../constants/options';

/**
 * Bilingual keyword table for heuristic allergen tagging of bulk-imported
 * foods that have no manual allergen curation. Deliberately biased toward
 * false positives (over-tagging) over false negatives - a food this misses
 * is a real safety gap, a food this over-tags just gets filtered out more
 * than strictly necessary for that one profile.
 */
const KEYWORDS: Record<AllergenKey, string[]> = {
  gluten: ['wheat', 'flour', 'bread', 'pasta', 'barley', 'rye', 'oat', 'wheat', 'pšenic', 'mouk', 'chléb', 'chleb', 'těstovin', 'ječmen', 'žito', 'oves'],
  lactose: ['milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'dairy', 'whey', 'casein', 'mléko', 'mléč', 'sýr', 'jogurt', 'máslo', 'smetan', 'tvaroh', 'syrovátk'],
  eggs: ['egg', 'vejce', 'vaječ'],
  nuts: ['almond', 'walnut', 'hazelnut', 'cashew', 'pistachio', 'pecan', 'mandl', 'vlašsk', 'lísk', 'kešu', 'pistác'],
  peanuts: ['peanut', 'arašíd'],
  fish: ['salmon', 'tuna', 'cod', 'fish', 'herring', 'anchov', 'losos', 'tuňák', 'treska', 'ryb', 'sleď'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'kreve', 'krab', 'humr'],
  soy: ['soy', 'soya', 'tofu', 'edamame', 'sója', 'sojov'],
  sesame: ['sesame', 'tahini', 'sezam'],
  celery: ['celery', 'celer'],
  mustard: ['mustard', 'hořčic'],
  sulphites: ['sulphite', 'sulfite', 'siřič'],
  lupin: ['lupin', 'vlčí bob'],
  molluscs: ['mussel', 'oyster', 'squid', 'octopus', 'snail', 'slávk', 'ústřic', 'chobotnic', 'krevet'], // note: 'krevet' also partially overlaps shrimp spelling variants; harmless double-tag
};

export function deriveAllergensFromName(nameCs: string, nameEn: string): AllergenKey[] {
  const haystack = `${nameCs} ${nameEn}`.toLowerCase();
  const matches: AllergenKey[] = [];
  for (const [allergen, keywords] of Object.entries(KEYWORDS) as [AllergenKey, string[]][]) {
    if (keywords.some((kw) => haystack.includes(kw))) matches.push(allergen);
  }
  return matches;
}
```

Fix the `molluscs`/`shellfish` overlap the comment flags: remove `'krevet'` from `molluscs` (shrimp is shellfish, not molluscs - EU14 treats them as distinct categories, per the existing test).

- [ ] **Step 4: Run, confirm all pass**

Run: `npx jest src/domain/__tests__/allergenHeuristic.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/domain/allergenHeuristic.ts src/domain/__tests__/allergenHeuristic.test.ts
git commit -m "feat: bilingual keyword heuristic for bulk-food allergen tagging"
```

---

### Task 4: USDA CSV → canonical record transform (pure domain logic)

**Files:**
- Create: `src/domain/usdaImport.ts`
- Test: `src/domain/__tests__/usdaImport.test.ts`

**Interfaces:**
- Produces: `type UsdaFoodRecord = { fdcId: string; descriptionEn: string; category: string; kcalPer100: number; proteinPer100: number; carbsPer100: number; fatPer100: number; fiberPer100: number | null; micronutrients: Partial<Record<MicronutrientKey, number>>; sourceDataset: 'usda_foundation' | 'usda_sr_legacy' }`, `parseUsdaFoodRow(row: UsdaCsvRow, dataset: 'usda_foundation' | 'usda_sr_legacy'): UsdaFoodRecord | null` (null when the row is missing kcal/protein/carbs/fat - unusable without the core macros).

USDA's "Foundation Foods"/"SR Legacy" CSV export (`food.csv` + `food_nutrient.csv` joined on `fdc_id`) uses USDA nutrient IDs, not names. The mapping table below covers the fields this app tracks; anything else in the CSV is ignored.

- [ ] **Step 1: Write the failing test with a realistic fixture**

```typescript
// src/domain/__tests__/usdaImport.test.ts
import { parseUsdaFoodRow, USDA_NUTRIENT_ID_MAP } from '../usdaImport';

describe('parseUsdaFoodRow', () => {
  const baseNutrients = {
    1008: 165, // kcal
    1003: 31, // protein g
    1005: 0, // carbs g
    1004: 3.6, // fat g
    1079: 0, // fiber g
    1087: 15, // calcium mg
    1089: 1.3, // iron mg
  };

  it('maps a well-formed row to a UsdaFoodRecord', () => {
    const record = parseUsdaFoodRow(
      { fdc_id: '171077', description: 'Chicken, broiler, breast, meat only, raw', food_category: 'Poultry Products', nutrients: baseNutrients },
      'usda_foundation',
    );
    expect(record).toEqual({
      fdcId: '171077',
      descriptionEn: 'Chicken, broiler, breast, meat only, raw',
      category: 'Poultry Products',
      kcalPer100: 165,
      proteinPer100: 31,
      carbsPer100: 0,
      fatPer100: 3.6,
      fiberPer100: 0,
      micronutrients: { calciumMg: 15, ironMg: 1.3 },
      sourceDataset: 'usda_foundation',
    });
  });

  it('returns null when a core macro is missing', () => {
    const { 1008: _omit, ...withoutKcal } = baseNutrients;
    const record = parseUsdaFoodRow(
      { fdc_id: '1', description: 'X', food_category: 'Y', nutrients: withoutKcal },
      'usda_sr_legacy',
    );
    expect(record).toBeNull();
  });

  it('leaves a micronutrient out entirely when absent, never defaults to 0', () => {
    const { 1087: _omit, ...withoutCalcium } = baseNutrients;
    const record = parseUsdaFoodRow(
      { fdc_id: '1', description: 'X', food_category: 'Y', nutrients: withoutCalcium },
      'usda_foundation',
    );
    expect(record?.micronutrients.calciumMg).toBeUndefined();
    expect('calciumMg' in (record?.micronutrients ?? {})).toBe(false);
  });

  it('maps every nutrient ID this app tracks', () => {
    expect(Object.keys(USDA_NUTRIENT_ID_MAP).length).toBeGreaterThanOrEqual(20);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx jest src/domain/__tests__/usdaImport.test.ts`

- [ ] **Step 3: Implement**

```typescript
// src/domain/usdaImport.ts
import type { MicronutrientKey } from './micronutrients';

export type UsdaFoodRecord = {
  fdcId: string;
  descriptionEn: string;
  category: string;
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  fiberPer100: number | null;
  micronutrients: Partial<Record<MicronutrientKey, number>>;
  sourceDataset: 'usda_foundation' | 'usda_sr_legacy';
};

export type UsdaCsvRow = {
  fdc_id: string;
  description: string;
  food_category: string;
  /** USDA nutrient ID -> amount per 100g, already numeric (pre-joined food_nutrient.csv rows). */
  nutrients: Record<number, number>;
};

const CORE_MACRO_IDS = { kcal: 1008, protein: 1003, carbs: 1005, fat: 1004, fiber: 1079 } as const;

/** USDA nutrient ID -> this app's MicronutrientKey, for every one of the 20 keys the domain registry tracks. */
export const USDA_NUTRIENT_ID_MAP: Record<number, MicronutrientKey> = {
  1104: 'vitaminAUg',
  1162: 'vitaminCMg',
  1114: 'vitaminDUg',
  1109: 'vitaminEMg',
  1185: 'vitaminKUg',
  1165: 'b1Mg',
  1166: 'b2Mg',
  1167: 'b3Mg',
  1175: 'b6Mg',
  1178: 'b12Ug',
  1177: 'folateUg',
  1087: 'calciumMg',
  1089: 'ironMg',
  1090: 'magnesiumMg',
  1092: 'potassiumMg',
  1093: 'sodiumMg',
  1095: 'zincMg',
  1103: 'seleniumUg',
  1100: 'iodineUg',
  1404: 'omega3G', // sum of PUFA 18:3 n-3 + 20:5 n-3 + 22:6 n-3 - see Step 3a note below
};

export function parseUsdaFoodRow(row: UsdaCsvRow, dataset: 'usda_foundation' | 'usda_sr_legacy'): UsdaFoodRecord | null {
  const kcal = row.nutrients[CORE_MACRO_IDS.kcal];
  const protein = row.nutrients[CORE_MACRO_IDS.protein];
  const carbs = row.nutrients[CORE_MACRO_IDS.carbs];
  const fat = row.nutrients[CORE_MACRO_IDS.fat];
  if (kcal === undefined || protein === undefined || carbs === undefined || fat === undefined) return null;

  const micronutrients: Partial<Record<MicronutrientKey, number>> = {};
  for (const [idStr, key] of Object.entries(USDA_NUTRIENT_ID_MAP)) {
    const value = row.nutrients[Number(idStr)];
    if (value !== undefined) micronutrients[key] = value;
  }

  return {
    fdcId: row.fdc_id,
    descriptionEn: row.description,
    category: row.food_category,
    kcalPer100: kcal,
    proteinPer100: protein,
    carbsPer100: carbs,
    fatPer100: fat,
    fiberPer100: row.nutrients[CORE_MACRO_IDS.fiber] ?? null,
    micronutrients,
    sourceDataset: dataset,
  };
}
```

**Step 3a note for the implementer:** USDA reports omega-3 as three separate fatty-acid IDs (18:3 n-3 ALA = 1404, 20:5 n-3 EPA = 1278, 22:6 n-3 DHA = 1272), not one combined figure. Before wiring the real importer script (Task 5), sum whichever of the three are present per row into a single `omega3G` (sum of only the present ones - don't treat a missing one as 0) rather than mapping 1404 alone as the test fixture above simplifies for readability. Update this function and its test to reflect the real 3-ID sum before Task 5 depends on it.

- [ ] **Step 4: Run, confirm all pass (after applying the Step 3a correction)**

Run: `npx jest src/domain/__tests__/usdaImport.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/domain/usdaImport.ts src/domain/__tests__/usdaImport.test.ts
git commit -m "feat: pure USDA FoodData Central CSV row -> domain record transform"
```

---

### Task 5: Import script + generated seed file, wired into `seedIfEmpty`

**Files:**
- Create: `scripts/import-usda-foods.ts` (dev-only, never imported by app code)
- Create: `src/db/seed/usdaFoods.generated.ts` (committed output of running the script once)
- Modify: `src/db/seed/index.ts`
- Modify: `package.json` (add `"import:usda": "ts-node scripts/import-usda-foods.ts"` script + `ts-node`/`csv-parse` as devDependencies if not already present - check first)
- Test: `src/db/__tests__/seedContent.test.ts` (extend)

**Interfaces:**
- Consumes: `parseUsdaFoodRow`/`UsdaFoodRecord` (Task 4), `deriveAllergensFromName` (Task 3), `FoodSeed` (Task 2's widened type).
- Produces: `usdaSeedFoods: FoodSeed[]` exported from the generated file, each with `source: 'usda_foundation' | 'usda_sr_legacy'`, `category` mapped to this app's existing category enum (a small manual lookup table - USDA's ~25 food_category strings don't 1:1 match this app's `meat/fish/dairy/grains/vegetables/...` set; the implementer should build this map by inspecting the actual category value distribution in the downloaded CSV, not guess it blind).

- [ ] **Step 1: Write the import script**

```typescript
// scripts/import-usda-foods.ts
// One-off dev tool: `npm run import:usda`. Downloads nothing itself - point
// USDA_CSV_DIR at a manually-downloaded and unzipped FoodData Central
// "Foundation + SR Legacy" CSV export (https://fdc.nal.usda.gov/download-datasets).
// Re-run and commit the regenerated output whenever USDA ships a new release;
// this is NOT called at app runtime.
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { deriveAllergensFromName } from '../src/domain/allergenHeuristic';
import { parseUsdaFoodRow, type UsdaCsvRow } from '../src/domain/usdaImport';
import type { FoodSeed } from '../src/db/seed/types';

const USDA_CSV_DIR = process.env.USDA_CSV_DIR ?? './usda-data';
const CATEGORY_MAP: Record<string, string> = {
  'Poultry Products': 'meat',
  'Pork Products': 'meat',
  'Beef Products': 'meat',
  'Finfish and Shellfish Products': 'fish',
  'Dairy and Egg Products': 'dairy',
  'Vegetables and Vegetable Products': 'vegetables',
  'Fruits and Fruit Juices': 'fruit',
  'Cereal Grains and Pasta': 'grains',
  'Legumes and Legume Products': 'legumes',
  'Nut and Seed Products': 'nuts_seeds',
  'Baked Products': 'bakery',
  'Fats and Oils': 'fats',
  // NOTE: incomplete on purpose - extend after inspecting the real CSV's
  // distinct food_category values; anything unmapped falls through to
  // 'other' below rather than crashing the import.
};

function loadCsv<T>(filename: string): T[] {
  return parse(readFileSync(join(USDA_CSV_DIR, filename), 'utf-8'), { columns: true, skip_empty_lines: true }) as T[];
}

function main() {
  const foodRows = loadCsv<{ fdc_id: string; description: string; food_category_id: string; data_type: string }>('food.csv');
  const categoryRows = loadCsv<{ id: string; description: string }>('food_category.csv');
  const nutrientRows = loadCsv<{ fdc_id: string; nutrient_id: string; amount: string }>('food_nutrient.csv');

  const categoryById = new Map(categoryRows.map((c) => [c.id, c.description]));
  const nutrientsByFdcId = new Map<string, Record<number, number>>();
  for (const row of nutrientRows) {
    const bucket = nutrientsByFdcId.get(row.fdc_id) ?? {};
    bucket[Number(row.nutrient_id)] = Number(row.amount);
    nutrientsByFdcId.set(row.fdc_id, bucket);
  }

  const seedFoods: FoodSeed[] = [];
  for (const food of foodRows) {
    if (food.data_type !== 'foundation_food' && food.data_type !== 'sr_legacy_food') continue;
    const csvRow: UsdaCsvRow = {
      fdc_id: food.fdc_id,
      description: food.description,
      food_category: categoryById.get(food.food_category_id) ?? 'Unknown',
      nutrients: nutrientsByFdcId.get(food.fdc_id) ?? {},
    };
    const record = parseUsdaFoodRow(csvRow, food.data_type === 'foundation_food' ? 'usda_foundation' : 'usda_sr_legacy');
    if (!record) continue;

    seedFoods.push({
      key: `usda_${record.fdcId}`,
      nameCs: record.descriptionEn, // no Czech translation source in this iteration - see plan's AI section
      nameEn: record.descriptionEn,
      category: CATEGORY_MAP[record.category] ?? 'other',
      baseUnit: 'g',
      kcalPer100: record.kcalPer100,
      proteinPer100: record.proteinPer100,
      carbsPer100: record.carbsPer100,
      fatPer100: record.fatPer100,
      fiberPer100: record.fiberPer100 ?? undefined,
      micronutrients: record.micronutrients,
      allergens: deriveAllergensFromName('', record.descriptionEn),
      budget: 'average',
      source: record.sourceDataset,
      needsReview: true,
    } as FoodSeed & { needsReview: true }); // needsReview added to FoodSeed in this same task, see Step 2
  }

  const output = `// GENERATED FILE - do not hand-edit. Regenerate with \`npm run import:usda\`.\nimport type { FoodSeed } from './types';\n\nexport const usdaSeedFoods: FoodSeed[] = ${JSON.stringify(seedFoods, null, 2)};\n`;
  writeFileSync(join(__dirname, '../src/db/seed/usdaFoods.generated.ts'), output);
  console.log(`Wrote ${seedFoods.length} USDA foods.`);
}

main();
```

- [ ] **Step 2: Add `needsReview` to `FoodSeed`**

In `src/db/seed/types.ts`, add to `FoodSeed`: `needsReview?: boolean;` (defaults to `false` when the seed loader writes it - see Step 4).

- [ ] **Step 3: Add devDependencies and the npm script**

Run: `npm install --save-dev csv-parse ts-node` (check `package.json` first - skip whichever is already present).
Add to `package.json` `"scripts"`: `"import:usda": "ts-node scripts/import-usda-foods.ts"`.

- [ ] **Step 4: Wire `usdaSeedFoods` into `seedIfEmpty`**

In `src/db/seed/index.ts`, find where `seedFoods` (the curated 74) is inserted, and merge in `usdaSeedFoods` from `./usdaFoods.generated`, passing `needsReview: seed.needsReview ?? false` through to the `upsertFood`/insert call so curated foods keep `needsReview: false` and USDA-imported ones get `true`. Import `usdaSeedFoods` lazily/conditionally if the generated file might not exist in a fresh clone before the script has ever been run - simplest: commit a placeholder `export const usdaSeedFoods: FoodSeed[] = [];` in `usdaFoods.generated.ts` initially (Step 5), so `seedIfEmpty` never breaks on a machine that hasn't run the import script.

- [ ] **Step 5: Generate the real seed file**

This step requires downloading the actual USDA FoodData Central CSV export (https://fdc.nal.usda.gov/download-datasets, "Foundation + SR Legacy" bundle, ~2026 release) to `./usda-data/` locally, then running `npm run import:usda`. This cannot be scripted sight-unseen against real data in this plan - the implementer runs it once, inspects the row count and a handful of sample entries for sanity (correct kcal ballpark, category mapping didn't dump everything into 'other'), and commits the resulting `src/db/seed/usdaFoods.generated.ts`.

- [ ] **Step 6: Extend the seed content test**

In `src/db/__tests__/seedContent.test.ts`, add: every food from `usdaSeedFoods` that lands in the DB has `needsReview === true`, and every one of the original 74 curated foods still has `needsReview === false` (or `null`/absent, per the migration default).

- [ ] **Step 7: Run full test suite + typecheck**

Run: `npx tsc --noEmit && npx jest`

- [ ] **Step 8: Commit**

```bash
git add scripts/import-usda-foods.ts src/db/seed/usdaFoods.generated.ts src/db/seed/index.ts src/db/seed/types.ts package.json package-lock.json src/db/__tests__/seedContent.test.ts
git commit -m "feat: bundle USDA Foundation+SR Legacy foods via a one-time import script"
```

---

### Task 6: Generator safety carve-out for `needsReview` allergen data

**Files:**
- Modify: `src/domain/generator/filters.ts`
- Test: `src/domain/generator/__tests__/filters.test.ts`

**Interfaces:**
- Consumes: `isTrustedForAllergySafety` (Task 1), the existing `isRecipeAllowedForProfiles`/hard-filter allergen check (per the generator audit: `filters.ts:91`).

- [ ] **Step 1: Write the failing test**

```typescript
// in src/domain/generator/__tests__/filters.test.ts, new describe block
describe('needsReview allergen safety carve-out', () => {
  it('excludes an unreviewed candidate for a profile with any active allergy, even if no keyword-derived allergen matches that profile', () => {
    const candidate = { /* ...existing candidate fixture shape... */ needsReview: true, allergens: [] as string[] };
    const profile = { allergens: ['peanuts'] };
    expect(isRecipeAllowedForProfiles([profile], { ...tagsFor(candidate) })).toBe(false);
  });

  it('does not exclude a reviewed candidate the same way', () => {
    const candidate = { needsReview: false, allergens: [] as string[] };
    const profile = { allergens: ['peanuts'] };
    expect(isRecipeAllowedForProfiles([profile], { ...tagsFor(candidate) })).toBe(true);
  });

  it('does not exclude an unreviewed candidate for a profile with zero allergies', () => {
    const candidate = { needsReview: true, allergens: [] as string[] };
    const profile = { allergens: [] as string[] };
    expect(isRecipeAllowedForProfiles([profile], { ...tagsFor(candidate) })).toBe(true);
  });
});
```

(Adapt `tagsFor`/fixture shape to match the real `DerivedRecipeTags`/candidate type already used by neighboring tests in this file - read the existing tests first, this plan shouldn't guess their exact fixture helper names.)

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement the carve-out**

In `src/domain/generator/filters.ts`, inside `isRecipeAllowedForProfiles` (per the audit: around line 91, where `tags.allergens.some(...)` currently runs), add before/alongside that check:

```typescript
// Safety carve-out: unreviewed bulk-imported data can't be trusted for
// allergen exclusion, so treat it as excluded outright for any profile
// with an active allergy - the one deliberate exception to "missing data
// != 0" in this codebase. See src/domain/nutrientProvenance.ts.
if (tags.needsReview && profiles.some((p) => p.allergens.length > 0)) return false;
```

This requires `DerivedRecipeTags`/whatever candidate-tag shape flows into this function to actually carry a `needsReview` boolean - trace how `tags.allergens` gets populated today (per the audit, ingredient allergens roll up via `deriveRecipeTags`) and thread `needsReview` the same way: a recipe/food's `needsReview` should propagate up (a recipe containing ANY `needsReview` ingredient is itself `needsReview` for this purpose - OR of the ingredients, not AND).

- [ ] **Step 4: Run, confirm pass**

- [ ] **Step 5: Run the full filters suite to confirm no regression**

Run: `npx jest src/domain/generator/__tests__/filters.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/domain/generator/filters.ts src/domain/generator/__tests__/filters.test.ts
git commit -m "fix: generator excludes needsReview foods from any profile with an active allergy"
```

---

### Task 7: OFF service captures NOVA/Nutri-Score/Eco-Score/category (no bulk, no AI)

**Files:**
- Modify: `src/services/openFoodFacts.ts`
- Test: `src/services/__tests__/openFoodFacts.test.ts`

**Interfaces:**
- Produces: `OpenFoodFactsProduct` gains `novaGroup: number | null`, `nutriScoreGrade: 'a'|'b'|'c'|'d'|'e'|null`, `ecoScoreGrade: 'a'|'b'|'c'|'d'|'e'|null`, `categoriesTags: string[]` (OFF's own `categories_tags` array, e.g. `["en:dairies","en:cheeses"]` - used by Task 8's matching service as the category signal instead of anything AI-derived).

- [ ] **Step 1: Extend the existing test file's fixture-based tests**

Add assertions to the existing `mapOpenFoodFactsResponse` tests in `src/services/__tests__/openFoodFacts.test.ts` for a fixture body that includes `product.nova_group`, `product.nutriscore_grade`, `product.ecoscore_grade`, `product.categories_tags`.

- [ ] **Step 2: Implement**

In `src/services/openFoodFacts.ts`, extend the type and mapper:

```typescript
export type OpenFoodFactsProduct = {
  name: string | null;
  kcalPer100: number | null;
  proteinPer100: number | null;
  carbsPer100: number | null;
  fatPer100: number | null;
  fiberPer100: number | null;
  novaGroup: number | null;
  nutriScoreGrade: 'a' | 'b' | 'c' | 'd' | 'e' | null;
  ecoScoreGrade: 'a' | 'b' | 'c' | 'd' | 'e' | null;
  categoriesTags: string[];
};
```

In `mapOpenFoodFactsResponse`, add:

```typescript
    novaGroup: typeof product.nova_group === 'number' ? product.nova_group : null,
    nutriScoreGrade: typeof product.nutriscore_grade === 'string' ? (product.nutriscore_grade as OpenFoodFactsProduct['nutriScoreGrade']) : null,
    ecoScoreGrade: typeof product.ecoscore_grade === 'string' ? (product.ecoscore_grade as OpenFoodFactsProduct['ecoScoreGrade']) : null,
    categoriesTags: Array.isArray(product.categories_tags) ? (product.categories_tags as string[]) : [],
```

- [ ] **Step 3: Run, confirm pass**

- [ ] **Step 4: Wire the three new scalar fields (not `categoriesTags`, which is Task 8-only) into the food editor's barcode-scan prefill**

In `src/app/food/edit.tsx`, wherever `getProductByBarcode`'s result currently prefills `kcalPer100` etc., also prefill `novaGroup`/`nutriScoreGrade`/`ecoScoreGrade` on the form state, and set `needsReview: true` + `source: 'off_label'` on the resulting food (scanned products aren't manually curated either, but per the user's own scoping this only needs the *allergen* safety gate from Task 6 - NOVA/Nutri-Score display isn't safety-critical, so this is a normal prefill, not review-gated the way allergens are).

- [ ] **Step 5: Commit**

```bash
git add src/services/openFoodFacts.ts src/services/__tests__/openFoodFacts.test.ts src/app/food/edit.tsx
git commit -m "feat: capture NOVA/Nutri-Score/Eco-Score/category from Open Food Facts lookups"
```

---

### Task 8: Branded → generic USDA micronutrient matching service

**Files:**
- Create: `src/domain/nutrientMatching.ts`
- Test: `src/domain/__tests__/nutrientMatching.test.ts`

**Interfaces:**
- Consumes: `usdaSeedFoods` shape (Task 5) as the generic pool, `categoriesTags`/name from an OFF-scanned branded product (Task 7).
- Produces: `type MatchResult = { fdcKey: string; confidence: NutrientConfidence; micronutrients: Partial<Record<MicronutrientKey, number>> }`, `matchGenericForBranded(branded: { nameEn: string; categoriesTags: string[] }, genericPool: { key: string; nameEn: string; category: string; micronutrients: Partial<Record<MicronutrientKey, number>> }[]): MatchResult | null`.

**Matching rule (defined here, not left to the implementer to invent ad hoc):** a **hard gate** on category - the branded item's OFF `categoriesTags` must contain a tag that maps (via the same `CATEGORY_MAP`-style lookup as Task 5, applied to OFF's `en:`-prefixed category slugs) to the generic food's `category` field. Among candidates passing that gate, score by normalized token overlap between `branded.nameEn` and `generic.nameEn` (lowercase, split on non-letters, as sets, Jaccard similarity = `|intersection| / |union|`). Return the highest-scoring candidate only if its score is **≥ 0.34** (roughly: at least a third of the distinguishing words overlap - chosen because two unrelated-but-same-category foods, e.g. "chicken breast" vs "beef liver", share 0 of their distinguishing tokens, while real matches like "chicken breast, grilled" vs "chicken, broiler, breast, meat only, raw" clear it easily); below that, return `null` (silent skip, per the project's convention - no guessed number ever reaches the UI).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/domain/__tests__/nutrientMatching.test.ts
import { matchGenericForBranded } from '../nutrientMatching';

const genericPool = [
  { key: 'usda_1', nameEn: 'Chicken, broiler, breast, meat only, raw', category: 'meat', micronutrients: { ironMg: 0.4 } },
  { key: 'usda_2', nameEn: 'Beef, liver, raw', category: 'meat', micronutrients: { ironMg: 6.2 } },
  { key: 'usda_3', nameEn: 'Milk, whole', category: 'dairy', micronutrients: { calciumMg: 120 } },
];

describe('matchGenericForBranded', () => {
  it('matches a branded item to the closest same-category generic food', () => {
    const result = matchGenericForBranded({ nameEn: 'Grilled chicken breast fillet', categoriesTags: ['en:meats', 'en:poultry'] }, genericPool);
    expect(result?.fdcKey).toBe('usda_1');
    expect(result?.micronutrients.ironMg).toBe(0.4);
  });

  it('never matches across categories even with high name overlap', () => {
    const result = matchGenericForBranded({ nameEn: 'Chicken flavored milk drink', categoriesTags: ['en:dairies'] }, genericPool);
    expect(result?.fdcKey).not.toBe('usda_1');
  });

  it('returns null when nothing clears the confidence threshold', () => {
    const result = matchGenericForBranded({ nameEn: 'Sparkling water', categoriesTags: ['en:meats'] }, genericPool);
    expect(result).toBeNull();
  });

  it('returns null (not a bad guess) when the category itself has no mapping', () => {
    const result = matchGenericForBranded({ nameEn: 'Chicken breast', categoriesTags: ['en:some-unmapped-category'] }, genericPool);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement**

```typescript
// src/domain/nutrientMatching.ts
import type { MicronutrientKey } from './micronutrients';
import type { NutrientConfidence } from './nutrientProvenance';

const MATCH_THRESHOLD = 0.34;

// Mirrors scripts/import-usda-foods.ts's CATEGORY_MAP but keyed by OFF's
// `en:`-prefixed category slugs instead of USDA's food_category strings -
// kept as a separate table since the two source vocabularies don't align.
const OFF_CATEGORY_MAP: Record<string, string> = {
  'en:meats': 'meat',
  'en:poultry': 'meat',
  'en:fishes': 'fish',
  'en:seafood': 'fish',
  'en:dairies': 'dairy',
  'en:cheeses': 'dairy',
  'en:vegetables': 'vegetables',
  'en:fruits': 'fruit',
  'en:cereals-and-potatoes': 'grains',
  'en:legumes': 'legumes',
  // extend as real OFF category coverage gaps are found in practice.
};

function tokenSet(name: string): Set<string> {
  return new Set(name.toLowerCase().split(/[^a-z]+/).filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

export type MatchResult = {
  fdcKey: string;
  confidence: NutrientConfidence;
  micronutrients: Partial<Record<MicronutrientKey, number>>;
};

export function matchGenericForBranded(
  branded: { nameEn: string; categoriesTags: string[] },
  genericPool: { key: string; nameEn: string; category: string; micronutrients: Partial<Record<MicronutrientKey, number>> }[],
): MatchResult | null {
  const mappedCategories = new Set(branded.categoriesTags.map((tag) => OFF_CATEGORY_MAP[tag]).filter(Boolean));
  if (mappedCategories.size === 0) return null;

  const brandedTokens = tokenSet(branded.nameEn);
  let best: { key: string; micronutrients: Partial<Record<MicronutrientKey, number>>; score: number } | null = null;
  for (const generic of genericPool) {
    if (!mappedCategories.has(generic.category)) continue;
    const score = jaccard(brandedTokens, tokenSet(generic.nameEn));
    if (!best || score > best.score) best = { key: generic.key, micronutrients: generic.micronutrients, score };
  }

  if (!best || best.score < MATCH_THRESHOLD) return null;
  const confidence: NutrientConfidence = best.score >= 0.6 ? 'high' : best.score >= 0.45 ? 'medium' : 'low';
  return { fdcKey: best.key, confidence, micronutrients: best.micronutrients };
}
```

- [ ] **Step 4: Run, confirm all pass**

- [ ] **Step 5: Commit**

```bash
git add src/domain/nutrientMatching.ts src/domain/__tests__/nutrientMatching.test.ts
git commit -m "feat: match branded OFF products to the nearest generic USDA food for micronutrient fill"
```

*(Wiring this into the actual food-editor "fill in missing micronutrients" button/flow is a follow-up UI task once this service exists and has been reviewed - not included here to keep this task reviewable on its own.)*

---

### Task 9: `needsReview` UI review flow

**Files:**
- Modify: `src/app/food/edit.tsx`
- Modify: `src/app/food/[id].tsx`
- Modify: `src/db/repositories/library.ts` (a `confirmFoodReviewed(db, foodId)` setter)
- Test: `src/db/__tests__/library.test.ts` (or wherever `upsertFood` is tested today - check first)

**Interfaces:**
- Produces: `confirmFoodReviewed(db: AppDb, foodId: string): Promise<void>` - sets `needsReview: false`.

- [ ] **Step 1: Write the failing repo test**

```typescript
it('confirmFoodReviewed clears the needsReview flag', async () => {
  const db = createTestDb();
  const foodId = await upsertFood(db, { /* ...minimal valid input with needsReview: true... */ });
  await confirmFoodReviewed(db, foodId);
  const [food] = await db.select().from(foods).where(eq(foods.id, foodId));
  expect(food.needsReview).toBe(false);
});
```

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement the repo function** (mirrors the existing `updateProfile`-style single-field setter pattern already in this codebase)

- [ ] **Step 4: Run, confirm pass**

- [ ] **Step 5: Surface it in the UI**

In `src/app/food/[id].tsx`: when `food.needsReview` is true, show a dismissible banner above the nutrition card - i18n keys `foodDetail.needsReviewBanner` (en: "This food's data hasn't been reviewed yet - allergens especially may be incomplete.") / cs equivalent, with a "Confirm data" button calling `confirmFoodReviewed`. In `src/app/food/edit.tsx`, show the same banner and clear the flag automatically once the user saves an edit to the food (editing it IS the review).

- [ ] **Step 6: Run full suite**

Run: `npx tsc --noEmit && npx jest`

- [ ] **Step 7: Commit**

```bash
git add src/app/food/edit.tsx "src/app/food/[id].tsx" src/db/repositories/library.ts src/db/__tests__/library.test.ts src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat: needsReview banner + confirm flow on the food detail/edit screens"
```

---

## Deferred (explicitly out of scope this plan)

- **AI/LLM enrichment** (name disambiguation, category tagging, Czech translation of USDA English names) - the generated USDA seed foods will have `nameCs === nameEn` (English name shown in Czech UI) until this is revisited. If picked up later: free-tier hosted open-weight model only, lazy/on-demand, never writes numeric nutrition or a final (unreviewed) allergen tag - matches the user's original decision #5.
- **Wiring `matchGenericForBranded` into an actual UI flow** (Task 8 builds the service, not the button that calls it).
- **CIQUAL/CoFID/Frida cross-check**, **FooDB phytochemicals**, **glycemic index/load** - noted by the user as future scope, not touched here.

## Verification

Per task: `npx tsc --noEmit && npx jest`. End-to-end once Task 9 lands: run the real `npm run import:usda` against a downloaded CSV, reseed a fresh test install, confirm on-device that (a) USDA foods show up in food search with a "needs review" indicator, (b) a household profile with a peanut allergy never gets an unreviewed food suggested by the generator even when that food's heuristic allergen tags don't happen to include peanuts, (c) confirming a food's review clears the banner and makes it eligible for that profile again if its allergens truly don't apply.

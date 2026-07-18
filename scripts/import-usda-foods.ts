// One-off dev tool: `npm run import:usda`. Downloads nothing itself - point
// USDA_CSV_DIR at manually-downloaded and unzipped FoodData Central
// "Foundation Foods" and "SR Legacy" CSV exports
// (https://fdc.nal.usda.gov/download-datasets). Re-run and commit the
// regenerated output whenever USDA ships a new release; this is NOT called
// at app runtime.
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { deriveAllergensFromName } from '../src/domain/allergenHeuristic';
import { parseUsdaFoodRow, type UsdaCsvRow } from '../src/domain/usdaImport';
import type { FoodSeed } from '../src/db/seed/types';

const USDA_CSV_DIR = process.env.USDA_CSV_DIR ?? './usda-data';

// USDA's food_category.description -> this app's foods.category values
// (bakery/dairy/eggs/fats/fish/fruit/grains/legumes/meat/nuts/seeds/
// supplements/sweeteners/sweets/vegetables, per the curated seed). Anything
// not listed here falls through to 'other' rather than crashing the import -
// extend as real gaps are found.
const CATEGORY_MAP: Record<string, string> = {
  'Dairy and Egg Products': 'dairy',
  'Fats and Oils': 'fats',
  'Poultry Products': 'meat',
  'Sausages and Luncheon Meats': 'meat',
  'Breakfast Cereals': 'grains',
  'Fruits and Fruit Juices': 'fruit',
  'Pork Products': 'meat',
  'Vegetables and Vegetable Products': 'vegetables',
  'Nut and Seed Products': 'nuts',
  'Beef Products': 'meat',
  'Finfish and Shellfish Products': 'fish',
  'Legumes and Legume Products': 'legumes',
  'Lamb, Veal, and Game Products': 'meat',
  'Baked Products': 'bakery',
  Sweets: 'sweets',
  'Cereal Grains and Pasta': 'grains',
};

type FoodCsvRow = { fdc_id: string; data_type: string; description: string; food_category_id: string };
type CategoryCsvRow = { id: string; description: string };
type NutrientCsvRow = { fdc_id: string; nutrient_id: string; amount: string };

function loadCsv<T>(dir: string, filename: string): T[] {
  return parse(readFileSync(join(dir, filename), 'utf-8'), { columns: true, skip_empty_lines: true }) as T[];
}

function importDataset(dir: string, dataset: 'usda_foundation' | 'usda_sr_legacy', dataTypeValue: string): FoodSeed[] {
  const foodRows = loadCsv<FoodCsvRow>(dir, 'food.csv');
  const categoryRows = loadCsv<CategoryCsvRow>(dir, 'food_category.csv');
  const nutrientRows = loadCsv<NutrientCsvRow>(dir, 'food_nutrient.csv');

  const categoryById = new Map(categoryRows.map((c) => [c.id, c.description]));
  const nutrientsByFdcId = new Map<string, Record<number, number>>();
  for (const row of nutrientRows) {
    if (!row.amount) continue;
    const bucket = nutrientsByFdcId.get(row.fdc_id) ?? {};
    bucket[Number(row.nutrient_id)] = Number(row.amount);
    nutrientsByFdcId.set(row.fdc_id, bucket);
  }

  const seedFoods: FoodSeed[] = [];
  let skippedMissingMacro = 0;
  for (const food of foodRows) {
    if (food.data_type !== dataTypeValue) continue;
    const csvRow: UsdaCsvRow = {
      fdc_id: food.fdc_id,
      description: food.description,
      food_category: categoryById.get(food.food_category_id) ?? 'Unknown',
      nutrients: nutrientsByFdcId.get(food.fdc_id) ?? {},
    };
    const record = parseUsdaFoodRow(csvRow, dataset);
    if (!record) {
      skippedMissingMacro += 1;
      continue;
    }

    seedFoods.push({
      key: `usda_${record.fdcId}`,
      nameCs: record.descriptionEn,
      nameEn: record.descriptionEn,
      category: CATEGORY_MAP[record.category] ?? 'other',
      baseUnit: 'g',
      kcalPer100: Math.round(record.kcalPer100 * 10) / 10,
      proteinPer100: Math.round(record.proteinPer100 * 10) / 10,
      carbsPer100: Math.round(record.carbsPer100 * 10) / 10,
      fatPer100: Math.round(record.fatPer100 * 10) / 10,
      fiberPer100: record.fiberPer100 ?? undefined,
      micronutrients: record.micronutrients,
      allergens: deriveAllergensFromName('', record.descriptionEn),
      budget: 'average',
      source: record.sourceDataset,
      needsReview: true,
    });
  }

  console.log(`${dataset}: ${seedFoods.length} foods imported, ${skippedMissingMacro} skipped (missing a core macro).`);
  return seedFoods;
}

function main() {
  const foundationDir = join(USDA_CSV_DIR, 'foundation', 'FoodData_Central_foundation_food_csv_2026-04-30');
  const srLegacyDir = join(USDA_CSV_DIR, 'sr_legacy', 'FoodData_Central_sr_legacy_food_csv_2018-04');

  const foundationFoods = importDataset(foundationDir, 'usda_foundation', 'foundation_food');
  const srLegacyFoods = importDataset(srLegacyDir, 'usda_sr_legacy', 'sr_legacy_food');

  // SR Legacy sometimes duplicates a Foundation Foods entry under a
  // different fdc_id (same food re-analyzed) - dedupe by normalized name,
  // keeping the Foundation Foods version (newer, more complete micronutrient
  // panel) when both exist.
  const seenNames = new Set(foundationFoods.map((f) => f.nameEn.toLowerCase()));
  const dedupedSrLegacy = srLegacyFoods.filter((f) => !seenNames.has(f.nameEn.toLowerCase()));
  console.log(`sr_legacy: ${srLegacyFoods.length - dedupedSrLegacy.length} deduped against foundation foods by exact name match.`);

  const allFoods = [...foundationFoods, ...dedupedSrLegacy];

  // Embedded as a JSON string parsed at module load, not a JS object
  // literal - with ~8000 heterogeneous object literals (different optional
  // keys per food), TS's own literal-type inference blows up (TS2590 "union
  // type too complex") even with no contextual/target type involved.
  // JSON.parse's return type is `any`, sidestepping that entirely; the
  // double JSON.stringify (data, then the resulting string) guarantees a
  // syntactically valid JS string literal regardless of content.
  const jsonPayload = JSON.stringify(JSON.stringify(allFoods));
  const output = `// GENERATED FILE - do not hand-edit. Regenerate with \`npm run import:usda\`.\nimport type { FoodSeed } from './types';\n\nexport const usdaSeedFoods = JSON.parse(${jsonPayload}) as FoodSeed[];\n`;
  writeFileSync(join(__dirname, '../src/db/seed/usdaFoods.generated.ts'), output);
  console.log(`Wrote ${allFoods.length} total USDA foods to src/db/seed/usdaFoods.generated.ts.`);
}

main();

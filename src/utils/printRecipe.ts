import * as Print from 'expo-print';

import type { RecipeNutrition } from '@/domain/recipeNutrition';
import type { IngredientRow } from '@/hooks/library';
import { localizedInstructions, localizedName } from '@/utils/localized';

type RecipeLike = {
  nameCs: string;
  nameEn: string;
  instructionsCs: string | null;
  instructionsEn: string | null;
  servingsBase: number;
  prepTimeMinutes: number | null;
};

type PrintRecipeArgs = {
  recipe: RecipeLike;
  ingredientRows: IngredientRow[];
  nutrition: RecipeNutrition;
  allergenLabels: string[];
  photoUri?: string | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildRecipeHtml({ recipe, ingredientRows, nutrition, allergenLabels, photoUri, t }: PrintRecipeArgs): string {
  const name = escapeHtml(localizedName(recipe));
  const instructions = localizedInstructions(recipe);

  const ingredientItems = ingredientRows
    .map((row) => {
      const unit = row.food.baseUnit === 'piece' ? t('units.pcs') : row.food.baseUnit;
      return `<li>${escapeHtml(localizedName(row.food))} — ${row.ingredient.amount} ${escapeHtml(unit)}</li>`;
    })
    .join('');

  const metaParts = [
    `${t('recipeDetail.servings', { count: recipe.servingsBase })}`,
    recipe.prepTimeMinutes ? `${recipe.prepTimeMinutes} min` : null,
  ].filter(Boolean);

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #16211B; padding: 24px; }
          h1 { font-size: 24px; margin-bottom: 4px; }
          .meta { color: #5B6B60; font-size: 13px; margin-bottom: 16px; }
          img.hero { width: 100%; max-height: 240px; object-fit: cover; border-radius: 12px; margin-bottom: 16px; }
          h2 { font-size: 16px; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #E1E7E3; padding-bottom: 4px; }
          .nutrition { display: flex; gap: 16px; }
          .nutrition div { text-align: center; }
          .nutrition .value { font-weight: 700; font-size: 15px; }
          .nutrition .label { color: #5B6B60; font-size: 11px; }
          ul { padding-left: 20px; margin: 0; }
          li { margin-bottom: 4px; }
          .instructions { white-space: pre-wrap; line-height: 1.5; }
          .allergens { color: #5B6B60; font-size: 13px; }
        </style>
      </head>
      <body>
        ${photoUri ? `<img class="hero" src="${photoUri}" />` : ''}
        <h1>${name}</h1>
        <div class="meta">${escapeHtml(metaParts.join(' · '))}</div>

        <h2>${escapeHtml(t('recipeDetail.nutritionPerPortion'))}</h2>
        <div class="nutrition">
          <div><div class="value">${Math.round(nutrition.kcal)}</div><div class="label">kcal</div></div>
          <div><div class="value">${Math.round(nutrition.proteinG)} g</div><div class="label">${escapeHtml(t('macros.protein'))}</div></div>
          <div><div class="value">${Math.round(nutrition.carbsG)} g</div><div class="label">${escapeHtml(t('macros.carbs'))}</div></div>
          <div><div class="value">${Math.round(nutrition.fatG)} g</div><div class="label">${escapeHtml(t('macros.fat'))}</div></div>
        </div>

        <h2>${escapeHtml(t('recipeDetail.ingredients'))}</h2>
        <ul>${ingredientItems}</ul>

        ${
          allergenLabels.length > 0
            ? `<h2>${escapeHtml(t('recipeDetail.allergens'))}</h2><div class="allergens">${escapeHtml(allergenLabels.join(', '))}</div>`
            : ''
        }

        ${
          instructions
            ? `<h2>${escapeHtml(t('recipeDetail.instructions'))}</h2><div class="instructions">${escapeHtml(instructions)}</div>`
            : ''
        }
      </body>
    </html>
  `;
}

/** Opens the OS print dialog (pick a printer, or "Save as PDF") for a recipe. */
export async function printRecipe(args: PrintRecipeArgs): Promise<void> {
  const html = buildRecipeHtml(args);
  await Print.printAsync({ html });
}

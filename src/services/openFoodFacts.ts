/**
 * Open Food Facts barcode lookup (free, open-source product database –
 * chosen per the project brief's future open-source plans). Used from the
 * food editor's barcode scanner to prefill a new food's basic nutrition;
 * the user can always fall back to manual entry if the product isn't found
 * or the request fails (offline, unknown barcode, etc).
 */

export type OpenFoodFactsProduct = {
  name: string | null;
  kcalPer100: number | null;
  proteinPer100: number | null;
  carbsPer100: number | null;
  fatPer100: number | null;
  fiberPer100: number | null;
};

type RawNutriments = Record<string, unknown> | undefined;

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Maps a raw Open Food Facts API v2 response body to the fields the food
 * editor prefills. Pure and separately testable from the network call.
 */
export function mapOpenFoodFactsResponse(raw: unknown): OpenFoodFactsProduct | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const body = raw as Record<string, unknown>;
  if (body.status !== 1) return null;

  const product = body.product as Record<string, unknown> | undefined;
  if (!product) return null;

  const nutriments = product.nutriments as RawNutriments;
  const name =
    (typeof product.product_name === 'string' && product.product_name.trim()) ||
    (typeof product.product_name_en === 'string' && product.product_name_en.trim()) ||
    null;

  return {
    name: name || null,
    kcalPer100: toNumber(nutriments?.['energy-kcal_100g']),
    proteinPer100: toNumber(nutriments?.proteins_100g),
    carbsPer100: toNumber(nutriments?.carbohydrates_100g),
    fatPer100: toNumber(nutriments?.fat_100g),
    fiberPer100: toNumber(nutriments?.fiber_100g),
  };
}

/**
 * Looks up a product by EAN/UPC barcode. Returns null on a genuine "not
 * found" response, and also null (never throws) on a network/parse failure –
 * the caller always has manual entry as the fallback.
 */
export async function getProductByBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
    if (!response.ok) return null;
    const body = await response.json();
    return mapOpenFoodFactsResponse(body);
  } catch {
    return null;
  }
}

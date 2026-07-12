import { extractRecipeFromHtml, type ImportedRecipe } from '@/domain/recipeImport';

const FETCH_TIMEOUT_MS = 10_000;
/** Some recipe sites serve stripped-down (or blocked) pages to unknown clients – a desktop UA gets the full markup incl. JSON-LD. */
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

/**
 * Fetches a page's HTML. Returns null (never throws) on network failure,
 * timeout or a non-OK response – the import screen shows a friendly error
 * and the user can always create the recipe manually instead.
 */
export async function fetchPageHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Normalizes a pasted/shared string into a fetchable https URL; null when it doesn't contain one. */
export function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (match) return match[0];
  // A bare domain like "www.recepty.cz/..." – assume https.
  const bare = text.trim();
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(bare)) return `https://${bare}`;
  return null;
}

/** Fetch + parse in one call: the import screen's single entry point. */
export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe | null> {
  const html = await fetchPageHtml(url);
  if (html === null) return null;
  return extractRecipeFromHtml(html);
}

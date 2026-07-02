import i18n from '@/i18n';

type Named = { nameCs: string; nameEn: string };

/** Pick the display name for the current UI language. */
export function localizedName(item: Named): string {
  return i18n.language === 'en' ? item.nameEn : item.nameCs;
}

type Instructed = { instructionsCs: string | null; instructionsEn: string | null };

export function localizedInstructions(item: Instructed): string | null {
  return i18n.language === 'en'
    ? (item.instructionsEn ?? item.instructionsCs)
    : (item.instructionsCs ?? item.instructionsEn);
}

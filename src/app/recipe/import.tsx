import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodPickerModal, type FoodRow } from '@/components/FoodPickerModal';
import { HintedScrollView } from '@/components/HintedScrollView';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { setPhoto, upsertRecipe } from '@/db/repositories/library';
import {
  matchFood,
  parseIngredientLine,
  resolveAmountForFood,
  type ImportedRecipe,
} from '@/domain/recipeImport';
import { extractUrl, importRecipeFromUrl } from '@/services/recipeImport';
import { useFoods } from '@/hooks/library';
import { downloadPhoto } from '@/utils/photos';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

/** One imported ingredient line in the review list. */
type IngredientRow = {
  line: string;
  food: FoodRow | null;
  /** Amount in the matched food's base unit, as editable text; '' = unknown. */
  amountText: string;
  skipped: boolean;
};

function num(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

export default function RecipeImportScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ url?: string }>();
  const foodRows = useFoods();

  const [url, setUrl] = useState(params.url ?? '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<'notFound' | 'network' | null>(null);
  const [imported, setImported] = useState<ImportedRecipe | null>(null);
  const [rows, setRows] = useState<IngredientRow[]>([]);
  const [pickerRowIndex, setPickerRowIndex] = useState<number | null>(null);

  const load = async (rawUrl: string) => {
    const target = extractUrl(rawUrl);
    if (!target) {
      setError('network');
      return;
    }
    setLoading(true);
    setError(null);
    setImported(null);
    try {
      const result = await importRecipeFromUrl(target);
      if (!result) {
        setError('notFound');
        return;
      }
      setImported(result);
      setRows(
        result.ingredientLines.map((line) => {
          const parsed = parseIngredientLine(line);
          const food = parsed.name ? matchFood(parsed.name, foodRows) : null;
          const amount = food ? resolveAmountForFood(parsed.quantity, parsed.unitToken, food) : null;
          return { line, food, amountText: amount !== null ? String(amount) : '', skipped: false };
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  // Share-sheet path: arriving with ?url= auto-fetches immediately.
  useEffect(() => {
    if (params.url) void load(params.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.url]);

  const updateRow = (index: number, patch: Partial<IngredientRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const save = async () => {
    if (!imported || saving) return;
    setSaving(true);
    try {
      const included = rows.filter((row) => !row.skipped && row.food !== null && num(row.amountText) !== null);
      const leftover = rows.filter((row) => row.skipped || row.food === null || num(row.amountText) === null);

      const instructionParts: string[] = [];
      if (imported.instructions) instructionParts.push(imported.instructions);
      if (leftover.length > 0) {
        instructionParts.push(`${t('recipeImport.unmatchedHeading')}\n${leftover.map((row) => `• ${row.line}`).join('\n')}`);
      }

      const recipeId = await upsertRecipe(db, {
        nameCs: imported.name,
        nameEn: imported.name,
        instructionsCs: instructionParts.length > 0 ? instructionParts.join('\n\n') : null,
        category: 'lunch_dinner',
        isSide: false,
        budget: 'average',
        servingsBase: imported.servings ?? 1,
        prepTimeMinutes: imported.prepTimeMinutes,
        ingredients: included.map((row) => ({ foodId: row.food!.id, amount: num(row.amountText)! })),
      });
      if (imported.imageUrl) {
        const uri = await downloadPhoto(imported.imageUrl, recipeId);
        await setPhoto(db, 'recipe', recipeId, uri);
      }
      router.replace({ pathname: '/recipe/edit', params: { id: recipeId } });
    } finally {
      setSaving(false);
    }
  };

  const canSave = imported !== null && !saving;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <HintedScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader />
        <Text style={styles.title}>{t('recipeImport.title')}</Text>

        {!imported ? (
          <View style={styles.guideCard}>
            <Text style={styles.guideTitle}>{t('recipeImport.guideTitle')}</Text>
            {[1, 2, 3].map((step) => (
              <View key={step} style={styles.guideRow}>
                <View style={styles.guideBadge}>
                  <Text style={styles.guideBadgeText}>{step}</Text>
                </View>
                <Text style={styles.guideText}>{t(`recipeImport.guideStep${step}`)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <TextField
          label={t('recipeImport.urlLabel')}
          value={url}
          onChangeText={setUrl}
          placeholder="https://…"
          keyboardType="url"
        />
        <Button
          label={loading ? t('recipeImport.loading') : t('recipeImport.load')}
          onPress={() => void load(url)}
          disabled={loading || url.trim() === ''}
        />
        {loading ? <ActivityIndicator style={styles.spinner} color={colors.primary} /> : null}

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>
              {error === 'notFound' ? t('recipeImport.errorNotFound') : t('recipeImport.errorNetwork')}
            </Text>
          </View>
        ) : null}

        {imported ? (
          <View style={styles.resultCard}>
            {imported.imageUrl ? (
              <Image source={{ uri: imported.imageUrl }} style={styles.photo} contentFit="cover" />
            ) : null}
            <Text style={styles.recipeName}>{imported.name}</Text>
            <Text style={styles.recipeMeta}>
              {imported.servings !== null ? t('recipeImport.servings', { count: imported.servings }) : null}
              {imported.servings !== null && imported.prepTimeMinutes !== null ? ' · ' : null}
              {imported.prepTimeMinutes !== null ? `${imported.prepTimeMinutes} min` : null}
            </Text>

            {imported.partial ? <Text style={styles.partialNote}>{t('recipeImport.partialNote')}</Text> : null}

            {rows.length > 0 ? <Text style={styles.sectionTitle}>{t('recipeImport.ingredients')}</Text> : null}
            {rows.map((row, index) => (
              <View key={`${row.line}-${index}`} style={[styles.ingredientRow, row.skipped && styles.ingredientRowSkipped]}>
                <Text style={styles.ingredientLine} numberOfLines={2}>
                  {row.line}
                </Text>
                {!row.skipped ? (
                  <View style={styles.matchRow}>
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.matchChip, row.food === null && styles.matchChipMissing]}
                      onPress={() => setPickerRowIndex(index)}>
                      <Ionicons
                        name={row.food ? 'checkmark-circle' : 'help-circle-outline'}
                        size={15}
                        color={row.food ? colors.interactive : colors.danger}
                      />
                      <Text style={styles.matchChipLabel} numberOfLines={1}>
                        {row.food ? row.food.nameCs : t('recipeImport.pickFood')}
                      </Text>
                    </Pressable>
                    {row.food ? (
                      <View style={styles.amountWrap}>
                        <TextField
                          label=""
                          value={row.amountText}
                          onChangeText={(text) => updateRow(index, { amountText: text })}
                          keyboardType="decimal-pad"
                          suffix={row.food.baseUnit === 'piece' ? t('units.pcs') : row.food.baseUnit}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  style={styles.skipButton}
                  onPress={() => updateRow(index, { skipped: !row.skipped })}>
                  <Text style={styles.skipLabel}>{row.skipped ? t('recipeImport.include') : t('recipeImport.skip')}</Text>
                </Pressable>
              </View>
            ))}

            <Button
              label={saving ? t('recipeImport.saving') : t('recipeImport.save')}
              onPress={() => void save()}
              disabled={!canSave}
              style={styles.saveButton}
            />
          </View>
        ) : null}
      </HintedScrollView>

      {pickerRowIndex !== null ? (
        <FoodPickerModal
          visible
          onClose={() => setPickerRowIndex(null)}
          onPick={(food) => {
            const index = pickerRowIndex;
            setPickerRowIndex(null);
            const parsed = parseIngredientLine(rows[index].line);
            const amount = resolveAmountForFood(parsed.quantity, parsed.unitToken, food);
            updateRow(index, { food, amountText: amount !== null ? String(amount) : rows[index].amountText });
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    title: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
      marginBottom: spacing.md,
    },
    guideCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    guideTitle: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    guideRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    guideBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    guideBadgeText: {
      color: colors.onPrimary,
      fontSize: typography.small,
      fontWeight: '800',
    },
    guideText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: 18,
    },
    spinner: {
      marginTop: spacing.md,
    },
    errorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.danger + '15',
      borderRadius: radius.input,
      padding: spacing.sm + 2,
      marginTop: spacing.md,
    },
    errorText: {
      flex: 1,
      color: colors.danger,
      fontSize: typography.small,
      fontWeight: '600',
    },
    resultCard: {
      marginTop: spacing.md,
    },
    photo: {
      width: '100%',
      height: 180,
      borderRadius: radius.card,
      marginBottom: spacing.sm,
    },
    recipeName: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    recipeMeta: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
      marginBottom: spacing.sm,
    },
    partialNote: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontStyle: 'italic',
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    ingredientRow: {
      backgroundColor: colors.surface,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm + 2,
      marginBottom: spacing.sm,
    },
    ingredientRowSkipped: {
      opacity: 0.5,
    },
    ingredientLine: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '600',
    },
    matchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    matchChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.chip,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      maxWidth: '55%',
    },
    matchChipMissing: {
      borderColor: colors.danger,
    },
    matchChipLabel: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '600',
      flexShrink: 1,
    },
    amountWrap: {
      flex: 1,
    },
    skipButton: {
      alignSelf: 'flex-end',
      marginTop: spacing.xs,
    },
    skipLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    saveButton: {
      marginTop: spacing.md,
    },
  });
}

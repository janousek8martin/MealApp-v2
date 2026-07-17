import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodPickerModal, type FoodRow } from '@/components/FoodPickerModal';
import { HintedScrollView } from '@/components/HintedScrollView';
import { PhotoPicker } from '@/components/PhotoPicker';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { TextField } from '@/components/ui/TextField';
import { COOKING_EXPERIENCE_LEVELS, CUISINE_KEYS, RECIPE_TAG_KEYS } from '@/constants/options';
import { db } from '@/db/client';
import { setPhoto, upsertRecipe } from '@/db/repositories/library';
import { resources } from '@/i18n';
import { computeRecipeNutrition } from '@/domain/recipeNutrition';
import { findSimilarTag, type TagMatchCandidate } from '@/domain/recipeTags';
import { useFoods, usePhoto, usePhotoMap, useRecipe, useRecipeIngredients, useRecipes } from '@/hooks/library';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { displayRecipeTag } from '@/utils/recipeTags';
import { localizedName } from '@/utils/localized';

const RECIPE_CATEGORIES = ['breakfast', 'lunch_dinner', 'snack'] as const;

type DraftIngredient = { foodId: string; amount: string };

function num(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

function int(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

export default function RecipeEditScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useRecipe(id);
  const existingIngredients = useRecipeIngredients(id);
  const photo = usePhoto('recipe', id);
  const foodRows = useFoods();
  const foodById = new Map(foodRows.map((food) => [food.id, food]));
  const photoMap = usePhotoMap();
  const allRecipes = useRecipes();

  const [nameCs, setNameCs] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState<(typeof RECIPE_CATEGORIES)[number]>('lunch_dinner');
  const [isSide, setIsSide] = useState(false);
  const [canServeCold, setCanServeCold] = useState(false);
  const [mealPrepFriendly, setMealPrepFriendly] = useState(false);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [budget, setBudget] = useState<'cheap' | 'average' | 'expensive'>('average');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [servingsBase, setServingsBase] = useState('1');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState('');
  const [instructionsCs, setInstructionsCs] = useState('');
  const [instructionsEn, setInstructionsEn] = useState('');
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [customTagInput, setCustomTagInput] = useState('');

  // Dedup candidates: the fixed tag set's translations in BOTH locales (a
  // Czech-typed tag should still match an English fixed key and vice versa),
  // plus every custom tag already used on another recipe.
  const tagCandidates = useMemo<TagMatchCandidate[]>(() => {
    const fixed = RECIPE_TAG_KEYS.flatMap((key) => [
      { tag: key, label: resources.cs.translation.recipeTags[key] },
      { tag: key, label: resources.en.translation.recipeTags[key] },
    ]);
    const customTags = new Set<string>();
    for (const recipe of allRecipes) {
      if (!recipe.tagsJson) continue;
      for (const tag of JSON.parse(recipe.tagsJson) as string[]) {
        if (!(RECIPE_TAG_KEYS as readonly string[]).includes(tag)) customTags.add(tag);
      }
    }
    return [...fixed, ...[...customTags].map((tag) => ({ tag, label: tag }))];
  }, [allRecipes]);

  const addCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (!trimmed || tags.includes(trimmed)) {
      setCustomTagInput('');
      return;
    }
    const similar = findSimilarTag(trimmed, tagCandidates);
    if (similar && similar.tag !== trimmed) {
      Alert.alert(
        t('recipeEdit.tagDidYouMeanTitle'),
        t('recipeEdit.tagDidYouMean', { tag: displayRecipeTag(t, similar.tag) }),
        [
          {
            text: t('recipeEdit.tagUseExisting'),
            onPress: () => {
              if (!tags.includes(similar.tag)) setTags((prev) => [...prev, similar.tag]);
              setCustomTagInput('');
            },
          },
          {
            text: t('recipeEdit.tagCreateNew'),
            onPress: () => {
              setTags((prev) => [...prev, trimmed]);
              setCustomTagInput('');
            },
          },
        ],
      );
      return;
    }
    setTags((prev) => [...prev, trimmed]);
    setCustomTagInput('');
  };

  const removeCustomTag = (tag: string) => {
    setTags((prev) => prev.filter((existing) => existing !== tag));
  };

  const customTagsInUse = tags.filter((tag) => !(RECIPE_TAG_KEYS as readonly string[]).includes(tag));

  useEffect(() => {
    if (!existing || loadedId === existing.id) return;
    setLoadedId(existing.id);
    setNameCs(existing.nameCs);
    setNameEn(existing.nameEn);
    setCategory(existing.category);
    setIsSide(existing.isSide);
    setCanServeCold(existing.canServeCold);
    setMealPrepFriendly(existing.mealPrepFriendly);
    setCuisine(existing.cuisine);
    setTags(existing.tagsJson ? (JSON.parse(existing.tagsJson) as string[]) : []);
    setBudget(existing.budget);
    setDifficulty(existing.difficulty);
    setServingsBase(String(existing.servingsBase));
    setPrepTimeMinutes(existing.prepTimeMinutes !== null ? String(existing.prepTimeMinutes) : '');
    setInstructionsCs(existing.instructionsCs ?? '');
    setInstructionsEn(existing.instructionsEn ?? '');
  }, [existing, loadedId]);

  useEffect(() => {
    if (!id || existingIngredients.length === 0 || ingredients.length > 0) return;
    setIngredients(
      existingIngredients.map((row) => ({ foodId: row.food.id, amount: String(row.ingredient.amount) })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingIngredients.map((row) => row.ingredient.id).join(',')]);

  const addIngredient = (food: FoodRow) => {
    setPickerVisible(false);
    if (ingredients.some((entry) => entry.foodId === food.id)) return;
    setIngredients((prev) => [...prev, { foodId: food.id, amount: '100' }]);
  };

  const removeIngredient = (foodId: string) => {
    setIngredients((prev) => prev.filter((entry) => entry.foodId !== foodId));
  };

  const updateAmount = (foodId: string, amount: string) => {
    setIngredients((prev) => prev.map((entry) => (entry.foodId === foodId ? { ...entry, amount } : entry)));
  };

  const nutritionPreview = useMemo(() => {
    const withFood = ingredients.flatMap((entry) => {
      const food = foodById.get(entry.foodId);
      const amount = num(entry.amount);
      return food && amount !== null ? [{ amount, food }] : [];
    });
    if (withFood.length === 0) return null;
    return computeRecipeNutrition(withFood, num(servingsBase) ?? 1);
  }, [ingredients, foodById, servingsBase]);

  const canSave =
    nameCs.trim() !== '' &&
    nameEn.trim() !== '' &&
    num(servingsBase) !== null &&
    ingredients.length > 0 &&
    ingredients.every((entry) => num(entry.amount) !== null);

  const save = async () => {
    if (!canSave) return;
    const recipeId = await upsertRecipe(
      db,
      {
        nameCs: nameCs.trim(),
        nameEn: nameEn.trim(),
        instructionsCs: instructionsCs.trim() || null,
        instructionsEn: instructionsEn.trim() || null,
        category,
        isSide,
        canServeCold,
        mealPrepFriendly,
        cuisine,
        tags,
        budget,
        difficulty,
        servingsBase: num(servingsBase)!,
        prepTimeMinutes: int(prepTimeMinutes),
        ingredients: ingredients.map((entry) => ({ foodId: entry.foodId, amount: num(entry.amount)! })),
      },
      id || undefined,
    );
    if (photoUri) {
      await setPhoto(db, 'recipe', recipeId, photoUri);
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <HintedScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader />
        <Text style={styles.title}>{id ? t('recipeEdit.editTitle') : t('recipeEdit.newTitle')}</Text>

        <PhotoPicker uri={photoUri ?? photo?.uri ?? null} onPicked={setPhotoUri} />

        <TextField label={t('recipeEdit.nameCs')} value={nameCs} onChangeText={setNameCs} />
        <TextField label={t('recipeEdit.nameEn')} value={nameEn} onChangeText={setNameEn} />

        <ChipSelect
          label={t('recipeEdit.category')}
          options={RECIPE_CATEGORIES.map((key) => ({ value: key, label: t(`library.filter.${key}`) }))}
          value={category}
          onChange={(value) => setCategory(value as (typeof RECIPE_CATEGORIES)[number])}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('recipeEdit.isSide')}</Text>
          <Switch
            value={isSide}
            onValueChange={setIsSide}
            trackColor={{ true: colors.primaryLight, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('recipeEdit.canServeCold')}</Text>
          <Switch
            value={canServeCold}
            onValueChange={setCanServeCold}
            trackColor={{ true: colors.primaryLight, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('recipeEdit.mealPrepFriendly')}</Text>
          <Switch
            value={mealPrepFriendly}
            onValueChange={setMealPrepFriendly}
            trackColor={{ true: colors.primaryLight, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>

        <ChipSelect
          label={t('recipeEdit.cuisine')}
          options={CUISINE_KEYS.map((key) => ({ value: key, label: t(`cuisines.${key}`) }))}
          value={cuisine}
          onChange={setCuisine}
        />
        <ChipSelect
          label={t('recipeEdit.tags')}
          multi
          options={RECIPE_TAG_KEYS.map((key) => ({ value: key, label: t(`recipeTags.${key}`) }))}
          value={tags}
          onChange={setTags}
        />
        {customTagsInUse.length > 0 ? (
          <View style={styles.customTagsRow}>
            {customTagsInUse.map((tag) => (
              <Pressable key={tag} accessibilityRole="button" style={styles.customTagChip} onPress={() => removeCustomTag(tag)}>
                <Text style={styles.customTagChipLabel}>{tag}</Text>
                <Ionicons name="close" size={14} color={colors.primary} />
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.customTagInputRow}>
          <TextField
            label={t('recipeEdit.addCustomTag')}
            value={customTagInput}
            onChangeText={setCustomTagInput}
            placeholder={t('recipeEdit.addCustomTagPlaceholder')}
          />
          <Pressable accessibilityRole="button" style={styles.customTagAddButton} onPress={addCustomTag} disabled={!customTagInput.trim()}>
            <Ionicons name="add-circle" size={28} color={customTagInput.trim() ? colors.primary : colors.border} />
          </Pressable>
        </View>

        <ChipSelect
          label={t('recipeEdit.budget')}
          options={[
            { value: 'cheap', label: t('budget.cheap') },
            { value: 'average', label: t('budget.average') },
            { value: 'expensive', label: t('budget.expensive') },
          ]}
          value={budget}
          onChange={(value) => setBudget(value as typeof budget)}
        />

        <ChipSelect
          label={t('recipeEdit.difficulty')}
          options={COOKING_EXPERIENCE_LEVELS.map((level) => ({ value: level, label: t(`cookingExperience.${level}`) }))}
          value={difficulty}
          onChange={(value) => setDifficulty(value as typeof difficulty)}
        />

        <TextField
          label={t('recipeEdit.servingsBase')}
          value={servingsBase}
          onChangeText={setServingsBase}
          keyboardType="decimal-pad"
        />
        <TextField
          label={t('recipeEdit.prepTime')}
          value={prepTimeMinutes}
          onChangeText={setPrepTimeMinutes}
          keyboardType="number-pad"
          suffix="min"
        />

        <Text style={styles.section}>{t('recipeEdit.ingredients')}</Text>
        {ingredients.map((entry) => {
          const food = foodById.get(entry.foodId);
          const ingredientPhoto = photoMap.get(`food:${entry.foodId}`);
          return (
            <View key={entry.foodId} style={styles.ingredientRow}>
              {ingredientPhoto ? (
                <Image source={{ uri: ingredientPhoto }} style={styles.ingredientThumb} contentFit="cover" />
              ) : (
                <View style={[styles.ingredientThumb, styles.ingredientThumbPlaceholder]} />
              )}
              <Text style={styles.ingredientName} numberOfLines={1}>
                {food ? localizedName(food) : entry.foodId}
              </Text>
              <TextInput
                style={styles.ingredientAmountInput}
                value={entry.amount}
                onChangeText={(value) => updateAmount(entry.foodId, value)}
                keyboardType="decimal-pad"
              />
              <Text style={styles.ingredientUnit}>
                {food?.baseUnit === 'piece' ? t('units.pcs') : food?.baseUnit}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => removeIngredient(entry.foodId)}>
                <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          );
        })}
        <Pressable
          accessibilityRole="button"
          style={styles.addIngredient}
          onPress={() => setPickerVisible(true)}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addIngredientLabel}>{t('recipeEdit.addIngredient')}</Text>
        </Pressable>

        {nutritionPreview ? (
          <>
            <Text style={styles.section}>{t('recipeEdit.nutritionPreview')}</Text>
            <View style={styles.nutritionCard}>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(nutritionPreview.kcal)}</Text>
                <Text style={styles.nutritionLabel}>kcal</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(nutritionPreview.proteinG)} g</Text>
                <Text style={styles.nutritionLabel}>{t('macros.protein')}</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(nutritionPreview.carbsG)} g</Text>
                <Text style={styles.nutritionLabel}>{t('macros.carbs')}</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(nutritionPreview.fatG)} g</Text>
                <Text style={styles.nutritionLabel}>{t('macros.fat')}</Text>
              </View>
            </View>
          </>
        ) : null}

        <TextField
          label={t('recipeEdit.instructionsCs')}
          value={instructionsCs}
          onChangeText={setInstructionsCs}
          multiline
        />
        <TextField
          label={t('recipeEdit.instructionsEn')}
          value={instructionsEn}
          onChangeText={setInstructionsEn}
          multiline
        />

        <View style={styles.actions}>
          <Button label={t('common.cancel')} variant="secondary" onPress={() => router.back()} style={styles.action} />
          <Button label={t('common.save')} onPress={save} disabled={!canSave} style={styles.action} />
        </View>
      </HintedScrollView>

      <FoodPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onPick={addIngredient}
      />
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
    section: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
      marginVertical: spacing.sm,
    },
    customTagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    customTagChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.chip,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    customTagChipLabel: {
      color: colors.primary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    customTagInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    customTagAddButton: {
      marginBottom: spacing.sm,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    switchLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    ingredientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.xs + 2,
    },
    ingredientThumb: {
      width: 36,
      height: 36,
      borderRadius: radius.card - 12,
    },
    ingredientThumbPlaceholder: {
      backgroundColor: colors.mint,
    },
    ingredientName: {
      flex: 1,
      color: colors.text,
      fontSize: typography.body,
    },
    ingredientAmountInput: {
      width: 60,
      textAlign: 'right',
      color: colors.text,
      fontSize: typography.body,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    ingredientUnit: {
      color: colors.textSecondary,
      fontSize: typography.small,
      width: 24,
    },
    addIngredient: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      alignSelf: 'flex-start',
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
    },
    addIngredientLabel: {
      color: colors.primary,
      fontSize: typography.body,
      fontWeight: '600',
    },
    nutritionCard: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
    },
    nutritionItem: {
      alignItems: 'center',
    },
    nutritionValue: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    nutritionLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    action: {
      flex: 1,
    },
  });
}

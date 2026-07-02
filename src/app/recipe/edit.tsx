import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodPickerModal, type FoodRow } from '@/components/FoodPickerModal';
import { PhotoPicker } from '@/components/PhotoPicker';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { setPhoto, upsertRecipe } from '@/db/repositories/library';
import { useFoods, usePhoto, useRecipe, useRecipeIngredients } from '@/hooks/library';
import { colors, radius, spacing, typography } from '@/theme/tokens';
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
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useRecipe(id);
  const existingIngredients = useRecipeIngredients(id);
  const photo = usePhoto('recipe', id);
  const foodRows = useFoods();
  const foodById = new Map(foodRows.map((food) => [food.id, food]));

  const [nameCs, setNameCs] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState<(typeof RECIPE_CATEGORIES)[number]>('lunch_dinner');
  const [isSide, setIsSide] = useState(false);
  const [budget, setBudget] = useState<'cheap' | 'average' | 'expensive'>('average');
  const [servingsBase, setServingsBase] = useState('1');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState('');
  const [instructionsCs, setInstructionsCs] = useState('');
  const [instructionsEn, setInstructionsEn] = useState('');
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [maxRepetitionsOverride, setMaxRepetitionsOverride] = useState('');
  const [consecutiveOverride, setConsecutiveOverride] = useState<'default' | 'yes' | 'no'>('default');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    if (!existing || loadedId === existing.id) return;
    setLoadedId(existing.id);
    setNameCs(existing.nameCs);
    setNameEn(existing.nameEn);
    setCategory(existing.category);
    setIsSide(existing.isSide);
    setBudget(existing.budget);
    setServingsBase(String(existing.servingsBase));
    setPrepTimeMinutes(existing.prepTimeMinutes !== null ? String(existing.prepTimeMinutes) : '');
    setInstructionsCs(existing.instructionsCs ?? '');
    setInstructionsEn(existing.instructionsEn ?? '');
    setMaxRepetitionsOverride(
      existing.maxRepetitionsPerWeek !== null ? String(existing.maxRepetitionsPerWeek) : '',
    );
    setConsecutiveOverride(
      existing.allowConsecutiveDays === null ? 'default' : existing.allowConsecutiveDays ? 'yes' : 'no',
    );
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
        budget,
        servingsBase: num(servingsBase)!,
        prepTimeMinutes: int(prepTimeMinutes),
        maxRepetitionsPerWeek: int(maxRepetitionsOverride),
        allowConsecutiveDays:
          consecutiveOverride === 'default' ? null : consecutiveOverride === 'yes',
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
          return (
            <View key={entry.foodId} style={styles.ingredientRow}>
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

        <Text style={styles.section}>{t('recipeEdit.repetitionSection')}</Text>
        <TextField
          label={t('recipeEdit.maxRepetitionsOverride')}
          value={maxRepetitionsOverride}
          onChangeText={setMaxRepetitionsOverride}
          placeholder={t('recipeDetail.maxRepetitionsDefault')}
          keyboardType="number-pad"
        />
        <ChipSelect
          label={t('recipeEdit.consecutiveDays')}
          options={[
            { value: 'default', label: t('recipeDetail.consecutiveDefault') },
            { value: 'yes', label: t('recipeDetail.consecutiveYes') },
            { value: 'no', label: t('recipeDetail.consecutiveNo') },
          ]}
          value={consecutiveOverride}
          onChange={(value) => setConsecutiveOverride(value as typeof consecutiveOverride)}
        />

        <View style={styles.actions}>
          <Button label={t('common.cancel')} variant="secondary" onPress={() => router.back()} style={styles.action} />
          <Button label={t('common.save')} onPress={save} disabled={!canSave} style={styles.action} />
        </View>
      </ScrollView>

      <FoodPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onPick={addIngredient}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  action: {
    flex: 1,
  },
});

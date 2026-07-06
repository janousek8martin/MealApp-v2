import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoPicker } from '@/components/PhotoPicker';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { TextField } from '@/components/ui/TextField';
import { ALLERGEN_ICONS, DIET_ICONS } from '@/constants/chipIcons';
import { ALLERGEN_KEYS, MANUAL_DIET_KEYS } from '@/constants/options';
import { db } from '@/db/client';
import { setPhoto, upsertFood } from '@/db/repositories/library';
import { useFood, useFoodAllergens, usePhoto } from '@/hooks/library';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, type ColorTokens } from '@/theme/tokens';

const CATEGORY_KEYS = [
  'meat', 'fish', 'eggs', 'dairy', 'grains', 'legumes', 'bakery', 'vegetables', 'fruit',
  'nuts', 'seeds', 'fats', 'sweets', 'sweeteners', 'supplements', 'other',
];

function num(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

export default function FoodEditScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useFood(id);
  const existingAllergens = useFoodAllergens(id);
  const photo = usePhoto('food', id);

  const [nameCs, setNameCs] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [baseUnit, setBaseUnit] = useState<'g' | 'ml' | 'piece'>('g');
  const [gramsPerPiece, setGramsPerPiece] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [ironMg, setIronMg] = useState('');
  const [vitaminDUg, setVitaminDUg] = useState('');
  const [b12Ug, setB12Ug] = useState('');
  const [calciumMg, setCalciumMg] = useState('');
  const [omega3G, setOmega3G] = useState('');
  const [budget, setBudget] = useState<'cheap' | 'average' | 'expensive'>('average');
  const [shelfLifeDays, setShelfLifeDays] = useState('');
  const [storage, setStorage] = useState<string | null>(null);
  const [snackSuitable, setSnackSuitable] = useState(false);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [dietFlags, setDietFlags] = useState<string[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    if (!existing || loadedId === existing.id) return;
    setLoadedId(existing.id);
    setNameCs(existing.nameCs);
    setNameEn(existing.nameEn);
    setCategory(existing.category);
    setBaseUnit(existing.baseUnit);
    setGramsPerPiece(existing.gramsPerPiece ? String(existing.gramsPerPiece) : '');
    setKcal(String(existing.kcalPer100));
    setProtein(String(existing.proteinPer100));
    setCarbs(String(existing.carbsPer100));
    setFat(String(existing.fatPer100));
    setFiber(existing.fiberPer100 !== null ? String(existing.fiberPer100) : '');
    const micronutrients = existing.micronutrientsJson
      ? (JSON.parse(existing.micronutrientsJson) as Record<string, number>)
      : {};
    setIronMg(micronutrients.ironMg !== undefined ? String(micronutrients.ironMg) : '');
    setVitaminDUg(micronutrients.vitaminDUg !== undefined ? String(micronutrients.vitaminDUg) : '');
    setB12Ug(micronutrients.b12Ug !== undefined ? String(micronutrients.b12Ug) : '');
    setCalciumMg(micronutrients.calciumMg !== undefined ? String(micronutrients.calciumMg) : '');
    setOmega3G(micronutrients.omega3G !== undefined ? String(micronutrients.omega3G) : '');
    setBudget(existing.budget);
    setShelfLifeDays(existing.shelfLifeDays !== null ? String(existing.shelfLifeDays) : '');
    setStorage(existing.storage);
    setSnackSuitable(existing.snackSuitable);
    setDietFlags(existing.dietFlagsJson ? (JSON.parse(existing.dietFlagsJson) as string[]) : []);
  }, [existing, loadedId]);

  useEffect(() => {
    if (id && existingAllergens.length > 0) setAllergens(existingAllergens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingAllergens.join(',')]);

  const canSave =
    nameCs.trim() !== '' &&
    nameEn.trim() !== '' &&
    category !== null &&
    num(kcal) !== null &&
    num(protein) !== null &&
    num(carbs) !== null &&
    num(fat) !== null &&
    (baseUnit !== 'piece' || num(gramsPerPiece) !== null);

  const save = async () => {
    if (!canSave || category === null) return;
    const foodId = await upsertFood(
      db,
      {
        nameCs: nameCs.trim(),
        nameEn: nameEn.trim(),
        category,
        baseUnit,
        gramsPerPiece: baseUnit === 'piece' ? num(gramsPerPiece) : null,
        kcalPer100: num(kcal)!,
        proteinPer100: num(protein)!,
        carbsPer100: num(carbs)!,
        fatPer100: num(fat)!,
        fiberPer100: num(fiber),
        micronutrients: {
          ironMg: num(ironMg),
          vitaminDUg: num(vitaminDUg),
          b12Ug: num(b12Ug),
          calciumMg: num(calciumMg),
          omega3G: num(omega3G),
        },
        budget,
        shelfLifeDays: num(shelfLifeDays),
        storage: (storage ?? null) as 'pantry' | 'fridge' | 'freezer' | null,
        snackSuitable,
        dietFlags,
        allergens,
      },
      id || undefined,
    );
    if (photoUri) {
      await setPhoto(db, 'food', foodId, photoUri);
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{id ? t('foodEdit.editTitle') : t('foodEdit.newTitle')}</Text>

        <PhotoPicker uri={photoUri ?? photo?.uri ?? null} onPicked={setPhotoUri} />

        <TextField label={t('foodEdit.nameCs')} value={nameCs} onChangeText={setNameCs} />
        <TextField label={t('foodEdit.nameEn')} value={nameEn} onChangeText={setNameEn} />

        <ChipSelect
          label={t('foodEdit.category')}
          options={CATEGORY_KEYS.map((key) => ({ value: key, label: t(`foodCategory.${key}`) }))}
          value={category}
          onChange={setCategory}
        />
        <ChipSelect
          label={t('foodEdit.baseUnit')}
          options={[
            { value: 'g', label: 'g' },
            { value: 'ml', label: 'ml' },
            { value: 'piece', label: t('units.pcs') },
          ]}
          value={baseUnit}
          onChange={(value) => setBaseUnit(value as 'g' | 'ml' | 'piece')}
        />
        {baseUnit === 'piece' ? (
          <TextField
            label={t('foodEdit.gramsPerPiece')}
            value={gramsPerPiece}
            onChangeText={setGramsPerPiece}
            keyboardType="decimal-pad"
            suffix="g"
          />
        ) : null}

        <Text style={styles.section}>
          {t('foodDetail.nutritionPer100', { unit: baseUnit === 'piece' ? 'g' : baseUnit })}
        </Text>
        <TextField label="kcal" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" />
        <TextField label={t('macros.protein')} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" suffix="g" />
        <TextField label={t('macros.carbs')} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" suffix="g" />
        <TextField label={t('macros.fat')} value={fat} onChangeText={setFat} keyboardType="decimal-pad" suffix="g" />
        <TextField label={t('macros.fiber')} value={fiber} onChangeText={setFiber} keyboardType="decimal-pad" suffix="g" />

        <Text style={styles.section}>{t('foodDetail.micronutrients')}</Text>
        <TextField label={t('micros.ironMg')} value={ironMg} onChangeText={setIronMg} keyboardType="decimal-pad" />
        <TextField label={t('micros.vitaminDUg')} value={vitaminDUg} onChangeText={setVitaminDUg} keyboardType="decimal-pad" />
        <TextField label={t('micros.b12Ug')} value={b12Ug} onChangeText={setB12Ug} keyboardType="decimal-pad" />
        <TextField label={t('micros.calciumMg')} value={calciumMg} onChangeText={setCalciumMg} keyboardType="decimal-pad" />
        <TextField label={t('micros.omega3G')} value={omega3G} onChangeText={setOmega3G} keyboardType="decimal-pad" />

        <ChipSelect
          label={t('foodEdit.budget')}
          options={[
            { value: 'cheap', label: t('budget.cheap') },
            { value: 'average', label: t('budget.average') },
            { value: 'expensive', label: t('budget.expensive') },
          ]}
          value={budget}
          onChange={(value) => setBudget(value as typeof budget)}
        />
        <TextField
          label={t('foodEdit.shelfLife')}
          value={shelfLifeDays}
          onChangeText={setShelfLifeDays}
          keyboardType="number-pad"
          suffix={t('units.days')}
        />
        <ChipSelect
          label={t('foodEdit.storage')}
          options={[
            { value: 'pantry', label: t('storage.pantry') },
            { value: 'fridge', label: t('storage.fridge') },
            { value: 'freezer', label: t('storage.freezer') },
          ]}
          value={storage}
          onChange={setStorage}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('foodEdit.snackSuitable')}</Text>
          <Switch
            value={snackSuitable}
            onValueChange={setSnackSuitable}
            trackColor={{ true: colors.primaryLight, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>

        <ChipSelect
          label={t('form.allergens')}
          multi
          options={ALLERGEN_KEYS.map((key) => ({ value: key, label: t(`allergens.${key}`), icon: ALLERGEN_ICONS[key] }))}
          value={allergens}
          onChange={setAllergens}
        />
        <ChipSelect
          label={t('foodEdit.dietFlags')}
          multi
          options={MANUAL_DIET_KEYS.map((key) => ({ value: key, label: t(`diets.${key}`), icon: DIET_ICONS[key] }))}
          value={dietFlags}
          onChange={setDietFlags}
        />

        <View style={styles.actions}>
          <Button label={t('common.cancel')} variant="secondary" onPress={() => router.back()} style={styles.action} />
          <Button label={t('common.save')} onPress={save} disabled={!canSave} style={styles.action} />
        </View>
      </ScrollView>
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

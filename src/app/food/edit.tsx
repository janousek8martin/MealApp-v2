import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdvancedExpander } from '@/components/ui/AdvancedExpander';
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal';
import { HintedScrollView } from '@/components/HintedScrollView';
import { PhotoPicker } from '@/components/PhotoPicker';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { TextField } from '@/components/ui/TextField';
import { ALLERGEN_ICONS, DIET_ICONS } from '@/constants/chipIcons';
import { ALLERGEN_KEYS, MANUAL_DIET_KEYS } from '@/constants/options';
import { db } from '@/db/client';
import { confirmFoodReviewed, setPhoto, upsertFood } from '@/db/repositories/library';
import { MICRONUTRIENT_KEYS, MICRONUTRIENTS, type MicronutrientGroup, type MicronutrientKey } from '@/domain/micronutrients';
import { useFood, useFoodAllergens, usePhoto } from '@/hooks/library';
import { getProductByBarcode } from '@/services/openFoodFacts';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const MICRO_GROUP_ORDER: MicronutrientGroup[] = ['vitamins', 'minerals', 'lipids'];
const emptyMicronutrients = (): Record<MicronutrientKey, string> =>
  Object.fromEntries(MICRONUTRIENT_KEYS.map((key) => [key, ''])) as Record<MicronutrientKey, string>;

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
  const [gramsPerCup, setGramsPerCup] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [micronutrients, setMicronutrients] = useState<Record<MicronutrientKey, string>>(emptyMicronutrients());
  const setMicronutrient = (key: MicronutrientKey, value: string) =>
    setMicronutrients((prev) => ({ ...prev, [key]: value }));
  const [budget, setBudget] = useState<'cheap' | 'average' | 'expensive'>('average');
  const [shelfLifeDays, setShelfLifeDays] = useState('');
  const [storage, setStorage] = useState<string | null>(null);
  const [snackSuitable, setSnackSuitable] = useState(false);
  const [canServeCold, setCanServeCold] = useState(false);
  const [mealPrepFriendly, setMealPrepFriendly] = useState(false);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [dietFlags, setDietFlags] = useState<string[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [lookingUpBarcode, setLookingUpBarcode] = useState(false);
  // Set only by a barcode scan (see onBarcodeScanned) - a fresh manual add
  // has none of these and stays needsReview: false (upsertFood's default).
  const [scannedProvenance, setScannedProvenance] = useState<{
    novaGroup: number | null;
    nutriScoreGrade: 'a' | 'b' | 'c' | 'd' | 'e' | null;
    ecoScoreGrade: 'a' | 'b' | 'c' | 'd' | 'e' | null;
  } | null>(null);

  useEffect(() => {
    if (!existing || loadedId === existing.id) return;
    setLoadedId(existing.id);
    setNameCs(existing.nameCs);
    setNameEn(existing.nameEn);
    setCategory(existing.category);
    setBaseUnit(existing.baseUnit);
    setGramsPerPiece(existing.gramsPerPiece ? String(existing.gramsPerPiece) : '');
    setGramsPerCup(existing.gramsPerCup ? String(existing.gramsPerCup) : '');
    setKcal(String(existing.kcalPer100));
    setProtein(String(existing.proteinPer100));
    setCarbs(String(existing.carbsPer100));
    setFat(String(existing.fatPer100));
    setFiber(existing.fiberPer100 !== null ? String(existing.fiberPer100) : '');
    const loadedMicros = existing.micronutrientsJson
      ? (JSON.parse(existing.micronutrientsJson) as Partial<Record<MicronutrientKey, number>>)
      : {};
    setMicronutrients(
      Object.fromEntries(
        MICRONUTRIENT_KEYS.map((key) => [key, loadedMicros[key] !== undefined ? String(loadedMicros[key]) : '']),
      ) as Record<MicronutrientKey, string>,
    );
    setBudget(existing.budget);
    setShelfLifeDays(existing.shelfLifeDays !== null ? String(existing.shelfLifeDays) : '');
    setStorage(existing.storage);
    setSnackSuitable(existing.snackSuitable);
    setCanServeCold(existing.canServeCold);
    setMealPrepFriendly(existing.mealPrepFriendly);
    setDietFlags(existing.dietFlagsJson ? (JSON.parse(existing.dietFlagsJson) as string[]) : []);
    setBarcode(existing.barcode);
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
        gramsPerCup: baseUnit === 'g' ? num(gramsPerCup) : null,
        kcalPer100: num(kcal)!,
        proteinPer100: num(protein)!,
        carbsPer100: num(carbs)!,
        fatPer100: num(fat)!,
        fiberPer100: num(fiber),
        micronutrients: Object.fromEntries(
          MICRONUTRIENT_KEYS.map((key) => [key, num(micronutrients[key])]),
        ) as Record<MicronutrientKey, number | null>,
        budget,
        shelfLifeDays: num(shelfLifeDays),
        storage: (storage ?? null) as 'pantry' | 'fridge' | 'freezer' | null,
        snackSuitable,
        canServeCold,
        mealPrepFriendly,
        dietFlags,
        allergens,
        barcode,
        novaGroup: scannedProvenance?.novaGroup,
        nutriScoreGrade: scannedProvenance?.nutriScoreGrade,
        ecoScoreGrade: scannedProvenance?.ecoScoreGrade,
        needsReview: scannedProvenance !== null,
        source: scannedProvenance !== null ? 'off_label' : undefined,
      },
      id || undefined,
    );
    if (photoUri) {
      await setPhoto(db, 'food', foodId, photoUri);
    }
    // Editing an already-flagged food IS the review - a fresh scan's own
    // needsReview:true (set above via upsertFood) is left untouched here.
    if (id && existing?.needsReview) {
      await confirmFoodReviewed(db, foodId);
    }
    router.back();
  };

  const onBarcodeScanned = async (scanned: string) => {
    setScannerVisible(false);
    setBarcode(scanned);
    setLookingUpBarcode(true);
    try {
      const product = await getProductByBarcode(scanned);
      if (!product) {
        Alert.alert(t('foodEdit.productNotFoundTitle'), t('foodEdit.productNotFoundMessage'));
        return;
      }
      if (product.name) {
        if (!nameCs.trim()) setNameCs(product.name);
        if (!nameEn.trim()) setNameEn(product.name);
      }
      if (product.kcalPer100 !== null) setKcal(String(product.kcalPer100));
      if (product.proteinPer100 !== null) setProtein(String(product.proteinPer100));
      if (product.carbsPer100 !== null) setCarbs(String(product.carbsPer100));
      if (product.fatPer100 !== null) setFat(String(product.fatPer100));
      if (product.fiberPer100 !== null) setFiber(String(product.fiberPer100));
      setScannedProvenance({
        novaGroup: product.novaGroup,
        nutriScoreGrade: product.nutriScoreGrade,
        ecoScoreGrade: product.ecoScoreGrade,
      });
    } finally {
      setLookingUpBarcode(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <HintedScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader />
        <Text style={styles.title}>{id ? t('foodEdit.editTitle') : t('foodEdit.newTitle')}</Text>

        {existing?.needsReview ? (
          <View style={styles.reviewBanner}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.attention} />
            <Text style={styles.reviewBannerText}>{t('foodDetail.needsReviewBannerEdit')}</Text>
          </View>
        ) : null}

        <Button
          label={lookingUpBarcode ? t('foodEdit.lookingUpBarcode') : t('foodEdit.scanBarcode')}
          variant="secondary"
          onPress={() => setScannerVisible(true)}
          disabled={lookingUpBarcode}
          style={styles.scanButton}
        />
        {barcode ? <Text style={styles.barcodeValue}>{t('foodEdit.barcodeValue', { barcode })}</Text> : null}

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
        {baseUnit === 'g' ? (
          <TextField
            label={t('foodEdit.gramsPerCup')}
            value={gramsPerCup}
            onChangeText={setGramsPerCup}
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
            trackColor={{ true: colors.interactive, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('foodEdit.canServeCold')}</Text>
          <Switch
            value={canServeCold}
            onValueChange={setCanServeCold}
            trackColor={{ true: colors.interactive, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('foodEdit.mealPrepFriendly')}</Text>
          <Switch
            value={mealPrepFriendly}
            onValueChange={setMealPrepFriendly}
            trackColor={{ true: colors.interactive, false: colors.border }}
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

        <AdvancedExpander label={t('foodEdit.advancedNutrition')}>
          {MICRO_GROUP_ORDER.map((group) => (
            <View key={group}>
              <Text style={styles.microGroupLabel}>{t(`foodDetail.microGroup.${group}`)}</Text>
              {MICRONUTRIENT_KEYS.filter((key) => MICRONUTRIENTS[key].group === group).map((key) => (
                <TextField
                  key={key}
                  label={t(`micros.${key}`)}
                  value={micronutrients[key]}
                  onChangeText={(value) => setMicronutrient(key, value)}
                  keyboardType="decimal-pad"
                />
              ))}
            </View>
          ))}
        </AdvancedExpander>

        <View style={styles.actions}>
          <Button label={t('common.cancel')} variant="secondary" onPress={() => router.back()} style={styles.action} />
          <Button label={t('common.save')} onPress={save} disabled={!canSave} style={styles.action} />
        </View>
      </HintedScrollView>

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={(scanned) => void onBarcodeScanned(scanned)}
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
    reviewBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.attention,
      borderRadius: radius.input,
      padding: spacing.sm + 2,
      marginBottom: spacing.md,
    },
    reviewBannerText: {
      flex: 1,
      color: colors.text,
      fontSize: typography.small,
      lineHeight: 18,
    },
    scanButton: {
      marginBottom: spacing.xs,
    },
    barcodeValue: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.md,
    },
    section: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
      marginVertical: spacing.sm,
    },
    microGroupLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '700',
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
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

# Adaptivní TDEE — návrh algoritmu (bod 9)

## Cíl
Vedle grafu váhy na obrazovce Pokrok zobrazit **informativní srovnání**:
- **"Odhad dle vzorce"** — dnešní TDEE z Mifflin-St Jeor × aktivitní koeficient (už existuje, `computeTargets`).
- **"Odhad dle skutečného trendu"** — TDEE dopočítaný zpětně z reálného vývoje váhy a zalogovaného příjmu za posledních ~2–4 týdny.

Žádná automatická korekce cíle — jen zobrazení vedle sebe.

## Princip (energetická bilance)
```
skutečný TDEE ≈ průměrný denní zalogovaný příjem − (změna váhy v kg × 7700 kcal/kg) / počet dní v okně
```
7700 kcal/kg = `KCAL_PER_KG_FAT`, konstanta už v `src/domain/constants.ts`.

Pokud váha za období klesla (schodek), skutečný výdej byl **vyšší** než co člověk snědl → vzorec to zohlední (odečítá zápornou změnu, tedy přičítá). Pokud váha stoupla, výdej byl nižší.

## Vstupy a jejich zdroj
1. **Trend váhy**: `bodyMetrics` záznamy profilu v okně (výchozí 21 dní, konfigurovatelné 14–28). Místo prostého (poslední − první) použiju **lineární regresi** (least squares) váhy podle dne v okně → sklon (kg/den) × počet dní okna = změna váhy. Vlastnosti:
   - Odolnější proti jednorázovým výkyvům (voda, jídlo v žaludku) než porovnání dvou bodů.
   - Funguje i s nepravidelným zapisováním (týdenní vážení dle brief sekce "Cíl a tělesné složení" – připomínka každé pondělí).
2. **Průměrný denní příjem**: součet kcal z `plannedMealPortions` se stavem `'eaten'` (+ `plannedMealExtras`, pokud jsou u snědeného jídla) pro daný profil, po dnech, **jen za dny, kde je alespoň jeden záznam** — den bez zalogovaného jídla se **nepočítá jako 0 kcal**, prostě se z průměru vynechá (stejná filozofie jako tichý skip u chybějících mikroživin, CLAUDE.md).

## Práh kvality dat (kdy vůbec něco ukázat)
- Potřeba **≥ 2 váhové záznamy** rozprostřené přes **≥ 10 dní** okna (na regresi).
- Potřeba **≥ 5 dní** se zalogovaným příjmem v okně (na rozumný průměr).
- Pokud podmínky nesplněny → žádné číslo, jen text „zatím málo dat" (žádné poplašné/nesmyslné hlášky, stejná filozofie jako u mikroživin).

## Výstup (čistá doménová funkce, testovatelná)
```ts
type AdaptiveTdeeInput = {
  weighIns: { date: string; weightKg: number }[]; // v okně, řazeno
  loggedDailyKcal: { date: string; kcal: number }[]; // jen dny s aspoň 1 záznamem
  windowDays: number; // default 21
};

type AdaptiveTdeeResult =
  | { status: 'insufficient_data'; reason: 'weight' | 'intake' | 'both' }
  | { status: 'ok'; estimatedTdeeKcal: number; weightTrendKgPerWeek: number; loggedDaysCount: number };

function estimateAdaptiveTdee(input: AdaptiveTdeeInput): AdaptiveTdeeResult
```

## UI (Progress screen)
Nový box pod/vedle grafu váhy:
```
Odhad dle vzorce:        2712 kcal
Odhad dle trendu (21 dní): 2540 kcal   (na základě 12 zalogovaných dní)
```
Pokud `insufficient_data` → „Pro odhad dle skutečného trendu zatím chybí data (potřeba pravidelnější zapisování váhy/jídel)."

## Co to VYNECHÁVÁ (vědomě, mimo scope bodu 9)
- Žádná automatická úprava `tdciManualAdjustmentKcal` ani cíle — čistě informativní.
- Žádné vyhlazování exponenciálním klouzavým průměrem (EMA) navíc — lineární regrese na syrových datech je dost robustní pro V1 a je jednodušší na vysvětlení uživateli.
- Needituje se okno (pevných 21 dní) v V1 — dá se přidat později jako nastavení.

## Otázka k potvrzení
Souhlasíš s tímto přístupem (lineární regrese váhy + průměr zalogovaného příjmu, 21denní okno, prahy 10 dní/2 váhy a 5 dní příjmu), nebo chceš něco upravit před implementací?

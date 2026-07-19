# Nálezy ze starých prototypů (MealApp2.0, MealApp2.1, MealPlannerAPp) vs. aktuální CLAUDE.md

Zdroj: prozkoumání `G:\Můj disk\MealApp2.0`, `MealApp2.1` (Expo/RN prototypy, oba se dají spustit `npx expo start --web`) a `MealPlannerAPp\Newest version` (dump `.txt` zdrojáků, RN/JS navzdory názvu, nespustitelný bez rekonstrukce package.json).

Toto je **návrh k odsouhlasení**, ne hotový plán. U každé položky je potřeba rozhodnout: přebrat / upravit / zahodit.

---

## A) Věci, které dává smysl vzít vážně (doporučeno k portování)

1. **Diferencovaná tolerance maker při generování jídelníčku**
   - Bílkoviny ±10 % (nejpřísnější), tuk ±20 %, sacharidy ±25 % (nejvolnější).
   - Kalorie na jednotlivé jídlo ±3 %, ale denní součet kalorií tvrdý limit ±100 kcal.
   - V CLAUDE.md teď žádná tolerance specifikovaná není — toto by šlo doplnit do `computeTargets`/scoring logiky generování.
   - **Otázka:** chceš tyto konkrétní čísla, nebo je brát jen jako orientační rámec a doladit vlastní?

2. **Unit conversion systém (`Units.txt`)**
   - Hotová převodní tabulka objemů/hmotností (US ↔ metric).
   - Navíc rozšiřitelný model: uživatel si může definovat vlastní pojmenovanou jednotku s konverzním faktorem na základní jednotku.
   - CLAUDE.md už převodní tabulku vyžaduje (sekce Recepty a databáze potravin) — tohle je hotová referenční implementace.
   - **Otázka:** chceš i tu "custom unit" funkci pro uživatele, nebo stačí pevná standardní tabulka?

3. **UX vzory z modálů (jen interakční patterny, ne čísla/vzorce)**
   - Undo/soft-delete při odebrání člena domácnosti.
   - Gating počtu svačinových slotů podle nastaveného počtu jídel denně.
   - Tři oddělené fasety pro omezení jídel: kategorie jídla / typ potraviny / alergeny (místo jednoho společného seznamu).
   - Gating "rekompozice" cíle podle toho, jestli profil má vyplněná aktivity data.
   - **Otázka:** je něco z toho, co vysloveně nechceš (např. undo/soft-delete přidává komplexitu navíc)?

---

## B) Věci k zahození (nedoporučeno)

- **Celá `mealPlanGenerator/optimization` + `learning` pipeline** z MealApp2.0 (knapsack optimalizace, "AI learning" na základě zpětné vazby) — z velké části jsou to prázdné stub soubory, nikdy nedokončený rozestavěný pokus. Potvrzuje to, že jednodušší vážený-náhodný přístup už popsaný v CLAUDE.md je správný směr.
- **Vlastní kalorické/proteinové vzorce** ze starých appek (adaptivní úprava 500 kcal/kg týdně dle změny váhy, protein 2.65–3.55 g/kg LBM, body-fat fudge faktory na BMR) — kolidují s vědeckým základem (Mifflin-St Jeor, ISSN rozsahy), který je v CLAUDE.md už zafixovaný a odůvodněný studiemi. Nepřepisovat.
- **MaxMealRepetitionModal** ze starých appek — mělo jen jedno globální číslo bez per-recept override. CLAUDE.md už teď počítá s oběma (globální i per-recept), takže staré řešení je krok zpět.

---

## Otevřené otázky k rozhodnutí, než se cokoliv implementuje

1. Tolerance maker (bod A1) — použít navržená čísla, upravit je, nebo je zatím odložit?
2. Custom units (bod A2) — chceš i uživatelsky definované jednotky, nebo jen standardní tabulku?
3. UX vzory (bod A3) — které konkrétně chceš (undo-delete, svačinový gating, 3 fasety omezení, rekompozice-gating) a které ne?
4. Priorita — má se tohle řešit hned v rámci aktuální fáze vývoje, nebo je to poznámka na později?

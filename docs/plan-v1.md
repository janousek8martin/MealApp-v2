# MealApp – Plán V1 (revize 2, k schválení)

## Kontext

Nový start rodinné meal-planning appky podle briefu v `CLAUDE.md`: offline-first mobilní appka, která spočítá kalorické potřeby (TDCI), vygeneruje týdenní sdílený jídelníček pro domácnost, odvodí nákupní seznam, spravuje spíž a sleduje pokrok. Primárně osobní/rodinný nástroj – méně funkcí, ale spolehlivě.

**Stav repa:** git repo existuje (větev `master`, bez commitů), `CLAUDE.md` je v kořeni, bitově identický s `Downloads/CONTEXT.md` (ověřeno hashem). Zbývá první commit.

**Rozhodnutí uživatele:**
- **Android**, vývoj na Windows (lokální emulátor / fyzické zařízení, `npx expo run:android`).
- V1 = **jedno zařízení**, lokální profily, žádný sync (model sync-ready pro fázi 2).
- V1 navíc: **notifikace**, **focení jídel/surovin**. Odloženo: barcode skener, runtime Pexels.
- **Plná seed databáze** (~60–80 potravin, ~30–40 receptů, CZ + středomořská kuchyně, bilingvně).
- Snídaně: **konfigurovatelné** (sdílená / individuální), výchozí sdílená.
- Domácnost: **dospělí + děti**.
- **Týden vždy od pondělí** (potvrzeno ze staré verze).

**Vyřešené rozpory v CLAUDE.md (vědomá rozhodnutí):**
1. Supabase ve fázi 1 vs. „lokální DB" → V1 čistě lokální, model sync-ready.
2. „Úprava poměru komponent v jídle" (sekce 3) vs. algoritmus krok 5 („jeden multiplikátor na celý recept") → držím se algoritmu; komponentové ladění (vč. konceptu per-kategorie multiplikátorů ze staré verze) až V1.x.

## Poznatky ze staré verze (Drive: MealApp2.1) – inspirace, ne kopie

**Přebírám (po svém):**
- **Kalendář v plánovači**: týdenní pás dní od pondělí + měsíční titulek + zvýraznění dneška, navigace po dnech.
- **Manuální korekce TDCI**: vypočtené TDCI + uživatelský ±kcal offset (zobrazovat base i upravené) – `tdci.manualAdjustment` ze staré verze.
- **Avoid list per profil** (`avoidMeals`): vyloučené potraviny/recepty nad rámec alergií (prosté „nechutná mi") – tvrdý filtr generátoru.
- **Per-profil počet svačin a jejich pozice** (`mealsPerDay`, `snackPositions`): hlavní sloty jsou household-level, počet/pozice svačin per profil (Snack 1 dopoledne, Snack 2 odpoledne…).
- **Silueta / vizuální výběr % tuku** (BodyFatCarousel) – pro odhad aktuálního i cílového složení (CLAUDE.md ji beztak chce).
- **Denní „fit" indikátor**: jednoduchý souhrn, jak vygenerovaný den sedí na cíl (Δ kcal + makra) – zjednodušená verze starých QualityMetrics.
- **Generování po dnech**: kromě „vygenerovat týden" i „vygenerovat/přegenerovat den" (staré UI generovalo po dnech; týdenní generátor z CLAUDE.md zůstává primární).
- USDA FoodData Central jako zdroj nutričních dat (stará appka ho tahala live přes API – my kurátorovaně do seed dat, offline).

**Vědomě nepřebírám:** hybridní generátor (multi-dimensional knapsack, režimy speed/quality, learning/feedback moduly – vesměs prázdné stuby), live USDA/Edamam fetching za běhu, per-profil globální max. opakování (nahrazeno household default + per-recept override dle CLAUDE.md). Feedback/hodnocení jídel = nápad do V2.

## Rozhodnutí k týdennímu generování (a/c/d)

- **(a) Další týden se negeneruje automaticky.** Nedělní večer přijde notifikace/banner „naplánuj příští týden" (navazuje na nákup); prázdný budoucí den/týden zobrazuje CTA „Vygenerovat". Žádné tiché generování – nákup a spíž mají zůstat pod kontrolou uživatele.
- **(c) Historie:** stav snědeno/nesnědeno lze doplnit i zpětně (zapomenuté odškrtnutí je běžné). Struktura minulých dnů (recepty, porce) je ale read-only – minulost se nepřegenerovává ani needituje.
- **(d) Přegenerování „zbytku týdne"** se dotkne jen dneška a budoucích dnů, a v rámci dneška jen slotů, kde žádná porce není označena jako snědená. Jídlo se snědenou porcí je zamčené.

## 1) Tech stack a state management

| Vrstva | Volba | Proč |
|---|---|---|
| Framework | **Expo (React Native) + TypeScript** (strict), dev build | Android cíl, jedna codebase |
| Navigace | **expo-router** (tabs + stacky) | Standard |
| Databáze | **expo-sqlite + Drizzle ORM** (typované schéma, migrace) | Relační model = přímá mapa na Supabase Postgres ve fázi 2 |
| Reaktivita | **Drizzle `useLiveQuery`** – UI se překresluje při změně DB | Architektonicky řeší starý TDCI/graf bug |
| UI state | **Zustand** (aktivní profil, ephemeral UI) | Malý, bez boilerplate |
| Doména | **Čisté TS funkce v `src/domain/`** (výpočty, generátor) – bez Reactu | 100% unit-testovatelné bez emulátoru |
| i18n | **i18next + react-i18next + expo-localization**, výchozí CZ | Od začátku |
| Notifikace | **expo-notifications** (lokální) | Jídla, nákup, pondělní vážení, nedělní plánování |
| Foto | **expo-image-picker/camera + expo-file-system** | Vizuální záznam, AI metadata sloupec připraven |
| Grafy | **victory-native XL** (Skia) | Progress graf |
| Styling | StyleSheet + **theme tokens** (přesná paleta z briefu, radius 20–24, `expo-linear-gradient`), žádná UI knihovna | Závazná vizuální identita |
| Testy | **Jest (jest-expo) + @testing-library/react-native**, doména TDD | Vzorce mají známé hodnoty |

Zvažované alternativy perzistence: WatermelonDB (sync primitivy, ale těžká abstrakce – overkill pro single-device V1), Redux+AsyncStorage (neškáluje na DB potravin). SQLite+Drizzle vítězí.

Sync-ready principy: UUID všude, `created_at`/`updated_at`/`deleted_at` (soft delete), žádné autoincrementy, schéma přenositelné do Postgres.

## 2) Datový model (SQLite / Drizzle)

Všechny tabulky mají `id` (UUID), `created_at`, `updated_at`, `deleted_at?`.

**Domácnost a profily**
- **households** – name, breakfast_mode ('shared'|'individual').
- **household_settings** – unit_system (metric/US), language (cs/en), **default_max_repetitions_per_week** (libovolné číslo, edituje uživatel), **default_allow_consecutive_days** (bool, batch vaření), notifikační přepínače + časy, fiber mód.
- **meal_slot_settings** – slot_key, label, čas (HH:MM, pro remindery), kind ('main'|'snack'), sharing ('shared'|'individual' – snídaně konfigurovatelná), % podíl denních kalorií (výchozí 25/30/25/10/10, editovatelný = „portion sizes editor"), pořadí, enabled. Hlavní sloty household-level; **počet a pozice svačin per profil** (profil → snack_positions).
- **profiles** – jméno, barva/avatar, **profile_type ('adult'|'child')**, pohlaví, datum narození, výška, activity_level (5 stupňů), goal (lose/maintain/gain), goal_weight_kg, goal_body_fat_pct, fitness_experience, `shares_main_meals` (nezávislý režim), workout_days (týdenní vzor), snack_positions, **tdci_manual_adjustment_kcal**, overrides makro poměrů/proteinu. Aktuální váha/tuk se NEdrží na profilu – vždy poslední záznam z body_metrics.
- **profile_restrictions** – profil ↔ alergie/dietní omezení (lepek, laktóza, ořechy, vegetarián…).
- **profile_avoided_items** – profil ↔ vyloučené potraviny/recepty („nechutná") – tvrdý filtr.
- **profile_favorites** – oblíbené recepty per profil (bonus ve skórování, nepřebíjí limity opakování).
- **body_metrics** – profil, datum, weight_kg, body_fat_pct?, metoda ('navy'|'manual'|'bia'|'dexa'), navy míry (krk/pas/boky)?, poznámka. Progress graf i TDCI čtou odtud.

**Potraviny a recepty**
- **foods** – name_cs/name_en, kategorie, base_unit (g/ml/ks), grams_per_piece?, nutrice na 100 g (kcal, bílkoviny, sacharidy, tuky, vláknina), mikroživiny nullable (železo, D, B12, vápník, omega-3; NULL = neznámé, nikdy 0), budget, shelf_life_days, storage (spíž/lednice/mrazák), snack_suitable, barcode? (připraveno na V1.x), **source s auditním odkazem** (např. `usda:fdc/171287`, `nutridatabaze:<id>`, `user`).
- **food_restrictions** – alergeny potraviny.
- **recipes** – name_cs/name_en, postup, kategorie ('breakfast'|'lunch_dinner'|'snack') + flag `is_side` (příloha), budget, servings_base, čas přípravy, tagy, **max_repetitions_per_week (int, nullable)** a **allow_consecutive_days (bool, nullable)** – per-recept overrides; NULL = zdědí household default. Efektivní hodnota v generátoru = `recept.override ?? household.default`.
- **recipe_ingredients** – recept ↔ potravina, množství na 1 referenční porci. Nutrice/alergeny receptu se **derivují z ingrediencí** (nikde se neukládají – změna suroviny se propíše okamžitě).

**Plán, nákup, spíž**
- **planned_meals** – household_id, datum, slot_key, `profile_id?` (NULL = sdílené; vyplněné = individuální stopa), item_type ('recipe'|'food'), item_id.
- **planned_meal_portions** – planned_meal ↔ profil, **multiplier** (jeden násobek celého receptu), status ('planned'|'eaten'|'skipped'). Per-osoba porce i nesnědené jídlo; snědená porce zamyká jídlo proti přegenerování.
- **pantry_items** – potravina, množství, datum nákupu, expirace (odhad z shelf_life_days, ručně přepsatelná).
- **shopping_list_items** – potravina (nebo volný název), množství, horizont ('weekly' čerstvé / 'monthly' trvanlivé), checked, auto_generated, note. Odškrtnuté lze jedním tahem přesunout do spíže.
- **photos** – owner_type ('recipe'|'food'), owner_id, uri, taken_at, `ai_metadata` JSON (NULL, budoucí AI).

## 3) Doménová logika (`src/domain/`, čisté funkce, TDD)

Dle vzorců v CLAUDE.md, jako pevné konstanty/funkce s testy:
- **Dospělí:** BMR Mifflin-St Jeor → TDEE (×1.2/1.375/1.55/1.725/1.9) → TDCI dle cíle. Lose: deficit 0.5–1 % hmotnosti/týden, navyšování po 100–250 kcal, bere se ze sacharidů/tuků, **nikdy z bílkovin**, tuk ≥ 20 % kalorií. Gain: +250 kcal default (brief nespecifikuje; editovatelné). **Rekompozice**: gain + cílový tuk < aktuální → maintenance. K výsledku se přičítá `tdci_manual_adjustment_kcal` (zobrazuje se base i upravené).
- **Děti:** rovnice **EER (Institute of Medicine)** dle věku/pohlaví/aktivity místo Mifflin-St Jeor; zamčené hubnoucí cíle a % tuku (Navy pro děti není validní); dostávají škálované porce ze sdíleného plánu.
- **Dietní cyklus:** po ~5 % úbytku tuku (M) / 7 % (Ž) doporučující banner „přejdi na maintenance".
- **Protein z LBM** (fallback celková váha): default 1.8 g/kg LBM normál / 2.4 g/kg v deficitu (středy ISSN rozsahů, editovatelné). **Vláknina** 25 g min, volitelně gender-specific. **Navy tape** kalkulačka + ruční přepis. **Validace**: cílový tuk < aktuální ⇒ cílová váha ≤ aktuální. **Převody** metric ↔ US.
- **Reaktivita:** odvozené hodnoty (TDCI, makra receptu, zbytek dne, graf) se NIKDY neukládají – vždy se počítají z aktuálních dat (live query + čisté funkce). Neexistuje „staré" TDCI.

## 4) Generátor jídelníčku (`src/domain/generator/`, TDD, injektovaný RNG seed)

Přesně dle algoritmu v CLAUDE.md: filtr kandidátů (alergie + **avoid listy** + diety všech sdílejících profilů) → skórování (penalizace opakování **relativně k efektivnímu limitu receptu**, favorite bonus, budget + nutriční kvalita, bonus za expirující suroviny ve spíši) → **vážený náhodný výběr z top kandidátů** → per-profil jeden multiplikátor (cíl slotu / nutrice receptu) → svačiny per profil dorovnají zbytek denního cíle (kalorie i makra, nejbližší shoda, respektují snack_positions) → swap přegeneruje jen slot s vyloučením vyměněného receptu.

- Tvrdý filtr opakování: kandidát vypadne, pokud by překročil efektivní týdenní limit nebo pravidlo po sobě jdoucích dnů (`recept.override ?? household.default`). Oblíbené limity nepřebíjejí.
- Nezávislé profily a individuální sloty = oddělený běh stejné logiky.
- Týden začíná pondělím; generování týdne / dne / slotu (viz rozhodnutí a/c/d výše).
- Denní „fit" indikátor: Δ kcal/makra vůči cíli per profil.
- Mikroživinový tie-breaker ve skórování: **V1.1** (V1 mikroživiny ukládá a zobrazuje, tiše přeskakuje NULL). Automatické dorovnání nesnědeného jídla ve zbytku dne: **V1.1** (V1 jen zaznamenává).

## 5) Obrazovky a navigace (expo-router)

**Onboarding stack** (unDraw ilustrace přebarvené na `#2E4A32`/`#4E7A4A`): vítejte → domácnost → wizard profilu (typ dospělý/dítě, údaje, aktivita, cíl, % tuku via silueta/Navy, alergie + avoid + dieta, sdílení jídel, svačiny) → **TDCI výsledek** (hero gradient, živě) → další člen? → nabídka středomořské šablony týdne.

**Bottom tab bar (5):**
1. **Dnes** – hero gradient s kalorickým ringem aktivního profilu, přepínač profilů, dnešní jídla jako foto-karty s expand/collapse (Reanimated, otestovat – starý bug), snědeno/nesnědeno, swap, denní fit indikátor.
2. **Plán** – **kalendářový týdenní pás od pondělí** (měsíční titulek, zvýrazněný dnešek), den po slotech, „Vygenerovat týden/den", „+ Add Meal", porce členů, zamčená minulost (jen status snědeno zpětně).
3. **Knihovna** – segment Recepty/Potraviny, hledání + filtry (kategorie, budget, tagy, sides), detail jako vybíratelný seznam, CRUD, focení, oblíbené (per profil), per-recept nastavení opakování.
4. **Nákup** – segment Seznam (čerstvé týdně / zásoby měsíčně, odškrtávání offline) / Spíž (expirace).
5. **Pokrok** – progress graf (váha + % tuku z body_metrics), záznam měření + Navy, cíle + validace + silueta, TDCI přehled (base + manuální korekce), správa členů, vstup do Nastavení.

**Nastavení**: jednotky, jazyk, opakování (default + vysvětlení per-recept overridů), editor slotů/porcí (%), makro poměry, svačiny per profil, notifikace, household souhrn.

**UX závazky:** delete po podržení edit tlačítka ~0.5 s + potvrzení; mazání jen jedné instance; ilustrace vs. fotky se nemíchají; radius 20–24; přesné hex tokeny.

## 6) Rozsah V1 vs. odloženo

**V1:** vše výše – onboarding, profily (dospělí + děti, nezávislý režim), reaktivní TDCI + manuální korekce, všechna nutriční pravidla jako doména, Navy + silueta, progress graf + pondělní připomínka, knihovna se seed DB + focení + jednotky, týdenní/denní generátor s kalendářem (pondělí), avoid listy, per-recept opakování, nákup + spíž, notifikace (jídla, nákup, vážení, nedělní plánování), i18n CZ/EN, kompletní vizuální identita, záznam nesnědeného jídla.

**Odloženo:** V1.1 – barcode skener + OFF, mikroživinový tie-breaker, auto-dorovnání nesnědeného dne, komponentové/per-kategorie škálování porcí. Fáze 2 – Supabase sync, účty, multi-device, komunitní sdílení, AI foto rozpoznávání, web, hodnocení jídel + učení preferencí (nápad ze staré verze).

**Seed data:** potraviny z **USDA FoodData Central** (Foundation/SR Legacy, CC0) + **Nutridatabáze.cz** pro česká specifika (tvaroh, kefír, pečivo…); každý záznam s auditním `source` odkazem; mikroživiny bez dat = NULL. Recepty ~30–40 (snídaně, obědy/večeře, přílohy, svačiny; středomořský základ + česká kuchyně), bilingvně. Nutrice receptů se derivují z ingrediencí – ověřují se jen potraviny. Fotky seed receptů: jednorázově staženy z Pexels při vývoji a přibaleny do assets (žádné runtime API).

**Zvolené defaults (editovatelné):** surplus +250 kcal; protein 1.8/2.4 g/kg LBM; sloty 25/30/25/10/10 %.

## 7) Fáze implementace (commit po každé otestované fázi)

0. **Repo**: `git branch -m master main`, `.gitignore`, první commit (CLAUDE.md + plán jako `docs/plan-v1.md`).
1. **Scaffold**: Expo TS + router + theme tokens + i18n kostra + Jest; běží na emulátoru.
2. **Datová vrstva**: Drizzle schéma + migrace + repozitáře + seed pipeline + testy.
3. **Doménové výpočty** (TDD): BMR/TDEE/TDCI (+ EER děti), makra, deficit pravidla, Navy, validace, konverze.
4. **Onboarding + profily + TDCI UI** (živý přepočet, přepínač profilů).
5. **Knihovna** (recepty/potraviny UI, focení) + seed obsah.
6. **Generátor** (TDD, seed RNG) + Plán/Dnes (kalendář, sloty, expand, swap, snědeno, porce, fit indikátor).
7. **Nákup + spíž**.
8. **Pokrok + notifikace**.
9. **Nastavení + polish**: jednotky, jazyk, editor porcí, unDraw empty states, středomořská šablona, seed fotky, průchod celé appky, APK build.

Pozn.: plán vznikl na Fable 5; implementaci lze dle briefu pouštět na Sonnet 5 (přepnutí modelu je na uživateli).

## 8) Verifikace

- **Doména**: unit testy s ručně spočtenými hodnotami (muž 80 kg/180 cm/30 let, 1.55 ⇒ BMR 1780, TDEE 2759; dítě přes EER), generátor s pevným seedem ⇒ deterministické testy (alergie + avoid respektovány, efektivní limity opakování, fat-floor 20 %, protein se nekrátí, zamčené snědené sloty).
- **Reaktivita**: změna váhy/aktivity/manuální korekce se okamžitě propíše do TDCI všude bez restartu.
- **E2E smoke po fázi**: `npx expo run:android` – onboarding → generace týdne → swap → nákupní seznam → odškrtnutí → spíž → zpětné odškrtnutí snědeno.
- **Regresní checklist starých bugů**: TDCI reaktivita, editovatelné porce, funkční progress graf, funkční expand/collapse.

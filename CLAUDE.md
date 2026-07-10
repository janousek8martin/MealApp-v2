# MealApp – Project Brief (kompletní restart)

## Status
Toto je **nový začátek** aplikace. Předchozí pokusy (viz starší kód i poznámky níže) slouží jen jako zdroj nápadů a požadavků na funkce – kód, architektura ani konkrétní bugy se nepřebírají.

## Vize produktu
Aplikace se má chovat, jako by ji navrhoval **světový expert na výživu** – cílem je dát domácnostem jednoduchý nástroj, jak:
1. zjistit svou kalorickou potřebu (TDCI – Total Daily Caloric Intake),
2. zvolit si cíl (hubnutí, udržení, nabírání svalové hmoty, případně rekompozice),
3. na základě preferencí a omezení vygenerovat jídelníček,
4. z jídelníčku odvodit nákupní seznam a spravovat spíž (pantry),
5. sledovat pokrok (váha, tělesné složení) v čase,
6. a appka má uživatele doprovázet – notifikace, připomínky, jednoduchý průvodce, ne jen tabulky.

## Fáze a cílová skupina
- **Fáze 1 (teď):** appka pro vlastní rodinu/nejbližší, lokální profily bez hesla, lokální databáze.
- **Fáze 2 (budoucnost, pokud to bude fungovat dobře):** otevření jako open-source / veřejná appka s komunitní databází receptů a surovin ke stažení mezi uživateli.
- Architektura a datový model se od začátku navrhují tak, aby přechod z fáze 1 do fáze 2 nevyžadoval přepsání appky od nuly (offline-first, ale s daty připravenými na budoucí sync).

## Platforma
- **Mobile-first** (iOS + Android, React Native/Expo nebo ekvivalent dle doporučení Claude Code).
- Webová verze má nižší prioritu – nestavět hned, ale nedělat rozhodnutí, která by webu do budoucna bránila.
- **Appka musí fungovat plně offline** (lokální data, typicky použití v obchodě bez signálu) – synchronizace na cloud (fáze 2) proběhne až při připojení, offline-first je architektonický požadavek od začátku, ne dodatek.

## Vizuální identita (závazné pro V1)
Inspirace: moderní mobilní UI s velkými zaoblenými kartami (radius ~20–24px), kombinace barevných plných bloků a reálných fotografií v kartách (ne jen ikony), hero sekce nahoře s velkým číslem/statistikou, spodní tab bar s ikonami.

**Barevná paleta** (identita "green tea", klidná/uklidňující, s ombre přechody):
- Pozadí appky: krémová `#F4F1E8`
- Hero panel (kalorický přehled, hlavní karty): ombre gradient ze světlejší zelené `#4E7A4A` do tmavé hluboké zelené `#1E3320`
- Primární akcent / tlačítka / progress ring: tmavá zelená `#2E4A32` až `#3E6B3E`
- Sekundární akcent (úspěch, splněná jídla): středně zelená `#639922` nebo `#3E6B3E`
- Doplňkové bloky (kategorie jídel, tagy): teplá písková `#E3D9A8`, olivově zelená `#B7D19C`, zemitá hnědá `#CBB79A`
- Text: tmavě zelenohnědá `#243620` místo čisté černé; sekundární text šedozelená `#6E7A5E`
- Jemné neutrální rámečky/oddělovače: `#DDE3D0`

**Fotografie jídel:**
- Reálné fotky v kulatých/zaoblených kartách, žádné ostré rohy.
- Teplé přirozené osvětlení, žádný přeslazený food-porn styl – má to působit jako od výživového experta, ne jako Instagram reel.
- Pro stock fotky receptů použít **Pexels API**.
- Fotky uživatelských jídel/surovin (vlastní focení, viz níže) se ukládají a zobrazují stejným vizuálním stylem (zaoblené karty).

**Ilustrace (ne fotky):**
- Pro onboarding, prázdné stavy (empty states) a motivační vizuály použít **unDraw** (https://undraw.co) – volně použitelné SVG ilustrace, plochý styl, MIT licence, bez nutnosti attribution.
- Stahovat přes veřejné SVG endpointy nebo GitHub repozitář (github.com/unDraw/), přebarvit accent barvu v SVG na paletu appky (`#2E4A32` / `#4E7A4A`), ukládat do `assets/illustrations/`.
- Použít pro: onboarding flow, prázdný nákupní seznam, prázdný meal plan, úvodní obrazovku po instalaci.
- **Ilustrace a fotky se v appce nemíchají ve stejné komponentě** – ilustrace patří na celoplošné/onboarding obrazovky, fotky na karty jídel a receptů.

## Jazyk
UI v **češtině a angličtině** s přepínáním jazyka (i18n od začátku, ne dodatečná lokalizace).

## Backend / infrastruktura (doporučení)
Appka je offline-first, ale kvůli budoucímu sdílení receptů/surovin mezi uživateli (fáze 2) bude potřeba backend. Doporučeno: **Supabase** (Postgres + Auth + Storage) – je open-source, má štědrý free tier (nic neplatíš ve fázi 1), a lze ho později self-hostovat, což sedí k plánu otevřít appku jako open-source. Ve fázi 1 stačí lokální úložiště (SQLite/AsyncStorage dle doporučení Claude Code) navržené tak, aby šlo později napojit na Supabase bez přepisu datového modelu.

## Datový model / uživatelé
- **Domácnost** má víc profilů (členů rodiny), každý s vlastními preferencemi, cílem, tělesnými údaji a velikostí porcí.
- Profil obsahuje: cíl (hubnutí/udržení/nabírání), aktuální váhu a tělesné složení, cílovou váhu a cílové složení, fitness experience level, metabolický věk, workout dny (jednoduchý flag "tréninkový den" / "volno" – bez detailního trackingu tréninku, bez integrace na hodinky/Health apps ve V1), alergie/potravinové preference.
- **Profily ve V1:** jednoduché lokální profily bez hesla (víc lidí na jedné appce/telefonu) – účty a cloud login až ve fázi 2.

## Funkční oblasti

### 1. Onboarding & výpočet kalorických potřeb (TDCI)
- Výpočet Total Daily Caloric Intake na základě údajů profilu.
- **TDCI se musí přepočítávat automaticky při jakékoli změně vstupů** – nesmí být potřeba zavřít a znovu otevřít appku. (Opakovaný bug ve staré verzi – řešit reaktivním state managementem od začátku.)
- Makronutrient ratios navázané na TDCI, editovatelné.

### 2. Cíl a tělesné složení
- Goal Weight, Goal Body Composition (% tělesného tuku), ideálně s vizuální reprezentací (siluetou postavy).
- Validace: pokud je cílové složení tuku nižší než aktuální, cílová váha nemůže být vyšší než aktuální.
- Pokud je cíl "nabrat svaly" a zároveň cílové % tuku je nižší než aktuální → kalorie na úrovni **maintenance** (rekompozice), ne deficit.
- Dietní cyklus: cca 1–2 měsíce deficit, pak maintenance; konkrétně po cca **5 % úbytku tuku u mužů / 7 % u žen** doporučit přechod na maintenance.
- Deficit navyšovat odebíráním 100–250 kcal, primárně ze **sacharidů a/nebo tuků, nikdy z bílkovin**; tuk by neměl klesnout pod 20 % celkových kalorií. *(V1: samotný fixní deficit + 20% fat floor je implementován jako doménová logika (`computeTargets`/`allocateMacros`); postupné navyšování deficitu v čase je odloženo na pozdější fázi – appka zatím nemá plateau/čas-based trigger, který by o navýšení rozhodoval, takže by šlo o mrtvou/atrapovou logiku. Fat floor porušení je alespoň detekováno a flagováno, viz `TargetsResult.fatFloorViolated`.)*
- Notifikace: připomínka aktualizovat váhu každé pondělí ráno.
- Progress graf: sleduje váhu/složení denně, vykresluje se kontinuálně, hodnoty se importují automaticky ze záznamů, ne zadávají zvlášť.

### 3. Plánování jídel (meal plan)
- **Generování jídelníčku je plně automatické na celý týden** – appka navrhne celý týden dopředu, uživatel upravuje jen výjimky.
- **Domácnost sdílí jeden meal plan, jednu spíž a jeden nákupní seznam** (úspora času i peněz):
  - Hlavní jídla (obědy/večeře) jsou pro všechny profily **stejná co do receptu**, liší se jen **množstvím porce** podle kalorických potřeb daného člověka.
  - Kromě škálování celé porce appka umí i mírně upravit **poměr komponent v rámci jídla** (např. víc masa/méně přílohy), aby šlo lépe trefit makra, ne jen násobit stejný poměr.
  - **Svačiny jsou primární místo pro doladění individuálních nutričních rozdílů** (např. ořechy pro víc tuku, proteinový shake pro víc bílkovin) – tam se řeší nuance mezi členy domácnosti.
  - **Výjimka:** profil může mít nastavený **nezávislý stravovací režim** (např. vegetariánství) – takový profil dostává vlastní, samostatně generovaný jídelníček mimo sdílený plán; zbytek domácnosti dál sdílí společný plán. Toto je potřeba v datovém modelu ošetřit jako flag na profilu ("sdílené hlavní jídlo: ano/ne").
  - Generování respektuje omezenou opakovatelnost jídel (restricted repetition), aby appka nenabízela pořád dokola stejné recepty.
- **Vzorový generický jídelníček:** appka by měla nabízet ukázkový týdenní jídelníček (např. na onboarding obrazovce nebo jako výchozí šablonu), inspirovaný principy středomořské diety (zelenina, celozrnné produkty, zdravé tuky – olivový olej, ořechy, ryby, méně červeného masa) – ne jako striktní dietní systém, ale jako evidence-based výchozí rámec, který appka může kombinovat i s jinými přístupy.
- Meal kontejner: kliknutí na "expand" tlačítko musí kontejner skutečně rozbalit (starý bug – buď opravit rozbalování, nebo použít užší dropdown panel). "+ Add [Meal]" tlačítko pro přidání jídla do slotu.
- Řešení nesnědeného jídla – appka by měla umět zaznamenat/zohlednit, když jídlo nebylo snězeno.
- Delete chování: smazání instance receptu/jídla smaže jen tuto jednu instanci. Potvrzovací dialog při mazání. Delete tlačítko se může objevit až po podržení edit tlačítka (~0.5 s).

### 4. Recepty a databáze potravin
- Recipe management a Food management jako oddělené, ale provázané databáze.
- Recipe/Food details – zobrazit jako jednoduchý vybíratelný seznam.
- Kategorie: recepty lze zařadit i jako "sides" (přílohy).
- **Budget kategorie** u receptů/potravin: cheap / average / expensive.
- Jednotky se musí přepočítat při změně jednotkového systému v app settings (US ↔ metric), appka má mít k dispozici standardní převodní tabulku objemů.
- Naplnit databázi reálnými nutričními daty (kalorie, makra, vláknina) z důvěryhodných zdrojů.
- **Barcode/QR skener:** napojit na **Open Food Facts** (zdarma, open-source databáze potravin s barkódy, dobrá volba i s ohledem na budoucí open-source plán appky). Doplnit fallback na ruční zadání, když produkt v databázi chybí.
- **Focení jídel/surovin:** ve V1 jde o **vizuální záznam** (fotka se přiřadí k receptu/potravině, aby bylo v databázi vidět, co to je a jak to vypadá). **AI rozpoznávání obsahu fotky (automatický odhad jídla/kalorií) je plánováno až jako pozdější fáze**, ne součást V1 – datový model by ale měl počítat s tím, že se k fotce bude moct v budoucnu přidat AI-derived metadata.

### 5. Nákupní seznam a spíž (pantry)
- Shopping list se automaticky vypočítá z naplánovaných jídel celé domácnosti (sdílený).
- Položky s dlouhou trvanlivostí se navrhují na celý měsíc dopředu (batch nákup), čerstvé suroviny na kratší horizont.
- Pantry sleduje, co domácnost doma má, a bere v úvahu degradaci/expiraci potravin při plánování dopředu.

### 6. Sdílení receptů/surovin (budoucí komunitní databáze)
- Dlouhodobý cíl: uživatelé budou moct nahrávat vlastní recepty/suroviny a jiní uživatelé si je stáhnou do appky.
- Ve fázi 1 (rodina) toto řešit přes Supabase backend v jednoduché podobě (sdílená tabulka receptů/potravin dostupná přihlášeným členům domácnosti); plná komunitní distribuce (moderace, veřejné sdílení mezi cizími uživateli) je záležitost fáze 2 při přechodu na open-source verzi.

### 7. Notifikace
- Meal reminders s nastavitelným časem jídel.
- Shopping list reminders.
- Notifikace o aktualizaci váhy (pondělí ráno).
- Notifikace respektují systémová oprávnění a jsou volitelné v nastavení.

### 8. Mikroživiny
- Ve V1 jsou **makronutrienty prioritou, mikroživiny sekundárním, měkkým cílem** – appka se je snaží zohledňovat, ale nesmí kvůli nim blokovat generování jídelníčku, "hlásit chyby" ani zbytečně omezovat výběr jídel jen na tu úzkou množinu potravin, která má kompletně vyplněná mikroživinová data.
- Appka primárně hlídá běžně nedostatkové látky: **železo, vitamín D, B12, vápník, vláknina, omega-3** (výchozí sada, ne uzavřený seznam).
- Chybějící data u potraviny/receptu appka tiše přeskočí při výpočtu mikroživin (nezobrazuje chybu, nepovažuje to za "0"), aby to nezkreslovalo přehled ani negenerovalo falešné nedostatky.
- Při **dlouhodobé** (ne jednorázové) absenci konkrétní mikroživiny appka může doporučit zvážit doplněk stravy (obecné doporučení, ne lékařská rada) – ne generovat poplašné hlášky za jeden den.
- Mikronutrienty by se do meal generation logiky měly zapojit až jako druhotné vylepšení (např. mírně preferovat jídla bohatší na chybějící mikroživinu při rovnosti jiných kritérií), ne jako tvrdé omezení výběru.

### 9. Nastavení (Settings)
- Jednotkový systém (metric/US), max. meal repetition, portion sizes editor, macro ratios, notifikace, jazyk (CZ/EN), uživatelský manuál/meal rules.
- Household souhrn nastavení přehledně na jednom místě.

## UX principy
- Appka má být *doprovázející*, ne jen datový nástroj – jednoduchý jazyk, přívětivý vizuál.
- Podržení tlačítka pro odhalení destruktivní akce (delete), potvrzovací dialogy u mazání.
- Realtime reaktivita je zásadní princip (TDCI, grafy, přepočty) – žádná hodnota nesmí vyžadovat manuální refresh.

## Známé chyby z minula (nedělat znovu)
- TDCI needitovalo reaktivně – muselo se zavřít/znovu otevřít appku.
- Portion sizes tab měl needitovatelné hodnoty.
- Progression graf nefungoval / nenačítal se z dat o váze a složení.
- Expand/collapse u meal kontejnerů nefungoval.
- Appka byla opakovaně rozestavěná bez jasné architektury – v novém projektu nejdřív promyslet stav, datový model a persistenci, pak psát UI.

## Vědecký základ nutričních výpočtů (V1 specifikace)

Toto jsou konkrétní vzorce a hodnoty, podložené klinickými studiemi a pozicemi odborných společností (ne obecně tradovaná čísla). Claude Code by je měl implementovat jako přesně dané konstanty/vzorce, ne je znovu odhadovat.

**BMR/TDEE:**
- Výpočet BMR rovnicí **Mifflin-St Jeor** (nejlépe validovaná rovnice v klinických studiích, přesnost ±10 % oproti nepřímé kalorimetrii, spolehlivější než starší Harris-Benedict).
  - Muži: `BMR = 10×hmotnost(kg) + 6.25×výška(cm) − 5×věk(roky) + 5`
  - Ženy: `BMR = 10×hmotnost(kg) + 6.25×výška(cm) − 5×věk(roky) − 161`
- TDEE = BMR × aktivitní koeficient. Aktivitní úroveň se určuje **subjektivní otázkou při onboardingu** (standardní škála, viz níže) – jednoduché a dostatečné, appka to nemusí odvozovat automaticky z tréninkových dnů.
- *(V1 revize po rešerši (a), 2026: původní kombinovaná škála 1.2–1.9 sloučila běžný pohyb s tréninkem do jednoho čísla. Appka místo toho odděluje: otázka "jaký je tvůj životní styl" se ptá čistě na NEAT (pohyb mimo trénink), trénink se dopočítává zvlášť přes tréninkové dny (`WORKOUT_DAY_KCAL_BONUS_PCT` = 12 % kcal bonus na tréninkový den). Koeficienty (FAO/WHO/UNU PAL pásma, zpřesněno DLW literaturou):)*
  - Většinou sedím: 1.45
  - Občas na nohou: 1.55
  - Většinou na nohou: 1.70
  - Pohyb celý den: 1.82
  - Fyzicky náročná práce: 2.05

**Bílkovinový cíl:**
- Počítá se z **odhadované čisté (netukové) tělesné hmoty**, ne z celkové váhy: `LBM = hmotnost × (1 − % tělesného tuku)`. Přesnější hlavně pro profily s vyšším % tuku. Pokud appka % tuku profilu ještě nezná, dočasně použít celkovou váhu jako fallback.
- Rozsah dle fáze (ISSN pozice, sport nutrition): **1.4–2.0 g/kg LBM/den** pro budování/udržení svalové hmoty za normálních podmínek; **2.3–3.1 g/kg LBM/den** v období kalorického deficitu (pro maximální zachování svalové hmoty při hubnutí).

**Vláknina:**
- Výchozí cíl: **25 g/den minimum** (EFSA doporučení), s možností jemnějšího gender-specifického cíle (~30–35 g muži, ~25–32 g ženy dle některých evropských směrnic) jako přesnější volitelný default.

**Rychlost hubnutí / velikost deficitu:**
- Bezpečné rozmezí: **0.5–1 % tělesné hmotnosti za týden** (odpovídá typicky 500–1000 kcal/den deficitu, škáluje se ale lépe podle velikosti člověka než pevná hodnota). Toto je primární limit, v jehož rámci appka postupně navyšuje deficit po 100–250 kcal (viz sekce Cíl a tělesné složení – v V1 odloženo, chybí trigger na *kdy* navýšit).

**Měření % tělesného tuku:**
- Doporučená vestavěná metoda: **Navy tape method** (obvod pasu, krku, u žen navíc boků + výška) – chybovost cca ±3–4 %, výrazně přesnější a konzistentnější než běžné domácí BIA váhy (chybovost až ±8 %). Appka nabídne kalkulačku na základě těchto obvodových měření jako výchozí metodu, s možností ručního přepsání hodnotou z přesnějšího zdroje (DEXA, kalipery), pokud ji uživatel má.

## Algoritmus tvorby jídelníčku (V1 specifikace)

Toto je záměrně navržené tady (doménová/produktová logika), ne ponechané na Claude Code – Claude Code dostane hotovou specifikaci a soustředí se na kvalitní implementaci, ne na vymýšlení pravidel.

**Vstupy pro generování:**
- Denní kalorický a makro cíl profilu (z TDCI/macro ratios nastavení, viz sekce 1).
- Databáze receptů s tagy: kategorie/typ jídla, sides, budget (cheap/average/expensive), alergeny, per-porce nutriční hodnoty (kalorie + makra, mikroživiny pokud dostupné).
- Historie posledních N dní naplánovaných jídel (pro repetition constraint).
- Nastavení opakování (viz níže) a favorite recipes.
- Pantry (expirace surovin) a preference/alergie všech sdílejících profilů.

**Postup (týdenní generování, po dnech a slotech):**

1. **Kandidáti na hlavní jídlo** (den × slot) se filtrují na recepty vyhovující alergiím/preferencím *všech* profilů na sdílené stopě (profily s nezávislou dietou mají vlastní, odděleně generovaný běh se stejnou logikou).
2. **Skórování kandidátů**: kombinace (a) penalizace za opakování relativně k nastavenému limitu, (b) bonus pro favorite recipes, (c) preference zdravější/levnější varianty (budget + nutriční kvalita), (d) bonus za suroviny blížící se expiraci ve spíži, (e) mikroživinový tie-breaker (viz sekce Mikroživiny).
3. **Výběr**: **vážený náhodný výběr mezi top kandidáty** (ne vždy striktně nejlepší skóre) – zajišťuje pestrost při zachování preference kvalitnějších/levnějších jídel, aby appka nepůsobila monotónně, ale zůstala v zásadě zdravá a úsporná.
4. **Nastavení opakování** (uživatelsky konfigurovatelné):
   - Globální/per-recept **max. počet opakování receptu za týden**.
   - Přepínač, jestli se **stejné jídlo smí objevit v po sobě jdoucích dnech** (užitečné pro dávkové vaření – např. řízek v pondělí i úterý, uvařeno najednou).
   - **Favorite recipes** – recepty s prioritní vahou ve skórování, ale pořád podléhající max. opakování limitu (nepřebíjí ho).
5. **Škálování porce per profil**: **jeden multiplikátor na celý recept** (ne úprava jednotlivých komponent) – appka spočítá poměr mezi profilovým kalorickým/makro cílem pro daný slot a tabulkovou nutriční hodnotou receptu, a tímto poměrem vynásobí celé množství. Poměr maker uvnitř receptu tím pádem zůstává zachovaný, jak recept je.
6. **Svačina per profil**: vypočítá se zbytek do denního cíle (kalorie i makra) po hlavních jídlech a vybere se ze svačinové databáze nejbližší shoda – tady se řeší individuální nutriční nuance mezi členy domácnosti (viz sekce 3).
7. **Uživatelská výměna** jednoho jídla přegeneruje jen ten slot stejnou logikou, s vyloučením právě vyměněného receptu z kandidátů.

## Hlavní motiv projektu
Toto je **primárně osobní/rodinný nástroj** – cílem je appku reálně používat pro vlastní domácnost, ne v první řadě stavět produkt pro veřejnost nebo portfolio projekt. Otevření jako open-source (viz sekce Fáze a cílová skupina) je možná budoucnost, ne prvotní motivace. Tohle by mělo ovlivnit priority: raději méně funkcí, ale spolehlivě fungujících pro každodenní reálné použití, než co nejvíc funkcí navrch.

## Otevřené otázky pro plánovací fázi s Claude Code

- Přesný rozsah V1 (které funkce jít stavět nejdřív) – necháno na doporučení Claude Code během plánování.
- Název appky – zatím pracovní název, branding se doladí později.

## Poznámka k procesu plánování (mimo appku samotnou)
Plán je udělat plánovací fázi s Claude Code na silném modelu (např. Fable 5, pokud je aktuálně dostupný – přístup k němu byl v minulosti dočasně pozastaven kvůli exportnímu nařízení, ověřit aktuální stav) a exekuci/psaní kódu na Sonnet 5 (medium/high effort). Pokud Fable 5 nebude dostupný, alternativa je alias `opusplan` v Claude Code – v plan módu automaticky použije Opus pro architekturu/plánování a po schválení plánu přepne na Sonnet pro implementaci, což odpovídá stejné myšlence (silný model na plán, efektivnější na exekuci).

## Instrukce pro Claude Code
1. Nejdřív navrhni: (a) datový model (household/profily/recepty/potraviny/meal plan/shopping list/pantry/progress), (b) obrazovky a navigaci, (c) tech stack a state management (s důrazem na reaktivitu a offline-first fungování).
2. Nutriční pravidla popsaná výše zabuduj jako doménovou logiku/výpočty.
3. Navrhni rozumný rozsah V1 (MVP) vs. co odložit na později, a tento návrh projdi s uživatelem k odsouhlasení, než začneš implementovat.
4. Dodržuj barevnou paletu a pravidla pro fotky/ilustrace přesně tak, jak jsou uvedená výše (jsou to konkrétní hex kódy a konkrétní zdroje assetů, ne jen inspirace).

# CubeCobra Filter Syntax vs. Scryfall

How CubeCobra's card filter syntax compares with [Scryfall's](https://scryfall.com/docs/syntax), after
the work to align the two. The first part lists what was changed; the second lists what still differs
and why. The user-facing version of the remaining differences is at the end of
`packages/server/content/wiki/reference/filter-syntax.md`.

Code referenced below:

- Grammar: `packages/utils/nearley/` (`filterBase.ne`, `cardFilters.ne`, `values.ne`)
- Matching logic: `packages/utils/src/filtering/FuncOperations.ts`
- Parsing, ignored terms and search directives: `packages/utils/src/filtering/FilterCards.ts`
- Card fields, `is:` detectors and the card search pool: `packages/utils/src/cardutil.ts`
- Card search: `packages/server/src/serverutils/tools.ts`
- Static lists from Scryfall: `packages/utils/src/res/CardTypes.json`, `Keywords.json`,
  `LandCategories.json`

## How this was checked

- Our grammar was run over the local card snapshot (`packages/server/private/carddict.json`,
  Scryfall bulk data from 2026-05-20) and its matches compared with Scryfall's live API
  (`/cards/search`, default options), fetched on 2026-11-22. That covered about 185 queries: every
  example in Scryfall's syntax guide plus targeted probes. The appendix has every row.
- The comparison used `makeFilter`, so terms are ignored the way the site ignores them, and the same
  card pool card search now uses (`isHiddenFromCardSearch`), including its fallback to extras when
  nothing matches.
- Cards are compared by Oracle name (flavor-named printings are mapped back), double-faced cards by
  their front name, and Scryfall results for cards newer than the snapshot are dropped. On control
  queries the two sides agree exactly; on broad ones the leftover noise is 1–3%.
- A few Scryfall semantics were checked with single queries rather than in the appendix: special
  rarity sits between rare and mythic (`r>rare r<mythic` is 347 special cards), `is:commander`
  ignores Commander legality (`is:commander -f:commander` is 171 cards), `devotion=` is exact while
  `devotion:` means at least, `is:fullart` is the same as `is:full`, and unknown terms are ignored
  with a warning (_"Invalid expression "kw:first" was ignored"_).
- The snapshot has no Tagger tags or EDHREC ranks and its prices are six months old, so those
  weren't compared.

Counts are **ours / Scryfall**, with Scryfall limited to cards in our snapshot.

## What changed

### Bugs fixed

- `c:c` and `c:colorless` matched every card; they now mean colorless. `c:c t:creature`:
  17,567 / 1,013 before, 1,028 / 1,020 now.
- `c:m` matched exactly two colors; it now means two or more, and `multicolor` works too.
- `c:Azorius` only parsed in lowercase.
- Land shortcuts were missing newer cycles. `is:bikeland`, `is:shadowland`, `is:tangoland`,
  `is:filterland` and `is:bounceland` now match Scryfall exactly, and `is:bondland`, `is:pathway`,
  `is:slowland` and `is:triome` (with Scryfall's aliases) were added from Scryfall's own results.

### Syntax aligned with Scryfall

- **Precedence:** `and` binds tighter than `or`. `t:goblin or t:elf c:u`: 67 / 581 before,
  602 / 595 now.
- **Unparseable terms are ignored**, as on Scryfall, instead of failing the whole filter. Only keyword
  terms (`frame:2015`, `-wm:orzhov`, `lang:xx`) and `@@` are dropped; a malformed name, quote or
  parenthesis is still an error, and so is a filter where every term was dropped. The dropped terms
  are listed after the filter's description wherever the site shows one. Filters the code builds
  itself (Synergy Connect, crossword, Mana Matrix, combo templates) pass `{ strict: true }` and keep
  the old behavior.
- **`o:` leaves out reminder text**, and `fo:` / `fulloracle:` searches the full text.
  `o:"can't be blocked except by creatures with flying or reach"`: 83 / 4 before, 4 / 4 now.
- **`t:` matches a real type name as a whole word** (`t:fish` no longer finds Jellyfish), using
  Scryfall's type catalogs. Partial words still match as before (`t:legend`, `t:sha`).
- **`kw:` matches a whole keyword** and ignores values that aren't keyword abilities, keyword actions
  or ability words, using Scryfall's catalogs. `kw:flash` no longer finds Flashback.
- **`art:` is an art tag**; `a:` and `artist:` are the artist. `function:` was added for oracle tags.
- **`year` is the printing's release year**; `firstyear` / `fy` keep the first-print year.
  `year=2024 t:dragon`: 14 / 80 before, 80 / 80 now. `date:` was added (a date, not a set code).
- **`*` power and toughness count as 0**, `∞` is infinite, and a card without the stat no longer
  matches (non-creatures used to count as power 0). `t:creature pow=0`: 799 / 1,012 before,
  1,007 / 1,016 now.
- **Devotion** means at least for `:` and exactly for `=`, counts permanents only, and takes hybrid
  symbols (`devotion:{u/b}{u/b}{u/b}`). `devotion:{u}{u}{u}`: 117 / 81 before, 86 / 83 now.
- **Rarity order** is common, uncommon, rare, special, mythic, bonus, and `bonus` was added.
- **Names ignore apostrophes:** `urzas` 0 / 31 before, 32 / 32 now.
- **`game:` is this printing and `in:` any printing**, as on Scryfall (`game:is-arena` still works).
- **`is:default` is the standard frame**, approximated from border, full-art, promo and booster-fun
  data, with `is:atypical` as its opposite. The old meaning moved to `is:defaultprinting`.
- **`is:` categories with Scryfall's meaning:** `is:hybrid` (any hybrid symbol, including `{2/W}` and
  `{G/W/P}`), `is:phyrexian` (also in rules text, 73 / 73), `is:vanilla` (creatures only),
  `is:modal` (choose lists, Spree and pawprints; Sieges no longer count), `is:commander` (Vehicles and
  Spacecraft count, legality doesn't, banned cards don't).
- **New `is:` categories:** `is:frenchvanilla`, `is:bear`, `is:party`, `is:outlaw`, `is:meldpart`,
  `is:meldresult`, `is:brawler`, `is:partner`, `is:companion`, `is:funny`, `is:masterpiece`,
  `is:alchemy`, `is:glossy`, `is:full`, and every Scryfall promo type in our data (`is:prerelease`,
  `is:judge_gift`, ...).
- **New keywords and values:** `f:` / `format:`, `manavalue`, `mv:even` / `mv:odd`, half mana values,
  `{C/W}` and `{G/W/P}` symbols, `powtou`, `produces:`, `border:`, `lang:`, `artists>1`, `cn>50`,
  college and four-color color names, `st:` with or without underscores.
- **Search directives:** `unique:`, `++`, `order:`, `direction:` and `prefer:` are applied by card
  search (`searchAllCards`) and take precedence over the page's controls.
- **Default card pool:** card search now shows digital-only printings and hides playtest cards,
  rebalanced Alchemy cards, Heroes of the Realm, Happy Holidays and HasCon promos, and the cards
  removed in 2020, as Scryfall does. `is:funny` brings the funny ones back. This is a separate pool
  (`catalog.searchCardList`); `printedCardList` and `isExtraCard` are unchanged for the other
  features that use them.

## What still differs

### Kept on purpose

- **Foil filters.** `is:foil`, `is:nonfoil`, `is:etched` and `is:altfoil` check the finish chosen
  for a cube card. Outside a cube every card reads as non-foil, so `is:foil e:c16` is 0 / 20 and
  `is:nonfoil` matches everything; Scryfall uses the finishes a printing is available in. `price:` in
  a cube likewise uses the chosen finish's price.
- **`c:` in a cube** reads the cube card's color, which starts as its color identity.
- **CubeCobra-only syntax** (`tag:`, `status:`, `cc:`, `cw:`, `elo:`, `is:gold`, ...) is kept.

### Needs card data we don't store

These terms are ignored (and reported) until the data exists. Each would need a field added in
`update_cards.ts` and a card data rebuild.

- **Double-faced cards:** type, colors, mana cost, P/T and loyalty come from the front face only.
  `t:land is:mdfc` 10 / 60, `t:creature t:land` 1 / 22, `kw:flying -t:creature` 73 / 48,
  `pow>=8` misses back faces like Hulk. Adventure cards use the creature's type line, so
  `t:instant` misses Bonecrusher Giant's Stomp.
- **Flavor names:** a flavor-named printing stores its flavor name as `name`, so `-fire` still
  shows Fire Covenant through its Secret Lair printing.
- **Not stored at all:** flavor text (`ft:`), watermarks (`wm:`, `has:watermark`), frame and frame
  effects (`frame:`, `is:new`, `is:old`, `is:colorshifted`), security stamp (`stamp:`), high-res
  scans (`is:hires`), booster flag (`is:booster`), story spotlight (`is:spotlight`), game changers
  (`is:gamechanger`), color indicators (`has:indicator`), blocks and set groups (`b:`, `g:`),
  per-card print history (`in:<set>`, `in:<rarity>`, `new:`, `prints=`, `sets=`, `is:unique`,
  `illustrations>1`, `cheapest:`), and legalities beyond our twelve formats (`f:oathbreaker`,
  `is:duelcommander`, `is:oathbreaker`).
- **Languages:** we only have non-English printings of cards never printed in English, so
  `lang:japanese t:dragon` is 13 / 410.
- **Set codes as dates** (`date>ori`) need set release dates at parse time.

### Approximations and unexplained gaps

- `is:frenchvanilla` 1,111 / 1,055: ours allows keywords like Protection from red that Scryfall
  sometimes doesn't, and misses cumulative upkeep and similar keywords with an em dash.
- `is:atypical t:dragon` 250 / 256, `is:default` within a few percent.
- `is:full t:dragon` 94 / 9: ours is Scryfall's `full_art` flag; Scryfall's `is:full` is far
  narrower, for reasons not found.
- `is:masterpiece` 834 / 901: ours is set type `masterpiece`; Scryfall also counts some printings in
  other sets.
- `is:promo t:dragon` 226 / 167 and `is:dfc` 505 / 3,065 (Scryfall total, including many
  single-faced cards): causes not investigated.
- `is:commander c=wu` 131 / 120: most of the extra cards are Alchemy "specialize" variants, which
  Scryfall hides by default.
- `is:partner` 228 / 222: the extra six are Stranger Things Secret Lair cards.
- Oracle and art tag matching: ours treats `otag:removal` as a substring match. Scryfall's exact
  semantics weren't verified because the snapshot has no tag data.
- `unique:art` (`@@`) and `display:` aren't supported, and `order:` only supports name, cmc, usd,
  edhrec and released.
- Regular expressions run on RE2, so lookarounds, backreferences and `\smr` don't work.

## Appendix: comparison results

What each column means:

- **Ours**: distinct cards our filter matches in card search's default pool, with its fallback to
  extras when nothing matches.
- **Scryfall**: Scryfall's matches that are also in that pool. "(total)" means Scryfall's raw total,
  used when the results weren't fully fetched (over 1,750 cards) or our side errored.
- **Only ours / Only Scryfall**: cards matched on one side but not the other.
- **Ignored**: terms our filter left out.

A ″ means the Scryfall query is the same as ours.

| Query (ours)                                                    | Query (Scryfall)                                                 |   Ours |       Scryfall | Only ours | Only Scryfall | Ignored         |
| --------------------------------------------------------------- | ---------------------------------------------------------------- | -----: | -------------: | --------: | ------------: | --------------- |
| `c:rg`                                                          | ″                                                                |    643 |            637 |        13 |             7 |                 |
| `c=rg`                                                          | ″                                                                |    365 |            356 |        12 |             3 |                 |
| `color>=uw -c:red`                                              | ″                                                                |    545 |            535 |        13 |             3 |                 |
| `id<=esper t:instant`                                           | ″                                                                |  2,243 |  2,381 (total) |         – |             – |                 |
| `id:c t:land`                                                   | ″                                                                |    359 |            366 |         1 |             8 |                 |
| `c=2 is:bear`                                                   | ″                                                                |    239 |            242 |         2 |             5 |                 |
| `c:m t:creature mv<=2`                                          | ″                                                                |    582 |            590 |        21 |            29 |                 |
| `c:c t:creature`                                                | ″                                                                |  1,028 |          1,020 |        53 |            45 |                 |
| `c:colorless t:creature`                                        | ″                                                                |  1,028 |          1,020 |        53 |            45 |                 |
| `c:multicolor t:creature mv<=2`                                 | ″                                                                |    582 |            590 |        21 |            29 |                 |
| `c:quandrix t:creature`                                         | ″                                                                |    450 |            449 |         9 |             8 |                 |
| `c:chaos`                                                       | ″                                                                |     60 |             60 |         1 |             1 |                 |
| `id:azorius t:creature mv=1`                                    | ″                                                                |    470 |            471 |         1 |             2 |                 |
| `ci=wu t:creature`                                              | `id=wu t:creature`                                               |    293 |            282 |        13 |             2 |                 |
| `has:indicator`                                                 | ″                                                                |  error |    362 (total) |         – |             – |                 |
| `t:goblin or t:elf c:u`                                         | ″                                                                |    602 |            595 |        11 |             4 |                 |
| `t:goblin or (t:elf c:u)`                                       | ″                                                                |    602 |            595 |        11 |             4 |                 |
| `(t:goblin or t:elf) c:u`                                       | ″                                                                |     70 |             69 |         4 |             3 |                 |
| `t:merfolk t:legend`                                            | ″                                                                |     40 |             40 |         0 |             0 |                 |
| `t:goblin -t:creature`                                          | ″                                                                |      8 |              7 |         1 |             0 |                 |
| `o:"~ enters tapped"`                                           | ″                                                                |    710 |            711 |         0 |             1 |                 |
| `o:"can't be blocked except by creatures with flying or reach"` | ″                                                                |      4 |              4 |         0 |             0 |                 |
| `o:"can't be blocked except by creatures with flying or reach"` | `fo:"can't be blocked except by creatures with flying or reach"` |      4 |             83 |         0 |            79 |                 |
| `kw:flying -t:creature`                                         | ″                                                                |     73 |             48 |        25 |             0 |                 |
| `mana:{G}{U}`                                                   | ″                                                                |    544 |            538 |         8 |             2 |                 |
| `m:2WW`                                                         | ″                                                                |    817 |            810 |         7 |             0 |                 |
| `m>3WU`                                                         | ″                                                                |     71 |             72 |         0 |             1 |                 |
| `m:{R/P}`                                                       | ″                                                                |      6 |              6 |         0 |             0 |                 |
| `c:u mv=5`                                                      | ″                                                                |    892 |            877 |        16 |             1 |                 |
| `mv:even t:creature c:w`                                        | ″                                                                |  2,169 |  2,313 (total) |         – |             – |                 |
| `manavalue=3 t:creature c:w`                                    | ″                                                                |  1,090 |          1,085 |        18 |            13 |                 |
| `is:hybrid`                                                     | ″                                                                |    559 |            554 |         5 |             0 |                 |
| `is:phyrexian`                                                  | ″                                                                |     73 |             73 |         0 |             0 |                 |
| `devotion:{u/b}{u/b}{u/b}`                                      | ″                                                                |    251 |            243 |         8 |             0 |                 |
| `devotion:{u}{u}{u}`                                            | ″                                                                |     86 |             83 |         3 |             0 |                 |
| `produces=wu`                                                   | ″                                                                |     46 |             46 |         0 |             0 |                 |
| `pow>=8`                                                        | ″                                                                |    229 |            238 |         2 |            11 |                 |
| `pow>tou c:w t:creature`                                        | ″                                                                |    610 |            644 |         4 |            38 |                 |
| `t:planeswalker loy=3`                                          | ″                                                                |     70 |             76 |         0 |             6 |                 |
| `t:creature pow<1`                                              | ″                                                                |  1,011 |          1,020 |         6 |            15 |                 |
| `t:creature pow=0`                                              | ″                                                                |  1,007 |          1,016 |         6 |            15 |                 |
| `powtou>=20`                                                    | ″                                                                |     68 |             67 |         1 |             0 |                 |
| `pt>=20`                                                        | ″                                                                |     68 |             67 |         1 |             0 |                 |
| `is:meld`                                                       | ″                                                                |     21 |             21 |         0 |             0 |                 |
| `is:split`                                                      | ″                                                                |    126 |            126 |         0 |             0 |                 |
| `is:flip`                                                       | ″                                                                |     21 |             21 |         0 |             0 |                 |
| `is:transform`                                                  | ″                                                                |    390 |            390 |         0 |             0 |                 |
| `is:tdfc`                                                       | ″                                                                |    390 |            390 |         0 |             0 |                 |
| `is:dfc`                                                        | ″                                                                |    505 |  3,065 (total) |         – |             – |                 |
| `is:mdfc`                                                       | ″                                                                |     94 |             93 |         1 |             0 |                 |
| `is:leveler`                                                    | ″                                                                |     25 |             25 |         0 |             0 |                 |
| `is:meldpart`                                                   | ″                                                                |     14 |             14 |         0 |             0 |                 |
| `t:land is:mdfc`                                                | ″                                                                |     10 |             60 |         0 |            50 |                 |
| `t:creature t:land`                                             | ″                                                                |      1 |             22 |         0 |            21 |                 |
| `name:"midnight scourge"`                                       | ″                                                                |      2 |              1 |         1 |             0 |                 |
| `!"tovolar, the midnight scourge"`                              | ″                                                                |      1 |              1 |         0 |             0 |                 |
| `!fire`                                                         | ″                                                                |      1 |              1 |         0 |             0 |                 |
| `!"sift through sands"`                                         | ″                                                                |      1 |              1 |         0 |             0 |                 |
| `c>=br is:spell mv<=2`                                          | ″                                                                |     81 |             79 |         5 |             3 |                 |
| `is:permanent t:rebel`                                          | ″                                                                |     86 |             86 |         0 |             0 |                 |
| `is:vanilla`                                                    | ″                                                                |    343 |            357 |         0 |            14 |                 |
| `is:frenchvanilla`                                              | ″                                                                |  1,111 |          1,055 |        84 |            28 |                 |
| `is:bear`                                                       | ″                                                                |    981 |            981 |         4 |             4 |                 |
| `is:manland`                                                    | ″                                                                |     48 |             49 |         1 |             2 |                 |
| `is:creatureland`                                               | ″                                                                |     48 |             49 |         1 |             2 |                 |
| `is:historic c:w mv=1`                                          | ″                                                                |     49 |             50 |         1 |             2 |                 |
| `is:party mv=1`                                                 | ″                                                                |    293 |            294 |         0 |             1 |                 |
| `is:outlaw mv=1`                                                | ″                                                                |     92 |             94 |         0 |             2 |                 |
| `is:modal`                                                      | ″                                                                |    720 |            717 |         4 |             1 |                 |
| `is:funny`                                                      | ″                                                                |  1,287 |            573 |         5 |             9 |                 |
| `t:scheme`                                                      | ″                                                                |    102 |              0 |         0 |             0 |                 |
| `t:goblin s:unf`                                                | ″                                                                |      7 |              6 |         1 |             0 |                 |
| `r:common t:artifact t:creature`                                | ″                                                                |    461 |            463 |         2 |             4 |                 |
| `r>=r t:dragon`                                                 | ″                                                                |    314 |            321 |         0 |             7 |                 |
| `r>mythic`                                                      | ″                                                                |      9 |              9 |         0 |             0 |                 |
| `r:special`                                                     | ″                                                                |    347 |            347 |         0 |             0 |                 |
| `r:bonus`                                                       | ″                                                                |      9 |              9 |         0 |             0 |                 |
| `in:rare -rarity:rare t:dragon`                                 | ″                                                                |    249 |             30 |       222 |             3 | `in:rare`       |
| `e:war`                                                         | ″                                                                |    266 |            265 |         1 |             0 |                 |
| `e:war is:booster`                                              | ″                                                                |    266 |            254 |        12 |             0 | `is:booster`    |
| `b:wwk`                                                         | ″                                                                |  error |    629 (total) |         – |             – |                 |
| `g:fin`                                                         | ″                                                                |  error |    779 (total) |         – |             – |                 |
| `in:lea`                                                        | ″                                                                |  error |    289 (total) |         – |             – |                 |
| `cn>50 e:war`                                                   | ″                                                                |    215 |            215 |         0 |             0 |                 |
| `cn:50 e:war`                                                   | ″                                                                |      1 |              1 |         0 |             0 |                 |
| `st:core t:dragon`                                              | ″                                                                |     48 |             49 |         0 |             1 |                 |
| `st:draftinnovation t:dragon`                                   | ″                                                                |    109 |            108 |         1 |             0 |                 |
| `st:draft_innovation t:dragon`                                  | ″                                                                |    109 |            108 |         1 |             0 |                 |
| `is:datestamped is:prerelease`                                  | ″                                                                |  3,899 |  3,899 (total) |         – |             – |                 |
| `cube:vintage`                                                  | ″                                                                |  error |    540 (total) |         – |             – |                 |
| `c:g t:creature f:pauper mv<=2`                                 | ″                                                                |    463 |            463 |         2 |             2 |                 |
| `f:pauper t:dragon`                                             | ″                                                                |     38 |             39 |         0 |             1 |                 |
| `banned:legacy`                                                 | ″                                                                |    162 |            162 |         1 |             1 |                 |
| `restricted:vintage`                                            | ″                                                                |     51 |             51 |         0 |             0 |                 |
| `is:commander c=wu`                                             | ″                                                                |    131 |            120 |        12 |             1 |                 |
| `is:commander t:artifact`                                       | ″                                                                |    130 |            136 |         5 |            11 |                 |
| `is:reserved t:land`                                            | ″                                                                |     45 |             45 |         0 |             0 |                 |
| `is:gamechanger`                                                | ″                                                                |  error |     53 (total) |         – |             – |                 |
| `is:partner`                                                    | ″                                                                |    228 |            222 |         6 |             0 |                 |
| `is:companion`                                                  | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `f:oathbreaker t:dragon`                                        | ″                                                                |    431 |            415 |        24 |             8 | `f:oathbreaker` |
| `a:proce`                                                       | ″                                                                |    122 |            121 |         1 |             0 |                 |
| `artists>1 t:dragon`                                            | ″                                                                |      6 |              7 |         0 |             1 |                 |
| `ft:mishra`                                                     | ″                                                                |  error |     51 (total) |         – |             – |                 |
| `wm:orzhov`                                                     | ″                                                                |  error |    104 (total) |         – |             – |                 |
| `art:squirrel`                                                  | ″                                                                |      0 |            186 |         0 |           186 |                 |
| `border:white t:dragon`                                         | ″                                                                |     19 |             19 |         1 |             1 |                 |
| `frame:2015 t:dragon`                                           | ″                                                                |    431 |            387 |        52 |             8 | `frame:2015`    |
| `is:full t:dragon`                                              | ″                                                                |     94 |              9 |        87 |             2 |                 |
| `is:foil e:c16`                                                 | ″                                                                |      0 |             20 |         0 |            20 |                 |
| `is:etched t:dragon`                                            | ″                                                                |      0 |             33 |         0 |            33 |                 |
| `is:hires t:dragon`                                             | ″                                                                |    431 |            398 |        41 |             8 | `is:hires`      |
| `stamp:oval t:dragon`                                           | ″                                                                |    431 |            264 |       171 |             4 | `stamp:oval`    |
| `is:universesbeyond t:dragon`                                   | ″                                                                |     24 |             29 |         0 |             5 |                 |
| `is:atypical t:dragon`                                          | ″                                                                |    250 |            256 |         7 |            13 |                 |
| `game:arena t:dragon`                                           | ″                                                                |    224 |            228 |         5 |             9 |                 |
| `-in:mtgo f:legacy t:dragon`                                    | ″                                                                |      8 |              4 |         4 |             0 |                 |
| `in:mtgo t:dragon`                                              | ″                                                                |    399 |            411 |         0 |            12 |                 |
| `is:alchemy t:dragon`                                           | ″                                                                |     48 |             43 |         5 |             0 |                 |
| `is:promo t:dragon`                                             | ″                                                                |    226 |            167 |        65 |             6 |                 |
| `is:spotlight`                                                  | ″                                                                |  error |    385 (total) |         – |             – |                 |
| `year<=1994`                                                    | ″                                                                |    981 |            981 |         0 |             0 |                 |
| `year=2024 t:dragon`                                            | ″                                                                |     80 |             80 |         0 |             0 |                 |
| `date>=2015-08-18 t:dragon`                                     | ″                                                                |    391 |            394 |         5 |             8 |                 |
| `function:removal t:dragon`                                     | ″                                                                |      0 |            106 |         0 |           106 |                 |
| `is:reprint e:c16`                                              | ″                                                                |    285 |            285 |         0 |             0 |                 |
| `not:reprint e:c16`                                             | ″                                                                |     56 |             56 |         0 |             0 |                 |
| `e:ktk is:unique`                                               | ″                                                                |    254 |             67 |       187 |             0 | `is:unique`     |
| `sets>=20 t:dragon`                                             | ″                                                                |    431 |              2 |       429 |             0 | `sets>=20`      |
| `lang:japanese t:dragon`                                        | ″                                                                |     13 |            410 |         1 |           398 |                 |
| `is:bikeland`                                                   | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:bondland`                                                   | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:bounceland`                                                 | ″                                                                |     17 |             17 |         0 |             0 |                 |
| `is:canopyland`                                                 | ″                                                                |      6 |              6 |         0 |             0 |                 |
| `is:checkland`                                                  | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:dual`                                                       | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:fastland`                                                   | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:fetchland`                                                  | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:filterland`                                                 | ″                                                                |     22 |             22 |         0 |             0 |                 |
| `is:gainland`                                                   | ″                                                                |     15 |             15 |         0 |             0 |                 |
| `is:painland`                                                   | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:pathway`                                                    | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:scryland`                                                   | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:surveilland`                                                | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:shadowland`                                                 | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:snarl`                                                      | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:shockland`                                                  | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:slowland`                                                   | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:storageland`                                                | ″                                                                |     12 |             12 |         0 |             0 |                 |
| `is:tangoland`                                                  | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:triome`                                                     | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:triland`                                                    | ″                                                                |     10 |             10 |         0 |             0 |                 |
| `is:masterpiece`                                                | ″                                                                |    834 |            901 |         0 |            67 |                 |
| `is:colorshifted`                                               | ″                                                                |  error |     45 (total) |         – |             – |                 |
| `-fire c:r t:instant`                                           | ″                                                                |    786 |            800 |         2 |            16 |                 |
| `o:changeling -t:creature`                                      | ″                                                                |     16 |             16 |         0 |             0 |                 |
| `-not:reprint e:c16`                                            | ″                                                                |    285 |            285 |         0 |             0 |                 |
| `t:creature o:/^{T}:/`                                          | ″                                                                |    835 |            832 |        10 |             7 |                 |
| `t:instant o:/\spp/`                                            | ″                                                                |    674 |            691 |         2 |            19 |                 |
| `name:/\bizzet\b/`                                              | ″                                                                |     15 |             15 |         0 |             0 |                 |
| `ft:/dragon/`                                                   | ″                                                                |  error |    333 (total) |         – |             – |                 |
| `t:/^legendary creature/ c:r mv=2`                              | ″                                                                |    102 |            107 |         1 |             6 |                 |
| `t:fish or t:bird`                                              | ″                                                                |    503 |            508 |         1 |             6 |                 |
| `t:land (a:titus or a:avon)`                                    | ″                                                                |    127 |            130 |         0 |             3 |                 |
| `t:legendary (t:goblin or t:elf)`                               | ″                                                                |    225 |            207 |        20 |             2 |                 |
| `through (depths or sands or mists)`                            | ″                                                                |      3 |              3 |         0 |             0 |                 |
| `!"Lightning Bolt" unique:prints`                               | ″                                                                |      1 |              2 |         0 |             1 |                 |
| `t:human display:text`                                          | ″                                                                |  4,344 |  4,782 (total) |         – |             – | `display:text`  |
| `t:dragon order:cmc`                                            | ″                                                                |    431 |            432 |         7 |             8 |                 |
| `urzas`                                                         | ″                                                                |     32 |             32 |         0 |             0 |                 |
| `urza's saga`                                                   | ″                                                                |      1 |              1 |         0 |             0 |                 |
| `t:goblin c:r mv=1 kw:haste`                                    | ″                                                                |     11 |             11 |         0 |             0 |                 |
| `kw:first -t:creature`                                          | ″                                                                | 14,505 | 15,056 (total) |         – |             – | `kw:first`      |
| `o:"draw a card" c:u mv=1 t:creature`                           | ″                                                                |     20 |             20 |         0 |             0 |                 |
| `t:sha`                                                         | ″                                                                |    772 |            774 |         6 |             8 |                 |
| `t:legendary t:goblin`                                          | ″                                                                |     63 |             60 |         5 |             2 |                 |
| `cheapest:usd t:dragon`                                         | ″                                                                |    431 |            416 |        23 |             8 | `cheapest:usd`  |
| `t:dragon`                                                      | ″                                                                |    431 |            432 |         7 |             8 |                 |
| `t:fish and t:bird`                                             | ″                                                                |      0 |              0 |         0 |             0 |                 |
| `t:goblin and c:r and mv=1`                                     | ″                                                                |     87 |             87 |         0 |             0 |                 |
| `o:'draw a card' t:goblin`                                      | ″                                                                |     15 |             15 |         0 |             0 |                 |
| `spacegodzilla`                                                 | ″                                                                |      2 |              2 |         0 |             0 |                 |
| `t:dragon is:nonfoil`                                           | ″                                                                |    431 |            432 |         7 |             8 |                 |
| `is:modal t:siege`                                              | ″                                                                |      1 |              1 |         0 |             0 |                 |

---
title: Filter Syntax
description: Reference for the search syntax used throughout cube and card search.
order: 1
---

Cube Cobra's filter syntax is used across cube card lists, the card database, and advanced search.
Combine any number of conditions to find exactly the cards you want. Operators and conditions are
case-insensitive.

## General

You can combine any number of filters together using `AND` or `OR`. Operators are case-insensitive,
as are all filtering conditions (`TYPE:instant and o:DESTROY` will still work, for example).

| Query                    | Matches                                      |
| ------------------------ | -------------------------------------------- |
| `t:instant OR t:sorcery` | cards that are either instants or sorceries. |
| `t:instant t:tribal`     | cards that are both instants and tribal.     |

Text without a filtering condition is treated as a name. You can use quotes to require an exact
match.

| Query                           | Matches                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `goblin blood`                  | cards whose names contain both "blood" and "goblin".                          |
| `"goblin blood"`                | cards whose names contain exactly "goblin blood".                             |
| `o:destroy o:target o:creature` | cards whose oracle text contains each of "destroy", "target", and "creature". |
| `o:"destroy target creature"`   | cards whose oracle text contains exactly "destroy target creature".           |

You can also use parentheses to combine clauses.

| Query                             | Matches                                           |
| --------------------------------- | ------------------------------------------------- |
| `t:creature o:flash`              | cards that are creatures with flash.              |
| `t:creature o:flash OR t:instant` | cards that are creatures with flash, or instants. |

You can put `-` before anything to negate it.

| Query         | Matches                                            |
| ------------- | -------------------------------------------------- |
| `-c:w`        | cards that are not white.                          |
| `-o:draw`     | cards which do not have draw in their oracle text. |
| `-t:creature` | cards which are not creatures.                     |
| `-mox`        | cards whose names do not include "mox".            |

## Color and Color Identity

You can find cards that are a certain color by using `c:` or `color:`, and cards with a certain
color identity by using `ci:`, `id:`, `identity:`, or `coloridentity:`.

Operators supported: `:`, `=`, `<`, `>`, `<=`, `>=`, `<>`, `!=`.

In addition to `w`, `u`, `b`, `r`, `g`, and `c`, you can use color words like `white`, `blue`,
`green`, etc. You can also use all shard, wedge, or guild names, like `azorius`, `bant`, `dimir`,
etc. You can also compare by number of colors by using numbers instead of color names.

Color Identity searches will respect any color identity overrides you have set while filtering in
your cube.

| Query        | Matches                                                                         |
| ------------ | ------------------------------------------------------------------------------- |
| `c=wubrg`    | cards that are all 5 colors.                                                    |
| `c<esper`    | cards whose colors are a subset of Esper (UB, WB, WU, U, B, W, or colorless).   |
| `ci:wu`      | cards whose color identities are exactly white blue.                            |
| `ci>azorius` | cards whose color identities contain white, blue, and at least one other color. |
| `ci>1`       | cards with more than 1 color in their identity.                                 |
| `ci<=3`      | cards with 3 or fewer colors in their identity.                                 |
| `ci:m`       | cards with more than 1 color in their identity.                                 |
| `ci!=m`      | cards with 1 or fewer colors in their identity.                                 |

## Card Types

You can search for card types with `t:` or `type:`.

Operators supported: `:`, `=`.

Search for any part of the typeline, i.e. `legendary` or `human`. Partial types are allowed.

| Query                    | Matches                                                 |
| ------------------------ | ------------------------------------------------------- |
| `type=legendary`         | cards that are legendary.                               |
| `t:legendary t:creature` | cards that are legendary creatures.                     |
| `t:sha`                  | cards that are shamans, shapeshifters, or spellshapers. |
| `is:spell`               | cards that are spells.                                  |
| `is:permanent`           | cards that are permanents.                              |

## Card Text and Set

You can use `o:` or `oracle:` to search oracle text, and `s:` or `set:` to search for a specific set
code.

Operators supported: `:`, `=`.

This searches the full oracle text, including reminder text. The set code can be either upper or
lower case.

| Query             | Matches                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| `o:"draw a card"` | cards whose oracle text contains "draw a card".                        |
| `o:":"`           | cards whose oracle text contains ":" (cards with activated abilities). |
| `s:war`           | cards from War of the Spark.                                           |

## Keywords

You can use `kw:`, `keyword:`, or `keywords:` to search for cards with specific keywords (e.g.
Flying, Trample, Deathtouch).

Operators supported: `:`, `=` for matching keyword text, and `=`, `<`, `>`, `<=`, `>=`, `!=`, `<>`
for comparing keyword count.

Use `:` for partial matching (contains) and `=` with a string for an exact keyword match. Use
numeric comparisons to filter by the number of keywords a card has.

| Query             | Matches                                                    |
| ----------------- | ---------------------------------------------------------- |
| `kw:flying`       | cards that have the Flying keyword.                        |
| `keyword=trample` | cards that have exactly the keyword "Trample".             |
| `kw:death`        | cards with a keyword containing "death" (e.g. Deathtouch). |
| `keywords>3`      | cards with more than 3 keywords.                           |
| `keywords=0`      | cards with no keywords.                                    |

## Scryfall Tags

CubeCobra imports the community-sourced tags from [Scryfall Tagger](https://tagger.scryfall.com/).
Oracle tags describe a card's function (`otag:`, `oracletag:`, `oracletags:`) and are shared by
every printing of a card. Art tags describe a printing's illustration (`atag:`, `arttag:`,
`arttags:`, `illustrationtag:`) and are specific to each artwork. Tags use Scryfall's slug form
(e.g. `removal`, `card-advantage`, `dragon`).

Operators supported: `:`, `=` for matching tag text, and `=`, `<`, `>`, `<=`, `>=`, `!=`, `<>`
for comparing tag count. Use `:` for partial matching (contains) and `=` with a string for an
exact tag match.

| Query               | Matches                                                          |
| ------------------- | --------------------------------------------------------------- |
| `otag:removal`      | cards with an oracle tag containing "removal".                  |
| `oracletag=ramp`    | cards with exactly the oracle tag "ramp".                       |
| `otag:counter`      | cards with an oracle tag containing "counter".                  |
| `oracletags>2`      | cards with more than 2 oracle tags.                             |
| `atag:dragon`       | cards whose artwork is tagged with something containing "dragon". |
| `arttag=goblin`     | cards whose artwork is tagged exactly "goblin".                 |
| `atag:landscape`    | cards whose art tag contains "landscape".                       |

## Mana Costs

You can use `m:` or `mana:` to search for cards with specific mana costs.

Operators supported: `:`, `=`.

You can use plain numbers and letters for the 5 basic colors, snow, colorless, and x, y, and z
costs. For hybrid costs, you can use braces, i.e. `{2/G}`, `{R/G}`, etc. For phyrexian mana, use
`{W/P}`. You can also surround mana costs with braces if you prefer, i.e. `{2}{G}{g}` instead of
`2GG`. Either way is fine.

You can search for cards that require two or more colors with `is:gold`, cards that contain hybrid
symbols with `is:hybrid`, or Phyrexian mana symbols with `is:phyrexian`.

| Query          | Matches                                                                |
| -------------- | ---------------------------------------------------------------------- |
| `m:{r/g}{r/g}` | cards that cost two hybrid red/green mana, i.e. Burning-Tree Emissary. |
| `m:2ww`        | cards that cost 2 generic mana and 2 white mana.                       |
| `is:gold`      | cards that require two or more colors.                                 |
| `is:hybrid`    | cards with one or more hybrid mana symbols.                            |
| `is:phyrexian` | cards with one or more Phyrexian mana symbols.                         |
| `is:twobrid`   | cards with one or more "two generic or a color" symbols.               |

## Mana Value

You can use `mv:` to search for specific mana values.

Operators supported: `:`, `=`, `<`, `>`, `<=`, `>=`.

| Query  | Matches                               |
| ------ | ------------------------------------- |
| `mv>5` | cards with mana value greater than 5. |
| `mv=3` | cards with mana value of exactly 3.   |

## Power, Toughness, and Loyalty

You can use `pow:` or `power:` to search for cards with certain powers, `tou:` or `toughness:` for
toughness, and `loy:` or `loyalty:` for starting loyalty.

Operators supported: `:`, `=`, `<`, `>`, `<=`, `>=`, `!=`, `<>`.

| Query            | Matches                                                      |
| ---------------- | ------------------------------------------------------------ |
| `pow>7`          | cards with greater than 7 power.                             |
| `pow<5 tou<5`    | cards with both less than 5 power and less than 5 toughness. |
| `pow>toughness`  | cards with power greater than toughness.                     |
| `tou!=power`     | cards with toughness not equal to power.                     |
| `loy:3 or loy:4` | cards with a starting loyalty of 3 or 4.                     |

## Rarity

You can use `r:` or `rarity:` to search for cards with a specific rarity.

Operators supported: `:`, `=`, `<`, `>`, `<=`, `>=`.

| Query                | Matches                   |
| -------------------- | ------------------------- |
| `r:common`           | Common cards.             |
| `r<=uncommon`        | Common or uncommon cards. |
| `r:common or r:rare` | Common or rare cards.     |

## Artist

You can use `a:`, `art:`, or `artist:` to search for cards illustrated by a specific artist. Also
`is:reprint`, `is:firstprint`, `is:promo`, `is:digital`, `is:default`, and `is:voucher`.

| Query              | Matches                                                    |
| ------------------ | ---------------------------------------------------------- |
| `a:"seb mckinnon"` | All cards illustrated by Seb McKinnon.                     |
| `a:reb`            | All cards illustrated by artists with "reb" in their name. |
| `is:firstprint`    | All first printings of cards.                              |

## Devotion

You can use `d:`, `dev:`, or `devotion:` to search for cards with a given mono-color devotion. You
can also append a color to the query to use numbers instead, like `dw:` or `devotiontow:`.

| Query           | Matches                                     |
| --------------- | ------------------------------------------- |
| `d:www`         | All cards with exactly 3 white devotion.    |
| `devotiontor>2` | All cards with more than 2 devotion to red. |

## Price

You can use `price:`, `priceNormal:`, `priceFoil:`, `priceEur:`, or `priceTix:` to filter cards by
price. When filtering in individual cubes, `price:` uses the printing specified for the cube.
`priceEur:` uses the nonfoil Card Market prices. `priceTix:` uses MTGO TIX prices.

| Query                            | Matches                                                               |
| -------------------------------- | --------------------------------------------------------------------- |
| `price>10.5`                     | All cards in a cube whose specified printing has a price over $10.50. |
| `priceFoil<10 OR priceNormal<10` | All cards with a price under $10.                                     |

## Tags

You can use `tag:` or `tags:` to filter cards by tag or tag count when in a cube.

| Query                   | Matches                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `tag:Signed`            | All cards in a cube that have a tag which contains "Signed", case insensitive (matches "Signed", "Unsigned", "Signed by", "Redesigned"). |
| `tag:Signed Blood`      | A combination of tag and name: cards that have a tag containing "Signed" and whose name contains "Blood".                                |
| `tag:"Signed"`          | All cards in a cube that have a tag exactly matching "Signed", case insensitive.                                                         |
| `tag:'Counter Synergy'` | All cards in a cube that have a tag exactly matching "Counter Synergy", case insensitive.                                                |
| `tags=0`                | All cards with no tags.                                                                                                                  |
| `tags>0`                | All cards with at least one tag.                                                                                                         |

## Notes

You can use `notes:` to filter cards by the contents of their notes.

| Query                  | Matches                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `notes:Signpost`       | All cards in a cube whose notes contain "Signpost", case insensitive.         |
| `notes:"is fun"`       | All cards in a cube whose notes contain "is fun", case insensitive.           |
| `notes="Too powerful"` | All cards in a cube whose notes are exactly "Too powerful", case insensitive. |
| `notes=""`             | All cards with no notes (single or double quotes are equivalent).             |
| `notes!=''`            | All cards with non-empty notes.                                               |

## Legality

You can use `leg:`, `legal:`, or `legality:` to filter cards by legality. Also `banned:`, `ban:`, or
`restricted:` to check inversely. The format name can also be double-quoted.

| Query                  | Matches                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `leg:Modern`           | All cards that are legal in Modern.                                                        |
| `-leg:Standard`        | All cards that are not legal in Standard.                                                  |
| `banned:Modern`        | All cards that are banned in Modern.                                                       |
| `restricted:"Vintage"` | All cards that are restricted in Vintage (the only format with restrictions currently).    |
| `is:commander`         | All cards that can be your commander.                                                      |
| `is:reserved`          | All cards that are on the reserved list.                                                   |
| `game:paper`           | All cards that have any version available in paper (checks across all printings).          |
| `game!=arena`          | All cards that have no version available on Arena (checks across all printings).           |
| `game:is-arena`        | All cards whose current printing is available on Arena (checks only the specific version). |

## Layout

You can use `layout:` to filter cards by layout.

| Option               | Meaning                                             |
| -------------------- | --------------------------------------------------- |
| `normal`             | A standard Magic card with one face.                |
| `split`              | A split-faced card.                                 |
| `flip`               | cards that invert vertically with the flip keyword. |
| `transform`          | Double-sided cards that transform.                  |
| `modal_dfc`          | Double-sided cards that can be played either side.  |
| `meld`               | cards with meld parts printed on the back.          |
| `leveler`            | cards with Level Up.                                |
| `saga`               | Saga-type cards.                                    |
| `adventure`          | cards with an Adventure spell part.                 |
| `planar`             | Plane and Phenomenon-type cards.                    |
| `scheme`             | Scheme-type cards.                                  |
| `vanguard`           | Vanguard-type cards.                                |
| `token`              | Token cards.                                        |
| `double_faced_token` | Tokens with another token printed on the back.      |
| `emblem`             | Emblem cards.                                       |
| `augment`            | cards with Augment.                                 |
| `host`               | Host-type cards.                                    |
| `art_series`         | Art Series collectable double-faced cards.          |
| `double_sided`       | A Magic card with two sides that are unrelated.     |

Additionally, you can use `is:dfc`, `is:mdfc`, `is:tdfc`, `is:meld`, `is:transform`, `is:leveler`,
`is:split`, `is:flip`, `is:adventure`, `is:omen`, and `is:prepared`.

## Border, Frame, Foil & Resolution

**Filters for individual cubes:** you can use `finish:` to filter by cards with the given finish.
Available options are "Non-foil", "Foil", "Etched", and "Alt-foil".

| Query                | Matches                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `finish:non-foil`    | All cards with the non-foil finish selected.                                               |
| `is:fullart`         | All cards with full extended art.                                                          |
| `is:universesbeyond` | All cards that are Universes Beyond. Also works with `is:ub`.                              |
| `is:standard`        | All cards that were printed in a standard expansion set.                                   |
| `is:supplemental`    | All cards that were only printed in supplemental products (never in a standard expansion). |

## Shortcuts and Nicknames

Land groups — each `is:` shortcut matches a well-known land cycle.

| Primary           | Alternatives                       |
| ----------------- | ---------------------------------- |
| `is:bikeland`     | `is:cycleland` or `is:bicycleland` |
| `is:bounceland`   | `is:karoo`                         |
| `is:canopyland`   | `is:canland`                       |
| `is:fetchland`    |                                    |
| `is:checkland`    |                                    |
| `is:dual`         |                                    |
| `is:fastland`     |                                    |
| `is:filterland`   |                                    |
| `is:gainland`     |                                    |
| `is:painland`     |                                    |
| `is:scryland`     |                                    |
| `is:shadowland`   |                                    |
| `is:shockland`    |                                    |
| `is:storageland`  |                                    |
| `is:creatureland` | `is:manland`                       |
| `is:triland`      |                                    |
| `is:tangoland`    |                                    |
| `is:battleland`   |                                    |
| `is:surveilland`  |                                    |

## First Print Year

You can use `year:`, `firstyear:`, or `fy:` to search for cards by the year they were first printed.

Operators supported: `:`, `=`, `<`, `>`, `<=`, `>=`.

| Query                   | Matches                                       |
| ----------------------- | --------------------------------------------- |
| `year>2020`             | cards first printed after 2020.               |
| `fy=1993`               | cards first printed in 1993 (Alpha/Beta era). |
| `firstyear<=2000`       | cards first printed in 2000 or earlier.       |
| `year>=2015 year<=2020` | cards first printed between 2015 and 2020.    |

## EDHREC Rank and Salt

CubeCobra imports [EDHREC](https://edhrec.com/)'s community data. Use `rank:` (or `edhrec:`,
`edhrecrank:`) to filter by a card's overall popularity rank, where **rank 1 is the most-played
card**. Use `salt:` (or `saltiness:`) to filter by a card's "salt" score, EDHREC's measure of how
much a card frustrates opponents (higher is saltier). Both are shared across every printing of a
card. Cards EDHREC doesn't track are treated as the worst possible rank and a salt score of 0.

Operators supported: `:`, `=`, `<`, `>`, `<=`, `>=`, `!=`, `<>`. Rank takes a whole number; salt
takes a decimal.

| Query           | Matches                                                       |
| --------------- | ------------------------------------------------------------- |
| `rank<=100`     | the 100 most-played cards on EDHREC.                          |
| `edhrec<=1000`  | cards ranked in the EDHREC top 1000.                          |
| `rank>5000`     | cards ranked worse than 5000 (including untracked cards).     |
| `salt>1`        | cards with a salt score above 1.                              |
| `salt>=1.5`     | especially salty cards (score 1.5 or higher).                 |
| `saltiness<0.1` | cards that rarely frustrate opponents.                        |

## Miscellaneous

You can use `elo:` to filter cards by their Elo rating.

Card search hides **extras** by default — tokens, emblems, art cards, planes/schemes, memorabilia,
digital-only cards, and Unknown Event cards. Add `include:extras` to your search (or check "Include
extras") to show them.

**Filters for individual cubes:** you can use `status:` to filter by cards with the given status.
Available options are "Not Owned", "Ordered", "Owned", "Premium Owned", "Proxied", and "Borrowed".

| Query                    | Matches                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `elo>1500`               | All cards with an Elo rating above 1500.                             |
| `status:"Premium Owned"` | All cards marked with the "Premium Owned" status.                    |
| `is:historic`            | All cards that are historic.                                         |
| `is:vanilla`             | All cards with no oracle text.                                       |
| `is:modal`               | All cards with modal options.                                        |
| `t:token include:extras` | Include extras (tokens, art cards, etc.) that are hidden by default. |

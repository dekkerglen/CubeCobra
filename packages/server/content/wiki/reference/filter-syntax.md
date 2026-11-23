---
title: Filter Syntax
description: Reference for the search syntax used throughout cube and card search.
order: 1
---

Cube Cobra's filter syntax is used across cube card lists, the card database, and advanced search.
Combine any number of conditions to find exactly the cards you want. Operators and conditions are
case-insensitive.

The syntax follows [Scryfall's](https://scryfall.com/docs/syntax), so most Scryfall searches work
here as they are. The differences are listed at the end of this page.

## General

You can combine any number of filters together using `AND` or `OR`. Operators are case-insensitive,
as are all filtering conditions (`TYPE:instant and o:DESTROY` will still work, for example).

| Query                    | Matches                                      |
| ------------------------ | -------------------------------------------- |
| `t:instant OR t:sorcery` | cards that are either instants or sorceries. |
| `t:instant t:tribal`     | cards that are both instants and tribal.     |

As on Scryfall, `AND` is applied before `OR`: `t:goblin or t:elf c:u` finds every goblin, plus blue
elves. Use parentheses to group differently: `(t:goblin or t:elf) c:u` finds blue goblins and blue
elves.

A condition that can't be used, such as a keyword we don't support (`frame:2015`) or a value we
don't recognize (`lang:xx`), is left out of the search and listed after the filter's description,
as on Scryfall. The rest of the filter still applies.

Text without a filtering condition is treated as a name. You can use quotes to require an exact
match, and `!` before a word or a quoted phrase to match the whole name (or one face's name).
Apostrophes don't matter, so `urzas` finds Urza's Saga.

| Query                           | Matches                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `goblin blood`                  | cards whose names contain both "blood" and "goblin".                          |
| `"goblin blood"`                | cards whose names contain exactly "goblin blood".                             |
| `!"opt"`                        | only the card named Opt, not Ornithopter or Panoptic Mirror.                  |
| `!opt`                          | the same thing; quotes are only needed for a name with spaces in it.          |
| `o:destroy o:target o:creature` | cards whose oracle text contains each of "destroy", "target", and "creature". |
| `o:"destroy target creature"`   | cards whose oracle text contains exactly "destroy target creature".           |

You can also use parentheses to combine clauses.

| Query                             | Matches                                           |
| --------------------------------- | ------------------------------------------------- |
| `t:creature o:flash`              | cards that are creatures with flash.              |
| `t:creature o:flash OR t:instant` | cards that are creatures with flash, or instants. |
| `t:creature (o:flash OR t:elf)`   | creatures with flash, and elf creatures.          |

You can put `-` before anything to negate it.

| Query         | Matches                                            |
| ------------- | -------------------------------------------------- |
| `-c:w`        | cards that are not white.                          |
| `-o:draw`     | cards which do not have draw in their oracle text. |
| `-t:creature` | cards which are not creatures.                     |
| `-mox`        | cards whose names do not include "mox".            |

Anywhere `is:` is used to match a card category, `has:` works as an equivalent alias
(`has:commander` is the same as `is:commander`).

## Color and Color Identity

You can find cards that are a certain color by using `c:` or `color:`, and cards with a certain
color identity by using `ci:`, `id:`, `identity:`, or `coloridentity:`.

Operators supported: `:`, `=`, `<`, `>`, `<=`, `>=`, `<>`, `!=`.

In addition to `w`, `u`, `b`, `r`, `g`, and `c` (colorless), you can use color words like `white`,
`blue`, `green`, etc. You can also use all guild, shard, wedge, and Strixhaven college names, like
`azorius`, `bant`, `abzan`, or `quandrix`, and the four-color names `chaos`, `aggression`,
`altruism`, `growth`, and `artifice`. `m` or `multicolor` means two or more colors. You can also
compare by number of colors by using numbers instead of color names.

Inside a cube, `c:` uses the color you've given each card, which starts out as the card's color
identity, so it can differ from the card's printed color.

Color Identity searches will respect any color identity overrides you have set while filtering in
your cube.

| Query        | Matches                                                                         |
| ------------ | ------------------------------------------------------------------------------- |
| `c=wubrg`    | cards that are all 5 colors.                                                    |
| `c:c`        | colorless cards.                                                                |
| `c:m`        | multicolored cards.                                                             |
| `c<esper`    | cards whose colors are a subset of Esper (UB, WB, WU, U, B, W, or colorless).   |
| `ci:wu`      | cards you can play with a white-blue commander (identity within white and blue). |
| `ci>azorius` | cards whose color identities contain white, blue, and at least one other color. |
| `ci>1`       | cards with more than 1 color in their identity.                                 |
| `ci<=3`      | cards with 3 or fewer colors in their identity.                                 |
| `ci:m`       | cards with more than 1 color in their identity.                                 |
| `ci!=m`      | cards with 1 or fewer colors in their identity.                                 |

## Card Types

You can search for card types with `t:` or `type:`.

Operators supported: `:`, `=`.

Search for any part of the typeline, i.e. `legendary` or `human`. Partial types are allowed, but a
complete type name matches only that type: `t:fish` finds Fish, not Jellyfish or Starfish.

| Query                    | Matches                                                 |
| ------------------------ | ------------------------------------------------------- |
| `type=legendary`         | cards that are legendary.                               |
| `t:legendary t:creature` | cards that are legendary creatures.                     |
| `t:legend`               | cards that are legendary.                               |
| `t:sha`                  | cards that are shamans, shapeshifters, or spellshapers. |
| `is:spell`               | cards that are spells.                                  |
| `is:permanent`           | cards that are permanents.                              |

## Card Text and Set

You can use `o:` or `oracle:` to search oracle text, `s:` or `set:` to search for a specific set
code, and `st:` or `settype:` to search by the type of set a printing comes from. Set types are
Scryfall's: `core`, `expansion`, `masters`, `eternal`, `commander`, `draft_innovation`, `funny`,
`box`, `promo`, and so on, with or without the underscore (`st:draftinnovation` works too).

Operators supported: `:`, `=`.

`o:` leaves out reminder text, as on Scryfall. Use `fo:` or `fulloracle:` to search the full text,
reminder text included. The set code can be either upper or lower case. `cn:` or `number:` finds a
collector number, and `cn>50` compares the number part.

| Query                     | Matches                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `o:"draw a card"`         | cards whose oracle text contains "draw a card".                        |
| `fo:"draw a card"`        | the same, but also cards that only say it in reminder text (cycling).  |
| `o:":"`                   | cards whose oracle text contains ":" (cards with activated abilities). |
| `s:war`                   | cards from War of the Spark.                                           |
| `st:core`                 | cards printed in a core set, such as Magic 2010 or Foundations.        |
| `st:core OR st:expansion` | cards printed in a core set or expansion.                              |
| `cn>50 s:war`             | War of the Spark cards numbered above 50.                              |

## Regular Expressions

Put a regular expression between slashes instead of quotes to search oracle text (`o:` or `fo:`), type
lines (`t:`) or names (`name:`) with one, as on Scryfall. Matching ignores case, and `^` and `$` match at
the start and end of each line of oracle text. In oracle text, `~` matches the card's own name.

Scryfall's shorthands work too: `\sm` for any mana symbol, `\sc` for any colored mana symbol, `\ss`
for any symbol, `\smh` for hybrid, `\smp` for Phyrexian, and `\spt`, `\spp`, `\smm` for X/X, +X/+X
and -X/-X.

Lookaheads, lookbehinds, backreferences and `\smr` aren't supported. A filter can use up to 5 regular
expressions, each up to 200 characters, with repeat counts like `{3}` up to 100.

| Query                                | Matches                                                    |
| ------------------------------------ | ---------------------------------------------------------- |
| `o:/^{T}: add/`                      | cards with a mana ability that only costs tapping.         |
| `o:/deals \d+ damage to any target/` | cards that deal a set amount of damage to any target.      |
| `t:/^legendary creature/`            | legendary creatures, but not legendary artifact creatures. |
| `name:/^[^ ]+$/`                     | cards with a one-word name.                                |

## Keywords

You can use `kw:`, `keyword:`, or `keywords:` to search for cards with specific keywords (e.g.
Flying, Trample, Deathtouch).

Operators supported: `:`, `=` for matching keyword text, and `=`, `<`, `>`, `<=`, `>=`, `!=`, `<>`
for comparing keyword count.

A keyword matches as a whole, as on Scryfall: `kw:flash` finds Flash but not Flashback. Quote
keywords with a space in them. A word that isn't a keyword ability, keyword action, or ability word
is left out of the search. Use numeric comparisons to filter by the number of keywords a card has.

| Query                 | Matches                                        |
| --------------------- | ---------------------------------------------- |
| `kw:flying`           | cards that have the Flying keyword.            |
| `keyword=trample`     | cards that have exactly the keyword "Trample". |
| `kw:"first strike"`   | cards with first strike.                       |
| `keywords>3`          | cards with more than 3 keywords.               |
| `keywords=0`          | cards with no keywords.                        |

## Approximate Word Count

You can use `words:`, `wc:`, or `wordcount:` to filter cards by the approximate number of words in
their oracle text (whitespace-split, so reminder text and face separators count).
Matches the "Approximate Word Count" sort and analytics stat.

Operators supported: `:`, `=`, `<`, `>`, `<=`, `>=`, `!=`, `<>`.

| Query           | Matches                                          |
| --------------- | ------------------------------------------------ |
| `words>10`      | cards with more than 10 words of oracle text.    |
| `wc<=45`        | cards with 45 or fewer words of oracle text.     |
| `wordcount=22`  | cards with exactly 22 words of oracle text.      |

## Scryfall Tags

CubeCobra imports the community-sourced tags from [Scryfall Tagger](https://tagger.scryfall.com/).
Oracle tags describe a card's function (`otag:`, `oracletag:`, `oracletags:`, `function:`) and are
shared by every printing of a card. Art tags describe a printing's illustration (`atag:`, `art:`,
`arttag:`, `arttags:`, `illustrationtag:`) and are specific to each artwork. Tags use Scryfall's slug form
(e.g. `removal`, `card-advantage`, `dragon`).

Operators supported: `:` for a partial (substring) match, `=` for an exact match, and `<`, `>`,
`<=`, `>=`, `!=`, `<>` (plus a numeric `=`) for comparing tag count.

Hyphens are ignored when matching, so you don't have to remember exactly where they fall in a
slug — `otag:boardwipe`, `otag:board-wipe`, and `oracletag=boardwipe` all match the `board-wipe`
tag.

| Query               | Matches                                                          |
| ------------------- | --------------------------------------------------------------- |
| `otag:removal`      | cards with an oracle tag containing "removal".                  |
| `otag=removal`      | cards whose oracle tag is exactly "removal".                    |
| `oracletag=ramp`    | cards whose oracle tag is exactly "ramp".                       |
| `otag:board-wipe`   | cards tagged `board-wipe` (also matches `otag:boardwipe`).      |
| `oracletags>2`      | cards with more than 2 oracle tags.                             |
| `atag:dragon`       | cards whose artwork has a tag containing "dragon".              |
| `arttag=goblin`     | cards whose artwork is tagged exactly "goblin".                 |

## Mana Costs

You can use `m:` or `mana:` to search for cards with specific mana costs.

Operators supported: `:`, `=`, `!=`, `<`, `<=`, `>`, `>=`.

Costs compare as they do on Scryfall: `m:` finds costs that contain at least the symbols you list
(the same as `>=`), and `=` finds costs that are exactly those symbols. Generic mana counts as an
amount, so `m:{2}` also finds {4}{W}. A cost is less than another when it has no more generic mana and
no more of each other symbol, and a card with no mana cost at all (lands, suspend-only cards) is less
than `{0}`. Split and adventure cards match if either half's cost does.

You can use plain numbers and letters for the 5 basic colors, snow, colorless, and x, y, and z
costs. For hybrid costs, you can use braces, i.e. `{2/G}`, `{R/G}`, `{C/W}`, etc. For phyrexian mana,
use `{W/P}`, and for Phyrexian hybrid `{G/W/P}`. You can also surround mana costs with braces if you
prefer, i.e. `{2}{G}{g}` instead of `2GG`. Either way is fine.

You can search for cards that require two or more colors with `is:gold`, cards that contain hybrid
symbols with `is:hybrid`, or Phyrexian mana symbols with `is:phyrexian`. As on Scryfall,
`is:hybrid` counts any hybrid symbol, `{2/W}` included, so a card like {R}{R/W}{W} is both gold and
hybrid, and `is:phyrexian` also counts Phyrexian symbols in a card's rules text.

`produces:` finds cards by the kinds of mana they can produce, with `c` for colorless.

| Query          | Matches                                                                      |
| -------------- | ---------------------------------------------------------------------------- |
| `m:{r/g}{r/g}` | cards with two or more hybrid red/green symbols, i.e. Burning-Tree Emissary. |
| `m:2ww`        | cards that cost at least 2 generic mana and 2 white mana.                    |
| `m=2ww`        | cards that cost exactly {2}{W}{W}.                                           |
| `m<={1}{R}`    | cards that cost {1}{R}, {R}, {1}, {0}, or nothing.                           |
| `m>{R}{R}`     | cards whose cost includes {R}{R} and more.                                   |
| `-m<{0}`       | cards that have a mana cost.                                                 |
| `is:gold`      | cards that require two or more colors.                                       |
| `is:hybrid`    | cards with one or more hybrid mana symbols.                                  |
| `is:phyrexian` | cards with one or more Phyrexian mana symbols.                               |
| `is:twobrid`   | cards with one or more "two generic or a color" symbols.                     |
| `produces=wu`  | cards that produce exactly white and blue mana.                              |

## Mana Value

You can use `mv:`, `cmc:`, or `manavalue:` to search for specific mana values, including halves
like `mv=0.5`, and `mv:even` or `mv:odd` for even or odd mana values.

Operators supported: `:`, `=`, `<`, `>`, `<=`, `>=`.

| Query     | Matches                               |
| --------- | ------------------------------------- |
| `mv>5`    | cards with mana value greater than 5. |
| `mv=3`    | cards with mana value of exactly 3.   |
| `mv:even` | cards with an even mana value.        |

## Power, Toughness, and Loyalty

You can use `pow:` or `power:` to search for cards with certain powers, `tou:` or `toughness:` for
toughness, `pt:` or `powtou:` for the two added together, and `loy:` or `loyalty:` for starting
loyalty. As on Scryfall, `*` counts as 0, so `pow=0` includes creatures like Tarmogoyf, and a card
without the stat never matches.

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

The rarities are `common`, `uncommon`, `rare`, `special`, `mythic`, and `bonus`, in that order.

| Query                | Matches                   |
| -------------------- | ------------------------- |
| `r:common`           | Common cards.             |
| `r<=uncommon`        | Common or uncommon cards. |
| `r:common or r:rare` | Common or rare cards.     |
| `r>=rare`            | Rare, special, mythic, and bonus cards. |

## Artist

You can use `a:` or `artist:` to search for cards illustrated by a specific artist, and `artists>1`
for cards with more than one artist. (`art:` searches art tags, as on Scryfall.) Also
`is:reprint`, `is:firstprint`, `is:promo`, `is:digital`, and `is:voucher`.

| Query              | Matches                                                    |
| ------------------ | ---------------------------------------------------------- |
| `a:"seb mckinnon"` | All cards illustrated by Seb McKinnon.                     |
| `a:reb`            | All cards illustrated by artists with "reb" in their name. |
| `artists>1`        | All cards illustrated by more than one artist.             |
| `is:firstprint`    | All first printings of cards.                              |

## Devotion

You can use `d:`, `dev:`, or `devotion:` to find permanents by the devotion they provide, as on
Scryfall: repeat one color's symbol for devotion to that color, or a hybrid symbol for devotion to
both its colors. `:` means at least that much and `=` means exactly. You can also append a color to
the query to use numbers instead, like `dw:` or `devotiontow:`.

| Query                      | Matches                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `d:www`                    | permanents with 3 or more white devotion.                     |
| `devotion={w}{w}{w}`       | permanents with exactly 3 white devotion.                     |
| `devotion:{u/b}{u/b}{u/b}` | permanents with 3 or more devotion to blue and black.         |
| `devotiontor>2`            | permanents with more than 2 devotion to red.                  |

## Price

You can use `price:` (or `usd:`), `priceNormal:`, `priceFoil:`, `priceEur:` (or `eur:`), or
`priceTix:` (or `tix:`) to filter cards by price. When filtering in individual cubes, `price:` uses the printing specified for the cube.
`priceEur:` uses the nonfoil Card Market prices. `priceTix:` uses MTGO TIX prices.

| Query                            | Matches                                                               |
| -------------------------------- | --------------------------------------------------------------------- |
| `price>10.5`                     | All cards in a cube whose specified printing has a price over $10.50. |
| `priceFoil<10 OR priceNormal<10` | All cards with a price under $10.                                     |

## Tags

You can use `tag:` or `tags:` to filter cards by tag or tag count when in a cube.

`:` is a partial (substring) match and `=` is an exact match, both case insensitive — `tag:Signed`
matches "Signed", "Unsigned", and "Redesigned", while `tag=Signed` matches only "Signed". Numeric
operands instead compare the number of tags.

| Query                   | Matches                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `tag:Signed`            | All cards in a cube with a tag containing "Signed" (e.g. "Signed", "Unsigned", "Redesigned").               |
| `tag=Signed`            | All cards in a cube whose tag is exactly "Signed".                                                          |
| `tag:Signed Blood`      | A combination of tag and name: cards with a tag containing "Signed" and whose name contains "Blood".       |
| `tag:"Signed"`          | A quoted value after `:` is exact — cards whose tag is exactly "Signed".                                    |
| `tag='Counter Synergy'` | All cards in a cube whose tag is exactly "Counter Synergy". Quote tags that contain spaces.                 |
| `tags=0`                | All cards with no tags.                                                                                     |
| `tags>0`                | All cards with at least one tag.                                                                            |
| `tag="3"`               | All cards whose tag is exactly "3" (quote a numeric tag; unquoted `tags=3` means the tag count).           |

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

You can use `f:`, `format:`, `leg:`, `legal:`, or `legality:` to filter cards by legality. Also
`banned:`, `ban:`, or `restricted:` to check inversely. The format name can also be double-quoted.
The formats are Standard, Pioneer, Modern, Legacy, Vintage, Brawl, Historic, Pauper, Penny,
Commander, Timeless, and Premodern.

`is:commander` finds cards that can be your commander: legendary creatures, legendary Vehicles and
Spacecraft with power and toughness, and cards that say they can be your commander, unless they're
banned in Commander. `is:brawler` does the same for Brawl and also includes legendary
planeswalkers. `is:partner` finds every kind of partner (Partner, Partner with, Friends forever,
Choose a Background, Doctor's companion) and the Backgrounds and Doctors they pair with, and
`is:companion` finds companions.

`game:` checks whether a printing is available in paper, on Arena, or on MTGO, and `in:` whether any
printing of the card is.

| Query                  | Matches                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `leg:Modern`           | All cards that are legal in Modern.                                                        |
| `-leg:Standard`        | All cards that are not legal in Standard.                                                  |
| `banned:Modern`        | All cards that are banned in Modern.                                                       |
| `restricted:"Vintage"` | All cards that are restricted in Vintage (the only format with restrictions currently).    |
| `f:pauper`             | All cards that are legal in Pauper.                                                        |
| `is:commander`         | All cards that can be your commander.                                                      |
| `is:reserved`          | All cards that are on the reserved list.                                                   |
| `game:arena`           | Printings available on Arena (also `game:is-arena`).                                       |
| `in:arena`             | All cards that have any version available on Arena.                                        |
| `-in:mtgo`             | All cards that have no version available on MTGO.                                          |

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

Additionally, you can use `is:dfc`, `is:mdfc`, `is:tdfc`, `is:meld`, `is:meldpart`, `is:meldresult`,
`is:transform`, `is:leveler`, `is:split`, `is:flip`, `is:adventure`, `is:omen`, and `is:prepared`.

## Border, Frame, Foil & Resolution

**Filters for individual cubes:** you can use `finish:` to filter by cards with the given finish.
Available options are "Non-foil", "Foil", "Etched", and "Alt-foil".

| Query                | Matches                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `finish:non-foil`    | All cards with the non-foil finish selected.                                                  |
| `is:foil`            | In a cube, cards with the Foil finish selected. Also `is:nonfoil`, `is:etched`, `is:altfoil`. |
| `is:glossy`          | Printings available glossy.                                                                   |
| `border:white`       | Printings with a white border. Also `black`, `silver`, `gold`, `yellow`, and `borderless`.    |
| `is:fullart`         | All cards with full extended art. Also `is:full`.                                             |
| `is:default`         | Printings in the standard frame, without borderless, full-art, or other special treatments.   |
| `is:atypical`        | Printings with one of those treatments, or a promo.                                           |
| `is:defaultprinting` | The printing Cube Cobra shows for a card by default.                                          |
| `is:universesbeyond` | All cards that are Universes Beyond. Also works with `is:ub`.                                 |
| `is:standard`        | All cards that were printed in a core set or expansion.                                       |
| `is:supplemental`    | All cards that were only printed in supplemental products (never in a core set or expansion). |
| `is:prerelease`      | Prerelease promos. Every Scryfall promo type works, such as `is:datestamped`, `is:judge_gift`, `is:fnm`, or `is:boosterfun`. |
| `is:masterpiece`     | Masterpiece Series printings.                                                                 |
| `is:alchemy`         | Alchemy cards. `is:rebalanced` finds the rebalanced versions.                                 |
| `is:funny`           | Un-cards, holiday cards, and other funny cards that aren't legal in any format.               |

## Cube Customizations

These filters match on how a card has been customized inside your cube, rather than on anything
about the printed card. As with every `is:` filter, `has:` is an equivalent alias and both `-is:`
and `not:` invert the match.

| Query              | Matches                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| `is:custom`        | [Custom cards](/wiki/special-cards). Vouchers are matched by `is:voucher`; use `is:custom or is:voucher` for both. |
| `is:override`      | Cards with at least one attribute changed from the printed card. Also `is:overridden`. |
| `is:image`         | Cards with a custom image on either face.                                          |
| `is:imageUrl`      | Cards with a custom front image.                                                   |
| `is:imageBackUrl`  | Cards with a custom back image.                                                    |

`is:override` matches when any of a card's colors, color category, mana value, type line, rarity,
or either custom image differs from its printing. A renamed card does not count on its own, since
renaming does not change how the card plays. Custom cards and vouchers are never matched: those
attributes are the only data such a card has, so every one of them would otherwise match.

The image filters match custom images anywhere, including on custom cards, so negating one is a
quick way to find cards still waiting for art:

| Query                        | Matches                                              |
| ---------------------------- | ---------------------------------------------------- |
| `-has:image`                 | Cards that have no custom image yet.                 |
| `is:custom -has:image`       | Custom cards still needing art.                      |
| `is:override -has:image`     | Cards customized in some way other than their image. |

> **Note:** these filters read the customizations themselves, so they find nothing while the
> **Use Base Card Data** display option is turned on. That option deliberately hides every
> customization and shows cards as printed, which leaves `is:override` and the image filters with
> nothing to match.

## Shortcuts and Nicknames

Land groups — each `is:` shortcut matches a well-known land cycle.

| Primary           | Alternatives                       |
| ----------------- | ---------------------------------- |
| `is:bikeland`     | `is:cycleland` or `is:bicycleland` |
| `is:bondland`     | `is:crowdland`, `is:battlebondland`, or `is:bbdland` |
| `is:bounceland`   | `is:karoo`                         |
| `is:canopyland`   | `is:canland`                       |
| `is:fetchland`    |                                    |
| `is:checkland`    |                                    |
| `is:dual`         |                                    |
| `is:fastland`     |                                    |
| `is:filterland`   |                                    |
| `is:gainland`     |                                    |
| `is:painland`     |                                    |
| `is:pathway`      |                                    |
| `is:scryland`     |                                    |
| `is:shadowland`   | `is:snarl`                         |
| `is:shockland`    |                                    |
| `is:slowland`     |                                    |
| `is:storageland`  |                                    |
| `is:creatureland` | `is:manland`                       |
| `is:triland`      |                                    |
| `is:triome`       | `is:tricycleland` or `is:trikeland` |
| `is:tangoland`    |                                    |
| `is:battleland`   |                                    |
| `is:surveilland`  |                                    |

## Year and Release Date

You can use `year:` to search by the year a printing was released, as on Scryfall, so a card matches
if any of its printings does. Use `firstyear:` or `fy:` for the year a card was first printed, and
`date:` to compare release dates, written as `2015-08-18`, `2015-08`, `2015`, or `now`.

Operators supported: `:`, `=`, `<`, `>`, `<=`, `>=`.

| Query                             | Matches                                       |
| --------------------------------- | --------------------------------------------- |
| `year=2024`                       | cards printed or reprinted in 2024.           |
| `firstyear>2020`                  | cards first printed after 2020.               |
| `fy=1993`                         | cards first printed in 1993 (Alpha/Beta era). |
| `firstyear>=2015 firstyear<=2020` | cards first printed between 2015 and 2020.    |
| `date>=2015-08-18`                | cards printed on or after August 18, 2015.    |

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

You can use `elo:` to filter cards by their Elo rating, `picks:` to filter by how many times a card
has been drafted, `cubes:` to filter by how many cubes play it, and `pop:` to filter by the
percentage of cubes that play it.

Card search hides **extras** by default, as Scryfall does: tokens, emblems, art cards, planes and
schemes, memorabilia, playtest cards, rebalanced Alchemy cards, Heroes of the Realm and holiday
promos, and the cards removed from Magic in 2020. Add `include:extras` to your search (or check
"Include extras") to show them. Searching a set with `set:`, or a search that otherwise finds
nothing, shows them too, and `is:funny` includes the funny ones. Digital-only cards are shown.

In card search you can also choose how results are shown from the filter, as on Scryfall:
`unique:prints` (or `++`) lists every printing, `unique:cards` one per card, `order:` sorts by
`name`, `cmc`, `usd`, `edhrec`, or `released`, `direction:asc` or `direction:desc` sets the order,
and `prefer:oldest`, `prefer:newest`, `prefer:usd-low`, or `prefer:default` picks which printing
each card shows. These take precedence over the controls on the page.

`lang:` finds printings in a language, such as `lang:japanese` or `lang:ja`. Cube Cobra only has
printings in other languages for cards that were never printed in English.

**Filters for individual cubes:** you can use `status:` to filter by cards with the given status.
Available options are "Not Owned", "Ordered", "Owned", "Premium Owned", "Proxied", and "Borrowed".

| Query                    | Matches                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `elo>1500`               | All cards with an Elo rating above 1500.                             |
| `picks>=100`             | All cards drafted at least 100 times.                                |
| `cubes>=1000`            | All cards played in at least 1,000 cubes.                            |
| `pop>=10`                | All cards played in at least 10% of cubes.                           |
| `status:"Premium Owned"` | All cards marked with the "Premium Owned" status.                    |
| `is:historic`            | All cards that are historic.                                         |
| `is:vanilla`             | All creatures with no rules text.                                    |
| `is:frenchvanilla`       | All creatures whose rules text is only keywords.                     |
| `is:bear`                | All 2/2 creatures with mana value 2.                                 |
| `is:party`               | All Clerics, Rogues, Warriors, and Wizards (and changelings).        |
| `is:outlaw`              | All Assassins, Mercenaries, Pirates, Rogues, and Warlocks.           |
| `is:modal`               | All cards with modes: choose one (or more), Spree, or pawprints.     |
| `t:token include:extras` | Include extras (tokens, art cards, etc.) that are hidden by default. |

## Copies in Board

**Filters for individual cubes:** you can use `quantity:`, `count:`, or `copies:` to filter by how
many copies of a card exist in the same board. Copies are counted by oracle identity, so two
differently-named printings of the same card count as copies of each other. Cards without an oracle
ID — custom cards and vouchers — are counted by name instead. Cards staged for removal are not
counted, and a staged card reports a single copy of itself — so with `not:singleton` active,
staging a duplicate removal clears the view, because the copies left behind drop to one as well.
`is:singleton` and `not:singleton` are convenience aliases for `quantity=1` and `quantity>1`.

Because custom cards and vouchers are counted here but skipped by the cube list's **Cleanup**
button, `not:singleton` is not a reliable preview of what **Remove Duplicates** will stage on a
board holding them — it will list repeated custom cards that Cleanup leaves alone. The count on the
Remove Duplicates button is always exact.

Outside a cube list (global card search, Smart Search, etc.) every card is treated as one copy, so
`quantity>1` returns nothing and `is:singleton` matches everything.

Operators supported: `:`, `=`, `<`, `>`, `<=`, `>=`, `!=`, `<>`.

| Query           | Matches                                                        |
| --------------- | -------------------------------------------------------------- |
| `quantity>1`    | cards with more than one copy in the same board.               |
| `count=2`       | cards with exactly two copies in the same board.               |
| `copies<3`      | cards with one or two copies in the same board.                |
| `is:singleton`  | cards that appear only once in the board.                      |
| `not:singleton` | cards that appear multiple times in the board.                 |

## Differences from Scryfall

Cube Cobra follows Scryfall's syntax, with these differences:

- **Foil filters in card search.** `is:foil`, `is:nonfoil`, `is:etched`, and `is:altfoil` are about
  the finish chosen for a card in your cube. Outside a cube every card counts as non-foil, so
  `is:foil` finds nothing in card search, where Scryfall finds printings available in foil. In the
  same way, `price:` in a cube uses the price of the card's chosen finish.
- **Double-faced cards.** Type, color, mana cost, power, toughness, and loyalty come from the front
  face, where Scryfall checks each face. `t:land is:mdfc` finds modal double-faced cards whose front
  is a land, but not ones with a land on the back. Adventure cards use the creature's type line.
- **Card data we don't have.** Conditions that need data Cube Cobra doesn't store are left out of
  the search: flavor text (`ft:`), watermarks (`wm:`), frames and security stamps (`frame:`,
  `is:new`, `stamp:`, `is:hires`, `is:colorshifted`), blocks and set groups (`b:`, `g:`), print
  history (`in:` a set or rarity, `new:`, `prints=`, `sets=`, `is:unique`, `illustrations>1`),
  `cheapest:`, `is:booster`, `is:spotlight`, `is:gamechanger`, `has:indicator`, Scryfall's cube
  lists (`cube:`), and formats other than the ones listed under Legality.
- **Dates.** `date:` takes a date, not a set code.
- **Display.** `display:` and `unique:art` (`@@`) aren't supported.
- **Regular expressions.** Lookaheads, lookbehinds, and backreferences aren't supported.
- **Approximations.** `is:default`, `is:atypical`, and `is:frenchvanilla` are worked out from the
  data Cube Cobra has, so a few cards differ from Scryfall. `is:full` uses each printing's full-art
  flag and finds more cards than Scryfall does.
- **Cube Cobra's own filters**, such as `tag:`, `status:`, `cc:`, `cw:`, or `elo:`, don't exist on
  Scryfall.

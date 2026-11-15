---
title: Card Database Updates
description: How card data, prices, and statistics stay current, and how to read the status page.
order: 11
---

Cube Cobra's card data comes from [Scryfall](https://scryfall.com), and the site layers its own
statistics on top: Elo, pick counts, play rates, and the lists of cards that go together. Each of
these refreshes on its own schedule. The [Card Updates](/help/cardupdates) page, linked from the
Help sidebar and the site footer, shows when each one last finished.

## What updates, and how often

### Card data and prices

Scryfall publishes a fresh export of its card database about once a day, and Cube Cobra checks for
one every few minutes and imports it as soon as it appears. An import brings
in everything Scryfall knows about every printing: names, types, mana costs, oracle text,
legalities, sets, and images, along with the oracle tags, art tags, and EDHREC ranks that
[filter syntax](/wiki/reference/filter-syntax) can search on.

Prices refresh with every import: TCGPlayer (regular, foil, and etched), Cardmarket, Cardhoarder,
Card Kingdom, and Mana Pool. Once an import finishes, the site switches over to the new data within
about half an hour.

### Card statistics

Once a week, Cube Cobra works through the cubes and recorded drafts across the site and recomputes:

- each card's Elo and pick count, from draft picks;
- its play rate and cube count, from how many cubes run it;
- the **Often Drafted With**, **Often Cubed With**, and **Synergistic Cards** lists on
  [card pages](/wiki/search#card-pages);
- the week-by-week Elo and play rate history graphs on card pages;
- combos, imported fresh from [Commander Spellbook](https://commanderspellbook.com/), which feed
  card pages and a cube's [Combos analysis](/wiki/cube-page/analysis#combos).

Most of the new numbers reach search results and card pages with the first card data import after
the weekly run finishes.

### Data export

Every three months, Cube Cobra publishes a free export of the site's public data: cube lists, draft
picks, decks, and card definitions, as JSON files. The [Data Exports Guide](/tool/exports) explains
how to download it and how the files fit together.

### Card migrations

Now and then Scryfall cleans up its own database: it merges a duplicate entry into the printing it
duplicates, or deletes an entry that shouldn't exist. Scryfall publishes each of these as a
migration. Cube Cobra watches for new ones and applies them to every cube automatically, as
described [below](#what-a-migration-means-for-your-cube).

## Reading the status page

The status page has four panels, one for each process above. Each panel shows the most recent run
that finished successfully; a run still in progress, or one that failed, isn't shown. If no recent
run has succeeded, the panel says so instead of showing numbers.

**Card Database Update**

- **Last Update** is the day the most recent import finished.
- **Scryfall Date** is the day Scryfall published the data that import used. A card Scryfall added
  after this date isn't on Cube Cobra yet.
- **Total Cards** counts every printing in the database, not unique card names, so it runs far
  higher than the number of distinct Magic cards.
- **Cards Added** is how many more printings the database holds than after the previous import.
  It's a net figure that never goes below zero, so it reads +0 when Scryfall changed only prices
  or card details.

**Card Metadata & Correlations**

- **Last Update** is the day the weekly statistics run finished.
- **Update Frequency** always reads Weekly.

**Data Export**

- **Last Export** is the day the latest export finished. **View Data Exports Guide** opens the
  guide.

**Card Migrations**

- **Last Migration** is the day Cube Cobra last applied a batch of Scryfall migrations. A batch
  only runs when Scryfall has published new migrations, so an old date here is normal.
- **Cubes Affected**, **Cards Deleted**, and **Cards Merged** describe that batch alone, not
  running totals. Cards are counted per cube: a merged printing that sat in 40 cubes adds 40 to
  **Cards Merged**.

## When a new set comes out

A new card works its way through the site in three stages:

1. **It becomes searchable and addable.** As soon as Scryfall's data includes the card, the next
   import picks it up, and the site serves it within about half an hour of that import finishing.
   From then on it shows up in card search and autocomplete, has its own card page, and can be
   added to cubes. If a card you expect is missing, compare its arrival on Scryfall with the
   **Scryfall Date** on the status page.
2. **It gets statistics.** Until the first weekly run after it arrives, a new card shows the
   starting Elo of 1200, no picks, no play rate, and empty **Often Drafted With** and **Often Cubed
   With** lists. After that run the numbers reflect real cubes and drafts, and they keep updating
   weekly. Elo only moves once people draft the card, and the card stays out of **Top Cards** until
   it has 100 recorded picks.
3. **The bots learn it.** The draft bots and card recommendations run on a machine-learning model,
   and the model only rates cards it was trained on. A card released since the most recent
   training run gets no rating of its own until the model is retrained. See
   [Machine Learning](/wiki/machine-learning) for how that works.

## What a migration means for your cube

Migrations change cubes directly, without anyone editing them:

- **Merged** entries: every copy of the duplicate, in any board, is switched to the printing
  Scryfall kept. Only the printing changes; the card's tags, notes, status, finish, and other cube
  details stay as they were.
- **Deleted** entries: every copy is removed from the cube, whichever board it was in. Nothing
  replaces it.

Neither shows up in the cube's [changelog](/wiki/cube-page/about#changelog), and no blog post is
written. If a card disappears from your list with no changelog entry to explain it, check the
**Card Migrations** panel for a recent date, then add the card again in a printing that still
exists.

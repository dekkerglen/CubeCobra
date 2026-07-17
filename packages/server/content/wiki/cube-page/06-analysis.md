---
title: Analysis
description: Charts, tables, and tools for understanding a cube's composition, prices, and draft behavior.
order: 6
---

The Analysis tab turns the cube into numbers. Its eleven views cover composition (curve, colors,
types), card quality signals (Elo, popularity), draft behavior, tokens, keywords, combos, and
prices.

A filter bar at the top applies to nearly every view, using the same
[filter syntax](/wiki/reference/filter-syntax) as the list page. Filter to `o:destroy ci:b` and the
averages, tables, and charts below recompute for exactly those cards, which makes quick work of
questions like "what does my black removal curve look like?" All views work from the mainboard.

## At a Glance

The overview dashboard. Headline counts show unique cards, lands, creatures, token-makers,
Universes Beyond cards, and supplemental-product cards, each with its share of the cube. Summary
statistics cover average mana value (lands excluded), average card Elo, average popularity across
all cubes on the site, average and median release year, average rules-text word count, and the
number of distinct keywords.

Below those, a set of charts: the mana curve stacked by color, release years, and donuts for color
distribution, card types, rarities, and format legality (each card counted at the lowest format
that allows it), plus histograms of Elo, word count, popularity, and price.

If the owner has price visibility enabled, a purchase section shows two totals: the cheapest
possible cost of the list across all printings, and the cost of the specific printings the cube
uses. Links below them buy the list in bulk from TCGplayer, Mana Pool, or Card Kingdom.

## Smart Search

Smart Search is the card recommender. Type a filter and it returns cards that are *not* in the
cube, ranked by how well the machine-learning model thinks they fit. The model is the same one
that powers the draft bots, trained on the contents of cubes across the site. Search
`t:creature mv=2 ci:g` while looking for a green two-drop and the results are ordered by fit for
this specific cube, not by generic card quality. Clicking a result opens a dialog to add it to any
of your cubes.

## Averages

A statistics table for any numeric characteristic (mana value, power, toughness, Elo, price in
several currencies, pick rate, mainboard rate, or devotion to each color), grouped by any sort.
Each group shows its average, median, standard deviation, count, and sum. Grouping price by color
identity, for example, shows exactly which slice of the color pie the budget is going to.

## Table

A cross-tabulation: pick one sort for the columns and another for the rows, and each cell counts
the cards at that intersection, with totals along both edges. Cells can display percentages of the
whole cube, of their row, or of their column. Color identity against type is the classic use,
checking that every color has its share of creatures and removal, but any two sorts work.

## Asfans

Asfan is the expected number of copies of something a single player sees across all the packs they
open in a draft. It matters once packs stop being uniformly random: with a custom draft format that
seeds certain slots, raw card counts mislead, and asfans tell the truth about what drafters
actually encounter. Pick a draft format and a grouping, and this view computes the expected count
per group. If red creatures have an asfan of 2, each drafter opens two of them on average across
the whole draft.

## Chart

A configurable stacked bar chart: choose the characteristic for the horizontal axis (mana value,
Elo, and so on) and a sort to stack by, and read the distribution. Group by "Unsorted" for plain,
unstacked bars.

The Averages, Table, and Chart views can all weight their numbers by asfan instead of raw counts:
tick "Use Asfans" and choose a draft format. That way every one of these analyses can answer
either "what's in the cube" or "what do drafters see."

## Playtest Data

This view analyzes the cube's actual draft history. Click **Run Analysis** and it downloads every
human draft of the cube (up to the most recent five thousand) and processes them in your browser,
producing:

- deck-shape summaries across all drafted decks: colors, card types, curves, and Elo spread;
- an archetype map, with every deck clustered by similarity and plotted in two dimensions, and a
  detail panel per cluster showing its decks, curves, and color profiles;
- a per-card statistics table: how often each card is seen, picked, its pick rate, average pick
  position, how often it wheels, how often it's taken pack one pick one, and how many decks it
  ends up in.

Analysis runs are saved locally, so you can re-run after a big update and compare against the
previous run. The first run downloads the analysis model, which is large; later runs reuse it.

## Tokens

Every token the cube's cards create, each shown with its image and the list of cards that make it.
Buttons copy the token list to the clipboard, download it as CSV, or open it as a bulk purchase at
TCGplayer or Mana Pool: everything needed to assemble the token box that matches the cube.

## Keywords

A tour of the cube's mechanical texture. Headline numbers count unique keywords, total keyword
instances, and the share of cards carrying at least one keyword. A keyword cloud sizes each
mechanic by frequency and colors it by the color that uses it most; hovering shows its reminder
text. Below that, a stacked chart of the top keywords by color, a wheel of mechanical color weight,
and a density table showing, for each keyword, how many (or what fraction) of each color's cards
carry it. A reference grid at the bottom lists every keyword with its reminder text and the cards
that have it.

## Combos

Card combinations in the cube, drawn from the Commander Spellbook database. Each entry shows the
cards involved (with images), the required starting state, step-by-step instructions, and what the
combo produces: infinite mana, infinite damage, and the rest. A dropdown filters combos by their
result, and each entry links to its Commander Spellbook page. If a combo you know about is
missing, Spellbook accepts submissions.

## Prices

The financial picture, built from the printings and finishes assigned in the cube and the
ownership status set on each card. Headline figures show the cube's total value, the value of what
you've marked as owned, the cost to buy everything still marked Not Owned, Proxied, or Borrowed,
and the cost to upgrade every non-foil card to foil. Detail tables break value down by ownership
and by finish, and name the most expensive card; charts show card counts and value by status and
finish. Keeping card statuses current on the [list page](/wiki/cube-page/list) is what makes this
view accurate.

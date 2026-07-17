---
title: Search
description: Finding cubes, cards, and sets across the site.
order: 4
---

The **Explore** menu in the top navigation is the front door to everything searchable: cubes,
cards, sets, and [packages](/wiki/packages). Cube search and card search are separate tools with
separate query languages, so this page covers each in turn.

## Finding cubes

Cube search lives at [cubecobra.com/search](/search). The Explore menu offers three entry points
into the same page: **Popular Cubes** (sorted by popularity), **Recently Updated** (sorted by last
update), and **Search Cubes**.

The search box accepts plain keywords and a handful of field queries, which can be combined
freely:

- Plain words match cube names. `vintage powered` finds cubes with both words in the name.
- `card:"Black Lotus"` finds cubes that include the card, in whatever printing. Use quotes for
  multi-word names.
- `tag:budget` finds cubes carrying a tag.
- `category:Modern` finds cubes by category or category prefix, like `category:Pauper` or
  `category:Powered`.
- `size=360`, `size>450`, and `size<180` filter by card count. `cards=360` works the same way.

A single search can combine up to ten terms, and a question-mark icon next to the box opens the
full syntax reference. Below the box, the page spells out how it interpreted your query.

Results come 36 to a page, sorted by popularity, alphabetically, by card count, or by last update,
in either direction. Each result shows the cube's image, name, category badges, like count, card
count, and owner.

## Finding cards

Card search lives at [cubecobra.com/tool/searchcards](/tool/searchcards), under **Search Cards** in
the Explore menu. Its query language is the full Cube Cobra
[filter syntax](/wiki/reference/filter-syntax), the same one used on cube lists, so everything from
`t:creature mv<=2 ci:wu` to `is:fetchland year>=2020` works here. An advanced-filter form builds
the query for you if you'd rather fill in fields.

Two view modes are available:

- The default view is a grid of card images.
- The rows view is a table listing each card's mana cost, type, Elo, total picks, and the number
  of cubes playing it.

Results are sorted by Elo unless you pick another order (name, mana value, price, release date,
and the rest), 96 to a page. A distinct toggle switches between one row per card name and one row
per printing, an extras toggle brings in tokens and other oddities, and an export button downloads
every matching card as a CSV, not just the visible page.

**Top Cards** in the Explore menu is a preset of the same page: the rows view, filtered to cards
with at least 100 recorded picks, sorted by Elo. It's the quickest answer to "what does the
community actually draft?"

## Sets

**Sets** in the Explore menu lists every Magic set, with its symbol, code, card count, type, and
release date. Promo, token, and commander subsets nest under their parent set, the list can be
searched by name or code, and sorting works by release date, name, or card count. Clicking a set
opens card search filtered to that set, ordered by collector number, one entry per printing.

## Card pages

Every card links to its own page at `/tool/card`, from search results, cube lists, and anywhere
else a card name appears. A card page collects everything Cube Cobra knows about the card:

- the card itself, with its oracle text, set, and every printing to flip through;
- current prices and purchase links;
- history graphs of the card's Elo rating and play rate, week by week over the past year;
- lists of the cards it's most often drafted alongside, most often played in cubes with, and the
  cards the site's model rates as most synergistic with it, each split into creatures, spells,
  and other.

Elo on Cube Cobra comes from draft picks: when a drafter takes one card over another, the chosen
card gains rating and the passed card loses some. Play rate is the share of cubes that include the
card. Together with the pick counts on the search pages, these are the site's core signals for how
the community values a card.

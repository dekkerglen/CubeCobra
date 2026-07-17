---
title: Records
description: Logging real draft nights, with decklists, match results, trophies, and win-rate analytics.
order: 5
---

The Records tab is for paper play. A record documents one draft event: who sat down, what they
built, how the matches went, and who took the trophy. Log your draft nights here and the cube
accumulates a real match history, which the Winrate Analytics view then turns into card and
archetype win rates.

The tab has two views, Draft Reports and Winrate Analytics. Anyone who can see the cube can read
both; creating and editing records is for the cube's owner.

## Creating a record

Three buttons at the top of the tab (owner only) start a record in different ways:

- **New Record** creates one immediately, named after today's date, ready to fill in.
- **Create from Draft** builds a record from a draft already run on Cube Cobra: pick one from the
  list and the record inherits its date and players, with each player's drafted deck already
  attached. If your pod drafts through the site or Draftmancer and then plays in paper, this is
  the shortest path.
- **Import from Hedron Network** ingests a JSON export from Hedron Network, tournament software
  built specifically for cube events. Event name, date, players, and complete match results come
  across in one paste.

A record's own page holds everything else. The owner can edit the name, date, and description
(Markdown, so a writeup with card links works fine), and manage the player list. Players are added
by name, or by `@username` to link them to their Cube Cobra account, and can be reordered by
dragging. Every record page also has a comment section.

## Decklists

Each player in a record can have a deck attached. There are two ways to get them in:

- **The owner uploads them.** The upload form takes a deck one card at a time with autocomplete, or
  as a pasted decklist (quantities like `2x Path to Exile` are understood). By default the
  autocomplete sticks to cards in the cube; a checkbox opens it up for off-cube cards like
  unexpected basics or substitutions.
- **Players submit their own.** The **Share link to collect decks** button generates a link the
  owner can drop in the group chat. Anyone who opens it, no account needed, picks their name from
  the player list (or adds themselves), enters their deck, and can report their own win-loss-draw
  record while they're at it.

Attached decks appear on the record's Decks tab, one per player, in the same deck view used
elsewhere on the site. From there a deck can be opened in the deckbuilder for corrections, dealt as
sample hands, or cloned and rebuilt.

## Matches, standings, and trophies

The Matches tab records results round by round. Adding a round creates a set of match slots; for
each one the owner picks the two players and enters games won, lost, and drawn. Rounds can be
edited or removed later, and there's a lighter edit mode that only touches the results while
keeping the pairings.

The Standings tab computes each player's overall win-loss-draw from the entered matches and sorts
the table by performance. When full match entry is more bookkeeping than the night deserves, the
owner can instead set a player's record directly, and that override takes precedence over whatever
the match math would say.

Trophies mark the winners. The **Assign Trophies** control checks off any number of players, and
they get a trophy icon in the standings. Trophy-winning decks are also collected in the trophy
archive inside Winrate Analytics, so the cube builds up a hall of fame over time.

## Winrate Analytics

The Winrate Analytics view crunches every record with decks and match results into cube-level
statistics, computed in your browser from the cube's full record history:

- **Card performance** covers every card that has appeared in a recorded deck: how many decks
  played it, how many matches those decks played, its match win rate, and how many trophies it
  contributed to. Low-sample cards are smoothed rather than shown as misleading 0% or 100% rates.
- **Win-rate distribution** is a histogram of card win rates across the cube.
- **Color breakdown** shows how each color and color pair performs relative to the cube's
  baseline.
- **Archetype map** clusters decks by similarity and plots them on a two-dimensional map, colored
  by cluster or by deck colors. Clicking a cluster isolates its decks and their shared traits, so
  you can see which archetypes actually win.
- **Trophy archive** collects every trophy-winning deck across all records, with links to the
  player, the record, and the deck itself.

The more of your draft nights you log, the more these numbers mean. A cube with a season of records
behind it can answer questions no amount of theorycrafting can: whether the aggro deck actually
wins, or just feels like it does.

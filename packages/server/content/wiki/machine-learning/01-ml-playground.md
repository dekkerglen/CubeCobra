---
title: ML Playground
description: Try Smart Search, the draft bot, the deckbuilder, and archetypes on any card list.
order: 1
---

The ML Playground puts Cube Cobra's [machine-learning model](/wiki/machine-learning) in your hands
without needing a cube or a draft. Open it from **ML Playground** in the **Explore** menu, or go to
`/tool/mlplayground`. Paste a card list, and each of the five tabs runs one part of the model on it:

- **Smart Search** ranks cards by how well they'd fit the list, and the list's own cards by how
  poorly they fit.
- **Draft Pick** shows how a draft bot rates a pack, given the cards it already holds.
- **Deckbuild** builds the deck a bot would build from a pool.
- **Archetype** names the archetypes a list supports and compares two lists.
- **Grow** builds a list up from a seed, a few best-fitting cards at a time.

No account is needed for any of it. Each tab has its own address (`?tab=draft`, `?tab=grow`, and so
on), and whatever you type into a tab is kept in your browser, so it's still there when you come
back.

## Pasting card lists

Every list field takes one card per line, in the shapes most decklist exports use:

- `Lightning Bolt`, `4 Lightning Bolt`, or `4x Lightning Bolt`;
- a set code in brackets or parentheses picks a printing, optionally with a collector number:
  `Plains [M20] 261`, `Lightning Bolt (2XM)`.

Section headers such as `Deck`, `Sideboard`, or `Commander`, and lines starting with `//` or `#`,
are skipped, so a list copied from a deckbuilding site usually pastes as is. Only the header line
is skipped, though: cards listed under a `Sideboard` header are still read as part of the list.
Without a set code, a name shows in the printing set by **Default Printing** in your
[account settings](/wiki/account-settings#display-preferences).

The count beside each field's label updates as you type, and the X next to it clears the field. A
list can be up to 2,000 lines and 200,000 characters long.

### What the model saw

After a run, each list gets a summary line with its card count and up to three markers, each
showing how many cards it covers. Click one to list them:

- **Not found** lists lines that didn't match any card.
- **Substituted** lists cards the model doesn't know that it was given a
  [stand-in](/wiki/machine-learning#cards-the-model-doesnt-know) for, each shown beside its
  stand-in.
- **Not in model** lists cards the model doesn't know and was given nothing for. It ignores them.

### Substitute unknown cards

Every tab has a **Substitute unknown cards** checkbox. With it on, each card the model doesn't know
is given to the model as its stand-in, the way the draft bots handle new cards. With it off, those
cards are left out and show as **Not in model**. It starts on in Draft Pick and Deckbuild, to match
the bots, and off in Smart Search, Archetype, and Grow, to match Smart Search on a cube page, which
uses a cube's cards as they are.

## Results

Every set of results can be shown as a **Grid** of card images or as a **Table**, using the two
buttons beside the results heading. The choice is remembered across tabs and visits. In the grid,
scored results carry their score as a percentage. The table has columns for rank, quantity (when
any card has more than one copy), card name, type, and **Score**, drawn as a bar, wherever they
apply; on a phone the type column is hidden. A card the model couldn't rate shows no score.

The **Copy** button next to the heading copies the results as a list, one `1 Card Name` line per
card, ready to paste into another tab or into a cube's bulk import. Clicking a card in the grid
opens the dialog for adding it to one of your cubes, and a card name in the table links to its card
page; in Draft Pick, clicking a card in either view drafts it instead. On a computer, when you're
logged in, the [cube tray](/wiki/cube-tray) sits in the bottom-left corner of the page, and you can
drag a card from the grid onto any of your cube boards.

### Limits

The tabs share the model with the rest of the site, so each one has a rate limit, counted per
account when you're logged in and per network when you're not:

- Smart Search and Grow together: 120 requests a minute (each Grow step is one request);
- Draft Pick: 60 a minute;
- Archetype: 60 a minute;
- Deckbuild: 12 builds a minute, because each build asks the model many questions;
- searches whose filter uses a regular expression: 30 a minute.

Going over shows **Too many requests. Please wait a moment and try again.** If the model's service
is down, a run shows **Recommender unavailable** instead; try again in a moment.

## Smart Search

The Smart Search tab is the [cube page's Smart Search](/wiki/cube-page/analysis#smart-search) with
a pasted list standing in for the cube, so you can test a cube before you build it or check one
that isn't yours. It has two inputs:

- **Cards**, the list to recommend for;
- **Filter**, a card search in the site's [filter syntax](/wiki/reference/filter-syntax) (the
  **Syntax guide** link opens it). The filter is checked as you type, with a plain-language reading
  shown under it, and **Search** stays disabled while it's invalid.

Either input can be left empty, but not both. Click **Search** or press Enter in the filter. The
results come in two tabs:

- **Adds** ranks every card matching the filter (every card, with no filter) that isn't in your
  list, best fit first, 96 to a page. The heading repeats your filter, or reads **All cards**.
  Cards the model can't rate come after all the others. Basic lands, tokens, and Mystery Booster
  playtest cards are never included, and if you've turned on **Hide Universes Beyond cards in card
  search and recommendations** in your account settings, Universes Beyond cards are left out unless
  your filter asks for them with `is:ub`.
- **Cuts** ranks every card in your list, **Worst fit first**. The cards at the top are the ones
  the model thinks belong in the list least. Cards it can't rate come last.

Each tab's label shows how many cards it holds, for example **Adds · 1,204**.

## Draft Pick

Draft Pick shows a draft bot's view of a pack. Paste the cards in the pack into **Pack** and,
optionally, the cards already drafted into **Pool**, then click **Rate Pack**.

The results, headed **Pick 4** for a pool of three cards, rank the pack by the bot's pick
percentage, the same rating shown by **Show CubeCobra Bot Ratings** in a live draft. The
percentages of the cards it can rate add up to 100%, and in the grid the bot's choice is ringed.

You can play the pack out from here. Click any card to draft it: it moves from the pack to the pool,
the **Pack** and **Pool** fields update to match, and the rest of the pack is rated again. **Take
Top Pick** drafts the bot's choice. The pool is listed below the pack as **Pool · 3**, and once the
pack is empty the results clear.

A pack can hold up to 1,000 cards and a pool up to 500.

## Deckbuild

Deckbuild runs the [bot deckbuilder](/wiki/machine-learning#bot-decks-and-autobuild) on a pasted
pool, the same builder that builds bot decks after a draft and powers **Autobuild**. Paste the pool
into **Pool**, set **Spells** (default 23, up to 100) and **Lands** (default 17, up to 60; lands
include basics), and click **Build Deck**. There's no need to paste basic lands: the builder adds
Plains, Islands, Swamps, Mountains, and Forests on its own as the deck needs them.

The results open with the deck's colors and the archetype name a draft would give it, or
**Unclassified** when it can't be named. Three tabs follow:

- **Deck** shows the mainboard, with spells ordered by mana value and lands after them.
- **Sideboard** shows the cards the builder left out.
- **Build Ratings** lists every pool card with the model's deckbuilding rating, best first. The
  builder starts the deck from the top ten of these before choosing the rest one at a time.

A pool can hold up to 500 cards.

## Archetype

Archetype names the [archetypes](/wiki/machine-learning#archetypes) a list supports, and can compare
two lists. Paste a deck or any list into **Deck** and, optionally, a second list into **Compare**,
then click **Classify**. Next to **Substitute unknown cards** is **Ignore basic lands**, on by
default, which leaves basics out of both the archetypes and the embedding.

Each list gets its own panel, titled **Deck** or **Compare**, with:

- its colors and its top archetype, or **Unclassified** if none of its cards point to one;
- a bar for each archetype present, showing its share of the list's archetype signal (the shares
  add up to 100%). The top eight are shown, and **Show all · 12** reveals the rest.
- **Embedding**, the model's summary of the whole list as 128 numbers, drawn as a grid of cells
  shaded one color for positive values and another for negative, stronger for larger values. Hover
  a cell for its value. The **Copy** link copies all 128 as a list of numbers.

Archetypes always read the cards as pasted, so **Substitute unknown cards** changes only the
embedding and the similarity below. The top archetype here has no minimum: a short list still gets
a name, where a deck needs at least eight tagged nonland cards to be named.

With two lists, a **Similarity** bar appears above the panels, comparing their embeddings to three
decimal places. Higher means the model sees the lists as more alike, and 1.000 means it can't tell
them apart.

## Grow

Grow builds a list up from a starting point, picking the best fits a few at a time. It takes:

- **Seed**, the cards to start from (optional);
- **Filter**, which limits the cards that can be added (optional);
- **Target size**, the size to stop at, counting the seed's cards (default 360, up to 1,000);
- **Cards per step**, how many cards to add at a time (default 10, up to 100).

Click **Grow**. Each step runs Smart Search on the list so far, adds the top cards within the
filter, and includes them when ranking the next step, so smaller steps let each addition shape the
next ones more closely. A bar shows **Growing** while it runs and **Grown** when it stops, with the
count against the target. The added cards are listed in the order they were added, under
**Added · 40**, 96 to a page, and **Copy** copies the whole list, seed included. Basic lands,
tokens, and Mystery Booster playtest cards are never added.

Growing stops when the list reaches the target, or when the only cards left are ones the model
can't rate. **Stop** halts it partway. As long as **Seed**, **Filter**, and **Substitute unknown
cards** are unchanged, the button then reads **Continue** and picks up where it left off, which
also works after raising **Target size**; changing any of the three starts over. **Reset** clears
the results.

Every step is one Smart Search request, so a small step size with a large target can hit the limit
of 120 a minute. When that happens, growing stops with the rate-limit message: wait a moment and
click **Continue**.

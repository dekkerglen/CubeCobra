---
title: Machine Learning
description: The model behind the draft bots, Autobuild, Smart Search, and archetype names.
order: 4
---

Cube Cobra runs one machine-learning model, trained on the cube lists and drafts people make on the
site. From that data it has learned three things: which cards belong together in a cube, which card
a drafter takes from a pack given what they've already picked, and which cards from a drafted pool
make the final deck. Those three skills power most of the site's automation:

- **Draft bots.** Every bot seat in a practice draft picks by asking the model, and the same ratings
  can be shown to you while you draft and when you review a draft afterward.
- **Deckbuilding.** After a draft, the bots build their decks with the model, and **Autobuild** in
  the deckbuilder does the same for your pool.
- **Smart Search.** The card recommender on a cube's Analysis tab ranks cards by how well they fit
  that specific cube.
- **Archetype names.** Decks and drafts are named after the archetype their cards point to, and
  the Archetypes analysis view shows which archetypes a cube supports.

The [ML Playground](/wiki/machine-learning/ml-playground) lets anyone run each of these on a pasted
card list, without a cube or a draft.

## Bot ratings

A bot rating is the model's answer to "which card would I take from this pack, holding these
picks?" It's given as a percentage per card, and the percentages across a pack add up to 100%. The
same pack rates differently for different drafters: a drafter deep in blue and one deep in red see
different top picks. On a normal pick, a bot takes the card it rates highest.

You can see the ratings in four places:

- **During a practice draft.** **Show CubeCobra Bot Ratings** (in the draft table's header, or in
  its menu on a phone) puts the bot's percentage on every card in your current pack, worked out from
  your picks so far, and highlights the card a bot would take in your seat. Ratings start hidden in
  every draft; **Hide Bot Ratings** turns them off again. If the ratings fail to load, the bots
  can't pick either, and the table shows a **Bot picks failed. Try again?** button.
- **On a deck page.** The **Pick by Pick Breakdown** view has a **Show CubeCobra Pick
  Recommendation** checkbox, on by default. Every card in the pack at each pick shows its rating,
  computed from the drafter's picks up to that point, and the highest value is the card a bot would
  have taken there. The ratings come from the current model, so after a
  [retrain](#how-often-the-model-changes) they can disagree with what the bots actually did.
- **In P1P1 polls.** Each poll stores the bot's first pick when it's created. Once you've voted,
  the results count **CubeCobra's Pick** as one extra vote, marked with the Cube Cobra logo, and
  **Show Bot Weights** switches the pack from vote percentages to the bot's rating on each card.
- **In sample packs.** The **Balanced** button on a sample pack deals ten candidate packs and keeps
  the one whose top card has the lowest bot rating, so no single card is an obvious first pick. The
  page shows that card's rating as **Max pick weight**. See
  [Sample packs](/wiki/cube-page/playtest#sample-packs).

## Bot decks and Autobuild

The deckbuilding side of the model decides which cards from a pool make the deck. It works in
stages: it starts with the ten cards it rates highest for the pool, then adds cards one at a time,
each chosen the way a draft pick would be given the cards already in the deck, until the deck
reaches its spell and land counts. A last pass reconsiders nonbasic lands that don't suit the
deck's colors, replacing them with basics where a basic serves better, and the cube's basic lands
fill out the rest.

### Bot decks after a draft

When a practice draft ends, the bots build their decks in the background. Until they finish, the
deckbuilder and the deck page show a banner reading **Bot decks are building… they'll be ready
shortly.**, and each bot seat shows every card it drafted laid out in its mainboard. The banner
checks back every 30 seconds and changes to **Bot decks are ready — please refresh to view them.**
once the builds are done. If they fail, it reads **Bot decks couldn't be built — they're shown in
a basic layout.**, and the bot seats keep their drafted cards in that layout. Bot seats from a
[Draftmancer](/wiki/cube-page/playtest#multiplayer-draft) draft uploaded to Cube Cobra are built
the same way.

Each bot deck is named for its colors and archetype when it's built, and a deck you save without a
title is named the same way (see [Archetypes](#archetypes)).

### Autobuild

In the deckbuilder, **Autobuild** runs the same builder on your own pool: every card in your
mainboard and sideboard, plus the cube's basic lands. A progress bar counts through the steps
(**Autobuilding 40% (step 6 of 15)**, for example), and the result replaces your current build.
It's a starting point to adjust by hand; nothing is stored until you click **Save Deck**.

### Spell and land counts

Bot decks and Autobuild both aim for the cube's **Max spells** and **Max lands**, which default to
23 and 17 for a 40-card deck. Lands include basics. The cube's owner sets both under Deckbuild
Limits in [Settings → Draft Formats](/wiki/cube-page/settings#draft-formats); a cube built for
45-card decks might use 27 and 18.

## Archetypes

Archetypes are found by sorting drafted decks by what their nonland cards do, using each card's
Scryfall oracle tags (the same tags the `otag:`
[filter](/wiki/reference/filter-syntax#scryfall-tags) searches). Every retrain rebuilds them from
the decks in its training data, into about 30 archetypes, each named for the tags that set its
decks apart.

A deck takes the archetype its tagged nonland cards point to most strongly. It needs at least eight
tagged nonland cards to get one; with fewer, the deck is named by its colors alone. A saved deck
without a title is named "colors archetype", and a draft in the deck archive takes its name from
the first drafter's deck: "colors archetype Draft of cube name". A retrain doesn't rename existing
decks; a deck only picks up a new archetype name when it's saved again.

### The Archetypes view

The Archetypes view on a cube's [Analysis tab](/wiki/cube-page/analysis) lists every archetype the
cube's cards support, with three columns: **Archetype**, **Share** (its portion of the cube's
archetype signal; the shares add up to 100%), and **Cards**, the cube's eight cards that carry it
most. The Analysis filter applies, so filtering to one color shows what that color contributes. If
none of the cards have tags that point to an archetype, the view shows **No archetypes found.**

The view appears in the Analysis sidebar only while the site's current model includes archetypes.
That's a site-wide condition: it doesn't depend on anything about the cube, and when the view is
missing, decks aren't being given archetype names either.

## Smart Search

Smart Search is the model's cube-building skill turned into a search: type a filter on a cube's
Analysis tab and it ranks every matching card that isn't already in the cube by how well it fits
that cube. Basic lands, tokens, and Mystery Booster playtest cards never appear as suggestions. A
cube with no cards has nothing to fit, so there Smart Search runs your filter as a plain card search
sorted by Elo. If the model's service is down, the results area reads **Recommender unavailable**;
try again in a moment. Using it is covered in
[Analysis → Smart Search](/wiki/cube-page/analysis#smart-search).

## Draft Simulator

The Draft Simulator on the Playtest tab runs the same draft bots, but in your browser: it loads the
model onto your device, plays many bot-only drafts of the cube, and summarizes how the cube drafts.
Cards the model doesn't know use the same stand-ins as in a live draft. See
[Draft simulator](/wiki/cube-page/playtest#draft-simulator).

## Cards the model doesn't know

The model only knows cards that appeared in its training data. Everything else is handled like
this:

- **Stand-ins.** Once a week, every card the model doesn't know is matched to a stand-in: the known
  card it most resembles, judged by the cards it gets drafted alongside. Bots, bot decks, Autobuild,
  and the pick breakdown then rate the card exactly as they'd rate its stand-in. The match is rough
  for a card that has barely been drafted and improves as drafts accumulate.
- **No stand-in yet.** A card added to Cube Cobra since the latest weekly update has no stand-in.
  It rates 0%, and a bot never takes it while any rated card is left in the pack. (If nothing in
  the pack is rated, the bot still takes a card.)
- **[Custom cards](/wiki/special-cards/custom-cards)** always rate 0%: the model has nothing to go
  on.
- **[Vouchers](/wiki/special-cards/vouchers)** rate as the sum of the different cards they
  contain, since taking a voucher gets you all of them.

Smart Search doesn't use stand-ins. Cards in the cube that the model doesn't know don't count
toward its picture of the cube, and unknown cards matching your filter are listed after every card
it can rate.

## How often the model changes

The model is retrained roughly every three months. Each retrain follows a full export of the site's
data and learns from drafts from the three years before it, along with cubes updated in that
window. A new model replaces the current one only after it has been checked against it on drafts
and cubes held back from training. When one goes live, bot ratings, Smart Search orderings, and
archetypes can all shift, and cards that people have cubed and drafted since the previous retrain
can become known to the model instead of relying on stand-ins.

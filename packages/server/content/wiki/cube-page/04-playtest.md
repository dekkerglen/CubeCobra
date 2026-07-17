---
title: Playtest
description: Drafting against bots, sample packs, sealed, grid and Housman drafts, and the deck archive.
order: 4
---

The Playtest tab is where a cube gets played. It offers several ways to generate packs and run
drafts: solo against bots, locally with a friend, or online with a full pod. It also archives every
deck that comes out of them.

Drafting is the best way to pressure-test a cube. It surfaces archetypes that don't have enough
support, colors that are over- or under-drafted, and cards that never make anyone's deck.

The tab has four views: Practice Draft (the format cards), Sample Pack, Drafts (the deck archive),
and the Draft Simulator.

## Practice draft

The Standard Draft card starts a booster draft against bots. You choose the number of packs (1–16,
default 3), cards per pack (1–25, default 15), and total seats (2–17; the default is whatever the
cube's owner set, usually 8). You occupy one seat and bots fill the rest.

The draft plays out like the real thing: pick a card, pass the pack, receive the next one. As you
build, your picks land in a two-row layout (creatures on top, non-creatures below, columns by mana
value), and you can drag cards between mainboard and sideboard as you go. The bots pick using the
same machine-learning model that powers Cube Cobra's card rankings, and your current pack shows
each card's bot rating as a bar underneath it, so a practice draft doubles as a window into how the
bots value your cards.

An in-progress draft is saved in your browser, so an interrupted draft resumes where you left off.
When the last pick is made, you're taken to the [deckbuilder](#the-deckbuilder), and the bots build
their own decks in the background.

Finished drafts feed the cube's [Playtest Data analytics](/wiki/cube-page/analysis), which
aggregate pick rates and archetypes across every human draft of the cube.

### Custom formats

If the cube's owner has defined custom draft formats (themed packs, slots restricted by filters,
special pick orders), each appears as its own card on this page, with its description and a seat
selector. One format can be marked as the cube's default, which puts it first. Building formats is
covered in [Settings → Draft Formats](/wiki/cube-page/settings).

### Multiplayer draft

The Multiplayer Draft card hands off to Draftmancer, a free site for drafting live with other
people. It opens Draftmancer with the cube preloaded; you share the session link with your pod and
draft there, with bots filling any empty seats. Draft logs upload back to Cube Cobra afterward, so
multiplayer drafts show up in the deck archive with full pick-by-pick breakdowns, just like drafts
run on the site.

### Sealed

The Standard Sealed card deals a sealed pool (you pick the number of packs, default 6, and cards
per pack, default 15) and drops you straight into the deckbuilder. There's no picking phase; it's
the quickest way to test whether the cube supports coherent 40-card decks from a raw pool.

### Grid draft

Grid draft is a two-player format with completely open information. Each pack is dealt as a 3×3
grid, and on your turn you take a full row or column; your opponent takes from what remains. You
choose the number of packs (default 18) and whether the opponent is a bot or a second person
sharing your screen ("2 Player Local").

### Housman draft

Housman draft is a hidden-information format for 2–6 players. Each round, every player holds a
hidden hand of five cards while nine cards sit face-up in a shared pool; players take turns
swapping a card from their hand with a face-up card. When the round ends, everyone keeps their
hand, and a new round begins. You set the number of players and rounds (default 9); bots fill the
other seats, and a running log shows every swap as it happens.

### Rotisserie draft

Rotisserie, a slow and fully open draft where players pick one card at a time from the whole cube,
isn't played live on Cube Cobra, but the site supports tracking one. The Rotisserie Draft card
links to Lucky Paper's guide, and the setup lives on the list page under Display → Setup Rotisserie
Draft.

Any of the standard format cards (draft, sealed, grid, multiplayer) can be hidden by the owner in
[Settings → Draft Formats](/wiki/cube-page/settings) if they don't suit the cube.

## Sample packs

The View Sample Pack card generates a pack without starting a draft. A random pack is one click
away, or you can enter a seed (any text) to get a reproducible pack: the same seed always produces
the same pack until the cube changes. Sample pack pages have their own URL, so a specific pack can
be shared.

From a generated pack you can:

- deal a fresh random pack, or a "balanced" pack, which is generated to avoid one card towering
  over the rest by bot rating and makes for interesting first picks;
- copy a link that always deals a new random pack for whoever opens it;
- download the pack as a single image;
- share it as a P1P1 poll.

A P1P1 (pack one, pick one) poll shows the pack to other users and lets them vote on their first
pick. The Playtest tab's sample pack view keeps a list of the cube's previous P1P1s, and polls can
be created directly from there too.

## The deck archive

The Drafts view lists every completed draft, sealed pool, and uploaded deck for the cube, 25 at a
time, each with its format, deck name, drafter, seat count, and date. This is the collective
memory of the cube: what people actually built with it.

### The deck page

Opening a deck shows the full build, with a seat selector to flip through every player's deck from
that draft, including the bots'. Three views are available:

- **Deck View** lays the deck out in stacks, creatures and non-creatures by mana value, with the
  sideboard below.
- **Visual Spoiler** is a flat grid of card images.
- **Pick by Pick Breakdown** replays the entire draft for drafted decks: each pack as it was seen,
  the bot ratings on every card, and the card actually taken highlighted. Step through with the
  arrow keys to relive (or second-guess) every pick. Housman drafts show their swap log in the
  same spirit.

The Export menu downloads the deck for Card Names (.txt or clipboard), Forge, XMage, MTGO, Arena,
Cockatrice, TopDecked, or CSV. Under More you'll find **Sample Hand**, which deals opening hands
from the deck, and **Clone and Rebuild**, which copies the pool into a fresh deckbuilder session
so you can try a different build without touching the original. Deck owners and the cube's owner
can edit a deck's build or delete it, and every deck has a comment section.

## The deckbuilder

After any draft or sealed pool you land in the deckbuilder. Cards sit in the same two-row stack
layout as during the draft; click a card to bounce it between mainboard and sideboard, or drag it
to exactly the stack you want. A drop zone below the stacks removes a card from the deck entirely.

The toolbar offers:

- **Add Basics**, which adds any number of each basic land. Which land versions appear is up to
  the cube's owner, via a dedicated basics board.
- **Autobuild**, which has the deckbuilding model assemble a deck from your pool, respecting the
  cube's configured spell and land counts (23 and 17 unless the owner changed them). It's a
  starting point you can then adjust by hand.
- Sort controls for rearranging the stacks, a deck stats panel (curve, colors, land count), and a
  title field.

**Save Deck** stores the build to the cube's deck archive under your name.

## Draft simulator

The Draft Simulator card opens a batch-simulation tool: it runs many bot-only drafts of the cube in
your browser and aggregates the results (pick rates per card, archetype clusters, deck
compositions) to show how the cube drafts when nobody's forcing anything. It's the fastest way to
see whether an archetype is underdrafted or a card never makes a deck, without needing months of
human draft history. Results appear in the same archetype-map style as the [Playtest Data
analytics](/wiki/cube-page/analysis) view, and simulation runs are kept locally so you can compare
before and after a change to the list.

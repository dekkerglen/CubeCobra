---
title: Draft-Matters Cards
description: How Conspiracy's draft-matters cards work in Cube Cobra drafts, including Lore Seeker's extra pack.
order: 3.5
---

The two Conspiracy sets printed cards whose text does something while you draft: take two cards
from one pack, pass a pack without drafting from it, note how many cards you've drafted this round,
add a whole new pack to the draft. Cube Cobra runs that text in its practice drafts. Draft a
[[Cogwork Librarian]] and you can use it to take two cards from a later pack; draft a
[[Garbage Fire]] as your fifth card of the round and it's noted "Pick 5", and the note follows it
into your deck. The bots draft and use these cards too.

Cube Cobra recognizes twenty-four of these cards, and all but Deal Broker do something in the
draft. Each one works from the real card, so every printing counts, and the cards can sit in any
slot of any pack.

## Where they work

Draft-matters text runs in practice drafts against bots: the Standard Draft and every custom draft
format on the [Playtest tab](/wiki/cube-page/playtest#practice-draft). Everywhere else, these are
ordinary cards:

- **Sealed** has no picks, so nothing happens, and a Lore Seeker adds no pack.
- **Grid draft** and **Housman draft** don't run them.
- **Multiplayer drafts** run on Draftmancer, not Cube Cobra, so Cube Cobra applies none of these
  rules there. A Draftmancer draft uploaded to Cube Cobra has no draft notes, and its pick
  breakdown shows plain picks.
- The **Draft Simulator** drafts them as ordinary cards and never adds Lore Seeker packs.
- The [ML Playground](/wiki/machine-learning/ml-playground)'s **Draft Pick** tab rates them like
  any other card.

A [custom card](/wiki/special-cards/custom-cards) named after one of these cards does nothing,
since it isn't the real card. A draft-matters card inside a [voucher](/wiki/special-cards/vouchers)
does nothing either: the drafter takes the voucher, not the cards inside it.

## At the draft table

### Revealed and face-up cards

The cards come in two kinds, and the summary table below says which is which.

- **Revealed** cards are shown to the table as you draft them, and their effect happens then:
  a note is recorded, a choice comes up, or a pack is added. After that they're ordinary cards in
  your pool.
- **Face-up** cards stay face up in your pool after you draft them. Their ability is yours to use
  until it turns the card face down, and some, like Cogwork Grinder, stay face up all draft.

A face-up card whose ability you can use right now rocks gently back and forth in your pool.
Clicking a pool card normally moves it to the other board; clicking a ready card opens a prompt
instead, with **Use**, **Move to other board**, and **Cancel**. Some abilities switch on for your
next pick rather than happening at once; a switched-on card is outlined in amber, and clicking it
again switches it off.

Cards with no button to press, like Canal Dredger, never rock: their effect simply happens.

### Notes, prompts, toasts, and the table log

Information a card records shows on the card's name bar in your pool, such as **Pick 5** or
**Noted: Lightning Bolt**, and stays with it into the deckbuilder and your deck.

When a card needs an answer from you (Lore Seeker's pack, a color for Regicide, a guess for Spire
Phantasm) a prompt opens over the table and the whole draft waits for it. The next pack stays
hidden until you answer, because the answer can change which pack comes next. These prompts have
no close button.

Short messages appear at the top right of the table (one at a time at the top on a phone) for a
few seconds: another seat drafting a face-up card (**Seat 4 drafted Cogwork Librarian**), another
seat using Cogwork Librarian, Leovold's Operative, Agent of Acquisitions, or Lore Seeker, notes on
your own cards, and anything a card lets you see. Hovering over one holds it; clicking dismisses it.

Once anything has happened, a **Table log** link appears in the table's header (in its menu on a
phone). It lists, newest first and grouped by pack, every draft-matters card anyone has drafted,
every ability used, cards removed from the draft, last cards sent by Canal Dredger, packs passed
without drafting, and color choices. Revealed cards drafted by other seats show up here, not as
messages. The log covers the current visit only: reload the page and it starts over, though your
notes and the draft itself carry on.

When packs pile up, which happens once packs are added or passed on without drafting, a stack icon
in the header shows how many packs are waiting for you.

### Seats

During the draft you're **You** and the other seats are **Seat 2**, **Seat 3**, and so on, counting
around to your right; the highest-numbered seat is on your left. Odd-numbered packs pass to the
left and even-numbered packs to the right, so in pack 1 you receive from Seat 2. After the draft,
notes use the same numbers, with you as **Seat 1**.

## Summary

| Card                                                                       | Kind     | In Cube Cobra                                                             |
| -------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| [[Aether Searcher]]                                                        | Revealed | Notes the name of the next card you draft.                                |
| [[Agent of Acquisitions]]                                                  | Face up  | Takes a whole pack, then you can only pass for the rest of the round.     |
| [[Animus of Predation]]                                                    | Face up  | Removes your next pick from the draft and notes its keywords.             |
| [[Archdemon of Paliano]]                                                   | Face up  | Your next three picks are random, from a face-down pack.                  |
| [[Canal Dredger]]                                                          | Face up  | The last card of every pack goes to a Canal Dredger holder.               |
| [[Cogwork Grinder]]                                                        | Face up  | Removes your next pick from the draft.                                    |
| [[Cogwork Librarian]]                                                      | Face up  | Take two cards from one pack; the Librarian goes into that pack.          |
| [[Cogwork Spy]]                                                            | Revealed | Shows you the next card drafted from its pack.                            |
| [[Cogwork Tracker]]                                                        | Revealed | Notes which seat passed it to you.                                        |
| [[Custodi Peacekeeper]], [[Garbage Fire]], [[Lurking Automaton]], [[Pyretic Hunter]] | Revealed | Notes how many cards you've drafted this round. |
| [[Deal Broker]]                                                            | Face up  | Nothing: the after-draft trade isn't supported.                           |
| [[Illusionary Informant]]                                                  | Face up  | Shows you the next card a seat of your choice drafts.                     |
| [[Leovold's Operative]]                                                    | Face up  | Take two cards from one pack, then pass your next pack without drafting.  |
| [[Lore Seeker]]                                                            | Revealed | You may add a pack to the round.                                          |
| [[Noble Banneret]]                                                         | Face up  | Notes the name of the next creature you draft.                            |
| [[Paliano, the High City]]                                                 | Revealed | Three seats choose three colors, which are noted.                         |
| [[Paliano Vanguard]]                                                       | Face up  | Notes the creature types of the next creature you draft.                  |
| [[Regicide]]                                                               | Revealed | Three seats choose three colors, which are noted.                         |
| [[Smuggler Captain]]                                                       | Face up  | Notes the name of the next card you draft.                                |
| [[Spire Phantasm]]                                                         | Revealed | You guess the next card drafted from its pack; right or wrong is noted.   |
| [[Whispergear Sneak]]                                                      | Face up  | Look at an unopened pack or one waiting in a queue.                       |

Bots draft all of these on their [bot rating](/wiki/machine-learning#bot-ratings), like any other
card. A bot doesn't take a Cogwork Librarian early because of what it can do in the draft; once it
has one, it uses it as described below.

## Cards that note information

Notes appear on the card in your pool as you draft, in the deckbuilder, and on the deck page (see
[After the draft](#after-the-draft)). Bots get the same notes on their cards.

### Custodi Peacekeeper, Garbage Fire, Lurking Automaton, and Pyretic Hunter

Each of [[Custodi Peacekeeper]], [[Garbage Fire]], [[Lurking Automaton]], and [[Pyretic Hunter]] is
revealed and noted with how many cards you've drafted this round, itself included: **Pick 5**
means it was your fifth card of the round. Every card you drafted this round counts, from any
pack, including extra cards from a Cogwork Librarian and last cards from a Canal Dredger.

### Cogwork Tracker

[[Cogwork Tracker]] is revealed and noted with the seat that passed it to you, such as
**Passed by Seat 4**. A Tracker you took from a pack nobody had passed yet, such as the first pick
of a round or of a Lore Seeker pack you added, notes nothing. A Tracker that reaches you as a Canal
Dredger's last card notes the seat that sent it.

### Aether Searcher

[[Aether Searcher]] is revealed, and the next card you draft after it is noted on it by name:
**Noted: Lightning Bolt**.

### Noble Banneret, Paliano Vanguard, and Smuggler Captain

These three are drafted face up and note the next card that fits, then turn face down:

- [[Noble Banneret]] notes the next creature's name (**Noted: Grizzly Bears**).
- [[Paliano Vanguard]] notes the next creature's creature types (**Types: Elf, Warrior**, or
  **Types: none** for a creature without any).
- [[Smuggler Captain]] notes the next card's name, creature or not.

The card does nothing until you switch it on with **Use**. From then on, the next card you draft
that fits is noted, whether you picked it or it reached you another way, like a Canal Dredger's
last card. Click the outlined card to switch it off before then. Bots switch theirs on as soon as
they draft them, so a bot's Banneret notes the very next creature it drafts.

### Paliano, the High City and Regicide

Drafting [[Paliano, the High City]] or [[Regicide]] starts a color choice: the seat to the
drafter's right picks a color, then the drafter picks a different one, then the seat to the
drafter's left picks a third. The three colors are noted on the card, such as **Colors: R G U**.

Whenever it's your turn to choose, for your own card or a neighbor's, a prompt shows the five mana
symbols with colors already taken grayed out, and the choices so far (**Seat 2: R**). It's titled
with the card's name, or with the seat and card name (**Seat 8: Regicide**) when the card is
someone else's. Each choice appears in the table log.

Bots choose like this:

- For Paliano, the drafter picks the remaining color it has drafted the most cards of, and its
  neighbors pick the remaining color the drafter has the fewest cards of.
- For Regicide, each seat picks the remaining color it has drafted the fewest cards of itself,
  keeping its own colors off the list.

### Spire Phantasm

When you draft [[Spire Phantasm]], a prompt titled **Spire Phantasm: guess** shows the cards left
in the pack, one of each name. Click your guess. When the next card is drafted from that pack, the
Phantasm is noted **Guessed right** or **Guessed wrong**; another copy of the card you named counts
as right. A Phantasm that was the last card in its pack has no pack to guess about and notes
nothing. Bots guess a random card from the pack.

## Cards that take extra cards

### Cogwork Librarian

[[Cogwork Librarian]] lets you take two cards from one pack and puts the Librarian into that pack
in exchange. It's ready whenever you're picking from a pack of two or more cards, except during
random picks.

Use it before you pick: press it and choose **Use**, or drag it from your pool onto the pack. The
Librarian appears among the pack's cards and the header asks you to **Pick 2 cards**. Until you pick
the first card, clicking the Librarian in the pack (or dragging it back to your pool) takes it
back. Once your picks go through, the Librarian leaves your pool and travels on with the pack, face
up for whoever drafts it next. Each Librarian you use adds one more card to the pick.

A bot uses a Librarian when the pack has at least three cards and its second choice is rated at
least 85% as highly as its first. On the deck page, the extra card's pick is labeled **Cogwork
Librarian**.

### Leovold's Operative

[[Leovold's Operative]] also lets you take two cards from one pack, but costs you a pack: it turns
face down, and you pass the next pack you receive without drafting from it. Use it before you pick,
as with the Librarian, and the header asks for two cards.

When the pack you have to pass arrives, the header reads **Pack 2: Pass** and a **Pass** button
appears. You can look at the pack before you pass it. If the pick that used the Operative was your
last of the round, the pass applies to your first pack of the next round.

A bot uses an Operative when the pack has at least eight cards and its second choice is rated at
least 90% as highly as its first. The extra card is labeled **Leovold's Operative** on the deck
page; the passed pack doesn't appear there, since nothing was drafted from it.

### Agent of Acquisitions

Instead of picking one card, [[Agent of Acquisitions]] takes every card in the pack. It's ready
whenever you're picking, except during random picks, as long as you haven't used an Agent this
round. Choosing **Use** takes the whole pack at once, so use it before picking anything from the
pack. The Agent turns face down, and for the rest of the round you can't draft: every pack that
reaches you shows the **Pass** button. When every seat still holding packs can only pass, the round
ends and those packs are set aside.

A bot uses its Agent on the first pick from a pack that still has all its cards, if the pack holds
ten or more. Each card taken this way is labeled **Took the whole pack (Agent of Acquisitions)** on
the deck page.

### Canal Dredger

[[Canal Dredger]] never needs a button. From the moment a seat drafts one, the last card of every
pack goes to a Canal Dredger holder instead of being drafted by whoever holds it, even when the
pack's last step would have trashed it. That includes Lore Seeker packs, and it lasts for the rest
of the draft.

If one seat holds a Canal Dredger, the last card goes there automatically. If several do, whoever
holds the last card chooses: you get a prompt titled with the card (**Last card: Shock**) and a
button for each holder, **You** among them if you hold one. A bot keeps the card if it has a Canal
Dredger, and otherwise sends it to a random holder. A card that reaches you this way lands in your
pool and is labeled **Last card from Seat 3 (Canal Dredger)** on the deck page.

## Cards that remove cards

### Cogwork Grinder and Animus of Predation

[[Cogwork Grinder]] and [[Animus of Predation]] both remove cards from the draft: a removed card is
drafted but never joins your pool. Both stay face up all draft.

Switch one on with **Use** before you pick, and the next card you pick is removed. Each use covers
one pick; click the outlined card to switch it off before you pick. A removed card leaves the pack
like any pick but doesn't land in your pool. The face-up card shows how many cards you've removed
(**Removed: 2**), and on a phone your pool gains a **Removed** tab listing them.

Animus of Predation also notes the keywords it gains: when you remove a creature with flying, first
strike, double strike, deathtouch, haste, hexproof, indestructible, lifelink, menace, reach, or
vigilance, the Animus is noted with the new ones, such as **Keywords: Flying, Lifelink**.

Other seats see the difference in the table log. A Grinder removes face down, so its use shows as
**Seat 3 used Cogwork Grinder**; Animus removes face up, so the log names the card.

Removing a face-up card means it never goes face up, so you never get its ability. Removing a
revealed card still reveals it, and an effect that happens during the draft, like Lore Seeker's
pack or Spire Phantasm's guess, still happens.

When a bot with a Grinder picks from a pack of five or fewer cards, it removes the card. A bot with
an Animus does the same only for creatures with one of the keywords above. Removed cards are
labeled **Removed from the draft** on the deck page.

## Cards that look at cards

### Cogwork Spy

When you draft [[Cogwork Spy]], the next card drafted from that pack is shown to you in a message
and the table log, such as **Seat 8 drafted Shock**. A Spy that was the pack's last card has
nothing to show. Nothing is recorded afterward.

### Illusionary Informant

[[Illusionary Informant]] is ready any time while it's face up, even between picks. **Use** lists
the other seats; choose one, and the Informant turns face down. The next card that seat drafts
shows up in a message and the table log. Bots never use their Informants.

### Whispergear Sneak

[[Whispergear Sneak]] is also ready any time while face up. **Use** lists the packs you can look at:

- every pack still to be opened in a later round, such as **Seat 3 · Pack 2** (your own included);
- every pack waiting in a seat's queue behind the one that seat is looking at, such as
  **Waiting for Seat 4**.

Choose one and the Sneak turns face down while the pack's cards are shown. If there's nothing to
look at, the list reads **No packs to look at.** and the Sneak stays face up. Bots never use their
Sneaks.

## Archdemon of Paliano

[[Archdemon of Paliano]] is drafted face up and can't be switched off. Your next three picks are
random: the pack is shown face down, and clicking any card takes a random one. The header ends with
**Random pick (3 left)**, counting down, the Archdemon carries a matching note (**3 random left**),
and bot ratings aren't shown on face-down cards. After the third random pick, the Archdemon turns
face down. If the round ends first, the remaining random picks carry into the next one.

During random picks you can't use Cogwork Librarian, Leovold's Operative, or Agent of
Acquisitions, but Cogwork Grinder and Animus of Predation still work. Bots draft at random too.
Each of these picks is labeled **Random pick, pack face down (Archdemon of Paliano)** on the deck
page.

## Lore Seeker

[[Lore Seeker]] is revealed as you draft it, and then you may add a booster pack to the draft. Your
next pick comes from that pack, and it's then passed around and drafted during the current round.
Cube Cobra builds each Lore Seeker's pack when the draft starts, and the cube's owner can define
exactly what goes in it with the [Lore Seeker pack setting](#the-lore-seeker-pack-setting).

### Adding the pack

Drafting a Lore Seeker opens a prompt titled **Lore Seeker**: **Add a booster pack? (15 cards)**,
with the pack's real card count, and the buttons **Add** and **Don't add**.

**Add** puts the new pack in front of you, ahead of any pack already waiting. It opens like a fresh
booster, labeled **Lore Seeker pack · 15 cards**. While you draft from it, the header names it
(**Lore Seeker pack Pick 6: Pick 1 card**, continuing your pick count for the round) and a tag over
the pack reads **Lore Seeker pack (yours)**. After your pick it's passed in the round's direction
and goes around with the other packs until it's empty or its steps run out. The round doesn't end
until it's done, and meanwhile the header shows **+1 pack this round**. When another seat's Lore
Seeker pack reaches you, its tag says where it came from, such as
**Lore Seeker pack (from Seat 3)**.

**Don't add** gives up the pack for good: there's no way to add it later, and its cards stay out of
the draft.

The pack is drafted by its own steps, so a pack built like a "pick two, then pass" format pack
keeps that pattern. A Lore Seeker that's trashed is never drafted and adds nothing. One that's
removed by a Cogwork Grinder or Animus of Predation still offers its pack.

### What's in the pack

Each Lore Seeker's pack is built when the draft starts, from the same cube cards the regular packs
come from, after the regular packs are dealt. Unless the draft format's **Multiples** setting allows
any number of copies, no card in a Lore Seeker pack also appears in a regular pack, and the cards
set aside for it stay out of the draft if the pack is never added.

What the pack holds depends on the card's **Lore Seeker pack** setting:

- **Default** builds a pack the same way as the pack the Lore Seeker was opened in. In a Standard
  Draft of 15-card packs, that's 15 cards from anywhere in the mainboard. In a custom format, it
  uses that pack's slots, steps, and card-order setting: a Lore Seeker opened in pack 2 adds a pack
  built like pack 2.
- **Custom** builds the pack from the card's own definition, in every draft of the cube, Standard
  or custom format.

Slots are filled in order. If a slot can't be filled, because the cube has run out of cards or
nothing left matches the slot's filter, the pack stops there and holds only the cards before it.
A short pack ignores its steps and is drafted one card per pick. If not even the first slot can be
filled, the Lore Seeker has no pack: it gives no prompt and is drafted like any other card.

Cube size matters here. A 360-card cube drafted by eight players with three 15-card packs uses its
whole mainboard on the regular packs, leaving nothing for a Lore Seeker pack, unless a custom pack
draws its slots from another board.

Because packs are built when a draft starts, changing a Lore Seeker's setting affects drafts started
afterward, not drafts already under way.

### Bots and Lore Seeker

A bot that drafts a Lore Seeker always adds the pack. You get a message (**Seat 3 used Lore
Seeker**), the table log records it, and the pack reaches you in turn, tagged **Lore Seeker pack
(from Seat 3)**. Bots draft from added packs as they do from any other.

### More than one Lore Seeker

Each Lore Seeker has its own pack, built from its own setting, and each can be added once. Several
can be added in the same round, and the header counts them (**+2 packs this round**).

A Lore Seeker found inside a Lore Seeker pack gets a pack too, from its own custom setting or, on
**Default**, built the same way as the pack it was found in. A draft builds at most 24 Lore Seeker
packs; any Lore Seeker beyond that is drafted as an ordinary card.

### Lore Seeker in the pick breakdown

On the deck page's **Pick by Pick Breakdown**, picks from an added pack are listed with the rest of
that round's picks and labeled **Lore Seeker pack**, as in **Pack 1: Pick 9 · Lore Seeker pack**.
The Lore Seeker itself carries no note.

## The Lore Seeker pack setting

Every Lore Seeker in a cube has its own **Lore Seeker pack** setting, which decides what its added
pack holds. Open the card's [card editor](/wiki/cube-page/list#the-card-editor) by clicking it in
the list; the setting sits at the bottom of the editor, below the other fields. It's there for
every printing of Lore Seeker, in every board.

Anyone who can edit the cube (its owner and collaborators) sees it on every Lore Seeker. Other
visitors see it only on a Lore Seeker with a custom pack, read-only, so drafters can check what the
pack will hold. It's also read-only on a card staged for removal.

### Default and Custom

**Lore Seeker pack** is a dropdown with two options:

- **Default**, where the Lore Seeker adds a pack built like the one it was opened in: a 15-card
  pack of anything in the mainboard in a Standard Draft of 15-card packs, or the matching pack of a
  custom format. See [What's in the pack](#whats-in-the-pack).
- **Custom**, where it adds the pack you define in the pack editor that opens below the dropdown,
  whatever format the cube is drafted in.

### The pack editor

Choosing **Custom** starts you with a standard 15-card booster: 15 slots of `*`, each meaning any
card in the mainboard, drafted one card per pick. The editor is a box headed **Lore Seeker pack -
15 cards**, and the count follows the number of slots. It works like a pack in a [custom draft
format](/wiki/cube-page/settings#draft-formats), and has three parts.

**Randomize card order (hide which slot each card came from)** is a checkbox. Off, the pack shows
its cards in slot order, so drafters can tell which slot each card filled. On, the cards are
shuffled.

**Card Slots** (click the heading to collapse it) lists the slots, numbered. Each slot is a
[filter](/wiki/reference/filter-syntax) that decides which cards can fill it:

- `*` or a blank slot takes any mainboard card.
- A filter like `t:creature` or `tag:aggro` takes a matching mainboard card.
- Slots draw from the mainboard unless the filter names a board with `board=`: `board=maybeboard`
  takes any card in the maybeboard, and `t:creature (board=mainboard or board=maybeboard)` takes a
  creature from either.

**Remove** beside a slot deletes it (it isn't shown when only one slot is left), and **Add Card
Slot** adds a `*` slot at the end. Slots can't be reordered; to move one, change the filters in
place. Order matters, since slots are filled in order and the pack stops at the first one that
can't be filled.

**Steps for Drafting** (collapsed at first; click the heading to open it) is the pack's script,
one numbered step per row. Each step has a dropdown with **Pick**, **Pass**, **Trash**, **Randomly
Pick**, and **Randomly Trash**, and every step but **Pass** has a card count next to it. **Remove**
deletes a step, and **Add Step** adds a pass and a pick at the end.

- **Pick** with a count of 2 has the drafter take two cards in a row before passing.
- **Pass** hands the pack to the next drafter.
- **Trash** has the drafter discard a card from the pack without drafting it.
- **Randomly Pick** and **Randomly Trash** take or discard a card at random.

Until you change a step, the list shows the default (**Pick** 1, **Pass**, over and over, ending on
a pick) and keeps up with the slots as you add or remove them. Once you change, add, or remove a
step, the steps are fixed, and keeping them in line with the slots is up to you.

### Errors

Problems with the steps are listed in a red box above the pack editor. "Pack 1" in these messages
is the Lore Seeker pack.

- **Pack 1 cannot end with a pass action.** The last step is a **Pass**; make it a pick or trash,
  or remove it.
- **Pack 1 has 16 slots but has steps to pick or trash 15 cards.** The counts on the **Pick**,
  **Trash**, **Randomly Pick**, and **Randomly Trash** steps don't add up to the number of slots
  (a blank count counts as 1). This usually means a slot was added or removed after the steps
  were changed.

These checks only look at changed steps; a pack still on the default steps never shows them. They
don't stop you saving, so fix them first. A pack whose steps take fewer cards than it holds loses
the rest when the steps run out, and one whose steps ask for more simply ends when it's empty.

The editor doesn't check the filters themselves. A filter that matches nothing in the cube, or
nothing that's left once the regular packs are dealt, cuts the pack short at that slot.

### Saving and switching back

A change to the setting joins the [change list](/wiki/cube-page/list#the-change-list) as an edit to
that card, and nothing is stored until you click **Save Changes**. A pack can have at most 30
slots, as in a draft format, and a larger one isn't saved.

Switching the dropdown back to **Default** discards the custom pack right away: choosing **Custom**
again starts over from the 15-slot booster. If you switch by mistake, reverting the card's edit in
the change list (the X beside it) before saving brings the saved pack back, though it also undoes
the card's other unsaved changes. Saving with **Default** selected clears the custom pack from the
card.

The setting belongs to that one copy of Lore Seeker, so two Lore Seekers in the same cube can have
different packs. Swapping the card to another printing of Lore Seeker keeps its pack. Copying it
with **Add to another Cube** or the [cube tray](/wiki/cube-tray) doesn't carry the pack along: the
copy starts on **Default**. CSV exports leave the setting out too.

## After the draft

### The deckbuilder

Notes stay on their cards in the [deckbuilder](/wiki/cube-page/playtest#the-deckbuilder), on the
name bar. Removed cards aren't in your pool, and a Cogwork Librarian you put into a pack is no
longer yours: whoever drafted it next has it. Bots build their decks from what they ended up with,
the same way.

### The deck page

On a [deck page](/wiki/cube-page/playtest#the-deck-page), **Deck View** and **Visual Spoiler** list
the selected seat's draft information below the deck:

- **Draft notes** lists each noted card with its notes, such as **Garbage Fire: Pick 5** or
  **Cogwork Tracker: Passed by Seat 5**.
- **Removed (3)** lists the cards that seat removed from the draft.

Each seat shows its own, bots included, so the seat selector shows what each bot noted and
removed.

The **Pick by Pick Breakdown** replays the draft exactly as it happened, added packs included.
Picks that weren't plain picks carry a label after the pick number:

| Label                                                | Meaning                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| **Cogwork Librarian** or **Leovold's Operative**     | An extra card taken with that card's ability.                 |
| **Took the whole pack (Agent of Acquisitions)**      | One of the cards taken with Agent of Acquisitions.            |
| **Last card from Seat 3 (Canal Dredger)**            | A last card sent to this seat by Canal Dredger.               |
| **Removed from the draft**                           | A card removed with Cogwork Grinder or Animus of Predation.   |
| **Random pick, pack face down (Archdemon of Paliano)** | A random pick while Archdemon of Paliano was face up.       |
| **Random pick**                                      | A pick made by a **Randomly Pick** step.                      |
| **Trashed**                                          | A card trashed by a trash step.                               |
| **Lore Seeker pack**                                 | A pick from an added pack; combines with the labels above.    |

Packs passed without drafting, after Leovold's Operative or Agent of Acquisitions, don't appear.

## What isn't supported

Some draft text isn't run, and a few rules work differently from a paper draft:

- Deal Broker is drafted face up, but the trade it offers right after the draft isn't supported.
- [[Worldknit]], [[Arcane Savant]], [[Caller of the Untamed]], and [[Volatile Chimera]] only do
  something when a game starts, using the cards you drafted, so the draft treats them as ordinary
  cards.
- Bots never use Illusionary Informant or Whispergear Sneak.
- Noble Banneret, Paliano Vanguard, and Smuggler Captain are switched on ahead of time rather than
  offered as each card arrives, so once one is on, the next card that fits is noted even if it
  reached you without a pick.
- Cube Cobra doesn't track which card removed a card. With both Cogwork Grinder and Animus of
  Predation face up, every removed card counts toward the Grinder's **Removed** count, and every
  removed creature toward the Animus's keywords.
- A revealed card removed from the draft still takes effect during the draft, as described under
  [Cogwork Grinder and Animus of Predation](#cogwork-grinder-and-animus-of-predation).
- Lore Seeker packs come from the cube and are fixed when the draft starts; nobody brings a booster
  of their choice.

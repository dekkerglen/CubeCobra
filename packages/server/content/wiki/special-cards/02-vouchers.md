---
title: Vouchers
description: One card in a pack that hands the drafter a whole list of cards.
order: 2
---

A voucher is a placeholder card that holds a list of other cards. It sits in a board and in packs
as a single card, and the player who drafts it gets everything on its list instead. A voucher named
"Oracle Combo" holding [[Thassa's Oracle]] and [[Demonic Consultation]] guarantees the combo goes
to one drafter in one pick; a voucher holding five Snow-Covered Islands and five Snow-Covered
Mountains hands out a snow manabase the same way.

## Creating one

Open the edit panel on the [List tab](/wiki/cube-page/list), type `Voucher` into the **Add Card**
box, and pick it from the suggestions. An empty voucher joins the change list, listed as
"Voucher". Click it, in the list or in the change list, to open the voucher editor. As with any
edit, nothing is saved until you click **Save Changes**.

Until it's given an image, a voucher is drawn with the same blank frame as an unimaged custom card,
titled "Custom Card".

## The voucher editor

The voucher editor is its own window, marked with a **Voucher** badge next to the name. The left
side manages the contents; the right side edits whichever entry is selected.

### Contents

**Voucher Contents** lists what's inside, with a running card count. Type a card name into the
search box and press Enter, or click the plus button, to add it. New cards come in at the cube's
default printing, with a status of Not Owned and a finish of Non-foil. Add the same card several
times for several copies.

The list starts with the voucher itself, marked **(self)**, followed by each card inside it.
Clicking an entry selects it for editing and shows its image below the list. The X beside a card
takes it out of the voucher.

### The voucher's own fields

With the voucher selected, the right side holds **Add a Copy** and the same fields as a [custom
card's editor](/wiki/special-cards/custom-cards#the-editor): **Name**, **Status**, **Finish**,
**Mana Value**, **Type**, **Rarity**, **Image URL**, **Image Back URL**, **Color**, **Color
Category**, **Notes**, and **Tags**.

These describe the voucher as a card in your list: what it's called, where it sorts, which filters
match it, and which slot of a custom draft format it can fill. They have no effect on the cards
inside. A voucher holding two blue cards still sorts as colorless until you select blue in its
**Color** field.

There are no upload buttons here. Lotus Cobra supporters can upload the image in
[My Images](/wiki/account-settings#my-images) and paste its address into **Image URL**.

### Each card inside

With a card from the contents selected, the right side edits that copy:

- **Version** picks the printing.
- **Status** and **Finish** work as they do for any card.
- **Custom Image URL (optional)** replaces the printing's image with your own; leave it blank to
  use the printing's image.
- **Remove from Voucher** takes the card out.

The footer works as it does for any card: **Remove** stages the voucher's removal, and **Move To**
sends it to another board.

## What drafters see

In a pack, a voucher is one card, shown by its image. Drafters don't see a list of what's inside,
so give it an image or a name that says what it holds.

Drafting a voucher opens it. The voucher swells, shakes, and bursts in a flash of light, and the
cards inside fly out and land in the drafter's pool, sorted like any other picks: creatures in the
top row, everything else below, in columns by mana value. With **Disable Animations** turned on in
[Account Settings](/wiki/account-settings#display-preferences), the cards simply appear in the
pool. The voucher itself never reaches the deck. An empty voucher is the exception: with nothing to
hand out, the drafter gets the voucher as an ordinary card.

The cards inside keep their status, finish, and custom image. Because they're real cards, a deck
built from them exports like any other deck.

A voucher's contents are fixed when the draft starts. Editing the voucher afterward changes future
drafts, not ones already under way or finished.

Vouchers are opened in booster drafts, standard and custom formats alike, and in sealed. Grid and
Housman drafts don't open them: a voucher taken there stays a single card in the pool.

## Sealed

When dealing a sealed pool, a voucher counts as one card, then gets replaced by its contents. Six
15-card packs draw 90 cards from the mainboard; if one of those is a voucher holding five cards,
the pool that lands in the deckbuilder has 94.

## Bots

The draft bots' [machine-learning model](/wiki/machine-learning) doesn't know vouchers, so it rates
one by its contents: a voucher is worth the combined rating of the cards inside it, each different
card counted once. A voucher with two strong cards is usually worth more to a bot than either card
alone, while ten copies of a basic land count the same as one. With **Show CubeCobra Bot Ratings**
turned on, the rating shown on a voucher in your pack is that combined value.

A bot that drafts a voucher receives its contents and builds its deck from them, just as a human
drafter does.

Smart Search leaves vouchers and their contents out when it works out what your cube is like, so
cards inside vouchers don't shape its suggestions.

## Searching, Cleanup, and Compare

`is:voucher` finds every voucher. They are not matched by `is:custom`, so use
`is:custom or is:voucher` to find both kinds of special card. Filters only ever look at the
voucher's own fields, never its contents: `t:creature` won't find a voucher full of creatures
unless the voucher's own **Type** says Creature. See the
[filter syntax reference](/wiki/reference/filter-syntax#cube-customizations).

[Cleanup](/wiki/cube-page/list#cleaning-up-boards) skips vouchers entirely, and leaves the cards
inside them alone too. [Compare](/wiki/cube-page/header-and-tools#compare) matches vouchers
between two cubes by name, ignoring capitalization; it doesn't look at what they hold.

## Prices and analysis

A voucher has no price, and the cards inside it aren't priced either. The price figures in
[analysis](/wiki/cube-page/analysis), on At a Glance and in the Prices view, count a voucher as
$0, and the Prices view leaves it out of its count of priced cards.

The rest of analysis treats a voucher the same way: as one card, with the voucher's own type,
colors, and mana value. The cards inside it don't appear in any analysis view, so tokens they make
are missing from the Tokens view.

## Importing and exporting

Only CSV carries a voucher's contents. An exported **Comma-Separated (.csv)** file marks each
voucher with `true` in its `Voucher` column and lists the contents in a `Voucher Cards` column, and
importing that file rebuilds the vouchers. To write one by hand, set `Voucher` to `true` and fill
`Voucher Cards` with the contents separated by `;`. Each entry is written the way you'd write a
line of a pasted decklist:

- `Demonic Consultation`, just the name, and Cube Cobra picks a regular printing;
- `Lightning Bolt [lea] 161` or `Lightning Bolt (LEA)` for a specific printing;
- `5 Snow-Covered Island` or `5x Snow-Covered Island` for several copies.

```
name,CMC,Type,Color,Voucher,Voucher Cards
Oracle Combo,2,Sorcery,UB,true,Thassa's Oracle; Demonic Consultation
Snow Lands,0,Land,,true,5 Snow-Covered Island; 5 Snow-Covered Mountain
```

The other columns set the voucher's own fields, as they do for a [custom
card](/wiki/special-cards/custom-cards#importing-and-exporting). Wrap a cell in double quotes if it
contains a comma, as any card name with a comma in it would need. An entry that matches no card
shows up in the import's list of missing cards, followed by the voucher's name in parentheses.

The `Voucher Cards` column records only each card's name and printing. A content card's status,
finish, and custom image don't survive an export and re-import; set them again afterward.

Every other [export format](/wiki/cube-page/header-and-tools#export) lists the voucher itself, not
its contents. **Card Names (.txt)**, **Card Versions (.txt)**, **Forge (.dck)**, and
**XMage (.dck)** write the voucher's name; **MTGO (.txt)** and **Arena (.txt)** write the generic
name "Voucher". **Print and Play (.pdf)** prints the voucher's own image.

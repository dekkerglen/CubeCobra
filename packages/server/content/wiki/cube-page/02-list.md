---
title: The List Tab
description: Display modes, sorting, filtering, editing, and bulk operations on the card list.
order: 2
---

The List tab is the heart of a cube's page: the full card list, drawn however you like, with all
the tools for keeping it up to date. Visitors can browse, sort, and filter; the cube's owner and
collaborators also get the editing tools described further down.

## Views

The entries under **List** in the sidebar are the cube's views. A view is a saved way of looking at
the cube: which boards it shows, which display mode it opens in, its default sorts, and optionally
a default filter. Every cube starts with three (Mainboard, Maybeboard, and Basics), and owners can
add their own under [Settings → Boards and Views](/wiki/cube-page/settings), like a "Lands" view
that opens the mainboard filtered to lands, already sorted by color identity.

Switching views resets the display mode and filter to that view's defaults, unless you've changed
them by hand during the session, in which case your choices stick. The **Show All Boards** toggle
in the display sidebar overrides the view's board selection and shows everything at once.

## Display modes

The selector in the navbar switches between five ways of drawing the list:

- **Table** is the classic Cube Cobra layout. Your primary sort becomes the columns, the secondary
  sort groups cards within each column, and card names are listed with hover previews. Clicking a
  group heading opens the group editor for every card in it.
- **Visual Spoiler** is a grid of card images. A dropdown controls how many cards sit in each row,
  from 1 to 12.
- **Curve** arranges cards by mana value within each color and splits creatures from
  non-creatures, so you can read the curve of every color at a glance.
- **Stacks** shows piles of overlapping card images, grouped by your sorts, similar to how drafting
  software lays out a pool. A dropdown sets 1 to 4 stacks per row.
- **List** is a spreadsheet. Each card is a row with its version, type, status, finish, mana value,
  color identity, and tags. This mode only appears for the cube's editors, since its purpose is
  fast inline editing: a settings icon chooses which columns are visible, pagination handles large
  cubes (10 to 100 rows per page), and checkboxes select multiple cards for bulk edits.

Hovering any card name shows the card image. Clicking a card opens its [card
editor](#the-card-editor).

## Sorting

The **Display** button in the navbar opens a panel with four sort selectors, which together control
how every display mode arranges cards:

1. The primary sort sets the columns (in Table view) or the top-level groups.
2. The secondary sort makes the groups within each column.
3. The tertiary sort orders the rows within each group.
4. The ordered sort settles the final order of cards inside the smallest group. Only sorts with a
   natural order are available here, such as Alphabetical, Mana Value, Price, Elo, or Release date.

There are several dozen sorts to choose from: color category, color identity, guilds, types, mana
value (in a few bucket sizes), rarity, set, artist, finish, status, price in various currencies,
Elo, popularity, date added, and more. If the cube has [custom
sorts](/wiki/cube-page/settings) defined, they appear in the same dropdowns.

Every cube starts with Color Category / Types-Multicolor / Mana Value / Alphabetical. Editors can
make the current selection the cube's new default with **Save as Default Sort**; anyone can go back
to the saved default with **Reset Sort**.

A card that matches more than one category in a sort is drawn in each of them, though counts only
tally it once. Two owner-only toggles adjust this: **Collapse Duplicates** shows each card only
once, and **Show Unsorted Cards** adds a column for cards that don't match any category.

## Filtering

The filter box in the navbar accepts Cube Cobra's [filter syntax](/wiki/reference/filter-syntax),
the same language used by card search, custom sorts, and draft format slots. A query like
`t:creature mv<=2 ci:w` narrows the list to cheap white creatures. The filter applies after a short
pause in typing, or immediately when you press Enter, and an indicator shows whether the syntax is
valid. While a filter is active, the page reports how many cards matched out of each board's total.

If you'd rather not write syntax, the **Advanced Filters** button opens a form with fields for
name, oracle text, mana value, colors, color identity, mana cost, type line, set, artist, rarity,
status, legality, tags, and more. Filling it out builds the equivalent filter string for you.

The active filter travels in the page URL, so a filtered view can be bookmarked or shared, and the
export tools in the [cube header](/wiki/cube-page/header-and-tools) can honor it.

## Editing the list

The **Edit** button (owners and collaborators only) opens the edit panel. By default it sits on the
right side of the page; an icon in its corner moves it below the list instead, if you prefer a
wide layout. On a brand-new empty cube it opens automatically.

Edits are staged, not applied instantly. Everything you do accumulates in a change list, and
nothing touches the cube until you commit it.

### Adding, removing, and swapping cards

A **Board** dropdown at the top of the panel picks which board you're editing: mainboard,
maybeboard, or any custom board.

The **Add Card** box autocompletes card names; picking one stages an addition. The input refocuses
after each add, so you can rattle off a stack of cards by typing and pressing Enter repeatedly. The
**Remove/Replace Card** box autocompletes against cards already in the board: leave the second
input empty to stage a removal, or name a replacement to stage a swap.

Two checkboxes change how the search behaves. **Specify Versions** lets you name an exact printing
by writing the set code and collector number in brackets, like `Lightning Bolt [lea-161]`. **Show
Extras** widens the search to promos, tokens, digital-only printings, and other versions that are
normally hidden.

### The change list

Staged changes appear in the panel as the change list: additions, removals, swaps, and edits, each
with its own icon, and each individually revertible with the X next to it. Clicking a staged card
opens its editor, and **Edit All New Cards** opens every newly added card in the group editor at
once, which makes short work of tagging a whole update as it comes in.

Staged changes are kept in your browser, so a half-finished editing session survives closing the
tab. If the cube changed in the meantime (say, a collaborator committed their own update), Cube
Cobra reconciles what it can and warns you about anything it couldn't carry over.

### Committing

**Save Changes** applies the change list to the cube, records it in the
[changelog](/wiki/cube-page/about), and updates the cube for everyone. If **Create Blog Post** is
checked, the commit also publishes a blog post with the change list attached; a title and body
field appear so you can write up the reasoning behind the update. The checkbox state is remembered
per cube. **Discard All** throws away every staged change.

## The card editor

Clicking any card opens its editor. Everyone sees the card's image (with a flip button for
double-faced cards), oracle text, current prices, and links to buy the card at TCGplayer,
Cardmarket, Card Kingdom, and Mana Pool. Editors can also change how this copy of the card behaves
in the cube:

- **Version** switches to any printing of the card; the image, set, and price follow.
- **Status** marks the copy as Not Owned, Ordered, Owned, Premium Owned, Proxied, or Borrowed.
  Statuses drive the purchase tools and the [price analytics](/wiki/cube-page/analysis).
- **Finish** picks non-foil, foil, or etched.
- Overrides for mana value, type line, color identity, and color category cover cards that play
  differently in your cube than their printed face suggests (a [[Bloodbraid Elf]] you always
  cascade into, a land that's really a spell slot, and so on). Sorting and filtering respect the
  overrides; a display option called **Use Base Card Data** switches back to printed values if you
  want to check.
- **Tags** takes freeform labels, with autocomplete against every tag already in the cube.
- **Notes** holds freeform text for your own reference.

**Restore to Default** clears the overrides. If the cube has several boards, a move control sends
the card to another board, and **Remove Card** stages its removal. Edits made here join the change
list like any other staged change.

## Editing cards in bulk

The group editor opens whenever you act on several cards at once: click a group heading in Table
view, or check rows in List view. It lists the selected cards with their combined price, and
applies changes to all of them in one pass: status, finish, mana value, type, color identity,
color category, and tags (either added to what's there or replacing it). It can also move the
whole group to another board or stage the removal of every card in it. Buttons at the bottom open
TCGplayer, Card Kingdom, or Mana Pool with the whole selection, for buying a group in one order.

## Importing many cards

The **Import** menu in the edit panel covers getting lists in from elsewhere:

- **Paste Text** takes a decklist, one card per line:

  ```
  Lightning Bolt
  Goblin Guide
  Monastery Swiftspear
  ```

  Quantities (`4x Lightning Bolt`) and specific printings (`Lightning Bolt [lea-161]`) are
  understood, and pasting CSV data works too, including a `board` column to route cards to
  different boards.
- **Upload File** runs the same parsing on a .txt or .csv file.
- **Replace with CSV Upload** swaps the entire list for the contents of a CSV, typically one
  exported from Cube Cobra. The upload is compared against the current list and turned into a
  normal change list of additions and removals, so the changelog stays meaningful and tags, notes,
  and statuses on unchanged cards survive.
- **Add Package** brings in a [card package](/wiki/packages), a community-curated bundle of
  cards like a themed cycle, in one step. The picker offers your own packages and the ones you've
  liked.

Everything imported lands in the change list first, so you can review and prune before committing.

## Tags and tag colors

Tags group cards by whatever matters to you: archetype, theme, cut priority. They're shown on
cards throughout the site and are filterable with `tag:` in the filter syntax.

| Tag     | Example cards                            |
| ------- | ---------------------------------------- |
| removal | [[Swords to Plowshares]], [[Doom Blade]] |
| fixing  | [[Command Tower]], [[Fellwar Stone]]     |

**Set Tag Colors** in the display panel assigns each tag a color, and those colors follow the tags
everywhere,
including sorting by tag. A separate toggle shows tag emojis inline next to card names, if your
tags use them.

## Browsing the past

Every commit is recorded, and the [changelog](/wiki/cube-page/about) can open a point-in-time view
of the list as it stood after any update. The snapshot page is read-only but otherwise fully
featured; all display modes, sorting, and filtering work, and a banner offers to jump to a
different date, compare that version against the present, or download it. Owners can go one step
further and [restore](/wiki/cube-page/settings) the cube to a past version outright.

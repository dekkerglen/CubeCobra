---
title: Cube Tray
description: Drag cards into your cubes from search, card pages, and other cubes' lists.
order: 7
---

The cube tray is a shortcut for adding cards to your cubes while you browse. It's a round green
button in the bottom-left corner of the screen that opens into a list of cube boards, each one a
drop target. Drag a card onto the entry for your cube's maybeboard and the card goes into that
board right away, without leaving the page you're on.

The tray is for signed-in users on desktop-sized screens. It never appears on phones, and dragging
needs a mouse or pen: on a touchscreen, dragging a card scrolls the page as usual. Without the
tray, the **Add to Cube** button on a card's page does the same job one card at a time.

## Where it appears

The tray shows up on pages built around browsing cards. On each, these card displays can be
dragged:

- [Search Cards](/wiki/search#finding-cards), including **Top Cards**: both the image grid and the
  rows view.
- [Card pages](/wiki/search#card-pages): the **Printings** table, for dragging a specific printing,
  and the **Often Drafted With**, **Often Cubed With**, and **Synergistic Cards** grids.
- [Cube list pages](/wiki/cube-page/list), for any cube you can view, not just your own: the
  **Table**, **Visual Spoiler**, and **Curve** display modes. Cards in **Stacks** and **List** mode
  can't be dragged.
- [Smart Search](/wiki/cube-page/analysis#smart-search) on a cube's Analysis tab.
- The [ML Playground](/wiki/machine-learning/ml-playground), when results are shown as a grid.

## Adding a cube board

Hover over the tray button to open it, then click **Add cube board**. In the **Add Cube Board**
window, pick a **Cube** and a **Board** (the mainboard, the maybeboard, or any custom board the cube
has) and click **Add to Tray**. The cube menu lists the cubes you own, pinned cubes first, then the
rest by most recent update.

You can save as many boards as you like, from as many cubes as you like; a long list scrolls.
Adding a board that's already in the tray doesn't create a duplicate.

## Dragging cards

Press on a card and start moving, and the drag begins: a small copy of the card follows the cursor
and the tray opens on its own, headed **Drop on a board to add**. Release over a board to add the
card; release anywhere else and nothing happens. A plain click, without moving, still opens the
card the way it normally would.

A message above the tray confirms each drop, like "Added Lightning Bolt to My Cube · Maybeboard",
or reads "Couldn't add Lightning Bolt" if the add failed.

What lands in your cube:

- **One copy per drop.** Drop the same card twice and the board gets two copies.
- **The exact printing you dragged**, rather than the cube's default printing preference.
- **The cube's default status, and nothing else.** Tags, notes, status, and finish don't come
  along from where you dragged the card, even out of another cube's list. Custom cards are the
  exception: they keep their details.

Each drop is saved immediately. There's no change list to review and no **Save Changes** step, and
the addition is recorded in the cube's [changelog](/wiki/cube-page/about#changelog) like any other
edit. No blog post is written. Dragging a card out of a cube's list copies it; the card stays where
it was. If you drop a card into the cube whose list you're looking at, reload the page to see it.

## Opening, closing, and removing boards

The tray opens while your pointer is over it and closes when you move away. Click the round button
to keep it open, and click it again to let it close.

Each board in the list shows the cube's name above the board's name, with an × to remove it from
the tray. Removing a board from the tray doesn't change the cube. Boards stay in the order you
added them and can't be reordered, so to move one to the bottom, remove it and add it again.

## Saved in this browser

Your tray boards are saved in this browser, not your account. They won't follow you to another
computer or browser, clearing your browser's site data erases them, and anyone who signs in on the
same browser sees the same list. The tray also keeps each cube's name as it was when you added the
board; if you rename the cube, remove and re-add the board to update it.

## Cubes you can't edit

The **Add Cube Board** window only offers cubes you own, so cubes where you're a collaborator can't
be added. If you don't own any cubes yet, the window says so. A saved board can also stop accepting
cards, for example when its cube has been deleted or a different account is signed in on this
browser. Drops onto it then fail with the "Couldn't add" message; remove the board from the tray.

## Turning it off

The bottom of the open tray has a **Disable this tray in settings** link, which opens
[Display Preferences](/wiki/account-settings#display-preferences) in your account settings. Check
**Disable the cube board tray (always hidden on mobile)** and click **Update**, and the tray
disappears from every page. Your saved boards stay in the browser in case you turn it back on.

---
title: Settings
description: Cube metadata, options, collaborators, boards and views, custom sorts, draft formats, and restore.
order: 7
---

The Settings tab appears in the sidebar only for the cube's owner and collaborators. It gathers
everything about how the cube is configured, in seven views. Overview and Options are owner-only;
the rest are open to collaborators as well.

## Overview

The cube's public identity. Everything here requires the cube to contain at least one card, which
keeps empty spam cubes from publishing content.

- **Cube name.**
- **Category** sets one optional category (Vintage, Legacy+, Legacy, Modern, Premodern, Pioneer,
  Historic, Standard, Set, Custom, or Bar) plus any number of prefixes (Powered, Unpowered,
  Pauper, Peasant, Budget, Silver-bordered, Commander, Battle Box, Multiplayer, Judge Tower,
  Desert, Twobert, Rules Modified, Color Restricted). Categories show as badges in the cube header
  and make the cube findable in category searches.
- **Image** picks the art shown in the header and on cube previews around the site, chosen from
  any card's art with the artist credited automatically. Supporters can upload a custom image
  instead.
- **Brief** is a tagline of up to 500 characters shown in the header, with Markdown support.
- **Short ID** sets the custom URL (`cubecobra.com/c/yourcubeid`). It has to be unique across the
  site, and changing it breaks old links using the previous ID; the cube's permanent internal URL
  keeps working regardless.

The pencil icon in the cube header edits the same fields.

## Options

Behavioral settings, each saved with one click:

- **Show Total Prices** controls whether visitors see the cube's price totals in the header and
  the purchase estimates. Turn it off and pricing stays private.
- **Disable Draft Notifications** stops notifications when someone drafts the cube.
- **Disable Clone Notifications** stops notifications when someone clones it.
- **Disable Follow Notifications** stops notifications when someone likes it.
- **Cube Visibility** offers Public (searchable by anyone), Unlisted (anyone with the link can see
  it, but it won't turn up in search and its blog posts don't reach follower feeds), or Private
  (only you).
- **Default Status** is the ownership status new cards get when added. New cubes start with Not
  Owned; if you own most of what you're adding, switching this to Owned early saves correcting
  statuses card by card later.
- **Default Printing** decides which printing is chosen when a card is added without a specific
  version: the Scryfall default, the most recent, the first, or the cheapest.

At the bottom, behind a confirmation, sits **Delete Cube**. Deleting is permanent, with no undo
and no restore afterward, so the confirmation requires typing the cube's name exactly.

## Collaborators

Collaborators are other users who can edit the cube with you. Add one by their exact username; they
get a notification, and from then on they can edit the list, boards and views, custom sorts, and
draft formats, and use the restore tool. They can't change the cube's name, options, or visibility,
can't post to the blog, can't manage other collaborators, and can't delete the cube. A cube can
have up to 20 collaborators, and a collaborator can remove themselves at any time.

Cubes you collaborate on are listed on your dashboard alongside your own.

## Boards and Views

Boards are the cube's card containers. Every cube has a mainboard, and most keep a maybeboard for
candidates and a basics board for the lands offered in the deckbuilder. You can add more, up to
twelve, for whatever the cube needs: a retired-cards board, a second configuration, an attractions
deck. Boards can be renamed, and an empty board that no view depends on can be deleted; the
mainboard is permanent.

Views are the entries that appear under **List** in the sidebar. Each view names one or more boards
to display, a default display mode (table, visual spoiler, curve, or stacks), its four default
sorts, and optionally a default filter and whether multiple boards are blended together or shown
separately. A cube can have up to twenty views, and they can be reordered by dragging. Views are
how a cube presents itself: a "Spicy Includes" view showing the mainboard filtered to a tag, an
"Everything" view mixing all boards, a curve-mode view per color. Whatever helps people read the
cube.

## Custom Sorts

A custom sort defines your own grouping and makes it available in every sort dropdown on the list
and analysis pages. Each sort is a named list of categories, and each category is a label plus a
[filter](/wiki/reference/filter-syntax). A "Role" sort might have categories like Ramp
(`o:"add {"`) or Removal (`o:destroy or o:exile`); a guild cube might sort by signpost archetype
tags.

Categories are matched in order, and a checkbox controls whether a card lands only in the first
category it matches or in every one that fits. Both the sorts and the categories within them can be
reordered by dragging.

## Draft Formats

Everything about how the cube drafts.

Toggles enable or disable the standard format cards on the [Playtest
tab](/wiki/cube-page/playtest) (draft, sealed, grid draft, and the multiplayer Draftmancer link)
for cubes where some of them don't make sense. Alongside those sit the cube's deckbuilding
numbers: the spell and land counts the autobuilder aims for (23 and 17 unless changed), the
default seat count for new drafts, and which board supplies basic lands in the deckbuilder.

Custom formats are the deeper tool. A format defines its packs slot by slot, and every slot is a
[filter](/wiki/reference/filter-syntax): a pack might be five slots of `tag:aggro`, one slot of
`t:land r:rare`, and nine unrestricted slots. Packs can draw from boards other than the mainboard,
individual packs can be shuffled or shown in a fixed order, and a format can allow the same card to
appear in multiple slots or insist every card is unique. Beyond the card pool, a format can script
the draft itself as a sequence of steps (pick, trash, random pick), so formats where you discard
cards face-up, or burn the rest of the pack after two picks, are all expressible. Each format has a
title and a Markdown description that drafters see on its card on the Playtest tab.

Formats can be exported as JSON files and imported into other cubes, which is how the community
shares them. One format (custom or standard) can be marked as the cube's default, and it becomes
the first thing visitors see on the Playtest tab.

## Restore

Cube Cobra keeps a version history of the card list, and the Restore view lists every saved
version with its timestamp. Restoring rolls the list back to that version. Rather than silently
rewriting history, the rollback is applied as a normal update, so the
[changelog](/wiki/cube-page/about) records exactly which cards came back and which left. Handy when
a bulk replace goes sideways or an experiment didn't pan out.

Restore covers the card list. Settings, blog posts, and drafts are untouched by it, and it can't
resurrect a deleted cube.

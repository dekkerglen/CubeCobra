---
title: Cube Header and Sharing Tools
description: The cube header, likes, sharing links, exports, comparing, and cloning.
order: 1
---

The header at the top of every cube page shows the cube's identity at a glance and carries the
tools for sharing it with the rest of the world.

## What the header shows

- The cube's name, with its card count next to it (for example, "540 Cube").
- The like count, which links to the list of everyone who has liked the cube.
- The owner's avatar and username, under a "Designed by" label, linking to their profile.
- Category badges, if the owner has set a category or category prefixes (like "Legacy" or
  "Peasant"). Each badge links to a search for other cubes in that category.
- The cube's brief, a short tagline the owner can set, rendered with full Cube Cobra Markdown.
- The cube's art in the background, with the artist credited in the corner.

The header appears full-size on the list, primer, blog, and changelog pages, and as a slim bar on
the rest. The chevron in the top-right corner collapses or expands it, and your choice is
remembered separately for each page.

If you own the cube, a pencil icon next to the name opens the overview editor, where you can change
the name, custom URL, image, brief, and categories. The same fields are available under
[Settings](/wiki/cube-page/settings).

## Like and Pin

When you're signed in and viewing someone else's cube, the header shows a **Like** button. Liking a
cube does three things: it adds the cube to your liked cubes (visible from your profile), it bumps
the cube's like count, and it subscribes your dashboard feed to the cube's blog posts. The owner
gets a notification when you like their cube, unless they've turned those alerts off. Click the
button again to unlike.

On your own cubes the button is replaced by **Pin**, which keeps that cube at the top of your
dashboard's cube list.

## Share

The **Share** button opens a dialog with everything you need to link people to the cube:

- The short URL, built from the cube's custom short ID (`cubecobra.com/c/yourcubeid`). The owner
  picks the short ID, and can change it later.
- The durable URL, built from the cube's permanent internal ID. This one never breaks, even if the
  short ID changes.
- A QR code pointing at the cube, downloadable as an SVG. Print it and tape it to the cube's box.

## Purchase

The **Purchase** menu links out to Mana Pool, TCGplayer, and Card Kingdom with the cube's list
preloaded, and shows an estimated total for each. There are two variants: buy the entire cube, or
buy only the cards whose status is Not Owned. Card statuses are set per card on the
[list page](/wiki/cube-page/list), so keeping them up to date turns this menu into a shopping list
for finishing the cube.

## Export

The **Export** menu downloads the list in whichever format your tools need:

- Card Names (.txt), one card name per line.
- Comma-Separated (.csv), the full list with statuses, tags, notes, and finishes. This is the
  round-trip format: the same file can be re-imported through bulk upload, so it doubles as a
  backup.
- Forge (.dck)
- MTGO (.txt)
- XMage (.dck)
- Arena (.txt), which opens a dialog with Arena-specific options first.
- Print and Play (.pdf), which asks for a few options and then produces a PDF of card images, nine
  to a page at actual card size on US Letter paper, for proxying the cube at home.

Three checkboxes apply to every format: **Export ALL boards** includes the maybeboard and any
custom boards instead of just the mainboard, **Use Sort** writes the cards in your current sort
order, and **Use Filter** exports only the cards matching your current filter.

Signed-in users also get **Clone Cube** at the top of this menu; see below.

## Compare

**Compare** puts this cube side by side with any other cube you name. The comparison page splits
the combined list into three groups: cards in both cubes, cards only in this cube, and cards only
in the other. Each group shows its count, the full sorting and filtering controls from the list
page work on the results, and an export button downloads the comparison as a text file.

You can also compare a cube against its own past: from any [changelog
entry](/wiki/cube-page/about), "Compare with Present" runs the same view between the historical
list and today's.

## RSS

The **RSS** button links to the cube's feed, which carries its 50 most recent blog posts, including
any change lists attached to them. Point a feed reader at it to follow updates without an account.

## Cube Map

**Cube Map** opens Lucky Paper's Cube Map with this cube highlighted. That external visualization
places cubes near others with similar card choices, so it's a good way to find cubes like the one
you're looking at.

## Report

If a cube contains content that breaks the site rules, the **Report** button flags it for the
moderation team. You'll be asked to confirm before the report is sent.

## Cloning a cube

**Clone Cube** (in the Export menu, signed-in users only) creates a full copy of the cube under
your account. The clone keeps the card list across all boards, the image, categories, tag colors,
custom formats, custom sorts, default sorts, and the default status and printing preferences. It
does not carry over collaborators, likes, followers, or draft history.

The new cube is named "Clone of [original name]", starts out unlisted, and its description links
back to the cube it came from. The original owner is notified that you cloned their cube, unless
they've disabled clone alerts in their settings. From there it's yours: rename it, set a short ID,
and make it public whenever it's ready.

---
title: Custom Cards
description: Making your own cards, giving them images, and how the rest of the site treats them.
order: 1
---

A custom card is a card you define yourself. It has no printing behind it, so everything the site
knows about it is what you type into its editor: name, type line, mana value, colors, rarity, and
image. In the list, in packs, and in decks it behaves like any other card.

## Creating one

Open the edit panel on the [List tab](/wiki/cube-page/list), type `Custom Card` into the **Add
Card** box, and pick it from the suggestions. A blank custom card joins the change list, ready for
the board selected in the panel's **Board** dropdown. Until you name it, it's listed as "Custom
Card" and drawn as a blank card frame with that title.

Click the card, in the list or in the change list, to open its editor and fill it in. Like every
other edit, nothing is saved until you click **Save Changes**.

To make several similar cards, finish one and use **Add a Copy** in its editor: the copy carries
every field, so only the differences need changing. For a whole set of designs, a CSV import is
faster; see [Importing and exporting](#importing-and-exporting).

## The editor

A custom card's editor has the same layout as any card's [card
editor](/wiki/cube-page/list#the-card-editor), with one swap: where a normal card has a **Version**
picker, a custom card has a **Name** field. The fields are:

- **Name** is what the card is called everywhere: the list, packs, decks, filters, and exports.
- **Status** and **Finish** work as they do for any card.
- **Mana Value** takes any number of zero or more, decimals included. It decides the card's column
  in curve views and in a drafter's pool.
- **Type (use - or — to separate types and subtypes)** is the type line. Words before the dash are
  types and supertypes, words after it are subtypes, so `Creature - Elf Druid` and
  `Creature — Elf Druid` mean the same thing. Type sorts and filters read this line, and a type
  that isn't a real Magic type, like `Gadget`, gets its own group after the real ones when sorting
  by type. A card with an empty type line lands in an "Unknown" group under the Types-Multicolor
  sort.
- **Rarity** picks Common, Uncommon, Rare, Mythic, or Special. New custom cards start at Common.
- **Image URL** and **Image Back URL** set the card's front and back images; see
  [Images](#images).
- **Color** is a row of five color buttons. The colors you select become both the card's colors
  and its color identity; select none for a colorless card.
- **Color Category** decides which color group the card sorts into. Left blank, it's worked out
  for you: Lands if the type line contains "Land", otherwise Colorless, the card's single color,
  or Multicolored, depending on how many colors it has. Hybrid is only ever set by hand.
- **Notes** and **Tags** work as they do for any card.

There's no field for rules text. What a custom card does is whatever its image says, so the image
is where the card's text lives. There's also no **Restore to Default** button, since a custom card
has no printed values to restore.

**Add to another Cube** in the editor copies the card into another of your cubes, name, image, and
other fields included.

## Images

Paste the address of any image into **Image URL**, and optionally a second one into **Image Back
URL** for a double-faced design. When a back image is set, the editor gains a **Turn Over** button
for checking both faces. The address must be a full `http://` or `https://` URL of at most 2,048
characters; anything else is dropped when the change is saved.

[Lotus Cobra](/wiki/account-settings#patreon-integration) supporters don't need to host images
elsewhere. The editor shows **Upload Front Image** and **Upload Back Image** buttons (on every
card, not only custom ones); each opens a **Choose Image** control, and once the upload finishes
the image's address fills the matching URL field. The uploaded image lands in your [My
Images](/wiki/account-settings#my-images) library and counts against its limits of 1,000 images and
1 GB. Deleting an image from that library breaks any card that still points at it.

A custom card without an image is drawn as the blank "Custom Card" frame everywhere cards appear as
pictures: the Visual Spoiler, packs during a draft, and finished decks. Every unimaged custom card
looks identical there, so in practice each one needs an image before it's drafted.

Viewers can turn custom images off. **Hide Custom Images**, in the menu on deck pages and in the
deckbuilder's **Display** menu, replaces every custom image with the card's printed one. A custom
card has no printed image, so for that viewer it shows the blank frame instead. The setting is
remembered by their browser and applies across the site until they turn it back on.

## In drafts

In a pack, a custom card shows its image like any other card. When drafted, its type line and mana
value decide where it lands in the drafter's pool: creatures in the top row, everything else below,
in columns by mana value.

The bots are a different story. Their [machine-learning model](/wiki/machine-learning) only knows
real cards, so every custom card gets a rating of zero. In a booster draft, standard or custom
format, a bot takes a custom card only when nothing else is left in the pack, and with **Show
CubeCobra Bot Ratings** turned on, a custom card's rating reads 0%. In a practice draft, expect your
custom cards to come back around late however strong they are.

Smart Search uses the same model to describe your cube, and it leaves custom cards out of that
picture. Its suggestions are based on the real cards in the cube only.

## Searching and filtering

`is:custom` finds every custom card, and `is:custom -has:image` narrows that to the ones still
waiting for art. Vouchers are not matched by `is:custom`; use `is:custom or is:voucher` to get
both. Filters that read printed data, like `o:flying` for oracle text or `s:lea` for set, never
match a custom card, since it has none. `is:override` never matches one either. The full list is
in the [filter syntax reference](/wiki/reference/filter-syntax#cube-customizations).

## Compare, Cleanup, and prices

[Compare](/wiki/cube-page/header-and-tools#compare) matches custom cards between two cubes by name,
ignoring capitalization: "Quillback Tinkerer" in one cube and "quillback tinkerer" in the other
count as the same card, whatever their other fields say.

[Cleanup](/wiki/cube-page/list#cleaning-up-boards) skips custom cards entirely. It can't tell
whether two custom cards are meant to be the same card, so it never removes one as a duplicate,
and there are no printings to update.

A custom card has no price. The price figures in [analysis](/wiki/cube-page/analysis) count it as
$0 and leave it out of the count of priced cards. It also never adds anything to the Tokens view,
which only knows about the tokens real cards make.

## Importing and exporting

A CSV import can create custom cards in bulk. Set the `Custom` column to `true`, and the `name`
column becomes the card's name. The other columns fill the matching fields: `CMC`, `Type`, `Color`
(letters from `WUBRG`, like `UR`), `Rarity`, `Color Category`, `status`, `Finish`, `board`,
`image URL`, `image Back URL`, `tags` (separated by `;`), and `Notes`. `Set` and
`Collector Number` are ignored for custom cards. A minimal file looks like this:

```
name,CMC,Type,Color,Rarity,image URL,Custom
Quillback Tinkerer,2,Creature - Goblin Artificer,R,uncommon,https://example.com/qt.png,true
Tidecaller's Pact,3,Sorcery,U,rare,https://example.com/pact.png,true
```

Any of the CSV routes in the **Import** menu works: **Paste Text**, **Upload File**, or **Replace
with CSV Upload**.

On the way out, **Comma-Separated (.csv)** writes every field along with `Custom` set to `true`, so
a custom card survives an export and re-import intact. That makes CSV the way to move custom cards
between cubes in bulk, or to back them up.

The other [export formats](/wiki/cube-page/header-and-tools#export) carry far less:

- **Card Names (.txt)**, **Card Versions (.txt)**, **Forge (.dck)**, and **XMage (.dck)** write the
  custom card's name, with no set.
- **MTGO (.txt)** and **Arena (.txt)** write the generic name "Custom Card" instead, and MTGO
  combines every custom card into a single line, such as `3 Custom Card`.
- **Print and Play (.pdf)** prints the custom image, or the blank frame for a card without one.

Game clients only know real cards, so none of them will recognize a custom card in these files.

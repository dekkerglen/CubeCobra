---
title: Custom Cards and Vouchers
description: Cards the database doesn't have, and single picks that hand a drafter several cards.
order: 3
---

Every card in a cube normally points at a real printing in Cube Cobra's card database, which is
where its name, image, type line, prices, and bot ratings come from. Two special entries work
differently. Both are added from the same **Add Card** box as any other card, both sit in a board
like any other card, and both are edited by clicking them in the list.

A **custom card** is a card the database doesn't have. You supply everything about it: name, type
line, mana value, colors, rarity, and image. Use one for a card of your own design, a playtest or
house-rule card, or anything else with no printing to point at. Drafters see it as an ordinary card
with your image on it. [Custom Cards](/wiki/special-cards/custom-cards) covers creating and editing
them, and what the rest of the site does with a card it knows nothing about.

A **voucher** is a placeholder that stands for a list of real cards. It sits in a pack as a single
card, and whoever drafts it receives everything inside it instead. Use one when several cards
should always go to the same player: a combo pair like [[Thassa's Oracle]] and
[[Demonic Consultation]], a run of snow basics, or a package that only works as a whole.
[Vouchers](/wiki/special-cards/vouchers) covers building them, what drafters see when they take
one, and how they behave in sealed, with bots, and in exports.

## Which one to use

Ask whether the cards exist. A card that isn't in the database has to be a custom card. When every
card already exists and the goal is to hand a drafter several of them for one pick, use a voucher:
its contents are ordinary cards with their real images and ratings, so the deck that comes out of
the draft is made of real cards.

The two have a few things in common. Neither has a price, the **Cleanup** tool skips both, and
Compare matches both by name. Each has its own filter, `is:custom` and `is:voucher`, and
`is:custom or is:voucher` finds them all.

The changes here are concise, one liners to be put in a future user facing blogpost. Focus on the effect of the new feature, no technical details. Do not create line items for revisions to features introduced in the current changeset - a session of rapid revisions would pollute the changelog for what is effectively an entirely new feature.

New Features and Bug Fixes should be self explanatory, however technical changes are changes to how the site works that don't significantly impact the end user, but we still want to document. For example a technical change may be a security patch or switching to a different linter.

/////////////////

## New Features

- In the phone draft, pinch the pack or your pool to make its cards bigger or smaller. Each keeps its own size, and a zoomed-in pack scrolls.
- In the phone draft, the tab on top of your pool pulls it up to fill the bottom two thirds of the screen, and tapping it again puts it back.
- In the phone draft, press and hold a card in your pool to see it full size.
- Cards you drag in a draft or the deckbuilder now lean gently into the motion and settle back smoothly, without bouncing.
- When you draft a voucher, it bursts open and the cards inside it fly into your pool.
- Choose which daily games can show up on your dashboard under Display Preferences in your account settings. Daily P1P1 now has its own checkbox instead of following Hide featured cubes.
- A new Display Preferences setting hides cards that only exist as Universes Beyond printings from card search, Smart Search, Seed Crystal and the related cards on card pages. Cards that also have a regular printing stay, shown in that printing, and searching for `is:ub` still finds them.
- Card pages have a new Tags tab listing the card's Scryfall oracle tags and the printing's art tags. Click a tag to search for every card that has it.
- Split cards, battles, planes and schemes now turn the right way up in hover previews, the card window and on card pages, instead of showing sideways.
- Deck archetypes are now recognized from what the cards do, using Scryfall's oracle tags, and cover around a hundred strategies instead of 37 hand-picked ones.
- Cube analytics has a new Archetypes view showing which archetypes your card list supports and the cards that carry each one.
- Comparing two cubes has a new look: the cubes face off in a split banner, a bar shows how much of each list they share, and clicking part of the bar shows just those cards laid out like a cube list. Comparing a cube to an earlier version shows what was removed and added.
- The new ML Playground, under Cards in the Explore menu, puts the card recommender to work on any list you paste: Smart Search against your list, the bot's pick from a pack, the deck a bot would build from a pool, the archetype a deck reads as, or a seed list grown into a full cube.
- CSV exports now list what each voucher holds in a new Voucher Cards column, and CSV uploads read it, so a cube of vouchers can be set up or copied in one upload.
- The public data exports now record when each draft happened, and every pick names the draft it came from.
- The public API can now fetch a cube's details without its card list.
- A new Cleanup button in the cube list's edit panel tidies one or more boards in one click: drop duplicate entries, including copies of mainboard cards sitting on the maybeboard, or move every card to its default, most recent, first, or cheapest printing. The changes land in your change list to review before you save.
- Filtering a cube by quantity, count, copies, or singleton now counts copies of the same card together even when they're different printings under different names, and stops counting cards you've already staged for removal.
- Type in a whole finished event at once with Input Finished Event on a cube's records: the details, every player and their deck (typed, pasted, or scanned from a photo), and either each round's pairings and results or just each player's final record. Edit Record opens the same page for any record.
- Run a live event from its record: seat players around a table by hand or at random, then pair each round across the table, by record, at random, or by hand, with byes for odd numbers, and report each match's result with one tap.
- Each round of a live event can have a clock that stays in sync on every device, and Show Pairings puts the round's tables, results and clock on a full screen for a projector so players can find their seat.
- Record standings now rank by points with the official OMW%, GW% and OGW% tiebreakers and update as results come in. Players can be dropped from later rounds, and Finish Tournament locks the standings and hands out trophies.
- A record's page is now split into Players, Matches, Decks and Standings tabs. A player without a deck gets an upload link that picks them for you, and a record can be deleted from its own page.
- The records list starts an event, inputs a finished one, or creates one from a draft or an import, and shows each record's player count, rounds and winner.
- Decklists pasted when uploading or contributing a record deck now put cards under a Sideboard heading on the sideboard, as in Draftmancer exports.

## Bug Fixes

- Sorting by Color Category puts Hybrid and Multicolored cards before Colorless again, as it did before December 2024. This affects the cube list views, deck views, and exports.
- Smart Search says how many pages of suggestions there are, and jumping to a later page no longer waits on every page before it. A search with no results says so instead of showing Page 1 of 0.
- Smart Search now finds conspiracies, planes, schemes, contraptions, and other cards that start the game outside your deck. Searching for them used to return no results.
- With Disable Animations turned on, cards you drag in a draft or the deckbuilder no longer tilt back and forth as you move them.
- In a draft, a card you draft on a phone, or click over to your sideboard or back, now lands in full view at the bottom of its stack, instead of getting tucked into the middle of it.
- Scrolling during a draft on an iPhone no longer makes the page jump wildly up and down, and the cards no longer rearrange themselves as the browser's toolbars slide in and out.
- Turning Cogwork Librarian or Leovold's Operative back off partway through a pick no longer freezes the draft. Drafts already stuck this way pick back up after a page reload.
- Drafts with packs made of vouchers can be drafted again. Bot picks no longer fail on large voucher packs, which kept you from picking anything.
- Customizing a Lore Seeker's pack on a phone no longer stretches the card window past both edges of the screen.
- Saving a large batch of changes, such as replacing a cube from a CSV, no longer fails with "Operation timed out".
- When saving cube changes fails, the error now says what went wrong instead of always reporting a timeout, and the blog post you wrote is kept so you can try again.
- The public data exports no longer leave out one particular card everywhere it appeared in cubes, decks and picks.
- If saving a CSV replace fails, the bulk upload page stays open with your changes instead of jumping back to the cube list.
- A save whose changes went through but whose blog post failed no longer leaves the changes pending, so saving again no longer reports that the cube was updated since you started editing.
- The daily crossword no longer goes missing on weekends, as it did on November 7 and 8. Sunday's puzzle is now 15x15, one size up from Saturday's.
- Tabs across the site now show a pointer cursor when you hover over them.
- The Add to Cube window now shrinks the card to fit the screen, so the cube and board choices are always in view instead of hidden below a scroll.
- Dev blog posts show up in everyone's dashboard feed again. Since 2022 they had only reached people following the author.
- Show More on a comment thread now adds the next comments to the bottom of the list you're reading, instead of putting them on a second page out of view.
- Comment replies now load when you open them, so threads load faster, and a comment with more than 10 replies says 10+ until you do instead of claiming exactly 10.
- Card images in tables in blog posts, descriptions and comments now keep a steady size and follow the column's alignment, instead of shrinking to a sliver on phones.
- Token images on the Tokens analytics page have rounded corners like every other card image.
- Editing the players on a record made from a draft no longer renames the draft's decks after the players, unlinks the people who drafted them, or scrambles the pick history.
- Records made from a bot draft can have their players edited. Their unnamed players all shared one name, so saving was refused.
- Records named automatically no longer show a different date in their name than in the Date column in some time zones.
- Signed-out visitors can page through a cube's records list. The second page had asked them to log in.
- Error messages meant to show in red, in about a dozen places across the site, now do.

## Technical Changes

- The navigation bar no longer redraws every time a draft updates, and keeps cubes that share a name apart.
- The web server's request size limit now matches the site's own limits. It had been silently capping requests at 1MB.
- Browser security reports that are too large or cut off mid-send are now quietly dropped instead of being logged as server errors.
- Mentioning someone with @ in a comment or blog post now notifies only people actually named in the saved post, each once, up to a set number per post.
- A post written to make a row of card images (`<<...>>`) take seconds to draw now loads quickly, with that row left as plain text.
- The card recommender now retrains automatically after each quarterly data export, on drafts from the last three years and cubes updated in that time. A new model goes live only after it matches the current one on held-out drafts and an admin approves it, and admins can roll back to any earlier model. Each retrain also finds and names deck archetypes automatically, and admins can rename them.

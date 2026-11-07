The changes here are concise, one liners to be put in a future user facing blogpost. Focus on the effect of the new feature, no technical details. Do not create line items for revisions to features introduced in the current changeset - a session of rapid revisions would pollute the changelog for what is effectively an entirely new feature.

New Features and Bug Fixes should be self explanatory, however technical changes are changes to how the site works that don't significantly impact the end user, but we still want to document. For example a technical change may be a security patch or switching to a different linter.

/////////////////


## New Features

- In the phone draft, pinch the pack or your pool to make its cards bigger or smaller. Each keeps its own size, and a zoomed-in pack scrolls.
- In the phone draft, the tab on top of your pool pulls it up to fill the bottom two thirds of the screen, and tapping it again puts it back.
- In the phone draft, press and hold a card in your pool to see it full size.
- Cards you drag in a draft or the deckbuilder now lean gently into the motion and settle back smoothly, without bouncing.
- Choose which daily games can show up on your dashboard under Display Preferences in your account settings. Daily P1P1 now has its own checkbox instead of following Hide featured cubes.
- Card pages have a new Tags tab listing the card's Scryfall oracle tags and the printing's art tags. Click a tag to search for every card that has it.

## Bug Fixes

- Smart Search now finds conspiracies, planes, schemes, contraptions, and other cards that start the game outside your deck. Searching for them used to return no results.
- With Disable Animations turned on, cards you drag in a draft or the deckbuilder no longer tilt back and forth as you move them.
- In a draft, a card you draft on a phone, or click over to your sideboard or back, now lands in full view at the bottom of its stack, instead of getting tucked into the middle of it.
- Scrolling during a draft on an iPhone no longer makes the page jump wildly up and down, and the cards no longer rearrange themselves as the browser's toolbars slide in and out.
- Turning Cogwork Librarian or Leovold's Operative back off partway through a pick no longer freezes the draft. Drafts already stuck this way pick back up after a page reload.
- Customizing a Lore Seeker's pack on a phone no longer stretches the card window past both edges of the screen.
- Saving a large batch of changes, such as replacing a cube from a CSV, no longer fails with "Operation timed out".
- When saving cube changes fails, the error now says what went wrong instead of always reporting a timeout, and the blog post you wrote is kept so you can try again.
- If saving a CSV replace fails, the bulk upload page stays open with your changes instead of jumping back to the cube list.
- A save whose changes went through but whose blog post failed no longer leaves the changes pending, so saving again no longer reports that the cube was updated since you started editing.

## Technical Changes

- The navigation bar no longer redraws every time a draft updates, and keeps cubes that share a name apart.
- The web server's request size limit now matches the site's own limits. It had been silently capping requests at 1MB.

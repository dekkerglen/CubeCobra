The changes here are concise, one liners to be put in a future user facing blogpost. Focus on the effect of the new feature, no technical details.

- Tag searches now ignore hyphens, so `otag:boardwipe` finds board wipes just like `otag:board-wipe`.
- You can now use `has:` as an alias for `is:` in card searches (e.g. `has:commander`).
- Tag searches (cube tags, oracle tags, and art tags) now support exact matching with the `=` operator, so `otag=removal` finds only the exact tag while `otag:removal` still matches any tag containing it.
- Oracle and art tag searches now respect Scryfall's tag hierarchy, so searching a broad tag also finds cards that only carry a more specific one — e.g. `otag:leaves-body-behind` now finds Wurmcoil Engine (tagged `splits-on-death`).
- The cube tray is now available on card pages, so you can drag related, synergistic, and other-printing cards straight into your cube boards.
- Older cubes can be edited again — saving no longer fails with a "cube was updated since editing began" error.
- The wiki has been built out with new guides for the cube page and each of its tabs, search syntax, packages, profiles, and account settings.
- New sets and printings are importing again after a change on Scryfall's end stalled card updates.
- You can now export a cube as Card Versions (.txt), which lists each card with its set and collector number.
- Print and Play PDFs export correctly again — every card image had been failing to load.
- The sample pack buttons no longer run off the edge of the screen on narrow phones.
- Deleting a Pack 1 Pick 1 poll now removes it completely, instead of leaving behind an entry that couldn't be deleted.
- The draft simulator no longer treats cards from brand-new sets as near-guaranteed first picks.
- Closing the Set Tag Colors window without saving now discards the preview instead of leaving unsaved colors applied, and a save that fails keeps the window open and tells you.
- Bot decks no longer get stuck on "building" when you save your own deck while they're still being built, and a build that genuinely fails now says so instead of spinning forever.
- Resetting your password no longer asks you to re-enter your email address — the link from the email is all you need, and it now stops working once used or after six hours.
- Signed-out pages like login and password reset can no longer show you another visitor's error message.

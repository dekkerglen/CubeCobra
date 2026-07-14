The changes here are concise, one liners to be put in a future user facing blogpost. Focus on the effect of the new feature, no technical details.

- Tag searches now ignore hyphens, so `otag:boardwipe` finds board wipes just like `otag:board-wipe`.
- You can now use `has:` as an alias for `is:` in card searches (e.g. `has:commander`).
- Tag searches (cube tags, oracle tags, and art tags) now support exact matching with the `=` operator, so `otag=removal` finds only the exact tag while `otag:removal` still matches any tag containing it.


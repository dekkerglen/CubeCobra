The changes here are concise, one liners to be put in a future user facing blogpost. Focus on the effect of the new feature, no technical details.

- Tag searches now ignore hyphens, so `otag:boardwipe` finds board wipes just like `otag:board-wipe`.
- You can now use `has:` as an alias for `is:` in card searches (e.g. `has:commander`).
- Tag searches (cube tags, oracle tags, and art tags) now match the whole tag exactly with both `:` and `=`, so `tag:aggro` and `otag:removal` no longer also match tags like "aggro-loam" or "spot-removal".


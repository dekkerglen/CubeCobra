- drafts of a cube no longer update the cube's timestamp, bumping a cube's position in the "Recently Updated" list
- Added cube restore, to rollback the cards in a cube to a previous state
- Added self service account deletion
- Added the ability to edit attributes of newly added cards during a pending cube edit, allowing for workflows such as tag-on-create, specify a version, specify a status, etc.

remove the github actions CI action that comments the linting errors on PRs, instead make it a separate action, as a failing check works better without polluting the PR with comments

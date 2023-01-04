#!/bin/sh
npm run cards
node jobs/update_cube_history.js
node jobs/update_draft_history.js
node jobs/update_cards.js
node jobs/rotate_featured.js

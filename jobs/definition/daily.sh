#!/bin/sh
npm run cards
node jobs/update_cards.js
node jobs/rotate_featured.js

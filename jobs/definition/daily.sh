#!/bin/sh
npm run cards
node --max-old-space-size=32000 jobs/populate_analytics.js
node jobs/update_cards.js

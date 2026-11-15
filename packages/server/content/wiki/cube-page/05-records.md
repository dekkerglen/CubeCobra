---
title: Records
description: Running and logging paper draft events, from seating and pairings to win-rate analytics.
order: 5
---

The Records tab is for paper play. A record documents one draft event: who sat down, what they
built, how the matches went, and who took the trophy. You can run an event from its record as it
happens, with seating, pairings, and a round clock, or type one up afterward. Log your draft nights
here and the cube accumulates a real match history, which the Winrate Analytics view then turns
into card and archetype win rates.

The tab has two views, Draft Reports and Winrate Analytics. Anyone who can see the cube can read
both. Creating and editing records is for the cube's owner and its collaborators, and the controls
described below for changing a record only appear for them.

Draft Reports lists the cube's records 20 to a page, with each one's date, player count, number of
rounds, and winner. **Export All** in its header, open to any reader, downloads every record as a
records file that another cube can [import](#importing-from-elsewhere).

## Creating a record

The toolbar at the top of the tab offers three ways in:

- **Start an Event** is for an event about to happen. It asks only for a name, a date, and an
  optional description, then takes you to the new record to seat players and run rounds. See
  [Running an event live](#running-an-event-live).
- **Input Finished Event** opens a workspace for typing up an event that's already over, with
  players, decks, and results on one page. See
  [Entering a finished event](#entering-a-finished-event).
- **From an existing event** is a menu of imports: **Create from Draft**, **Import from Hedron
  Network**, and **Import from File**. See [Importing from elsewhere](#importing-from-elsewhere).

## The record page

A record's page opens with its name, date, and description (Markdown, so a writeup with card links
works fine), followed by four tabs: **Players**, **Matches**, **Decks**, and **Standings**.
Signed-in users also get a comment section at the bottom.

Under the name sit the actions for running the event, **Seating** and **Collect Decks**. Readers get
**View Seating** instead: the same round table without the controls, so a player can look up their
own chair, and tapping a chair highlights it. On the other side, **Edit Record** reopens the record
in the [entry workspace](#entering-a-finished-event), and the **More** menu holds **Export Record**
and **Delete Record**. Readers see **Export Record** on its own.

## Running an event live

An event counts as live until it's finished, for up to two days from its date. While it's live, the
record page adds the tools a running event needs: a round clock, prompts to pair the next round, and
drops.

### Seating

A new record with no players opens the seating editor on its Players tab, starting on **From a
list**. Once there are players, **Seating** reopens the same editor, starting on **Seat by seat**.
The two tabs are two ways to seat a pod:

- **Seat by seat** shows a round table. Pick a chair and type a name, or `@username` to link the
  player to their Cube Cobra account. Enter moves on to the next empty chair, so a queue of people
  at the door can be typed in without touching the mouse. Drag a player onto another chair to swap
  them, or use **Move to** in the chair's panel. **Shuffle Seats** randomizes everyone, and the
  table seats 2 to 16 (eight chairs to start).
- **From a list** takes one name per line, or names separated by commas, and seats everyone at once
  with **Seat Randomly** or **Seat in Order**.

Until a round has been paired, the table also pairs round one, either **Across the table** or
**Random** (with **Draw Again** for a fresh draw), and shows who each chair faces.
**Save and Pair Round One** saves the seating and creates that round together; **Save Seating Only**
leaves pairing for later. Seat order becomes the record's player order, which is what
across-the-table pairing reads.

A player who has already played a match can move seats or be renamed, but not removed; drop them
from the Standings tab instead. A record created from a draft played on Cube Cobra has its seats
fixed by who actually sat where, so there editors get **View Seating** and **Add Players** in place
of the full editor.

### Pairing rounds

On the Matches tab, **Record Matches** (on a record with no rounds yet) or **Add Round** opens the
round editor: the table again, with the suggested pairings drawn across it and each player's
current record in their chair. Pick how to pair:

- **Across the table**, the usual first round: each player meets the one seated opposite, seat 1
  against seat 5 in a pod of eight.
- **By record**, the usual later round: Swiss pairing, with players ranked by match points and
  paired down the standings, avoiding rematches where possible.
- **Random**: drawn at random, still avoiding rematches. **Draw Again** reshuffles.
- **Manual**: pick a player on the table, then their opponent.

The first round offers across the table, random, and manual; later rounds offer by record, random,
and manual. Whatever the method, picking two players on the table pairs them, so a suggested round
can be adjusted by hand, and a selected player's panel offers **Give the Bye** and **Unpair**. With
an odd number of players, one gets a bye, scored as a 2-0 match win; pairing by record gives it to
the lowest-ranked player who hasn't had one. Players who have dropped aren't paired.

**Edit as a List** switches to plain rows of player pickers, which also take results, for entering a
round after it was played. If the previous round still has matches without a result, the editor
warns you before pairing.

### The round clock

Once a round is paired in a live event, a clock banner stays pinned to the top of the record page,
above every tab. Set the round length (50 minutes by default) and press **Start Clock**. Editors
can **Pause** and **Resume** it, add time with **+5 min**, or **Clear** a paused clock. The
countdown turns amber for the last five minutes and red at time, then keeps counting into
overtime.

The clock is stored on the record, not on the device, so every phone and laptop showing the record
counts down from the same moment and a reload doesn't reset it. A full-screen button blows it up
for a projector or TV.

### Showing pairings

**Show Pairings** on the Matches tab puts the current round on screen for the whole room: every
match by table number, each player's record going into the round, the clock, and a **Find your
table** list in alphabetical order. Matches already reported show their score. Escape (twice, if
the browser went full screen) or the close button leaves it.

### Reporting results

Each round on the Matches tab lists its matches, with both players and the games each won plus
draws. Quick buttons (2-0, 2-1, 1-2, 0-2, 1-1-1) enter the common results in one tap, and every
change saves as you make it; if one doesn't go through, its row says **Not saved — try again**.
The round header counts results as they arrive ("3 of 4 reported") until it reads **All reported**.
Several devices can report into the same round. If two edits collide, the page catches up to the
latest version instead of overwriting it.

Once every result of a live round is in, the tab offers the next step: **Pair Round 2** (or 3, and
so on) or **Finish Tournament**.

Rounds stay correctable afterward with **Add Match**, the remove button on each match, and **Remove
Round**. The tab flags anyone paired against themselves or booked into two matches in one round.

### Drops and finishing

During a live event, the Standings tab has a **Drop** button beside each player, and **Undo** to
bring them back. A dropped player keeps their results and place but is grayed out and left out of
later pairings.

**Finish Tournament** shows the standings the event ends on and who takes the trophy: the leader,
unless you move the trophy to other players. It warns about any match still without a result.
Finishing stops the clock and puts away pairing and drops. The Matches tab then shows when the
tournament finished and who won, and **Reopen** undoes it.

## Entering a finished event

**Input Finished Event** opens one page for typing up an event that's already happened, whether
from a Draftmancer export, photos of paper decklists, or a standings sheet. Nothing is created until
the first save. **Edit Record** on an existing record opens the same page. It has four sections:

- **Event details**: name, date, and description.
- **Results**: choose **Pairings** to enter every match, or **Final records only** to type each
  player's win-loss-draw directly when the round-by-round results are lost.
- **Players**: add players by name or `@username`, reorder them by dragging (or **Shuffle
  Players**), and award trophies with the trophy icon. Expanding a player's row opens their deck,
  with the same entry tools as [deck upload](#uploading-a-deck). In Pairings mode, the pencil icon
  (**Override Player Record**) sets one player's record by hand when the matches don't tell the
  whole story.
- **Rounds** (Pairings mode only): **Add Round**, then fill in each match's players and results.
  **Unknown Opponent** stands in when a player's result is known but their opponent isn't.

**Save** keeps you on the page; **Save & Finish** saves and takes you to the record. If someone else
changed a section since you opened the page, that section isn't saved, and you choose **Keep
theirs** or **Keep mine**. A record holds up to 16 players.

A record attached to a draft played on Cube Cobra keeps its players lined up with the draft's seats.
Its players can be renamed but not added, removed, or reordered, and their decks are edited in the
deckbuilder instead.

## Importing from elsewhere

The **From an existing event** menu builds a record from something that already exists.

**Create from Draft** lists the cube's drafts. Pick one and **Create Record** makes the record
straight away, dated to the draft and named after that date ("Draft on 8 June, 2026"), with a
player for each seat and each player's drafted deck already attached. If your pod drafts through
Cube Cobra or Draftmancer and then plays in paper, this is the shortest path.

**Import from Hedron Network** reads a JSON export from Hedron Network, tournament software built
specifically for cube events. Paste it or use **Upload JSON File**, then **Parse and Continue**:
the event's name, date, players, rounds with results, and trophy come across for review. Players
who photographed their deck or pool in Hedron have those photos listed; pick the best one, rotate
it, and scan it into a decklist the same way as [scanning a photo](#scanning-a-deck-from-a-photo).
A pool photo can also be auto-built into an approximate deck. **Create Record** builds the decks and
saves the record.

**Import from File** takes a Cube Cobra records file: the JSON that **Export All** and **Export
Record** download from any cube, or one made by another tool in the same format. Upload it or paste
its contents, tick the records you want, and they're added to this cube as new records, decks
included. Importing the same records twice creates duplicates.

## Decklists

Each player in a record can have a deck attached, with a mainboard and a sideboard.

### Uploading a deck

Editors add decks from the record. **Upload a deck for** a player, on the Players or Decks tab,
opens the upload page with that player already chosen; a player who already has a deck can't be
given a second one. The **Select Player** list can also add a new player. The page offers several
ways to fill the same deck:

- **Add Card** takes one card at a time with autocomplete. By default it sticks to cards in the
  cube; **Show Cards not in Cube** opens it up for off-cube cards like unexpected basics or
  substitutions. The **Board** picker sends typed cards to the mainboard or the sideboard.
- **Add Basic Lands** adds any number of each basic, using the versions in the cube's basics board.
- **Paste a decklist** takes one card per line, with optional quantities like `2x Island`. Cards go
  in the mainboard until a `Sideboard` line, which sends everything after it to the sideboard.
  **Parse and Add** adds what it recognizes and leaves any unrecognized lines in the box to fix.
- **Scan deck from photo** reads card names off a picture.

Click a card in the mainboard or sideboard preview to take it back out, then **Upload**.

### Scanning a deck from a photo

**Scan deck from photo** opens a scanner. Choose a photo (phones offer the camera), rotate it so
most card names read left to right, and press **Scan deck**. Recognition runs entirely in your
browser, and the photo is never uploaded.

The review screen puts the photo beside a row for each card found, with a confidence score; hover a
row to spotlight that card on the photo. Fix a wrong name with autocomplete, pick one of the close
alternatives offered on low-confidence rows, remove false hits, or use **+ Add card** for anything
it missed. A card matched outside the cube is flagged "not in cube", usually one that's since been
cut. Tick **SB** on a row to send that card to the sideboard, then add the lot to the deck.

### Collecting decks from players

**Collect Decks** generates a link to drop in the group chat. Anyone who opens it, no account
needed, picks their name from the player list or adds themselves, can fix their name or swap in
their `@username`, enters their deck with the same tools (photo scanning included), and reports
their own win-loss-draw, which then stands as their result on the record. Signed-in players start
with their own username filled in. Treat the link like a password: anyone who has it can add to
the record.

### Viewing decks

The Players tab lists everyone with their record, and a trophy beside winners; pick a player to see
their deck. Everyone gets the **Export** menu (card names, Forge, XMage, MTGO, Arena, Cockatrice,
TopDecked, or CSV) and **Sample Hand** under **More**. Editors also get **Edit Deck**, which opens
the deckbuilder, plus **Clone and Rebuild** and **Remove Deck** under **More**.

The Decks tab shows every deck at once in stacks, with each player's record and the deck's
archetype name where it has one. **View deck** jumps to that player on the Players tab.

## Matches, standings, and trophies

The Matches tab lists every round, the latest expanded and the rest collapsed to a summary. Readers
see the same rounds, results, clock, and **Show Pairings** display, without the editing controls.

The Standings tab ranks players by match points (3 for a win, 1 for a draw), then by the usual
tiebreakers: opponents' match-win percentage (**OMW%**), game-win percentage (**GW%**), and
opponents' game-win percentage (**OGW%**). Hover a column heading for an explanation. As in Magic's
tournament rules, no percentage counts below 33%, and byes don't count toward opponents'
tiebreakers. Matches not yet reported count for nothing, and players linked to an account link to
their profile.

A player whose record was set directly, whether in the Final records only mode, with the override
pencil, or through the deck-collection link, is ranked by the points that record implies, with no
tiebreakers.

Trophies mark the winners. **Finish Tournament** awards them, and **Assign Trophies** on the
Standings tab checks off any number of players at any time. Winners get a trophy icon in the
standings and on the Players and Decks tabs, appear in the Draft Reports Winner column, and land in
the Trophy Case inside Winrate Analytics, so the cube builds up a hall of fame over time.

## Winrate Analytics

The Winrate Analytics view turns every record with decks and match results into cube-level
statistics. Nothing is computed until you click **Run analysis**. The work happens in your browser,
which loads the draft model (about 70 MB, cached after the first run) to group similar decks. Each
run is saved in your browser under **Recent runs**, so you can reload an earlier one and compare.
Anyone who can see the cube can run it.

Everything is measured against the cube's average match win rate. Win rate here is wins over
matches played, and a draw counts against both players, so the average sits at or below 50%. Green
marks a card or group above the average, red one below it. Cards that appeared in recorded decks
but have since left the cube are hidden unless you tick **Include cards not in current cube list**.

The analysis is laid out as a dashboard:

- **Win Rate by Color**, **Win Rate by Card Type**, and **Win Rate by Mana Value** chart how cards
  perform, weighted by how often they're played. A gold card counts toward each of its colors.
  **Win Rate Distribution** is a histogram of per-card win rates.
- **Color Performance**, **Color Pair Performance**, and **Color Combination Performance** total
  the match records of decks by color: every deck playing a color, every deck playing both colors
  of a pair, and decks of exactly one color identity. **Archetype Performance** groups decks by the
  archetype Cube Cobra's model assigns them, whatever their colors. Click any row for the decks
  behind it.
- **Color vs Color** and **Cluster Matchups** are head-to-head grids showing how decks of the row's
  color or cluster fared against the column's.
- **Deck Map** plots every recorded deck in two dimensions, so decks that play alike sit together,
  and groups them into clusters (it needs at least three decks). Color the map by **Cluster**, by
  **Deck color** (each dot a pie of the deck's colors), or by **Archetype**; the list above it
  ranks those groups by win rate. Clicking a group or a deck opens a detail panel with the group's
  staples, its most characteristic cards, every deck in it, suggested additions, and charts of its
  colors, card types, curve, and Elo. A selected deck also appears under the map, with a link to
  its record.
- **Reputation vs Reality** plots each card's draft Elo (how highly it's picked across Cube Cobra)
  against its Match Elo (how it actually performed in your records). Cards above the line are
  outperforming their reputation.
- **Trophy Case** lists every trophy winner across all records, with links to the player, the
  record, and the winning deck.
- Four leaderboards: **Overperformers** and **Underperformers** by Match Elo, **Most Played**, and
  **Trophy Leaders**.
- **Top Synergies** lists the card pairs that win most when played in the same deck. **Card
  Deep-Dive** takes one card and shows its best and worst partners, and the cards in opposing
  decks it beats and struggles against.
- **All Cards** is the full sortable table, including cube cards no deck has played yet: decks,
  how often the card made a deck when it was in the cube (**Play Rate**), match and game win rates,
  trophies, Match Elo, and draft Elo. **Download CSV** exports it.

Match Elo comes from this cube's match results alone: a card's rating rises when its decks beat
higher-rated opposition. It's a sturdier measure than raw win rate, which is why the leaderboards
rank by it.

The more of your draft nights you log, the more these numbers mean. A cube with a season of records
behind it can answer questions no amount of theorycrafting can: whether the aggro deck actually
wins, or just feels like it does.

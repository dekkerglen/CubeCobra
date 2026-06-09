# Cube Records — Investigation & Improvement Plan

> Deep-dive into CubeCobra's "Cube Records" feature, a competitive analysis of
> [cube-wizard.com](https://cube-wizard.com/), and a prioritized set of features
> and changes to make uploading records dramatically easier (fewer clicks).

---

## 1. Executive summary

Cube Records lets a cube owner record the results of a draft event: who played,
what they drafted, match results per round, standings, and trophies. Over time
this feeds card-level win-rate analytics for the cube.

The feature is **functionally rich but operationally heavy**. Today essentially
**all data entry is centralized on the cube owner**, decks must be **typed or
pasted in by hand**, and the import flows run **up to 6 steps with many page
transitions**. For a paper draft with 8 players, the owner faces dozens of
clicks and a lot of manual transcription before a single record is complete.

[cube-wizard.com](https://cube-wizard.com/) — a single-purpose competitor that
does _only_ this — wins on exactly the dimension we're weakest: **friction**.
Its entire submission is one screen: pick cube → pilot name → **photo of the
deck (OCR'd automatically)** → match record → submit. Critically, **each player
self-submits their own deck**, so the work is distributed across the table
instead of landing on the organizer. It even pulls cube data _from CubeCobra_.

The strategic takeaway: CubeCobra already owns the cube list, the draft engine,
the card database, user accounts, and decklists — everything Cube Wizard has to
bootstrap. If we close the friction gap (photo/OCR upload + player self-service +
collapsed flows) we make the competing product redundant.

---

## 2. How CubeCobra records works today

### 2.1 Data model

`packages/utils/src/datatypes/Record.ts`:

```typescript
export type PlayerList = {
  name: string;
  userId?: string; // optional — supports players without an account
}[];

export interface Match {
  p1: string;
  p2: string;
  results: [number, number, number]; // [p1 wins, p2 wins, draws]
}

export interface Round {
  matches: Match[];
}

export default interface Record {
  id: string;
  cube: string;
  date: number;
  name: string;
  description: string;
  players: PlayerList;
  matches: Round[]; // array of rounds
  draft?: string; // Draft ID; absent => no decklist data yet
  trophy: string[];
}
```

- **Storage:** DynamoDB single-table. `PK = RECORD#{id}`, `SK = RECORD`.
  GSI1 partitions by `RECORD#CUBE#{cubeId}` sorted by `DATE#{date}` desc for
  "records by cube."
- **Analytics:** computed on demand and written to S3 at
  `record_analytic/{cubeId}.json`, keyed by card oracle id
  (`packages/utils/src/datatypes/RecordAnalytic.ts`).

### 2.2 Decks are stored as a synthetic Draft

A record has no decklists of its own. When a deck is uploaded, the server
creates (or updates) a `Draft` of type `DRAFT_TYPES.UPLOAD` whose seats mirror
`record.players`, then stores the draft id on `record.draft`. Card analytics are
derived later by walking that draft's seats and cross-referencing match results.

### 2.3 Server routes

| Method   | Path                                                      | Purpose                                                      |
| -------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| GET      | `/cube/records/:id`                                       | List records for a cube (paginated)                          |
| GET      | `/cube/record/:id`                                        | View one record (overview/decks/standings/matches)           |
| GET/POST | `/cube/records/create/:id`                                | 2-step: name/desc → manual player list                       |
| GET/POST | `/cube/records/create/fromDraft/:id`                      | 2-step: name/desc → pick existing draft (auto-fills players) |
| GET/POST | `/cube/records/hedron/:id`                                | Import a Hedron Network JSON export                          |
| GET/POST | `/cube/records/uploaddeck/:id`                            | Upload one player's deck                                     |
| GET/POST | `/import/record` + `/import/record/:id`                   | Generic 6-step import                                        |
| POST     | `/cube/records/edit/overview/:id`                         | Edit name/date/description                                   |
| POST     | `/cube/records/edit/players/:id`                          | Replace player list                                          |
| POST     | `/cube/records/edit/round/add/:id` `/edit/round/edit/:id` | Add / replace a round                                        |
| POST     | `/cube/records/edit/trophy/:id`                           | Set trophy winners                                           |
| POST     | `/cube/records/list/:id`                                  | Paginated fetch (lastKey)                                    |
| GET      | `/cube/records/analytics/:id`                             | Recompile analytics (scans all records + drafts)             |
| DELETE   | `/cube/records/remove/:id`                                | Delete a record                                              |

Relevant files under
`packages/server/src/router/routes/cube/records/{create,edit/*,uploaddeck,import,hedron,list,analytics,remove}.ts`
and the DAO at `packages/server/src/dynamo/dao/RecordDynamoDao.ts`.

### 2.4 Frontend

- Pages: `CubeRecordsPage`, `RecordPage`, `CreateNewRecordPage`,
  `CreateRecordFromDraftPage`, `ImportRecordPage`, `RecordUploadDeckPage`,
  `ImportHedronRecordPage` (`packages/client/src/pages/`).
- Record view tabs: **Overview / Decks / Standings / Matches**
  (`packages/client/src/records/Record{Overview,Decks,Standings,Matches}.tsx`).
- Entry UI: `EditDescription`, `EditPlayerList` (drag-reorder + username
  lookup), `UploadDeck` (paste or card-by-card autocomplete), `EditMatchRound`,
  `EditTrophies`, plus the modals in `packages/client/src/components/modals/`.

### 2.5 Current upload flows (click count)

- **Blank record:** name/date/desc → manually add each player → submit. Then,
  _per player_, a separate "upload deck" page (select player → paste/auto-enter
  list → submit). Then matches entered round-by-round. Then trophies.
- **From draft:** name/date/desc → choose a draft → players auto-fill. Decks come
  from the draft. Still must enter all matches and trophies by hand.
- **Generic import (`/import/record`):** up to **6 steps** — is-this-your-cube? →
  choose cube → existing-or-new record → pick/create record → players-or-skip →
  upload deck. Lots of back buttons and page transitions.
- **Hedron import:** paste JSON; extracts players + rounds/matches.

---

## 3. Fundamental flaws (why records is painful today)

1. **Owner-only, fully centralized data entry.** Every write route requires
   `isCubeEditable(cube, user)` (effectively owner-only). Players at the table
   cannot submit their own deck or results. All transcription burden lands on one
   person, usually _after_ the event when memory has faded.

2. **Manual deck transcription.** `UploadDeck` supports a pasted list or
   card-by-card autocomplete only. For **paper** drafts there is no fast path —
   the organizer retypes 40+ cards per player. This is the single biggest time
   sink and the thing Cube Wizard solved with a photo.

3. **Too many steps / page transitions.** The generic import is 6 steps; even the
   "happy path" splits record creation, per-player deck upload, match entry, and
   trophies across many separate pages and modals.

4. **Fragile player↔seat mapping.** Decks live in a synthetic draft indexed by
   seat. Reordering players in `EditPlayerList` doesn't remap seats, and deck
   upload matches players **by name**, so duplicate names or reorders silently
   bind a deck to the wrong seat.

5. **Manual, expensive analytics.** `/cube/records/analytics/:id` is a manual GET
   that scans _all_ records and _all_ their drafts (O(n·m)) and writes S3. Nothing
   recompiles on save, so analytics silently go stale.

6. **Manual match entry with no scaffolding.** Every match (p1, p2, results) is
   entered by hand; no Swiss/round-robin pairing generator, no bulk/CSV import,
   no single-match delete (only whole-round edit/replace).

7. **No self-service entry point.** There's a QR-code affordance buried in the
   generic import for "not your cube," but no first-class shareable link that
   lets each pilot drop their deck + record into an event in one screen.

8. **Trophies/standings edge cases.** Trophy assignment silently drops names that
   no longer match a player; standings are derived but there's no validation that
   match results are internally consistent.

---

## 4. What cube-wizard.com does (competitive analysis)

A single-purpose analytics site for cube drafts. Sources & quotes from the live
site (June 2026).

### 4.1 Submission flow — the headline

One screen, three-to-four fields (`/submit`):

1. **Cube** — dropdown of registered cubes.
2. **Pilot Name** — free text (the player themselves).
3. **Deck Photo** — _"Tap to take a photo or choose a file"_, "JPEG, PNG, WebP,
   or HEIC — max 10 MB."
4. **Match Record** — W/L/D for that pilot.
   → **Upload Deck**.

Then: _"the system runs an OCR (Optical Character Recognition) process to
determine the list of cards included in each deck"_ and analytics are computed
from there. **Players self-submit**; the organizer doesn't transcribe anything.

### 4.2 Cube registration pulls from CubeCobra

`/addcube` asks for the **CubeCobra ID** (_"The short ID from your CubeCobra
URL, e.g. proxybacon"_), pre-fills the name from CubeCobra, optional description,
and a toggle to _"Automatically Sync Hedron Network Data."_ They are literally a
thin analytics layer on top of _our_ data.

### 4.3 Analytics

- **Card performance vs popularity** — win rate against inclusion rate.
- **Color performance** breakdowns.
- **Synergy / most-played card pairs** — "decks that contain both cards in the pair."
- **Trophy case** — recent undefeated decks.
- Win % = `W / (W + L)`; card win rates use **Laplace smoothing**; a **"Small
  dataset"** warning shows below **30 decks**.

### 4.4 Discovery

- **Pilot search** — find a pilot's decks across all cubes.
- Pages: Dashboard, Deck data, Card data, Color data, Synergy data, Submit, Add
  cube, Resources/overview.

### 4.5 What they _don't_ have (our advantages)

- No real draft engine, no card database of record, no accounts, no decklist
  editor — they bootstrap all of it from CubeCobra and a photo.
- No rounds/pairings model — just an aggregate W/L/D per submitted deck.
- Deck fidelity depends entirely on OCR of a phone photo.

**Conclusion:** their moat is _frictionless capture_, not data. If we add
photo/OCR capture + player self-service and collapse our flows, we are strictly
better.

---

## 5. Feature wishlist (prioritized)

### P0 — Close the friction gap (this is the whole game)

- **F1. Photo → decklist (OCR) upload.** Let a deck be submitted as one or more
  photos of the physical pile; OCR to oracle ids, show a quick confirm/fix
  screen, then attach to the seat. Mirror Cube Wizard's headline feature but with
  our card DB for far better matching (constrain candidates to cards in the cube).
- **F2. Player self-service submission via shareable event link / QR.** Owner
  creates an event (record) and shares a link/QR. Each pilot opens it, picks their
  name (or claims a seat), submits their deck (photo/paste/their existing drafted
  deck) and their match record — no owner transcription. Owner moderates.
- **F3. One-screen "quick record" creation.** Collapse the 2-step create and the
  6-step import into a single page: name + date prefilled, players entered inline
  (paste newline-separated names, or auto-fill from a draft), optional decks/matches
  deferred. Submit creates the record immediately; everything else is editable later.
- **F4. Auto-create records from finished drafts.** When a CubeCobra draft (live
  or uploaded) completes, offer a one-click "Create record from this draft" with
  players, seats, and decklists already populated — only standings remain.

### P1 — Reduce remaining manual entry

- **F5. Pairing / standings generator.** Generate Swiss or round-robin pairings
  for N players and R rounds; the owner just enters results per match. Auto-advance
  rounds. Bulk paste/CSV import of standings for events run elsewhere.
- **F6. Robust seat binding.** Bind decks to a stable seat/player id, not a name;
  make reordering safe; warn on duplicate names. (Fixes flaw #4.)
- **F7. Automatic analytics refresh.** Recompute (or incrementally update) card
  analytics on record save/deck upload instead of a manual scan; cache + invalidate.
- **F8. Player profiles & history.** A pilot's record history across a cube
  (and across cubes) — our analog to Cube Wizard's "pilot search," but backed by
  real accounts.

### P2 — Analytics parity & beyond

- **F9. Card performance vs popularity** chart (inclusion rate × win rate) with
  Laplace smoothing and a small-sample warning (their 30-deck threshold).
- **F10. Color / archetype performance** breakdowns.
- **F11. Synergy / card-pair** analysis (co-inclusion win rate).
- **F12. Trophy case / leaderboard** surfaced on the cube overview, not just the
  records tab.
- **F13. Hedron sync** improvements (we already import Hedron; make it a saved,
  re-syncable connection like Cube Wizard offers).

### P3 — Polish

- Single-match delete; record templates ("same group, new draft"); record
  duplication; CSV/JSON export of a record; consistency validation on match
  results; cascade-safe draft/record deletion.

---

## 6. Concrete changes to reduce clicks (the core ask)

Ordered by impact-per-effort. Each maps to existing files.

1. **Add a photo-OCR deck path to `UploadDeck`.**
   - Client: extend `packages/client/src/records/UploadDeck.tsx` with a "Photo"
     mode (file/camera input) alongside paste/autocomplete.
   - Server: new endpoint (e.g. `POST /cube/records/ocrdeck/:id`) that runs OCR
     and returns candidate oracle ids constrained to the cube's card pool, so the
     user only confirms — far higher accuracy than Cube Wizard's open OCR.
   - Reuses the existing draft-creation path in
     `routes/cube/records/uploaddeck.ts` once cards are resolved.

2. **Collapse the 6-step `/import/record` into ≤2 screens.**
   - `packages/client/src/pages/ImportRecordPage.tsx`: merge "is this your cube /
     choose cube" and "existing vs new record" into one screen with sensible
     defaults; defer player/deck entry to the editable record view.

3. **Make record creation one screen.**
   - Merge `CreateNewRecordPage` step 1 (`EditDescription`) and step 2
     (`EditPlayerList`) into a single page; prefill date to today; accept a
     newline-separated paste of player names with inline username lookup.

4. **Add "Create record from this draft" at the end of a draft.**
   - One-click entry that posts to the existing
     `/cube/records/create/fromDraft/:id` handler with players + decks already
     wired, dropping the user straight into standings entry.

5. **Player self-service submission link.**
   - Promote the buried QR/`/import/record` "not your cube" path into a
     first-class, shareable per-record submission link that needs only a logged-in
     (or guest) pilot to add their name + deck + W/L/D. Relax the strict
     `isCubeEditable` gate to an "event is open for submissions" mode the owner
     toggles, with owner moderation.

6. **Auto-refresh analytics on write.**
   - In the record edit/upload handlers, trigger an incremental analytics update
     (or enqueue one) instead of relying on the manual
     `/cube/records/analytics/:id` GET, so `WinrateAnalytics.tsx` is never stale.

7. **Stabilize seat binding.**
   - Bind uploaded decks to a stable player/seat id rather than matching by name
     in `uploaddeck.ts` / `EditPlayerList.tsx`; this removes a whole class of
     silent mis-assignments and lets us safely reorder/rename.

---

## 7. Open questions

- **OCR engine:** build vs. buy (cloud vision API vs. self-hosted)? Constraining
  candidates to the cube's ~360–720 cards makes a cheaper model viable and beats
  Cube Wizard's accuracy ceiling.
- **Guest submission:** do we allow non-account pilots to self-submit (matches
  the `PlayerList.userId?` optional design), or require login for moderation?
- **Trust/moderation:** self-service submissions need an owner approve/merge step
  to prevent spam on public cubes.
- **Analytics cost:** incremental update on write vs. scheduled batch recompute —
  pick based on record volume per cube.

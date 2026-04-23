# Draft Simulator — Code & Feature Review

Scope: all draft simulator code on `feature/draft-simulator`. ~10,552 lines across 8 files. Findings reference `file:line`.

## Executive Summary

The simulator is feature-rich and does a lot well: lazy-loaded TF.js inference, GPU OOM retry, deterministic clustering with multiple algorithms (HDBSCAN, Leiden, k-means, NMF), UMAP projection with PCA init, IndexedDB persistence with per-cube history, and sophisticated theme/skeleton analysis. It works.

But the page component has outgrown its file, test coverage is dangerously thin for code of this complexity, and several synchronous memos do heavy work on every render. The biggest risks are maintainability (6,673-line monolith) and correctness on the long tail (older runs missing `setupData`, WebGL OOM beyond one retry step). None are immediately user-facing; all will bite as the feature matures.

Recommendations in priority order at the bottom.

---

## 1. Architecture & Decomposition

### 1.1 `CubeDraftSimulatorPage.tsx` is a 6,673-line monolith
The file owns setup, simulation, deckbuild, persistence, clustering, theming, ~40 subcomponents, filtering, charts, and all UI. It has **97 `useState` calls** and 11 `useRef` calls in a single component.

Suggested decomposition:
- Extract `useSimulationRun()` hook: owns `status`, `simPhase`, `simProgress`, `modelLoadProgress`, `setupMs`/etc., `simAbortRef`, `handleStart`/`handleCancel` — roughly lines `CubeDraftSimulatorPage.tsx:4399-4609`.
- Extract `useLocalSimulationHistory(cubeId)` hook: owns `runs`, `selectedTs`, `displayRunData`, `handleLoadRun`/`handleDeleteRun`/`handleClearHistory`, `storageNotice` — roughly `CubeDraftSimulatorPage.tsx:4292-4379`.
- Extract `useClusteringPipeline(...)` hook: owns `skeletons`, `umapCoords`, `poolEmbeddings`, `clusterMode`/`knnK`/`resolution`/`numTopics`/etc. and the big effect at `CubeDraftSimulatorPage.tsx:4791-4835`.
- Split subcomponents into sibling files: `ClusterDetailPanel` (`:3474-3806`), `DraftMapScatter` (`:1662-1834`), `CardStatsTable` (`:1917-2180`), `SimulatorPickBreakdown` (`:2237-2460`), `DraftBreakdownTable` (`:2845-2975`), `SimulatorExplainer`, `FAQ_ITEMS`.

This is a mechanical refactor with no behavior change and lets future reviewers reason about pieces.

### 1.2 Subcomponent defined with a nested `useState` inside an IIFE
`CubeDraftSimulatorPage.tsx:3691`:
```tsx
{(() => {
  const tabs = [...] as const;
  type CardTab = typeof tabs[number]['key'];
  const [cardTab, setCardTab] = React.useState<CardTab>('common');
  return (<div>...</div>);
})()}
```
The IIFE runs on every render of `ClusterDetailPanel`, and the `useState` call inside it is technically fine because the Rules-of-Hooks care about call order, not lexical position — **but** this is fragile: if a sibling branch ever conditionally renders the IIFE it becomes a bug. Promote this into a real component (`ClusterCardsPanel`) and pass `skeleton`, `commonCards`, etc. as props.

### 1.3 Duplicated state-clearing blocks
`handleLoadRun` (`:4299-4305`), `handleDeleteRun` (`:4351-4354`), and `handleClearHistory` (`:4374-4377`) each manually clear `selectedCardOracles`/`selectedArchetype`/`selectedSkeletonId`/`focusedPoolIndex`. Extract a `resetViewSelection()` helper to keep them in sync — drift here would silently leak stale selections.

### 1.4 `pending*` mirror state
There are 28 `pending*` references (`pendingKnnK`, `pendingResolution`, `pendingNumTopics`, `pendingMinClusterSize`, etc.). The pattern is "edit in pending slot, commit on blur/enter." It works, but each parameter needs two `useState` calls and manual commit wiring. A tiny `useDebouncedInput(value, setValue, { commitOn: 'blur' })` helper would cut the boilerplate roughly in half.

---

## 2. Correctness & Edge Cases

### 2.1 Older runs lack `setupData` — silent accuracy degradation
`SimulationReport.ts:135` marks `setupData?` as optional, noted "enables exact filtered stat recomputation after reload." The page reads it at `CubeDraftSimulatorPage.tsx:5030` (`focusedFullPickOrderAvailable`) and in `computeFilteredCardStats` at `:1006` the fallback is:
```ts
return runData.cardStats.filter((c) => c.poolIndices.some((i) => activePoolIndexSet.has(i)));
```
This returns the **unfiltered** pick-rate/seen counts scoped only to pools, *not* the re-simulated stats. Users filtering by color/cluster on old runs see stale P1P1/pick-rate data with no UI indicator. Either:
- Badge runs missing `setupData` as "limited filtering" in the history list, or
- Recompute best-effort stats from pool picks + initial pack reconstruction if possible, or
- Drop support for pre-`setupData` runs with a migration notice.

### 2.2 WebGL OOM retry is single-level
`CubeDraftSimulatorPage.tsx:4478-4494` and `:4509-4523`: on `WebGLInferenceError`, `nextLowerGpuBatchSize(effectiveGpuBatchSize)` is called once; if the retry also OOMs, it throws. For users on weaker GPUs this is a one-shot. Consider looping:
```ts
while (batch && !success) {
  try { ... success = true; }
  catch (err) {
    if (!(err instanceof WebGLInferenceError)) throw err;
    batch = nextLowerGpuBatchSize(batch);
  }
}
if (!success) throw new Error('Out of GPU memory even at minimum batch size');
```

### 2.3 `skipClusterUntilSeed` token is fragile
`CubeDraftSimulatorPage.tsx:4290, 4222, 4319, 4330, 4798-4803`. The ref holds a `clusterSeed` value; the big cluster effect compares `skipClusterUntilSeed.current === clusterSeed` and skips re-clustering when they match. Works today, but:
- The effect depends on `clusterSeed` (`:4835`). If another dep changes *and* seed stays the same (user loads a run with cached skeletons, then tweaks `minClusterSize` without nudging seed), the skip flag clears on next seed change only — there's no test confirming this is actually safe.
- Replace with explicit `displayRunKey` state that identifies the source of current skeletons, and only re-cluster when key differs from the pipeline input key.

### 2.4 `computeClusterThemes` is called twice on the same inputs
`CubeDraftSimulatorPage.tsx:4847` (inside `clusterThemesByClusterId`) and `:4872` (inside `allPoolClusterThemes`) both call `computeClusterThemes(skeletons, displayedPools, activeDecks, displayRunData.cardMeta)` back-to-back. One memo with both outputs:
```ts
const clusterThemeData = useMemo(() => {
  if (!displayRunData || skeletons.length === 0) return { byClusterId: new Map(), poolThemes: undefined, tagAllowlist: undefined };
  const { poolThemes, tagAllowlist } = computeClusterThemes(skeletons, displayedPools, activeDecks, displayRunData.cardMeta);
  const byClusterId = new Map<number, string[]>();
  // ... merge logic
  return { byClusterId, poolThemes, tagAllowlist };
}, [displayRunData, skeletons, displayedPools, activeDecks]);
```

### 2.5 `extractThemeFeatures` subtype parse
`draftSimulatorThemes.ts:51-57`:
```ts
const subtypePart = type.split('—')[1] ?? type.split('-')[1] ?? '';
for (const subtype of subtypePart.trim().split(/\s+/).filter((s) => s.length > 1)) {
  features.push(`ctype:${subtype}`);
}
```
Edge case: types like `Legendary Artifact Creature — Elf Warrior` parse correctly, but `Legendary Enchantment Creature — God` runs into the `typeLower.includes('enchantment')` early-matcher too, so the card is counted as both enchantment and creature-type, which is probably desired — but cards with hyphenated names or set codes that slipped into the type string would corrupt subtype extraction. The `.length > 1` filter cuts single-letter noise; good. Consider: only split on `—` (em dash); `-` hyphen split is unlikely to be valid MTG type syntax.

### 2.6 `tagAllowlist` unused in first branch
`draftSimulatorThemes.ts:198-201`:
```ts
const tagAllowlist = new Set<string>();
for (const rankedTags of result.values()) {
  for (const { tag } of rankedTags) tagAllowlist.add(tag);
}
```
`computeClusterThemes` returns `tagAllowlist`, and `inferDraftThemes` filters `deckFeatureCounts` by it (`:221`). But the caller at `CubeDraftSimulatorPage.tsx:4847` discards the allowlist. This means the first call (feeding `clusterThemesByClusterId`) never applies allowlist filtering — fine because that path only uses `rankedTags` which are already filtered. The dual-use is correct but the naming is subtle; a comment in the consumer would help.

### 2.7 `computeFilteredCardStats` tiebreak on pack rotation
`CubeDraftSimulatorPage.tsx:1016-1022`: rotating packs creates a snapshot then writes in-place. Correct, but this runs inside a `numDrafts × numSeats` loop — for 500 drafts × 8 seats that's 4,000 full pack-array copies per pack-pass step. Acceptable for current scale; flag for revisit if numDrafts ever exceeds 1000.

### 2.8 Server `simulatesetup` does not validate output size
`simulatesetup.ts:68-106`: generates `initialPacks: string[][][][]` with no size ceiling. At `numDrafts=500, numSeats=8, packs=3, cards=15`, that's 180,000 oracle-id strings (~6MB JSON). Rate limiter at `:18` (8/30min) helps, but the response size is still unbounded in principle. Either:
- Enforce `numDrafts × numSeats × packs × cards ≤ MAX_CARDS_PER_REQUEST`, or
- Stream/compress initialPacks (they're deeply repetitive).

---

## 3. Performance

### 3.1 `topCardPairings` is O(N² × decks)
`CubeDraftSimulatorPage.tsx:4993-5020`: double loop over mainboard per deck. For 500 decks × 40 non-basic cards = 500 × 40²/2 = 400k pair updates. Fast enough in practice, and the `bottomTab !== 'sideboardAndPairings'` short-circuit at `:4994` gates it behind user intent — good pattern. Only flagged because if anyone extends this to 1000+ decks or 60+ card mainboards it will start hitching.

### 3.2 Synchronous heavy memos
`computeFilteredCardStats` (`:901-1030`), clustering effect (`:4791`), `topCardPairings` (`:4993`), `computeClusterThemes` calls all run on the main thread. When 500-draft runs become common, consider:
- Wrapping clustering + theme work in a Web Worker (share `poolEmbeddings` as transferable ArrayBuffer).
- Or at least memoizing by stable keys and surfacing a busy indicator.

### 3.3 `filteredCardStatsCache`/`embeddingsCache` have no eviction
`CubeDraftSimulatorPage.tsx:4306-4307`: reset on run switch, but within a single run session, every unique filter combination lives forever in the ref Map. At 100 filter permutations × ~500 cards × ~14 numeric fields each, that's ~700k number slots — fine for now, but add a simple LRU cap (say 20 entries) before the UI grows more filter dimensions.

### 3.4 HDBSCAN dense path is O(n²) memory
`draftSimulatorClustering.ts` exposes both `hdbscanAssignments` (dense) and `hdbscanFromKnnGraph` (sparse). The sparse path is preferred in the main effect; confirm via the clustering-method selection path that dense is never used on `>500` pools. A hard guard (`if (n > 800) throw` or force sparse) would prevent a user with a 10,000-draft run from nuking the tab.

### 3.5 TF.js lazy-load — good
`draftBot.ts` dynamic-imports TF.js and keeps it out of the main bundle. No complaint. The progress-listener pattern for multi-phase model loading is clean.

---

## 4. Testing Gaps

**Correction (reviewed more carefully):** There are already ~970 lines of simulator tests across 5 files — `draftSimulatorThemes.test.ts` (369), `draftSimulatorClustering.test.ts` (442), `draftBot.test.ts` (86), `draftBot.load.test.ts` (57), `botRatings.test.ts` (16). My initial claim of "only one test file" was wrong.

### 4.1 Coverage is actually decent — but still has gaps

Covered:
- `draftSimulatorClustering.ts`: `hdbscanAssignments`, `approximateUmap`, `computeSkeletons` (many invariant assertions — empty pools, basic-land exclusion, staple detection, sort order, sideboard cards, embeddings, each clustering mode), `cosineDist`, `leidenAssignments`, `nmfAssignments`.
- `draftBot.ts` pure helpers: `buildSeatMlMaps`, `chooseBestMappedOracle`, `colorDemandPerSource`, `calculateBasicsForDeck`.
- `draftSimulatorThemes.ts`: `extractThemeFeatures`, `computeClusterThemes`, `inferDraftThemes`, etc.

Still untested:
- `computeFilteredCardStats` (`CubeDraftSimulatorPage.tsx:901-1030`) — pure function, could be lifted into `packages/client/src/utils/` and tested directly.
- `persistSimulationRun` with quota-exceeded fallback (`:613-752`) — IndexedDB serialization boundaries.
- `hdbscanFromKnnGraph` specifically (tests exist for the dense `hdbscanAssignments` but the sparse kNN-graph path isn't exercised independently).
- The big main-page clustering orchestration effect (`:4787-4835`) — not unit testable in its current form; would need hook extraction (item #4).

### 4.2 Jest runner is broken
Running any simulator test triggers a Babel parse error (pre-existing Babel/TS config issue per `CLAUDE.md`). Tests *exist* but nobody runs them. Fixing the Jest+Babel config is the highest-leverage single action for this codebase — a test that can't run is the same as no test.

### 4.3 `draftSimulatorThemes.test.ts` depends on live `OTAG_BUCKET_MAP`
The test imports from `draftSimulatorThemes.ts` which imports from `otagBucketMap.ts`. Editing the 702-line hand-curated mapping can silently change theme test outcomes. The test should mock `OTAG_BUCKET_MAP` or the test should be read as "tests the current mapping" rather than "tests the theme logic."

---

## 5. State Management

### 5.1 State explosion
97 `useState` declarations. Many cluster into a natural grouping that could be `useReducer`-ified:
- **Filter state**: `selectedCardOracles`, `selectedArchetype`, `selectedSkeletonId`, `focusedPoolIndex`, `focusedPoolViewMode`, `cardStatsFilter`, `cardStatsSort`, etc. → `filterReducer`.
- **Run parameters**: `numDrafts`, `numSeats`, `formatId`, `clusterMode`, `knnK`, `resolution`, `numTopics`, `minPts`, `minClusterSize`, `pcaDims`, `clusterSeed`, `negSamples`, `distanceMetric`, `useHybridEmbeddings`, `hybridWeight` → `paramsReducer` with `pending`/`committed` pairs.
- **Run status**: `status`, `simPhase`, `simProgress`, `modelLoadProgress`, `errorMsg`, `retryNotices` → `statusReducer` driven by `handleStart`.

Each becomes easier to reason about, and the dependency arrays of derived memos shrink dramatically.

### 5.2 `loadRunInFlight` ref guard
`:4295-4337`: prevents concurrent loads. Works, but `loadingRun` useState already tracks in-flight state — the ref exists because state updates are async. A single `inFlightRef` + state derivation from it would remove duplication.

---

## 6. Error Handling

### 6.1 Silent failures in IndexedDB
`persistSimulationRun` has nested fallback (quota exceeded → drop oldest → retry). Good. But `handleDeleteRun` at `:4361-4363` catches errors and only `console.error`s; the user gets no UI feedback if the run fails to delete.

### 6.2 `handleCancel` doesn't restore pending UI state
`:4381-4388`: aborts the controller, resets status/phase/progress — but doesn't clear `retryNotices` or any partial `simulatedPools` already captured. Low impact today; confirm next simulation run overwrites cleanly.

### 6.3 Error bubbling from server
`simulatesetup.ts:78-81`:
```ts
} catch {
  return res.status(400).json({ success: false, message: 'Not enough cards in cube to run a draft with these settings' });
}
```
The `catch {}` swallows every possible `createDraft` failure as "not enough cards" — a truly malformed format or invalid cube state gets the same user-facing message. Log the inner error at least (`req.logger.warn` with stack) so ops can diagnose.

---

## 7. UX & Feature Concerns

### 7.1 History list loads only 5 runs
`LOCAL_SIM_HISTORY_LIMIT=5` trims runs on save. For a user iteratively tweaking, that's fine; for a user wanting to compare two cube versions side-by-side it's tight. Consider bumping to 10 or making it user-configurable. Each run is ~1-2MB in IndexedDB — headroom exists.

### 7.2 No comparative view
All the history-loading plumbing is there, but the UI surfaces one run at a time. Highest-value follow-up feature: "compare to run X" that overlays two `archetypeDistribution`s or diffs `p1p1Frequency`.

### 7.3 Filter chips + filter state drift
There are several independent filter concepts (card selection, archetype, cluster, pool focus). The chips consolidate them visually, but if the user filters by cluster and then clicks a card that only lives in a different cluster, `selectedCardOracles` can point at a card with zero rows in the filtered view — handled by `.filter((c): c is CardStats => !!c)` at `:4882`, but the user just sees an empty detail panel. A gentle "No matches with current filters" state would help.

### 7.4 CSV export (added recently — confirm)
Recent commit `e837c436` mentions CSV export. Worth a manual check that unicode card names are quoted correctly and that filter state is reflected in the export filename.

---

## 8. Miscellaneous

### 8.1 `cardFromId` cast on `produced_mana`
`simulatesetup.ts:153-155`: `(details as any).image_normal || (details as any).image_small` and `(details as any).produced_mana ?? []`. The `cardFromId` return type is probably `Partial<CardDetails>` or similar — tightening the types beats `as any`.

### 8.2 `imgUrl` precedence
`simulatesetup.ts:123`:
```ts
imageUrl: card.imgUrl || details.image_normal || details.image_small || '',
```
Good — `card.imgUrl` honors custom cube custom-card images. Confirm this matches client-side autocard expectations (was a fix in an earlier commit).

### 8.3 `OTAG_BUCKET_MAP` is 702 lines of hand-curated mapping
Already a known bespoke artifact (has its own `cube_otag_frequency.ts` generator). No issue — but consider checking in a tiny JSON schema or round-trip test that fails on duplicate keys / unknown buckets, since this file is very edit-prone.

### 8.4 `SimulationRunData` has both `slimPools` and `simulatedPools` via `SimulationReport`
`SimulationReport.ts:131-145`. Persisted form has slim pools; in-memory adds reconstructed `simulatedPools`. Clean separation. Good.

---

## Recommended Follow-ups (prioritized)

1. [~] **Clustering tests.** Revised: ~970 lines of tests already exist (see §4). Remaining gaps: `computeFilteredCardStats`, `persistSimulationRun`, `hdbscanFromKnnGraph` (sparse path specifically). Bigger win is fixing the broken Jest runner.
2. [x] **Merge the two `computeClusterThemes` calls** (`CubeDraftSimulatorPage.tsx:4847,4872`) into one memo. — *done; single `useMemo` now returns `{ clusterThemesByClusterId, allPoolClusterThemes, allPoolTagAllowlist }`.*
3. [x] **Promote the IIFE at `:3691` into a `ClusterCardsPanel` component.** Remove the nested-hook code smell. — *done; lifted `cardTab` state to `ClusterDetailPanel` top-level, dropped IIFE.*
4. [ ] **Extract `useSimulationRun`, `useLocalSimulationHistory`, `useClusteringPipeline` hooks.** Net ~2,500 lines out of the page component with zero behavior change.
5. [ ] **Handle pre-`setupData` runs explicitly.** UI badge or migration. — *deferred: requires a UI change.*
6. [x] **Loop the WebGL OOM retry** instead of single-level fallback. — *done; `runWithGpuRetry` helper loops through `nextLowerGpuBatchSize` until success or exhaustion, and replaces the duplicated try/catch blocks for both simulation and deckbuild phases.*
7. [~] **Replace `skipClusterUntilSeed` token** with an explicit source-of-skeletons key. — *partial: point-fix applied — `handleStart` now clears the ref so fresh runs always re-cluster (fixes "map doesn't load until refresh" bug). Deeper refactor to explicit key still pending.*
8. [x] **Rate-limit or cap `simulatesetup` response size.** — *done; added `MAX_SETUP_DRAFTS = 1000` to `simulatorConstants.ts` and enforced it in the Joi schema, capping pack-generation CPU and response payload.*
9. [x] **Tighten server types** — drop `as any` from `cardFromId` usage. — *done; `image_normal`/`image_small`/`produced_mana` are already on `CardDetails`, casts removed.*
10. [ ] **Comparative run view** (feature, not code-quality) — largest user-facing lift given what's already persisted. — *deferred: new feature.*

No blockers. The feature is ready to ship as-is; these are all "quality compounds over time" items.

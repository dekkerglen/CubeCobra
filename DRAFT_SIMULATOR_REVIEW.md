# Draft Simulator — Fresh Code & Feature Review

Date: 2026-04-23
Branch: `feature/draft-simulator` (84 commits ahead of origin)

This is a full re-review of the draft simulator after the extraction/refactor work. The previous review's follow-up items have largely landed; this document evaluates the current state fresh and proposes a new prioritized list.

---

## 1. Architecture Snapshot

The page orchestrator (`CubeDraftSimulatorPage.tsx`) now composes six focused hooks around a shared `DraftSimulatorDerivedData` memo. Top-level file sizes:

| File | Lines |
|---|---|
| `pages/CubeDraftSimulatorPage.tsx` | 5857 |
| `utils/draftSimulatorClustering.ts` | 1401 |
| `utils/draftBot.ts` | 752 |
| `hooks/useClusteringPipeline.ts` | 340 |
| `hooks/useSimulationRun.ts` | 312 |
| `hooks/useDraftSimulatorPresentation.ts` | 266 |
| `hooks/useDraftSimulatorSelection.ts` | 231 |
| `utils/draftSimulatorLocalStorage.ts` | 190 |
| `hooks/useLocalSimulationHistory.ts` | 184 |
| `utils/draftSimulatorStats.ts` | 172 |
| `utils/draftSimulatorThemes.ts` | 268 |
| `hooks/useDraftSimulatorFocus.ts` | 82 |
| `hooks/draftSimulatorHookTypes.ts` | 53 |

### Hook composition (page.tsx ~4645–5100)

1. `useLocalSimulationHistory` — IndexedDB I/O, current run selection
2. `useSimulationRun` — setup → run → persist pipeline, GPU retry ladder
3. `useClusteringPipeline` — embeddings → archetypes → skeletons (with cache hydration)
4. `useDraftSimulatorSelection` — pure derivations: active filter, filtered decks, card stats
5. `useDraftSimulatorFocus` — focused seat/pool/deck resolution, scope subtitle
6. `useDraftSimulatorPresentation` — human-readable labels, chips, CSV exports

This is a clean separation. The only cross-hook coupling is the `buildActiveFilterPreview` callback defined in the page (line 4960) and injected into `useDraftSimulatorSelection` — see §4.2.

---

## 2. Correctness

### 2.1 Cluster cache hydration (positive)
`useClusteringPipeline` uses a `hydratedClusterSourceKey` ref keyed by `[selectedTs, generatedAt, slimPools.length, hasDecks?'decks':'picks', clusterSeed].join(':')`. This is substantially cleaner than the old `skipClusterUntilSeed` token approach and avoids the stale-closure problem on fast run switches. The key covers both "decks arrived mid-session" (hasDecks flips) and "reseed requested" (clusterSeed changes).

### 2.2 `activeFilterPoolIndexSet` intersection (minor edge case)
`useDraftSimulatorSelection.ts:77–82`:

```ts
const [first, ...rest] = filterSets;
const intersection = new Set<number>(first);
for (const value of [...intersection]) {
  if (!rest.every((set) => set.has(value))) intersection.delete(value);
}
```

`first` is `Set<number> | undefined`, but TypeScript doesn't complain because `filterSets.length === 0` is guarded above. Fine. However, when the intersection is empty, downstream code treats it as "filter returned 0 pools" vs "no filter active" — both are possible and behavior differs (`filteredDecks` returns `[]`, `visibleCardStats` calls `computeFilteredCardStats` with empty set and returns `[]`). UI currently copes, but it is easy to confuse an empty filter result for a bug. Consider surfacing "no pools match this combination of filters" explicitly.

### 2.3 `computeFilteredCardStats` fallback path
`draftSimulatorStats.ts:126–130` falls back to `runData.cardStats.filter(...)` when `randomTrashByPool` metadata is missing for a trash step. Fallback is correct (approximate), but the function has already accumulated partial counts into `statsMap` up to that point — which are then thrown away. This is fine (the approximate fallback is self-contained), but worth a one-line comment explaining that the partial accumulation is intentionally discarded.

### 2.4 Filtered-stats cache eviction
`filteredCardStatsCache` (page.tsx:4604) is a `Map` keyed by sorted pool indices, reset via `resetSessionCaches` on run switch. Good. But within a single run, it grows unbounded as the user plays with filter combinations. For a 100-draft × 8-seat sim, the cache values are arrays of ~cube-size card stat objects. Memory pressure in practice is probably fine, but there is no LRU cap. Add a size limit (e.g. 32 entries) if users report memory issues.

### 2.5 `patchClusteringCache` race
`useClusteringPipeline` calls `patchClusteringCache` (from `draftSimulatorLocalStorage.ts`) on each of the three chained effects (embeddings, archetypes, skeletons). If the user switches runs mid-pipeline, a late-arriving patch could write to the new run's cache entry. `patchClusteringCache` does read-modify-write against the DB by `ts` — so worst-case it writes to the correct ts even after the run is unmounted, which is actually fine. The `hydratedClusterSourceKey` guard prevents the new run from re-reading its own cache twice. Verify once with a stress test (switch runs rapidly); I don't think there's an actual bug here.

### 2.6 Leave-guard modal
`leaveModalOpen`, `pendingNavigationHref`, and `handleConfirmedLeave` live in the page (lines 4718–4801). These are read by `useSimulationRun` (it needs to show the modal before starting a new run while one is in-flight) but defined in the page. Works, but the state and the handler naturally belong inside `useSimulationRun` — see §4.1.

---

## 3. Performance

### 3.1 `topCardPairings` is O(N²) in mainboard size
`useDraftSimulatorSelection.ts:185–212` computes all pairs per deck. For a 40-card mainboard that's 780 pairs × number of decks. Fine at 100 decks; painful at 1000. Since this only runs when `bottomTab === 'sideboardAndPairings'`, the cost is deferred — acceptable.

### 3.2 `computeFilteredCardStats` main-thread cost
Replays every pick for every draft × seat in `O(drafts × seats × packs × picksPerPack)`. For 1000 drafts × 8 seats × 45 picks that's ~360k iterations, each doing `indexOf` + `splice` on a pack. Still runs in a few hundred ms on a modern laptop, but if the MAX_SETUP_DRAFTS cap is ever raised, move this to a Web Worker.

### 3.3 `embeddingsCache` has no eviction
`embeddingsCache` (page.tsx:4601) caches per-run embeddings under `${ts}:${mode}:${hybridWeight}`. Also reset on run switch. Unbounded within a run but the set of distinct mode/hybridWeight combinations is small. No action needed.

### 3.4 Hybrid embeddings memory
In hybrid mode, `draftSimulatorClustering.ts` concatenates color + type distributions with the 128-dim TF embedding. Per-pool vectors stay well under 1KB. No concern.

### 3.5 UMAP projection
The force-directed UMAP stage is O(n × epochs) with negative sampling. For 800 pools it runs in well under a second on main thread. Acceptable. The PCA init is deterministic, good.

### 3.6 Server-side
`simulatesetup.ts`: Joi-validated, rate-limited (8 / 30 min per user-or-ip), capped at `MAX_SETUP_DRAFTS` (1000) and `MAX_SEATS` (needs spot-check of value). Good. The handler iterates `createDraft` N times synchronously; this is CPU-bound and blocks the event loop. For 1000 drafts, consider a Promise.allSettled batch or a worker thread in a later pass.

---

## 4. Code Quality & Organization

### 4.1 Page still owns in-flight modal state
`leaveModalOpen` / `pendingNavigationHref` / `handleConfirmedLeave` (page.tsx:4718, 4719, 4794–4801) logically belong inside `useSimulationRun`, which already owns `simAbortRef` and `status`. Moving them would let the page render `<LeaveConfirmModal {...run.leaveModal} />` instead of threading four props. Low priority; clean-up only.

### 4.2 `buildActiveFilterPreview` defined in page, used only in one hook
`page.tsx:4960–5040` defines `buildActiveFilterPreview` and passes it into `useDraftSimulatorSelection`. It uses only arguments passed in, no closures over page state. Move it into `useDraftSimulatorSelection.ts` (or a sibling util) and drop the callback prop.

### 4.3 Page is still 5857 lines because of sub-components
The remaining bulk is sub-components defined inline in the same file: `DraftMapCard`, `ClusterDetailPanel`, `DraftBreakdownTable`, `ArchetypeSkeletonSection`, `CardStatsTable`, `OverperformersPanel`, `SideboardAndPairingsPanel`, etc. Each is a candidate for extraction into `packages/client/src/components/draftSimulator/`. This is mechanical work — no behavior change — and would drop the page to <1500 lines.

### 4.4 Bottom-tab state union is stringy
`bottomTab` (page.tsx:4626) is `'archetypes' | 'deckColor' | 'cardStats' | 'draftBreakdown' | 'overperformers' | 'sideboardAndPairings'`. Same union is re-typed in `draftSimulatorHookTypes.ts` (`DraftSimulatorBottomTab`). Make the page import `DraftSimulatorBottomTab` instead of re-typing.

### 4.5 `gpuBatchSize` default 32 is hidden
Default is a magic number at `useState(32)` (page.tsx:4597). Move to a named constant alongside `WEBGL_CHUNK_SIZE` in `draftBot.ts` for discoverability.

### 4.6 Dead-branch fallbacks
`useDraftSimulatorSelection.ts:135` — when `currentRunSetup` is null, falls back to approximate per-card-stats filtering. This path only triggers for pre-setupData historical runs. Once the oldest stored run has setupData (5-run cap, so within a few sessions for active users), this branch is dead. Keep for now; add a removal TODO after ~6 months.

---

## 5. Tests

Current coverage (Jest files):

| File | Lines |
|---|---|
| `draftSimulatorThemes.test.ts` | 369 |
| `draftSimulatorClustering.test.ts` | 446 |
| `draftSimulatorStats.test.ts` | 174 |
| `draftBot.test.ts` | 86 |
| `draftBot.load.test.ts` | 57 |

Good coverage on the pure utilities. Gaps:
- `draftSimulatorLocalStorage.ts` — no tests. The quota-fallback-to-single-run branch is untested.
- `useSimulationRun` / `useClusteringPipeline` — hook logic uncovered; React Testing Library hook tests would close the gap.
- `computeFilteredCardStats` trashrandom fallback path — covered? spot-check `draftSimulatorStats.test.ts`.

The Jest runner is still blocked by the Babel/TS config issue noted in CLAUDE.md. Fix once, unblocks all of the above.

---

## 6. UX

### 6.1 Recent runs strip shows "Limited filtering" badge for pre-setupData runs
Good — users understand why filtering is approximate.

### 6.2 Leave-confirmation modal on in-flight sims
Works via `leaveModalOpen` + `window.beforeunload` handler. Good.

### 6.3 CSV export
`useDraftSimulatorPresentation` provides `downloadDraftBreakdownCsv` and `downloadCardStatsCsv`. Clean.

### 6.4 Storage notice
`persistSimulationRun` returns a storage-pressure notice when the DB falls back to single-run mode under quota. Surfaced to the user. Good.

### 6.5 Loading states
`simPhase` drives progress strings: "Loading model", "Simulating", "Building decks", "Clustering". Works. One gap — the clustering phase does not emit sub-progress, so for a large cube the UI sits on "Clustering…" for a few seconds with no feedback. Consider splitting into "Embedding → Archetyping → Skeleton extraction" micro-phases.

---

## 7. Server

`simulatesetup.ts` (183 lines):
- `limiter` — `express-rate-limit`, 8 / 30 min, `keyGenerator: userOrIpKey`. Good.
- `schema` — Joi: `numDrafts(1..MAX_SETUP_DRAFTS)`, `numSeats(2..MAX_SEATS)`, `formatId`. Good.
- No `as any` casts on `CardDetails` fields. Good.
- `oracleTags` pulled from `catalog.oracleTagDict`; `mlOracleId` from `getOracleForMl`. Good.

No server-side issues. The only open question: is `MAX_SETUP_DRAFTS = 1000` calibrated against event-loop block time? Worth measuring p99 latency at 1000 drafts on a cold instance.

---

## 8. Prioritized Follow-Up List

Ordered by value/effort ratio:

### High value, low effort
1. **Move `leaveModalOpen` / `pendingNavigationHref` / `handleConfirmedLeave` into `useSimulationRun`.** Removes 3 page-level state vars and threading.
2. **Move `buildActiveFilterPreview` into `useDraftSimulatorSelection.ts`.** It's a pure function only used there.
3. **Import `DraftSimulatorBottomTab` in the page instead of re-typing the union.** Single source of truth.
4. **Add a one-line comment in `computeFilteredCardStats` explaining the trashrandom-fallback discard.** Prevents future confusion.

### High value, medium effort
5. **Extract inline sub-components** (`DraftMapCard`, `ClusterDetailPanel`, etc.) into `components/draftSimulator/`. Drops page size from 5857 → <1500.
6. **Fix Jest runner** (Babel/TS config). Unblocks hook testing and `draftSimulatorLocalStorage` tests.
7. **Add `draftSimulatorLocalStorage.test.ts`** covering quota-fallback, patchClusteringCache race, 5-run eviction.
8. **Split clustering phase into sub-phases with progress strings.** 20-line UX win.

### Medium value, low effort
9. **LRU-cap `filteredCardStatsCache`** at 32 entries to bound memory within a session.
10. **Surface "filter combination matched 0 pools" explicitly** in the UI when `activeFilterPoolIndexSet.size === 0`.

### Deferred / speculative
11. **Move `computeFilteredCardStats` to a Web Worker** — only needed if `MAX_SETUP_DRAFTS` is ever raised.
12. **Batch `createDraft` on the server** — only needed if p99 setup latency at 1000 drafts becomes a problem.
13. **Delete pre-setupData fallback branch** in `useDraftSimulatorSelection.ts:135` — safe after all users' oldest stored runs have been regenerated.

---

## 9. Summary

The refactor is in good shape. The six-hook decomposition is clean and each hook has a defensible scope. The remaining 5857-line page is almost entirely inline sub-components, not orchestration logic, so further hook extraction has diminishing returns — the next win is component extraction.

No correctness bugs found during this pass. One minor consistency item (empty-intersection vs. no-filter UI) and one minor organization item (modal state in page instead of hook). Performance is acceptable at current caps; server is properly bounded.

The biggest latent risk is the Jest runner being broken — if a regression lands in `draftSimulatorStats.ts` or `draftSimulatorClustering.ts`, the tests won't catch it in CI. Prioritize fixing that before shipping.

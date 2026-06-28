# Deckbuild Evaluation Harness Proposal

## Goal

Build a reusable, neutral evaluation harness for deckbuilding changes so we can test:

- whether obviously-correct cards are being included consistently
- whether broader deck quality improves or regresses
- whether candidate changes generalize across cubes and pool types
- whether we are accidentally overfitting with named-card heuristics

This is explicitly **not** a proposal to hardcode rules like `if (oracle === mox_emerald)`.

The motivating benchmark is:

- `Mox Emerald` and similar zero-cost fast mana should make the main deck essentially all of the time in Vintage Cube style pools

but the harness should be reusable for:

- fast mana
- fixing
- splash behavior
- combo essentials
- narrow sideboard cards
- curve discipline
- other future ML evaluation work

## Current code boundaries

There are two existing deckbuild implementations to design around.

### Client-side simulator / local deckbuild

- [`packages/client/src/utils/draftBot.ts`](/Users/eetaibensasson/CubeCobra/packages/client/src/utils/draftBot.ts)
  - `localBatchDeckbuild(...)`
  - Phase 1: `localBatchBuild(...)`
  - Phase 2: `localBatchDraftRanked(...)` + `chooseBestMappedOracle(...)`

- [`packages/client/src/pages/CubeDraftSimulatorPage.tsx`](/Users/eetaibensasson/CubeCobra/packages/client/src/pages/CubeDraftSimulatorPage.tsx)
  - `buildAllDecks(...)`
  - constructs `DeckbuildEntry[]`
  - calls `localBatchDeckbuild(...)`

This is the easiest first place to attach an offline evaluation harness, because it already:

- runs fully locally
- accepts normalized pool/setup inputs
- returns built decks plus `deckbuildRatings`

### Server-side deckbuild

- [`packages/server/src/serverutils/draftbots.ts`](/Users/eetaibensasson/CubeCobra/packages/server/src/serverutils/draftbots.ts)
  - `deckbuild(...)`
  - `batchDeckbuild(...)`

This should eventually be evaluated too, but it depends on the ML service path and is a worse first target for rapid iteration.

## Design principles

### 1. Evaluate outcomes, not implementation tricks

We care about:

- mainboard inclusion rate
- deck composition quality
- regression deltas

We do not want:

- explicit named-card runtime logic
- one-off fixes that improve only one benchmark card

### 2. Separate model issues from policy issues

The harness should distinguish:

- **model outputs**
  - `deck_build_decoder`
  - `draft_decoder`
- **policy/search logic**
  - candidate filtering
  - duplicate penalty
  - spell/land caps
  - shortlist selection
  - iterative fill behavior

The Mox problem is likely a policy/search problem first, not necessarily a model-capacity problem.

### 3. Use fixed corpora for comparison

We need apples-to-apples comparisons across candidate changes.

That means:

- saved pools
- saved metadata
- reproducible evaluation runs

not ad hoc random simulator reruns only.

## Proposed architecture

## A. Corpus format

Add a persisted corpus format representing drafted pools plus enough metadata to run the deckbuilder offline.

Suggested TypeScript shape:

```ts
type DeckbuildEvalPool = {
  id: string;
  cubeId?: string;
  cubeName?: string;
  tags?: string[];
  pool: string[];
  expectedDeckSize?: number;
  expectedMainColors?: string[];
  notes?: string;
};

type DeckbuildEvalCorpus = {
  id: string;
  description: string;
  createdAt: string;
  cardMeta: Record<string, CardMeta>;
  basics: BasicLandInfo[];
  deckbuildSpells?: number;
  deckbuildLands?: number;
  pools: DeckbuildEvalPool[];
};
```

Recommended storage location:

- `packages/client/test/data/deckbuild-corpora/*.json`

Initial corpora:

1. `vintage-cube-frozen-v1`
2. `curated-benchmark-pools-v1`

### Corpus sources

#### Frozen simulated corpus

Generated from the draft simulator once, then saved:

- same pool set reused across experiments
- broad statistical coverage

#### Curated benchmark corpus

Manually selected “obvious” cases:

- Mox pools
- splash tension pools
- combo pools
- fixing-heavy pools
- aggro low-curve pools
- narrow sideboard pools

This corpus is the fastest signal for regressions and quality wins.

## B. Evaluation metrics

Metrics should be split into three layers.

### 1. Card-level outcome metrics

Examples:

- `mainboard inclusion rate when drafted`
- `sideboard rate when drafted`
- `omission rate when drafted`
- `inclusion rate conditional on final deck colors`

For the motivating benchmark:

- `Mox Emerald mainboard rate`
- `Mox Sapphire mainboard rate`
- `all moxen mainboard rate`
- `fast mana family mainboard rate`

These should be defined as evaluation metrics, not product rules.

### 2. Deck-level quality metrics

Examples:

- final deck size correctness
- spell/land count adherence
- color coherence
- splash count
- fixing sufficiency
- average mana value
- dead-card count
- sideboard leakage
- maindeck power proxy

These are needed so “fixing Mox” does not silently degrade the rest of the deckbuilder.

### 3. Comparative metrics

For baseline vs candidate:

- inclusion delta by benchmark family
- average deck-quality delta
- regression counts
- wins/losses against threshold checks

Suggested result shape:

```ts
type DeckbuildEvalResult = {
  corpusId: string;
  variantId: string;
  generatedAt: string;
  aggregate: {
    numPools: number;
    deckSizeFailures: number;
    avgMainboardCmc: number;
    avgMainboardNonbasicCount: number;
  };
  cardBenchmarks: Array<{
    key: string;
    label: string;
    draftedCount: number;
    mainboardCount: number;
    mainboardRate: number;
  }>;
  familyBenchmarks: Array<{
    key: string;
    draftedCount: number;
    mainboardCount: number;
    mainboardRate: number;
  }>;
};
```

## C. Benchmark families

Do not benchmark only one card.

Add a benchmark-family definition layer:

```ts
type DeckbuildBenchmarkFamily = {
  key: string;
  description: string;
  includes: string[]; // oracle ids for v1
};
```

Initial families:

1. `power-fast-mana`
2. `cheap-premium-interaction`
3. `narrow-sideboard-cards`
4. `premium-fixing`
5. `combo-essential-pieces`

For v1, static oracle lists are acceptable in the harness because they are:

- evaluation metadata
- not runtime deckbuilding logic

Later this can be generalized to metadata/tag-driven families.

## D. Candidate variant interface

The harness should compare deckbuilder variants through a narrow adapter interface.

Suggested shape:

```ts
type DeckbuildVariant = {
  id: string;
  description: string;
  build: (
    entries: DeckbuildEntry[],
    opts?: { signal?: AbortSignal; batchSize?: number },
  ) => Promise<{ mainboard: string[]; sideboard: string[]; deckbuildRatings?: RatedCard[] }[]>;
};
```

V1 variants:

1. `baseline`
   - wraps current `localBatchDeckbuild(...)`

2. `candidate-*`
   - wrappers around parameterized or modified deckbuild policies

## E. Parameterization layer

Before doing AI search, make the local deckbuilder configurable in a general way.

Suggested policy knobs:

```ts
type DeckbuildPolicy = {
  duplicatePenaltyBase?: number; // current behavior effectively 0.9^copies
  phaseOneSeedCount?: number; // current behavior 10
  draftFillStopAtNonPositive?: boolean;
  shortlistTopN?: number | null; // optional if we add top-N constrained fills
  maxSpells?: number;
  maxLands?: number;
  allowBasicFill?: boolean;
};
```

Important:

- these are neutral knobs
- no card-name-specific flags

The first milestone does **not** need a big policy system. It just needs a clean place where candidate variants can alter a few stable behaviors.

## F. Experiment runner

Add a runner script that:

1. loads a corpus
2. runs one or more variants
3. computes metrics
4. writes JSON + markdown summary

Suggested file locations:

- `packages/client/src/utils/deckbuildEval.ts`
- `packages/client/test/utils/deckbuildEval.test.ts`
- `packages/client/scripts/runDeckbuildEval.ts`

Suggested CLI:

```bash
node packages/client/scripts/runDeckbuildEval.ts \
  --corpus vintage-cube-frozen-v1 \
  --variant baseline \
  --variant candidate-dup-penalty-085
```

Outputs:

- `tmp/deckbuild-eval/<timestamp>/baseline.json`
- `tmp/deckbuild-eval/<timestamp>/candidate-dup-penalty-085.json`
- `tmp/deckbuild-eval/<timestamp>/summary.md`

## G. Anti-overfitting safeguards

We should explicitly block the wrong solution shape.

### Code-level safeguard

Add a test/lint rule for deckbuild policy code paths that rejects:

- explicit oracle checks
- explicit card-name checks for benchmark cards

Examples to fail:

- `if (oracle === "...")`
- `if (name.includes("Mox"))`

This does not have to be universal across the repo. It only needs to guard the deckbuild policy/eval modules.

### Evaluation safeguard

Require candidate acceptance to satisfy:

- improvement on the benchmark family, not only one card
- no major regression in deck-level quality metrics
- no large regressions on other corpora

## First implementation milestone

### Milestone 1: baseline evaluation harness

Deliverables:

1. **Corpus schema**
   - `DeckbuildEvalCorpus`
   - one frozen Vintage-style corpus
   - one small curated benchmark corpus

2. **Baseline runner**
   - runs current `localBatchDeckbuild(...)`
   - computes card/family metrics
   - writes JSON + markdown summary

3. **Initial benchmark report**
   - moxen
   - zero-cost fast mana family
   - deck size sanity
   - spell/land composition summary

4. **Acceptance target**
   - can answer:
     - what is current `Mox Emerald` mainboard rate?
     - what is current `all moxen` mainboard rate?
     - which pools omitted them?

This is the smallest version that already creates value.

## Second implementation milestone

### Milestone 2: candidate variant support

Deliverables:

1. parameterized local deckbuild wrapper
2. compare baseline vs one candidate
3. regression summary in markdown

Example candidate experiments:

- different duplicate penalty
- different phase-1 seed count
- different phase-2 stop condition

## Third implementation milestone

### Milestone 3: automated search

Only after the harness is stable.

Possible loop:

1. mutate allowed policy knobs
2. run corpus
3. rank candidates by score
4. keep top variants

AI can assist here by:

- proposing candidate policy changes
- ranking summaries
- generating next experiments

But the harness stays deterministic and authoritative.

## Suggested scoring model for candidate ranking

For v1, use a simple weighted score:

```text
score =
  + weight_fast_mana * fast_mana_mainboard_rate
  + weight_power_cards * power_family_mainboard_rate
  - weight_regression * deck_quality_regressions
  - weight_failures * deck_size_failures
```

This should be transparent and editable.

## Why this is worth doing

This creates one system that can answer all of these later:

- “Does Mox Emerald still get cut?”
- “Are combo pieces being missed?”
- “Did a new deckbuild change improve Vintage but hurt midrange cubes?”
- “Did a model update help or just move around regressions?”

That is much better than debugging one card at a time.

## Recommended next step

Implement Milestone 1 only:

1. add corpus format
2. add baseline runner around `localBatchDeckbuild(...)`
3. add benchmark-family definitions
4. produce first Vintage Cube evaluation report

That will tell us whether the Mox issue is localized, systemic, or driven by a small number of pool patterns.

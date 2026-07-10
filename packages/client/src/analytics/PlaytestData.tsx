import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { XIcon } from '@primer/octicons-react';

import { cardName, cardOracleId, encodeName } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import type { ArchetypeSkeleton, BuiltDeck, CardMeta, CardStats, SlimPool } from '@utils/datatypes/SimulationReport';
import { fromEntries } from '@utils/Util';

import Alert from '../components/base/Alert';
import { Card as CardUI, CardBody, CardHeader } from '../components/base/Card';
import { Col, Flexbox, Row } from '../components/base/Layout';
import Spinner from '../components/base/Spinner';
import Text from '../components/base/Text';
import Tooltip from '../components/base/Tooltip';
import ClusterDetailPanel from '../components/draftSimulator/ClusterDetailPanel';
import DraftMapScatter, { type DraftMapPoint } from '../components/draftSimulator/DraftMapScatter';
import SimDeckView from '../components/draftSimulator/SimDeckView';
import SimulationProgressBar, {
  getOverallSimProgress,
  type SimulationPhase,
} from '../components/draftSimulator/SimulationProgressBar';
import {
  CardTypeShareChart,
  computeColorProfileFromDecks,
  DeckColorShareChart,
  EloDistributionChart,
  ManaCurveShareChart,
} from '../components/draftSimulator/SimulatorCharts';
import ErrorBoundary from '../components/ErrorBoundary';
import { SortableTable } from '../components/SortableTable';
import withAutocard from '../components/WithAutocard';
import { CSRFContext } from '../contexts/CSRFContext';
import CubeContext from '../contexts/CubeContext';
import useLocalPlaytestAnalysisHistory from '../hooks/useLocalPlaytestAnalysisHistory';
import { computePlaytestCardStats, runPlaytestAnalysis } from '../utils/playtestAnalysisRun';
import { PlaytestAnalysisRunEntry, PlaytestDeck } from '../utils/playtestAnalysisStorage';
import { buildCardMeta } from '../utils/recordCardMeta';

const CLUSTER_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ca8a04',
  '#9333ea',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#ea580c',
  '#4f46e5',
];

// A deck's color-pair label (WUBRG order, 'C' for colorless).
const colorPairOf = (deck: PlaytestDeck): string => (deck.colors.length ? deck.colors.join('') : 'C');

// A deck's short display label: its date + color pair.
const deckLabel = (deck: PlaytestDeck): string => {
  const date = new Date(deck.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${colorPairOf(deck)} · ${date}`;
};

const AutocardItem = withAutocard('span');

// ─── Card link (autocard on hover when the card is still in the cube) ─────────
const renderCardLinkFor =
  (cardDict: Record<string, Card>) =>
  (oracle: string, name: string): React.ReactNode => {
    const card = cardDict[oracle];
    if (card) {
      return (
        <AutocardItem className="p-0" card={card}>
          <a
            href={`/tool/card/${encodeName(card.cardID)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-nowrap"
          >
            {cardName(card)}
          </a>
        </AutocardItem>
      );
    }
    return <span className="text-nowrap text-text-secondary">{name}</span>;
  };

// ─── Run controls (mirrors the record-analysis / draft-simulator run UI) ──────
const PLAYTEST_PHASE_LABELS: Record<string, string> = {
  setup: 'Downloading draft data…',
  loadmodel: 'Loading draft model…',
  cluster: 'Clustering decks…',
  save: 'Saving…',
};

const RunControls: React.FC<{
  runs: PlaytestAnalysisRunEntry[];
  selectedTs: number | null;
  isRunning: boolean;
  loadingRun: boolean;
  runError: string | null;
  simPhase: SimulationPhase;
  overallProgress: number;
  onRun: () => void;
  onCancel: () => void;
  onLoad: (ts: number) => void;
  onDelete: (ts: number) => void;
  onClear: () => void;
}> = ({
  runs,
  selectedTs,
  isRunning,
  loadingRun,
  runError,
  simPhase,
  overallProgress,
  onRun,
  onCancel,
  onLoad,
  onDelete,
  onClear,
}) => (
  <CardUI>
    <CardBody>
      <Flexbox direction="row" gap="3" justify="between" alignItems="start" wrap="wrap">
        <Flexbox direction="col" gap="0" className="min-w-0">
          <Text semibold md>
            Playtest analysis
          </Text>
          <Text xs className="text-text-secondary">
            Downloads every human draft fresh and analyzes it in your browser — loads the draft model (~70 MB, cached
            after first use) and clusters the decks into archetypes. Each run is saved locally.
          </Text>
        </Flexbox>
        <Flexbox direction="row" gap="2" alignItems="center" className="shrink-0">
          {isRunning && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded border border-border text-sm text-text-secondary hover:bg-bg-active"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning}
            className="px-5 py-2 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold text-sm whitespace-nowrap"
          >
            {isRunning ? 'Analyzing…' : 'Run analysis'}
          </button>
        </Flexbox>
      </Flexbox>
      {isRunning && (
        <div className="mt-3">
          <SimulationProgressBar
            phase={simPhase}
            overallProgress={overallProgress}
            label={simPhase ? PLAYTEST_PHASE_LABELS[simPhase] : undefined}
          />
        </div>
      )}
      {runError && (
        <Alert color="danger" className="mt-2">
          {runError}
        </Alert>
      )}
      {runs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <Flexbox direction="row" gap="3" alignItems="center" className="mb-2">
            <Text xs className="font-medium text-text-secondary uppercase tracking-wide">
              Recent runs
            </Text>
            <button type="button" className="text-xs text-text-secondary hover:text-text" onClick={onClear}>
              Clear all
            </button>
            {loadingRun && <Spinner sm />}
          </Flexbox>
          <div className="flex flex-wrap gap-2">
            {runs.map((run) => (
              <div
                key={run.ts}
                onClick={() => onLoad(run.ts)}
                className={`group relative flex flex-col cursor-pointer select-none rounded-md border px-3 py-2 pr-7 transition-colors ${
                  run.ts === selectedTs ? 'border-link bg-bg-active' : 'border-border bg-bg-accent hover:bg-bg-active'
                }`}
                style={{ minWidth: 150 }}
              >
                <span className="text-sm font-semibold whitespace-nowrap leading-tight">
                  {run.draftCount.toLocaleString()} decks · {run.pickCount.toLocaleString()} picks
                </span>
                <span className="text-[11px] text-text-secondary whitespace-nowrap mt-0.5">
                  {new Date(run.generatedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {!run.clustered && (
                    <span className="inline-flex w-fit rounded border border-yellow-500/40 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-600">
                      No map
                    </span>
                  )}
                  {run.capped && (
                    <span className="inline-flex w-fit rounded border border-blue-500/40 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                      Capped
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center rounded text-[10px] text-text-secondary/50 hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(run.ts);
                  }}
                >
                  <XIcon size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </CardBody>
  </CardUI>
);

// ─── Panel wrapper ────────────────────────────────────────────────────────────
const Panel: React.FC<{ title: string; tooltip?: string; right?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  tooltip,
  right,
  children,
}) => (
  <CardUI className="h-full">
    <CardHeader>
      <Flexbox direction="row" justify="between" alignItems="center">
        <Text semibold md>
          {title}
          {tooltip && (
            <Tooltip text={tooltip} wrapperTag="span" position="bottom">
              <span className="ml-1 text-text-secondary/50">ⓘ</span>
            </Tooltip>
          )}
        </Text>
        {right}
      </Flexbox>
    </CardHeader>
    <CardBody>{children}</CardBody>
  </CardUI>
);

// ─── The deck map (reused DraftMapScatter): every human deck projected to 2D ──
const DeckMap: React.FC<{
  decks: PlaytestDeck[];
  skeletons: ArchetypeSkeleton[];
  colorBy: 'cluster' | 'deckColor';
  selectedClusterId: number | null;
  selectedPoolIndex: number | null;
  onSelectPoint: (poolIndex: number, clusterId: number | null) => void;
}> = ({ decks, skeletons, colorBy, selectedClusterId, selectedPoolIndex, onSelectPoint }) => {
  const points = useMemo<DraftMapPoint[]>(() => {
    const byDeck = new Map<number, number>();
    skeletons.forEach((s, idx) => {
      for (const pi of s.poolIndices) byDeck.set(pi, idx);
    });
    return decks.map((d, i) => ({
      x: d.x,
      y: d.y,
      poolIndex: i,
      draftIndex: 0,
      seatIndex: 0,
      clusterId: d.clusterId,
      clusterIndex: byDeck.get(i) ?? null,
      clusterLabel: `${colorPairOf(d)}${d.archetype ? ` ${d.archetype}` : ''}`,
      archetype: colorPairOf(d),
    }));
  }, [decks, skeletons]);

  // Selecting a cluster keeps its decks bright and dims the rest.
  const activePoolIndexSet = useMemo<Set<number> | null>(() => {
    if (selectedClusterId === null) return null;
    const set = new Set<number>();
    decks.forEach((d, i) => {
      if (d.clusterId === selectedClusterId) set.add(i);
    });
    return set;
  }, [decks, selectedClusterId]);

  if (points.length === 0) {
    return (
      <Text sm className="text-text-secondary">
        The map needs the ML model — run the analysis to build it.
      </Text>
    );
  }
  return (
    <div style={{ width: '100%', maxWidth: 480, aspectRatio: '1 / 1', margin: '0 auto' }}>
      <DraftMapScatter
        points={points}
        selectedPoolIndex={selectedPoolIndex}
        activePoolIndexSet={activePoolIndexSet}
        colorMode={colorBy}
        onSelectPoint={(p) => onSelectPoint(p.poolIndex, p.clusterId)}
        baseRadius={7}
      />
    </div>
  );
};

// ─── One archetype cluster (ML), with its decks + display label ──────────────
interface ClusterInfo {
  clusterId: number;
  idx: number;
  skel: ArchetypeSkeleton;
  color: string;
  colorProfile: string;
  label: string;
  count: number;
}

// ─── Main ────────────────────────────────────────────────────────────────────
const PlaytestData: React.FC = () => {
  const { cube, changedCards } = useContext(CubeContext);
  const cards = useMemo(() => changedCards.mainboard || [], [changedCards]);
  const { csrfFetch } = useContext(CSRFContext);

  const {
    runs,
    displayRun,
    selectedTs,
    loadingRun,
    handleLoadRun,
    handleDeleteRun,
    handleClearHistory,
    handlePersistCompletedRun,
  } = useLocalPlaytestAnalysisHistory(cube?.id || '');

  const [isRunning, setIsRunning] = useState(false);
  const [simPhase, setSimPhase] = useState<SimulationPhase>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleRun = useCallback(async () => {
    if (!cube) return;
    setIsRunning(true);
    setRunError(null);
    setModelLoadProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const runData = await runPlaytestAnalysis(csrfFetch, cube, cards, {
        onPhase: setSimPhase,
        onModelProgress: setModelLoadProgress,
        signal: controller.signal,
      });
      await handlePersistCompletedRun(runData);
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setRunError(err instanceof Error ? err.message : 'Analysis failed');
      }
    } finally {
      setIsRunning(false);
      setSimPhase(null);
      abortRef.current = null;
    }
  }, [cube, csrfFetch, cards, handlePersistCompletedRun]);

  const handleCancel = useCallback(() => abortRef.current?.abort(), []);

  // Abort any in-flight analysis if the component unmounts (e.g. the user switches
  // analysis tabs mid-run) so we don't keep downloading the model / clustering and
  // don't update state on an unmounted component.
  useEffect(() => () => abortRef.current?.abort(), []);

  // ── Selection state ─────────────────────────────────────────────────────────
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [selectedPoolIndex, setSelectedPoolIndex] = useState<number | null>(null);
  const [mapColorBy, setMapColorBy] = useState<'cluster' | 'deckColor'>('cluster');
  const [excludeManaFixingLands, setExcludeManaFixingLands] = useState(false);
  // Clear the drill-in when switching runs.
  useEffect(() => {
    setSelectedClusterId(null);
    setSelectedPoolIndex(null);
  }, [displayRun?.ts]);

  const cardDict = useMemo(
    () =>
      fromEntries(cards.filter((card) => cardOracleId(card)).map((card) => [cardOracleId(card), card])) as Record<
        string,
        Card
      >,
    [cards],
  );
  const cubeOracleSet = useMemo(() => new Set(Object.keys(cardDict)), [cardDict]);
  const renderCardLink = useMemo(() => renderCardLinkFor(cardDict), [cardDict]);

  // Card metadata for the reused simulator charts / cluster detail: cube cards,
  // backfilled with the run's captured info for cards no longer in the live cube.
  // The expensive full-cube pass only depends on `cards`, so keep it out of the
  // run-switch hot path; the per-run cardImages backfill below is cheap.
  const baseCardMeta = useMemo(() => buildCardMeta(cards), [cards]);

  const cardMeta = useMemo(() => {
    const cardImages = displayRun?.cardImages;
    if (!cardImages) {
      return baseCardMeta;
    }
    const meta = { ...baseCardMeta };
    for (const [oracle, info] of Object.entries(cardImages)) {
      const existing = meta[oracle];
      if (!existing || !existing.imageUrl) {
        meta[oracle] = {
          name: info.name,
          imageUrl: info.imageUrl,
          colorIdentity: info.colorIdentity,
          elo: existing?.elo ?? 1200,
          cmc: info.cmc,
          type: info.type,
          producedMana: existing?.producedMana ?? [],
        } as CardMeta;
      }
    }
    return meta;
  }, [baseCardMeta, displayRun]);

  const decks = useMemo(() => displayRun?.decks ?? [], [displayRun]);
  const skeletons = useMemo(() => displayRun?.skeletons ?? [], [displayRun]);
  const seatsByPool = useMemo(() => decks.map((d) => d.seats), [decks]);
  const allDeckBuilds = useMemo<BuiltDeck[]>(
    () => decks.map((d) => ({ mainboard: d.mainboard, sideboard: d.sideboard })),
    [decks],
  );
  // Pick sequences the cluster-detail recommender / charts expect (mainboard order
  // stands in for pick order — playtest decks are the built result, not the pool).
  const allSlimPools = useMemo<SlimPool[]>(
    () =>
      decks.map((d, i) => ({
        draftIndex: 0,
        seatIndex: i,
        archetype: '',
        picks: d.mainboard.map((oracle, p) => ({ oracle_id: oracle, packNumber: 0, pickNumber: p + 1 })),
      })),
    [decks],
  );

  // The summary charts and card table cover the whole run; per-archetype detail
  // lives in the cluster drill-in panel, not a page-wide filter.
  const allPoolsSet = useMemo<Set<number>>(() => new Set(decks.map((_, i) => i)), [decks]);

  // Per-card draft stats across every analyzed deck.
  const cardStats = useMemo<CardStats[]>(() => {
    if (!displayRun) return [];
    return computePlaytestCardStats(displayRun.perPick, seatsByPool, displayRun.oracles, cardMeta, allPoolsSet);
  }, [displayRun, seatsByPool, cardMeta, allPoolsSet]);

  const tableRows = useMemo(
    () =>
      cardStats.map((c) => ({
        card: cardDict[c.oracle_id]
          ? { exportValue: c.name, ...cardDict[c.oracle_id]! }
          : { exportValue: c.name, oracle_id: c.oracle_id },
        oracle: c.oracle_id,
        name: c.name,
        elo: Math.round(c.elo),
        seen: c.timesSeen,
        picked: c.timesPicked,
        pickrate: c.pickRate,
        avgpick: c.avgPickPosition,
        wheels: c.wheelCount,
        p1p1: c.p1p1Seen > 0 ? c.p1p1Count / c.p1p1Seen : 0,
        decks: c.poolIndices.length,
      })),
    [cardStats, cardDict],
  );

  // ML clusters: each with its skeleton + decks + a color/label. `idx` drives the
  // map color, so the list swatches line up with the map dots.
  const clusters = useMemo<ClusterInfo[]>(
    () =>
      skeletons
        .map((skel, idx) => {
          const members = decks.filter((d) => d.clusterId === skel.clusterId);
          const dominant =
            Object.entries(
              members.reduce<Record<string, number>>((acc, d) => {
                if (d.archetype) acc[d.archetype] = (acc[d.archetype] ?? 0) + 1;
                return acc;
              }, {}),
            ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
          const colorProfile =
            computeColorProfileFromDecks(
              members.map((d) => d.mainboard),
              cardMeta,
            ) || 'C';
          return {
            clusterId: skel.clusterId,
            idx,
            skel,
            color: CLUSTER_COLORS[idx % CLUSTER_COLORS.length]!,
            colorProfile,
            label: `${colorProfile}${dominant ? ` ${dominant}` : ''}`,
            count: members.length,
          };
        })
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count),
    [skeletons, decks, cardMeta],
  );

  const selectedCluster = useMemo(
    () => clusters.find((c) => c.clusterId === selectedClusterId) ?? null,
    [clusters, selectedClusterId],
  );
  const selectedClusterDeckBuilds = useMemo<BuiltDeck[] | null>(
    () =>
      selectedCluster
        ? (selectedCluster.skel.poolIndices.map((i) => allDeckBuilds[i]).filter(Boolean) as BuiltDeck[])
        : null,
    [selectedCluster, allDeckBuilds],
  );
  const selectedDeck = selectedPoolIndex !== null ? (decks[selectedPoolIndex] ?? null) : null;

  const overallProgress = getOverallSimProgress(simPhase, modelLoadProgress, 0);

  const selectCluster = useCallback((clusterId: number | null) => {
    setSelectedClusterId((prev) => (prev === clusterId ? null : clusterId));
    setSelectedPoolIndex(null);
  }, []);

  return (
    <ErrorBoundary>
      <Flexbox direction="col" gap="3" className="m-2">
        <RunControls
          runs={runs}
          selectedTs={selectedTs}
          isRunning={isRunning}
          loadingRun={loadingRun}
          runError={runError}
          simPhase={simPhase}
          overallProgress={overallProgress}
          onRun={handleRun}
          onCancel={handleCancel}
          onLoad={handleLoadRun}
          onDelete={handleDeleteRun}
          onClear={handleClearHistory}
        />

        {!displayRun ? (
          <CardUI>
            <CardBody>
              <Text className="text-text-secondary">
                No playtest analysis yet. Click <span className="font-semibold">Run analysis</span> to download this
                cube&apos;s human drafts and build the report — pick rates, deck shapes and archetype clusters, all
                computed in your browser.
              </Text>
            </CardBody>
          </CardUI>
        ) : decks.length === 0 ? (
          <CardUI>
            <CardBody>
              <Text sm className="text-text-secondary">
                This analysis found no completed human drafts for this cube. Draft the cube against bots (or with other
                players), then run again.
              </Text>
            </CardBody>
          </CardUI>
        ) : (
          <>
            {displayRun.capped && (
              <Alert color="info">
                This cube has more human drafts than the analysis limit. Showing the most recent{' '}
                {displayRun.draftCount.toLocaleString()} decks.
              </Alert>
            )}

            {/* Deck-shape summary charts (reused from the draft simulator) */}
            <Row gutters={2}>
              <Col xs={12} md={6} lg={3}>
                <Panel title="Colors" tooltip="Weighted color share across the decks' mainboards.">
                  <DeckColorShareChart deckBuilds={allDeckBuilds} cardMeta={cardMeta} />
                </Panel>
              </Col>
              <Col xs={12} md={6} lg={3}>
                <Panel title="Card types" tooltip="Distribution of card types across the decks' mainboards.">
                  <CardTypeShareChart deckBuilds={allDeckBuilds} cardMeta={cardMeta} />
                </Panel>
              </Col>
              <Col xs={12} md={6} lg={3}>
                <Panel title="Mana curve" tooltip="Mana value distribution of nonland cards across the decks.">
                  <ManaCurveShareChart deckBuilds={allDeckBuilds} cardMeta={cardMeta} />
                </Panel>
              </Col>
              <Col xs={12} md={6} lg={3}>
                <Panel title="Elo distribution" tooltip="Card Elo spread across the decks' mainboards.">
                  <EloDistributionChart deckBuilds={allDeckBuilds} cardMeta={cardMeta} />
                </Panel>
              </Col>
            </Row>

            {/* Archetype map + drill-in (reused ClusterDetailPanel) */}
            <Panel
              title="Archetype map"
              tooltip="Every human deck projected to 2D by the draft model — decks that drafted alike sit together. Click an archetype in the list or a deck on the map to open its breakdown on the right."
              right={
                <div className="flex rounded-md border border-border overflow-hidden text-xs">
                  {(['cluster', 'deckColor'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setMapColorBy(mode)}
                      className={`px-2 py-1 ${mapColorBy === mode ? 'bg-bg-active font-semibold' : 'text-text-secondary hover:bg-bg-active'}`}
                    >
                      {mode === 'cluster' ? 'Cluster' : 'Deck color'}
                    </button>
                  ))}
                </div>
              }
            >
              {!displayRun.clustered ? (
                <Text sm className="text-text-secondary">
                  The archetype map needs the ML model. This run was saved without it (fewer than 3 decks, or the model
                  failed to load) — run the analysis again to build it.
                </Text>
              ) : (
                <div className={`grid grid-cols-1 gap-5 ${selectedCluster ? 'lg:grid-cols-12' : ''}`}>
                  {/* LEFT: archetype list, then the map, then the selected deck. */}
                  <div className={selectedCluster ? 'lg:col-span-5 min-w-0' : 'min-w-0'}>
                    <Flexbox direction="col" gap="1">
                      {clusters.map((c) => (
                        <button
                          key={c.clusterId}
                          type="button"
                          onClick={() => selectCluster(c.clusterId)}
                          className={`flex items-center gap-2 w-full text-left rounded px-1.5 py-1 ${c.clusterId === selectedClusterId ? 'bg-bg-active' : 'hover:bg-bg-active'}`}
                        >
                          <span className="inline-block h-3 w-3 rounded-sm shrink-0" style={{ background: c.color }} />
                          <Text sm semibold className="flex-1 min-w-0 truncate">
                            {c.label}
                          </Text>
                          <Text xs className="text-text-secondary tabular-nums shrink-0">
                            {c.count} deck{c.count === 1 ? '' : 's'}
                          </Text>
                        </button>
                      ))}
                    </Flexbox>
                    <div className="mt-4">
                      <DeckMap
                        decks={decks}
                        skeletons={skeletons}
                        colorBy={mapColorBy}
                        selectedClusterId={selectedClusterId}
                        selectedPoolIndex={selectedPoolIndex}
                        onSelectPoint={(pi, cid) => {
                          setSelectedPoolIndex(pi);
                          setSelectedClusterId(cid);
                        }}
                      />
                    </div>
                    {selectedDeck && (
                      <div className="mt-4 rounded-lg border border-border bg-bg-accent/30 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-bg-accent/50">
                          <Flexbox direction="col" gap="0" className="min-w-0">
                            <Text sm semibold className="truncate">
                              {deckLabel(selectedDeck)}
                            </Text>
                            <Text xs className="text-text-secondary truncate">
                              {selectedDeck.mainboard.length} cards
                            </Text>
                          </Flexbox>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={`/cube/deck/${selectedDeck.draftId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-link text-xs hover:underline"
                            >
                              view deck
                            </a>
                            <button
                              type="button"
                              onClick={() => setSelectedPoolIndex(null)}
                              className="text-text-secondary hover:bg-bg-active rounded px-1"
                              title="Clear selected deck"
                            >
                              <XIcon size={12} />
                            </button>
                          </div>
                        </div>
                        <SimDeckView
                          deck={{ mainboard: selectedDeck.mainboard, sideboard: selectedDeck.sideboard }}
                          cardMeta={cardMeta}
                        />
                      </div>
                    )}
                  </div>

                  {/* RIGHT: the selected archetype's breakdown. */}
                  {selectedCluster && (
                    <div className="lg:col-span-7 min-w-0">
                      <ClusterDetailPanel
                        skeleton={selectedCluster.skel}
                        clusterIndex={selectedCluster.idx}
                        displayName={selectedCluster.label}
                        decksTab={{
                          label: 'Decks',
                          title: 'Every deck in this archetype. Click one to view it on the map.',
                          content: (
                            <Flexbox direction="col" gap="0">
                              {selectedCluster.skel.poolIndices
                                .map((i) => ({ i, d: decks[i] }))
                                .filter((x): x is { i: number; d: PlaytestDeck } => !!x.d)
                                .sort((a, b) => b.d.date - a.d.date)
                                .map(({ i, d }) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => setSelectedPoolIndex(i)}
                                    className={`flex items-center gap-2 w-full text-left px-2 py-1.5 border-b border-border last:border-b-0 ${
                                      i === selectedPoolIndex ? 'bg-bg-active' : 'hover:bg-bg-active'
                                    }`}
                                  >
                                    <Flexbox direction="col" gap="0" className="min-w-0 flex-1">
                                      <Text sm semibold className="truncate">
                                        {deckLabel(d)}
                                      </Text>
                                      <Text xs className="text-text-secondary truncate">
                                        {d.mainboard.length} cards
                                      </Text>
                                    </Flexbox>
                                  </button>
                                ))}
                            </Flexbox>
                          ),
                        }}
                        totalPools={decks.length}
                        clusterDeckBuilds={selectedClusterDeckBuilds}
                        cubeOracleSet={cubeOracleSet}
                        cardMeta={cardMeta}
                        slimPools={allSlimPools}
                        deckBuilds={allDeckBuilds}
                        excludeManaFixingLands={excludeManaFixingLands}
                        setExcludeManaFixingLands={setExcludeManaFixingLands}
                        onOpenPool={(pi) => {
                          const d = decks[pi];
                          if (d) window.open(`/cube/deck/${d.draftId}`, '_blank', 'noopener');
                        }}
                        poolLabel={(pi) => {
                          const d = decks[pi];
                          return d ? deckLabel(d) : '';
                        }}
                        onClose={() => {
                          setSelectedClusterId(null);
                          setSelectedPoolIndex(null);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </Panel>

            {/* Card stats table */}
            <Panel
              title="Card stats"
              tooltip="How humans drafted each card: how often it was seen, taken, wheeled, or first-picked, and how often it made the deck."
            >
              {tableRows.length === 0 ? (
                <Text sm className="text-text-secondary">
                  No cards in scope.
                </Text>
              ) : (
                <SortableTable
                  columnProps={[
                    {
                      key: 'card',
                      title: 'Card',
                      heading: true,
                      sortable: true,
                      renderFn: (_v, row) => renderCardLink(row.oracle, row.name),
                    },
                    { key: 'elo', title: 'Elo', sortable: true, heading: false },
                    { key: 'seen', title: 'Seen', sortable: true, heading: false },
                    { key: 'picked', title: 'Picked', sortable: true, heading: false },
                    {
                      key: 'pickrate',
                      title: 'Pick Rate',
                      sortable: true,
                      heading: false,
                      renderFn: (v) => `${(v * 100).toFixed(1)}%`,
                    },
                    {
                      key: 'avgpick',
                      title: 'Avg Pick',
                      sortable: true,
                      heading: false,
                      renderFn: (v) => (v > 0 ? v.toFixed(1) : '—'),
                    },
                    { key: 'wheels', title: 'Wheels', sortable: true, heading: false },
                    {
                      key: 'p1p1',
                      title: 'Taken P1P1 %',
                      sortable: true,
                      heading: false,
                      renderFn: (v) => `${(v * 100).toFixed(1)}%`,
                    },
                    { key: 'decks', title: 'Decks', sortable: true, heading: false },
                  ]}
                  data={tableRows}
                  sortFns={{
                    card: (a: any, b: any) => (a?.exportValue ?? '').localeCompare(b?.exportValue ?? ''),
                  }}
                  defaultSortConfig={{ key: 'seen', direction: 'descending' }}
                />
              )}
            </Panel>
          </>
        )}
      </Flexbox>
    </ErrorBoundary>
  );
};

export default PlaytestData;

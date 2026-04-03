import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import Cube from '@utils/datatypes/Cube';
import {
  ArchetypeEntry,
  CardMeta,
  CardStats,
  ColorBalance,
  P1P1Entry,
  SimulatedPickCard,
  SimulatedPool,
  SimulationReport,
  SimulationRunData,
  SimulationRunEntry,
  SimulationSetupResponse,
  SlimPool,
} from '@utils/datatypes/SimulationReport';
import { getCubeId } from '@utils/Util';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { Card, CardBody, CardHeader } from '../components/base/Card';
import Input from '../components/base/Input';
import { Col, Flexbox, Row } from '../components/base/Layout';
import Text from '../components/base/Text';
import DynamicFlash from '../components/DynamicFlash';
import RenderToRoot from '../components/RenderToRoot';
import { CSRFContext } from '../contexts/CSRFContext';
import { DisplayContextProvider } from '../contexts/DisplayContext';
import CubeLayout from '../layouts/CubeLayout';
import MainLayout from '../layouts/MainLayout';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const MTG_COLORS: Record<string, { bg: string; label: string }> = {
  W: { bg: 'rgba(248, 231, 185, 0.8)', label: 'White' },
  U: { bg: 'rgba(103, 166, 211, 0.8)', label: 'Blue' },
  B: { bg: 'rgba(100, 89, 107, 0.8)', label: 'Black' },
  R: { bg: 'rgba(216, 95, 105, 0.8)', label: 'Red' },
  G: { bg: 'rgba(106, 181, 114, 0.8)', label: 'Green' },
  C: { bg: 'rgba(173, 173, 173, 0.8)', label: 'Colorless' },
  M: { bg: 'rgba(212, 175, 55, 0.8)', label: 'Multicolor' }, // gold for multi-color archetypes
};

const COLOR_FULL_NAMES: Record<string, string> = {
  W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless',
};

function archetypeFullName(colorPair: string): string {
  if (!colorPair || colorPair === 'C') return 'Colorless';
  const parts = colorPair.split('').filter((c) => c in COLOR_FULL_NAMES).map((c) => COLOR_FULL_NAMES[c]!);
  return parts.length > 0 ? parts.join('/') : colorPair;
}

function createMultiStripe(colors: string[]): CanvasPattern | string {
  if (typeof document === 'undefined') return colors[0] ?? 'gray';
  const n = Math.min(colors.length, 4);
  if (n === 0) return 'gray';
  if (n === 1) return colors[0]!;
  const stripeWidth = 7;
  const size = n * stripeWidth;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return colors[0]!;
  ctx.fillStyle = colors[0]!;
  ctx.fillRect(0, 0, size, size);
  ctx.lineWidth = stripeWidth;
  ctx.lineCap = 'butt';
  for (let i = 1; i < n; i++) {
    ctx.strokeStyle = colors[i]!;
    const offset = i * stripeWidth;
    ctx.beginPath();
    for (const extra of [-size, 0, size]) {
      ctx.moveTo(extra + offset, size);
      ctx.lineTo(extra + offset + size, 0);
    }
    ctx.stroke();
  }
  return ctx.createPattern(c, 'repeat') ?? colors[0]!;
}

interface RawStats {
  name: string; colorIdentity: string[]; elo: number;
  timesSeen: number; timesPicked: number; pickPositionSum: number; pickPositionCount: number;
  wheelCount: number; p1p1Count: number; poolIndices: number[];
}

function assessPoolColors(picks: string[], cardMeta: Record<string, CardMeta>): string {
  const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let count = 0;
  for (const oracle of picks) {
    const meta = cardMeta[oracle];
    if (!meta || meta.colorIdentity.length === 0) continue;
    count++;
    for (const c of meta.colorIdentity) {
      if (c in colorCounts) colorCounts[c] = (colorCounts[c] ?? 0) + 1;
    }
  }
  if (count === 0) return 'C';
  const colors = Object.keys(colorCounts).filter((c) => (colorCounts[c] ?? 0) / count > 0.25).sort();
  return colors.length === 0 ? 'C' : colors.join('');
}

function reconstructSimulatedPools(slimPools: SlimPool[], cardMeta: Record<string, CardMeta>): SimulatedPool[] {
  return slimPools.map((slim, poolIndex) => ({
    poolIndex,
    draftIndex: slim.draftIndex,
    seatIndex: slim.seatIndex,
    archetype: slim.archetype,
    picks: slim.picks.map((p) => {
      const meta = cardMeta[p.oracle_id];
      return { oracle_id: p.oracle_id, name: meta?.name ?? p.oracle_id, imageUrl: meta?.imageUrl ?? '', packNumber: p.packNumber, pickNumber: p.pickNumber };
    }),
  }));
}

async function runClientSimulation(
  setup: SimulationSetupResponse,
  numDrafts: number,
  deadCardThreshold: number,
  onProgress: (pct: number) => void,
): Promise<SimulationReport> {
  const { initialPacks, packSteps, cardMeta, cubeName, numSeats } = setup;
  const statsMap = new Map<string, RawStats>();
  const archetypeCounts = new Map<string, number>();

  const getStats = (oracle: string): RawStats => {
    let s = statsMap.get(oracle);
    if (!s) {
      const meta = cardMeta[oracle];
      s = { name: meta?.name ?? oracle, colorIdentity: meta?.colorIdentity ?? [], elo: meta?.elo ?? 1200, timesSeen: 0, timesPicked: 0, pickPositionSum: 0, pickPositionCount: 0, wheelCount: 0, p1p1Count: 0, poolIndices: [] };
      statsMap.set(oracle, s);
    }
    return s;
  };

  // Count total pick rounds for progress reporting
  let totalPicks = 0;
  for (const steps of packSteps) {
    for (const step of steps) {
      if (step.action === 'pick' || step.action === 'pickrandom') totalPicks += step.amount ?? 1;
    }
  }
  let donePicks = 0;

  const numPacks = packSteps.length;
  const allCurrentPacks: string[][][] = Array.from({ length: numDrafts }, (_, d) =>
    Array.from({ length: numSeats }, (_, s) => [...(initialPacks[d]?.[s]?.[0] ?? [])]),
  );
  const allPools: string[][][] = Array.from({ length: numDrafts }, () => Array.from({ length: numSeats }, () => []));
  const allPickMeta: { packNumber: number; pickNumber: number }[][][] = Array.from({ length: numDrafts }, () => Array.from({ length: numSeats }, () => []));

  onProgress(0);

  for (let packNum = 0; packNum < numPacks; packNum++) {
    if (packNum > 0) {
      for (let d = 0; d < numDrafts; d++) for (let s = 0; s < numSeats; s++) allCurrentPacks[d]![s] = [...(initialPacks[d]?.[s]?.[packNum] ?? [])];
    }

    const steps = packSteps[packNum] ?? [];
    let pickNumInPack = 1;

    for (const step of steps) {
      if (step.action === 'pick' || step.action === 'pickrandom') {
        const numPicksThisStep = step.amount ?? 1;
        for (let p = 0; p < numPicksThisStep; p++) {
          // Track timesSeen for all cards currently visible
          for (let d = 0; d < numDrafts; d++) for (let s = 0; s < numSeats; s++) for (const oracle of allCurrentPacks[d]![s]!) getStats(oracle).timesSeen++;

          let picks: string[];

          if (step.action === 'pick') {
            // One ML call for this pick round — all numDrafts×numSeats seats batched together
            const flatPacks = allCurrentPacks.flatMap((draftPacks) => draftPacks);
            const flatPools = allPools.flatMap((draftPools) => draftPools);
            const mlRes = await fetch('/cube/api/simulateall', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ packs: flatPacks, pools: flatPools }),
            });
            if (!mlRes.ok) {
              const body = await mlRes.json().catch(() => ({}));
              throw new Error((body as { message?: string }).message ?? `Simulation failed: ${mlRes.status}`);
            }
            picks = ((await mlRes.json()) as { picks: string[] }).picks;
          } else {
            // pickrandom — take first card from each pack, no ML call needed
            picks = allCurrentPacks.flatMap((draftPacks) => draftPacks.map((pack) => pack[0] ?? ''));
          }

          let idx = 0;
          for (let d = 0; d < numDrafts; d++) for (let s = 0; s < numSeats; s++) {
            const oracle = picks[idx++] ?? '';
            const pack = allCurrentPacks[d]![s]!;
            const removeIdx = pack.indexOf(oracle);
            if (removeIdx >= 0) pack.splice(removeIdx, 1);
            allPools[d]![s]!.push(oracle);
            allPickMeta[d]![s]!.push({ packNumber: packNum, pickNumber: pickNumInPack });
            if (oracle) {
              const entry = getStats(oracle);
              entry.timesPicked++; entry.pickPositionSum += pickNumInPack; entry.pickPositionCount++;
              if (pickNumInPack > numSeats) entry.wheelCount++;
              if (packNum === 0 && pickNumInPack === 1) entry.p1p1Count++;
            }
          }

          donePicks++;
          onProgress(Math.round((donePicks / totalPicks) * 100));
          pickNumInPack++;
        }
      } else if (step.action === 'trash' || step.action === 'trashrandom') {
        const numTrash = step.amount ?? 1;
        for (let p = 0; p < numTrash; p++) {
          for (let d = 0; d < numDrafts; d++) for (let s = 0; s < numSeats; s++) { for (const oracle of allCurrentPacks[d]![s]!) getStats(oracle).timesSeen++; allCurrentPacks[d]![s]!.shift(); }
          pickNumInPack++;
        }
      } else if (step.action === 'pass') {
        const direction = packNum % 2 === 0 ? 1 : -1;
        for (let d = 0; d < numDrafts; d++) {
          const snapshot = allCurrentPacks[d]!.map((pack) => [...pack]);
          for (let s = 0; s < numSeats; s++) allCurrentPacks[d]![(s + direction + numSeats) % numSeats] = snapshot[s]!;
        }
      }
    }
  }

  // Build slimPools and archetypes
  const slimPools: SlimPool[] = [];
  for (let d = 0; d < numDrafts; d++) for (let s = 0; s < numSeats; s++) {
    const picks = allPools[d]![s]!;
    const metas = allPickMeta[d]![s]!;
    const archetype = assessPoolColors(picks, cardMeta);
    archetypeCounts.set(archetype, (archetypeCounts.get(archetype) ?? 0) + 1);
    const poolIndex = slimPools.length;
    slimPools.push({
      draftIndex: d,
      seatIndex: s,
      archetype,
      picks: picks.map((oracle_id, k) => ({ oracle_id, packNumber: metas[k]?.packNumber ?? 0, pickNumber: metas[k]?.pickNumber ?? 1 })),
    });
    for (const oracle of picks) if (oracle) statsMap.get(oracle)?.poolIndices.push(poolIndex);
  }

  const cardStats: CardStats[] = [];
  for (const [oracle_id, raw] of statsMap.entries()) {
    cardStats.push({ oracle_id, name: raw.name, colorIdentity: raw.colorIdentity, elo: raw.elo, timesSeen: raw.timesSeen, timesPicked: raw.timesPicked, pickRate: raw.timesSeen > 0 ? raw.timesPicked / raw.timesSeen : 0, avgPickPosition: raw.pickPositionCount > 0 ? raw.pickPositionSum / raw.pickPositionCount : 0, wheelCount: raw.wheelCount, p1p1Count: raw.p1p1Count, poolIndices: raw.poolIndices });
  }
  cardStats.sort((a, b) => a.avgPickPosition - b.avgPickPosition);

  const colorBalance: ColorBalance = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  for (const c of cardStats) {
    if (c.colorIdentity.length === 0) colorBalance.C += c.timesPicked;
    else for (const color of c.colorIdentity) if (color in colorBalance) colorBalance[color] = (colorBalance[color] ?? 0) + c.timesPicked;
  }

  const rates = cardStats.map((c) => c.pickRate);
  const mean = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const variance = rates.length > 0 ? rates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / rates.length : 0;
  const totalSeats = numDrafts * numSeats;
  const archetypeDistribution: ArchetypeEntry[] = [...archetypeCounts.entries()].map(([colorPair, count]) => ({ colorPair, count, percentage: count / totalSeats })).sort((a, b) => b.count - a.count);
  const p1p1Frequency: P1P1Entry[] = cardStats.filter((c) => c.p1p1Count > 0).sort((a, b) => b.p1p1Count - a.p1p1Count).slice(0, 20).map((c) => ({ oracle_id: c.oracle_id, name: c.name, count: c.p1p1Count, percentage: c.p1p1Count / totalSeats }));
  const deadCards = cardStats.filter((c) => c.pickRate < deadCardThreshold);

  const simulatedPools = reconstructSimulatedPools(slimPools, cardMeta);

  return { cubeId: '', cubeName, numDrafts, numSeats, deadCardThreshold, cardStats, deadCards, colorBalance, archetypeDistribution, p1p1Frequency, convergenceScore: Math.sqrt(variance), generatedAt: new Date().toISOString(), cardMeta, slimPools, simulatedPools };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SummaryCard: React.FC<{ label: string; value: string | number; sub?: string }> = ({ label, value, sub }) => (
  <Card className="flex-1 min-w-[140px]"><CardBody className="text-center"><Text lg semibold>{value}</Text><Text sm className="text-text-secondary mt-1">{label}</Text>{sub && <Text xs className="text-text-secondary mt-0.5">{sub}</Text>}</CardBody></Card>
);

const ColorDemandChart: React.FC<{ cardStats: CardStats[] }> = ({ cardStats }) => {
  const colorKeys = ['W', 'U', 'B', 'R', 'G'] as const;
  const sums: Record<string, { rateSum: number; count: number }> = Object.fromEntries(colorKeys.map((k) => [k, { rateSum: 0, count: 0 }]));
  for (const card of cardStats) { if (card.timesSeen === 0) continue; for (const color of card.colorIdentity) if (color in sums) { sums[color]!.rateSum += card.pickRate; sums[color]!.count++; } }
  return <Bar data={{ labels: colorKeys.map((k) => MTG_COLORS[k]!.label), datasets: [{ label: 'Avg Pick Rate (%)', data: colorKeys.map((k) => { const s = sums[k]!; return s.count > 0 ? Math.round((s.rateSum / s.count) * 1000) / 10 : 0; }), backgroundColor: colorKeys.map((k) => MTG_COLORS[k]!.bg), borderWidth: 1 }] }} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Avg Pick Rate (%)' } } } }} />;
};

const ArchetypeChart: React.FC<{
  archetypeDistribution: ArchetypeEntry[];
  selectedArchetype: string | null;
  onSelect: (colorPair: string | null) => void;
}> = ({ archetypeDistribution, selectedArchetype, onSelect }) => {
  const backgrounds = useMemo(() => archetypeDistribution.map((e) => {
    const letters = e.colorPair.split('').filter((c) => c in MTG_COLORS && c !== 'C' && c !== 'M');
    if (letters.length === 0) return MTG_COLORS.C!.bg;
    if (letters.length === 1) return MTG_COLORS[letters[0]!]!.bg;
    return createMultiStripe(letters.map((l) => MTG_COLORS[l]!.bg));
  }), [archetypeDistribution]);

  const chartHeight = Math.max(320, archetypeDistribution.length * 44);

  return (
    <div style={{ height: chartHeight, cursor: 'pointer' }}>
      <Bar
        data={{
          labels: archetypeDistribution.map((e) => archetypeFullName(e.colorPair)),
          datasets: [{
            label: 'Drafts',
            data: archetypeDistribution.map((e) => e.count),
            backgroundColor: backgrounds as any,
            borderColor: archetypeDistribution.map((e) =>
              e.colorPair === selectedArchetype ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.25)',
            ),
            borderWidth: archetypeDistribution.map((e) =>
              e.colorPair === selectedArchetype ? 3 : 1,
            ) as any,
          }],
        }}
        options={{
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          onClick: (_, elements) => {
            if (elements.length > 0) {
              const colorPair = archetypeDistribution[elements[0]!.index]?.colorPair ?? null;
              onSelect(colorPair === selectedArchetype ? null : colorPair);
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const entry = archetypeDistribution[ctx.dataIndex];
                  return entry ? ` ${entry.count} drafts (${(entry.percentage * 100).toFixed(1)}%)` : '';
                },
              },
            },
          },
          scales: {
            x: { beginAtZero: true, title: { display: true, text: 'Number of Drafts' } },
            y: { ticks: { autoSkip: false } },
          },
        }}
      />
    </div>
  );
};

type SortKey = keyof CardStats;
const CardStatsTable: React.FC<{ cardStats: CardStats[]; deadCardThreshold: number; onSelectCard: (id: string) => void; selectedCardOracle: string | null }> = ({ cardStats, deadCardThreshold, onSelectCard, selectedCardOracle }) => {
  const [sortKey, setSortKey] = useState<SortKey>('avgPickPosition');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState('');
  const handleSort = (key: SortKey) => { if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey(key); setSortDir('asc'); } };
  const sorted = [...cardStats.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))].sort((a, b) => { const av = a[sortKey]; const bv = b[sortKey]; const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv)); return sortDir === 'asc' ? cmp : -cmp; });
  const SH: React.FC<{ label: string; col: SortKey }> = ({ label, col }) => <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:bg-bg-active whitespace-nowrap" onClick={() => handleSort(col)}>{label}{sortKey === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</th>;
  return (
    <Flexbox direction="col" gap="2">
      <Input type="text" placeholder="Filter by card name…" value={filter} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)} className="max-w-xs" />
      <div className="overflow-x-auto rounded border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-bg-accent"><tr><SH label="Card" col="name" /><SH label="Seen" col="timesSeen" /><SH label="Picked" col="timesPicked" /><SH label="Pick Rate" col="pickRate" /><SH label="Avg Position" col="avgPickPosition" /><SH label="Wheels" col="wheelCount" /><SH label="P1P1" col="p1p1Count" /><th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">Pools</th></tr></thead>
          <tbody className="divide-y divide-border">{sorted.map((c) => { const isDead = c.pickRate < deadCardThreshold; return (<tr key={c.oracle_id} className={[c.oracle_id === selectedCardOracle ? 'bg-bg-active' : '', isDead ? 'bg-red-950/20' : 'hover:bg-bg-active'].filter(Boolean).join(' ')}><td className="px-3 py-1.5 font-medium">{c.name}{isDead && <span className="ml-2 text-xs bg-red-800 text-white rounded px-1">dead</span>}</td><td className="px-3 py-1.5 text-text-secondary">{c.timesSeen}</td><td className="px-3 py-1.5 text-text-secondary">{c.timesPicked}</td><td className="px-3 py-1.5"><span className={c.pickRate < deadCardThreshold ? 'text-red-400' : ''}>{(c.pickRate * 100).toFixed(1)}%</span></td><td className="px-3 py-1.5 text-text-secondary">{c.avgPickPosition > 0 ? c.avgPickPosition.toFixed(1) : '—'}</td><td className="px-3 py-1.5 text-text-secondary">{c.wheelCount}</td><td className="px-3 py-1.5 text-text-secondary">{c.p1p1Count}</td><td className="px-3 py-1.5"><button type="button" className="text-link hover:underline" onClick={() => onSelectCard(c.oracle_id)}>View {c.poolIndices.length}</button></td></tr>); })}</tbody>
        </table>
      </div>
    </Flexbox>
  );
};

const PickCard: React.FC<{ pick: SimulatedPickCard; isSelected: boolean }> = ({ pick, isSelected }) => (
  <div className={['relative rounded border overflow-hidden bg-bg flex-shrink-0', isSelected ? 'border-link-active ring-2 ring-link-active' : 'border-border'].join(' ')} style={{ width: 88 }}>
    {pick.imageUrl ? <img src={pick.imageUrl} alt={pick.name} className="w-full block" /> : <div className="w-full flex items-center justify-center p-1 text-xs text-text-secondary" style={{ height: 123 }}>{pick.name || 'Unknown'}</div>}
    <div className="absolute top-1 left-1 bg-black/80 text-white text-[10px] font-bold rounded px-1 leading-tight">P{pick.packNumber + 1}P{pick.pickNumber}</div>
  </div>
);

const CardPoolView: React.FC<{ card: CardStats; pools: SimulatedPool[] }> = ({ card, pools }) => {
  const [expandedPool, setExpandedPool] = useState<number | null>(pools[0]?.poolIndex ?? null);
  return (
    <Card>
      <CardHeader><Flexbox direction="row" justify="between" alignItems="center" className="flex-wrap gap-2"><div><Text semibold>{card.name}</Text><Text xs className="text-text-secondary mt-0.5">In {pools.length} draft pools</Text></div><Text xs className="text-text-secondary">Pick rate {(card.pickRate * 100).toFixed(1)}%, avg position {card.avgPickPosition > 0 ? card.avgPickPosition.toFixed(1) : '—'}</Text></Flexbox></CardHeader>
      <CardBody>
        {pools.length === 0 ? <Text sm className="text-text-secondary">Not picked in any simulated draft.</Text> : (
          <Flexbox direction="col" gap="3">{pools.map((pool) => {
            const isExpanded = expandedPool === pool.poolIndex;
            const orderedPicks = [...pool.picks].sort((a, b) => a.packNumber - b.packNumber || a.pickNumber - b.pickNumber);
            const thisCardPick = orderedPicks.find((p) => p.oracle_id === card.oracle_id);
            const pickLabel = thisCardPick ? `P${thisCardPick.packNumber + 1}P${thisCardPick.pickNumber}` : '';
            return (
              <div key={pool.poolIndex} className="border border-border rounded overflow-hidden">
                <button type="button" className="w-full flex items-center justify-between px-3 py-2 bg-bg-accent hover:bg-bg-active text-left" onClick={() => setExpandedPool(isExpanded ? null : pool.poolIndex)}>
                  <Flexbox direction="row" gap="3" alignItems="center"><Text sm semibold>Draft {pool.draftIndex + 1}, Seat {pool.seatIndex + 1}</Text><span className="text-xs bg-bg text-text-secondary rounded px-1.5 py-0.5 border border-border">{pool.archetype}</span>{pickLabel && <span className="text-xs bg-link/20 text-link rounded px-1.5 py-0.5 font-semibold">{card.name} @ {pickLabel}</span>}</Flexbox>
                  <Text xs className="text-text-secondary">{isExpanded ? '▲' : '▼'} {pool.picks.length} picks</Text>
                </button>
                {isExpanded && <div className="p-3 overflow-x-auto"><Flexbox direction="col" gap="2">{[0, 1, 2].map((packNum) => { const packPicks = orderedPicks.filter((p) => p.packNumber === packNum); if (packPicks.length === 0) return null; return (<div key={packNum}><Text xs className="text-text-secondary mb-1 font-semibold uppercase tracking-wider">Pack {packNum + 1}</Text><div className="flex flex-row gap-1.5 flex-wrap">{packPicks.map((pick) => <PickCard key={`${pick.packNumber}-${pick.pickNumber}`} pick={pick} isSelected={pick.oracle_id === card.oracle_id} />)}</div></div>); })}</Flexbox></div>}
              </div>
            );
          })}</Flexbox>
        )}
      </CardBody>
    </Card>
  );
};

const DraftVsEloTable: React.FC<{ cardStats: CardStats[] }> = ({ cardStats }) => {
  const picked = cardStats.filter((c) => c.timesPicked > 0 && c.avgPickPosition > 0);
  const eloRankMap = new Map([...picked].sort((a, b) => b.elo - a.elo).map((c, i) => [c.oracle_id, i + 1]));
  const draftRankMap = new Map([...picked].sort((a, b) => a.avgPickPosition - b.avgPickPosition).map((c, i) => [c.oracle_id, i + 1]));
  const rows = picked.map((c) => { const eloRank = eloRankMap.get(c.oracle_id) ?? 0; const draftRank = draftRankMap.get(c.oracle_id) ?? 0; return { oracle_id: c.oracle_id, name: c.name, elo: Math.round(c.elo), eloRank, draftRank, delta: eloRank - draftRank, avgPickPosition: c.avgPickPosition, pickRate: c.pickRate }; });
  const gainers = [...rows].sort((a, b) => b.delta - a.delta).slice(0, 20);
  const losers = [...rows].sort((a, b) => a.delta - b.delta).slice(0, 20);
  const cols = ['Card', 'Elo', 'Elo Rank', 'Draft Rank', 'Delta', 'Avg Position', 'Pick Rate'];
  const TH = () => <thead className="bg-bg-accent"><tr>{cols.map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">{h}</th>)}</tr></thead>;
  const DR: React.FC<{ row: typeof rows[0] }> = ({ row }) => <tr className="hover:bg-bg-active"><td className="px-3 py-1.5 font-medium">{row.name}</td><td className="px-3 py-1.5 text-text-secondary">{row.elo}</td><td className="px-3 py-1.5 text-text-secondary">#{row.eloRank}</td><td className="px-3 py-1.5 text-text-secondary">#{row.draftRank}</td><td className="px-3 py-1.5"><span className={row.delta > 0 ? 'text-green-400 font-medium' : row.delta < 0 ? 'text-red-400 font-medium' : ''}>{row.delta > 0 ? `+${row.delta}` : row.delta}</span></td><td className="px-3 py-1.5 text-text-secondary">{row.avgPickPosition.toFixed(1)}</td><td className="px-3 py-1.5 text-text-secondary">{(row.pickRate * 100).toFixed(1)}%</td></tr>;
  return (
    <Row className="gap-4">
      {[{ title: 'Draft Context Gainers (Top 20)', sub: 'Picked higher than Elo suggests — synergy overperformers', data: gainers }, { title: 'Draft Context Losers (Top 20)', sub: 'High Elo but drafted lower — situational or win-more', data: losers }].map(({ title, sub, data }) => (
        <Col key={title} xs={12} md={6}><Card><CardHeader><div><Text semibold>{title}</Text><Text xs className="text-text-secondary mt-0.5">{sub}</Text></div></CardHeader><CardBody><div className="overflow-x-auto rounded border border-border"><table className="min-w-full divide-y divide-border text-sm"><TH /><tbody className="divide-y divide-border">{data.map((row) => <DR key={row.oracle_id} row={row} />)}</tbody></table></div></CardBody></Card></Col>
      ))}
    </Row>
  );
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

interface CubeDraftSimulatorPageProps { cube: Cube; canRun: boolean; }

const CubeDraftSimulatorPage: React.FC<CubeDraftSimulatorPageProps> = ({ cube, canRun }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const cubeId = getCubeId(cube);

  // Controls
  const [numDrafts, setNumDrafts] = useState(50);
  const [numSeats, setNumSeats] = useState(8);
  const [deadCardThresholdPct, setDeadCardThresholdPct] = useState(5);

  // Simulation state
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [simulating, setSimulating] = useState(false); // true while ML call is in flight
  const [simProgress, setSimProgress] = useState(0); // 0–100
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Run history & display
  const [runs, setRuns] = useState<SimulationRunEntry[]>([]);
  const [displayRunData, setDisplayRunData] = useState<SimulationRunData | null>(null);
  const [selectedTs, setSelectedTs] = useState<number | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);

  // Card pool view
  const [selectedCardOracle, setSelectedCardOracle] = useState<string | null>(null);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);

  // Reconstruct SimulatedPool[] from slim pools for display (works for both fresh and historical)
  const simulatedPools = useMemo(
    () => displayRunData ? reconstructSimulatedPools(displayRunData.slimPools, displayRunData.cardMeta) : [],
    [displayRunData],
  );

  // Load run history on mount
  useEffect(() => {
    fetch(`/cube/api/simulatesave/${encodeURIComponent(cubeId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setRuns(data.runs ?? []);
          if (data.latestRunData) {
            setDisplayRunData(data.latestRunData);
            setSelectedTs(data.runs?.[0]?.ts ?? null);
          }
        }
      })
      .catch(() => {});
  }, [cubeId]);

  const handleLoadRun = useCallback(async (ts: number) => {
    if (ts === selectedTs && displayRunData) return;
    setLoadingRun(true);
    setSelectedCardOracle(null);
    try {
      const res = await fetch(`/cube/api/simulatesave/${encodeURIComponent(cubeId)}/${ts}`);
      const json = await res.json();
      if (json.success) { setDisplayRunData(json.runData); setSelectedTs(ts); }
    } finally {
      setLoadingRun(false);
    }
  }, [cubeId, selectedTs, displayRunData]);

  const handleStart = useCallback(async () => {
    setStatus('running'); setSimulating(true); setSimProgress(0); setErrorMsg(null); setSelectedCardOracle(null);
    try {
      const setupRes = await csrfFetch(`/cube/api/simulatesetup/${encodeURIComponent(cubeId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ numDrafts, numSeats }) });
      const setupData = await setupRes.json();
      if (!setupData.success) { setStatus('failed'); setErrorMsg(setupData.message ?? 'Failed to set up simulation'); return; }

      const report = await runClientSimulation(setupData as SimulationSetupResponse, numDrafts, deadCardThresholdPct / 100, setSimProgress);
      setSimulating(false);
      setStatus('completed');

      // Build SimulationRunData (everything except simulatedPools, which we don't persist)
      const { simulatedPools: _derived, ...runData } = report;

      // Save to S3 and get back the assigned ts
      const saveRes = await csrfFetch(`/cube/api/simulatesave/${encodeURIComponent(cubeId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(runData) });
      const saveJson = await saveRes.json();

      // Update display with fresh data immediately, then reload index
      setDisplayRunData(runData);
      setSelectedTs(saveJson.ts ?? null);

      fetch(`/cube/api/simulatesave/${encodeURIComponent(cubeId)}`)
        .then((r) => r.json())
        .then((data) => { if (data.success) setRuns(data.runs ?? []); })
        .catch(() => {});
    } catch (err) {
      setSimulating(false);
      setStatus('failed');
      setErrorMsg(err instanceof Error ? err.message : 'Simulation failed');
    }
  }, [csrfFetch, cubeId, numDrafts, numSeats, deadCardThresholdPct]);

  const isRunning = status === 'running';
  const lastRunTs = runs[0]?.ts ?? null;
  const cooldownActive = false; // TODO: re-enable before production
  const hoursUntilNext = 0;

  const selectedCard = displayRunData && selectedCardOracle ? displayRunData.cardStats.find((c) => c.oracle_id === selectedCardOracle) ?? null : null;
  const selectedPools = selectedCard
    ? selectedCard.poolIndices
        .map((i) => simulatedPools[i])
        .filter((p): p is SimulatedPool => Boolean(p) && (!selectedArchetype || p.archetype === selectedArchetype))
    : [];

  return (
    <MainLayout>
      <DisplayContextProvider cubeID={cubeId}>
        <CubeLayout cube={cube} activeLink="draft-simulator">
          <Flexbox direction="col" gap="4" className="p-4">
            <DynamicFlash />

            {/* Controls */}
            <Card>
              <CardHeader><Text lg semibold>Draft Simulator</Text></CardHeader>
              <CardBody>
                <Text className="text-text-secondary mb-4">Simulate bot-only drafts to analyze pick rates, color demand, and archetype distribution. Runs in your browser — results are saved once per day.</Text>
                {!canRun && <Text sm className="text-yellow-400 mb-3">Only cube owners and collaborators can run the draft simulator.</Text>}
                {lastRunTs && <Text xs className="text-text-secondary mb-3">Last run: {new Date(lastRunTs).toLocaleString()}{cooldownActive && ` — next run available in ${hoursUntilNext}h`}</Text>}
                <Row className="gap-4 flex-wrap items-end">
                  <Col xs={12} sm={4} md={2}><label className="block text-sm font-medium mb-1">Drafts</label><Input type="number" min={1} max={100} value={String(numDrafts)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNumDrafts(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))} disabled={isRunning} /></Col>
                  <Col xs={12} sm={4} md={2}><label className="block text-sm font-medium mb-1">Seats</label><Input type="number" min={2} max={16} value={String(numSeats)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNumSeats(Math.max(2, Math.min(16, parseInt(e.target.value) || 8)))} disabled={isRunning} /></Col>
                  <Col xs={12} sm={4} md={2}><label className="block text-sm font-medium mb-1">Dead Card Threshold (%)</label><Input type="number" min={1} max={100} value={String(deadCardThresholdPct)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeadCardThresholdPct(Math.max(1, Math.min(100, parseInt(e.target.value) || 5)))} disabled={isRunning} /></Col>
                  <Col xs={12} sm={12} md={2}>
                    <button onClick={handleStart} disabled={isRunning || cooldownActive || !canRun} className="w-full px-4 py-2 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium">
                      {isRunning ? 'Simulating…' : cooldownActive ? `Available in ${hoursUntilNext}h` : !canRun ? 'Owner/collaborator only' : 'Run Simulation'}
                    </button>
                  </Col>
                </Row>
              </CardBody>
            </Card>

            {/* Progress */}
            {isRunning && (
              <Card><CardBody>
                <Flexbox direction="col" gap="2">
                  <Flexbox direction="row" justify="between">
                    <Text sm>{simulating ? 'Running draft simulation…' : 'Saving results…'}</Text>
                    {simulating && <Text sm className="text-text-secondary">{simProgress}%</Text>}
                  </Flexbox>
                  <div className="w-full bg-bg rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: simulating ? `${Math.max(2, simProgress)}%` : '100%' }}
                    />
                  </div>
                </Flexbox>
              </CardBody></Card>
            )}

            {/* Error */}
            {status === 'failed' && errorMsg && <Card className="border-red-700"><CardBody><Text sm className="text-red-400">Error: {errorMsg}</Text></CardBody></Card>}

            {/* Run history */}
            {runs.length > 0 && (
              <Card>
                <CardHeader><Text semibold>Run History</Text></CardHeader>
                <CardBody>
                  <div className="overflow-x-auto rounded border border-border">
                    <table className="min-w-full divide-y divide-border text-sm">
                      <thead className="bg-bg-accent">
                        <tr>
                          {['Date', 'Drafts', 'Dead Cards', 'Convergence'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {runs.map((run) => (
                          <tr
                            key={run.ts}
                            onClick={() => handleLoadRun(run.ts)}
                            className={[
                              'cursor-pointer',
                              run.ts === selectedTs ? 'bg-bg-active font-semibold' : 'hover:bg-bg-active',
                            ].join(' ')}
                          >
                            <td className="px-3 py-1.5">{new Date(run.generatedAt).toLocaleString()}</td>
                            <td className="px-3 py-1.5 text-text-secondary">{run.numDrafts} × {run.numSeats} seats</td>
                            <td className="px-3 py-1.5 text-text-secondary">{run.deadCardCount}</td>
                            <td className="px-3 py-1.5 text-text-secondary">{run.convergenceScore.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {loadingRun && <Text xs className="text-text-secondary mt-2">Loading run…</Text>}
                </CardBody>
              </Card>
            )}

            {/* Results */}
            {displayRunData && (
              <Flexbox direction="col" gap="4">
                <Flexbox direction="row" gap="3" className="flex-wrap">
                  <SummaryCard label="Drafts Simulated" value={displayRunData.numDrafts} sub={`${displayRunData.numSeats} seats each`} />
                  <SummaryCard label="Dead Cards" value={displayRunData.deadCards.length} sub={`< ${(displayRunData.deadCardThreshold * 100).toFixed(0)}% pick rate`} />
                  <SummaryCard label="Convergence Score" value={displayRunData.convergenceScore.toFixed(3)} sub="stdev of pick rates" />
                  <SummaryCard label="Cards Tracked" value={displayRunData.cardStats.length} />
                </Flexbox>
                <Row className="gap-4">
                  <Col xs={12} md={4}><Card><CardHeader><div><Text semibold>Color Demand</Text><Text xs className="text-text-secondary mt-0.5">Avg pick rate per color</Text></div></CardHeader><CardBody><ColorDemandChart cardStats={displayRunData.cardStats} /></CardBody></Card></Col>
                  <Col xs={12} md={8}>
                    <Card>
                      <CardHeader>
                        <Flexbox direction="row" justify="between" alignItems="center">
                          <Text semibold>Archetype Distribution</Text>
                          {selectedArchetype && (
                            <Flexbox direction="row" gap="2" alignItems="center">
                              <Text xs className="text-text-secondary">Filtered: {archetypeFullName(selectedArchetype)}</Text>
                              <button type="button" className="text-xs text-link hover:underline" onClick={() => setSelectedArchetype(null)}>Clear</button>
                            </Flexbox>
                          )}
                        </Flexbox>
                      </CardHeader>
                      <CardBody>
                        <ArchetypeChart
                          archetypeDistribution={displayRunData.archetypeDistribution}
                          selectedArchetype={selectedArchetype}
                          onSelect={setSelectedArchetype}
                        />
                        {selectedArchetype && (
                          <Text xs className="text-text-secondary mt-2">
                            Showing {simulatedPools.filter((p) => p.archetype === selectedArchetype).length} of {simulatedPools.length} pools — click a card below to explore them
                          </Text>
                        )}
                      </CardBody>
                    </Card>
                  </Col>
                </Row>
                <Card><CardHeader><Text semibold>P1P1 Frequency (Top 20)</Text></CardHeader><CardBody><div className="overflow-x-auto rounded border border-border"><table className="min-w-full divide-y divide-border text-sm"><thead className="bg-bg-accent"><tr>{['Card', 'Times P1P1', '% of Seats'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{displayRunData.p1p1Frequency.map((e) => <tr key={e.oracle_id} className="hover:bg-bg-active"><td className="px-3 py-1.5 font-medium">{e.name}</td><td className="px-3 py-1.5 text-text-secondary">{e.count}</td><td className="px-3 py-1.5 text-text-secondary">{(e.percentage * 100).toFixed(1)}%</td></tr>)}</tbody></table></div></CardBody></Card>
                <DraftVsEloTable cardStats={displayRunData.cardStats} />
                <Card><CardHeader><Flexbox direction="row" justify="between" alignItems="center"><Text semibold>All Card Stats</Text><Text xs className="text-text-secondary">Sorted by avg pick position</Text></Flexbox></CardHeader><CardBody><CardStatsTable cardStats={displayRunData.cardStats} deadCardThreshold={displayRunData.deadCardThreshold} onSelectCard={setSelectedCardOracle} selectedCardOracle={selectedCardOracle} /></CardBody></Card>
                {selectedCard && <CardPoolView card={selectedCard} pools={selectedPools} />}
                <Text xs className="text-text-secondary text-right">Generated {new Date(displayRunData.generatedAt).toLocaleString()}</Text>
              </Flexbox>
            )}
          </Flexbox>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

export default RenderToRoot(CubeDraftSimulatorPage);

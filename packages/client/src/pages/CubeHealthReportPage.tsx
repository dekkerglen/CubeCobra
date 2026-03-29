import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';

import Cube from '@utils/datatypes/Cube';
import { CardStats, HealthReport } from '@utils/datatypes/HealthReport';
import { getCubeId } from '@utils/Util';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

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

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// ── Color constants ──────────────────────────────────────────────────────────

const MTG_COLORS: Record<string, { bg: string; label: string }> = {
  W: { bg: 'rgba(248, 231, 185, 0.8)', label: 'White' },
  U: { bg: 'rgba(103, 166, 211, 0.8)', label: 'Blue' },
  B: { bg: 'rgba(100, 89, 107, 0.8)', label: 'Black' },
  R: { bg: 'rgba(216, 95, 105, 0.8)', label: 'Red' },
  G: { bg: 'rgba(106, 181, 114, 0.8)', label: 'Green' },
  C: { bg: 'rgba(173, 173, 173, 0.8)', label: 'Colorless' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string | number;
  sub?: string;
}
const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, sub }) => (
  <Card className="flex-1 min-w-[140px]">
    <CardBody className="text-center">
      <Text lg semibold>
        {value}
      </Text>
      <Text sm className="text-text-secondary mt-1">
        {label}
      </Text>
      {sub && (
        <Text xs className="text-text-secondary mt-0.5">
          {sub}
        </Text>
      )}
    </CardBody>
  </Card>
);

interface ColorBalanceChartProps {
  colorBalance: HealthReport['colorBalance'];
}
const ColorBalanceChart: React.FC<ColorBalanceChartProps> = ({ colorBalance }) => {
  const labels = Object.keys(MTG_COLORS).map((k) => MTG_COLORS[k]!.label);
  const data = Object.keys(MTG_COLORS).map((k) => (colorBalance as Record<string, number>)[k] ?? 0);
  const bgColors = Object.keys(MTG_COLORS).map((k) => MTG_COLORS[k]!.bg);

  return (
    <Bar
      data={{
        labels,
        datasets: [{ label: 'Cards Drafted', data, backgroundColor: bgColors, borderWidth: 1 }],
      }}
      options={{
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Cards Drafted' } } },
      }}
    />
  );
};

interface ArchetypeChartProps {
  archetypeDistribution: HealthReport['archetypeDistribution'];
}
const ArchetypeChart: React.FC<ArchetypeChartProps> = ({ archetypeDistribution }) => {
  const top = archetypeDistribution.slice(0, 10);
  const labels = top.map((e) => e.colorPair);
  const data = top.map((e) => e.count);
  const bgColors = top.map((e) => {
    // Use the first color of the pair as background
    const firstColor = e.colorPair === 'C' ? 'C' : e.colorPair[0] ?? 'C';
    return MTG_COLORS[firstColor]?.bg ?? 'rgba(173,173,173,0.8)';
  });

  return (
    <Pie
      data={{
        labels,
        datasets: [{ data, backgroundColor: bgColors, borderWidth: 1 }],
      }}
      options={{
        responsive: true,
        plugins: { legend: { position: 'right' } },
      }}
    />
  );
};

type SortKey = keyof CardStats;
type SortDir = 'asc' | 'desc';

interface CardStatsTableProps {
  cardStats: CardStats[];
  deadCardThreshold: number;
}
const CardStatsTable: React.FC<CardStatsTableProps> = ({ cardStats, deadCardThreshold }) => {
  const [sortKey, setSortKey] = useState<SortKey>('avgPickPosition');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filter, setFilter] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = cardStats.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    const cmp =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortHeader: React.FC<{ label: string; col: SortKey }> = ({ label, col }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:bg-bg-active whitespace-nowrap"
      onClick={() => handleSort(col)}
    >
      {label}
      {sortKey === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <Flexbox direction="col" gap="2">
      <Input
        type="text"
        placeholder="Filter by card name…"
        value={filter}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
        className="max-w-xs"
      />
      <div className="overflow-x-auto rounded border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-bg-accent">
            <tr>
              <SortHeader label="Card" col="name" />
              <SortHeader label="Seen" col="timesSeen" />
              <SortHeader label="Picked" col="timesPicked" />
              <SortHeader label="Pick Rate" col="pickRate" />
              <SortHeader label="Avg Position" col="avgPickPosition" />
              <SortHeader label="Wheels" col="wheelCount" />
              <SortHeader label="P1P1" col="p1p1Count" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((c) => {
              const isDead = c.pickRate < deadCardThreshold;
              return (
                <tr
                  key={c.oracle_id}
                  className={isDead ? 'bg-red-950/20' : 'hover:bg-bg-active'}
                >
                  <td className="px-3 py-1.5 font-medium">
                    {c.name}
                    {isDead && (
                      <span className="ml-2 text-xs bg-red-800 text-white rounded px-1">dead</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-text-secondary">{c.timesSeen}</td>
                  <td className="px-3 py-1.5 text-text-secondary">{c.timesPicked}</td>
                  <td className="px-3 py-1.5">
                    <span className={c.pickRate < deadCardThreshold ? 'text-red-400' : ''}>
                      {(c.pickRate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-text-secondary">
                    {c.avgPickPosition > 0 ? c.avgPickPosition.toFixed(1) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-text-secondary">{c.wheelCount}</td>
                  <td className="px-3 py-1.5 text-text-secondary">{c.p1p1Count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Flexbox>
  );
};

// ── Main page component ───────────────────────────────────────────────────────

interface CubeHealthReportPageProps {
  cube: Cube;
}

const CubeHealthReportPage: React.FC<CubeHealthReportPageProps> = ({ cube }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const cubeId = getCubeId(cube);

  const [numDrafts, setNumDrafts] = useState(100);
  const [numSeats, setNumSeats] = useState(8);
  const [deadCardThresholdPct, setDeadCardThresholdPct] = useState(5); // displayed as %

  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState<{ currentDraft: number; totalDrafts: number; percentage: number } | null>(null);
  const [result, setResult] = useState<HealthReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback(
    (jId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/cube/api/simulate/${encodeURIComponent(cubeId)}/${jId}`);
          const data = await res.json();
          if (!data.success) {
            stopPolling();
            setStatus('failed');
            setErrorMsg(data.message ?? 'Unknown error');
            return;
          }
          const job = data.job;
          if (job.status === 'completed') {
            stopPolling();
            setStatus('completed');
            setResult(job.result);
          } else if (job.status === 'failed') {
            stopPolling();
            setStatus('failed');
            setErrorMsg(job.error ?? 'Simulation failed');
          } else if (job.progress) {
            setProgress(job.progress);
          }
        } catch {
          stopPolling();
          setStatus('failed');
          setErrorMsg('Lost connection to server');
        }
      }, 2000);
    },
    [cubeId, stopPolling],
  );

  const handleStart = useCallback(async () => {
    setStatus('running');
    setProgress(null);
    setResult(null);
    setErrorMsg(null);
    setJobId(null);

    try {
      const res = await csrfFetch(`/cube/api/simulate/${encodeURIComponent(cubeId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numDrafts,
          numSeats,
          deadCardThreshold: deadCardThresholdPct / 100,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setStatus('failed');
        setErrorMsg(data.message ?? 'Failed to start simulation');
        return;
      }
      setJobId(data.jobId);
      startPolling(data.jobId);
    } catch {
      setStatus('failed');
      setErrorMsg('Failed to start simulation');
    }
  }, [csrfFetch, cubeId, numDrafts, numSeats, deadCardThresholdPct, startPolling]);

  const isRunning = status === 'running';

  return (
    <MainLayout>
        <DisplayContextProvider cubeID={cubeId}>
          <CubeLayout cube={cube} activeLink="health-report">
          <Flexbox direction="col" gap="4" className="p-4">
            <DynamicFlash />

            {/* Config form */}
            <Card>
              <CardHeader>
                <Text lg semibold>
                  Cube Health Report
                </Text>
              </CardHeader>
              <CardBody>
                <Text className="text-text-secondary mb-4">
                  Simulate multiple bot-only drafts to analyze card pick rates, color balance, and
                  archetype distribution. Uses the ML draft bot — requires the ML service to be
                  running.
                </Text>
                <Row className="gap-4 flex-wrap items-end">
                  <Col xs={12} sm={4} md={2}>
                    <label className="block text-sm font-medium mb-1">Number of Drafts</label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={String(numDrafts)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNumDrafts(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))
                      }
                      disabled={isRunning}
                    />
                  </Col>
                  <Col xs={12} sm={4} md={2}>
                    <label className="block text-sm font-medium mb-1">Seats</label>
                    <Input
                      type="number"
                      min={2}
                      max={16}
                      value={String(numSeats)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNumSeats(Math.max(2, Math.min(16, parseInt(e.target.value) || 8)))
                      }
                      disabled={isRunning}
                    />
                  </Col>
                  <Col xs={12} sm={4} md={2}>
                    <label className="block text-sm font-medium mb-1">Dead Card Threshold (%)</label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={String(deadCardThresholdPct)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setDeadCardThresholdPct(
                          Math.max(1, Math.min(100, parseInt(e.target.value) || 5)),
                        )
                      }
                      disabled={isRunning}
                    />
                  </Col>
                  <Col xs={12} sm={12} md={2}>
                    <button
                      onClick={handleStart}
                      disabled={isRunning}
                      className="w-full px-4 py-2 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium"
                    >
                      {isRunning ? 'Simulating…' : 'Run Simulation'}
                    </button>
                  </Col>
                </Row>
              </CardBody>
            </Card>

            {/* Progress */}
            {isRunning && progress && (
              <Card>
                <CardBody>
                  <Flexbox direction="col" gap="2">
                    <Text sm>
                      Drafting {progress.currentDraft} / {progress.totalDrafts}…
                    </Text>
                    <div className="w-full bg-bg rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                    <Text xs className="text-text-secondary">
                      {progress.percentage}% complete
                    </Text>
                  </Flexbox>
                </CardBody>
              </Card>
            )}

            {isRunning && !progress && (
              <Card>
                <CardBody>
                  <Text sm className="text-text-secondary">
                    Starting simulation…
                  </Text>
                </CardBody>
              </Card>
            )}

            {/* Error */}
            {status === 'failed' && errorMsg && (
              <Card className="border-red-700">
                <CardBody>
                  <Text sm className="text-red-400">
                    Error: {errorMsg}
                  </Text>
                </CardBody>
              </Card>
            )}

            {/* Results */}
            {status === 'completed' && result && (
              <Flexbox direction="col" gap="4">
                {/* Summary row */}
                <Flexbox direction="row" gap="3" className="flex-wrap">
                  <SummaryCard
                    label="Drafts Simulated"
                    value={result.numDrafts}
                    sub={`${result.numSeats} seats each`}
                  />
                  <SummaryCard
                    label="Dead Cards"
                    value={result.deadCards.length}
                    sub={`< ${(result.deadCardThreshold * 100).toFixed(0)}% pick rate`}
                  />
                  <SummaryCard
                    label="Convergence Score"
                    value={result.convergenceScore.toFixed(3)}
                    sub="stdev of pick rates"
                  />
                  <SummaryCard
                    label="Total Cards Tracked"
                    value={result.cardStats.length}
                  />
                </Flexbox>

                {/* Charts row */}
                <Row className="gap-4">
                  <Col xs={12} md={6}>
                    <Card>
                      <CardHeader>
                        <Text semibold>Color Balance</Text>
                      </CardHeader>
                      <CardBody>
                        <ColorBalanceChart colorBalance={result.colorBalance} />
                      </CardBody>
                    </Card>
                  </Col>
                  <Col xs={12} md={6}>
                    <Card>
                      <CardHeader>
                        <Text semibold>Archetype Distribution</Text>
                      </CardHeader>
                      <CardBody>
                        <ArchetypeChart archetypeDistribution={result.archetypeDistribution} />
                      </CardBody>
                    </Card>
                  </Col>
                </Row>

                {/* P1P1 Frequency */}
                <Card>
                  <CardHeader>
                    <Text semibold>P1P1 Frequency (Top 20)</Text>
                  </CardHeader>
                  <CardBody>
                    <div className="overflow-x-auto rounded border border-border">
                      <table className="min-w-full divide-y divide-border text-sm">
                        <thead className="bg-bg-accent">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">Card</th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">Times P1P1</th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">% of Seats</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {result.p1p1Frequency.map((entry) => (
                            <tr key={entry.oracle_id} className="hover:bg-bg-active">
                              <td className="px-3 py-1.5 font-medium">{entry.name}</td>
                              <td className="px-3 py-1.5 text-text-secondary">{entry.count}</td>
                              <td className="px-3 py-1.5 text-text-secondary">
                                {(entry.percentage * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardBody>
                </Card>

                {/* Full card stats table */}
                <Card>
                  <CardHeader>
                    <Flexbox direction="row" justify="between" alignItems="center">
                      <Text semibold>All Card Stats</Text>
                      <Text xs className="text-text-secondary">
                        Sorted by avg pick position — lower = higher priority
                      </Text>
                    </Flexbox>
                  </CardHeader>
                  <CardBody>
                    <CardStatsTable
                      cardStats={result.cardStats}
                      deadCardThreshold={result.deadCardThreshold}
                    />
                  </CardBody>
                </Card>

                <Text xs className="text-text-secondary text-right">
                  Generated {new Date(result.generatedAt).toLocaleString()}
                </Text>
              </Flexbox>
            )}
          </Flexbox>
          </CubeLayout>
        </DisplayContextProvider>
    </MainLayout>
  );
};

export default RenderToRoot(CubeHealthReportPage);

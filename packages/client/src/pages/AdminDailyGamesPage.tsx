import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DailyGameSeries, DailyGameStatsResponse } from '@utils/datatypes/DailyGameStats';

import { LineChart, StackedBarChart } from 'components/admin/AdminCharts';
import Alert from 'components/base/Alert';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Select from 'components/base/Select';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import MainLayout from 'layouts/MainLayout';

interface AdminDailyGamesPageProps {
  defaultStartDate: string;
  defaultEndDate: string;
  maxRangeDays: number;
}

// Semantic colours, reused across every game so a glance at two cards compares like with
// like: green finished, amber still going, blue page hits, grey logged-in visitors.
const FINISHED = '#6AB572';
const PARTIAL = '#DBC467';
const LOCKED_OUT = '#D85F69';
const PAGE_HITS = '#67A6D3';
const VISITORS = '#8C7A91';
const STARTED = '#5FA8A0';

/** Shown when the date inputs don't correspond to any preset. Selecting it is a no-op. */
const CUSTOM_RANGE = 'custom';

const RANGE_PRESETS = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
];

const RANGE_OPTIONS = [{ value: CUSTOM_RANGE, label: 'Custom range' }, ...RANGE_PRESETS];

const utcDayOffset = (offsetDays: number): string =>
  new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** `2026-09-28` -> `9/28`. Parsed as UTC so the label matches the puzzle date, not the viewer's. */
const formatDayLabel = (date: string): string => {
  const parts = date.split('-');
  return `${Number(parts[1])}/${Number(parts[2])}`;
};

/** An em dash for "there is no number here", which is not the same as zero. */
const NO_VALUE = '—';

const formatPercent = (value: number | null | undefined): string =>
  typeof value === 'number' ? `${Math.round(value * 1000) / 10}%` : NO_VALUE;

const formatDuration = (ms: number | null | undefined): string => {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) {
    return NO_VALUE;
  }
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

/** Milliseconds the day's median solve took, or undefined if nobody solved it. */
const medianMs = (day: { medianCompletionTimeMs?: number | null }): number | undefined =>
  typeof day.medianCompletionTimeMs === 'number' ? day.medianCompletionTimeMs : undefined;

interface StatProps {
  label: string;
  value: string;
  sub?: string;
}

const Stat: React.FC<StatProps> = ({ label, value, sub }) => (
  <Flexbox direction="col" gap="0" className="min-w-24">
    <Text sm className="text-text-secondary">
      {label}
    </Text>
    <Text semibold xl>
      {value}
    </Text>
    {sub && (
      <Text xs className="text-text-secondary">
        {sub}
      </Text>
    )}
  </Flexbox>
);

interface ChartPanelProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

const ChartPanel: React.FC<ChartPanelProps> = ({ title, subtitle, children }) => (
  <Flexbox direction="col" gap="1">
    <Text semibold>{title}</Text>
    <Text xs className="text-text-secondary">
      {subtitle}
    </Text>
    {children}
  </Flexbox>
);

const GameCard: React.FC<{ series: DailyGameSeries }> = ({ series }) => {
  const labels = series.days.map((day) => formatDayLabel(day.date));

  const totalStarted = sum(series.days.map((day) => day.started));
  const totalFinished = sum(series.days.map((day) => day.finished));
  const totalHits = series.pageHits ? sum(series.pageHits.map((point) => point.hits)) : null;
  const totalVisitors = series.pageHits ? sum(series.pageHits.map((point) => point.loggedInUsers)) : null;

  // Locked-out players sit inside `partial`, so the stack shows them as their own band rather
  // than double-counting: still going = partial - locked out.
  const hasLockedOut = series.days.some((day) => (day.exhausted ?? 0) > 0);
  const funnelDatasets = hasLockedOut
    ? [
        { label: 'Finished', data: series.days.map((day) => day.finished), color: FINISHED },
        { label: 'Locked out (4 mistakes)', data: series.days.map((day) => day.exhausted ?? 0), color: LOCKED_OUT },
        {
          label: 'Still partial',
          data: series.days.map((day) => Math.max(0, day.partial - (day.exhausted ?? 0))),
          color: PARTIAL,
        },
      ]
    : [
        { label: 'Finished', data: series.days.map((day) => day.finished), color: FINISHED },
        { label: 'Partial', data: series.days.map((day) => day.partial), color: PARTIAL },
      ];

  const reachDatasets = [
    ...(series.pageHits
      ? [
          { label: 'Page hits (all traffic)', data: series.pageHits.map((point) => point.hits), color: PAGE_HITS },
          {
            label: 'Logged-in visitors',
            data: series.pageHits.map((point) => point.loggedInUsers),
            color: VISITORS,
          },
        ]
      : []),
    { label: 'Players (logged in)', data: series.days.map((day) => day.started), color: STARTED },
    ...(series.hasFunnel ? [{ label: 'Finished', data: series.days.map((day) => day.finished), color: FINISHED }] : []),
  ];

  const hasEngaged = series.days.some((day) => day.engaged !== undefined);
  const medians = series.days.map(medianMs).filter((ms): ms is number => ms !== undefined);
  const hasMedian = medians.length > 0;

  return (
    <Card className="my-3">
      <CardHeader>
        <Flexbox direction="row" justify="between" wrap="wrap" gap="2" alignItems="center">
          <Text semibold lg>
            {series.label}
          </Text>
          <Text xs className="text-text-secondary">
            {series.pageRoute}
          </Text>
        </Flexbox>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="4">
          <Flexbox direction="row" wrap="wrap" gap="6">
            <Stat
              label={series.hasFunnel ? 'Players' : 'Voters'}
              value={totalStarted.toLocaleString()}
              sub="logged in, over the range"
            />
            {series.hasFunnel && <Stat label="Finished" value={totalFinished.toLocaleString()} />}
            {series.hasFunnel && (
              <Stat
                label="Completion rate"
                value={formatPercent(totalStarted === 0 ? null : totalFinished / totalStarted)}
                sub="finished / players"
              />
            )}
            <Stat
              label="Page hits"
              value={totalHits === null ? NO_VALUE : totalHits.toLocaleString()}
              sub="all traffic, bots included"
            />
            <Stat
              label="Play-through"
              value={formatPercent(totalHits === null || totalHits === 0 ? null : totalStarted / totalHits)}
              sub="players / page hits"
            />
            {totalVisitors !== null && (
              <Stat label="Logged-in visitors" value={totalVisitors.toLocaleString()} sub="distinct, from the log" />
            )}
          </Flexbox>

          {series.pageHitsError && (
            <Alert color="warning">
              {`Page hits unavailable: ${series.pageHitsError} The submission-derived series below are unaffected.`}
            </Alert>
          )}

          <Row xs={12} gutters={2}>
            {series.hasFunnel && (
              <Col xs={12} lg={6}>
                <ChartPanel
                  title="Outcome per day"
                  subtitle="Logged-in players only, by puzzle date. Stacked, so the bar height is everyone who played."
                >
                  <StackedBarChart labels={labels} datasets={funnelDatasets} height={220} />
                </ChartPanel>
              </Col>
            )}
            <Col xs={12} lg={series.hasFunnel ? 6 : 12}>
              <ChartPanel
                title="Reach vs. play"
                subtitle="Page hits are request-log counts by visit day; players are submissions by puzzle date. Different populations — read the gap, not the difference."
              >
                <LineChart labels={labels} datasets={reachDatasets} height={220} />
              </ChartPanel>
            </Col>
            {series.hasFunnel && (
              <Col xs={12} lg={hasMedian ? 6 : 12}>
                <ChartPanel
                  title="Completion rate per day"
                  subtitle="Share of the day's players who finished. The difficulty signal: a dip means the puzzle was hard."
                >
                  <LineChart
                    labels={labels}
                    datasets={[
                      {
                        label: 'Completion rate (%)',
                        data: series.days.map((day) => (day.completionRate === null ? 0 : day.completionRate * 100)),
                        color: FINISHED,
                      },
                      ...(hasEngaged
                        ? [
                            {
                              label: 'Engaged (%) of openers',
                              data: series.days.map((day) =>
                                day.started === 0 ? 0 : ((day.engaged ?? 0) / day.started) * 100,
                              ),
                              color: PARTIAL,
                            },
                          ]
                        : []),
                    ]}
                    height={220}
                  />
                </ChartPanel>
              </Col>
            )}
            {hasMedian && (
              <Col xs={12} lg={6}>
                <ChartPanel
                  title="Median solve time"
                  subtitle="Minutes, over the players who solved it. The game's own scoring metric, so this is what difficulty looks like."
                >
                  <LineChart
                    labels={labels}
                    datasets={[
                      {
                        label: 'Median minutes to solve',
                        data: series.days.map((day) => {
                          const ms = medianMs(day);
                          return ms === undefined ? 0 : Math.round((ms / 60000) * 10) / 10;
                        }),
                        color: VISITORS,
                      },
                    ]}
                    height={220}
                  />
                </ChartPanel>
              </Col>
            )}
          </Row>

          <Flexbox direction="col" gap="1">
            {series.notes.map((note) => (
              <Text key={note} xs className="text-text-secondary">
                {`· ${note}`}
              </Text>
            ))}
            {hasMedian && (
              <Text xs className="text-text-secondary">
                {`· Fastest day: median ${formatDuration(Math.min(...medians))}; slowest day: median ${formatDuration(
                  Math.max(...medians),
                )}.`}
              </Text>
            )}
          </Flexbox>
        </Flexbox>
      </CardBody>
    </Card>
  );
};

const AdminDailyGamesPage: React.FC<AdminDailyGamesPageProps> = ({
  defaultStartDate,
  defaultEndDate,
  maxRangeDays,
}) => {
  const { callApi } = useContext(CSRFContext);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [series, setSeries] = useState<DailyGameSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (from: string, to: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await callApi('/admin/dailygames/stats', { startDate: from, endDate: to });
        const json = (await response.json()) as DailyGameStatsResponse & { success: string; error?: string };
        if (json.success === 'true') {
          setSeries(json.series);
        } else {
          setError(json.error || 'Query failed');
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [callApi],
  );

  useEffect(() => {
    load(defaultStartDate, defaultEndDate);
  }, [load, defaultStartDate, defaultEndDate]);

  const applyPreset = useCallback(
    (days: string) => {
      // The CUSTOM_RANGE sentinel is what the select shows when the dates don't match a
      // preset; picking it should not move them.
      if (days === CUSTOM_RANGE) {
        return;
      }
      const from = utcDayOffset(-(Number(days) - 1));
      const to = utcDayOffset(0);
      setStartDate(from);
      setEndDate(to);
      load(from, to);
    },
    [load],
  );

  const rangeDays = useMemo(() => {
    const from = Date.parse(`${startDate}T00:00:00Z`);
    const to = Date.parse(`${endDate}T00:00:00Z`);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
      return 0;
    }
    return Math.round((to - from) / (24 * 60 * 60 * 1000)) + 1;
  }, [startDate, endDate]);

  // Keep the preset select honest: it shows a preset only while the dates actually are that
  // preset (N days ending today), and falls back to "Custom range" the moment they aren't.
  const presetValue = useMemo(() => {
    const endsToday = endDate === utcDayOffset(0);
    const match = RANGE_PRESETS.find((preset) => endsToday && Number(preset.value) === rangeDays);
    return match ? match.value : CUSTOM_RANGE;
  }, [endDate, rangeDays]);

  const rangeInvalid = rangeDays === 0 || rangeDays > maxRangeDays;

  return (
    <MainLayout>
      <DynamicFlash />
      <Container xl>
        <Card className="my-3">
          <CardHeader>
            <Text semibold xl>
              Daily Games
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <Text sm className="text-text-secondary">
                Starts, partial completions and finishes per day for each daily game. Two data sources sit side by side
                here and they count different people: the started / partial / finished bars come from persisted
                submissions, so they are <strong>logged-in players only</strong> — ManaMatrix, Synergy Connect and the
                Crossword all play anonymously without storing anything. Page hits come from the server request log, so
                they include anonymous visitors <em>and bots</em>, which nothing filters. Use the gap between them as a
                rough play-through rate, not as a precise one.
              </Text>

              <Row xs={12} gutters={2}>
                <Col xs={12} md={3}>
                  <Input
                    type="date"
                    label="Start date"
                    id="daily-games-start"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </Col>
                <Col xs={12} md={3}>
                  <Input
                    type="date"
                    label="End date"
                    id="daily-games-end"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </Col>
                <Col xs={12} md={3}>
                  <Select
                    label="Preset"
                    id="daily-games-preset"
                    options={RANGE_OPTIONS}
                    value={presetValue}
                    setValue={applyPreset}
                  />
                </Col>
                <Col xs={12} md={3}>
                  <Flexbox direction="col" gap="1" justify="end" className="h-full">
                    <Button
                      color="primary"
                      block
                      onClick={() => load(startDate, endDate)}
                      disabled={loading || rangeInvalid}
                    >
                      {loading ? 'Loading…' : 'Apply'}
                    </Button>
                  </Flexbox>
                </Col>
              </Row>

              <Text xs className="text-text-secondary">
                {`Range capped at ${maxRangeDays} days: the request log group is kept for one month, so page hits older than that do not exist to query.`}
              </Text>

              {rangeInvalid && (
                <Alert color="warning">
                  {rangeDays === 0
                    ? 'End date must not precede start date.'
                    : `That is ${rangeDays} days; the cap is ${maxRangeDays}.`}
                </Alert>
              )}
              {error && <Alert color="danger">{error}</Alert>}
            </Flexbox>
          </CardBody>
        </Card>

        {loading && series.length === 0 && (
          <Flexbox direction="row" justify="center" className="my-5">
            <Spinner />
          </Flexbox>
        )}

        {series.map((gameSeries) => (
          <GameCard key={gameSeries.game} series={gameSeries} />
        ))}
      </Container>
    </MainLayout>
  );
};

export default RenderToRoot(AdminDailyGamesPage);

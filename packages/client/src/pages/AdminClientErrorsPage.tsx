import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { LineChart, StackedBarChart, colorForIndex, formatBucketLabel } from 'components/admin/AdminCharts';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Select from 'components/base/Select';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import MainLayout from 'layouts/MainLayout';

interface ErrorRow {
  signature: string;
  count: number;
  sample: string;
  kind?: string;
  url?: string;
  source?: string;
  stack?: string;
  componentStack?: string;
  userAgent?: string;
  version?: string;
  username?: string | null;
  thirdParty: boolean;
}

interface KindCount {
  kind: string;
  count: number;
}

interface TimePoint {
  t: number;
  errors: number;
}

interface AdminClientErrorsPageProps {
  defaultWindow: number;
}

const WINDOW_OPTIONS = [
  { value: '60', label: 'Last 1 hour' },
  { value: '180', label: 'Last 3 hours' },
  { value: '720', label: 'Last 12 hours' },
  { value: '1440', label: 'Last 24 hours' },
  { value: '4320', label: 'Last 3 days' },
  { value: '10080', label: 'Last 7 days' },
];

const FILTER_OPTIONS = [
  { value: 'app', label: 'Hide extension/third-party noise' },
  { value: 'all', label: 'All client errors' },
];

const DetailLine: React.FC<{ label: string; value?: string | null }> = ({ label, value }) =>
  value ? (
    <Text xs className="text-text-secondary">
      <span className="font-semibold">{label}:</span> {value}
    </Text>
  ) : null;

const ClientErrorDetail: React.FC<{ row: ErrorRow }> = ({ row }) => (
  <details className="border-b border-border py-1">
    <summary className="cursor-pointer">
      <Flexbox direction="row" gap="2" alignItems="baseline" className="w-full">
        <Text semibold className="inline-block min-w-[3rem] text-right">
          {row.count}
        </Text>
        {row.kind && (
          <Text xs className="font-mono text-text-secondary">
            {row.kind}
          </Text>
        )}
        <Text sm>{row.sample}</Text>
        {row.thirdParty && (
          <Text xs className="text-text-secondary">
            (likely extension)
          </Text>
        )}
      </Flexbox>
    </summary>
    <Flexbox direction="col" gap="1" className="pl-12 pt-1">
      <DetailLine label="URL" value={row.url} />
      <DetailLine label="Source" value={row.source} />
      <DetailLine label="User" value={row.username || 'anonymous'} />
      <DetailLine label="Version" value={row.version} />
      <DetailLine label="Browser" value={row.userAgent} />
      {row.stack && <pre className="overflow-x-auto rounded bg-bg-active/40 p-2 text-xs">{row.stack}</pre>}
      {row.componentStack && (
        <>
          <Text xs className="font-semibold text-text-secondary">
            Component stack
          </Text>
          <pre className="overflow-x-auto rounded bg-bg-active/40 p-2 text-xs">{row.componentStack}</pre>
        </>
      )}
    </Flexbox>
  </details>
);

const AdminClientErrorsPage: React.FC<AdminClientErrorsPageProps> = ({ defaultWindow }) => {
  const { callApi } = useContext(CSRFContext);
  const [windowMinutes, setWindowMinutes] = useState(String(defaultWindow));
  const [filter, setFilter] = useState('app');
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [byKind, setByKind] = useState<KindCount[]>([]);
  const [points, setPoints] = useState<TimePoint[]>([]);
  const [kindTimes, setKindTimes] = useState<number[]>([]);
  const [kindSeries, setKindSeries] = useState<Record<string, number[]>>({});
  const [notReady, setNotReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = { windowMinutes: Number(windowMinutes) };
      const [aggRes, tsRes] = await Promise.all([
        callApi('/admin/clienterrors/query', body),
        callApi('/admin/clienterrors/timeseries', body),
      ]);
      const agg = await aggRes.json();
      const ts = await tsRes.json();
      if (agg.success === 'true') {
        setRows(agg.rows);
        setByKind(agg.byKind || []);
        setNotReady(!!agg.notReady);
      } else {
        setError(agg.error || 'Query failed');
      }
      if (ts.success === 'true') {
        setPoints(ts.points || []);
        setKindTimes(ts.byKind?.times || []);
        setKindSeries(ts.byKind?.series || {});
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [callApi, windowMinutes]);

  useEffect(() => {
    runQuery();
  }, [runQuery]);

  const visibleRows = useMemo(() => (filter === 'app' ? rows.filter((r) => !r.thirdParty) : rows), [rows, filter]);

  const win = Number(windowMinutes);
  const totalErrors = visibleRows.reduce((sum, r) => sum + r.count, 0);
  const hiddenCount = rows.length - visibleRows.length;
  const chartLabels = points.map((p) => formatBucketLabel(p.t, win));
  const kindLabels = kindTimes.map((t) => formatBucketLabel(t, win));
  const kindDatasets = Object.keys(kindSeries)
    .sort()
    .map((kind, i) => ({ label: kind, data: kindSeries[kind], color: colorForIndex(i) }));

  return (
    <MainLayout>
      <DynamicFlash />
      <Container xl>
        <Card className="my-3">
          <CardHeader>
            <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
              <Text semibold xl>
                Client Errors
              </Text>
              <Flexbox direction="row" gap="2" alignItems="end">
                <Select label="Show" dense options={FILTER_OPTIONS} value={filter} setValue={setFilter} />
                <Select
                  label="Time frame"
                  dense
                  options={WINDOW_OPTIONS}
                  value={windowMinutes}
                  setValue={setWindowMinutes}
                />
              </Flexbox>
            </Flexbox>
          </CardHeader>
          <CardBody>
            {loading ? (
              <Flexbox direction="row" justify="center" className="w-full py-4">
                <Spinner />
              </Flexbox>
            ) : error ? (
              <Text className="text-text-red">{error}</Text>
            ) : notReady ? (
              <Text className="text-text-secondary">
                No client errors have been reported yet — the client error log group is created on the first report.
              </Text>
            ) : (
              <Flexbox direction="col" gap="4">
                <Flexbox direction="row" gap="2" wrap="wrap">
                  <div className="min-w-[280px] flex-1">
                    <Text sm semibold>
                      Client errors over time
                    </Text>
                    <LineChart
                      labels={chartLabels}
                      datasets={[{ label: 'Errors', data: points.map((p) => p.errors), color: '#D85F69' }]}
                    />
                  </div>
                  <div className="min-w-[280px] flex-1">
                    <Text sm semibold>
                      By kind over time
                    </Text>
                    <StackedBarChart labels={kindLabels} datasets={kindDatasets} />
                  </div>
                </Flexbox>
                <Text sm className="text-text-secondary">
                  {visibleRows.length} distinct errors, {totalErrors} occurrences
                  {hiddenCount > 0 && ` — ${hiddenCount} extension/third-party group(s) hidden`}
                  {byKind.length > 0 && ` — ${byKind.map((k) => `${k.kind}: ${k.count}`).join(', ')}`}
                  {' — click a row for the stack, URL, browser and user'}
                </Text>
                <Flexbox direction="col" gap="0">
                  {visibleRows.map((row, i) => (
                    <ClientErrorDetail key={i} row={row} />
                  ))}
                </Flexbox>
              </Flexbox>
            )}
          </CardBody>
        </Card>
      </Container>
    </MainLayout>
  );
};

export default RenderToRoot(AdminClientErrorsPage);

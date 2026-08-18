import React, { useCallback, useContext, useEffect, useState } from 'react';

import {
  LineChart,
  StackedBarChart,
  colorForIndex,
  formatBucketLabel,
  statusColor,
} from 'components/admin/AdminCharts';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Select from 'components/base/Select';
import Spinner from 'components/base/Spinner';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import MainLayout from 'layouts/MainLayout';

interface MetricOption {
  key: string;
  label: string;
  unit: string;
}

interface PerfRow {
  matchedPath: string;
  value: number;
  [column: string]: string | number;
}

interface TrafficPoint {
  t: number;
  hits: number;
  ingress: number;
  egress: number;
  avgLatency: number;
  p99Latency: number;
}

interface DistBucket {
  magnitude: number;
  hits: number;
  bytes: number;
}

interface AdminPerformancePageProps {
  defaultWindow: number;
  defaultMetric: string;
  metrics: MetricOption[];
}

const WINDOW_OPTIONS = [
  { value: '60', label: 'Last 1 hour' },
  { value: '180', label: 'Last 3 hours' },
  { value: '720', label: 'Last 12 hours' },
  { value: '1440', label: 'Last 24 hours' },
  { value: '4320', label: 'Last 3 days' },
  { value: '10080', label: 'Last 7 days' },
];

const LIMIT_OPTIONS = [
  { value: '25', label: 'Top 25' },
  { value: '50', label: 'Top 50' },
  { value: '100', label: 'Top 100' },
  { value: '200', label: 'Top 200' },
];

const TOP_PATH_OPTIONS = [
  { value: '5', label: 'Top 5 routes' },
  { value: '10', label: 'Top 10 routes' },
  { value: '25', label: 'Top 25 routes' },
  { value: '50', label: 'Top 50 routes' },
];

const EXTRA_HEADER: Record<string, string> = {
  hits: 'Hits',
  maxMs: 'Max ms',
  avgBytes: 'Avg size',
  maxBytes: 'Max size',
};

// Columns that hold a byte count and should render human-readable.
const BYTE_COLUMNS = new Set(['avgBytes', 'maxBytes']);

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1);
  const value = bytes / 1000 ** exp;
  return `${value >= 100 || exp === 0 ? Math.round(value) : value.toFixed(1)} ${units[exp]}`;
};

// A magnitude m from the server represents the byte range [10^m, 10^(m+1)).
const formatMagnitudeLabel = (magnitude: number): string =>
  `${formatBytes(10 ** magnitude)}–${formatBytes(10 ** (magnitude + 1))}`;

// Picks a single readable byte unit for a whole chart based on its largest value,
// so every series shares one axis scale.
const byteScaleFor = (maxValue: number): { divisor: number; suffix: string } => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (!Number.isFinite(maxValue) || maxValue <= 0) return { divisor: 1, suffix: 'B' };
  const exp = Math.min(Math.floor(Math.log10(maxValue) / 3), units.length - 1);
  return { divisor: 1000 ** exp, suffix: units[exp] };
};

const AdminPerformancePage: React.FC<AdminPerformancePageProps> = ({ defaultWindow, defaultMetric, metrics }) => {
  const { callApi } = useContext(CSRFContext);
  const [windowMinutes, setWindowMinutes] = useState(String(defaultWindow));
  const [metric, setMetric] = useState(defaultMetric);
  const [limit, setLimit] = useState('50');

  const [rows, setRows] = useState<PerfRow[]>([]);
  const [unit, setUnit] = useState('');
  const [extraColumns, setExtraColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [topPaths, setTopPaths] = useState('5');
  const [pathTimes, setPathTimes] = useState<number[]>([]);
  const [pathSeries, setPathSeries] = useState<Record<string, number[]>>({});
  const [pathOrder, setPathOrder] = useState<string[]>([]);
  const [pathChartLoading, setPathChartLoading] = useState(false);

  const [traffic, setTraffic] = useState<TrafficPoint[]>([]);
  const [statusTimes, setStatusTimes] = useState<number[]>([]);
  const [statusSeries, setStatusSeries] = useState<Record<string, number[]>>({});
  const [ingressDist, setIngressDist] = useState<DistBucket[]>([]);
  const [egressDist, setEgressDist] = useState<DistBucket[]>([]);
  const [chartsLoading, setChartsLoading] = useState(false);

  const runTable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await callApi('/admin/performance/query', {
        windowMinutes: Number(windowMinutes),
        metric,
        limit: Number(limit),
      });
      const json = await response.json();
      if (json.success === 'true') {
        setRows(json.rows);
        setUnit(json.unit);
        setExtraColumns(json.extraColumns || []);
      } else {
        setError(json.error || 'Query failed');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [callApi, windowMinutes, metric, limit]);

  const runCharts = useCallback(async () => {
    setChartsLoading(true);
    try {
      const response = await callApi('/admin/performance/timeseries', { windowMinutes: Number(windowMinutes) });
      const json = await response.json();
      if (json.success === 'true') {
        setTraffic(json.traffic || []);
        setStatusTimes(json.byStatus?.times || []);
        setStatusSeries(json.byStatus?.series || {});
        setIngressDist(json.ingressDist || []);
        setEgressDist(json.egressDist || []);
      }
    } catch {
      // charts are best-effort; the table query surfaces errors
    } finally {
      setChartsLoading(false);
    }
  }, [callApi, windowMinutes]);

  const runPathChart = useCallback(async () => {
    setPathChartLoading(true);
    try {
      const response = await callApi('/admin/performance/path-timeseries', {
        windowMinutes: Number(windowMinutes),
        metric,
        topPaths: Number(topPaths),
      });
      const json = await response.json();
      if (json.success === 'true') {
        setPathTimes(json.times || []);
        setPathSeries(json.series || {});
        setPathOrder(json.paths || []);
      }
    } catch {
      // charts are best-effort; the table query surfaces errors
    } finally {
      setPathChartLoading(false);
    }
  }, [callApi, windowMinutes, metric, topPaths]);

  useEffect(() => {
    runTable();
  }, [runTable]);

  useEffect(() => {
    runCharts();
  }, [runCharts]);

  useEffect(() => {
    runPathChart();
  }, [runPathChart]);

  const isByteUnit = unit.includes('bytes');
  const valueHeader = unit || 'Value';
  const headers = ['Route', valueHeader, ...extraColumns.map((c) => EXTRA_HEADER[c] ?? c)];
  const tableRows = rows.map((r) => {
    const row: { [key: string]: React.ReactNode } = {
      Route: <Link href={`/admin/pathanalysis?path=${encodeURIComponent(r.matchedPath)}`}>{r.matchedPath}</Link>,
      [valueHeader]: isByteUnit ? formatBytes(r.value) : Math.round(r.value).toLocaleString(),
    };
    for (const c of extraColumns) {
      const raw = Number(r[c]) || 0;
      row[EXTRA_HEADER[c] ?? c] = BYTE_COLUMNS.has(c) ? formatBytes(raw) : Math.round(raw).toLocaleString();
    }
    return row;
  });

  const win = Number(windowMinutes);

  const selectedMetric = metrics.find((m) => m.key === metric);
  const metricIsBytes = (selectedMetric?.unit || '').includes('bytes');
  const maxPathValue = Math.max(0, ...pathOrder.flatMap((p) => pathSeries[p] || []));
  const { divisor, suffix } = byteScaleFor(maxPathValue);
  const pathChartUnit = metricIsBytes ? (selectedMetric?.unit || '').replace('bytes', suffix) : selectedMetric?.unit;
  const pathLabels = pathTimes.map((t) => formatBucketLabel(t, win));
  const pathDatasets = pathOrder.map((p, i) => ({
    label: p,
    data: (pathSeries[p] || []).map((v) => (metricIsBytes ? v / divisor : v)),
    color: colorForIndex(i),
  }));

  const trafficLabels = traffic.map((p) => formatBucketLabel(p.t, win));
  const statusLabels = statusTimes.map((t) => formatBucketLabel(t, win));
  const statusDatasets = Object.keys(statusSeries)
    .sort()
    .map((status) => ({ label: status || '(none)', data: statusSeries[status], color: statusColor(status) }));

  // Align both payload-size distributions onto a shared magnitude axis so the ranges line up.
  const magnitudes = Array.from(new Set([...ingressDist, ...egressDist].map((b) => b.magnitude))).sort((a, b) => a - b);
  const distLabels = magnitudes.map(formatMagnitudeLabel);
  const ingressByMag = new Map(ingressDist.map((b) => [b.magnitude, b.hits]));
  const egressByMag = new Map(egressDist.map((b) => [b.magnitude, b.hits]));
  const ingressDistData = magnitudes.map((m) => ingressByMag.get(m) || 0);
  const egressDistData = magnitudes.map((m) => egressByMag.get(m) || 0);

  return (
    <MainLayout>
      <DynamicFlash />
      <Container xl>
        <Card className="my-3">
          <CardHeader>
            <Flexbox direction="col" gap="2" className="w-full">
              <Text semibold xl>
                Performance
              </Text>
              <Flexbox direction="row" gap="2" wrap="wrap" alignItems="end">
                <Select
                  label="Metric"
                  dense
                  options={metrics.map((m) => ({ value: m.key, label: m.label }))}
                  value={metric}
                  setValue={setMetric}
                />
                <Select
                  label="Time frame"
                  dense
                  options={WINDOW_OPTIONS}
                  value={windowMinutes}
                  setValue={setWindowMinutes}
                />
                <Select label="Rows" dense options={LIMIT_OPTIONS} value={limit} setValue={setLimit} />
                <Select label="Chart lines" dense options={TOP_PATH_OPTIONS} value={topPaths} setValue={setTopPaths} />
              </Flexbox>
            </Flexbox>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="4">
              {pathChartLoading ? (
                <Flexbox direction="row" justify="center" className="w-full py-4">
                  <Spinner />
                </Flexbox>
              ) : (
                <div>
                  <Text sm semibold>
                    {selectedMetric?.label || 'Selected metric'} over time{pathChartUnit ? ` (${pathChartUnit})` : ''}
                  </Text>
                  <LineChart labels={pathLabels} datasets={pathDatasets} height={320} />
                </div>
              )}

              {chartsLoading ? (
                <Flexbox direction="row" justify="center" className="w-full py-4">
                  <Spinner />
                </Flexbox>
              ) : (
                <Row>
                  <Col xs={12} md={6}>
                    <Text sm semibold>
                      Requests over time
                    </Text>
                    <LineChart
                      labels={trafficLabels}
                      datasets={[{ label: 'Requests', data: traffic.map((p) => p.hits), color: '#67A6D3' }]}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Text sm semibold>
                      Ingress / egress over time (MB)
                    </Text>
                    <LineChart
                      labels={trafficLabels}
                      datasets={[
                        { label: 'Ingress (MB)', data: traffic.map((p) => p.ingress / 1e6), color: '#67A6D3' },
                        { label: 'Egress (MB)', data: traffic.map((p) => p.egress / 1e6), color: '#6AB572' },
                      ]}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Text sm semibold>
                      Latency over time (ms)
                    </Text>
                    <LineChart
                      labels={trafficLabels}
                      datasets={[
                        { label: 'Avg (ms)', data: traffic.map((p) => p.avgLatency), color: '#6AB572' },
                        { label: 'p99 (ms)', data: traffic.map((p) => p.p99Latency), color: '#D85F69' },
                      ]}
                    />
                  </Col>
                  <Col xs={12}>
                    <Text sm semibold>
                      Requests by status code
                    </Text>
                    <StackedBarChart labels={statusLabels} datasets={statusDatasets} />
                  </Col>
                  <Col xs={12} md={6}>
                    <Text sm semibold>
                      Requests by request size
                    </Text>
                    <StackedBarChart
                      labels={distLabels}
                      datasets={[{ label: 'Requests', data: ingressDistData, color: '#67A6D3' }]}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Text sm semibold>
                      Requests by response size
                    </Text>
                    <StackedBarChart
                      labels={distLabels}
                      datasets={[{ label: 'Responses', data: egressDistData, color: '#6AB572' }]}
                    />
                  </Col>
                </Row>
              )}

              {loading ? (
                <Flexbox direction="row" justify="center" className="w-full py-4">
                  <Spinner />
                </Flexbox>
              ) : error ? (
                <Text className="text-text-red">{error}</Text>
              ) : (
                <Table headers={headers} rows={tableRows} wrapCells />
              )}
            </Flexbox>
          </CardBody>
        </Card>
      </Container>
    </MainLayout>
  );
};

export default RenderToRoot(AdminPerformancePage);

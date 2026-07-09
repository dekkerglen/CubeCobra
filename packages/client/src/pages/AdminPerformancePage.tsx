import React, { useCallback, useContext, useEffect, useState } from 'react';

import { LineChart, StackedBarChart, formatBucketLabel, statusColor } from 'components/admin/AdminCharts';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
import { Col, Flexbox, Row } from 'components/base/Layout';
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
  egress: number;
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

const EXTRA_HEADER: Record<string, string> = { hits: 'Hits', maxMs: 'Max ms' };

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

  const [traffic, setTraffic] = useState<TrafficPoint[]>([]);
  const [statusTimes, setStatusTimes] = useState<number[]>([]);
  const [statusSeries, setStatusSeries] = useState<Record<string, number[]>>({});
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
      }
    } catch {
      // charts are best-effort; the table query surfaces errors
    } finally {
      setChartsLoading(false);
    }
  }, [callApi, windowMinutes]);

  useEffect(() => {
    runTable();
  }, [runTable]);

  useEffect(() => {
    runCharts();
  }, [runCharts]);

  const valueHeader = unit || 'Value';
  const headers = ['Route', valueHeader, ...extraColumns.map((c) => EXTRA_HEADER[c] ?? c)];
  const tableRows = rows.map((r) => {
    const row: { [key: string]: React.ReactNode } = {
      Route: r.matchedPath,
      [valueHeader]: Math.round(r.value).toLocaleString(),
    };
    for (const c of extraColumns) {
      row[EXTRA_HEADER[c] ?? c] = Math.round(Number(r[c]) || 0).toLocaleString();
    }
    return row;
  });

  const win = Number(windowMinutes);
  const trafficLabels = traffic.map((p) => formatBucketLabel(p.t, win));
  const statusLabels = statusTimes.map((t) => formatBucketLabel(t, win));
  const statusDatasets = Object.keys(statusSeries)
    .sort()
    .map((status) => ({ label: status || '(none)', data: statusSeries[status], color: statusColor(status) }));

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
              </Flexbox>
            </Flexbox>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="4">
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
                      Egress over time (MB)
                    </Text>
                    <LineChart
                      labels={trafficLabels}
                      datasets={[{ label: 'Egress (MB)', data: traffic.map((p) => p.egress / 1e6), color: '#6AB572' }]}
                    />
                  </Col>
                  <Col xs={12}>
                    <Text sm semibold>
                      Requests by status code
                    </Text>
                    <StackedBarChart labels={statusLabels} datasets={statusDatasets} />
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

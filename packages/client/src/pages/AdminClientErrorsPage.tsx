import React, { useCallback, useContext, useEffect, useState } from 'react';

import { LineChart, StackedBarChart, colorForIndex, formatBucketLabel } from 'components/admin/AdminCharts';
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

interface ErrorRow {
  signature: string;
  count: number;
  sample: string;
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

const AdminClientErrorsPage: React.FC<AdminClientErrorsPageProps> = ({ defaultWindow }) => {
  const { callApi } = useContext(CSRFContext);
  const [windowMinutes, setWindowMinutes] = useState(String(defaultWindow));
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

  const win = Number(windowMinutes);
  const totalErrors = rows.reduce((sum, r) => sum + r.count, 0);
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
              <Select
                label="Time frame"
                dense
                options={WINDOW_OPTIONS}
                value={windowMinutes}
                setValue={setWindowMinutes}
              />
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
                <Row>
                  <Col xs={12} md={6}>
                    <Text sm semibold>
                      Client errors over time
                    </Text>
                    <LineChart
                      labels={chartLabels}
                      datasets={[{ label: 'Errors', data: points.map((p) => p.errors), color: '#D85F69' }]}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Text sm semibold>
                      By kind over time
                    </Text>
                    <StackedBarChart labels={kindLabels} datasets={kindDatasets} />
                  </Col>
                </Row>
                <Text sm className="text-text-secondary">
                  {rows.length} distinct errors, {totalErrors} total occurrences
                  {byKind.length > 0 && ` — ${byKind.map((k) => `${k.kind}: ${k.count}`).join(', ')}`}
                </Text>
                <Table
                  headers={['Count', 'Error']}
                  rows={rows.map((r) => ({
                    Count: r.count,
                    Error: <span title={r.signature}>{r.sample}</span>,
                  }))}
                  wrapCells
                />
              </Flexbox>
            )}
          </CardBody>
        </Card>
      </Container>
    </MainLayout>
  );
};

export default RenderToRoot(AdminClientErrorsPage);

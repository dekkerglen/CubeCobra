import React, { useCallback, useContext, useEffect, useState } from 'react';

import { LineChart, formatBucketLabel } from 'components/admin/AdminCharts';
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
  errorType?: string;
  handler?: string;
  location?: string;
  method?: string;
  path?: string;
  authenticated?: boolean;
  unhandledRejection?: boolean;
  stack?: string;
}

interface TimePoint {
  t: number;
  errors: number;
}

interface AdminErrorsPageProps {
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

const ErrorDetail: React.FC<{ row: ErrorRow }> = ({ row }) => {
  const contextParts: string[] = [];
  if (row.method && row.path) {
    contextParts.push(`${row.method} ${row.path}`);
  }
  if (typeof row.authenticated === 'boolean') {
    contextParts.push(row.authenticated ? 'authenticated' : 'anonymous');
  }
  if (row.unhandledRejection) {
    contextParts.push('unhandled rejection (no request context)');
  }

  return (
    <details className="border-b border-border py-1">
      <summary className="cursor-pointer">
        <Flexbox direction="row" gap="2" alignItems="baseline" className="w-full">
          <Text semibold className="inline-block min-w-[3rem] text-right">
            {row.count}
          </Text>
          {row.location && (
            <Text sm className="font-mono text-text-secondary">
              {row.handler ? `${row.handler} ` : ''}
              {row.location}
            </Text>
          )}
          <Text sm>{row.sample}</Text>
        </Flexbox>
      </summary>
      <Flexbox direction="col" gap="1" className="pl-12 pt-1">
        {contextParts.length > 0 && (
          <Text xs className="text-text-secondary">
            {contextParts.join(' · ')}
          </Text>
        )}
        {row.stack ? (
          <pre className="overflow-x-auto rounded bg-bg-active/40 p-2 text-xs">{row.stack}</pre>
        ) : (
          <Text xs className="text-text-secondary">
            No stack captured for this error (older log format).
          </Text>
        )}
      </Flexbox>
    </details>
  );
};

const AdminErrorsPage: React.FC<AdminErrorsPageProps> = ({ defaultWindow }) => {
  const { callApi } = useContext(CSRFContext);
  const [windowMinutes, setWindowMinutes] = useState(String(defaultWindow));
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [points, setPoints] = useState<TimePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = { windowMinutes: Number(windowMinutes) };
      const [aggRes, tsRes] = await Promise.all([
        callApi('/admin/errors/query', body),
        callApi('/admin/errors/timeseries', body),
      ]);
      const agg = await aggRes.json();
      const ts = await tsRes.json();
      if (agg.success === 'true') {
        setRows(agg.rows);
      } else {
        setError(agg.error || 'Query failed');
      }
      setPoints(ts.success === 'true' ? ts.points : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [callApi, windowMinutes]);

  useEffect(() => {
    runQuery();
  }, [runQuery]);

  const totalErrors = rows.reduce((sum, r) => sum + r.count, 0);
  const chartLabels = points.map((p) => formatBucketLabel(p.t, Number(windowMinutes)));

  return (
    <MainLayout>
      <DynamicFlash />
      <Container xl>
        <Card className="my-3">
          <CardHeader>
            <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
              <Text semibold xl>
                Backend Errors
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
            ) : (
              <Flexbox direction="col" gap="4">
                <LineChart
                  labels={chartLabels}
                  datasets={[{ label: 'Errors', data: points.map((p) => p.errors), color: '#D85F69' }]}
                />
                <Text sm className="text-text-secondary">
                  {rows.length} distinct errors, {totalErrors} total occurrences — click a row for the stack and request
                  context
                </Text>
                <Flexbox direction="col" gap="0">
                  {rows.map((row, i) => (
                    <ErrorDetail key={i} row={row} />
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

export default RenderToRoot(AdminErrorsPage);

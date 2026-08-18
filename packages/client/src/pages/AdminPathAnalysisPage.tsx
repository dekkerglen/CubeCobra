import React, { useCallback, useContext, useEffect, useState } from 'react';

import { LineChart, formatBucketLabel } from 'components/admin/AdminCharts';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Select from 'components/base/Select';
import Spinner from 'components/base/Spinner';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import MainLayout from 'layouts/MainLayout';

interface GroupingOption {
  key: string;
  label: string;
}

interface TrafficPoint {
  t: number;
  hits: number;
}

interface BreakdownRow {
  key: string;
  hits: number;
  avgMs: number;
  maxMs: number;
  egress: number;
}

interface AdminPathAnalysisPageProps {
  defaultWindow: number;
  initialPath: string;
  groupings: GroupingOption[];
}

const WINDOW_OPTIONS = [
  { value: '60', label: 'Last 1 hour' },
  { value: '180', label: 'Last 3 hours' },
  { value: '720', label: 'Last 12 hours' },
  { value: '1440', label: 'Last 24 hours' },
  { value: '4320', label: 'Last 3 days' },
  { value: '10080', label: 'Last 7 days' },
];

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1);
  const value = bytes / 1000 ** exp;
  return `${value >= 100 || exp === 0 ? Math.round(value) : value.toFixed(1)} ${units[exp]}`;
};

const AdminPathAnalysisPage: React.FC<AdminPathAnalysisPageProps> = ({ defaultWindow, initialPath, groupings }) => {
  const { callApi } = useContext(CSRFContext);
  const [windowMinutes, setWindowMinutes] = useState(String(defaultWindow));
  const [pathInput, setPathInput] = useState(initialPath);
  // The path actually being analyzed; only updates when the user submits, so typing
  // doesn't fire a query per keystroke.
  const [activePath, setActivePath] = useState(initialPath.trim());
  const [groupBy, setGroupBy] = useState(groupings[0]?.key || 'username');

  const [traffic, setTraffic] = useState<TrafficPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = () => {
    const next = pathInput.trim();
    setActivePath(next);
    // Keep the URL shareable/linkable for the path being analyzed.
    const query = next ? `?path=${encodeURIComponent(next)}` : '';
    window.history.replaceState(null, '', `/admin/pathanalysis${query}`);
  };

  const runChart = useCallback(async () => {
    if (!activePath) return;
    setChartLoading(true);
    try {
      const response = await callApi('/admin/pathanalysis/timeseries', {
        windowMinutes: Number(windowMinutes),
        path: activePath,
      });
      const json = await response.json();
      if (json.success === 'true') {
        setTraffic(json.traffic || []);
      }
    } catch {
      // best-effort; the breakdown query surfaces errors
    } finally {
      setChartLoading(false);
    }
  }, [callApi, windowMinutes, activePath]);

  const runBreakdown = useCallback(async () => {
    if (!activePath) return;
    setTableLoading(true);
    setError(null);
    try {
      const response = await callApi('/admin/pathanalysis/breakdown', {
        windowMinutes: Number(windowMinutes),
        path: activePath,
        groupBy,
      });
      const json = await response.json();
      if (json.success === 'true') {
        setRows(json.rows || []);
      } else {
        setError(json.error || 'Query failed');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTableLoading(false);
    }
  }, [callApi, windowMinutes, activePath, groupBy]);

  useEffect(() => {
    runChart();
  }, [runChart]);

  useEffect(() => {
    runBreakdown();
  }, [runBreakdown]);

  const win = Number(windowMinutes);
  const trafficLabels = traffic.map((p) => formatBucketLabel(p.t, win));

  const groupLabel = groupings.find((g) => g.key === groupBy)?.label || 'Group';
  const headers = [groupLabel, 'Hits', 'Avg ms', 'Max ms', 'Egress'];
  const tableRows = rows.map((r) => ({
    [groupLabel]: r.key,
    Hits: Math.round(r.hits).toLocaleString(),
    'Avg ms': Math.round(r.avgMs).toLocaleString(),
    'Max ms': Math.round(r.maxMs).toLocaleString(),
    Egress: formatBytes(r.egress),
  }));

  return (
    <MainLayout>
      <DynamicFlash />
      <Container xl>
        <Card className="my-3">
          <CardHeader>
            <Flexbox direction="col" gap="2" className="w-full">
              <Text semibold xl>
                Path Analysis
              </Text>
              <Flexbox direction="row" gap="2" wrap="wrap" alignItems="end">
                <div className="flex-grow min-w-64">
                  <Input
                    label="Route path"
                    placeholder="/cube/list/:id"
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                    onEnter={analyze}
                  />
                </div>
                <Select
                  label="Time frame"
                  dense
                  options={WINDOW_OPTIONS}
                  value={windowMinutes}
                  setValue={setWindowMinutes}
                />
                <Select
                  label="Group by"
                  dense
                  options={groupings.map((g) => ({ value: g.key, label: g.label }))}
                  value={groupBy}
                  setValue={setGroupBy}
                />
                <Button color="primary" onClick={analyze}>
                  Analyze
                </Button>
              </Flexbox>
            </Flexbox>
          </CardHeader>
          <CardBody>
            {!activePath ? (
              <Text className="text-text-secondary">
                Enter a route path (as it appears on the Performance page, e.g. /cube/list/:id) to see its traffic and
                who is requesting it.
              </Text>
            ) : (
              <Flexbox direction="col" gap="4">
                {chartLoading ? (
                  <Flexbox direction="row" justify="center" className="w-full py-4">
                    <Spinner />
                  </Flexbox>
                ) : (
                  <div>
                    <Text sm semibold>
                      Requests over time — {activePath}
                    </Text>
                    <LineChart
                      labels={trafficLabels}
                      datasets={[{ label: 'Requests', data: traffic.map((p) => p.hits), color: '#67A6D3' }]}
                      height={320}
                    />
                  </div>
                )}

                {tableLoading ? (
                  <Flexbox direction="row" justify="center" className="w-full py-4">
                    <Spinner />
                  </Flexbox>
                ) : error ? (
                  <Text className="text-text-red">{error}</Text>
                ) : (
                  <Table headers={headers} rows={tableRows} wrapCells />
                )}
              </Flexbox>
            )}
          </CardBody>
        </Card>
      </Container>
    </MainLayout>
  );
};

export default RenderToRoot(AdminPathAnalysisPage);

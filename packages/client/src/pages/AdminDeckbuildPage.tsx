import React, { useCallback, useContext, useEffect, useState } from 'react';

import { formatBucketLabel, LineChart } from 'components/admin/AdminCharts';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Select from 'components/base/Select';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import MainLayout from 'layouts/MainLayout';

interface Summary {
  invocations: number;
  errors: number;
  throttles: number;
  successRate: number | null;
  enqueued: number;
  processed: number;
  backlog: number;
  oldestAgeSeconds: number;
  dlqDepth: number;
  avgDurationMs: number;
  maxDurationMs: number;
}

interface AdminDeckbuildPageProps {
  defaultWindow: number;
  configured: boolean;
}

const WINDOW_OPTIONS = [
  { value: '60', label: 'Last 1 hour' },
  { value: '180', label: 'Last 3 hours' },
  { value: '720', label: 'Last 12 hours' },
  { value: '1440', label: 'Last 24 hours' },
  { value: '4320', label: 'Last 3 days' },
  { value: '10080', label: 'Last 7 days' },
];

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};

interface StatProps {
  label: string;
  value: string;
  emphasis?: 'good' | 'bad' | 'warn';
}

// Reuse the chart palette so stat colors match the graphs below.
const EMPHASIS_COLOR: Record<string, string> = { good: '#6AB572', warn: '#DBC467', bad: '#D85F69' };

const Stat: React.FC<StatProps> = ({ label, value, emphasis }) => (
  <Card className="p-2">
    <Flexbox direction="col" gap="1">
      <Text sm className="text-text-secondary">
        {label}
      </Text>
      <Text xl semibold>
        <span style={emphasis ? { color: EMPHASIS_COLOR[emphasis] } : undefined}>{value}</span>
      </Text>
    </Flexbox>
  </Card>
);

const AdminDeckbuildPage: React.FC<AdminDeckbuildPageProps> = ({ defaultWindow, configured }) => {
  const { callApi } = useContext(CSRFContext);
  const [windowMinutes, setWindowMinutes] = useState(String(defaultWindow));

  const [summary, setSummary] = useState<Summary | null>(null);
  const [times, setTimes] = useState<number[]>([]);
  const [series, setSeries] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(!configured);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await callApi('/admin/deckbuild/metrics', { windowMinutes: Number(windowMinutes) });
      const json = await response.json();
      if (json.success === 'true') {
        if (json.configured === false) {
          setNotConfigured(true);
        } else {
          setNotConfigured(false);
          setSummary(json.summary);
          setTimes(json.times || []);
          setSeries(json.series || {});
        }
      } else {
        setError(json.error || 'Query failed');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [callApi, windowMinutes]);

  useEffect(() => {
    run();
  }, [run]);

  const win = Number(windowMinutes);
  const labels = times.map((t) => formatBucketLabel(t, win));
  const s = (key: string): number[] => series[key] || [];

  // A growing backlog or a non-empty DLQ are the headline "falling behind" signals.
  const backlogEmphasis = summary && summary.backlog > 0 ? 'warn' : undefined;
  const dlqEmphasis = summary && summary.dlqDepth > 0 ? 'bad' : undefined;
  const successEmphasis =
    summary?.successRate === null || summary?.successRate === undefined
      ? undefined
      : summary.successRate >= 0.99
        ? 'good'
        : summary.successRate >= 0.9
          ? 'warn'
          : 'bad';

  return (
    <MainLayout>
      <DynamicFlash />
      <Container xl>
        <Card className="my-3">
          <CardHeader>
            <Flexbox direction="col" gap="2" className="w-full">
              <Text semibold xl>
                Bot Deckbuild
              </Text>
              <Flexbox direction="row" gap="2" wrap="wrap" alignItems="end">
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
            {notConfigured ? (
              <Text className="text-text-secondary">
                The bot-deckbuild pipeline is not configured in this environment (no queue/lambda), so there are no
                metrics to show.
              </Text>
            ) : loading && !summary ? (
              <Flexbox direction="row" justify="center" className="w-full py-4">
                <Spinner />
              </Flexbox>
            ) : error ? (
              <Text className="text-text-red">{error}</Text>
            ) : (
              <Flexbox direction="col" gap="4">
                {summary && (
                  <Row>
                    <Col xs={6} md={3}>
                      <Stat
                        label="Success rate"
                        value={
                          summary.successRate === null || summary.successRate === undefined
                            ? '—'
                            : `${(summary.successRate * 100).toFixed(1)}%`
                        }
                        emphasis={successEmphasis}
                      />
                    </Col>
                    <Col xs={6} md={3}>
                      <Stat
                        label="Current backlog"
                        value={summary.backlog.toLocaleString()}
                        emphasis={backlogEmphasis}
                      />
                    </Col>
                    <Col xs={6} md={3}>
                      <Stat
                        label="Oldest message"
                        value={formatDuration(summary.oldestAgeSeconds)}
                        emphasis={backlogEmphasis}
                      />
                    </Col>
                    <Col xs={6} md={3}>
                      <Stat
                        label="Dead-letter queue"
                        value={summary.dlqDepth.toLocaleString()}
                        emphasis={dlqEmphasis}
                      />
                    </Col>
                    <Col xs={6} md={3}>
                      <Stat label="Invocations" value={summary.invocations.toLocaleString()} />
                    </Col>
                    <Col xs={6} md={3}>
                      <Stat
                        label="Errors"
                        value={summary.errors.toLocaleString()}
                        emphasis={summary.errors > 0 ? 'bad' : undefined}
                      />
                    </Col>
                    <Col xs={6} md={3}>
                      <Stat
                        label="Throttles"
                        value={summary.throttles.toLocaleString()}
                        emphasis={summary.throttles > 0 ? 'warn' : undefined}
                      />
                    </Col>
                    <Col xs={6} md={3}>
                      <Stat label="Avg duration" value={`${(summary.avgDurationMs / 1000).toFixed(1)}s`} />
                    </Col>
                  </Row>
                )}

                <Row>
                  <Col xs={12} md={6}>
                    <Text sm semibold>
                      Queue depth over time
                    </Text>
                    <LineChart
                      labels={labels}
                      datasets={[{ label: 'Messages waiting', data: s('queueDepth'), color: '#DBC467' }]}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Text sm semibold>
                      Age of oldest message (min)
                    </Text>
                    <LineChart
                      labels={labels}
                      datasets={[{ label: 'Oldest (min)', data: s('oldestAge').map((v) => v / 60), color: '#DBC467' }]}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Text sm semibold>
                      Invocations vs errors
                    </Text>
                    <LineChart
                      labels={labels}
                      datasets={[
                        { label: 'Invocations', data: s('invocations'), color: '#67A6D3' },
                        { label: 'Errors', data: s('errors'), color: '#D85F69' },
                      ]}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Text sm semibold>
                      Lambda duration (s)
                    </Text>
                    <LineChart
                      labels={labels}
                      datasets={[
                        { label: 'Avg (s)', data: s('durationAvg').map((v) => v / 1000), color: '#6AB572' },
                        { label: 'Max (s)', data: s('durationMax').map((v) => v / 1000), color: '#8C7A91' },
                      ]}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Text sm semibold>
                      Enqueued vs processed
                    </Text>
                    <LineChart
                      labels={labels}
                      datasets={[
                        { label: 'Enqueued', data: s('sent'), color: '#67A6D3' },
                        { label: 'Processed', data: s('deleted'), color: '#6AB572' },
                      ]}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Text sm semibold>
                      Dead-letter queue depth
                    </Text>
                    <LineChart
                      labels={labels}
                      datasets={[{ label: 'DLQ messages', data: s('dlqDepth'), color: '#D85F69' }]}
                    />
                  </Col>
                </Row>
              </Flexbox>
            )}
          </CardBody>
        </Card>
      </Container>
    </MainLayout>
  );
};

export default RenderToRoot(AdminDeckbuildPage);

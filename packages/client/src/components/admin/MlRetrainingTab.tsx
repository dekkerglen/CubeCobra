import React, { useCallback, useContext, useEffect, useState } from 'react';

import { CheckCircleFillIcon, ChevronDownIcon, ChevronRightIcon, XCircleFillIcon } from '@primer/octicons-react';
import { RetrainMode, RetrainTask, RetrainTaskStatus } from '@utils/datatypes/RetrainTask';
import type {
  ArchetypeName,
  ArchetypeNameSource,
  ArchetypeNamingOutcome,
  ArchetypeTopic,
} from '@utils/drafting/topicArchetypes';
import type { ArchetypeReport, GateMetrics, GateReport, ModelPointer, RunMetrics } from '@utils/ml/modelBundle';
import classNames from 'classnames';

import { LineChart } from 'components/admin/AdminCharts';
import AdminTabData from 'components/admin/AdminTabData';
import Badge from 'components/base/Badge';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Spinner from 'components/base/Spinner';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import ConfirmActionModal from 'components/modals/ConfirmActionModal';
import { CSRFContext } from 'contexts/CSRFContext';
import useAlerts, { Alerts } from 'hooks/UseAlerts';

// The server never sends the Step Functions task token.
type Run = Omit<RetrainTask, 'taskToken'>;

interface RetrainingState {
  runs: Run[];
  pointer: ModelPointer | null;
  servedVersion: string;
  publishedVersions: string[];
  configured: boolean;
}

interface RunDetails {
  metrics: RunMetrics | null;
  gate: GateReport | null;
  archetypes: ArchetypeReport | null;
  // From the run's bundle: archetypes/topics.json (without cardTopics), names.json and naming.json.
  topics: ArchetypeTopic[] | null;
  names: Record<string, ArchetypeName> | null;
  naming: ArchetypeNamingOutcome | null;
}

interface PendingAction {
  title: string;
  message: string;
  buttonText: string;
  run: () => void;
}

const BASE_URL = '/admin/mlretraining';
const POLL_INTERVAL_MS = 30 * 1000;

const GATE_METRICS: { key: keyof GateMetrics; label: string }[] = [
  { key: 'cubeRecall', label: 'Cube Recall' },
  { key: 'deckAccuracy', label: 'Deck Accuracy' },
  { key: 'pickTop1', label: 'Pick Top-1' },
  { key: 'pickTop3', label: 'Pick Top-3' },
];

const STATUS_BADGES: Record<RetrainTaskStatus, { color: string; text: string }> = {
  [RetrainTaskStatus.COMPLETED]: { color: 'bg-green-100 text-green-700', text: 'Completed' },
  [RetrainTaskStatus.IN_PROGRESS]: { color: 'bg-blue-100 text-blue-700', text: 'In Progress' },
  [RetrainTaskStatus.AWAITING_APPROVAL]: { color: 'bg-yellow-100 text-yellow-700', text: 'Awaiting Approval' },
  [RetrainTaskStatus.FAILED]: { color: 'bg-red-100 text-red-700', text: 'Failed' },
  [RetrainTaskStatus.REJECTED]: { color: 'bg-bg-active text-text-secondary', text: 'Rejected' },
};

const formatDate = (timestamp?: number): string => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (startedAt?: number, completedAt?: number): string => {
  if (!startedAt || !completedAt) return 'N/A';
  const duration = completedAt - startedAt;
  const hours = Math.floor(duration / 3600000);
  const minutes = Math.floor((duration % 3600000) / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
};

const formatMetric = (value?: number | null): string => (typeof value === 'number' ? value.toFixed(4) : '-');

const formatValue = (value: unknown): string =>
  typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);

const isActive = (run: Run): boolean =>
  run.status === RetrainTaskStatus.IN_PROGRESS || run.status === RetrainTaskStatus.AWAITING_APPROVAL;

const StatusBadge: React.FC<{ status: RetrainTaskStatus }> = ({ status }) => {
  const badge = STATUS_BADGES[status] ?? { color: 'bg-bg-active text-text-secondary', text: status };
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${badge.color}`}>{badge.text}</span>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Flexbox direction="col" gap="1">
    <Text sm className="text-text-secondary">
      {label}
    </Text>
    <Text semibold md>
      {children}
    </Text>
  </Flexbox>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Flexbox direction="col" gap="2" className="pt-3 border-t border-border">
    <Text semibold lg>
      {title}
    </Text>
    {children}
  </Flexbox>
);

const PassFail: React.FC<{ passed: boolean }> = ({ passed }) =>
  passed ? (
    <span className="inline-flex items-center gap-1 text-green-600">
      <CheckCircleFillIcon size={14} /> Passed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-600">
      <XCircleFillIcon size={14} /> Failed
    </span>
  );

const splitRow = (counts: { cubes: number; decks: number; picks: number }) => ({
  Cubes: counts.cubes.toLocaleString(),
  Decks: counts.decks.toLocaleString(),
  Picks: counts.picks.toLocaleString(),
});

const DataSection: React.FC<{ metrics: RunMetrics }> = ({ metrics }) => {
  const { data } = metrics;
  const excluded = Object.entries(data.excluded || {});
  return (
    <Section title="Data">
      <Flexbox direction="row" gap="4" wrap="wrap">
        <Field label="Window">
          {data.windowYears} years from {new Date(data.windowStart).toLocaleDateString()}
        </Field>
        <Field label="Exported">{formatDate(data.exportedAt)}</Field>
        <Field label="Cards">{data.numCards.toLocaleString()}</Field>
        <Field label="Test Split">{data.testPercent}%</Field>
      </Flexbox>
      <Table
        headers={['Split', 'Cubes', 'Decks', 'Picks']}
        rows={[
          { Split: 'Train', ...splitRow(data.train) },
          { Split: 'Test', ...splitRow(data.test) },
        ]}
      />
      {excluded.length > 0 && (
        <Text sm className="text-text-secondary">
          Excluded: {excluded.map(([reason, count]) => `${reason} ${count.toLocaleString()}`).join(', ')}
        </Text>
      )}
    </Section>
  );
};

const TrainingSection: React.FC<{ metrics: RunMetrics }> = ({ metrics }) => {
  const lossKeys = [...new Set(metrics.epochs.flatMap((epoch) => Object.keys(epoch.logs)))]
    .filter((key) => key.endsWith('loss'))
    .sort((a, b) => (a === 'loss' ? -1 : b === 'loss' ? 1 : a.localeCompare(b)));

  return (
    <Section title="Training">
      <Flexbox direction="row" gap="4" wrap="wrap">
        <Field label="Status">{metrics.status.charAt(0).toUpperCase() + metrics.status.slice(1)}</Field>
        <Field label="Epochs">{metrics.epochs.length}</Field>
        <Field label="Started">{formatDate(metrics.startedAt)}</Field>
        <Field label="Updated">{formatDate(metrics.updatedAt)}</Field>
        {metrics.resumedFromEpoch !== undefined && <Field label="Resumed From">{metrics.resumedFromEpoch}</Field>}
      </Flexbox>
      {Object.keys(metrics.params).length > 0 && (
        <Table
          headers={['Parameter', 'Value']}
          rows={Object.entries(metrics.params).map(([key, value]) => ({ Parameter: key, Value: formatValue(value) }))}
          wrapCells
        />
      )}
      {metrics.epochs.length > 0 && lossKeys.length > 0 && (
        <LineChart
          labels={metrics.epochs.map((epoch) => String(epoch.epoch))}
          datasets={lossKeys.map((key) => ({
            label: key,
            data: metrics.epochs.map((epoch) => epoch.logs[key] ?? Number.NaN),
          }))}
        />
      )}
      {metrics.validations.length > 0 && (
        <Table
          headers={['Epoch', ...GATE_METRICS.map(({ label }) => `${label} (Train / Test)`)]}
          rows={metrics.validations.map((validation) => ({
            Epoch: validation.epoch,
            ...Object.fromEntries(
              GATE_METRICS.map(({ key, label }) => [
                `${label} (Train / Test)`,
                `${formatMetric(validation.train[key])} / ${formatMetric(validation.test[key])}`,
              ]),
            ),
          }))}
        />
      )}
    </Section>
  );
};

// eval.json when the run wrote one; the summary on the run record otherwise.
const GateSection: React.FC<{ gate: GateReport | null; run: Run }> = ({ gate, run }) => {
  const summary = gate ?? run.gate;
  if (!summary) return null;
  const liveVersion = gate?.liveVersion ?? run.gate?.liveVersion ?? null;

  return (
    <Section title="Gate">
      <Flexbox direction="row" gap="4" wrap="wrap">
        <Field label="Result">
          <PassFail passed={summary.passed} />
        </Field>
        <Field label="Live Version">{liveVersion ?? 'None'}</Field>
        {gate && (
          <>
            <Field label="Parity">
              <span className="inline-flex items-center gap-2">
                <PassFail passed={gate.parity.passed} />
                <span className="font-normal text-text-secondary">{gate.parity.maxAbsDiff.toExponential(2)}</span>
              </span>
            </Field>
            <Field label="Tolerance">{gate.tolerance}</Field>
            <Field label="Evaluated">
              {[
                `${gate.counts.cubes.toLocaleString()} cubes`,
                `${gate.counts.decks.toLocaleString()} decks`,
                `${gate.counts.picks.toLocaleString()} picks`,
              ].join(', ')}
            </Field>
          </>
        )}
      </Flexbox>
      <Table
        headers={gate ? ['Metric', 'Candidate', 'Live', 'Result'] : ['Metric', 'Candidate', 'Live']}
        rows={GATE_METRICS.map(({ key, label }) => {
          const candidate = summary.candidate[key];
          const live = summary.live?.[key];
          return {
            Metric: label,
            Candidate: formatMetric(candidate),
            Live: formatMetric(live),
            // Same rule as the gate itself (packages/jobs/src/ml/evaluateModel.ts).
            Result: gate && <PassFail passed={live === undefined || candidate >= live - gate.tolerance} />,
          };
        })}
      />
      {summary.reasons.length > 0 && (
        <ul className="list-disc ml-6">
          {summary.reasons.map((reason) => (
            <li key={reason}>
              <Text sm>{reason}</Text>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};

const NAME_SOURCES: Record<ArchetypeNameSource, string> = { auto: 'Auto', llm: 'LLM', edited: 'Edited' };

// The run's archetype topics and their names, how they were named, and how many test decks would
// change archetype against the live model's.
const ArchetypeSection: React.FC<{ details: RunDetails; run: Run }> = ({ details, run }) => {
  const { archetypes: report, topics, names } = details;
  const naming = report?.naming ?? details.naming;
  const shift = report?.shiftShare ?? run.gate?.archetypeShift;
  if (!topics && !naming && shift === undefined) return null;

  return (
    <Section title="Archetypes">
      <Flexbox direction="row" gap="4" wrap="wrap">
        {(report || topics) && <Field label="Topics">{report?.topicCount ?? topics?.length}</Field>}
        {shift !== undefined && <Field label="Decks Changing Archetype">{(shift * 100).toFixed(1)}%</Field>}
        {report && <Field label="Sample">{report.sampleSize.toLocaleString()}</Field>}
        {naming && (
          <>
            <Field label="Naming">{naming.mode === 'llm' ? 'LLM' : 'Auto (fallback)'}</Field>
            <Field label="Named">{`${naming.named} / ${naming.total}`}</Field>
            <Field label="Carried Over">{naming.carriedOver}</Field>
            <Field label="Critic Revised">{naming.criticRevised}</Field>
            {naming.modelId && <Field label="Model">{naming.modelId}</Field>}
          </>
        )}
      </Flexbox>
      {naming?.reason && (
        <Text sm className="text-text-secondary">
          {naming.reason}
        </Text>
      )}
      {topics && topics.length > 0 && (
        <Table
          headers={['Name', 'Source', 'Top Tags', 'Decks']}
          wrapCells
          rows={[...topics]
            .sort((a, b) => b.deckShare - a.deckShare)
            .map((topic) => {
              const name = names?.[topic.id];
              return {
                Name: name?.name ?? topic.id,
                Source: name ? NAME_SOURCES[name.source] : '-',
                'Top Tags': topic.topTags.join(', '),
                Decks: `${(topic.deckShare * 100).toFixed(1)}%`,
              };
            })}
        />
      )}
    </Section>
  );
};

const RunDetailsPanel: React.FC<{
  run: Run;
  configured: boolean;
  busy: boolean;
  onAction: (path: string, success: string) => void;
  onConfirm: (action: PendingAction) => void;
}> = ({ run, configured, busy, onAction, onConfirm }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [details, setDetails] = useState<RunDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await csrfFetch(`${BASE_URL}/run/${encodeURIComponent(run.id)}`, { method: 'GET' });
        const data = await response.json();
        if (cancelled) return;
        if (data.success) {
          setDetails({
            metrics: data.metrics,
            gate: data.gate,
            archetypes: data.archetypes,
            topics: data.topics,
            names: data.names,
            naming: data.naming,
          });
        } else {
          setError(data.error || 'Request failed');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Request failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [csrfFetch, run.id, run.dateLastUpdated]);

  const runPath = `/run/${encodeURIComponent(run.id)}`;

  return (
    <Flexbox direction="col" gap="3">
      {run.status === RetrainTaskStatus.AWAITING_APPROVAL && (
        <Flexbox direction="row" gap="2">
          <Button
            color="primary"
            disabled={!configured || busy}
            onClick={() =>
              onConfirm({
                title: 'Approve',
                message: `Approve ${run.version}?`,
                buttonText: 'Approve',
                run: () => onAction(`${runPath}/approve`, `Approved ${run.id}`),
              })
            }
          >
            Approve
          </Button>
          <Button
            color="danger"
            outline
            disabled={!configured || busy}
            onClick={() =>
              onConfirm({
                title: 'Reject',
                message: `Reject ${run.version}?`,
                buttonText: 'Reject',
                run: () => onAction(`${runPath}/reject`, `Rejected ${run.id}`),
              })
            }
          >
            Reject
          </Button>
        </Flexbox>
      )}

      {run.errorMessage && (
        <div className="p-2 bg-red-50 border border-red-200 rounded">
          <Text xs className="font-mono text-red-700">
            {run.errorMessage}
          </Text>
        </div>
      )}

      <Flexbox direction="row" gap="4" wrap="wrap">
        <Field label="Steps">{[...run.completedSteps, ...(isActive(run) ? [run.step] : [])].join(' > ') || '-'}</Field>
        {run.decidedBy && (
          <Field label="Decided By">
            <Link href={`/user/view/${encodeURIComponent(run.decidedBy)}`}>{run.decidedBy}</Link>
          </Field>
        )}
        {run.promotedTo.length > 0 && <Field label="Promoted To">{run.promotedTo.join(', ')}</Field>}
        {run.previousVersion && <Field label="Previous Version">{run.previousVersion}</Field>}
      </Flexbox>

      {error && (
        <Text sm className="text-red-600">
          {error}
        </Text>
      )}
      {!details && !error && <Spinner sm />}
      {details && (
        <>
          {details.metrics && <DataSection metrics={details.metrics} />}
          {details.metrics && <TrainingSection metrics={details.metrics} />}
          <GateSection gate={details.gate} run={run} />
          <ArchetypeSection details={details} run={run} />
        </>
      )}
    </Flexbox>
  );
};

const RUN_HEADERS = ['Run', 'Mode', 'Status', 'Step', 'Started', 'Duration', 'Version'];

const MlRetraining: React.FC<RetrainingState> = (props) => {
  const { csrfFetch, callApi } = useContext(CSRFContext);
  const { alerts, addAlert, dismissAlerts } = useAlerts();
  const [state, setState] = useState<RetrainingState>({
    runs: props.runs,
    pointer: props.pointer,
    servedVersion: props.servedVersion,
    publishedVersions: props.publishedVersions,
    configured: props.configured,
  });
  // Runs awaiting approval start expanded.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(props.runs.filter((run) => run.status === RetrainTaskStatus.AWAITING_APPROVAL).map((run) => run.id)),
  );
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  // The pipeline writes the run's record a few seconds after the execution starts; until it shows
  // up, keep Start disabled and keep polling.
  const [startRequested, setStartRequested] = useState(false);
  // Clock sample used to show elapsed time for still-running runs, re-read on every poll rather
  // than during render so the table stays a pure function of state.
  const [now, setNow] = useState(() => Date.now());

  const { runs, pointer, servedVersion, publishedVersions, configured } = state;
  const activeRun = runs.find(isActive);

  const refresh = useCallback(async () => {
    setNow(Date.now());
    try {
      const response = await csrfFetch(`${BASE_URL}/state`, { method: 'GET' });
      const data = await response.json();
      if (data.success) {
        setState({
          runs: data.runs,
          pointer: data.pointer,
          servedVersion: data.servedVersion,
          publishedVersions: data.publishedVersions,
          configured: data.configured,
        });
      }
    } catch {
      // Keep what's on screen; the next poll or action tries again.
    }
  }, [csrfFetch]);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    if (activeRun) setStartRequested(false);
  }, [activeRun]);

  const polling = !!activeRun || startRequested;
  useEffect(() => {
    if (!polling) return undefined;
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [polling, refresh]);

  const post = useCallback(
    async (path: string, success: string, body: Record<string, unknown> = {}) => {
      dismissAlerts();
      setBusy(true);
      try {
        const response = await callApi(`${BASE_URL}${path}`, body);
        const data = await response.json();
        if (data.success) {
          addAlert('success', success);
          if (path === '/start') setStartRequested(true);
          await refresh();
        } else {
          addAlert('danger', data.error || 'Request failed');
        }
      } catch (err) {
        addAlert('danger', err instanceof Error ? err.message : 'Request failed');
      } finally {
        setBusy(false);
      }
    },
    [callApi, addAlert, dismissAlerts, refresh],
  );

  const confirm = useCallback(() => {
    const action = pending;
    setPending(null);
    action?.run();
  }, [pending]);

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Published versions come newest first, so anything listed before the served one is newer.
  const servedIndex = publishedVersions.indexOf(servedVersion);

  return (
    <>
      <Card>
        <CardHeader>
          <Flexbox direction="row" alignItems="center" justify="between" gap="2" wrap="wrap">
            <Text semibold xl>
              ML Retraining
            </Text>
            <Button
              color="primary"
              disabled={!configured || busy || !!activeRun || startRequested}
              onClick={() =>
                setPending({
                  title: 'Start Retraining',
                  message: 'Start a new training run?',
                  buttonText: 'Start',
                  run: () => post('/start', 'Retraining started'),
                })
              }
            >
              {busy ? <Spinner sm /> : 'Start Retraining'}
            </Button>
          </Flexbox>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="4">
            <Alerts alerts={alerts} />
            {!configured && (
              <Text className="text-text-secondary">
                The retraining pipeline is not configured in this environment.
              </Text>
            )}

            <Flexbox direction="row" gap="4" wrap="wrap">
              <Field label="Served Version">{servedVersion}</Field>
              {pointer && <Field label="Promoted">{formatDate(pointer.promotedAt)}</Field>}
              {pointer?.previousVersion && <Field label="Previous Version">{pointer.previousVersion}</Field>}
            </Flexbox>

            <Table
              headers={['Version', 'Status', 'Action']}
              rows={publishedVersions.map((version, index) => {
                const served = version === servedVersion;
                const newer = servedIndex === -1 || index < servedIndex;
                const verb = newer ? 'Promote' : 'Roll Back';
                return {
                  Version: <span className="font-mono">{version}</span>,
                  Status: served ? <Badge color="success">Served</Badge> : '',
                  Action: served ? (
                    ''
                  ) : (
                    <Button
                      color="primary"
                      outline
                      disabled={!configured || busy}
                      onClick={() =>
                        setPending({
                          title: verb,
                          message: newer ? `Promote ${version}?` : `Roll back to ${version}?`,
                          buttonText: verb,
                          run: () => post('/promote', `Promotion of ${version} started`, { version }),
                        })
                      }
                    >
                      {verb}
                    </Button>
                  ),
                };
              })}
            />

            {runs.length === 0 ? (
              <Text className="text-center py-8 text-text-secondary">No retraining runs found.</Text>
            ) : (
              <div className="max-w-full overflow-x-auto">
                <table className="w-full border border-border">
                  <thead className="bg-bg-active/80">
                    <tr>
                      {RUN_HEADERS.map((header) => (
                        <th key={header} className="p-2 text-left">
                          <Text semibold md>
                            {header}
                          </Text>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run, index) => {
                      const open = expanded.has(run.id);
                      const rowColor = index % 2 === 0 ? 'bg-bg-accent/80' : 'bg-bg-active/80';
                      const endedAt = run.completedAt ?? (isActive(run) ? now : undefined);
                      return (
                        <React.Fragment key={run.id}>
                          <tr
                            className={classNames('cursor-pointer border-t border-border', rowColor)}
                            onClick={() => toggle(run.id)}
                          >
                            <td className="p-2 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1">
                                {open ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
                                <Text sm className="font-mono">
                                  {run.id}
                                </Text>
                              </span>
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              <Text sm>{run.mode === RetrainMode.PROMOTE ? 'Promote' : 'Train'}</Text>
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              <StatusBadge status={run.status} />
                            </td>
                            <td className="p-2">
                              <Text sm>{run.step}</Text>
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              <Text sm>{formatDate(run.timestamp)}</Text>
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              <Text sm>{formatDuration(run.timestamp, endedAt)}</Text>
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              <Text sm className="font-mono">
                                {run.version}
                              </Text>
                            </td>
                          </tr>
                          {open && (
                            <tr className={rowColor}>
                              <td colSpan={RUN_HEADERS.length} className="p-3 border-t border-border">
                                <RunDetailsPanel
                                  run={run}
                                  configured={configured}
                                  busy={busy}
                                  onAction={post}
                                  onConfirm={setPending}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Flexbox>
        </CardBody>
      </Card>
      <ConfirmActionModal
        isOpen={pending !== null}
        setOpen={(open) => {
          if (!open) setPending(null);
        }}
        title={pending?.title ?? ''}
        message={pending?.message ?? ''}
        buttonText={pending?.buttonText ?? ''}
        onClick={confirm}
      />
    </>
  );
};

const MlRetrainingTab: React.FC = () => (
  <AdminTabData<RetrainingState> url={`${BASE_URL}/state`}>{(state) => <MlRetraining {...state} />}</AdminTabData>
);

export default MlRetrainingTab;

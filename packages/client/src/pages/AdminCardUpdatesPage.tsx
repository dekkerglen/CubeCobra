import React, { useCallback, useContext, useState } from 'react';

import { CheckCircleFillIcon, ChevronDownIcon, ChevronUpIcon, XCircleFillIcon } from '@primer/octicons-react';
import { CardMetadataTask } from '@utils/datatypes/CardMetadataTask';
import { CardUpdateTask } from '@utils/datatypes/CardUpdateTask';
import { ExportTask } from '@utils/datatypes/ExportTask';
import { MigrationTask } from '@utils/datatypes/MigrationTask';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import { TabbedView } from 'components/base/Tabs';
import Text from 'components/base/Text';
import ConfirmActionModal from 'components/modals/ConfirmActionModal';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import useQueryParam from 'hooks/useQueryParam';
import useAlerts, { Alerts } from 'hooks/UseAlerts';
import MainLayout from 'layouts/MainLayout';

interface AdminCardUpdatesPageProps {
  cardUpdates: CardUpdateTask[];
  cardMetadataTasks: CardMetadataTask[];
  exportTasks: ExportTask[];
  migrationTasks: MigrationTask[];
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

const getStatusBadge = (status: string): { color: string; text: string } => {
  switch (status) {
    case 'COMPLETED':
      return { color: 'bg-green-100 text-green-700', text: 'Completed' };
    case 'IN_PROGRESS':
      return { color: 'bg-blue-100 text-blue-700', text: 'In Progress' };
    case 'FAILED':
      return { color: 'bg-red-100 text-red-700', text: 'Failed' };
    case 'PENDING':
      return { color: 'bg-bg-active text-text-secondary', text: 'Pending' };
    default:
      return { color: 'bg-bg-active text-text-secondary', text: status };
  }
};

const ErrorDetails: React.FC<{ errorMessage: string }> = ({ errorMessage }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-red-600 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
      >
        {isExpanded ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
        <Text sm semibold>
          Update failed
        </Text>
      </button>
      {isExpanded && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
          <Text xs className="font-mono text-red-700">
            {errorMessage}
          </Text>
        </div>
      )}
    </div>
  );
};

const StepProgress: React.FC<{
  completedSteps: string[];
  currentStep: string;
  status: string;
  stepTimestamps?: Record<string, number>;
}> = ({ completedSteps, currentStep, status, stepTimestamps = {} }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const allSteps = [...completedSteps];

  // Add current step if not already in completed steps
  if (currentStep && !completedSteps.includes(currentStep)) {
    allSteps.push(currentStep);
  }

  if (allSteps.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-text-secondary hover:text-text focus:outline-none focus:ring-2 focus:ring-button-primary focus:ring-offset-2 rounded mb-2"
      >
        {isExpanded ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
        <Text sm semibold>
          Processing Steps ({status === 'COMPLETED' ? allSteps.length : completedSteps.length} of {allSteps.length})
        </Text>
      </button>
      {isExpanded && (
        <div className="space-y-2 ml-4">
          {allSteps.map((step, index) => {
            const isCompleted = completedSteps.includes(step) || status === 'COMPLETED';
            const isCurrent = step === currentStep && !completedSteps.includes(step) && status !== 'COMPLETED';
            const isFailed = status === 'FAILED' && isCurrent;
            const timestamp = stepTimestamps[step];

            return (
              <Flexbox key={index} direction="row" alignItems="center" gap="2" justify="between">
                <Flexbox direction="row" alignItems="center" gap="2" className="flex-1">
                  {isCompleted && <CheckCircleFillIcon size={16} className="text-green-600 flex-shrink-0" />}
                  {isCurrent && !isFailed && <Spinner sm className="flex-shrink-0" />}
                  {isFailed && <XCircleFillIcon size={16} className="text-red-600 flex-shrink-0" />}
                  <Text sm className={isCompleted ? 'text-text' : isFailed ? 'text-red-600' : 'text-text-secondary'}>
                    {step}
                  </Text>
                </Flexbox>
                {timestamp && (
                  <Text sm className="text-text-secondary whitespace-nowrap">
                    {new Date(timestamp).toLocaleTimeString()}
                  </Text>
                )}
              </Flexbox>
            );
          })}
        </div>
      )}
    </div>
  );
};

const RunJobButton: React.FC<{
  jobType: string;
  label: string;
  addAlert: (color: string, message: string) => void;
  dismissAlerts: () => void;
}> = ({ jobType, label, addAlert, dismissAlerts }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = useCallback(async () => {
    setConfirmOpen(false);
    dismissAlerts();
    setLoading(true);

    try {
      const response = await csrfFetch('/admin/triggerjob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType }),
      });

      const data = await response.json();

      if (data.success) {
        addAlert('success', `Job started. Task ID: ${data.taskId}`);
      } else {
        addAlert('danger', data.error || 'Failed to start job');
      }
    } catch (err) {
      addAlert('danger', err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [csrfFetch, jobType, addAlert, dismissAlerts]);

  return (
    <>
      <Button color="primary" onClick={() => setConfirmOpen(true)} disabled={loading}>
        {loading ? <Spinner sm /> : `Run ${label}`}
      </Button>
      <ConfirmActionModal
        isOpen={confirmOpen}
        setOpen={setConfirmOpen}
        title={`Run ${label} Job`}
        message={`Are you sure you want to manually trigger the ${label} job? This will start an ECS Fargate task.`}
        buttonText={`Run ${label}`}
        onClick={handleConfirm}
      />
    </>
  );
};

const AdminCardUpdatesPage: React.FC<AdminCardUpdatesPageProps> = ({
  cardUpdates,
  cardMetadataTasks,
  exportTasks,
  migrationTasks,
}) => {
  const [activeTab, setActiveTab] = useQueryParam('tab', '0');

  return (
    <MainLayout>
      <Card className="m-2">
        <CardHeader>
          <Text semibold xl>
            Card Updates, Metadata, Exports & Migrations - Admin View
          </Text>
        </CardHeader>
        <TabbedView
          activeTab={parseInt(activeTab || '0', 10)}
          tabs={[
            {
              label: 'Card Updates',
              onClick: () => setActiveTab('0'),
              content: <CardUpdatesTab updates={cardUpdates} />,
            },
            {
              label: 'Card Metadata',
              onClick: () => setActiveTab('1'),
              content: <CardMetadataTab tasks={cardMetadataTasks} />,
            },
            {
              label: 'Export Tasks',
              onClick: () => setActiveTab('2'),
              content: <ExportTasksTab tasks={exportTasks} />,
            },
            {
              label: 'Migrations',
              onClick: () => setActiveTab('3'),
              content: <MigrationTasksTab tasks={migrationTasks} />,
            },
          ]}
        />
      </Card>
    </MainLayout>
  );
};

const CardUpdatesTab: React.FC<{ updates: CardUpdateTask[] }> = ({ updates }) => {
  const { alerts, addAlert, dismissAlerts } = useAlerts();

  return (
  <CardBody>
    <Flexbox direction="col" gap="4">
      <Alerts alerts={alerts} />
      <Flexbox direction="row" alignItems="center" justify="between">
        <Text md className="text-text-secondary">
          History of card database updates from Scryfall. Updates are checked regularly and applied automatically when
          new card data is available.
        </Text>
        <RunJobButton jobType="card-update" label="Card Update" addAlert={addAlert} dismissAlerts={dismissAlerts} />
      </Flexbox>

      {updates.length === 0 ? (
        <Text className="text-center py-8 text-text-secondary">No card updates found.</Text>
      ) : (
        <div className="space-y-4">
          {updates.map((update) => {
            const statusBadge = getStatusBadge(update.status);
            return (
              <Card key={update.id} className="border border-border">
                <CardBody>
                  <Flexbox direction="row" alignItems="center" gap="2" className="mb-4">
                    <Text semibold lg>
                      Update on {formatDate(update.completedAt || update.timestamp)}
                    </Text>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${statusBadge.color}`}>
                      {statusBadge.text}
                    </span>
                  </Flexbox>

                  <Flexbox direction="row" gap="4" className="mb-3">
                    <Flexbox direction="col" gap="1" className="flex-1">
                      <Text sm className="text-text-secondary">
                        Scryfall Update Date
                      </Text>
                      <Text semibold md>
                        {new Date(update.scryfallUpdatedAt).toLocaleDateString()}
                      </Text>
                    </Flexbox>

                    <Flexbox direction="col" gap="1" className="flex-1">
                      <Text sm className="text-text-secondary">
                        File Size
                      </Text>
                      <Text semibold md>
                        {formatFileSize(update.scryfallFileSize)}
                      </Text>
                    </Flexbox>

                    {update.status === 'IN_PROGRESS' && (
                      <Flexbox direction="col" gap="1" className="flex-1">
                        <Text sm className="text-text-secondary">
                          Current Step
                        </Text>
                        <Text semibold md>
                          {update.step}
                        </Text>
                      </Flexbox>
                    )}

                    {update.status === 'COMPLETED' && (
                      <Flexbox direction="col" gap="1" className="flex-1">
                        <Text sm className="text-text-secondary">
                          Duration
                        </Text>
                        <Text semibold md>
                          {formatDuration(update.startedAt, update.completedAt)}
                        </Text>
                      </Flexbox>
                    )}
                  </Flexbox>

                  {update.errorMessage && <ErrorDetails errorMessage={update.errorMessage} />}

                  <StepProgress
                    completedSteps={update.completedSteps || []}
                    currentStep={update.step}
                    status={update.status}
                    stepTimestamps={update.stepTimestamps}
                  />

                  {update.status === 'COMPLETED' && (
                    <>
                      <Flexbox direction="row" gap="4" className="pt-3 border-t border-border">
                        <Flexbox direction="col" gap="1" className="flex-1">
                          <Text sm className="text-text-secondary">
                            Total Cards
                          </Text>
                          <Text semibold md>
                            {update.totalCards.toLocaleString()}
                          </Text>
                        </Flexbox>
                        <Flexbox direction="col" gap="1" className="flex-1">
                          <Text sm className="text-text-secondary">
                            Cards Added
                          </Text>
                          <Text semibold md>
                            +{update.cardsAdded.toLocaleString()}
                          </Text>
                        </Flexbox>
                      </Flexbox>

                      <div className="mt-3 pt-3 border-t border-border">
                        <Text xs className="text-text-secondary font-mono">
                          Checksum: {update.checksum.substring(0, 16)}...
                        </Text>
                      </div>
                    </>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </Flexbox>
  </CardBody>
  );
};

const CardMetadataTab: React.FC<{ tasks: CardMetadataTask[] }> = ({ tasks }) => {
  const { alerts, addAlert, dismissAlerts } = useAlerts();

  return (
  <CardBody>
    <Flexbox direction="col" gap="4">
      <Alerts alerts={alerts} />
      <Flexbox direction="row" alignItems="center" justify="between">
        <Text md className="text-text-secondary">
          History of card metadata and correlation updates. This job runs weekly and calculates card statistics,
          correlations, synergies, and combo data. It processes all cube and draft data to generate recommendations and
          insights.
        </Text>
        <RunJobButton jobType="card-metadata" label="Card Metadata" addAlert={addAlert} dismissAlerts={dismissAlerts} />
      </Flexbox>

      {tasks.length === 0 ? (
        <Text className="text-center py-8 text-text-secondary">No card metadata tasks found.</Text>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const statusBadge = getStatusBadge(task.status);
            return (
              <Card key={task.id} className="border border-border">
                <CardBody>
                  <Flexbox direction="row" alignItems="center" gap="2" className="mb-4">
                    <Text semibold lg>
                      Metadata Update on {formatDate(task.completedAt || task.timestamp)}
                    </Text>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${statusBadge.color}`}>
                      {statusBadge.text}
                    </span>
                  </Flexbox>

                  <Flexbox direction="row" gap="4" className="mb-3">
                    {task.status === 'IN_PROGRESS' && (
                      <Flexbox direction="col" gap="1" className="flex-1">
                        <Text sm className="text-text-secondary">
                          Current Step
                        </Text>
                        <Text semibold md>
                          {task.step}
                        </Text>
                      </Flexbox>
                    )}

                    {task.status === 'COMPLETED' && (
                      <>
                        <Flexbox direction="col" gap="1" className="flex-1">
                          <Text sm className="text-text-secondary">
                            Duration
                          </Text>
                          <Text semibold md>
                            {formatDuration(task.startedAt, task.completedAt)}
                          </Text>
                        </Flexbox>
                        <Flexbox direction="col" gap="1" className="flex-1">
                          <Text sm className="text-text-secondary">
                            Completed At
                          </Text>
                          <Text semibold md>
                            {formatDate(task.completedAt || task.timestamp)}
                          </Text>
                        </Flexbox>
                      </>
                    )}
                  </Flexbox>

                  {task.errorMessage && <ErrorDetails errorMessage={task.errorMessage} />}

                  <StepProgress
                    completedSteps={task.completedSteps || []}
                    currentStep={task.step}
                    status={task.status}
                    stepTimestamps={task.stepTimestamps}
                  />
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </Flexbox>
  </CardBody>
  );
};

const ExportTasksTab: React.FC<{ tasks: ExportTask[] }> = ({ tasks }) => {
  const { alerts, addAlert, dismissAlerts } = useAlerts();

  return (
  <CardBody>
    <Flexbox direction="col" gap="4">
      <Alerts alerts={alerts} />
      <Flexbox direction="row" alignItems="center" justify="between">
        <Text md className="text-text-secondary">
          History of data export tasks. Exports are scheduled to run every 3 months and generate comprehensive data
          exports for backup and analysis purposes.
        </Text>
        <RunJobButton jobType="export" label="Export" addAlert={addAlert} dismissAlerts={dismissAlerts} />
      </Flexbox>

      {tasks.length === 0 ? (
        <Text className="text-center py-8 text-text-secondary">No export tasks found.</Text>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const statusBadge = getStatusBadge(task.status);
            return (
              <Card key={task.id} className="border border-border">
                <CardBody>
                  <Flexbox direction="row" alignItems="center" gap="2" className="mb-4">
                    <Text semibold lg>
                      Export on {formatDate(task.completedAt || task.timestamp)}
                    </Text>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${statusBadge.color}`}>
                      {statusBadge.text}
                    </span>
                  </Flexbox>

                  <Flexbox direction="row" gap="4" className="mb-3">
                    <Flexbox direction="col" gap="1" className="flex-1">
                      <Text sm className="text-text-secondary">
                        Export Type
                      </Text>
                      <Text semibold md>
                        {task.exportType}
                      </Text>
                    </Flexbox>

                    {task.fileSize > 0 && (
                      <Flexbox direction="col" gap="1" className="flex-1">
                        <Text sm className="text-text-secondary">
                          File Size
                        </Text>
                        <Text semibold md>
                          {formatFileSize(task.fileSize)}
                        </Text>
                      </Flexbox>
                    )}

                    {task.status === 'IN_PROGRESS' && (
                      <Flexbox direction="col" gap="1" className="flex-1">
                        <Text sm className="text-text-secondary">
                          Current Step
                        </Text>
                        <Text semibold md>
                          {task.step}
                        </Text>
                      </Flexbox>
                    )}

                    {task.status === 'COMPLETED' && (
                      <Flexbox direction="col" gap="1" className="flex-1">
                        <Text sm className="text-text-secondary">
                          Duration
                        </Text>
                        <Text semibold md>
                          {formatDuration(task.startedAt, task.completedAt)}
                        </Text>
                      </Flexbox>
                    )}
                  </Flexbox>

                  {task.errorMessage && <ErrorDetails errorMessage={task.errorMessage} />}

                  <StepProgress
                    completedSteps={task.completedSteps || []}
                    currentStep={task.step}
                    status={task.status}
                    stepTimestamps={task.stepTimestamps}
                  />

                  {task.status === 'COMPLETED' && task.fileSize > 0 && (
                    <Flexbox direction="row" gap="4" className="pt-3 border-t border-border">
                      <Flexbox direction="col" gap="1" className="flex-1">
                        <Text sm className="text-text-secondary">
                          Export Size
                        </Text>
                        <Text semibold md>
                          {formatFileSize(task.fileSize)}
                        </Text>
                      </Flexbox>
                    </Flexbox>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </Flexbox>
  </CardBody>
  );
};

const MigrationTasksTab: React.FC<{ tasks: MigrationTask[] }> = ({ tasks }) => {
  const { alerts, addAlert, dismissAlerts } = useAlerts();

  return (
  <CardBody>
    <Flexbox direction="col" gap="4">
      <Alerts alerts={alerts} />
      <Flexbox direction="row" alignItems="center" justify="between">
        <Text md className="text-text-secondary">
          History of Scryfall card migration tasks. Migrations occur when cards are deleted or merged on Scryfall, and
          these tasks apply those changes to all cubes.
        </Text>
        <RunJobButton jobType="migration" label="Migration" addAlert={addAlert} dismissAlerts={dismissAlerts} />
      </Flexbox>

      {tasks.length === 0 ? (
        <Text className="text-center py-8 text-text-secondary">No migration tasks found.</Text>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const statusBadge = getStatusBadge(task.status);
            return (
              <Card key={task.id} className="border border-border">
                <CardBody>
                  <Flexbox direction="row" alignItems="center" gap="2" className="mb-4">
                    <Text semibold lg>
                      Migration on {formatDate(task.completedAt || task.timestamp)}
                    </Text>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${statusBadge.color}`}>
                      {statusBadge.text}
                    </span>
                  </Flexbox>

                  <Flexbox direction="row" gap="4" className="mb-3">
                    {task.lastMigrationDate && (
                      <Flexbox direction="col" gap="1" className="flex-1">
                        <Text sm className="text-text-secondary">
                          Last Migration Date
                        </Text>
                        <Text semibold md>
                          {new Date(task.lastMigrationDate).toLocaleDateString()}
                        </Text>
                      </Flexbox>
                    )}

                    {task.status === 'IN_PROGRESS' && (
                      <Flexbox direction="col" gap="1" className="flex-1">
                        <Text sm className="text-text-secondary">
                          Current Step
                        </Text>
                        <Text semibold md>
                          {task.step}
                        </Text>
                      </Flexbox>
                    )}

                    {task.status === 'COMPLETED' && (
                      <Flexbox direction="col" gap="1" className="flex-1">
                        <Text sm className="text-text-secondary">
                          Duration
                        </Text>
                        <Text semibold md>
                          {formatDuration(task.startedAt, task.completedAt)}
                        </Text>
                      </Flexbox>
                    )}
                  </Flexbox>

                  {task.errorMessage && <ErrorDetails errorMessage={task.errorMessage} />}

                  <StepProgress
                    completedSteps={task.completedSteps || []}
                    currentStep={task.step}
                    status={task.status}
                    stepTimestamps={task.stepTimestamps}
                  />

                  {task.status === 'COMPLETED' && (
                    <Flexbox direction="row" gap="4" className="pt-3 border-t border-border">
                      <Flexbox direction="col" gap="1" className="flex-1">
                        <Text sm className="text-text-secondary">
                          Migrations Processed
                        </Text>
                        <Text semibold md>
                          {task.migrationsProcessed.toLocaleString()}
                        </Text>
                      </Flexbox>
                      <Flexbox direction="col" gap="1" className="flex-1">
                        <Text sm className="text-text-secondary">
                          Cubes Affected
                        </Text>
                        <Text semibold md>
                          {task.cubesAffected.toLocaleString()}
                        </Text>
                      </Flexbox>
                      <Flexbox direction="col" gap="1" className="flex-1">
                        <Text sm className="text-text-secondary">
                          Cards Deleted
                        </Text>
                        <Text semibold md>
                          {task.cardsDeleted.toLocaleString()}
                        </Text>
                      </Flexbox>
                      <Flexbox direction="col" gap="1" className="flex-1">
                        <Text sm className="text-text-secondary">
                          Cards Merged
                        </Text>
                        <Text semibold md>
                          {task.cardsMerged.toLocaleString()}
                        </Text>
                      </Flexbox>
                    </Flexbox>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </Flexbox>
  </CardBody>
  );
};

export default RenderToRoot(AdminCardUpdatesPage);

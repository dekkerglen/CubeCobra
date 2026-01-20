import React, { useState } from 'react';

import { ChevronDownIcon, ChevronUpIcon } from '@primer/octicons-react';
import { CardUpdateTask } from '@utils/datatypes/CardUpdateTask';
import { ExportTask } from '@utils/datatypes/ExportTask';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import { TabbedView } from 'components/base/Tabs';
import Text from 'components/base/Text';
import RenderToRoot from 'components/RenderToRoot';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';

interface CardUpdatesPageProps {
  cardUpdates: CardUpdateTask[];
  exportTasks: ExportTask[];
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
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

const getStatusBadge = (status: string): { color: string; text: string } => {
  switch (status) {
    case 'COMPLETED':
      return { color: 'bg-green-100 text-green-800', text: 'Completed' };
    case 'IN_PROGRESS':
      return { color: 'bg-blue-100 text-blue-800', text: 'In Progress' };
    case 'FAILED':
      return { color: 'bg-red-100 text-red-800', text: 'Failed' };
    case 'PENDING':
      return { color: 'bg-gray-100 text-gray-800', text: 'Pending' };
    default:
      return { color: 'bg-gray-100 text-gray-800', text: status };
  }
};

const ErrorDetails: React.FC<{ errorMessage: string }> = ({ errorMessage }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-red-600 hover:text-red-700 focus:outline-none"
      >
        {isExpanded ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
        <Text sm semibold>
          Update failed
        </Text>
      </button>
      {isExpanded && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
          <Text xs className="font-mono text-red-800">
            {errorMessage}
          </Text>
        </div>
      )}
    </div>
  );
};

const CardUpdatesPage: React.FC<CardUpdatesPageProps> = ({ cardUpdates, exportTasks }) => {
  const [activeTab, setActiveTab] = useQueryParam('tab', '0');

  return (
    <MainLayout>
      <Card>
        <CardHeader>
          <Text semibold xl>
            Card Updates & Exports
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
              label: 'Export Tasks',
              onClick: () => setActiveTab('1'),
              content: <ExportTasksTab tasks={exportTasks} />,
            },
          ]}
        />
      </Card>
    </MainLayout>
  );
};

const CardUpdatesTab: React.FC<{ updates: CardUpdateTask[] }> = ({ updates }) => (
  <CardBody>
    <Text md className="mb-4 text-text-secondary">
      History of card database updates from Scryfall. Updates are checked regularly and applied automatically when new
      card data is available.
    </Text>

    {updates.length === 0 ? (
      <Text className="text-center py-8 text-text-secondary">No card updates found.</Text>
    ) : (
      <div className="space-y-4">
        {updates.map((update) => {
          const statusBadge = getStatusBadge(update.status);
          return (
            <Card key={update.id} className="border border-border">
              <CardBody>
                <Flexbox direction="row" justify="between" alignItems="start" className="mb-3">
                  <Flexbox direction="col" gap="1" className="flex-1">
                    <Flexbox direction="row" alignItems="center" gap="2">
                      <Text semibold lg>
                        Update on {formatDate(update.completedAt || update.timestamp)}
                      </Text>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${statusBadge.color}`}>
                        {statusBadge.text}
                      </span>
                    </Flexbox>
                    {update.status === 'IN_PROGRESS' && (
                      <Text sm className="text-text-secondary">
                        Step: {update.step}
                      </Text>
                    )}
                    {update.status === 'COMPLETED' && (
                      <Text sm className="text-text-secondary">
                        Completed in {formatDuration(update.startedAt, update.completedAt)}
                      </Text>
                    )}
                    {update.errorMessage && <ErrorDetails errorMessage={update.errorMessage} />}
                  </Flexbox>
                  <Flexbox direction="col" gap="1" alignItems="end" className="ml-4">
                    <Text sm className="text-text-secondary whitespace-nowrap">
                      Scryfall: {new Date(update.scryfallUpdatedAt).toLocaleDateString()}
                    </Text>
                    <Text sm className="text-text-secondary whitespace-nowrap">
                      File Size: {formatFileSize(update.scryfallFileSize)}
                    </Text>
                  </Flexbox>
                </Flexbox>

                {update.status === 'COMPLETED' && (
                  <>
                    <Flexbox direction="row" gap="4" className="pt-3 border-t border-border">
                      <div className="flex-1">
                        <Text sm className="text-text-secondary mb-1">
                          Total Cards
                        </Text>
                        <Text semibold xl>
                          {update.totalCards.toLocaleString()}
                        </Text>
                      </div>
                      <div className="flex-1">
                        <Text sm className="text-text-secondary mb-1">
                          Cards Added
                        </Text>
                        <Text semibold xl className="text-green-600">
                          +{update.cardsAdded.toLocaleString()}
                        </Text>
                      </div>
                      <div className="flex-1">
                        <Text sm className="text-text-secondary mb-1">
                          Cards Removed
                        </Text>
                        <Text semibold xl className="text-red-600">
                          -{update.cardsRemoved.toLocaleString()}
                        </Text>
                      </div>
                      <div className="flex-1">
                        <Text sm className="text-text-secondary mb-1">
                          Net Change
                        </Text>
                        <Text
                          semibold
                          xl
                          className={update.cardsAdded - update.cardsRemoved >= 0 ? 'text-green-600' : 'text-red-600'}
                        >
                          {update.cardsAdded - update.cardsRemoved >= 0 ? '+' : ''}
                          {(update.cardsAdded - update.cardsRemoved).toLocaleString()}
                        </Text>
                      </div>
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
  </CardBody>
);

const ExportTasksTab: React.FC<{ tasks: ExportTask[] }> = ({ tasks }) => (
  <CardBody>
    <Text md className="mb-4 text-text-secondary">
      History of data export tasks. Exports are scheduled to run every 3 months and generate comprehensive data exports
      for backup and analysis purposes.
    </Text>

    {tasks.length === 0 ? (
      <Text className="text-center py-8 text-text-secondary">No export tasks found.</Text>
    ) : (
      <div className="space-y-4">
        {tasks.map((task) => {
          const statusBadge = getStatusBadge(task.status);
          return (
            <Card key={task.id} className="border border-border">
              <CardBody>
                <Flexbox direction="row" justify="between" alignItems="start" className="mb-3">
                  <Flexbox direction="col" gap="1" className="flex-1">
                    <Flexbox direction="row" alignItems="center" gap="2">
                      <Text semibold lg>
                        Export on {formatDate(task.completedAt || task.timestamp)}
                      </Text>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${statusBadge.color}`}>
                        {statusBadge.text}
                      </span>
                    </Flexbox>
                    {task.status === 'IN_PROGRESS' && (
                      <Text sm className="text-text-secondary">
                        Step: {task.step}
                      </Text>
                    )}
                    {task.status === 'COMPLETED' && (
                      <Text sm className="text-text-secondary">
                        Completed in {formatDuration(task.startedAt, task.completedAt)}
                      </Text>
                    )}
                    {task.errorMessage && <ErrorDetails errorMessage={task.errorMessage} />}
                  </Flexbox>
                  <Flexbox direction="col" gap="1" alignItems="end" className="ml-4">
                    <Text sm className="text-text-secondary whitespace-nowrap">
                      Type: {task.exportType}
                    </Text>
                    {task.fileSize > 0 && (
                      <Text sm className="text-text-secondary whitespace-nowrap">
                        File Size: {formatFileSize(task.fileSize)}
                      </Text>
                    )}
                  </Flexbox>
                </Flexbox>

                {task.status === 'COMPLETED' && (
                  <Flexbox direction="row" gap="4" className="pt-3 border-t border-border">
                    <div className="flex-1">
                      <Text sm className="text-text-secondary mb-1">
                        Total Records
                      </Text>
                      <Text semibold xl>
                        {task.totalRecords.toLocaleString()}
                      </Text>
                    </div>
                    <div className="flex-1">
                      <Text sm className="text-text-secondary mb-1">
                        Export Size
                      </Text>
                      <Text semibold xl>
                        {formatFileSize(task.fileSize)}
                      </Text>
                    </div>
                  </Flexbox>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    )}
  </CardBody>
);

export default RenderToRoot(CardUpdatesPage);

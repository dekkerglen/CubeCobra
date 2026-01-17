import React from 'react';

import { CardUpdateTask } from '@utils/datatypes/CardUpdateTask';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface CardUpdatesPageProps {
  updates: CardUpdateTask[];
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

const CardUpdatesPage: React.FC<CardUpdatesPageProps> = ({ updates }) => (
  <MainLayout>
    <Card>
      <CardHeader>
        <Text semibold xl>
          Card Updates
        </Text>
      </CardHeader>
      <CardBody>
        <Text md className="mb-4 text-text-secondary">
          History of card database updates from Scryfall. Updates are checked every 5 minutes and applied automatically
          when new card data is available.
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
                      <div>
                        <Flexbox direction="row" alignItems="center" gap="2" className="mb-1">
                          <Text semibold lg>
                            Update on {formatDate(update.completedAt || update.timestamp)}
                          </Text>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${statusBadge.color}`}>
                            {statusBadge.text}
                          </span>
                        </Flexbox>
                        <Text sm className="text-text-secondary">
                          {update.status === 'IN_PROGRESS'
                            ? `Step: ${update.step}`
                            : `Completed in ${formatDuration(update.startedAt, update.completedAt)}`}
                        </Text>
                        {update.errorMessage && (
                          <Text sm className="text-red-600 mt-1">
                            Error: {update.errorMessage}
                          </Text>
                        )}
                      </div>
                      <div className="text-right">
                        <Text sm className="text-text-secondary">
                          Scryfall: {new Date(update.scryfallUpdatedAt).toLocaleDateString()}
                        </Text>
                        <Text sm className="text-text-secondary">
                          File Size: {formatFileSize(update.scryfallFileSize)}
                        </Text>
                      </div>
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
                              className={
                                update.cardsAdded - update.cardsRemoved >= 0 ? 'text-green-600' : 'text-red-600'
                              }
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
    </Card>
  </MainLayout>
);

export default RenderToRoot(CardUpdatesPage);

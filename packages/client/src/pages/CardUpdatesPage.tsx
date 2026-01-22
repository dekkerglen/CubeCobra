import React from 'react';

import { CardUpdateTask } from '@utils/datatypes/CardUpdateTask';
import { ExportTask } from '@utils/datatypes/ExportTask';
import { MigrationTask } from '@utils/datatypes/MigrationTask';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface CardUpdatesPageProps {
  lastCardUpdate?: CardUpdateTask;
  lastExportTask?: ExportTask;
  lastMigrationTask?: MigrationTask;
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const CardUpdatesPage: React.FC<CardUpdatesPageProps> = ({ lastCardUpdate, lastExportTask, lastMigrationTask }) => (
  <MainLayout>
    <Container sm>
      <Flexbox direction="col" gap="3" className="my-4">
        <Text semibold xxl className="text-center mb-2">
          Card Database Status
        </Text>
        <Text md className="text-text-secondary text-center mb-4">
          Last successful updates from our automated maintenance tasks
        </Text>

        {/* Card Database Update */}
        <Card>
          <CardHeader>
            <Text semibold lg>
              Card Database Update
            </Text>
          </CardHeader>
          <CardBody>
            {lastCardUpdate ? (
              <Flexbox direction="col" gap="3">
                <Text md className="text-text-secondary">
                  The card database is regularly updated with the latest card data from Scryfall. This ensures all card
                  information, images, and pricing data are current.
                </Text>
                <Flexbox direction="row" gap="4" className="pt-3 border-t border-border">
                  <Flexbox direction="col" gap="2" className="flex-1">
                    <Text sm className="text-text-secondary">
                      Last Update
                    </Text>
                    <Text semibold md>
                      {formatDate(lastCardUpdate.completedAt || lastCardUpdate.timestamp)}
                    </Text>
                  </Flexbox>
                  <Flexbox direction="col" gap="2" className="flex-1">
                    <Text sm className="text-text-secondary">
                      Scryfall Date
                    </Text>
                    <Text semibold md>
                      {formatDate(new Date(lastCardUpdate.scryfallUpdatedAt).valueOf())}
                    </Text>
                  </Flexbox>
                </Flexbox>
                <Flexbox direction="row" gap="4" className="pt-3 border-t border-border">
                  <Flexbox direction="col" gap="2" className="flex-1">
                    <Text sm className="text-text-secondary">
                      Cards Added
                    </Text>
                    <Text semibold md className="text-green-600">
                      +{lastCardUpdate.cardsAdded.toLocaleString()}
                    </Text>
                  </Flexbox>
                  <Flexbox direction="col" gap="2" className="flex-1">
                    <Text sm className="text-text-secondary">
                      Cards Removed
                    </Text>
                    <Text semibold md className="text-red-600">
                      -{lastCardUpdate.cardsRemoved.toLocaleString()}
                    </Text>
                  </Flexbox>
                  <Flexbox direction="col" gap="2" className="flex-1">
                    <Text sm className="text-text-secondary">
                      Total Cards
                    </Text>
                    <Text semibold md>
                      {lastCardUpdate.totalCards.toLocaleString()}
                    </Text>
                  </Flexbox>
                </Flexbox>
              </Flexbox>
            ) : (
              <Text className="text-text-secondary">No completed card updates found.</Text>
            )}
          </CardBody>
        </Card>

        {/* Export Task */}
        <Card>
          <CardHeader>
            <Text semibold lg>
              Data Export
            </Text>
          </CardHeader>
          <CardBody>
            {lastExportTask ? (
              <Flexbox direction="col" gap="3">
                <Text md className="text-text-secondary">
                  Data exports are generated periodically for backup and analysis purposes. These exports contain
                  comprehensive snapshots of cube data.
                </Text>
                <Flexbox direction="row" gap="4" className="pt-3 border-t border-border">
                  <Flexbox direction="col" gap="2" className="flex-1">
                    <Text sm className="text-text-secondary">
                      Last Export
                    </Text>
                    <Text semibold md>
                      {formatDate(lastExportTask.completedAt || lastExportTask.timestamp)}
                    </Text>
                  </Flexbox>
                  <Flexbox direction="col" gap="2" className="flex-1">
                    <Text sm className="text-text-secondary">
                      Total Records
                    </Text>
                    <Text semibold md>
                      {lastExportTask.totalRecords.toLocaleString()}
                    </Text>
                  </Flexbox>
                </Flexbox>
              </Flexbox>
            ) : (
              <Text className="text-text-secondary">No completed export tasks found.</Text>
            )}
          </CardBody>
        </Card>

        {/* Migration Task */}
        <Card>
          <CardHeader>
            <Text semibold lg>
              Card Migrations
            </Text>
          </CardHeader>
          <CardBody>
            {lastMigrationTask ? (
              <Flexbox direction="col" gap="3">
                <Text md className="text-text-secondary">
                  Card migrations occur when Scryfall deletes or merges cards. These tasks automatically update all
                  affected cubes with the latest changes.
                </Text>
                <Flexbox direction="row" gap="4" className="pt-3 border-t border-border">
                  <Flexbox direction="col" gap="2" className="flex-1">
                    <Text sm className="text-text-secondary">
                      Last Migration
                    </Text>
                    <Text semibold md>
                      {formatDate(lastMigrationTask.completedAt || lastMigrationTask.timestamp)}
                    </Text>
                  </Flexbox>
                  <Flexbox direction="col" gap="2" className="flex-1">
                    <Text sm className="text-text-secondary">
                      Cubes Affected
                    </Text>
                    <Text semibold md>
                      {lastMigrationTask.cubesAffected.toLocaleString()}
                    </Text>
                  </Flexbox>
                </Flexbox>
                <Flexbox direction="row" gap="4" className="pt-3 border-t border-border">
                  <Flexbox direction="col" gap="2" className="flex-1">
                    <Text sm className="text-text-secondary">
                      Cards Deleted
                    </Text>
                    <Text semibold md>
                      {lastMigrationTask.cardsDeleted.toLocaleString()}
                    </Text>
                  </Flexbox>
                  <Flexbox direction="col" gap="2" className="flex-1">
                    <Text sm className="text-text-secondary">
                      Cards Merged
                    </Text>
                    <Text semibold md>
                      {lastMigrationTask.cardsMerged.toLocaleString()}
                    </Text>
                  </Flexbox>
                </Flexbox>
              </Flexbox>
            ) : (
              <Text className="text-text-secondary">No completed migration tasks found.</Text>
            )}
          </CardBody>
        </Card>
      </Flexbox>
    </Container>
  </MainLayout>
);

export default RenderToRoot(CardUpdatesPage);

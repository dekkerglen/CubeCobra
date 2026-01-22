import React from 'react';

import { CardUpdateTask } from '@utils/datatypes/CardUpdateTask';
import { ExportTask } from '@utils/datatypes/ExportTask';
import { MigrationTask } from '@utils/datatypes/MigrationTask';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
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
            <Flexbox direction="col" gap="3">
              <Text md className="text-text-secondary">
                CubeCobra automatically downloads and processes the latest Magic: The Gathering card data from{' '}
                <Link href="https://scryfall.com/docs/api/bulk-data" target="_blank" rel="noopener noreferrer">
                  Scryfall's bulk data API
                </Link>
                . This includes all card information, images, prices, legalities, and set data. Updates run daily to
                ensure you always have access to the newest cards and accurate information. There are a number of
                additional data sources that enrich the data, including{' '}
                <Link href="https://commanderspellbook.com/">Commander Spellbook</Link> for combo data, and pricing data
                for marketplace specific pricing. We also use our recommendation engine to calculate up to date synergy
                and cache calculations to improve draftbot performance.
              </Text>
              {lastCardUpdate ? (
                <>
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
                </>
              ) : (
                <Text className="text-text-secondary pt-3 border-t border-border">
                  No completed card updates found.
                </Text>
              )}
            </Flexbox>
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
            <Flexbox direction="col" gap="3">
              <Text md className="text-text-secondary">
                Periodic data exports create comprehensive snapshots of all cube data on CubeCobra, including cube
                lists, analytics, and historical information. These exports are primarily used for data analysis
                purposes. If you're interested in accessing exported data for research or analysis, please request
                access via our{' '}
                <Link href="https://discord.gg/Hn39bCU" target="_blank" rel="noopener noreferrer">
                  Discord server
                </Link>
                .
              </Text>

              {lastExportTask && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <Text semibold md className="mb-2">
                    📦 Download Latest Data Export
                  </Text>
                  <Text sm className="text-text-secondary mb-2">
                    The latest card data and ML models are available for download from our public S3 bucket. This
                    includes all the data files needed for local development:
                  </Text>
                  <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                    <div className="mb-2"># Download all data files (card definitions + ML models)</div>
                    <div>npm run download-data-files</div>
                    <div className="mt-3 mb-2"># Or download manually from S3:</div>
                    <div>aws s3 sync s3://cubecobra-public/ ./data/ --no-sign-request</div>
                  </div>
                  <Text xs className="text-text-secondary mt-2">
                    ✅ No AWS credentials required • Downloads from public bucket • Safe to run
                  </Text>
                </div>
              )}

              {lastExportTask ? (
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
              ) : (
                <Text className="text-text-secondary pt-3 border-t border-border">
                  No completed export tasks found.
                </Text>
              )}
            </Flexbox>
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
            <Flexbox direction="col" gap="3">
              <Text md className="text-text-secondary">
                When Scryfall removes duplicate cards or merges card entries (usually due to corrections in their
                database), CubeCobra automatically migrates affected cubes to use the correct card versions. This
                ensures your cubes always reference valid, up-to-date card data and prevents broken links or missing
                cards. The migration process runs automatically whenever Scryfall publishes card deletions or merges.
              </Text>
              {lastMigrationTask ? (
                <>
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
                </>
              ) : (
                <Text className="text-text-secondary pt-3 border-t border-border">
                  No completed migration tasks found.
                </Text>
              )}
            </Flexbox>
          </CardBody>
        </Card>
      </Flexbox>
    </Container>
  </MainLayout>
);

export default RenderToRoot(CardUpdatesPage);

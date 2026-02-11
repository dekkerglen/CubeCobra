import React from 'react';

import { CardMetadataTask } from '@utils/datatypes/CardMetadataTask';
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
  lastCardMetadataTask?: CardMetadataTask;
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

const CardUpdatesPage: React.FC<CardUpdatesPageProps> = ({
  lastCardUpdate,
  lastCardMetadataTask,
  lastExportTask,
  lastMigrationTask,
}) => (
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
                Every day, CubeCobra automatically downloads the latest Magic: The Gathering card data from{' '}
                <Link href="https://scryfall.com/docs/api/bulk-data" target="_blank" rel="noopener noreferrer">
                  Scryfall's bulk data API
                </Link>
                . This includes all official card information: names, types, mana costs, oracle text, legalities, set
                data, and images. We also pull in current market prices from multiple sources so you can track the value
                of your cube. This update ensures you always have access to the newest cards from the latest sets and
                accurate, up-to-date card information.
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
                        Total Cards
                      </Text>
                      <Text semibold md>
                        {lastCardUpdate.totalCards.toLocaleString()}
                      </Text>
                    </Flexbox>
                    <Flexbox direction="col" gap="2" className="flex-1">
                      <Text sm className="text-text-secondary">
                        Cards Added
                      </Text>
                      <Text semibold md>
                        +{lastCardUpdate.cardsAdded.toLocaleString()}
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

        {/* Card Metadata Update */}
        <Card>
          <CardHeader>
            <Text semibold lg>
              Card Metadata & Correlations
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <Text md className="text-text-secondary">
                Once a week, CubeCobra analyzes how cards are used across the entire platform. This process examines
                millions of data points from all public cubes and draft logs to calculate:
              </Text>
              <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
                <li>
                  <span className="font-semibold">Card Popularity:</span> How often each card appears in cubes across
                  CubeCobra
                </li>
                <li>
                  <span className="font-semibold">Draft Performance:</span> ELO ratings based on how often cards are
                  picked during drafts
                </li>
                <li>
                  <span className="font-semibold">Card Correlations:</span> Which cards are frequently cubed together or
                  drafted in the same decks
                </li>
                <li>
                  <span className="font-semibold">Combo Data:</span> Importing the latest infinite combos and powerful
                  interactions from{' '}
                  <Link href="https://commanderspellbook.com/" target="_blank" rel="noopener noreferrer">
                    Commander Spellbook
                  </Link>
                </li>
              </ul>
              <Text md className="text-text-secondary mt-2">
                These statistics are displayed on individual card pages, allowing you to see how popular each card is,
                how it performs in drafts, and which cards are commonly used alongside it in other cubes. The weekly
                cadence ensures you get fresh data without overwhelming our servers or slowing down the site.
              </Text>
              {lastCardMetadataTask ? (
                <>
                  <Flexbox direction="row" gap="4" className="pt-3 border-t border-border">
                    <Flexbox direction="col" gap="2" className="flex-1">
                      <Text sm className="text-text-secondary">
                        Last Update
                      </Text>
                      <Text semibold md>
                        {formatDate(lastCardMetadataTask.completedAt || lastCardMetadataTask.timestamp)}
                      </Text>
                    </Flexbox>
                    <Flexbox direction="col" gap="2" className="flex-1">
                      <Text sm className="text-text-secondary">
                        Update Frequency
                      </Text>
                      <Text semibold md>
                        Weekly
                      </Text>
                    </Flexbox>
                  </Flexbox>
                </>
              ) : (
                <Text className="text-text-secondary pt-3 border-t border-border">
                  No completed metadata updates found.
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
                Every three months, CubeCobra creates comprehensive exports of all public data on the platform. These
                exports are made freely available for researchers, content creators, and anyone interested in cube
                analytics. The exports include complete cube lists, draft picks, deck data, and card definitions in
                machine-readable JSON formats.
              </Text>

              <Link href="/tool/exports" className="text-link hover:underline font-semibold">
                View Data Exports Guide →
              </Link>

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
                Occasionally, Scryfall corrects errors in their database by removing duplicate card entries or merging
                cards that were mistakenly listed separately. When this happens, CubeCobra automatically updates all
                affected cubes to reference the correct card versions. This maintenance happens behind the scenes to
                ensure your cubes always use valid, current card data. You'll never see broken images or missing cards
                due to Scryfall's database changes - we handle all the migrations automatically to keep your cubes
                working perfectly.
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
